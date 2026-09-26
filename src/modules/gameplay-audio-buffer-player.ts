import { logger } from '../core/logger.js';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';
import { isThermalAudioIsolationAvailable, isThermalAudioSuppressed, recordThermalAudioIsolationBlock, subscribeThermalAudioIsolation } from '../utils/thermal-audio-isolation.ts';
import {
  captureGameplayAudioDiagnosticRequest,
  gameplayAudioDiagnosticNow,
  recordGameplayAudioDiagnostic,
  type GameplayAudioDiagnosticDetail,
  type GameplayAudioDiagnosticRequest,
} from './gameplay-audio-diagnostics.ts';
import {
  NATIVE_AUDIO_ACTIVE_EVENT,
  SoundtrackContextRecovery,
} from './soundtrack-context-recovery.js';

export type GameplayAudioPlaybackResult = 'played' | 'pending' | 'unavailable';

export interface GameplayAudioPlaybackOptions {
  voiceId: string;
  volume: number;
  loop?: boolean;
  playbackRate?: number;
  startOffsetSeconds?: number;
  startDelaySeconds?: number;
  stopAfterSeconds?: number;
  fadeOutSeconds?: number;
  onStarted?: () => void;
  onEnded?: () => void;
  /** Called when lifecycle cleanup cancels a queued or active voice. */
  onStopped?: () => void;
  /** Called only when a queued cold start later proves unavailable. */
  onDeferredUnavailable?: () => void;
}

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type ActiveVoice = {
  resolvedSource: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  onStopped?: () => void;
};

type PendingVoiceStart = {
  source: string;
  options: GameplayAudioPlaybackOptions;
  token: symbol;
};

let audioContext: AudioContext | null = null;
let audioContextRecovery: SoundtrackContextRecovery | null = null;
let audioContextUnavailable = false;
let foregroundListenersInstalled = false;
let foregroundGestureRetryArmed = false;
let audioLifecycleHidden = false;
let nativeForegroundOverridesHidden = false;
let playbackGeneration = 0;
// Audible and queued users always win over eviction. The separately owned
// soundtrack is not included. Mobile normally retains at most 32 MiB, but a
// single authored long loop gets its own bounded slot plus 16 MiB for effects:
// Forest resamples to 32.22 MiB at 48 kHz and otherwise evicts every idle SFX.
const DESKTOP_DECODED_AUDIO_BUDGET_BYTES = 64 * 1024 * 1024;
const MOBILE_DECODED_AUDIO_BUDGET_BYTES = 32 * 1024 * 1024;
const MOBILE_LONG_LOOP_LIMIT_BYTES = 36 * 1024 * 1024;
const MOBILE_LONG_LOOP_THRESHOLD_BYTES = 24 * 1024 * 1024;
// The largest authored Special package (Barrel, 12.22 MiB at 48 kHz) and
// ordinary merge/stack/pickup/poof/landing/no-moves cues fit together. Other
// accumulated families share this LRU budget; it is not a per-family allowance.
const MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES = 16 * 1024 * 1024;
export function resolveDecodedGameplayAudioBudgetBytes(isMobileDevice: boolean): number {
  return isMobileDevice ? MOBILE_DECODED_AUDIO_BUDGET_BYTES : DESKTOP_DECODED_AUDIO_BUDGET_BYTES;
}
const DECODED_AUDIO_BUDGET_BYTES = resolveDecodedGameplayAudioBudgetBytes(
  MOBILE_RUNTIME_PROFILE.isMobileDevice,
);
const FAILED_LOAD_RETRY_MS = 2_000;
type DecodedEntry = { buffer: AudioBuffer; bytes: number; lastUsed: number; lastUseAtMs?: number | null };
const decodedBuffers = new Map<string, DecodedEntry>();
const loopSources = new Set<string>();
const successfullyDecodedSources = new Set<string>();
let cacheGeneration = 0;
let cacheAccessSequence = 0;
let evictedBuffers = 0;
let evictedBytes = 0;
let redecodedBuffers = 0;
const pendingBuffers = new Map<string, Promise<void>>();
const failedBuffers = new Map<string, number>();
const activeVoices = new Map<string, ActiveVoice>();
const pendingVoiceStarts = new Map<string, PendingVoiceStart>();
const diagnosticLoadJobs = new Set<symbol>();
const diagnosticDecodeJobs = new Set<symbol>();
let isolationCleanupPending = 0;
let isolationCleanupGeneration = 0;

subscribeThermalAudioIsolation((enabled) => {
  const isolationGeneration = ++isolationCleanupGeneration;
  if (!enabled) return; // The live route/gesture owns any later restart.
  cacheGeneration++;
  stopDecodedGameplayVoices([...new Set([...activeVoices.keys(), ...pendingVoiceStarts.keys()])]);
  releaseIdleDecodedGameplayAudio();
  pendingBuffers.clear();
  failedBuffers.clear();
  loopSources.clear();
  disarmForegroundGestureRetry();
  audioContextRecovery?.cancel();
  audioContextRecovery = null;
  const context = audioContext;
  audioContext = null;
  audioContextUnavailable = false;
  context?.removeEventListener('statechange', onGameplayAudioStateChange);
  try { void context?.close().catch(() => {}); } catch {}
  isolationCleanupPending++;
  void import('./thermal-gameplay-audio-cleanup.ts')
    .then(({ stopThermalGameplayAudioFallbacks }) => stopThermalGameplayAudioFallbacks(
      () => isThermalAudioSuppressed() && isolationGeneration === isolationCleanupGeneration,
    ))
    .catch(() => {})
    .finally(() => { isolationCleanupPending--; });
});

function diagnosticCounts() {
  return { activeVoices: activeVoices.size, pendingVoices: pendingVoiceStarts.size, pendingLoads: pendingBuffers.size };
}

function touchEntry(entry: DecodedEntry): void {
  entry.lastUsed = ++cacheAccessSequence;
  const at = gameplayAudioDiagnosticNow();
  if (at !== null) entry.lastUseAtMs = at;
}

function protectedSources(): Set<string> {
  return new Set([
    ...Array.from(activeVoices.values(), (voice) => voice.resolvedSource),
    ...Array.from(pendingVoiceStarts.values(), (voice) => resolveSource(voice.source)),
  ]);
}

function isReservableMobileLoop(source: string, entry: DecodedEntry): boolean {
  return MOBILE_RUNTIME_PROFILE.isMobileDevice && loopSources.has(source)
    && entry.bytes > MOBILE_LONG_LOOP_THRESHOLD_BYTES
    && entry.bytes <= MOBILE_LONG_LOOP_LIMIT_BYTES;
}

function getReservedMobileLoop(protectedKeys: Set<string>): [string, DecodedEntry] | undefined {
  // One slot, not one allowance per loop. Prefer a currently owned loop over
  // speculative preparation, then the most recently used candidate.
  return Array.from(decodedBuffers.entries())
    .filter(([source, entry]) => isReservableMobileLoop(source, entry))
    .sort((a, b) => Number(protectedKeys.has(b[0])) - Number(protectedKeys.has(a[0]))
      || b[1].lastUsed - a[1].lastUsed)[0];
}

function evictDecodedEntry(source: string, entry: DecodedEntry, reason: GameplayAudioDiagnosticDetail['reason']): void {
  decodedBuffers.delete(source);
  evictedBuffers++;
  evictedBytes += entry.bytes;
  if (gameplayAudioDiagnosticNow() !== null) recordGameplayAudioDiagnostic({
    kind: 'evict', source, reason, bytes: entry.bytes,
    lastUseSequence: entry.lastUsed, lastUseAtMs: entry.lastUseAtMs ?? null,
    ...diagnosticCounts(),
  });
}

function retireOtherIdleLongLoops(nextLoopSource: string): void {
  const protectedKeys = protectedSources();
  // A superseded preload can finish after this surface starts. It may still
  // satisfy an existing voice, but must not revive an idle reserved slot.
  for (const source of loopSources) {
    if (source !== nextLoopSource && !decodedBuffers.has(source)) loopSources.delete(source);
  }
  for (const [source, entry] of decodedBuffers) {
    if (source === nextLoopSource || !isReservableMobileLoop(source, entry)) continue;
    // A different ambient surface is now authoritative. An outgoing fade is
    // still protected, but cannot retain the long-loop allowance after it ends.
    loopSources.delete(source);
    if (!protectedKeys.has(source)) evictDecodedEntry(source, entry, 'loop-replaced');
  }
}

function trimDecodedCache(budgetBytes = DECODED_AUDIO_BUDGET_BYTES): void {
  const protectedKeys = protectedSources();
  // OS pressure deliberately bypasses the reusable long-loop slot as well.
  const reservedLoop = budgetBytes > 0 ? getReservedMobileLoop(protectedKeys) : undefined;
  const effectBudget = reservedLoop ? MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES : budgetBytes;
  let bytes = Array.from(decodedBuffers.entries())
    .reduce((sum, [source, entry]) => sum + (source === reservedLoop?.[0] ? 0 : entry.bytes), 0);
  if (bytes <= effectBudget) return;
  const idle = Array.from(decodedBuffers.entries())
    .filter(([source]) => source !== reservedLoop?.[0] && !protectedKeys.has(source))
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  // Pressure, not elapsed time, retires reusable audio. Fixed idle deadlines
  // force expensive redecodes on every World return even below the budget.
  for (const [source, entry] of idle) {
    if (bytes <= effectBudget) break;
    evictDecodedEntry(source, entry, budgetBytes === 0 ? 'os-pressure' : 'budget');
    bytes -= entry.bytes;
  }
}

function isLoadCoolingDown(source: string): boolean {
  const retryAt = failedBuffers.get(source);
  if (retryAt === undefined) return false;
  if (Date.now() < retryAt) return true;
  failedBuffers.delete(source);
  return false;
}

function releaseCachedVoiceSource(source: string): void {
  const entry = decodedBuffers.get(source);
  if (entry) touchEntry(entry);
  trimDecodedCache();
}

function isGameplayAudioForeground(): boolean {
  return !audioLifecycleHidden && (typeof document === 'undefined'
    || !document.hidden || nativeForegroundOverridesHidden);
}

function hasGameplayAudioOwners(): boolean {
  return activeVoices.size > 0 || pendingVoiceStarts.size > 0;
}

function notifyVoiceStopped(onStopped?: () => void): void {
  try { onStopped?.(); }
  catch (error) { logger.warn('Gameplay sound cleanup callback failed:', error); }
}

function retireGameplayAudioForBackground(): void {
  audioLifecycleHidden = true;
  nativeForegroundOverridesHidden = false;
  playbackGeneration++;
  disarmForegroundGestureRetry();
  audioContextRecovery?.cancel();
  // Keep the decoded cache reusable. Background retires playback ownership,
  // including cold requests, so foreground never replays an old transient.
  const voiceIds = new Set([...activeVoices.keys(), ...pendingVoiceStarts.keys()]);
  voiceIds.forEach((voiceId) => stopVoice(voiceId, false));
  const context = audioContext;
  if (context && context.state !== 'closed' && context.state !== 'suspended') {
    try { void context.suspend?.().catch(() => {}); } catch {}
  }
}

function onGameplayAudioForeground(event?: Event): void {
  const nativeAudioIsActive = event?.type === NATIVE_AUDIO_ACTIVE_EVENT;
  if (typeof document !== 'undefined' && document.hidden && !nativeAudioIsActive) {
    retireGameplayAudioForBackground();
    return;
  }
  audioLifecycleHidden = false;
  // Native activation may precede WebKit's visibility update. Only new
  // requests can use it: the background boundary already retired old tokens.
  nativeForegroundOverridesHidden = nativeAudioIsActive && document.hidden;
  if (!hasGameplayAudioOwners()) return;
  const context = audioContext;
  const admittedPlaybackGeneration = playbackGeneration;
  if (context && context.state !== 'running' && context.state !== 'closed') {
    // A suspended/interrupted iOS Web Audio context cannot finish active
    // result or ambient voices. Resume its existing sources; never replay SFX.
    armForegroundGestureRetry();
    void resumeAudioContext(context).then(() => {
      if (context !== audioContext || admittedPlaybackGeneration !== playbackGeneration
        || !isGameplayAudioForeground() || !hasGameplayAudioOwners()) return;
      if (context.state === 'running') {
        disarmForegroundGestureRetry();
        flushReadyPendingVoiceStarts(context);
      }
      else armForegroundGestureRetry();
    });
  } else if (context?.state === 'running') {
    disarmForegroundGestureRetry();
    flushReadyPendingVoiceStarts(context);
  }
}

function onGameplayAudioStateChange(): void {
  const context = audioContext;
  if (!context || context.state === 'closed' || !isGameplayAudioForeground()
    || !hasGameplayAudioOwners()) return;
  if (context.state === 'running') {
    disarmForegroundGestureRetry();
    flushReadyPendingVoiceStarts(context);
    return;
  }
  if (typeof document !== 'undefined' && !document.hidden) onGameplayAudioForeground();
}

function onForegroundAudioGesture(event: Event): void {
  if (!isGameplayAudioForeground() || !hasGameplayAudioOwners()) {
    disarmForegroundGestureRetry();
    return;
  }
  if (event.type === 'pointerdown') {
    const pointerType = (event as PointerEvent).pointerType;
    if (pointerType && pointerType !== 'mouse') return;
  }
  if (event.type === 'pointerup' && (event as PointerEvent).pointerType === 'mouse') return;
  const context = audioContext;
  if (!context || context.state === 'closed') {
    disarmForegroundGestureRetry();
    return;
  }
  const admittedPlaybackGeneration = playbackGeneration;
  void resumeAudioContext(context).then(() => {
    if (context === audioContext && context.state === 'running'
      && admittedPlaybackGeneration === playbackGeneration && isGameplayAudioForeground()) {
      disarmForegroundGestureRetry();
      flushReadyPendingVoiceStarts(context);
    }
  });
}

function armForegroundGestureRetry(): void {
  if (foregroundGestureRetryArmed) return;
  foregroundGestureRetryArmed = true;
  document.addEventListener('pointerdown', onForegroundAudioGesture, true);
  document.addEventListener('pointerup', onForegroundAudioGesture, true);
  document.addEventListener('touchend', onForegroundAudioGesture, true);
  document.addEventListener('keydown', onForegroundAudioGesture, true);
}

function disarmForegroundGestureRetry(): void {
  if (!foregroundGestureRetryArmed) return;
  foregroundGestureRetryArmed = false;
  document.removeEventListener('pointerdown', onForegroundAudioGesture, true);
  document.removeEventListener('pointerup', onForegroundAudioGesture, true);
  document.removeEventListener('touchend', onForegroundAudioGesture, true);
  document.removeEventListener('keydown', onForegroundAudioGesture, true);
}

function installForegroundListeners(): void {
  if (foregroundListenersInstalled || typeof window === 'undefined') return;
  foregroundListenersInstalled = true;
  document.addEventListener('visibilitychange', onGameplayAudioForeground);
  window.addEventListener('pageshow', onGameplayAudioForeground);
  window.addEventListener('pagehide', retireGameplayAudioForBackground);
  window.addEventListener(NATIVE_AUDIO_ACTIVE_EVENT, onGameplayAudioForeground);
}

function resolveSource(source: string): string {
  if (typeof document === 'undefined') return source;
  return new URL(source, document.baseURI).href;
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  if (audioContextUnavailable || typeof window === 'undefined') return null;

  const AudioContextConstructor = window.AudioContext ||
    (window as WebkitAudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) {
    audioContextUnavailable = true;
    return null;
  }

  try {
    audioContext = new AudioContextConstructor({ latencyHint: 'interactive' });
    audioContextRecovery = new SoundtrackContextRecovery(audioContext);
    audioContext.addEventListener?.('statechange', onGameplayAudioStateChange);
    installForegroundListeners();
    return audioContext;
  } catch (error) {
    audioContextUnavailable = true;
    logger.warn('Web Audio gameplay owner unavailable; using media-element fallback:', error);
    return null;
  }
}

function resumeAudioContext(context: AudioContext): Promise<void> {
  if (context.state === 'running' || context.state === 'closed') return Promise.resolve();
  const recovery = context === audioContext ? audioContextRecovery : null;
  return (recovery?.resume() ?? context.resume()).catch((error) => {
    logger.warn('Failed to resume Web Audio gameplay owner:', error);
  });
}

function flushReadyPendingVoiceStarts(context: AudioContext): void {
  if (context !== audioContext || context.state !== 'running' || !isGameplayAudioForeground()) return;
  for (const [voiceId, pendingStart] of Array.from(pendingVoiceStarts.entries())) {
    const resolvedSource = resolveSource(pendingStart.source);
    if (failedBuffers.has(resolvedSource)) {
      pendingVoiceStarts.delete(voiceId);
      pendingStart.options.onDeferredUnavailable?.();
      continue;
    }
    if (!decodedBuffers.has(resolvedSource)) continue;
    pendingVoiceStarts.delete(voiceId);
    const result = playDecodedGameplaySound(pendingStart.source, pendingStart.options);
    if (result === 'unavailable') pendingStart.options.onDeferredUnavailable?.();
  }
}

function preloadSource(
  context: AudioContext,
  source: string,
  request: GameplayAudioDiagnosticRequest | null = null,
  operation: GameplayAudioDiagnosticDetail['operation'] = 'preload',
): void {
  const resolvedSource = resolveSource(source);
  const existing = decodedBuffers.get(resolvedSource);
  const result = existing ? 'hit' : pendingBuffers.has(resolvedSource) ? 'pending'
    : isLoadCoolingDown(resolvedSource) ? 'cooldown' : 'miss';
  // A current package can be partly resident. Refresh hits before its missing
  // members finish, so older unrelated families yield to this preparation.
  if (existing) touchEntry(existing);
  if (request && operation !== 'play') recordGameplayAudioDiagnostic({
    kind: 'request', source: resolvedSource, operation, result,
    bytes: existing?.bytes, lastUseSequence: existing?.lastUsed,
    lastUseAtMs: existing?.lastUseAtMs ?? null, ...diagnosticCounts(),
  }, request);
  if (result !== 'miss') return;

  const generation = cacheGeneration;
  const admittedPlaybackGeneration = playbackGeneration;
  const job = request || isThermalAudioIsolationAvailable() ? Symbol('audio-load') : null;
  if (job) diagnosticLoadJobs.add(job);

  const pending = (async () => {
    let decodeStartedAt: number | null = null;
    try {
      const response = await fetch(resolvedSource, { cache: 'force-cache' });
      if (generation !== cacheGeneration || isThermalAudioSuppressed()
        || admittedPlaybackGeneration !== playbackGeneration || !isGameplayAudioForeground()) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const encodedAudio = await response.arrayBuffer();
      if (generation !== cacheGeneration || isThermalAudioSuppressed()
        || admittedPlaybackGeneration !== playbackGeneration || !isGameplayAudioForeground()) return;
      decodeStartedAt = request ? gameplayAudioDiagnosticNow() : null;
      if (request) recordGameplayAudioDiagnostic({
        kind: 'decode-start', source: resolvedSource, encodedBytes: encodedAudio.byteLength, ...diagnosticCounts(),
      }, request);
      if (job) diagnosticDecodeJobs.add(job);
      let decodedAudio: AudioBuffer;
      try { decodedAudio = await context.decodeAudioData(encodedAudio); }
      finally { if (job) diagnosticDecodeJobs.delete(job); }
      const discarded = generation !== cacheGeneration;
      const entry: DecodedEntry = {
        buffer: decodedAudio,
        bytes: decodedAudio.length * decodedAudio.numberOfChannels * Float32Array.BYTES_PER_ELEMENT,
        lastUsed: discarded ? cacheAccessSequence : ++cacheAccessSequence,
      };
      const completedAt = request ? gameplayAudioDiagnosticNow() : null;
      if (completedAt !== null) entry.lastUseAtMs = completedAt;
      if (request) recordGameplayAudioDiagnostic({
        kind: 'decode-complete', source: resolvedSource, bytes: entry.bytes, discarded,
        decodeMs: completedAt !== null && decodeStartedAt !== null ? Math.max(0, completedAt - decodeStartedAt) : undefined,
        ...diagnosticCounts(),
      }, request);
      if (discarded) return;
      if (successfullyDecodedSources.has(resolvedSource)) redecodedBuffers++;
      successfullyDecodedSources.add(resolvedSource);
      decodedBuffers.set(resolvedSource, entry);
      failedBuffers.delete(resolvedSource);
    } catch (error) {
      if (generation !== cacheGeneration || admittedPlaybackGeneration !== playbackGeneration) return;
      failedBuffers.set(resolvedSource, Date.now() + FAILED_LOAD_RETRY_MS);
      if (request) recordGameplayAudioDiagnostic({ kind: 'decode-failed', source: resolvedSource, ...diagnosticCounts() }, request);
      logger.warn(`Failed to predecode gameplay sound ${source}:`, error);
    } finally {
      if (job) diagnosticLoadJobs.delete(job);
      if (generation === cacheGeneration) {
        pendingBuffers.delete(resolvedSource);
        trimDecodedCache();
      }
    }
  })();
  pendingBuffers.set(resolvedSource, pending);
}

export function preloadDecodedGameplaySounds(
  sources: readonly string[],
  options: { loop?: boolean } = {},
): boolean {
  if (!isGameplayAudioForeground()) return true; // Handled silently; never create a fallback in background.
  if (isThermalAudioSuppressed()) {
    recordThermalAudioIsolationBlock('sfx-preload');
    return true; // Silent success prevents feature owners from creating HTML fallback audio.
  }
  const context = getAudioContext();
  if (!context) return false;
  if (options.loop) sources.forEach((source) => loopSources.add(resolveSource(source)));
  resumeAudioContext(context);
  const request = captureGameplayAudioDiagnosticRequest('preload:unscoped');
  sources.forEach((source) => preloadSource(context, source, request));
  return true;
}

export function getDecodedGameplaySoundsState(
  sources: readonly string[],
): 'ready' | 'pending' | 'unavailable' {
  if (!isGameplayAudioForeground()) return 'ready';
  if (isThermalAudioSuppressed()) {
    recordThermalAudioIsolationBlock('sfx-state');
    return 'ready';
  }
  const context = getAudioContext();
  if (!context) return 'unavailable';

  const resolvedSources = sources.map(resolveSource);
  if (resolvedSources.some(isLoadCoolingDown)) return 'unavailable';
  const ready = resolvedSources.every((source) => decodedBuffers.has(source));
  const request = captureGameplayAudioDiagnosticRequest('state:unscoped');
  sources.forEach((source) => preloadSource(context, source, request, 'state'));
  return ready ? 'ready' : 'pending';
}

function stopVoice(voiceId: string, trim: boolean): void {
  const pendingVoice = pendingVoiceStarts.get(voiceId);
  const voice = activeVoices.get(voiceId);
  pendingVoiceStarts.delete(voiceId);
  activeVoices.delete(voiceId);
  if (!voice) {
    notifyVoiceStopped(pendingVoice?.options.onStopped);
    if (trim) trimDecodedCache();
    return;
  }
  voice.source.onended = null;
  try { voice.source.stop(); } catch {}
  try { voice.source.disconnect(); } catch {}
  try { voice.gain.disconnect(); } catch {}
  notifyVoiceStopped(pendingVoice?.options.onStopped);
  notifyVoiceStopped(voice.onStopped);
  if (trim) releaseCachedVoiceSource(voice.resolvedSource);
}

export function stopDecodedGameplayVoice(voiceId: string): void {
  stopVoice(voiceId, true);
}

export function stopDecodedGameplayVoices(voiceIds: readonly string[]): void {
  voiceIds.forEach(stopDecodedGameplayVoice);
}

/** Settings and global SFX teardown retire queued and audible owners together. */
export function stopAllDecodedGameplayVoices(): void {
  const voiceIds = new Set([...activeVoices.keys(), ...pendingVoiceStarts.keys()]);
  voiceIds.forEach((voiceId) => stopVoice(voiceId, false));
  trimDecodedCache();
}

export function fadeOutDecodedGameplayVoice(voiceId: string, durationSeconds: number): boolean {
  const pendingVoice = pendingVoiceStarts.get(voiceId);
  pendingVoiceStarts.delete(voiceId);
  notifyVoiceStopped(pendingVoice?.options.onStopped);
  trimDecodedCache();
  const voice = activeVoices.get(voiceId);
  const context = audioContext;
  if (!voice || !context) return false;

  const duration = Math.max(0, durationSeconds);
  if (duration === 0) {
    stopDecodedGameplayVoice(voiceId);
    return true;
  }

  try {
    const now = context.currentTime;
    const currentVolume = voice.gain.gain.value;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(currentVolume, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + duration);
    voice.source.stop(now + duration);
    return true;
  } catch {
    stopDecodedGameplayVoice(voiceId);
    return false;
  }
}

export function setDecodedGameplayVoiceVolume(
  voiceId: string,
  volume: number,
  durationSeconds = 0,
): boolean {
  const targetVolume = Math.max(0, Math.min(1, volume));
  const pendingVoice = pendingVoiceStarts.get(voiceId);
  if (pendingVoice) {
    pendingVoice.options = {
      ...pendingVoice.options,
      volume: targetVolume,
    };
  }

  const voice = activeVoices.get(voiceId);
  const context = audioContext;
  if (!voice || !context) return pendingVoice !== undefined;

  try {
    const now = context.currentTime;
    const gain = voice.gain.gain;
    const duration = Math.max(0, durationSeconds);
    if (duration > 0 && typeof gain.cancelAndHoldAtTime === 'function') {
      gain.cancelAndHoldAtTime(now);
    } else {
      const currentVolume = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(currentVolume, now);
    }
    if (duration > 0) gain.linearRampToValueAtTime(targetVolume, now + duration);
    else gain.setValueAtTime(targetVolume, now);
    return true;
  } catch {
    return false;
  }
}

export function playDecodedGameplaySound(
  source: string,
  options: GameplayAudioPlaybackOptions,
): GameplayAudioPlaybackResult {
  if (!isGameplayAudioForeground()) {
    notifyVoiceStopped(options.onStopped);
    return 'played'; // A retired event must not escape into HTML fallback playback.
  }
  if (isThermalAudioSuppressed()) {
    recordThermalAudioIsolationBlock('sfx-play');
    try { options.onStopped?.(); } catch {}
    return 'played';
  }
  const context = getAudioContext();
  if (!context) return 'unavailable';

  const resolvedSource = resolveSource(source);
  if (options.loop) {
    loopSources.add(resolvedSource);
    retireOtherIdleLongLoops(resolvedSource);
  }
  if (isLoadCoolingDown(resolvedSource)) return 'unavailable';
  const entry = decodedBuffers.get(resolvedSource);
  const buffer = entry?.buffer;
  if (entry) touchEntry(entry);
  const diagnosticRequest = captureGameplayAudioDiagnosticRequest(`voice:${options.voiceId}`);
  if (diagnosticRequest) recordGameplayAudioDiagnostic({
    kind: 'request', source: resolvedSource, operation: 'play', result: entry ? 'hit' : pendingBuffers.has(resolvedSource) ? 'pending' : 'miss',
    voiceId: options.voiceId, bytes: entry?.bytes, ...diagnosticCounts(),
  }, diagnosticRequest);
  if (!buffer || context.state !== 'running') {
    const admittedPlaybackGeneration = playbackGeneration;
    const replacedPending = pendingVoiceStarts.get(options.voiceId);
    if (replacedPending) {
      // Retire before publishing the successor. An old feature's onStopped
      // may synchronously stop this ID and must never see the new token.
      const activeBeforeCleanup = activeVoices.get(options.voiceId);
      pendingVoiceStarts.delete(options.voiceId);
      notifyVoiceStopped(replacedPending.options.onStopped);
      const activeAfterCleanup = activeVoices.get(options.voiceId);
      if (pendingVoiceStarts.has(options.voiceId)
        || (activeAfterCleanup && activeAfterCleanup !== activeBeforeCleanup)) {
        // A reentrant callback created an even newer owner; do not replace it.
        notifyVoiceStopped(options.onStopped);
        return 'played';
      }
      if (context !== audioContext || admittedPlaybackGeneration !== playbackGeneration
        || !isGameplayAudioForeground() || isThermalAudioSuppressed()) {
        notifyVoiceStopped(options.onStopped);
        return 'played';
      }
    }
    const token = Symbol(options.voiceId);
    pendingVoiceStarts.set(options.voiceId, { source, options: { ...options }, token });
    preloadSource(context, source, diagnosticRequest, 'play');
    const decodeReady = pendingBuffers.get(resolvedSource) ?? Promise.resolve();
    void Promise.all([decodeReady, resumeAudioContext(context)]).then(() => {
      const pendingStart = pendingVoiceStarts.get(options.voiceId);
      if (!pendingStart || pendingStart.token !== token || context !== audioContext
        || admittedPlaybackGeneration !== playbackGeneration || !isGameplayAudioForeground()) return;
      if (failedBuffers.has(resolvedSource)) {
        pendingVoiceStarts.delete(options.voiceId);
        pendingStart.options.onDeferredUnavailable?.();
        trimDecodedCache();
        return;
      }
      if (context.state !== 'running') {
        armForegroundGestureRetry();
        return;
      }
      pendingVoiceStarts.delete(options.voiceId);
      const result = playDecodedGameplaySound(pendingStart.source, pendingStart.options);
      if (result === 'unavailable') pendingStart.options.onDeferredUnavailable?.();
    });
    return 'pending';
  }

  let attemptedSource: AudioBufferSourceNode | undefined;
  let attemptedGain: GainNode | undefined;
  let attemptedVoice: ActiveVoice | undefined;
  try {
    stopVoice(options.voiceId, false);

    const sourceNode = attemptedSource = context.createBufferSource();
    const gainNode = attemptedGain = context.createGain();
    const now = context.currentTime;
    const volume = Math.max(0, Math.min(1, options.volume));
    const playbackRate = Math.max(0.01, options.playbackRate ?? 1);
    const startOffsetSeconds = Math.max(0, options.startOffsetSeconds ?? 0);
    const startDelaySeconds = Math.max(0, options.startDelaySeconds ?? 0);
    const startAt = now + startDelaySeconds;
    const stopAfterSeconds = options.stopAfterSeconds;
    const fadeOutSeconds = Math.max(0, options.fadeOutSeconds ?? 0);
    let stopAt: number | null = null;

    sourceNode.buffer = buffer;
    sourceNode.loop = options.loop === true;
    sourceNode.playbackRate.setValueAtTime(playbackRate, now);
    gainNode.gain.setValueAtTime(volume, now);
    if (stopAfterSeconds !== undefined) {
      stopAt = startAt + Math.max(0, stopAfterSeconds);
      if (fadeOutSeconds > 0) {
        const fadeStartsAt = Math.max(startAt, stopAt - fadeOutSeconds);
        gainNode.gain.setValueAtTime(volume, fadeStartsAt);
        gainNode.gain.linearRampToValueAtTime(0, stopAt);
      }
    }

    sourceNode.connect(gainNode);
    gainNode.connect(context.destination);
    const voice = attemptedVoice = { resolvedSource, source: sourceNode, gain: gainNode, onStopped: options.onStopped };
    activeVoices.set(options.voiceId, voice);
    sourceNode.onended = () => {
      if (activeVoices.get(options.voiceId) === voice) activeVoices.delete(options.voiceId);
      try { sourceNode.disconnect(); } catch {}
      try { gainNode.disconnect(); } catch {}
      releaseCachedVoiceSource(resolvedSource);
      options.onEnded?.();
    };
    sourceNode.start(startAt, startOffsetSeconds);
    if (stopAt !== null) sourceNode.stop(stopAt);
    trimDecodedCache();
    try { options.onStarted?.(); }
    catch (error) { logger.warn('Gameplay sound start callback failed:', error); }
    return 'played';
  } catch (error) {
    // A native startup failure is availability failure, not lifecycle stop.
    // Retire only this attempt's nodes; onStopped would cancel the feature
    // token before its synchronous/deferred HTML fallback can take ownership.
    if (attemptedVoice && activeVoices.get(options.voiceId) === attemptedVoice) {
      activeVoices.delete(options.voiceId);
    }
    if (attemptedSource) {
      attemptedSource.onended = null;
      try { attemptedSource.stop(); } catch {}
      try { attemptedSource.disconnect(); } catch {}
    }
    try { attemptedGain?.disconnect(); } catch {}
    releaseCachedVoiceSource(resolvedSource);
    logger.warn(`Failed to start decoded gameplay sound ${source}:`, error);
    return 'unavailable';
  }
}

/** Release only unused decoded buffers on an explicit OS memory warning. */
export function releaseIdleDecodedGameplayAudio(): void {
  trimDecodedCache(0);
}

export function getDecodedGameplayAudioStats() {
  const protectedKeys = protectedSources();
  const reservedLoop = getReservedMobileLoop(protectedKeys);
  let decodedBytes = 0;
  let idleBytes = 0;
  for (const [source, entry] of decodedBuffers) {
    decodedBytes += entry.bytes;
    if (!protectedKeys.has(source)) idleBytes += entry.bytes;
  }
  return {
    isolationEnabled: isThermalAudioSuppressed(),
    isolationCleanupPending,
    isolationPendingLoads: diagnosticLoadJobs.size,
    isolationPendingDecodes: diagnosticDecodeJobs.size,
    decodedBytes,
    idleBytes,
    budgetBytes: DECODED_AUDIO_BUDGET_BYTES,
    residentLoopBytes: reservedLoop?.[1].bytes ?? 0,
    effectBudgetBytes: reservedLoop ? MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES : DECODED_AUDIO_BUDGET_BYTES,
    residencyBudgetBytes: reservedLoop
      ? reservedLoop[1].bytes + MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES
      : DECODED_AUDIO_BUDGET_BYTES,
    sampleRate: audioContext?.sampleRate ?? null,
    evictedBuffers,
    evictedBytes,
    redecodedBuffers,
    contextState: audioContext?.state ?? (audioContextUnavailable ? 'unavailable' : 'uninitialized'),
    decodedBuffers: decodedBuffers.size,
    pendingBuffers: pendingBuffers.size,
    failedBuffers: failedBuffers.size,
    activeVoices: activeVoices.size,
    pendingVoiceStarts: pendingVoiceStarts.size,
  };
}

export function resetDecodedGameplayAudioForTests(): void {
  cacheGeneration++;
  cacheAccessSequence = 0;
  disarmForegroundGestureRetry();
  if (foregroundListenersInstalled) {
    document.removeEventListener('visibilitychange', onGameplayAudioForeground);
    window.removeEventListener('pageshow', onGameplayAudioForeground);
    window.removeEventListener('pagehide', retireGameplayAudioForBackground);
    window.removeEventListener(NATIVE_AUDIO_ACTIVE_EVENT, onGameplayAudioForeground);
    foregroundListenersInstalled = false;
  }
  stopDecodedGameplayVoices(Array.from(activeVoices.keys()));
  decodedBuffers.clear();
  loopSources.clear();
  successfullyDecodedSources.clear();
  pendingBuffers.clear();
  failedBuffers.clear();
  pendingVoiceStarts.clear();
  evictedBuffers = 0;
  evictedBytes = 0;
  redecodedBuffers = 0;
  audioContextRecovery?.cancel();
  audioContextRecovery = null;
  if (audioContext) {
    audioContext.removeEventListener?.('statechange', onGameplayAudioStateChange);
    void audioContext.close().catch(() => {});
  }
  audioContext = null;
  audioContextUnavailable = false;
  audioLifecycleHidden = false;
  nativeForegroundOverridesHidden = false;
  playbackGeneration++;
}
