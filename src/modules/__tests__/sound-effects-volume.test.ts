import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SOUND_EFFECTS_MASTER_GAIN,
  applySoundEffectsMasterGain,
} from '../sound-effects-volume';
import {
  GAMEPLAY_PICKUP_SOUND_VOLUME,
  GAMEPLAY_RETURN_SOUND_VOLUME,
} from '../gameplay-pickup-sound';
import {
  ORDINARY_STACK_SOUND_VOLUME,
  ORDINARY_STACK_SECONDARY_VOLUME,
} from '../ordinary-stack-sound';
import {
  REGULAR_MERGE6_BOOM_VOLUME,
  REGULAR_MERGE6_CRASH_VOLUME,
  REGULAR_MERGE6_SOUND_VOLUME,
  REGULAR_MERGE6_STACK_VOLUME,
} from '../regular-merge6-sound';
import {
  WILD_STAR_MERGE6_BOOM_VOLUME,
  WILD_STAR_MERGE6_CRASH_VOLUME,
  WILD_STAR_MERGE6_PRIMARY_VOLUME,
  WILD_STAR_MERGE6_SOUND_VOLUME,
  WILD_STAR_MERGE6_SPARKLE_VOLUME,
  WILD_STAR_MERGE6_STACK_VOLUME,
} from '../wild-star-merge6-sound';
import { WILD_SPECIAL_LANDING_SOUND_VOLUME } from '../wild-special-landing-sound';
import { ARCADE_CRATE_SOUND_VOLUMES } from '../arcade-crate-sound';
import { JOURNEY_BACKPACK_SOUND_VOLUMES } from '../journey-backpack-sound';
import { NO_MOVES_SOUND_VOLUME } from '../no-moves-sound';
import {
  FISH_MERGE6_FISH0_VOLUME,
  FISH_MERGE6_FISH1_VOLUME,
  FISH_MERGE6_FISH2_VOLUME,
  FISH_MERGE6_PLOMP_VOLUME,
  FISH_MERGE6_SPEAKS_VOLUME,
} from '../fish-merge6-sound';
import {
  FLOWER_MERGE6_BUSH0_VOLUME,
  FLOWER_MERGE6_BUSH2_VOLUME,
  FLOWER_MERGE6_BUSH3_VOLUME,
  FLOWER_MERGE6_LEAVES_VOLUME,
  FLOWER_MERGE6_SPARK_VOLUME,
} from '../flower-merge6-sound';
import {
  BEE_MERGE6_HAPPY_VOLUME,
  BEE_MERGE6_VOLUME,
} from '../bee-merge6-sound';
import { WILD_SPECIAL_MERGE6_POOF_VOLUME } from '../wild-special-merge6-poof-sound';

describe('sound effects master volume', () => {
  it('reduces every currently active SFX voice by exactly 40 percent', () => {
    expect(SOUND_EFFECTS_MASTER_GAIN).toBe(0.6);
    expect(GAMEPLAY_PICKUP_SOUND_VOLUME).toBeCloseTo(0.2592);
    expect(GAMEPLAY_RETURN_SOUND_VOLUME).toBeCloseTo(0.51);
    expect(ORDINARY_STACK_SOUND_VOLUME).toBeCloseTo(0.2304);
    expect(ORDINARY_STACK_SECONDARY_VOLUME).toBeCloseTo(0.48);
    expect(REGULAR_MERGE6_SOUND_VOLUME).toBeCloseTo(0.3);
    expect(REGULAR_MERGE6_CRASH_VOLUME).toBeCloseTo(0.1632);
    expect(REGULAR_MERGE6_BOOM_VOLUME).toBeCloseTo(0.36);
    expect(REGULAR_MERGE6_STACK_VOLUME).toBeCloseTo(0.48);
    expect(WILD_STAR_MERGE6_SOUND_VOLUME).toBeCloseTo(0.4);
    expect(WILD_STAR_MERGE6_PRIMARY_VOLUME).toBeCloseTo(REGULAR_MERGE6_SOUND_VOLUME);
    expect(WILD_STAR_MERGE6_CRASH_VOLUME).toBeCloseTo(REGULAR_MERGE6_CRASH_VOLUME);
    expect(WILD_STAR_MERGE6_BOOM_VOLUME).toBeCloseTo(REGULAR_MERGE6_BOOM_VOLUME);
    expect(WILD_STAR_MERGE6_STACK_VOLUME).toBeCloseTo(REGULAR_MERGE6_STACK_VOLUME);
    expect(WILD_STAR_MERGE6_SPARKLE_VOLUME).toBeCloseTo(0.306);
    expect(WILD_SPECIAL_LANDING_SOUND_VOLUME).toBeCloseTo(0.3);
    expect(ARCADE_CRATE_SOUND_VOLUMES).toEqual([0.25536, 0.19152, 0.12768, 0.22344]);
    expect(JOURNEY_BACKPACK_SOUND_VOLUMES).toEqual([0.576, 0.18]);
    expect(NO_MOVES_SOUND_VOLUME).toBeCloseTo(0.42);
    expect(FISH_MERGE6_FISH0_VOLUME).toBeCloseTo(0.24);
    expect(FISH_MERGE6_FISH1_VOLUME).toBeCloseTo(0.4);
    expect(FISH_MERGE6_FISH2_VOLUME).toBeCloseTo(0.4);
    expect(FISH_MERGE6_PLOMP_VOLUME).toBeCloseTo(0.4);
    expect(FISH_MERGE6_SPEAKS_VOLUME).toBeCloseTo(0.24);
    expect(FLOWER_MERGE6_BUSH0_VOLUME).toBeCloseTo(0.48);
    expect(FLOWER_MERGE6_BUSH2_VOLUME).toBeCloseTo(0.6);
    expect(FLOWER_MERGE6_BUSH3_VOLUME).toBeCloseTo(0.21);
    expect(FLOWER_MERGE6_LEAVES_VOLUME).toBeCloseTo(0.48);
    expect(FLOWER_MERGE6_SPARK_VOLUME).toBeCloseTo(0.36);
    expect(BEE_MERGE6_VOLUME).toBeCloseTo(0.6);
    expect(BEE_MERGE6_HAPPY_VOLUME).toBeCloseTo(0.12);
    expect(WILD_SPECIAL_MERGE6_POOF_VOLUME).toBeCloseTo(0.6);
  });

  it('keeps the shared multiplier bounded and excludes music ownership', () => {
    expect(applySoundEffectsMasterGain(-1)).toBe(0);
    expect(applySoundEffectsMasterGain(2)).toBe(0.6);
    expect(applySoundEffectsMasterGain(Number.NaN)).toBe(0);

    const soundtrack = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/soundtrack-manager.ts'),
      'utf8',
    );
    expect(soundtrack).not.toContain('applySoundEffectsMasterGain');
  });

  it('is consumed by all sixteen active SFX owners', () => {
    for (const filename of [
      'gameplay-pickup-sound.ts',
      'ordinary-stack-sound.ts',
      'regular-merge6-sound.ts',
      'wild-star-merge6-sound.ts',
      'beach-ball-merge6-sound.ts',
      'core-tnt-merge6-sound.ts',
      'wild-special-landing-sound.ts',
      'arcade-crate-sound.ts',
      'journey-backpack-sound.ts',
      'no-moves-sound.ts',
      'arcade-round-digit-sound.ts',
      'bottle-finale-sound.ts',
      'fish-merge6-sound.ts',
      'flower-merge6-sound.ts',
      'bee-merge6-sound.ts',
      'wild-special-merge6-poof-sound.ts',
    ]) {
      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules', filename), 'utf8');
      expect(source).toContain('applySoundEffectsMasterGain');
    }
  });
});
