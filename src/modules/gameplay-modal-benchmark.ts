/**
 * Shared presentation contract for dismissible gameplay paper modals.
 *
 * Surface modules keep ownership of their own state, focus, handlers and
 * cleanup. This profile is the single source of truth for motion timing and
 * CTA reveal cadence only.
 */
export const GAMEPLAY_MODAL_BENCHMARK = Object.freeze({
  enterDurationMs: 650,
  exitDurationMs: 650,
  enterCleanupBufferMs: 34,
  ctaEnterProgress: 0.2,
  companionCtaStaggerMs: 70,
});

export function getGameplayModalCtaEnterDelayMs(): number {
  return Math.round(
    GAMEPLAY_MODAL_BENCHMARK.enterDurationMs * GAMEPLAY_MODAL_BENCHMARK.ctaEnterProgress,
  );
}

/**
 * Starts CTA and modal-surface exits in the same JavaScript turn, then keeps
 * cleanup behind both owners. Surface modules retain their own animation and
 * routing logic while sharing one explicit parallel-exit contract.
 */
export async function runGameplayModalParallelExit(
  startCtaExit: () => Promise<void>,
  startSurfaceExit: () => void | Promise<void>,
): Promise<void> {
  const ctaExit = startCtaExit();
  const surfaceExit = Promise.resolve(startSurfaceExit());
  await Promise.all([ctaExit, surfaceExit]);
}
