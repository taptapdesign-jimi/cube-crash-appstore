import { arePerformanceDiagnosticsEnabled } from '../utils/runtime-diagnostics-policy.ts';

const CAPACITY = 256;
export interface GameplayAudioDiagnosticContext {
  route: string | null;
  boardNumber: number | null;
  entryGeneration: number | null;
  runGeneration: number | null;
}
export interface GameplayAudioDiagnosticRequest {
  caller: string;
  context: GameplayAudioDiagnosticContext;
}
type AudioEventKind = 'request' | 'decode-start' | 'decode-complete' | 'decode-failed' | 'evict';
export interface GameplayAudioDiagnosticDetail {
  kind: AudioEventKind;
  source: string;
  operation?: 'preload' | 'state' | 'play';
  result?: 'hit' | 'miss' | 'pending' | 'cooldown';
  voiceId?: string;
  reason?: 'budget' | 'os-pressure' | 'loop-replaced' | 'transition-idle-release';
  bytes?: number;
  encodedBytes?: number;
  /** Wall time awaiting decodeAudioData, not CPU execution time. */
  decodeMs?: number;
  discarded?: boolean;
  lastUseSequence?: number;
  lastUseAtMs?: number | null;
  activeVoices: number;
  pendingVoices: number;
  pendingLoads: number;
}
type AudioEvent = GameplayAudioDiagnosticDetail & {
  sequence: number;
  at: number;
  context: GameplayAudioDiagnosticContext;
  request: GameplayAudioDiagnosticRequest | null;
};

let contextProvider: (() => GameplayAudioDiagnosticContext) | null = null;
let callerScope: string | null = null;
const ring: Array<AudioEvent | undefined> = new Array(CAPACITY);
let next = 0;
let count = 0;
let sequence = 0;
let overwritten = 0;
let overwrittenSinceDrain = 0;
const summary = { requests: 0, hits: 0, misses: 0, pendingHits: 0, cooldowns: 0, decodes: 0, discardedDecodes: 0, decodeFailures: 0, decodedBytes: 0, decodeWallMs: 0, evictions: 0, evictedBytes: 0 };
type SourceActivity = {
  requests: number;
  misses: number;
  decodes: number;
  decodedBytes: number;
  decodeWallMs: number;
  evictions: number;
  evictedBytes: number;
};
const sourceActivitySinceDrain = new Map<string, SourceActivity>();
const evictionsByReasonSinceDrain = {
  budget: 0,
  'os-pressure': 0,
  'loop-replaced': 0,
  'transition-idle-release': 0,
};

function getSourceActivity(source: string): SourceActivity {
  const key = source.slice(0, 512);
  let activity = sourceActivitySinceDrain.get(key);
  if (!activity) {
    activity = { requests: 0, misses: 0, decodes: 0, decodedBytes: 0, decodeWallMs: 0, evictions: 0, evictedBytes: 0 };
    sourceActivitySinceDrain.set(key, activity);
  }
  return activity;
}

export function setGameplayAudioDiagnosticContextProvider(provider: () => GameplayAudioDiagnosticContext): void {
  contextProvider = provider;
}

function readContext(): GameplayAudioDiagnosticContext {
  try {
    if (contextProvider) return { ...contextProvider() };
  } catch { /* Diagnostics cannot affect sound playback. */ }
  return {
    route: (window as any).__ccAppZone ?? null,
    boardNumber: (window as any).STATE?.boardNumber ?? null,
    entryGeneration: null,
    runGeneration: null,
  };
}

/** Synchronous scope only: each asynchronous load captures its own request. */
export function withGameplayAudioDiagnosticCaller<T>(caller: string, action: () => T): T {
  if (!arePerformanceDiagnosticsEnabled()) return action();
  const previous = callerScope;
  callerScope = caller.slice(0, 160);
  try { return action(); } finally { callerScope = previous; }
}

export function captureGameplayAudioDiagnosticRequest(caller: string): GameplayAudioDiagnosticRequest | null {
  if (!arePerformanceDiagnosticsEnabled()) return null;
  return { caller: callerScope ?? caller.slice(0, 160), context: readContext() };
}

export function gameplayAudioDiagnosticNow(): number | null {
  return arePerformanceDiagnosticsEnabled() ? performance.now() : null;
}

export function recordGameplayAudioDiagnostic(
  detail: GameplayAudioDiagnosticDetail,
  request: GameplayAudioDiagnosticRequest | null = null,
): void {
  if (!arePerformanceDiagnosticsEnabled()) return;
  const event: AudioEvent = {
    ...detail,
    source: detail.source.slice(0, 512),
    sequence: ++sequence,
    at: Math.round(performance.now() * 100) / 100,
    context: readContext(),
    request,
  };
  if (count === CAPACITY) { overwritten++; overwrittenSinceDrain++; }
  else count++;
  ring[next] = event;
  next = (next + 1) % CAPACITY;
  if (detail.kind === 'request') {
    const activity = getSourceActivity(detail.source);
    activity.requests++;
    summary.requests++;
    if (detail.result === 'hit') summary.hits++;
    else if (detail.result === 'miss') { summary.misses++; activity.misses++; }
    else if (detail.result === 'pending') summary.pendingHits++;
    else if (detail.result === 'cooldown') summary.cooldowns++;
  } else if (detail.kind === 'decode-complete') {
    const activity = getSourceActivity(detail.source);
    activity.decodes++;
    activity.decodedBytes += detail.bytes ?? 0;
    activity.decodeWallMs += detail.decodeMs ?? 0;
    summary.decodes++;
    if (detail.discarded) summary.discardedDecodes++;
    summary.decodedBytes += detail.bytes ?? 0;
    summary.decodeWallMs += detail.decodeMs ?? 0;
  } else if (detail.kind === 'decode-failed') summary.decodeFailures++;
  else if (detail.kind === 'evict') {
    const activity = getSourceActivity(detail.source);
    activity.evictions++;
    activity.evictedBytes += detail.bytes ?? 0;
    if (detail.reason) evictionsByReasonSinceDrain[detail.reason]++;
    summary.evictions++;
    summary.evictedBytes += detail.bytes ?? 0;
  }
}

/** Called by the existing 30-second resource sampler, never a new timer.
 * Compact physical soaks retain cumulative/delta counts without serializing
 * hundreds of file paths and route contexts through the native bridge. Full
 * event payloads remain available behind the explicit detailed-diagnostics
 * opt-in. */
export function drainGameplayAudioDiagnostics(options: { includeEvents?: boolean } = {}) {
  if (!arePerformanceDiagnosticsEnabled()) return null;
  const events: AudioEvent[] = [];
  for (let index = 0; index < count; index++) {
    const slot = (next - count + index + CAPACITY) % CAPACITY;
    events.push(ring[slot]!);
    ring[slot] = undefined;
  }
  count = 0;
  const dropped = overwrittenSinceDrain;
  overwrittenSinceDrain = 0;
  const hotSources = Array.from(sourceActivitySinceDrain, ([source, activity]) => ({ source, ...activity }))
    .filter(activity => activity.misses > 0 || activity.decodes > 0 || activity.evictions > 0)
    .sort((a, b) => (b.decodes + b.evictions) - (a.decodes + a.evictions)
      || b.decodeWallMs - a.decodeWallMs
      || a.source.localeCompare(b.source))
    .slice(0, 12);
  sourceActivitySinceDrain.clear();
  const evictionsByReason = { ...evictionsByReasonSinceDrain };
  evictionsByReasonSinceDrain.budget = 0;
  evictionsByReasonSinceDrain['os-pressure'] = 0;
  evictionsByReasonSinceDrain['loop-replaced'] = 0;
  evictionsByReasonSinceDrain['transition-idle-release'] = 0;
  return {
    capacity: CAPACITY,
    overwritten,
    overwrittenSinceDrain: dropped,
    sequence,
    summary: { ...summary },
    drainedEventCount: events.length,
    hotSources,
    evictionsByReason,
    ...(options.includeEvents ? { events } : {}),
  };
}

export function resetGameplayAudioDiagnosticsForTests(): void {
  ring.fill(undefined);
  next = count = sequence = overwritten = overwrittenSinceDrain = 0;
  Object.keys(summary).forEach(key => { summary[key as keyof typeof summary] = 0; });
  sourceActivitySinceDrain.clear();
  evictionsByReasonSinceDrain.budget = 0;
  evictionsByReasonSinceDrain['os-pressure'] = 0;
  evictionsByReasonSinceDrain['loop-replaced'] = 0;
  evictionsByReasonSinceDrain['transition-idle-release'] = 0;
  callerScope = null;
  contextProvider = null;
}
