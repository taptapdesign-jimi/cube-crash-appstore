import fs from 'node:fs';
import path from 'node:path';

describe('Clean Board and HUD-star haptic policy', () => {
  test('keeps independent compact 50ms weakest-impact clocks for all three score streams', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/clean-board-modal.ts'), 'utf8');

    expect(source).toContain('const CLEAN_BOARD_COUNTER_HAPTIC_INTERVAL_MS = 50;');
    expect(source).toContain('triggerCleanBoardCounterHaptic();');
    expect(source).toContain('const triggerMainScoreCounterHaptic = createCounterLightHapticTrigger();');
    expect(source).toContain('const triggerComboCounterHaptic = createCounterLightHapticTrigger();');
    expect(source).toContain('const triggerEfficiencyCounterHaptic = createCounterLightHapticTrigger();');
  });

  test('keeps every flying HUD-star arrival silent', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/fx.ts'), 'utf8');
    const start = source.indexOf('export async function animateStarsToHudIcon');
    const end = source.indexOf('\nexport ', start + 1);
    const owner = source.slice(start, end > start ? end : source.length);

    expect(owner).not.toContain('triggerHapticImpact');
    expect(owner).not.toContain('hudArrivalHapticPlayed');
  });
});
