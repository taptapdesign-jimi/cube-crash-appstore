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

  test('Journey tutorial completion owns a fresh Hub enter instead of a World return', () => {
    const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.ts'), 'utf8');
    const endgameSource = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const boardsSource = fs.readFileSync(path.join(repoRoot, 'src/modules/journey-boards-manager.ts'), 'utf8');

    expect(endgameSource).toContain('__ccFirstPlayTutorialReturnToJourneyHub = true');
    expect(endgameSource).toContain('waitForJourneyV700HubPresentation');
    const continuation = endgameSource.slice(
      endgameSource.indexOf('async function continueFirstPlayTutorialIntoJourney'),
      endgameSource.indexOf('async function continueFirstPlayTutorialIntoArcade'),
    );
    expect(continuation).toContain('journeyBoardsManager.prepareFirstPlayTutorialHubReturn?.();');
    expect(continuation).toContain('.waitForJourneyV700HubPresentation?.(6000)');
    expect(continuation).toContain('if (presented) releaseCover();');
    expect(continuation.indexOf('.waitForJourneyV700HubPresentation?.(6000)'))
      .toBeLessThan(continuation.indexOf('await requestExitToMenu({'));
    expect(mainSource).toContain('firstPlayTutorialHubReturn');
    expect(mainSource).toContain('journeyBoardsManager.prepareFirstPlayTutorialHubReturn?.();');
    expect(boardsSource).toContain("this.setJourneyV700View('hub');");
    expect(boardsSource).toContain('journey-v700-banners-presented');
  });
});
