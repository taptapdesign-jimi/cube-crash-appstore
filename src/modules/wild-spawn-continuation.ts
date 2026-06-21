export type WildSpawnContinuationDecision =
  | { action: 'queue'; reason: 'ready' }
  | { action: 'skip'; reason: 'wild-meter-not-ready' | 'busy-ending' };

export type WildSpawnContinuationInput = {
  wildMeter: number;
  busyEnding?: boolean;
};

export type WildContinuationPendingInput = {
  wildMeter: number;
  wildSpawnInProgress?: boolean;
  wildSpawnRetryPending?: boolean;
  wildSpawnDropInProgress?: boolean;
};

export type StuckWildDeferralDecision =
  | { action: 'defer'; reason: 'wild-continuation-pending'; startedAt: number; deferMs: number }
  | { action: 'force-fail'; reason: 'wild-continuation-timeout'; startedAt: number; deferMs: number }
  | { action: 'continue-fail'; reason: 'no-wild-continuation'; startedAt: null; deferMs: 0 };

const NON_RETRYABLE_WILD_SPAWN_REASONS = new Set([
  'busyEnding',
  'fail-screen-pending',
  'board-transition',
]);

export function shouldScheduleWildSpawnRetry(reason: string): boolean {
  return !NON_RETRYABLE_WILD_SPAWN_REASONS.has(reason);
}

export function resolveWildSpawnGuardReleaseContinuation(
  input: WildSpawnContinuationInput,
): WildSpawnContinuationDecision {
  if (!Number.isFinite(input.wildMeter) || input.wildMeter < 1) {
    return { action: 'skip', reason: 'wild-meter-not-ready' };
  }
  if (input.busyEnding) {
    return { action: 'skip', reason: 'busy-ending' };
  }
  return { action: 'queue', reason: 'ready' };
}

export function isWildContinuationPending(input: WildContinuationPendingInput): boolean {
  return input.wildMeter >= 1 ||
    input.wildSpawnInProgress === true ||
    input.wildSpawnRetryPending === true ||
    input.wildSpawnDropInProgress === true;
}

export function resolveStuckWildDeferralDecision({
  wildContinuationPending,
  startedAt,
  now,
  maxDeferralMs,
}: {
  wildContinuationPending: boolean;
  startedAt: number | null;
  now: number;
  maxDeferralMs: number;
}): StuckWildDeferralDecision {
  if (!wildContinuationPending) {
    return { action: 'continue-fail', reason: 'no-wild-continuation', startedAt: null, deferMs: 0 };
  }

  const nextStartedAt = startedAt ?? now;
  const deferMs = Math.max(0, now - nextStartedAt);
  if (deferMs < maxDeferralMs) {
    return {
      action: 'defer',
      reason: 'wild-continuation-pending',
      startedAt: nextStartedAt,
      deferMs,
    };
  }

  return {
    action: 'force-fail',
    reason: 'wild-continuation-timeout',
    startedAt: nextStartedAt,
    deferMs,
  };
}
