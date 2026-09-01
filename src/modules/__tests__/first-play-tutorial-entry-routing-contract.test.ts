import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('first-play tutorial entry routing', () => {
  const uiManagerSource = fs.readFileSync(path.join(repoRoot, 'src/modules/ui-manager.ts'), 'utf8');
  const sliderManagerSource = fs.readFileSync(path.join(repoRoot, 'src/modules/slider-manager.ts'), 'utf8');
  const tutorialSource = fs.readFileSync(path.join(repoRoot, 'src/modules/first-play-tutorial.ts'), 'utf8');

  test('both the Journey CTA and bottom Journey icon choose tutorial gameplay immediately', () => {
    expect(uiManagerSource).toContain('this.showCollectiblesScreenWithAnimation(isFirstPlayTutorialForced());');
    expect(sliderManagerSource).toContain('slideIndex === 1 && isFirstPlayTutorialForced()');
    expect(sliderManagerSource).toContain("document.getElementById('btn-journey')");
    expect(sliderManagerSource).toContain('await this.goToSlideAndWait(1);');
    expect(sliderManagerSource).toContain('journeyButton.click();');
    expect(sliderManagerSource).toContain('SLIDER_CONFIG.SLIDE_DURATION_S * 1000');
    expect(sliderManagerSource).toContain('this.currentSlide === resolvedSlide && !sliderState.isAnimatingEnter');
    expect(uiManagerSource).toContain(
      'const shouldResumeArcade = !isFirstPlayTutorialForced() && hasArcadeSavedState({ clearInvalid: true });',
    );
  });

  test('first-play Journey exit skips Worlds preparation and starts board one', () => {
    const handoff = uiManagerSource.split(
      'private showCollectiblesScreenWithAnimation(launchFirstPlayTutorial = false): void',
    )[1]?.split('async hideCollectiblesScreenWithAnimation')[0] ?? '';

    expect(handoff).toContain('!launchFirstPlayTutorial && collectiblesManager');
    expect(handoff).toContain('if (launchFirstPlayTutorial)');
    expect(handoff).toContain('await startJourneyTutorial(1);');
    expect(handoff).toContain("await appZoneManager.hideHomepageForGame('first-play-journey-slider-handoff');");
    expect(handoff.indexOf("await appZoneManager.hideHomepageForGame('first-play-journey-slider-handoff');"))
      .toBeLessThan(handoff.indexOf('finalizeJourneySliderExit();'));
    expect(handoff.indexOf('await startJourneyTutorial(1);'))
      .toBeLessThan(handoff.indexOf('this.showCollectiblesScreen();'));
  });

  test('the chosen source remains available through Tutorial Complete routing', () => {
    expect(tutorialSource).toContain('(window as any).__ccFirstPlayTutorialRunSource = source;');
  });

  test('Journey tutorial completion returns to Homepage Slider 2 through its full enter owner', () => {
    const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.ts'), 'utf8');
    const endgameSource = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const continuation = endgameSource.slice(
      endgameSource.indexOf('async function continueFirstPlayTutorialToJourneyHomepage'),
      endgameSource.indexOf('async function continueFirstPlayTutorialIntoArcade'),
    );
    expect(continuation).toContain("reason: 'first-play-tutorial-complete-journey-homepage'");
    expect(continuation).toContain("target: 'homepage'");
    expect(continuation).toContain('homepageSlideIndex: 1');
    expect(continuation).toContain('onHomepageEnterPrepared: releaseCover');
    expect(continuation).not.toContain('prepareFirstPlayTutorialHubReturn');
    expect(continuation).not.toContain('waitForJourneyV700HubPresentation');
    expect(continuation).not.toContain('markJourneyGameOrigin');
    expect(endgameSource).not.toContain('__ccFirstPlayTutorialReturnToJourneyHub');
    expect(mainSource).not.toContain('__ccFirstPlayTutorialReturnToJourneyHub');

    const homepageEnter = mainSource.slice(
      mainSource.indexOf('async function playHomepageSliderEnterHandoff('),
      mainSource.indexOf('(window as any).__ccPlayHomepageSliderEnterHandoff'),
    );
    expect(homepageEnter).toContain('sliderManager.syncHiddenSlideState(targetSlideIndex);');
    expect(homepageEnter).toContain('await primeHomepageForEnterLikeStartup(reason, targetSlideIndex);');
    expect(homepageEnter).toContain('prepareSliderEnter();');
    expect(homepageEnter).toContain('options.onEnterPrepared?.();');
    expect(homepageEnter).toContain('await animateSliderEnter();');
    expect(homepageEnter.indexOf('options.onEnterPrepared?.();'))
      .toBeGreaterThan(homepageEnter.indexOf('prepareSliderEnter();'));
    expect(homepageEnter.indexOf('options.onEnterPrepared?.();'))
      .toBeLessThan(homepageEnter.indexOf('await animateSliderEnter();'));

    const exitOwner = mainSource.slice(
      mainSource.indexOf('(window as any).exitToMenu = async ('),
      mainSource.indexOf('// STATS SERVICE INTEGRATION'),
    );
    expect(exitOwner).toContain("if (exitRoute.target === 'home')");
    expect(exitOwner).toContain('targetSlideIndex: targetSlide');
    expect(exitOwner).toContain('onEnterPrepared: options.onHomepageEnterPrepared');
  });
});
