import { markFinalSpecialFxTriggered, shouldStartFinalSpecialFx } from './final-special-fx-guard.ts';

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
  isMagneticTextActive?: () => boolean;
  showMagneticText?: () => void;
  waitForMagneticTextComplete?: (timeoutMs?: number) => Promise<void>;
  isSparkleTextActive?: () => boolean;
};

const RECENT_HANDOFF_WINDOW_MS = 3000;
const ARCADE_HANDOFF_BUFFER_MS = 180;
const POLL_MS = 80;

function reasonAlreadyPassedTntCompletion(reason: string): boolean {
  return reason === 'final_tnt_merge_after_tnt'
    || reason === 'final_tnt_merge_fallback_timeout'
    || reason === 'clean_board_from_last_merge_final_tnt';
}

function reasonExpectsJuiceFinale(reason: string): boolean {
  return reason === 'clean_board_from_last_merge_final_juice';
}

function reasonExpectsSparkleFinale(reason: string): boolean {
  return reason === 'clean_board_from_last_merge_final_star';
}

function reasonExpectsMagnetFinale(reason: string): boolean {
  return reason === 'clean_board_from_last_merge_final_magnet'
    || reason === 'clean_board_from_wild_magnet_final_merge6'
    || reason === 'clean_board_from_wild_magnet_no_pulled_tiles'
    || reason === 'clean_board_from_wild_magnet_only_dst_remains'
    || reason === 'clean_board_from_wild_magnet_few_tiles_remaining';
}

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
    while (!options.isWildJuiceBubblesExplosionActive?.() && Date.now() - startedAt < 360) {
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
  const juiceMaxWaitMs = options.isArcade ? 1600 : 2800;
  const sparkleMaxWaitMs = options.isArcade ? 1400 : 2200;

  if (activeAtStart.tnt) {
    await waitForTntComplete(options, tntMaxWaitMs);
  }

  if (activeAtStart.magnet) {
    try {
      await options.waitForMagneticTextComplete?.(magnetMaxWaitMs);
    } catch {}
  }

  await waitUntilInactive(
    'wild-juice bubbles',
    options.isWildJuiceBubblesExplosionActive,
    options.wait,
    juiceMaxWaitMs,
    options.logger,
  );

  await waitUntilInactive(
    'sparkle text',
    options.isSparkleTextActive,
    options.wait,
    sparkleMaxWaitMs,
    options.logger,
  );

  markFinalMergeHandoffSettled();
}
