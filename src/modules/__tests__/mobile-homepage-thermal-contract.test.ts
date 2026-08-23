import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('mobile Homepage thermal ownership', () => {
  const optimizerSource = read('src/modules/ios-optimizer.ts');
  const sliderSource = read('src/modules/slider-manager.ts');
  const sliderCss = read('src/slider-optimized.css');
  const navigationCss = read('src/independent-navigation.css');
  const journeyCss = read('src/collectibles-screen.css');

  test('publishes canonical iOS/iPadOS/Android hooks while desktop skips mobile work', () => {
    expect(optimizerSource).toContain('MOBILE_RUNTIME_PROFILE');
    expect(optimizerSource).toContain("document.body.classList.add('cc-mobile-runtime'");
    expect(optimizerSource).toContain('`cc-runtime-${this.platform}`');
    expect(optimizerSource).toContain("if (!this.isMobileDevice) return;");
    expect(optimizerSource).toContain("'cc-runtime-ios', 'cc-runtime-android'");
  });

  test('does not blanket-promote slider, button, or navigation DOM nodes', () => {
    const compositorOwner = optimizerSource.split(
      'private enableHardwareAcceleration(): void',
    )[1]?.split('// Enable memory optimization')[0] ?? '';

    expect(compositorOwner).not.toContain('querySelectorAll');
    expect(compositorOwner).not.toContain("style.transform = 'translateZ(0)'");
    expect(compositorOwner).not.toContain("style.willChange = 'transform'");
  });

  test('runs only the active mobile hero idle and preserves desktop recipes', () => {
    expect(sliderCss).toContain('.cc-mobile-runtime #home .slider-slide .hero-image');
    expect(sliderCss).toContain('animation-play-state: paused;');
    expect(sliderCss).toContain(
      '.cc-mobile-runtime #home:not([hidden]) .slider-slide.active .hero-image',
    );
    expect(sliderCss).toContain('animation: cubesFloat 3s ease-in-out infinite;');
    expect(sliderCss).toContain('animation: trophyGlow 4s ease-in-out infinite;');
    expect(sliderCss).toContain('animation: boxShake 2.5s ease-in-out infinite;');
    expect(sliderCss).toContain('animation: settingsGlow 3.5s ease-in-out infinite;');
  });

  test('runs active navigation idle only while Homepage owns the tree', () => {
    expect(navigationCss).toContain(
      ".cc-mobile-runtime #independent-nav[data-homepage-owner='active']",
    );
    expect(navigationCss).toContain('.independent-nav-button.active::after');
    expect(navigationCss).toContain('animation-play-state: paused;');
    expect(navigationCss).toContain('animation-play-state: running;');
  });

  test('keeps compositor hints finite and avoids important overrides', () => {
    const sliderMobileContract = sliderCss.split('Mobile thermal contract:')[1]
      ?.split('@keyframes settingsGlow')[0] ?? '';
    const navigationMobileContract = navigationCss.split('Mobile thermal contract:')[1]
      ?.split('.nav-badge-text')[0] ?? '';

    expect(sliderMobileContract).toContain('will-change: auto;');
    expect(sliderMobileContract).not.toContain('!important');
    expect(navigationMobileContract).toContain('will-change: auto;');
    expect(navigationMobileContract).not.toContain('!important');
    expect(sliderSource).toContain('onInterrupt: () =>');
    expect(sliderSource).not.toContain('onUpdate: () => {\n              // 🔥 SMOOTH: Force GPU layer update');
  });

  test('gates Journey Hub idle and compositor promotion behind canonical mobile owners', () => {
    const mobileHubContract = journeyCss.split(
      'Mobile thermal ownership for Journey Worlds Hub.',
    )[1]?.split('.journey-v700-world-beach .journey-v700-world-visual')[0] ?? '';

    expect(mobileHubContract).toContain('.cc-mobile-runtime .journey-v700-world-visual');
    expect(mobileHubContract).toContain('.journey-v700-hub.journey-v700-idle-ready');
    expect(mobileHubContract).not.toContain(
      '.journey-v700-world-card.journey-v700-idle-ready .journey-v700-world-visual',
    );
    expect(mobileHubContract).toContain('.journey-v700-hub.journey-v700-tilt-ready');
    expect(mobileHubContract).toContain('.journey-v700-hub.journey-v700-banners-presented');
    expect(mobileHubContract).toContain('.journey-v700-world-banner-flag-fx::before');
    expect(mobileHubContract).toContain('#journey-screen[hidden]');
    expect(mobileHubContract).toContain('animation-play-state: paused;');
    expect(mobileHubContract).toContain('animation-play-state: running;');
    expect(mobileHubContract).toContain('will-change: auto;');
    expect(mobileHubContract).toContain('will-change: transform;');
    expect(mobileHubContract).not.toContain('!important');
  });
});
