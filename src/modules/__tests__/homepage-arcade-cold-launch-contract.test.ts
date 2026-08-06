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
    expect(owner.indexOf('appZoneManager.markArcadeRunOrigin();'))
      .toBeLessThan(owner.indexOf('await animateSliderExit();'));
    expect(owner.indexOf('appZoneManager.enterArcadeBoardZone(arcadeStartReason);'))
      .toBeGreaterThan(owner.indexOf('await animateSliderExit();'));
    expect(owner).toContain('await appZoneManager.hideHomepageForGame');
    expect(owner).toContain('await uiManager.startNewGameWithSavedState();');
    expect(owner).not.toContain('setTimeout(async () =>');
  });

  test('Arcade return keeps one warm Homepage enter owner and app-lifetime navigation control', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/main.ts'), 'utf8');
    const exitStart = source.indexOf('(window as any).exitToMenu = async () =>');
    const exitEnd = source.indexOf('// STATS SERVICE INTEGRATION', exitStart);
    const exitOwner = source.slice(exitStart, exitEnd);
    const enterStart = source.indexOf('async function playHomepageSliderEnterHandoff(');
    const enterEnd = source.indexOf('(window as any).__ccPlayHomepageSliderEnterHandoff', enterStart);
    const enterOwner = source.slice(enterStart, enterEnd);

    expect(exitOwner).not.toContain('cleanupNavigationControl');
    expect(exitOwner).not.toContain("appZoneManager.markHomeMenu('exitToMenu:homepage-single-owner')");
    expect(exitOwner).toContain("playHomepageSliderEnterHandoff('exitToMenu:homepage-final', {");
    expect(exitOwner).toContain('skipFirstPaintReady: true');
    expect(enterOwner).toContain('appZoneManager.prepareHomeMenuEnter(`homepage-enter-owner:${reason}`)');
    expect(enterOwner.indexOf('homepageEnterTransitionOwner.begin'))
      .toBeLessThan(enterOwner.indexOf('gameState.setState'));
    expect(enterOwner.indexOf('gameState.setState'))
      .toBeLessThan(enterOwner.indexOf('primeHomepageForEnterLikeStartup'));
  });
});
