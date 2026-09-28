import {
  TNT_MERGE_LIGHT_HAPTIC_DELAYS_MS,
  shouldPlayTntBonusImpactHaptic,
} from '../special-merge-haptic-policy';
import fs from 'node:fs';
import path from 'node:path';

describe('special merge haptic policy', () => {
  test('keeps only two spaced light beats after the leading TNT impact', () => {
    expect(TNT_MERGE_LIGHT_HAPTIC_DELAYS_MS).toEqual([450, 850]);
  });

  test('punctuates only the first and final bonus-cube impact', () => {
    expect([0, 1, 2, 3].filter((index) => shouldPlayTntBonusImpactHaptic(index, 4))).toEqual([0, 3]);
    expect(shouldPlayTntBonusImpactHaptic(-1, 4)).toBe(false);
    expect(shouldPlayTntBonusImpactHaptic(4, 4)).toBe(false);
  });

  test('routes no ordinary stack haptic and gives LaserGun only beam-arrival haptics', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(source).not.toContain('triggerMergeHaptics({ wildActive, trackAppTimeout })');
    expect(source).toContain('if (isLaserGunMergeHaptic) {');
    expect(source).toContain('if (visualArrived) commitLaserImpactHaptic();');
    expect(source).toContain('if (!visualFired) commitLaserImpactHaptic();');
    expect(source).not.toContain("if (impactProfile === 'laser-gun') {\n          // Every Zap Zap beam changes one cube");
  });
});
