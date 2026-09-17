import { getForestWildPool, isForestJourneyBoard } from './journey-forest-wild-progression';
import { isArea55JourneyBoard } from './journey-area55-wild-progression';
import { getSpecialDiceVariantForTile, SPECIAL_DICE_VARIANTS } from './special-dice-registry';

/** Warm only resources this board can produce, plus specials restored in saves. */
export function getSpecialArtworkWarmupEligibility({
  boardNumber, isArcade, tiles = [],
}: {
  boardNumber: number;
  isArcade: boolean;
  tiles?: readonly any[];
}): { juice: boolean; barrel: boolean; fish: boolean } {
  const forest = !isArcade && isForestJourneyBoard(boardNumber);
  const area55 = !isArcade && isArea55JourneyBoard(boardNumber);
  let juice = !forest && !area55;
  // Arcade's authored variant tour exists only in round one. Later rounds
  // produce core dice; Journey uses the actual cumulative Forest reward pool.
  let barrel = isArcade
    ? boardNumber === 1
    : getForestWildPool(boardNumber).includes('barell');
  let fish = isArcade
    ? boardNumber === 1 && Number.isFinite(SPECIAL_DICE_VARIANTS.fish?.arcadeTestOrder)
    : boardNumber >= 12 && boardNumber <= 20;
  for (const tile of tiles) {
    if (!tile || tile.destroyed) continue;
    const variant = getSpecialDiceVariantForTile(tile);
    if (variant?.id === 'barell') barrel = true;
    if (variant?.id === 'fish') fish = true;
    if (!variant && tile.special === 'wild-juice') juice = true;
  }
  return { juice, barrel, fish };
}
