import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Homepage navigation ownership', () => {
  const navigationSource = read('src/modules/navigation-control.ts');
  const zoneSource = read('src/modules/app-zone-manager.ts');
  const uiManagerSource = read('src/modules/ui-manager.ts');
  const navigationCss = read('src/independent-navigation.css');
  const indexSource = read('index.html');
  const mainSource = read('src/main.ts');
  const readinessSource = read('src/utils/startup-readiness.ts');
  const animationsSource = read('src/utils/animations.ts');

  test('inactive ownership is a paint-proof CSS invariant', () => {
    expect(navigationCss).toContain("#independent-nav[data-homepage-owner='inactive']");
    expect(navigationCss).toContain('display: none !important;');
    expect(navigationCss).toContain('visibility: hidden !important;');
    expect(navigationCss).toContain('pointer-events: none !important;');
  });

  test('the owner hides the real div tree and cancels descendant animations', () => {
    expect(navigationSource).toContain("document.getElementById('independent-nav')");
    expect(navigationSource).toContain("setAttribute(nav, OWNER_ATTRIBUTE, 'inactive')");
    expect(navigationSource).toContain("nav.getAnimations?.({ subtree: true })");
    expect(uiManagerSource).not.toContain("const navElement = document.querySelector('nav');");
  });

  test('one lifecycle owner controls cold prime, enter, commit, and stale completion rejection', () => {
    expect(navigationSource).toContain("type HomepageNavigationPhase");
    expect(navigationSource).toContain("| 'primed'");
    expect(navigationSource).toContain("| 'entering'");
    expect(navigationSource).toContain("| 'interactive'");
    expect(navigationSource).toContain('stale-commit-ignored');
    expect(mainSource).not.toContain('function restoreHomepageNavigationTree');
    expect(animationsSource).toContain("'animations:slider-enter-start',");
    expect(animationsSource).toContain('sliderEnterNavigationGeneration ?? undefined');
    expect(animationsSource).toContain('animations:slider-enter-complete');
    expect(navigationCss).toContain("#independent-nav[data-homepage-owner='active']");
  });

  test('a still-mounted launch overlay cannot suppress the first owned Homepage enter', () => {
    expect(navigationSource).not.toContain("document.getElementById('loading-screen')");
    expect(navigationSource).not.toContain('Navigation hidden: Loading screen active');
    expect(indexSource).toContain("#independent-nav:not([data-homepage-owner='active'])");
    expect(indexSource).not.toContain("\n    #independent-nav {\n      visibility: hidden;");
    expect(navigationSource).toContain("__ccAppZone === 'home'");
  });

  test('cold start acquires navigation before layout readiness and decodes its icons', () => {
    const startupOwner = mainSource.indexOf("appZoneManager.markHomeMenu('startup-homepage-enter')");
    const coldForceReady = mainSource.indexOf('sliderManager.forceReady()', startupOwner);
    const firstPaintReady = mainSource.indexOf("reason: 'main-before-home-enter'", coldForceReady);
    const visibleEnter = mainSource.indexOf('animateSliderEnter();', firstPaintReady);

    expect(startupOwner).toBeGreaterThan(-1);
    expect(coldForceReady).toBeGreaterThan(startupOwner);
    expect(firstPaintReady).toBeGreaterThan(coldForceReady);
    expect(visibleEnter).toBeGreaterThan(firstPaintReady);
    expect(readinessSource).toContain('#independent-nav .independent-nav-button img');
  });

  test('Journey/Homepage to Arcade releases navigation before gameplay boot', () => {
    const gameHandoff = zoneSource.split(
      "async hideHomepageForGame(reason = 'enter-game')",
    )[1]?.split("async showHomepageShell")[0] ?? '';

    expect(gameHandoff).toContain('hideHomepageNavigation(`app-zone:${reason}`);');
    expect(gameHandoff.indexOf('hideHomepageNavigation')).toBeLessThan(
      gameHandoff.indexOf('await this.cleanupTransientVisuals'),
    );
  });

  test('stray showNavigation calls are rejected outside the home zone', () => {
    const showNavigation = uiManagerSource.split('showNavigation(): void')[1]
      ?.split('// Hide app element')[0] ?? '';

    expect(showNavigation).toContain("commitHomepageNavigation('ui-manager:showNavigation')");
    expect(navigationSource).toContain("__ccAppZone === 'home'");
    expect(navigationSource).toContain('rejected-outside-home');
  });
});
