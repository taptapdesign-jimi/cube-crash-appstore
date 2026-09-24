import type { JourneyCardRarity } from './journey-card-assets.ts';

/** Both reward faces finish exactly 10% smaller than the previous 1.30 surface scale. */
export const JOURNEY_NEW_CARD_INTERIM_SCALE = 1.17;
export const JOURNEY_NEW_CARD_UNLOCKED_SCALE = 1.17;
export const JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX = 40;
export const JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX = JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX + 8;
export const JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX = JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX;
export const JOURNEY_NEW_CARD_UNLOCKED_SHADOW_Y_PX = JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX + 8;

export const JOURNEY_FOREST_CARD_NAMES = [
  'Star Is Out',
  'Weee - Beee',
  'Final Gate',
  'Honey Splat',
  'Dreamy',
  'Shroomy',
  'Kaboom',
  'Break Out',
  'Flying Tent',
  'Winner',
] as const;

export const JOURNEY_BEACH_CARD_NAMES = [
  'Fishy',
  'Fresh Juice',
  'Bouncy Day',
  'Bottle Tips',
  'Star Below',
  'Castle Ruins',
  'Looky Here',
  'The Letter',
  'Playtime',
  'Life Saver',
] as const;

export const JOURNEY_AREA55_CARD_NAMES = [
  'The Bloob',
  'Bibi - Ribi',
  'Woombuu',
  'Zap - Zap',
  'Beam Up',
  'Bloob Spill',
  'Team Party',
  'Transport',
  'Fixer Upper',
  'Take Over',
] as const;

const JOURNEY_BEACH_LEGENDARY_CARD_NAMES = [
  'Fishy', 'Juice Blast', 'Bouncy Day', 'Bottle Tips', 'Rough Seas',
  'Castle Show', 'Deep Dive', 'Go Fetch', 'Playtime', 'Life Saver',
] as const;

export type JourneyNewCardRevealCopy = {
  title: string;
  subtitle: string;
};

export function getJourneyNewCardDisplayName(
  boardNumber: number, fallbackName: string, rarity: JourneyCardRarity = 'common',
): string {
  const forestName = JOURNEY_FOREST_CARD_NAMES[(boardNumber | 0) - 1];
  const beachNames = rarity === 'legendary' ? JOURNEY_BEACH_LEGENDARY_CARD_NAMES : JOURNEY_BEACH_CARD_NAMES;
  const beachName = beachNames[(boardNumber | 0) - 11];
  const area55Name = JOURNEY_AREA55_CARD_NAMES[(boardNumber | 0) - 21];
  return forestName || beachName || area55Name || String(fallbackName || '').trim();
}

export function getJourneyNewCardRevealCopy(
  cardName: string,
  rarity: JourneyCardRarity,
): JourneyNewCardRevealCopy {
  const safeCardName = String(cardName || '').trim();
  return {
    title: rarity === 'legendary' ? 'Legendary!' : 'Common',
    subtitle: `Unlocked ${safeCardName}`,
  };
}
