import fs from 'node:fs';
import path from 'node:path';
import {
  getJourneyNewCardDisplayName,
  getJourneyNewCardRevealCopy,
  JOURNEY_FOREST_CARD_NAMES,
  JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX,
  JOURNEY_NEW_CARD_INTERIM_SCALE,
  JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX,
  JOURNEY_NEW_CARD_UNLOCKED_SCALE,
} from '../journey-new-card-presentation';

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

describe('Journey New Reward presentation', () => {
  test('uses score-derived rarity for the post-reveal title and complete card sentence', () => {
    expect(getJourneyNewCardRevealCopy('Star Is Out', 'legendary')).toEqual({
      title: 'Legendary!',
      subtitle: 'Unlocked "Star Is Out" card',
    });
    expect(getJourneyNewCardRevealCopy('Star Is Out', 'common')).toEqual({
      title: 'Unlocked!',
      subtitle: 'Unlocked "Star Is Out" card',
    });
    expect(getJourneyNewCardRevealCopy('Flying Tent', 'legendary')).toEqual({
      title: 'Legendary!',
      subtitle: 'Unlocked "Flying Tent" card',
    });
  });

  test('keeps the requested Forest 01-10 names as one board metadata source', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    expect(JOURNEY_FOREST_CARD_NAMES).toEqual([
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
    ]);
    expect(getJourneyNewCardDisplayName(2, 'SO SPECIAL')).toBe('Flying Tent');
    expect(manager).toContain('...JOURNEY_FOREST_CARD_NAMES');
  });

  test('makes both faces exactly 10% smaller and moves only the interim face down 40px', () => {
    const screen = read('src/modules/journey-new-card-screen.ts');
    expect(JOURNEY_NEW_CARD_INTERIM_SCALE).toBeCloseTo(1.3 * 0.9);
    expect(JOURNEY_NEW_CARD_UNLOCKED_SCALE).toBeCloseTo(1.3 * 0.9);
    expect(JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX).toBe(40);
    expect(JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX).toBe(48);
    expect(screen).toMatch(/\.to\(interimSurface, \{[\s\S]*?y: JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX,[\s\S]*?scale: JOURNEY_NEW_CARD_INTERIM_SCALE/);
    expect(screen).toMatch(/\.to\(unlockedSurface, \{[\s\S]*?y: 0,[\s\S]*?scale: JOURNEY_NEW_CARD_UNLOCKED_SCALE/);
    expect(screen).toContain('cardRarity: JourneyCardRarity;');
    expect(screen).not.toContain('cardRarity?: JourneyCardRarity;');
    expect(read('src/modules/journey-completion-flow.ts')).toContain('cardRarity: rewardAsset.rarity');
  });
});
