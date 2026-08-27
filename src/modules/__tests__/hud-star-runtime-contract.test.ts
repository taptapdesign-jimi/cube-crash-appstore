import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('global HUD-star runtime contract', () => {
  const fxSource = read('src/modules/fx.ts');
  const appCoreSource = read('src/modules/app-core.ts');
  const starsCollectorSource = read('src/modules/stars-collector.ts');

  test('shares one protected stage container and one lifecycle cadence lease', () => {
    expect(fxSource).toContain('stage?._ccHudStarFlightContainer');
    expect(fxSource).toContain('stage._ccHudStarFlightContainer = container');
    expect(fxSource).toContain("acquirePixiMobileActivityLease('hud-star-flight')");
    expect(fxSource).toContain('container._activeJobCount');
    expect(fxSource).toContain('releaseHudStarAnimationJob(animationContainer)');
    expect(fxSource).toContain('releaseHudStarContainerCadence(container)');
    expect(starsCollectorSource).toContain("await import('./fx.ts')");
    expect(starsCollectorSource).not.toContain('function animateStarToHUD(');
  });

  test('coalesces simultaneous HUD redraw and bounce work without dropping score mutations', () => {
    expect(appCoreSource).toContain('score = Math.min(SCORE_CAP, score + bonus)');
    expect(appCoreSource).toContain('if (hudStarHudFeedbackFramePending) return;');
    expect(appCoreSource).toContain('trackAppAnimationFrame(() => {');
    expect(appCoreSource).toContain('scheduleHudStarHudFeedback();');
  });
});
