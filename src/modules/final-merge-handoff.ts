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
  onTntAnimationComplete?: (cb: () => void) => void;
  isWildJuiceBubblesExplosionActive?: () => boolean;
  waitForWildJuiceBubblesExplosionComplete?: (timeoutMs?: number) => Promise<void>;
  isMagneticTextActive?: () => boolean;
  showMagneticText?: () => void;
  waitForMagneticTextComplete?: (timeoutMs?: number) => Promise<void>;
  isSparkleTextActive?: () => boolean;
};

const RECENT_HANDOFF_WINDOW_MS = 3000;
const ARCADE_HANDOFF_BUFFER_MS = 180;
const POLL_MS = 80;
const JUICE_START_WAIT_MS = 700;

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
      options.onTntAnimationComplete?.(finish);
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

export async function waitForFinalMergeHandoff(options: FinalMergeHandoffOptions): Promise<void> {
  if (typeof window === 'undefined') return;

  if (options.isArcade) {
    await options.wait(ARCADE_HANDOFF_BUFFER_MS);
  }

  const tntCompletionAlreadyPassed = reasonAlreadyPassedTntCompletion(options.reason);
  if (reasonExpectsJuiceFinale(options.reason) && !options.isWildJuiceBubblesExplosionActive?.()) {
    const startedAt = Date.now();
    while (!options.isWildJuiceBubblesExplosionActive?.() && Date.now() - startedAt < JUICE_START_WAIT_MS) {
      await options.wait(POLL_MS);
    }
  }

  if (reasonExpectsSparkleFinale(options.reason) && !options.isSparkleTextActive?.()) {
    const startedAt = Date.now();
    while (!options.isSparkleTextActive?.() && Date.now() - startedAt < 360) {
      await options.wait(POLL_MS);
    }
  }

  if (reasonExpectsMagnetFinale(options.reason) && !options.isMagneticTextActive?.()) {
    if (shouldStartFinalSpecialFx('magnet')) {
      try {
        options.logger?.info?.('🧲 final-merge-handoff: starting missing SWOOP for final magnet merge', {
          reason: options.reason,
        });
        options.showMagneticText?.();
      } catch (error) {
        options.logger?.warn?.('⚠️ final-merge-handoff: failed to start missing SWOOP', error);
      }
    } else {
      options.logger?.info?.('⏭️ final-merge-handoff: SWOOP already triggered recently, skipping duplicate start', {
        reason: options.reason,
      });
    }
  } else if (reasonExpectsMagnetFinale(options.reason)) {
    markFinalSpecialFxTriggered('magnet');
  }

  const activeAtStart = {
    tnt: !tntCompletionAlreadyPassed && !!options.isTntAnimationActive?.(),
    juice: !!options.isWildJuiceBubblesExplosionActive?.(),
    magnet: !!options.isMagneticTextActive?.(),
    sparkle: !!options.isSparkleTextActive?.(),
  };

  if (!activeAtStart.tnt && !activeAtStart.juice && !activeAtStart.magnet && !activeAtStart.sparkle) {
    markFinalMergeHandoffSettled();
    return;
  }

  options.logger?.info?.('⏳ final-merge-handoff: targeted wait started', {
    reason: options.reason,
    ...activeAtStart,
  });

  const tntMaxWaitMs = options.isArcade ? 2200 : 3200;
  const magnetMaxWaitMs = options.isArcade ? 1600 : 2400;
  const juiceMaxWaitMs = options.isArcade ? 5200 : 6500;
  const sparkleMaxWaitMs = options.isArcade ? 1400 : 2200;

  if (activeAtStart.tnt) {
    await waitForTntComplete(options, tntMaxWaitMs);
  }

  if (activeAtStart.magnet) {
    try {
      await options.waitForMagneticTextComplete?.(magnetMaxWaitMs);
    } catch {}
  }

  if (activeAtStart.juice) {
    if (options.waitForWildJuiceBubblesExplosionComplete) {
      options.logger?.info?.('⏳ final-merge-handoff: waiting for wild-juice bubbles completion signal', {
        maxWaitMs: juiceMaxWaitMs,
      });
      try {
        await options.waitForWildJuiceBubblesExplosionComplete(juiceMaxWaitMs);
      } catch (error) {
        options.logger?.warn?.('⚠️ final-merge-handoff: wild-juice completion waiter failed', error);
      }
    } else {
      await waitUntilInactive(
        'wild-juice bubbles',
        options.isWildJuiceBubblesExplosionActive,
        options.wait,
        juiceMaxWaitMs,
        options.logger,
      );
    }
  }

  await waitUntilInactive(
    'sparkle text',
    options.isSparkleTextActive,
    options.wait,
    sparkleMaxWaitMs,
    options.logger,
  );

  markFinalMergeHandoffSettled();
}
