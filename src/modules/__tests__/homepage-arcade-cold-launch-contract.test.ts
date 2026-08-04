import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Homepage cold-launch Arcade handoff', () => {
  test('cancels unfinished Homepage enter and serializes the complete Arcade route', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/main.ts'), 'utf8');
    const start = source.indexOf('(window as any).triggerGameStartSequence = async');
    const end = source.indexOf('// Export exitToMenu function', start);
    const owner = source.slice(start, end);

    expect(owner).toContain('__ccUiArcadeTransitioning === true');
    expect(owner).toContain("homepageEnterTransitionOwner.cancel('homepage-to-arcade')");
    expect(owner).toContain("cancelSliderEnterAnimation('homepage-to-arcade')");
    expect(owner.indexOf("cancelSliderEnterAnimation('homepage-to-arcade')"))
      .toBeLessThan(owner.indexOf('animateSliderExit();'));
    expect(owner).toContain('await appZoneManager.hideHomepageForGame');
    expect(owner).toContain('await uiManager.startNewGameWithSavedState();');
    expect(owner).not.toContain('setTimeout(async () =>');
  });
});
