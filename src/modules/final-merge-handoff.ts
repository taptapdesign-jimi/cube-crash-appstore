import { markFinalSpecialFxTriggered, shouldStartFinalSpecialFx } from './final-special-fx-guard.ts';
import {
  reasonAlreadyPassedTntCompletion,
  reasonExpectsJuiceFinale,
  reasonExpectsMagnetFinale,
  reasonExpectsSparkleFinale,
} from './final-merge-reasons.ts';

type Logger = {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
};

type FinalMergeHandoffOptions = {
  reason: string;
  isArcade: boolean;
  wait: (ms: number) => Promise<void>;
  logger?: Logger;
  isTntAnimationActive?: () => boolean;
  onTntBoomExitComplete?: (cb: () => void) => void;
  onTntAnimationComplete?: (cb: () => void) => void;
  isWildJuiceBubblesExplosionActive?: () => boolean;
  isWildJuiceBubblesExplosionRecentlyStarted?: () => boolean;
  waitForWildJuiceBubblesExplosionComplete?: (timeoutMs?: number) => Promise<void>;
  showWildJuiceFinale?: () => void;
  isMagneticTextActive?: () => boolean;
  showMagneticText?: () => void;
  waitForMagneticTextComplete?: (timeoutMs?: number) => Promise<void>;
  isSparkleTextActive?: () => boolean;
  showSparkleFinale?: () => void;
  waitForSparkleTextComplete?: (timeoutMs?: number) => Promise<void>;
};

type FinaleRuntime = {
  key: 'tnt' | 'juice' | 'magnet' | 'sparkle';
  label: string;
  expects: boolean;
  recentlyStarted?: () => boolean;
  isActive?: () => boolean;
  startMissing?: () => void;
  waitComplete?: (timeoutMs: number) => Promise<void>;
  startupWaitMs: number;
  maxWaitMs: number;
};

const RECENT_HANDOFF_WINDOW_MS = 3000;
const ARCADE_HANDOFF_BUFFER_MS = 180;
const POLL_MS = 80;
const JUICE_START_WAIT_MS = 700;
const LATE_RUNTIME_DRAIN_MS = 400;

function markFinalMergeHandoffSettled(): void {
  try {
    (window as any).__ccFinalMergeHandoffSettledUntil = Date.now() + RECENT_HANDOFF_WINDOW_MS;
  } catch {}
}

export function wasFinalMergeHandoffRecentlySettled(): boolean {
  try {
    return Number((window as any).__ccFinalMergeHandoffSettledUntil || 0) > Date.now();
  } catch {
    return false;
  }
}

async function waitUntilInactive(
  label: string,
  isActive: (() => boolean) | undefined,
  wait: (ms: number) => Promise<void>,
  maxWaitMs: number,
  logger?: Logger,
): Promise<void> {
  if (!isActive?.()) return;

  const startedAt = Date.now();
  logger?.info?.(`⏳ final-merge-handoff: waiting for ${label}`, { maxWaitMs });

  while (isActive() && Date.now() - startedAt < maxWaitMs) {
    await wait(POLL_MS);
  }

  if (isActive()) {
    logger?.warn?.(`⚠️ final-merge-handoff: ${label} wait timed out`, {
      waitedMs: Date.now() - startedAt,
      maxWaitMs,
    });
    return;
  }

  logger?.info?.(`✅ final-merge-handoff: ${label} finished`, {
    waitedMs: Date.now() - startedAt,
  });
}

function waitForTntComplete(options: FinalMergeHandoffOptions, maxWaitMs: number): Promise<void> {
  if (!options.isTntAnimationActive?.()) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    try {
      if (typeof options.onTntBoomExitComplete === 'function') {
        options.onTntBoomExitComplete(finish);
      } else {
        options.onTntAnimationComplete?.(finish);
      }
    } catch {}

    void (async () => {
      const startedAt = Date.now();
      while (!done && options.isTntAnimationActive?.() && Date.now() - startedAt < maxWaitMs) {
        await options.wait(POLL_MS);
      }
      finish();
    })();

    options.wait(maxWaitMs).then(finish).catch(finish);
  });
}

async function waitForRuntimeStartup(
  runtime: FinaleRuntime,
  wait: (ms: number) => Promise<void>,
): Promise<void> {
  if (!runtime.expects && !runtime.recentlyStarted?.()) return;
  if (runtime.isActive?.()) return;
  const startedAt = Date.now();
  while (!runtime.isActive?.() && Date.now() - startedAt < runtime.startupWaitMs) {
    await wait(POLL_MS);
  }
}

async function waitForRuntimeComplete(
  runtime: FinaleRuntime,
  wait: (ms: number) => Promise<void>,
  logger?: Logger,
): Promise<void> {
  if (!runtime.isActive?.()) return;

  if (runtime.waitComplete) {
    logger?.info?.(`⏳ final-merge-handoff: waiting for ${runtime.label} completion signal`, {
      maxWaitMs: runtime.maxWaitMs,
    });
    try {
      await runtime.waitComplete(runtime.maxWaitMs);
      return;
    } catch (error) {
      logger?.warn?.(`⚠️ final-merge-handoff: ${runtime.label} completion waiter failed`, error);
    }
  }

  await waitUntilInactive(runtime.label, runtime.isActive, wait, runtime.maxWaitMs, logger);
}

function buildFinaleRuntimes(options: FinalMergeHandoffOptions): FinaleRuntime[] {
  const tntCompletionAlreadyPassed = reasonAlreadyPassedTntCompletion(options.reason);
  const tntMaxWaitMs = options.isArcade ? 2200 : 3200;
  // Magnet variants normally resolve sooner through their completion signal.
  // The hard ceiling matches the authored four-second Spaceship visual and
  // prevents a missing completion signal from delaying Clean Board beyond it.
  const magnetMaxWaitMs = 4000;
  const juiceMaxWaitMs = options.isArcade ? 5200 : 6500;
  // Bee's Wild-Star visual is intentionally longer than the basic sparkle
  // burst. The real completion signal normally resolves first; this is only
  // fallback headroom so Clean Board cannot truncate the authored flight.
  const sparkleMaxWaitMs = options.isArcade ? 1800 : 3400;

  return [
    {
      key: 'tnt',
      label: 'TNT animation',
      expects: !tntCompletionAlreadyPassed,
      isActive: options.isTntAnimationActive,
      waitComplete: () => waitForTntComplete(options, tntMaxWaitMs),
      startupWaitMs: 0,
      maxWaitMs: tntMaxWaitMs,
    },
    {
      key: 'juice',
      label: 'wild-juice finale',
      expects: reasonExpectsJuiceFinale(options.reason),
      recentlyStarted: options.isWildJuiceBubblesExplosionRecentlyStarted,
      isActive: options.isWildJuiceBubblesExplosionActive,
      startMissing: () => {
        if (!reasonExpectsJuiceFinale(options.reason)) return;
        if (options.isWildJuiceBubblesExplosionActive?.()) {
          markFinalSpecialFxTriggered('juice');
          return;
        }
        if (shouldStartFinalSpecialFx('juice')) {
          options.logger?.info?.('💧 final-merge-handoff: starting missing juice finale', {
            reason: options.reason,
          });
          options.showWildJuiceFinale?.();
        } else {
          options.logger?.info?.('⏭️ final-merge-handoff: juice finale already triggered recently, skipping duplicate start', {
            reason: options.reason,
          });
        }
      },
      waitComplete: options.waitForWildJuiceBubblesExplosionComplete,
      startupWaitMs: JUICE_START_WAIT_MS,
      maxWaitMs: juiceMaxWaitMs,
    },
    {
      key: 'magnet',
      label: 'magnetic text',
      expects: reasonExpectsMagnetFinale(options.reason),
      isActive: options.isMagneticTextActive,
      startMissing: () => {
        if (!reasonExpectsMagnetFinale(options.reason)) return;
        if (options.isMagneticTextActive?.()) {
          markFinalSpecialFxTriggered('magnet');
          return;
        }
        if (shouldStartFinalSpecialFx('magnet')) {
          options.logger?.info?.('🧲 final-merge-handoff: starting missing SWOOP for final magnet merge', {
            reason: options.reason,
          });
          options.showMagneticText?.();
        } else {
          options.logger?.info?.('⏭️ final-merge-handoff: SWOOP already triggered recently, skipping duplicate start', {
            reason: options.reason,
          });
        }
      },
      waitComplete: options.waitForMagneticTextComplete,
      startupWaitMs: 360,
      maxWaitMs: magnetMaxWaitMs,
    },
    {
      key: 'sparkle',
      label: 'sparkle text',
      expects: reasonExpectsSparkleFinale(options.reason),
      isActive: options.isSparkleTextActive,
      startMissing: () => {
        if (!reasonExpectsSparkleFinale(options.reason)) return;
        if (options.isSparkleTextActive?.()) {
          markFinalSpecialFxTriggered('star');
          return;
        }
        if (shouldStartFinalSpecialFx('star')) {
          options.logger?.info?.('⭐ final-merge-handoff: starting missing sparkle finale', {
            reason: options.reason,
          });
          options.showSparkleFinale?.();
        } else {
          options.logger?.info?.('⏭️ final-merge-handoff: sparkle already triggered recently, skipping duplicate start', {
            reason: options.reason,
          });
        }
      },
      waitComplete: options.waitForSparkleTextComplete,
      startupWaitMs: 360,
      maxWaitMs: sparkleMaxWaitMs,
    },
  ];
}

export async function waitForFinalMergeHandoff(options: FinalMergeHandoffOptions): Promise<void> {
  if (typeof window === 'undefined') return;

  if (options.isArcade) {
    await options.wait(ARCADE_HANDOFF_BUFFER_MS);
  }

  const runtimes = buildFinaleRuntimes(options);
  runtimes.forEach((runtime) => {
    try { runtime.startMissing?.(); } catch (error) {
      options.logger?.warn?.(`⚠️ final-merge-handoff: failed to start missing ${runtime.label}`, error);
    }
  });

  for (const runtime of runtimes) {
    await waitForRuntimeStartup(runtime, options.wait);
  }

  const activeAtStart = Object.fromEntries(
    runtimes.map((runtime) => [runtime.key, !!runtime.isActive?.()])
  ) as Record<FinaleRuntime['key'], boolean>;

  const hasActiveAtStart = activeAtStart.tnt || activeAtStart.juice || activeAtStart.magnet || activeAtStart.sparkle;
  if (hasActiveAtStart) {
    options.logger?.info?.('⏳ final-merge-handoff: targeted wait started', {
      reason: options.reason,
      ...activeAtStart,
    });
  }

  const drainedRuntimeKeys = new Set<FinaleRuntime['key']>();
  for (const runtime of runtimes) {
    if (!activeAtStart[runtime.key]) continue;
    await waitForRuntimeComplete(runtime, options.wait, options.logger);
    drainedRuntimeKeys.add(runtime.key);
  }

  let lateWaitedMs = 0;
  while (lateWaitedMs < LATE_RUNTIME_DRAIN_MS) {
    const activeLate = runtimes.filter((runtime) => !drainedRuntimeKeys.has(runtime.key) && !!runtime.isActive?.());
    if (activeLate.length > 0) {
      options.logger?.info?.('⏳ final-merge-handoff: waiting for late active runtime(s)', {
        reason: options.reason,
        active: activeLate.map((runtime) => runtime.key),
      });
      for (const runtime of activeLate) {
        await waitForRuntimeComplete(runtime, options.wait, options.logger);
        drainedRuntimeKeys.add(runtime.key);
      }
      continue;
    }
    await options.wait(POLL_MS);
    lateWaitedMs += POLL_MS;
  }

  markFinalMergeHandoffSettled();
}
