import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Homepage slider motion contract', () => {
  const animationsSource = read('src/utils/animations.ts');
  const mainSource = read('src/main.ts');
  const uiManagerSource = read('src/modules/ui-manager.ts');
  const sliderCssSource = read('src/slider-optimized.css');

  test('all modern Homepage exits delegate to the single completion owner', () => {
    const publicExit = animationsSource.split(
      'export const animateSliderExit = (): Promise<void>',
    )[1]?.split('// Animate slider enter')[0] ?? '';

    expect(publicExit).toContain('return animateJourneySliderExit();');
    expect(publicExit).toContain('Element.prototype.animate');
  });

  test('canonical exit freezes interrupted enter and cleans the frozen transform while hidden', () => {
    const exitOwner = animationsSource.split(
      'export const animateJourneySliderExit = (): Promise<void>',
    )[1]?.split('const animateSliderExitLegacy')[0] ?? '';
    const finalize = animationsSource.split(
      'export const finalizeJourneySliderExit = (): void',
    )[1]?.split('const animateSliderExitLegacy')[0] ?? '';

    expect(exitOwner).toContain("const paintedTransform = window.getComputedStyle(element).transform");
    expect(exitOwner).toContain("element.style.setProperty('transform', paintedTransform, 'important')");
    expect(exitOwner).toContain("easing: 'cubic-bezier(0.60, -0.28, 0.735, 0.045)'");
    expect(finalize).toContain("element.style.removeProperty('transform')");
  });

  test('Arcade and Settings route on real exit completion rather than a 770ms guess', () => {
    const arcadeOwner = mainSource.split(
      '(window as any).triggerGameStartSequence = async',
    )[1]?.split('// Export exitToMenu function')[0] ?? '';
    const settingsOwner = uiManagerSource.split(
      'private showSettingsScreenWithAnimation(): void',
    )[1]?.split('private hideSettingsScreenWithAnimation')[0] ?? '';

    expect(arcadeOwner).toContain('await animateSliderExit();');
    expect(arcadeOwner).not.toContain('setTimeout(resolve, 770)');
    expect(settingsOwner).toContain('const homepageExitPromise = animateSliderExit();');
    expect(settingsOwner).toContain('void homepageExitPromise.then(() =>');
    expect(settingsOwner).not.toContain('}, 770)');
  });

  test('Homepage enter has a real Promise completion and direction-specific easing', () => {
    const enterHandoff = mainSource.split(
      'async function playHomepageSliderEnterHandoff(',
    )[1]?.split('(window as any).__ccPlayHomepageSliderEnterHandoff')[0] ?? '';

    expect(animationsSource).toContain('export const animateSliderEnter = (): Promise<void>');
    expect(animationsSource).toContain("settleSliderEnter('complete')");
    expect(enterHandoff).toContain('await animateSliderEnter();');
    expect(enterHandoff).not.toContain('}, 1120)');
    expect(sliderCssSource).toContain('#home .animate-enter');
    expect(sliderCssSource).toContain('cubic-bezier(0.175, 0.885, 0.32, 1.275)');
    expect(sliderCssSource).toContain('#home .animate-exit');
    expect(sliderCssSource).toContain('cubic-bezier(0.60, -0.28, 0.735, 0.045)');
  });

  test('navigation icons and their divider join the early Homepage enter beat', () => {
    expect(animationsSource).toContain('const HOMEPAGE_ENTER_NAV_DELAY_MS = 0;');
    expect(animationsSource).toContain('const HOMEPAGE_ENTER_NAV_DURATION_MS = 430;');
    expect(animationsSource).toContain(
      'HOMEPAGE_ENTER_NAV_DURATION_MS,',
    );
  });
});
