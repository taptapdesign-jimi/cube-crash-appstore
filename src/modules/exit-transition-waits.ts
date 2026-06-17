type ExitWaitContext = {
  skipBoardExit?: boolean;
  fastArcadeCleanExit?: boolean;
};

export type ExitWaitConfig = {
  hudExitMs: number;
  errorFallbackMs: number;
  postExitSettleMs: number;
  uiHandoffMs: number;
  collectiblesCleanupBudgetMs: number;
  noTilesFallbackMs: number;
  postPopOutSettleMs: number;
};

const BASE_WAITS: ExitWaitConfig = {
  hudExitMs: 280,
  errorFallbackMs: 180,
  postExitSettleMs: 24,
  uiHandoffMs: 120,
  collectiblesCleanupBudgetMs: 120,
  noTilesFallbackMs: 220,
  postPopOutSettleMs: 24,
};

const FAST_SKIP_WAITS: Partial<ExitWaitConfig> = {
  hudExitMs: 0,
  postExitSettleMs: 16,
  uiHandoffMs: 90,
};

export function resolveExitWaits(ctx: ExitWaitContext = {}): ExitWaitConfig {
  if (ctx.skipBoardExit && ctx.fastArcadeCleanExit) {
    return { ...BASE_WAITS, ...FAST_SKIP_WAITS };
  }
  return { ...BASE_WAITS };
}

export async function runWithBudget(
  runner: () => Promise<unknown>,
  budgetMs: number,
  label: string,
): Promise<'done' | 'timeout'> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), Math.max(0, budgetMs));
  });
  const result = await Promise.race([
    runner().then(() => 'done' as const).catch(() => 'done' as const),
    timeout,
  ]);
  if (timeoutId) clearTimeout(timeoutId);
  if (result === 'timeout') {
    console.warn(`⚠️ exit-transition-waits: ${label} exceeded budget`, { budgetMs });
  }
  return result;
}
