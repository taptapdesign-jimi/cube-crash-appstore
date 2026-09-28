import {
  TNT_MERGE_LIGHT_HAPTIC_DELAYS_MS,
  shouldPlayTntBonusImpactHaptic,
} from '../special-merge-haptic-policy';

describe('special merge haptic policy', () => {
  test('keeps only two spaced light beats after the leading TNT impact', () => {
    expect(TNT_MERGE_LIGHT_HAPTIC_DELAYS_MS).toEqual([450, 850]);
  });

  test('punctuates only the first and final bonus-cube impact', () => {
    expect([0, 1, 2, 3].filter((index) => shouldPlayTntBonusImpactHaptic(index, 4))).toEqual([0, 3]);
    expect(shouldPlayTntBonusImpactHaptic(-1, 4)).toBe(false);
    expect(shouldPlayTntBonusImpactHaptic(4, 4)).toBe(false);
  });
});
