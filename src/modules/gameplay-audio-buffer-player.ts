import { logger } from '../core/logger.js';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';
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
// A soft residency limit: audible and queued users always win over eviction.
// Fits the ~51 MiB Forest World/gameplay working set without per-return churn.
// The separately owned main theme is not included in this cache.
const DESKTOP_DECODED_AUDIO_BUDGET_BYTES = 64 * 1024 * 1024;
const MOBILE_DECODED_AUDIO_BUDGET_BYTES = 32 * 1024 * 1024;
export function resolveDecodedGameplayAudioBudgetBytes(isMobileDevice: boolean): number {
  return isMobileDevice ? MOBILE_DECODED_AUDIO_BUDGET_BYTES : DESKTOP_DECODED_AUDIO_BUDGET_BYTES;
}
const DECODED_AUDIO_BUDGET_BYTES = resolveDecodedGameplayAudioBudgetBytes(
  MOBILE_RUNTIME_PROFILE.isMobileDevice,
);
const FAILED_LOAD_RETRY_MS = 2_000;
type DecodedEntry = { buffer: AudioBuffer; bytes: number; lastUsed: number };
const decodedBuffers = new Map<string, DecodedEntry>();
const successfullyDecodedSources = new Set<string>();
let cacheGeneration = 0;
let evictedBuffers = 0;
let evictedBytes = 0;
let redecodedBuffers = 0;
const pendingBuffers = new Map<string, Promise<void>>();
const failedBuffers = new Map<string, number>();
const activeVoices = new Map<string, ActiveVoice>();
const pendingVoiceStarts = new Map<string, PendingVoiceStart>();

function protectedSources(): Set<string> {
  return new Set([
    ...Array.from(activeVoices.values(), (voice) => voice.resolvedSource),
    ...Array.from(pendingVoiceStarts.values(), (voice) => resolveSource(voice.source)),
  ]);
}

function trimDecodedCache(budgetBytes = DECODED_AUDIO_BUDGET_BYTES): void {
  let bytes = Array.from(decodedBuffers.values()).reduce((sum, entry) => sum + entry.bytes, 0);
  if (bytes <= budgetBytes) return;
  const protectedKeys = protectedSources();
  const idle = Array.from(decodedBuffers.entries())
    .filter(([source]) => !protectedKeys.has(source))
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  // Pressure, not elapsed time, retires reusable audio. Fixed idle deadlines
  // force expensive redecodes on every World return even below the budget.
  for (const [source, entry] of idle) {
    if (bytes <= budgetBytes) break;
    decodedBuffers.delete(source);
    bytes -= entry.bytes;
    evictedBuffers++;
    evictedBytes += entry.bytes;
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
  if (entry) entry.lastUsed = Date.now();
  trimDecodedCache();
}

function onGameplayAudioForeground(event?: Event): void {
  const nativeAudioIsActive = event?.type === NATIVE_AUDIO_ACTIVE_EVENT;
  if (typeof document !== 'undefined' && document.hidden && !nativeAudioIsActive) return;
  const context = audioContext;
  if (context && context.state !== 'running' && context.state !== 'closed') {
    // A suspended/interrupted iOS Web Audio context cannot finish active
    // result or ambient voices. Resume its existing sources; never replay SFX.
    armForegroundGestureRetry();
    void resumeAudioContext(context).then(() => {
      if (context !== audioContext) return;
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
  if (!context || context.state === 'closed') return;
  if (context.state === 'running') {
    disarmForegroundGestureRetry();
    flushReadyPendingVoiceStarts(context);
    return;
  }
  if (typeof document !== 'undefined' && !document.hidden) onGameplayAudioForeground();
}

function onForegroundAudioGesture(event: Event): void {
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
  void resumeAudioContext(context).then(() => {
    if (context === audioContext && context.state === 'running') {
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
  if (context !== audioContext || context.state !== 'running') return;
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

function preloadSource(context: AudioContext, source: string): void {
  const resolvedSource = resolveSource(source);
  if (
    decodedBuffers.has(resolvedSource) ||
    pendingBuffers.has(resolvedSource) ||
    isLoadCoolingDown(resolvedSource)
  ) return;

  const generation = cacheGeneration;

  const pending = (async () => {
    try {
      const response = await fetch(resolvedSource, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const encodedAudio = await response.arrayBuffer();
      const decodedAudio = await context.decodeAudioData(encodedAudio);
      if (generation !== cacheGeneration) return;
      if (successfullyDecodedSources.has(resolvedSource)) redecodedBuffers++;
      successfullyDecodedSources.add(resolvedSource);
      decodedBuffers.set(resolvedSource, {
        buffer: decodedAudio,
        bytes: decodedAudio.length * decodedAudio.numberOfChannels * Float32Array.BYTES_PER_ELEMENT,
        lastUsed: Date.now(),
      });
      failedBuffers.delete(resolvedSource);
    } catch (error) {
      if (generation !== cacheGeneration) return;
      failedBuffers.set(resolvedSource, Date.now() + FAILED_LOAD_RETRY_MS);
      logger.warn(`Failed to predecode gameplay sound ${source}:`, error);
    } finally {
      if (generation === cacheGeneration) {
        pendingBuffers.delete(resolvedSource);
        trimDecodedCache();
      }
    }
  })();
  pendingBuffers.set(resolvedSource, pending);
}

export function preloadDecodedGameplaySounds(sources: readonly string[]): boolean {
  const context = getAudioContext();
  if (!context) return false;
  resumeAudioContext(context);
  sources.forEach((source) => preloadSource(context, source));
  return true;
}

export function getDecodedGameplaySoundsState(
  sources: readonly string[],
): 'ready' | 'pending' | 'unavailable' {
  const context = getAudioContext();
  if (!context) return 'unavailable';

  const resolvedSources = sources.map(resolveSource);
  if (resolvedSources.some(isLoadCoolingDown)) return 'unavailable';
  if (resolvedSources.every((source) => decodedBuffers.has(source))) return 'ready';
  sources.forEach((source) => preloadSource(context, source));
  return 'pending';
}

function stopVoice(voiceId: string, trim: boolean): void {
  const pendingVoice = pendingVoiceStarts.get(voiceId);
  pendingVoiceStarts.delete(voiceId);
  pendingVoice?.options.onStopped?.();
  const voice = activeVoices.get(voiceId);
  if (!voice) {
    if (trim) trimDecodedCache();
    return;
  }
  activeVoices.delete(voiceId);
  voice.source.onended = null;
  try { voice.source.stop(); } catch {}
  try { voice.source.disconnect(); } catch {}
  try { voice.gain.disconnect(); } catch {}
  voice.onStopped?.();
  if (trim) releaseCachedVoiceSource(voice.resolvedSource);
}

export function stopDecodedGameplayVoice(voiceId: string): void {
  stopVoice(voiceId, true);
}

export function stopDecodedGameplayVoices(voiceIds: readonly string[]): void {
  voiceIds.forEach(stopDecodedGameplayVoice);
}

export function fadeOutDecodedGameplayVoice(voiceId: string, durationSeconds: number): boolean {
  const pendingVoice = pendingVoiceStarts.get(voiceId);
  pendingVoiceStarts.delete(voiceId);
  pendingVoice?.options.onStopped?.();
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
  const context = getAudioContext();
  if (!context) return 'unavailable';

  const resolvedSource = resolveSource(source);
  if (isLoadCoolingDown(resolvedSource)) return 'unavailable';
  const entry = decodedBuffers.get(resolvedSource);
  const buffer = entry?.buffer;
  if (entry) entry.lastUsed = Date.now();
  if (!buffer || context.state !== 'running') {
    const token = Symbol(options.voiceId);
    pendingVoiceStarts.set(options.voiceId, { source, options: { ...options }, token });
    preloadSource(context, source);
    const decodeReady = pendingBuffers.get(resolvedSource) ?? Promise.resolve();
    void Promise.all([decodeReady, resumeAudioContext(context)]).then(() => {
      const pendingStart = pendingVoiceStarts.get(options.voiceId);
      if (!pendingStart || pendingStart.token !== token) return;
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

  try {
    stopVoice(options.voiceId, false);

    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
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
    const voice = { resolvedSource, source: sourceNode, gain: gainNode, onStopped: options.onStopped };
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
    options.onStarted?.();
    return 'played';
  } catch (error) {
    stopVoice(options.voiceId, true);
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
  let decodedBytes = 0;
  let idleBytes = 0;
  for (const [source, entry] of decodedBuffers) {
    decodedBytes += entry.bytes;
    if (!protectedKeys.has(source)) idleBytes += entry.bytes;
  }
  return {
    decodedBytes,
    idleBytes,
    budgetBytes: DECODED_AUDIO_BUDGET_BYTES,
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
  disarmForegroundGestureRetry();
  if (foregroundListenersInstalled) {
    document.removeEventListener('visibilitychange', onGameplayAudioForeground);
    window.removeEventListener('pageshow', onGameplayAudioForeground);
    window.removeEventListener(NATIVE_AUDIO_ACTIVE_EVENT, onGameplayAudioForeground);
    foregroundListenersInstalled = false;
  }
  stopDecodedGameplayVoices(Array.from(activeVoices.keys()));
  decodedBuffers.clear();
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
}
