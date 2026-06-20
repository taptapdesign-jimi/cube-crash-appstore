export type FinalMergeFinaleFx = 'tnt' | 'juice' | 'magnet' | 'star';

export const FINAL_MERGE_REASONS = {
  default: 'clean_board_from_last_merge',
  tnt: 'clean_board_from_last_merge_final_tnt',
  juice: 'clean_board_from_last_merge_final_juice',
  magnet: 'clean_board_from_last_merge_final_magnet',
  star: 'clean_board_from_last_merge_final_star',
  tntAfterAnimation: 'final_tnt_merge_after_tnt',
  tntFallbackTimeout: 'final_tnt_merge_fallback_timeout',
  legacyMagnetFinalMerge6: 'clean_board_from_wild_magnet_final_merge6',
  legacyMagnetNoPulledTiles: 'clean_board_from_wild_magnet_no_pulled_tiles',
  legacyMagnetOnlyDstRemains: 'clean_board_from_wild_magnet_only_dst_remains',
  legacyMagnetFewTilesRemaining: 'clean_board_from_wild_magnet_few_tiles_remaining',
} as const;

export type FinalMergeReason = typeof FINAL_MERGE_REASONS[keyof typeof FINAL_MERGE_REASONS] | string;

export function getFinalMergeCleanBoardReason(finaleFx?: FinalMergeFinaleFx | null): string {
  if (finaleFx === 'tnt') return FINAL_MERGE_REASONS.tnt;
  if (finaleFx === 'juice') return FINAL_MERGE_REASONS.juice;
  if (finaleFx === 'magnet') return FINAL_MERGE_REASONS.magnet;
  if (finaleFx === 'star') return FINAL_MERGE_REASONS.star;
  return FINAL_MERGE_REASONS.default;
}

export function reasonAlreadyPassedTntCompletion(reason: string): boolean {
  return reason === FINAL_MERGE_REASONS.tntAfterAnimation ||
    reason === FINAL_MERGE_REASONS.tntFallbackTimeout ||
    reason === FINAL_MERGE_REASONS.tnt;
}

export function reasonExpectsJuiceFinale(reason: string): boolean {
  return reason === FINAL_MERGE_REASONS.juice;
}

export function reasonExpectsSparkleFinale(reason: string): boolean {
  return reason === FINAL_MERGE_REASONS.star;
}

export function reasonExpectsMagnetFinale(reason: string): boolean {
  return reason === FINAL_MERGE_REASONS.magnet ||
    reason === FINAL_MERGE_REASONS.legacyMagnetFinalMerge6 ||
    reason === FINAL_MERGE_REASONS.legacyMagnetNoPulledTiles ||
    reason === FINAL_MERGE_REASONS.legacyMagnetOnlyDstRemains ||
    reason === FINAL_MERGE_REASONS.legacyMagnetFewTilesRemaining;
}
