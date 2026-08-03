type GameOverAnimationHandoffOptions = {
  confirmedFailFlow: boolean;
  isArcade: boolean;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withTimeout(label: string, promise: Promise<unknown>, timeoutMs: number): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  const result = await Promise.race([
    promise.then(() => 'done' as const).catch(() => 'done' as const),
    timeout,
  ]);

  if (timeoutId) clearTimeout(timeoutId);
  if (result === 'timeout') {
    console.warn(`⚠️ game-over-animation-handoff: ${label} timed out`, { timeoutMs });
  }
}

export async function waitForGameOverAnimationHandoff({
  confirmedFailFlow,
  isArcade,
}: GameOverAnimationHandoffOptions): Promise<void> {
  if (confirmedFailFlow) {
    await sleep(isArcade ? 40 : 60);
    // Terminal board exit owns all remaining star-flight visuals. Protected
    // sprites must not survive after their timelines are killed by that exit.
    try {
      const fxModule = await import('./fx.js');
      fxModule.forceCleanupAllStarAnimations?.();
    } catch {}
    return;
  }

  const fxModule = await import('./fx.js');
  const bubblesModule = await import('./wild-juice-bubbles-explosion.js').catch(() => null);
  const waits: Promise<unknown>[] = [];

  const bubblesActive = !!bubblesModule?.isWildJuiceBubblesExplosionActive?.();
  const bubbleWaitMs = isArcade ? 420 : 900;
  const starWaitMs = isArcade ? 420 : 900;

  if (bubblesActive && typeof fxModule.waitForBubblesAnimationToComplete === 'function') {
    waits.push(fxModule.waitForBubblesAnimationToComplete(bubbleWaitMs));
  }

  if (typeof fxModule.waitForStarsToHudToComplete === 'function') {
    waits.push(fxModule.waitForStarsToHudToComplete(starWaitMs));
  }

  if (!waits.length) {
    await sleep(isArcade ? 40 : 80);
    return;
  }

  await withTimeout('targeted game-over FX wait', Promise.all(waits), Math.max(bubbleWaitMs, starWaitMs) + 180);
}
