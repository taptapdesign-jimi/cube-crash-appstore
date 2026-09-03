import type { JourneyCardRarity } from './journey-card-assets.ts';

/** Both reward faces finish exactly 10% smaller than the previous 1.30 surface scale. */
export const JOURNEY_NEW_CARD_INTERIM_SCALE = 1.17;
export const JOURNEY_NEW_CARD_UNLOCKED_SCALE = 1.17;
export const JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX = 40;
export const JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX = JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX + 8;

export const JOURNEY_FOREST_CARD_NAMES = [
  'Star Is Out',
  'Flying Tent',
  'WEEE - Beee',
  'Honey Splat',
  'Dreamy',
  'Shroomy',
  'Kaboom',
  'Break Out',
  'Final Gate',
  'Winner',
] as const;

export type JourneyNewCardRevealCopy = {
  title: string;
  subtitle: string;
};

export function getJourneyNewCardDisplayName(boardNumber: number, fallbackName: string): string {
  const forestName = JOURNEY_FOREST_CARD_NAMES[(boardNumber | 0) - 1];
  return forestName || String(fallbackName || '').trim();
}

export function getJourneyNewCardRevealCopy(
  cardName: string,
  rarity: JourneyCardRarity,
): JourneyNewCardRevealCopy {
  const safeCardName = String(cardName || '').trim();
  return {
    title: rarity === 'legendary' ? 'Legendary!' : 'Unlocked!',
    subtitle: `Unlocked "${safeCardName}" card`,
  };
}
