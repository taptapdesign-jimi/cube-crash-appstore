import fs from 'node:fs';
import path from 'node:path';
import {
  getJourneyNewCardDisplayName,
  getJourneyNewCardRevealCopy,
  JOURNEY_FOREST_CARD_NAMES,
  JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX,
  JOURNEY_NEW_CARD_INTERIM_SCALE,
  JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX,
  JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX,
  JOURNEY_NEW_CARD_UNLOCKED_SCALE,
  JOURNEY_NEW_CARD_UNLOCKED_SHADOW_Y_PX,
} from '../journey-new-card-presentation';

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

describe('Journey New Reward presentation', () => {
  test('uses score-derived rarity for the post-reveal title and complete card sentence', () => {
    const screen = read('src/modules/journey-new-card-screen.ts');
    expect(getJourneyNewCardRevealCopy('Star Is Out', 'legendary')).toEqual({
      title: 'Legendary!',
      subtitle: 'Unlocked "Star Is Out" card',
    });
    expect(getJourneyNewCardRevealCopy('Star Is Out', 'common')).toEqual({
      title: 'Common',
      subtitle: 'Unlocked "Star Is Out" card',
    });
    expect(getJourneyNewCardRevealCopy('Flying Tent', 'legendary')).toEqual({
      title: 'Legendary!',
      subtitle: 'Unlocked "Flying Tent" card',
    });
    expect(screen).toContain("cardNameAccent.className = 'cc-journey-new-card-subtitle-card-name'");
    expect(screen).toContain("document.createTextNode('Unlocked \"')");
    expect(screen).toContain("document.createTextNode('\" card')");
    expect(screen).toMatch(/\.cc-journey-new-card-subtitle-card-name \{[\s\S]*?color: #ef744d;/);
    expect(screen).toContain('.call(applyRevealCopy, undefined, titleStart)');
    expect(screen).toContain('applyRevealCopy();');
  });

  test('uses the opened card itself as the continuation control with the modal-matched white tap coach', () => {
    const screen = read('src/modules/journey-new-card-screen.ts');
    expect(screen).not.toContain('registerCta');
    expect(screen).not.toContain('cc-journey-new-card-cta');
    expect(screen).not.toContain('>Continue</button>');
    expect(screen).toContain("renderContinueCoachLine('TAP TO COLLECT')");
    expect(screen).toMatch(/\.cc-journey-new-card-coach-hand \{[\s\S]*?width: min\(36vw, 168px\);/);
    expect(screen).not.toContain('width: min(24vw, 112px);');
    expect(screen).not.toContain('width: min(48vw, 224px);');
    expect(screen).toContain('srcset="./assets/hand-pointer@2x.png 2x, ./assets/hand-pointer@3x.png 3x"');
    const coachCopyRule = screen.match(/\.cc-journey-new-card-coach-copy \{([\s\S]*?)\n {4}\}/)?.[1] ?? '';
    expect(coachCopyRule).toMatch(/color: #fff;[\s\S]*?font-family: "Baloo2", system-ui, -apple-system, sans-serif;[\s\S]*?text-shadow:\s*0 3px 0 rgba\(159, 105, 82, 0\.34\),\s*0 8px 20px rgba\(104, 67, 53, 0\.22\);/);
    expect(coachCopyRule).not.toContain('opacity:');
    expect(screen).toContain('JOURNEY_NEW_CARD_CONTINUE_COACH_INITIAL_DELAY_MS = 1000');
    expect(screen).toContain('JOURNEY_NEW_CARD_CONTINUE_COACH_REPEAT_DELAY_MS = 2000');
    expect(screen).toContain('scheduleContinueCoach(JOURNEY_NEW_CARD_CONTINUE_COACH_REPEAT_DELAY_MS)');
    expect(screen).toContain("hero?.setAttribute('aria-label', `Continue after unlocking ${safeCardName}`)");
    expect(screen).toContain('stopContinueCoach();');
    expect(screen).toContain('scheduleContinueCoach();');
  });

  test('keeps the requested Forest 01-10 names as one board metadata source', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    expect(JOURNEY_FOREST_CARD_NAMES).toEqual([
      'Star Is Out',
      'Flying Tent',
      'Weee - Beee',
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

  test('makes both faces exactly 10% smaller and aligns both at the same lower resting position', () => {
    const screen = read('src/modules/journey-new-card-screen.ts');
    expect(JOURNEY_NEW_CARD_INTERIM_SCALE).toBeCloseTo(1.3 * 0.9);
    expect(JOURNEY_NEW_CARD_UNLOCKED_SCALE).toBeCloseTo(1.3 * 0.9);
    expect(JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX).toBe(40);
    expect(JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX).toBe(48);
    expect(JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX).toBe(JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX);
    expect(JOURNEY_NEW_CARD_UNLOCKED_SHADOW_Y_PX).toBe(JOURNEY_NEW_CARD_INTERIM_SHADOW_Y_PX);
    expect(screen).toMatch(/\.to\(interimSurface, \{[\s\S]*?y: JOURNEY_NEW_CARD_INTERIM_OFFSET_Y_PX,[\s\S]*?scale: JOURNEY_NEW_CARD_INTERIM_SCALE/);
    expect(screen).toMatch(/\.to\(unlockedSurface, \{[\s\S]*?y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX,[\s\S]*?scale: JOURNEY_NEW_CARD_UNLOCKED_SCALE/);
    expect(screen).toContain('cardRarity: JourneyCardRarity;');
    expect(screen).not.toContain('cardRarity?: JourneyCardRarity;');
    expect(read('src/modules/journey-completion-flow.ts')).toContain('cardRarity: rewardAsset.rarity');
  });
});
