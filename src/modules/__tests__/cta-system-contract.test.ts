import fs from 'node:fs';
import path from 'node:path';

describe('shared CTA system contract', () => {
  const moduleSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/cta-system.ts'),
    'utf8',
  );
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/styles/cta-system.css'),
    'utf8',
  );
  const cleanSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/clean-board-modal.ts'),
    'utf8',
  );
  const failSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/board-fail-modal.ts'),
    'utf8',
  );
  const tutorialSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/tutorial-complete-modal.ts'),
    'utf8',
  );
  const firstPlayTutorialSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/first-play-tutorial.ts'),
    'utf8',
  );
  const newRewardSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
    'utf8',
  );
  const specialDiceSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/journey-special-dice-screen.ts'),
    'utf8',
  );
  const journeyBoardsSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
    'utf8',
  );
  const uiManagerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/ui-manager.ts'),
    'utf8',
  );
  const sliderManagerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/slider-manager.ts'),
    'utf8',
  );
  const animationsSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/utils/animations.ts'),
    'utf8',
  );
  const endRunSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/end-run-modal.ts'),
    'utf8',
  );
  const collectibleRewardSheetSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/collectible-reward-bottom-sheet.ts'),
    'utf8',
  );
  const collectibleRewardUiSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/collectible-reward-ui.ts'),
    'utf8',
  );

  test('owns one shared primary/secondary motion lifecycle with cleanup', () => {
    expect(moduleSource).toContain("export type CtaVariant = 'primary' | 'secondary'");
    expect(moduleSource).toContain("enterEase: 'back.out(1.8)'");
    expect(moduleSource).toContain("exitEase: 'back.in(1.75)'");
    expect(moduleSource).toContain('exitDuration: 0.31');
    expect(moduleSource).toContain('pressDuration: 0.12');
    expect(moduleSource).toContain('releaseDuration: 0.26');
    expect(moduleSource).toContain('pressScale: 0.84');
    expect(moduleSource).toContain('pressOffsetY: 4');
    expect(moduleSource).toContain('y: ctaMotion.pressOffsetY');
    expect(moduleSource).toContain("element.addEventListener('pointercancel', onPointerCancel");
    expect(moduleSource).toContain("window.addEventListener('pointerup', onPointerUp");
    expect(moduleSource).toContain("window.addEventListener('pointercancel', onPointerCancel");
    expect(moduleSource).not.toContain("element.addEventListener('lostpointercapture'");
    expect(moduleSource).toContain('abortController.abort()');
    expect(moduleSource).toContain('gsap.killTweensOf(visual)');
    expect(moduleSource).toContain('await release()');
    expect(moduleSource).toContain('await options.onActivate()');
    expect(moduleSource).toContain('export function configureCtaMotion(');
    expect(moduleSource).toContain('export async function exitCtaPair(');
    expect(moduleSource).toContain('export async function exitCtaGroup(');
    expect(moduleSource).toContain('companionExitStaggerMs: 70');
    expect(moduleSource).toContain("prime(state: 'hidden' | 'idle')");
    expect(moduleSource).toContain("activationTiming?: 'after-release' | 'immediate'");
  });

  test('keeps phone and iPad width tokens separate without changing motion', () => {
    expect(cssSource).toContain('@media (max-width: 767px)');
    expect(cssSource).toContain('@media (min-width: 768px) and (max-width: 1024px)');
    expect(cssSource.match(/--cc-cta-stack-width: 249px/g)).toHaveLength(2);
    expect(cssSource).not.toContain('transition: transform');
    expect(cssSource).toContain('opacity: 1 !important');
    expect(cssSource).toContain('transform: none !important');
    expect(cssSource).toContain('.cc-cta::before');
    expect(cssSource).toContain('content: none !important');
    expect(cssSource).toContain('button.cc-cta:active');
    expect(cssSource).toContain('button.cc-cta:focus-visible');
    expect(cssSource).toContain('background: transparent !important');
    expect(cssSource).toContain('box-shadow: none !important');
  });

  test('migrates Clean Board and Fail away from legacy CTA class collisions', () => {
    for (const source of [cleanSource, failSource]) {
      expect(source).toContain("from './cta-system.ts'");
      expect(source).toContain('registerCta(');
      expect(source).toContain("activationTiming: 'immediate'");
    }
    expect(cleanSource).not.toContain("primaryBtn.className = 'restart-btn primary-button bottom-sheet-cta'");
    expect(failSource).not.toContain("continueBtn.className = 'restart-btn primary-button bottom-sheet-cta'");
    expect(failSource).not.toContain('emptyStars.forEach((star, index) => prep(');
    expect(failSource).not.toContain("star.style.opacity = '0'");
    expect(failSource).toContain("star.style.transform = 'scale(1.12)'");
    expect(failSource).toContain("star.style.transform = 'scale(0.98)'");
    expect(cleanSource).toContain('exitCtaPair(primaryBtn, secondaryBtn),\n        earnedStarsExitPromise,');
    expect(cleanSource).toContain('const ctaExitPromise = exitCtaPair(secondaryBtn, primaryBtn)');
    expect(cleanSource).toContain('const modalExitPromise = Promise.all([\n          ctaExitPromise,');
    expect(failSource).toContain('await exitCtaPair(primaryButton, secondaryButton)');
  });

  test('migrates Tutorial Complete onto the same primary lifecycle', () => {
    expect(tutorialSource).toContain("import { registerCta } from './cta-system.ts'");
    expect(tutorialSource).toContain("variant: 'primary'");
    expect(tutorialSource).toContain('await ctaController?.exit()');
    expect(tutorialSource).toContain('void ctaController?.enter()');
    expect(tutorialSource).not.toContain('restart-btn primary-button bottom-sheet-cta');
    expect(tutorialSource).not.toContain("cta?.addEventListener('click'");
  });

  test('migrates the active First Play Got it sheet with CTA-before-sheet exit ordering', () => {
    expect(firstPlayTutorialSource).toContain("import { registerCta, type CtaController } from './cta-system.ts'");
    expect(firstPlayTutorialSource).toContain('tutorialCtaController = registerCta(cta');
    expect(firstPlayTutorialSource).toContain("variant: 'primary'");
    expect(firstPlayTutorialSource).toContain("activationTiming: 'immediate'");
    expect(firstPlayTutorialSource).toContain('await tutorialCtaController?.exit()');
    expect(firstPlayTutorialSource.indexOf('await tutorialCtaController?.exit()'))
      .toBeLessThan(firstPlayTutorialSource.indexOf("gsap.to(sheet, {\n      y: '100%'", firstPlayTutorialSource.indexOf('async function dismissThirdStepAndWaitForWild')));
    expect(firstPlayTutorialSource).not.toContain("cta?.addEventListener('click'");
    expect(cssSource).toContain('.first-play-tutorial-sheet .first-play-tutorial-cta.cc-cta');
  });

  test('migrates New Reward and Special Dice onto the same primary lifecycle', () => {
    for (const source of [newRewardSource, specialDiceSource]) {
      expect(source).toContain("import { registerCta } from './cta-system.ts'");
      expect(source).toContain("variant: 'primary'");
      expect(source).toContain('await ctaController?.exit()');
      expect(source).toContain('void ctaController?.enter()');
      expect(source).not.toContain('restart-btn primary-button bottom-sheet-cta');
      expect(source).not.toContain("cta?.addEventListener('click'");
      expect(source).not.toContain('.to(cta,');
    }
  });

  test('reveals the New Reward card before bouncing in its Continue CTA', () => {
    expect(newRewardSource).not.toContain('const ctaStart = titleStart');
    const revealStart = newRewardSource.indexOf('const cardEnterStart = 0;');
    const finalCardEnter = newRewardSource.indexOf('.to(unlockedSurface, {', revealStart);
    const cardImpact = newRewardSource.indexOf('}, undefined, cardImpactStart)', finalCardEnter);
    const ctaEnter = newRewardSource.indexOf('void ctaController?.enter()', finalCardEnter);
    expect(revealStart).toBeGreaterThan(-1);
    expect(finalCardEnter).toBeGreaterThan(revealStart);
    expect(cardImpact).toBeGreaterThan(finalCardEnter);
    expect(ctaEnter).toBeGreaterThan(cardImpact);
  });

  test('migrates regular and interim Journey detail CTAs without dual touch/click activation', () => {
    expect(journeyBoardsSource).toContain("floatingPlayButton.className = 'cc-journey-detail-cta'");
    expect(journeyBoardsSource).toContain("newContinueBtn.className = 'detail-continue-board-button cc-journey-detail-cta'");
    expect(journeyBoardsSource).toContain('registerCta(floatingPlayButton');
    expect(journeyBoardsSource).toContain('registerCta(newContinueBtn as HTMLButtonElement');
    expect(journeyBoardsSource).toContain('getRegisteredCta(playButton as HTMLButtonElement)?.exit()');
    expect(journeyBoardsSource).not.toContain("floatingPlayButton.addEventListener('touchend'");
    expect(journeyBoardsSource).not.toContain("floatingPlayButton.addEventListener('click'");
    expect(cssSource).toContain('#board-detail-play-button.cc-cta');
    expect(cssSource).toContain('overflow: visible !important');
    expect(cssSource).toContain('.cc-cta:disabled:not([data-cta-state="exiting"]):not([data-cta-state="hidden"])');
    expect(cssSource).toContain('.cc-cta[data-cta-state="exiting"] .cc-cta__visual');
    expect(cssSource).toContain('animation: cc-cta-shimmer 10s ease-in-out infinite');
    expect(cssSource).toContain(
      '.cc-cta[data-cta-variant="primary"] .cc-cta__visual::after',
    );
    expect(cssSource).toContain(
      '.cc-cta[data-cta-variant="secondary"] .cc-cta__visual::after',
    );
    expect(cssSource).toContain(
      'button.cc-cta[data-cta-variant="secondary"]::after',
    );
    expect(cssSource).toContain('-webkit-mask-size: 280% 100%');
    expect(cssSource).toContain('42%, 53% { opacity: 0.52; }');
  });

  test('migrates every Homepage slider CTA onto shared input and motion ownership', () => {
    expect(uiManagerSource).toContain('private registerHomepageCtaButtons()');
    expect(uiManagerSource).toContain("button.classList.remove('tap-scale', 'menu-btn-primary')");
    expect(uiManagerSource).toContain('private homepageCtaControllers = new Map<HTMLButtonElement, CtaController>()');
    expect(uiManagerSource).toContain('if (this.homepageCtaControllers.has(button)) return');
    expect(uiManagerSource).toContain('this.homepageCtaControllers.set(button, registerCta(button');
    expect(uiManagerSource).toContain("activationTiming: 'immediate'");
    expect(uiManagerSource).toContain('activateOnCapturedRelease: true');
    expect(moduleSource).toContain('!inside && !options.activateOnCapturedRelease');
    expect(sliderManagerSource).toContain("event.target.closest('.cc-cta')");
    expect(uiManagerSource).not.toContain('this.homepageCtaControllers.splice(0)');
    expect(animationsSource).toContain('getRegisteredCta(activeCta)?.prime(\'hidden\')');
    expect(animationsSource).toContain('const getPhysicallyVisibleHomepageSlides = (): HTMLElement[] =>');
    expect(animationsSource).toContain('const exitSlides = visibleSlides.length > 0 ? visibleSlides');
    expect(animationsSource).toContain('slideParts.forEach(({ heroContainer }) =>');
    expect(animationsSource).toContain('void ctaController.enter()');
    expect(animationsSource).toContain('void ctaController.exit()');
    expect(cssSource).toContain('.cc-homepage-cta');
    expect(cssSource).toContain('.cc-cta--standard-width');
    expect(cssSource).toContain('.cc-homepage-cta,\n.cc-cta--standard-width {\n  width: 250px !important;');
    expect(cssSource).toContain('.cc-homepage-cta,\n  .cc-cta--standard-width {\n    width: 226px !important;');
    expect(cssSource).toContain('touch-action: none');
    expect(cssSource).not.toContain('top: 2.25vh');
  });

  test('migrates the active End Run sheet and exits every visible action as one CTA group', () => {
    expect(endRunSource).toContain("import { ctaMotion, exitCtaGroup, registerCta, type CtaController } from './cta-system.ts'");
    expect(endRunSource).toContain('registerCta(restartBtn');
    expect(endRunSource).toContain('registerCta(exitBtn');
    expect(endRunSource).toContain("variant: 'secondary'");
    expect(endRunSource).toContain("activationTiming: 'immediate'");
    expect(endRunSource).toContain('exitCtaGroup(first, buttons.filter(button => button !== first))');
    expect(endRunSource).toContain('hideModalWithCtas(exitBtn)');
    expect(endRunSource).toContain('const modalExitComplete = new Promise<void>');
    expect(endRunSource).toContain('hideModal(null, true)');
    expect(endRunSource).toContain('disposeEndRunCtas()');
    expect(endRunSource).toContain('data-end-run-action="restart"');
    expect(endRunSource).not.toContain('data-end-run-action="new-card"');
    expect(endRunSource).not.toContain('showJourneyNewCardScreen');
    expect(endRunSource).toContain("closest('[data-end-run-action]')");
    expect(endRunSource).not.toContain('class="restart-btn"');
    expect(endRunSource).not.toContain('class="new-card-btn"');
    expect(endRunSource).not.toContain('class="exit-btn"');
    expect(endRunSource).not.toContain("trackEndRunEventListener(restartBtn, 'touchend'");
    expect(endRunSource).not.toContain("trackEndRunEventListener(exitBtn, 'touchend'");
    expect(cssSource).toContain('.simple-bottom-sheet:not(.score-bottom-sheet) .simple-button-row .cc-cta');
  });

  test('starts active CTA and modal exits together while awaiting both owners', () => {
    expect(collectibleRewardSheetSource).toContain('registerCta(viewCollectionButton');
    expect(collectibleRewardSheetSource).toContain('registerCta(continueButton');
    expect(collectibleRewardSheetSource).toContain("activationTiming: 'immediate'");
    expect(collectibleRewardSheetSource).toContain('await runGameplayModalParallelExit(');
    expect(collectibleRewardSheetSource).toContain('exitCtaPair(clicked, buttons.find(button => button !== clicked))');
    expect(collectibleRewardSheetSource).toContain('Promise.all([hideSheetAnimation(sheet), overlayExit])');
    expect(collectibleRewardUiSource).not.toContain("continueButton.addEventListener('click'");
    expect(collectibleRewardUiSource).not.toContain("viewCollectionButton.addEventListener('click'");
  });

});
