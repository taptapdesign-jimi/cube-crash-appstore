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
import {
  GameplayAudioLoadScheduler,
  type GameplayAudioLoadPriority,
} from './gameplay-load-scheduler.ts';
import {
  isForegroundResourceCritical,
  subscribeForegroundResourceIdle,
} from './foreground-resource-coordinator.ts';
import { createScreenLifecycle } from '../utils/screen-lifecycle.ts';

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

export interface DecodedGameplayAudioPackageSpec {
  id: string;
  sources: readonly string[];
  /** Conservative decoded PCM ceiling for the complete package. */
  maxDecodedBytes: number;
  loop?: boolean;
  /** Internal cache policy for a newly live multi-cue family. It may replace
   * an idle former working set, but never active/pending playback or another
   * admitted package. Explicit route/result leases retain the stricter default. */
  replaceIdleWorkingSet?: boolean;
}

export interface DecodedGameplayAudioPackageLease {
  admitted: boolean;
  release: () => void;
}

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type ActiveVoice = {
  resolvedSource: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAtAudioSeconds: number;
  expectedEndAudioSeconds: number | null;
  completionDeadlineWallMs: number | null;
  completionWatchdog: ReturnType<typeof setTimeout> | null;
  onEnded?: () => void;
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
// soundtrack is not included. Mobile normally retains at most 28 MiB, but a
// single authored long loop gets its own bounded slot plus 16 MiB for effects:
// Forest resamples to 32.22 MiB at 48 kHz and otherwise evicts every idle SFX.
const DESKTOP_DECODED_AUDIO_BUDGET_BYTES = 64 * 1024 * 1024;
const MOBILE_DECODED_AUDIO_BUDGET_BYTES = 28 * 1024 * 1024;
// A native memory warning means the nominal working set is already too large
// for this concrete session. Keep later refills below the warning threshold
// instead of repeating a 0 -> 28 MiB decode/evict cycle on every board retry.
const MOBILE_MEMORY_PRESSURE_AUDIO_BUDGET_BYTES = 16 * 1024 * 1024;
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
let decodedAudioBudgetBytes = DECODED_AUDIO_BUDGET_BYTES;
const FAILED_LOAD_RETRY_MS = 2_000;
type DecodedEntry = {
  buffer: AudioBuffer;
  bytes: number;
  lastUsed: number;
  lastUseAtMs?: number | null;
  /** Real audible starts, not speculative preload requests. */
  audibleUses: number;
  /** Prepared as one coherent multi-cue owner package. This is cache priority,
   * not an audible use; equal-priority packages still fall back to LRU. */
  preparedFamily: boolean;
};
const decodedBuffers = new Map<string, DecodedEntry>();
const loopSources = new Set<string>();
// Metadata survives eviction; it owns no AudioBuffer. Knowing the decoded
// cost prevents optional warmups from repeatedly decoding an unretainable cue.
type DecodedSourceHistory = {
  bytes: number;
  audibleUses: number;
  evictions: number;
};
const successfullyDecodedSources = new Map<string, DecodedSourceHistory>();
const AUDIO_SOURCE_HISTORY_LIMIT = 256;
let skippedSpeculativeLoads = 0;
let cacheGeneration = 0;
let cacheAccessSequence = 0;
let evictedBuffers = 0;
let evictedBytes = 0;
let redecodedBuffers = 0;
let memoryPressureWarningCount = 0;
const pendingBuffers = new Map<string, Promise<void>>();
type DecodedAudioPackageReservation = {
  token: symbol;
  ownerId: string;
  packageKey: string;
  packageId: string;
  resolvedSources: ReadonlySet<string>;
  maxDecodedBytes: number;
};
const decodedAudioPackageReservations = new Map<symbol, DecodedAudioPackageReservation>();
const decodedAudioPackageLeaseByOwner = new Map<string, symbol>();
const pendingDecodedAudioPackages = new Map<string, Promise<void>>();
let rejectedSpeculativePackages = 0;
const gameplayAudioLoadScheduler = new GameplayAudioLoadScheduler(
  MOBILE_RUNTIME_PROFILE.isMobileDevice ? 2 : 8,
  isForegroundResourceCritical,
);
subscribeForegroundResourceIdle(() => gameplayAudioLoadScheduler.resume());

/** Pause optional audio fetch/decode while a foreground animation owns the
 * main thread. Direct audible playback stays admitted by the scheduler. */
export function suspendSpeculativeGameplayAudioLoads(): () => void {
  return gameplayAudioLoadScheduler.suspendSpeculative();
}

const failedBuffers = new Map<string, number>();
const activeVoices = new Map<string, ActiveVoice>();
const voiceCompletionLifecycle = createScreenLifecycle('gameplay-audio-voice-completion');
// WebKit can report a SFX context as `running` while its audio clock remains
// frozen. In that state AudioBufferSourceNode.onended never arrives, so every
// one-shot remains cache-protected forever. This is a cleanup grace only; the
// authored native start/stop schedule is unchanged.
const VOICE_COMPLETION_WATCHDOG_GRACE_MS = 250;
const pendingVoiceStarts = new Map<string, PendingVoiceStart>();
const diagnosticLoadJobs = new Set<symbol>();
const diagnosticDecodeJobs = new Set<symbol>();
let isolationCleanupPending = 0;
let isolationCleanupGeneration = 0;

subscribeThermalAudioIsolation((enabled) => {
  const isolationGeneration = ++isolationCleanupGeneration;
  if (!enabled) return; // The live route/gesture owns any later restart.
  cacheGeneration++;
  gameplayAudioLoadScheduler.cancelQueued();
  clearDecodedAudioPackageReservations();
  stopDecodedGameplayVoices([...new Set([...activeVoices.keys(), ...pendingVoiceStarts.keys()])]);
  // Diagnostic isolation is an explicit full teardown, not an OS pressure
  // adaptation. It must leave no decoded working set behind.
  trimDecodedCache(0);
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

function playbackProtectedSources(): Set<string> {
  return new Set([
    ...Array.from(activeVoices.values(), (voice) => voice.resolvedSource),
    ...Array.from(pendingVoiceStarts.values(), (voice) => resolveSource(voice.source)),
  ]);
}

function protectedSources(): Set<string> {
  const protectedKeys = playbackProtectedSources();
  decodedAudioPackageReservations.forEach((reservation) => {
    reservation.resolvedSources.forEach((source) => protectedKeys.add(source));
  });
  return protectedKeys;
}

function makeDecodedAudioPackageKey(packageId: string, resolvedSources: readonly string[]): string {
  return `${packageId}\u0000${[...new Set(resolvedSources)].sort().join('\u0000')}`;
}

function reservedDecodedAudioPackageBytes(): number {
  const bytesByPackage = new Map<string, number>();
  decodedAudioPackageReservations.forEach((reservation) => {
    bytesByPackage.set(
      reservation.packageKey,
      Math.max(bytesByPackage.get(reservation.packageKey) ?? 0, reservation.maxDecodedBytes),
    );
  });
  return Array.from(bytesByPackage.values()).reduce((sum, bytes) => sum + bytes, 0);
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

function decodedEffectsBudgetBytes(): number {
  return getReservedMobileLoop(protectedSources())
    ? MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES
    : decodedAudioBudgetBytes;
}

function canReserveDecodedAudioPackage(
  packageKey: string,
  resolvedSources: ReadonlySet<string>,
  maxDecodedBytes: number,
  replaceIdleWorkingSet: boolean,
): boolean {
  const effectBudget = decodedEffectsBudgetBytes();
  if (!Number.isFinite(maxDecodedBytes) || maxDecodedBytes <= 0 || maxDecodedBytes > effectBudget) return false;

  const existingPackageKeys = new Set<string>();
  let existingPackageMaxBytes = 0;
  const otherReservedSources = new Set<string>();
  decodedAudioPackageReservations.forEach((reservation) => {
    existingPackageKeys.add(reservation.packageKey);
    if (reservation.packageKey === packageKey) {
      existingPackageMaxBytes = Math.max(existingPackageMaxBytes, reservation.maxDecodedBytes);
    }
    if (reservation.packageKey !== packageKey) {
      reservation.resolvedSources.forEach((source) => otherReservedSources.add(source));
    }
  });
  const packageAlreadyReserved = existingPackageKeys.has(packageKey);
  const reservedBytes = reservedDecodedAudioPackageBytes();
  const playbackProtected = playbackProtectedSources();
  const hotBytesOutsidePackages = Array.from(decodedBuffers.entries()).reduce((sum, [source, entry]) => (
    sum + (!resolvedSources.has(source)
      && !otherReservedSources.has(source)
      && (playbackProtected.has(source)
        || (!replaceIdleWorkingSet && entry.audibleUses > 0)) ? entry.bytes : 0)
  ), 0);
  return reservedBytes
    + (packageAlreadyReserved ? Math.max(0, maxDecodedBytes - existingPackageMaxBytes) : maxDecodedBytes)
    + hotBytesOutsidePackages <= effectBudget;
}

function retireDecodedAudioPackageReservationsOverDeclaredSize(source: string): void {
  const exceeded = Array.from(decodedAudioPackageReservations.values()).filter((reservation) => {
    if (!reservation.resolvedSources.has(source)) return false;
    const decodedBytes = Array.from(reservation.resolvedSources).reduce(
      (sum, packageSource) => sum + (decodedBuffers.get(packageSource)?.bytes ?? 0),
      0,
    );
    return decodedBytes > reservation.maxDecodedBytes;
  });
  exceeded.forEach((reservation) => {
    decodedAudioPackageReservations.delete(reservation.token);
    if (decodedAudioPackageLeaseByOwner.get(reservation.ownerId) === reservation.token) {
      decodedAudioPackageLeaseByOwner.delete(reservation.ownerId);
    }
    rejectedSpeculativePackages += 1;
  });
}

function releaseDecodedAudioPackageReservation(token: symbol): void {
  const reservation = decodedAudioPackageReservations.get(token);
  if (!reservation) return;
  decodedAudioPackageReservations.delete(token);
  if (decodedAudioPackageLeaseByOwner.get(reservation.ownerId) === token) {
    decodedAudioPackageLeaseByOwner.delete(reservation.ownerId);
  }
  trimDecodedCache();
}

function clearDecodedAudioPackageReservations(): void {
  decodedAudioPackageReservations.clear();
  decodedAudioPackageLeaseByOwner.clear();
  pendingDecodedAudioPackages.clear();
}

function reserveDecodedAudioPackage(
  ownerId: string,
  spec: DecodedGameplayAudioPackageSpec,
): { reservation: DecodedAudioPackageReservation; release: () => void } | null {
  const resolvedSources = [...new Set(spec.sources.map(resolveSource))];
  if (!spec.id.trim() || !ownerId.trim() || resolvedSources.length === 0) return null;
  const packageKey = makeDecodedAudioPackageKey(spec.id, resolvedSources);
  const priorToken = decodedAudioPackageLeaseByOwner.get(ownerId);
  const priorReservation = priorToken ? decodedAudioPackageReservations.get(priorToken) : undefined;
  if (priorToken) {
    decodedAudioPackageReservations.delete(priorToken);
    decodedAudioPackageLeaseByOwner.delete(ownerId);
  }
  if (!canReserveDecodedAudioPackage(
    packageKey,
    new Set(resolvedSources),
    spec.maxDecodedBytes,
    spec.replaceIdleWorkingSet === true,
  )) {
    if (priorToken && priorReservation) {
      decodedAudioPackageReservations.set(priorToken, priorReservation);
      decodedAudioPackageLeaseByOwner.set(ownerId, priorToken);
    }
    rejectedSpeculativePackages += 1;
    return null;
  }

  const token = Symbol(`${ownerId}:${spec.id}`);
  const reservation: DecodedAudioPackageReservation = {
    token,
    ownerId,
    packageKey,
    packageId: spec.id,
    resolvedSources: new Set(resolvedSources),
    maxDecodedBytes: spec.maxDecodedBytes,
  };
  decodedAudioPackageReservations.set(token, reservation);
  decodedAudioPackageLeaseByOwner.set(ownerId, token);
  let released = false;
  return {
    reservation,
    release: () => {
      if (released) return;
      released = true;
      releaseDecodedAudioPackageReservation(token);
    },
  };
}

function evictDecodedEntry(source: string, entry: DecodedEntry, reason: GameplayAudioDiagnosticDetail['reason']): void {
  decodedBuffers.delete(source);
  const history = successfullyDecodedSources.get(source);
  if (history) history.evictions += 1;
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

function trimDecodedCache(budgetBytes = decodedAudioBudgetBytes): void {
  const protectedKeys = protectedSources();
  // OS pressure deliberately bypasses the reusable long-loop slot as well.
  const reservedLoop = budgetBytes > 0 ? getReservedMobileLoop(protectedKeys) : undefined;
  const effectBudget = reservedLoop ? MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES : budgetBytes;
  let bytes = Array.from(decodedBuffers.entries())
    .reduce((sum, [source, entry]) => sum + (source === reservedLoop?.[0] ? 0 : entry.bytes), 0);
  if (bytes <= effectBudget) return;
  const idle = Array.from(decodedBuffers.entries())
    .filter(([source]) => source !== reservedLoop?.[0] && !protectedKeys.has(source))
    .sort((a, b) => {
      // A single near-budget transient must not flush a reusable family and
      // then be evicted itself. Prefer rejecting that whale before ordinary
      // LRU ordering; authored long ambience has its separate bounded slot.
      const aNearBudget = Number(a[1].bytes >= effectBudget * 0.75);
      const bNearBudget = Number(b[1].bytes >= effectBudget * 0.75);
      return bNearBudget - aNearBudget
        // Route preloads must not continuously evict small cues that actually
        // played many times (stack, pickup, CTA/nav). This reuse-aware tier
        // stays bounded by the same byte budget; LRU remains the tie-breaker.
        || (a[1].audibleUses >= 2 ? 3 : a[1].preparedFamily ? 2 : a[1].audibleUses > 0 ? 1 : 0)
          - (b[1].audibleUses >= 2 ? 3 : b[1].preparedFamily ? 2 : b[1].audibleUses > 0 ? 1 : 0)
        || a[1].lastUsed - b[1].lastUsed;
    });
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

function clearVoiceCompletionWatchdog(voice: ActiveVoice): void {
  voiceCompletionLifecycle.cancelTimeout(voice.completionWatchdog);
  voice.completionWatchdog = null;
  voice.completionDeadlineWallMs = null;
}

function completeActiveVoice(voiceId: string, voice: ActiveVoice, forceStop: boolean): void {
  if (activeVoices.get(voiceId) !== voice) return;
  activeVoices.delete(voiceId);
  clearVoiceCompletionWatchdog(voice);
  voice.source.onended = null;
  if (forceStop) {
    try { voice.source.stop(); } catch {}
  }
  try { voice.source.disconnect(); } catch {}
  try { voice.gain.disconnect(); } catch {}
  releaseCachedVoiceSource(voice.resolvedSource);
  try { voice.onEnded?.(); }
  catch (error) { logger.warn('Gameplay sound completion callback failed:', error); }
}

function armVoiceCompletionWatchdog(
  voiceId: string,
  voice: ActiveVoice,
  secondsUntilExpectedEnd: number,
): void {
  if (voice.source.loop && voice.expectedEndAudioSeconds === null) return;
  if (voice.completionWatchdog !== null) clearVoiceCompletionWatchdog(voice);
  const delayMs = Math.max(0, secondsUntilExpectedEnd * 1000)
    + VOICE_COMPLETION_WATCHDOG_GRACE_MS;
  voice.completionDeadlineWallMs = Date.now() + delayMs;
  voice.completionWatchdog = voiceCompletionLifecycle.trackTimeout(() => {
    voice.completionWatchdog = null;
    // Background owns an immediate full stop. A visible interrupted context
    // is checked once when it becomes running again; no polling loop is added.
    if (audioContext?.state === 'running') completeActiveVoice(voiceId, voice, true);
  }, delayMs);
}

function completeWallClockOverdueVoices(): void {
  const now = Date.now();
  for (const [voiceId, voice] of activeVoices) {
    if (voice.completionDeadlineWallMs !== null && voice.completionDeadlineWallMs <= now) {
      completeActiveVoice(voiceId, voice, true);
    }
  }
}

function retireGameplayAudioForBackground(): void {
  audioLifecycleHidden = true;
  nativeForegroundOverridesHidden = false;
  playbackGeneration++;
  gameplayAudioLoadScheduler.cancelQueued();
  clearDecodedAudioPackageReservations();
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
        completeWallClockOverdueVoices();
        flushReadyPendingVoiceStarts(context);
      }
      else armForegroundGestureRetry();
    });
  } else if (context?.state === 'running') {
    disarmForegroundGestureRetry();
    completeWallClockOverdueVoices();
    flushReadyPendingVoiceStarts(context);
  }
}

function onGameplayAudioStateChange(): void {
  const context = audioContext;
  if (!context || context.state === 'closed' || !isGameplayAudioForeground()
    || !hasGameplayAudioOwners()) return;
  if (context.state === 'running') {
    disarmForegroundGestureRetry();
    completeWallClockOverdueVoices();
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
      completeWallClockOverdueVoices();
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
  isResidencyOwnerCurrent: (() => boolean) | null = null,
  preparedFamily = false,
): void {
  const resolvedSource = resolveSource(source);
  const existing = decodedBuffers.get(resolvedSource);
  const result = existing ? 'hit' : pendingBuffers.has(resolvedSource) ? 'pending'
    : isLoadCoolingDown(resolvedSource) ? 'cooldown' : 'miss';
  if (existing) touchEntry(existing);
  if (request && operation !== 'play') recordGameplayAudioDiagnostic({
    kind: 'request', source: resolvedSource, operation, result,
    bytes: existing?.bytes, lastUseSequence: existing?.lastUsed,
    lastUseAtMs: existing?.lastUseAtMs ?? null, ...diagnosticCounts(),
  }, request);
  if (result === 'pending') {
    gameplayAudioLoadScheduler.promote(
      resolvedSource,
      operation as GameplayAudioLoadPriority,
    );
    return;
  }
  if (result !== 'miss') return;

  const canAdmitSpeculativeReload = (): boolean => {
    if (operation !== 'preload' || protectedSources().has(resolvedSource)) return true;
    const known = successfullyDecodedSources.get(resolvedSource);
    if (!known) return true; // Learn an authored source's actual resampled size once.
    // A source evicted before it ever played was speculative waste. Do not
    // repeat that decode on every route warmup. Audible playback always
    // bypasses this policy.
    if (known.evictions > 0 && known.audibleUses === 0) return false;
    const protectedKeys = protectedSources();
    const reservedLoop = getReservedMobileLoop(protectedKeys);
    if (MOBILE_RUNTIME_PROFILE.isMobileDevice && loopSources.has(resolvedSource)
      && known.bytes > MOBILE_LONG_LOOP_THRESHOLD_BYTES && known.bytes <= MOBILE_LONG_LOOP_LIMIT_BYTES) return true;
    const budget = reservedLoop ? MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES : decodedAudioBudgetBytes;
    // Only unseen optional buffers may yield to another optional request.
    // Audible history and active/pending voices take precedence over warming.
    const retainedBytes = Array.from(decodedBuffers.entries()).reduce((sum, [key, entry]) => (
      sum + (key !== reservedLoop?.[0]
        && (entry.audibleUses > 0 || protectedKeys.has(key)) ? entry.bytes : 0)
    ), 0);
    return known.bytes < budget * 0.75 && retainedBytes + known.bytes <= budget;
  };
  if (!canAdmitSpeculativeReload()) {
    skippedSpeculativeLoads += 1;
    return;
  }

  const generation = cacheGeneration;
  const admittedPlaybackGeneration = playbackGeneration;
  const pending = gameplayAudioLoadScheduler.enqueue(
    resolvedSource,
    operation as GameplayAudioLoadPriority,
    async () => {
    if (isResidencyOwnerCurrent && !isResidencyOwnerCurrent()
      && !playbackProtectedSources().has(resolvedSource)) return;
    // Queued packages can outlive a visual transition or a cache refill.
    // Recheck admission at execution; audible promotion protects its source.
    if (!canAdmitSpeculativeReload()) {
      skippedSpeculativeLoads += 1;
      return;
    }
    const job = request || isThermalAudioIsolationAvailable() ? Symbol('audio-load') : null;
    if (job) diagnosticLoadJobs.add(job);
    let decodeStartedAt: number | null = null;
    try {
      const response = await fetch(resolvedSource, { cache: 'force-cache' });
      if (generation !== cacheGeneration || isThermalAudioSuppressed()
        || admittedPlaybackGeneration !== playbackGeneration || !isGameplayAudioForeground()
        || (isResidencyOwnerCurrent && !isResidencyOwnerCurrent()
          && !playbackProtectedSources().has(resolvedSource))) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const encodedAudio = await response.arrayBuffer();
      if (generation !== cacheGeneration || isThermalAudioSuppressed()
        || admittedPlaybackGeneration !== playbackGeneration || !isGameplayAudioForeground()
        || (isResidencyOwnerCurrent && !isResidencyOwnerCurrent()
          && !playbackProtectedSources().has(resolvedSource))) return;
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
        audibleUses: successfullyDecodedSources.get(resolvedSource)?.audibleUses ?? 0,
        preparedFamily,
      };
      const completedAt = request ? gameplayAudioDiagnosticNow() : null;
      if (completedAt !== null) entry.lastUseAtMs = completedAt;
      if (request) recordGameplayAudioDiagnostic({
        kind: 'decode-complete', source: resolvedSource, bytes: entry.bytes, discarded,
        decodeMs: completedAt !== null && decodeStartedAt !== null ? Math.max(0, completedAt - decodeStartedAt) : undefined,
        ...diagnosticCounts(),
      }, request);
      if (discarded || (isResidencyOwnerCurrent && !isResidencyOwnerCurrent()
        && !playbackProtectedSources().has(resolvedSource))) return;
      const previousHistory = successfullyDecodedSources.get(resolvedSource);
      if (previousHistory) redecodedBuffers++;
      successfullyDecodedSources.delete(resolvedSource);
      successfullyDecodedSources.set(resolvedSource, {
        bytes: entry.bytes,
        audibleUses: entry.audibleUses,
        evictions: previousHistory?.evictions ?? 0,
      });
      if (successfullyDecodedSources.size > AUDIO_SOURCE_HISTORY_LIMIT) {
        successfullyDecodedSources.delete(successfullyDecodedSources.keys().next().value!);
      }
      decodedBuffers.set(resolvedSource, entry);
      retireDecodedAudioPackageReservationsOverDeclaredSize(resolvedSource);
      failedBuffers.delete(resolvedSource);
    } catch (error) {
      if (generation !== cacheGeneration || admittedPlaybackGeneration !== playbackGeneration) return;
      failedBuffers.set(resolvedSource, Date.now() + FAILED_LOAD_RETRY_MS);
      if (request) recordGameplayAudioDiagnostic({ kind: 'decode-failed', source: resolvedSource, ...diagnosticCounts() }, request);
      logger.warn(`Failed to predecode gameplay sound ${source}:`, error);
    } finally {
      if (job) diagnosticLoadJobs.delete(job);
    }
  }).finally(() => {
    if (generation === cacheGeneration) {
      pendingBuffers.delete(resolvedSource);
      trimDecodedCache();
    }
  });
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
  const resolvedSources = [...new Set(sources.map(resolveSource))];
  if (resolvedSources.length > 1
    && resolvedSources.some((source) => !decodedBuffers.has(source))) {
    const knownBytes = resolvedSources.map((source) => (
      decodedBuffers.get(source)?.bytes ?? successfullyDecodedSources.get(source)?.bytes
    ));
    if (knownBytes.every((bytes): bytes is number => bytes !== undefined)) {
      return preloadDecodedGameplayAudioPackage({
        id: `known-family:${resolvedSources.slice().sort().join('|')}`,
        sources,
        maxDecodedBytes: knownBytes.reduce((sum, bytes) => sum + bytes, 0),
        loop: options.loop,
        replaceIdleWorkingSet: MOBILE_RUNTIME_PROFILE.isMobileDevice,
      });
    }
  }
  if (options.loop) sources.forEach((source) => loopSources.add(resolveSource(source)));
  resumeAudioContext(context);
  const request = captureGameplayAudioDiagnosticRequest('preload:unscoped');
  sources.forEach((source) => preloadSource(context, source, request));
  return true;
}

function startDecodedGameplayAudioPackagePreparation(
  context: AudioContext,
  reservation: DecodedAudioPackageReservation,
  spec: DecodedGameplayAudioPackageSpec,
): void {
  if (spec.loop) reservation.resolvedSources.forEach((source) => loopSources.add(source));
  resumeAudioContext(context);
  const request = captureGameplayAudioDiagnosticRequest(`preload:package:${spec.id}`);
  const isCurrent = () => decodedAudioPackageReservations.get(reservation.token) === reservation;
  reservation.resolvedSources.forEach((source) => {
    const existing = decodedBuffers.get(source);
    if (existing) {
      existing.preparedFamily = true;
      touchEntry(existing);
    }
    preloadSource(context, source, request, 'preload', isCurrent, true);
  });
}

/**
 * Atomically admits a declared speculative package before any member starts.
 * A declined package is intentionally reported as handled: real playback still
 * owns exact-source loading and must not allocate a detached fallback merely
 * because optional preparation yielded to the active working set.
 */
export function preloadDecodedGameplayAudioPackage(
  spec: DecodedGameplayAudioPackageSpec,
): boolean {
  if (!isGameplayAudioForeground()) return true;
  if (isThermalAudioSuppressed()) {
    recordThermalAudioIsolationBlock('sfx-preload');
    return true;
  }
  const context = getAudioContext();
  if (!context) return false;
  const resolvedSources = [...new Set(spec.sources.map(resolveSource))];
  const packageKey = makeDecodedAudioPackageKey(spec.id, resolvedSources);
  if (pendingDecodedAudioPackages.has(packageKey)) return true;

  const reserved = reserveDecodedAudioPackage(`prepare:${packageKey}`, spec);
  if (!reserved) return true;
  startDecodedGameplayAudioPackagePreparation(context, reserved.reservation, spec);
  const pending = resolvedSources
    .map((source) => pendingBuffers.get(source))
    .filter((promise): promise is Promise<void> => promise !== undefined);
  let completion!: Promise<void>;
  completion = Promise.allSettled(pending)
    .then(() => undefined)
    .finally(() => {
      if (pendingDecodedAudioPackages.get(packageKey) === completion) {
        pendingDecodedAudioPackages.delete(packageKey);
      }
      reserved.release();
    });
  pendingDecodedAudioPackages.set(packageKey, completion);
  return true;
}

/** Pins one admitted route package until its exact lifecycle owner releases. */
export function acquireDecodedGameplayAudioPackage(
  ownerId: string,
  spec: DecodedGameplayAudioPackageSpec,
): DecodedGameplayAudioPackageLease {
  const unavailable = { admitted: false, release: () => {} };
  if (!isGameplayAudioForeground()) return unavailable;
  if (isThermalAudioSuppressed()) {
    recordThermalAudioIsolationBlock('sfx-preload');
    return unavailable;
  }
  const context = getAudioContext();
  if (!context) return unavailable;
  const reserved = reserveDecodedAudioPackage(ownerId, spec);
  if (!reserved) return unavailable;
  startDecodedGameplayAudioPackagePreparation(context, reserved.reservation, spec);
  return { admitted: true, release: reserved.release };
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
  // A capability/readiness probe must not warm every sibling in a family.
  // Explicit preload owns preparation; play owns loading the selected cue.
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
  clearVoiceCompletionWatchdog(voice);
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
  clearDecodedAudioPackageReservations();
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
    voice.expectedEndAudioSeconds = voice.source.loop
      ? now + duration
      : Math.min(now + duration, voice.expectedEndAudioSeconds ?? Infinity);
    armVoiceCompletionWatchdog(
      voiceId,
      voice,
      Math.max(0, voice.expectedEndAudioSeconds - now),
    );
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
    const naturalEnd = options.loop === true ? null
      : startAt + Math.max(0, buffer.duration - startOffsetSeconds) / playbackRate;
    const voice = attemptedVoice = {
      resolvedSource, source: sourceNode, gain: gainNode, onStopped: options.onStopped,
      startedAtAudioSeconds: startAt,
      expectedEndAudioSeconds: stopAt === null ? naturalEnd
        : naturalEnd === null ? stopAt : Math.min(stopAt, naturalEnd),
      completionDeadlineWallMs: null,
      completionWatchdog: null,
      onEnded: options.onEnded,
    };
    activeVoices.set(options.voiceId, voice);
    sourceNode.onended = () => {
      completeActiveVoice(options.voiceId, voice, false);
    };
    sourceNode.start(startAt, startOffsetSeconds);
    if (voice.expectedEndAudioSeconds !== null) {
      armVoiceCompletionWatchdog(
        options.voiceId,
        voice,
        Math.max(0, voice.expectedEndAudioSeconds - now),
      );
    }
    if (entry) {
      entry.audibleUses += 1;
      const history = successfullyDecodedSources.get(resolvedSource);
      if (history) {
        history.audibleUses = entry.audibleUses;
      }
    }
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
      clearVoiceCompletionWatchdog(attemptedVoice);
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

/**
 * Adapt decoded residency on an explicit OS memory warning.
 *
 * The first warning keeps the hottest idle portion of the new 16 MiB working
 * set. Flushing 28 MiB to zero made the same route immediately decode it all
 * again, increasing CPU work and producing a repeat eviction loop. A repeated
 * warning proves that the retained working set was still too expensive for the
 * concrete session, so only then do we release every idle entry. Active and
 * pending voices remain protected at both levels.
 */
export function releaseIdleDecodedGameplayAudio(): void {
  memoryPressureWarningCount += 1;
  clearDecodedAudioPackageReservations();
  if (MOBILE_RUNTIME_PROFILE.isMobileDevice) {
    decodedAudioBudgetBytes = Math.min(
      decodedAudioBudgetBytes,
      MOBILE_MEMORY_PRESSURE_AUDIO_BUDGET_BYTES,
    );
  }
  trimDecodedCache(memoryPressureWarningCount > 1 ? 0 : decodedAudioBudgetBytes);
}

export function getDecodedGameplayAudioStats(includeVoiceDetails = false) {
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
    budgetBytes: decodedAudioBudgetBytes,
    residentLoopBytes: reservedLoop?.[1].bytes ?? 0,
    effectBudgetBytes: reservedLoop ? MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES : decodedAudioBudgetBytes,
    residencyBudgetBytes: reservedLoop
      ? reservedLoop[1].bytes + MOBILE_EFFECTS_WITH_LONG_LOOP_BUDGET_BYTES
      : decodedAudioBudgetBytes,
    memoryPressureAdapted: decodedAudioBudgetBytes < DECODED_AUDIO_BUDGET_BYTES,
    memoryPressureWarningCount,
    memoryPressureMode: memoryPressureWarningCount > 1
      ? 'aggressive-idle-release'
      : memoryPressureWarningCount === 1
        ? 'stable-working-set'
        : 'normal',
    loadScheduler: gameplayAudioLoadScheduler.snapshot(),
    sampleRate: audioContext?.sampleRate ?? null,
    evictedBuffers,
    evictedBytes,
    redecodedBuffers,
    skippedSpeculativeLoads,
    activePackageLeases: decodedAudioPackageReservations.size,
    pendingPackages: pendingDecodedAudioPackages.size,
    reservedPackageBytes: reservedDecodedAudioPackageBytes(),
    rejectedSpeculativePackages,
    contextState: audioContext?.state ?? (audioContextUnavailable ? 'unavailable' : 'uninitialized'),
    decodedBuffers: decodedBuffers.size,
    pendingBuffers: pendingBuffers.size,
    failedBuffers: failedBuffers.size,
    activeVoices: activeVoices.size,
    // Opt-in provenance only: retained JS owners are not proof of audible or
    // CPU-active sources. Use the audio clock, never wall time while suspended.
    ...(includeVoiceDetails ? {
      audioClockSeconds: audioContext?.currentTime ?? null,
      voiceDetails: Array.from(activeVoices, ([voiceId, voice]) => ({
        voiceId,
        source: voice.resolvedSource,
        loop: voice.source.loop,
        gain: voice.gain.gain.value,
        startedAtAudioSeconds: voice.startedAtAudioSeconds,
        expectedEndAudioSeconds: voice.expectedEndAudioSeconds,
        overdueSeconds: voice.expectedEndAudioSeconds === null ? null
          : Math.max(0, (audioContext?.currentTime ?? 0) - voice.expectedEndAudioSeconds),
      })),
    } : {}),
    pendingVoiceStarts: pendingVoiceStarts.size,
  };
}

export function resetDecodedGameplayAudioForTests(): void {
  cacheGeneration++;
  gameplayAudioLoadScheduler.reset();
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
  voiceCompletionLifecycle.cleanup();
  decodedBuffers.clear();
  loopSources.clear();
  clearDecodedAudioPackageReservations();
  successfullyDecodedSources.clear();
  pendingBuffers.clear();
  failedBuffers.clear();
  pendingVoiceStarts.clear();
  evictedBuffers = 0;
  evictedBytes = 0;
  redecodedBuffers = 0;
  memoryPressureWarningCount = 0;
  skippedSpeculativeLoads = 0;
  rejectedSpeculativePackages = 0;
  decodedAudioBudgetBytes = DECODED_AUDIO_BUDGET_BYTES;
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
