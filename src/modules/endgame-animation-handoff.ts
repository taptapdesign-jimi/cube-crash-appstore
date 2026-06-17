type EndgameAnimationHandoffOptions = {
  isArcade: boolean;
  skipStarsWait: boolean;
  handoffAlreadySettled: boolean;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withTimeout(label: string, promise: Promise<unknown>, timeoutMs: number): Promise<'done' | 'timeout'> {
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
    console.warn(`⚠️ endgame-animation-handoff: ${label} timed out`, { timeoutMs });
  }
  return result;
}

async function cleanupTimedOutFx(): Promise<void> {
  try {
    const bubblesModule = await import('./wild-juice-bubbles-explosion.js');
    bubblesModule.stopWildJuiceBubblesExplosion?.();
  } catch {}

  try {
    const fxModule = await import('./fx.js');
    fxModule.forceCleanupAllStarAnimations?.();
  } catch {}

  try {
    const starsCollector = await import('./stars-collector.js');
    starsCollector.cleanupStarsCollector?.();
  } catch {}
}

export async function waitForEndgameAnimationHandoff({
  isArcade,
  skipStarsWait,
  handoffAlreadySettled,
}: EndgameAnimationHandoffOptions): Promise<void> {
  if (handoffAlreadySettled) {
    await sleep(isArcade ? 40 : 80);
    return;
  }

  const fxModule = await import('./fx.js');
  const bubblesModule = await import('./wild-juice-bubbles-explosion.js').catch(() => null);

  const startBufferMs = isArcade ? 40 : 160;
  await sleep(startBufferMs);

  const bubblesActive = !!bubblesModule?.isWildJuiceBubblesExplosionActive?.();
  const bubbleWaitMs = isArcade ? 360 : 2200;
  const starWaitMs = isArcade ? 360 : 1600;
  const waits: Promise<unknown>[] = [];

  if (bubblesActive && typeof fxModule.waitForBubblesAnimationToComplete === 'function') {
    waits.push(fxModule.waitForBubblesAnimationToComplete(bubbleWaitMs));
  }

  if (!skipStarsWait && typeof fxModule.waitForStarsToHudToComplete === 'function') {
    waits.push(fxModule.waitForStarsToHudToComplete(starWaitMs));
  }

  if (!waits.length) return;

  const maxWaitMs = Math.max(bubblesActive ? bubbleWaitMs : 0, !skipStarsWait ? starWaitMs : 0) + 220;
  const result = await withTimeout('targeted FX wait', Promise.all(waits), maxWaitMs);
  if (result === 'timeout') {
    await cleanupTimedOutFx();
  }
}
