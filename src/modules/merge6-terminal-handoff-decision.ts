export type Merge6MovesDepletedStuckAction = 'continue-merge6' | 'run-fail';

/**
 * A pending wild reward defers the terminal decision, but it must not abort the
 * merge-6 transaction that earned it. The caller still owns destination cleanup
 * and replacement spawns before the reward may enter.
 */
export function resolveMerge6MovesDepletedStuckAction({
  wildContinuationDeferred,
}: {
  wildContinuationDeferred: boolean;
}): Merge6MovesDepletedStuckAction {
  return wildContinuationDeferred ? 'continue-merge6' : 'run-fail';
}
