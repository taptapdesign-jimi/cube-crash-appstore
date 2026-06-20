export function resolvePostSpawnEndgameDelayMs({ isTntMerge }: { isTntMerge: boolean }): number {
  return isTntMerge ? 1700 : 850;
}
