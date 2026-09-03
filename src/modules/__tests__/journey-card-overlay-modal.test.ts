import fs from 'node:fs';
import path from 'node:path';
import {
  buildJourneyCardOverlayModalViewModel,
  createJourneyCardOverlayTiltProfile,
  getJourneyCardDragFlipAngle,
  getJourneyCardFlightFlipAngle,
  getJourneyCardFlipEdgeProgress,
  getJourneyCardFlipFaceForAngle,
  getJourneyCardRenderedRotateYAngle,
  shouldCommitJourneyCardReleasedDrag,
  JOURNEY_CARD_FLIP_DRAG_HANDOFF_VIEWPORT_RATIO,
  JOURNEY_CARD_FLIP_DRAG_RELEASE_VIEWPORT_RATIO,
  JOURNEY_CARD_FLIP_DRAG_SCRUB_MAX_DEG,
  JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS,
  JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG,
  JOURNEY_CARD_LEGENDARY_IDLE_TILT_RATIO,
  JOURNEY_CARD_FLIP_ENTER_DURATION_MS,
  JOURNEY_CARD_FLIP_IDLE_COACH_DELAY_MS,
  JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS,
  JOURNEY_CARD_FLIP_SNAP_DURATION_MS,
  JOURNEY_CARD_FLIP_RECOIL_DURATION_MS,
  JOURNEY_CARD_FLIP_RECOIL_EASE,
  JOURNEY_CARD_FLIP_FINAL_SETTLE_EASE,
  JOURNEY_CARD_FLIP_RECOIL_STOPS,
  JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE,
  JOURNEY_CARD_DISMISS_DRAG_COMMIT_RATIO,
  JOURNEY_CARD_DISMISS_DRAG_MAX_PX,
  JOURNEY_CARD_DISMISS_DRAG_MIN_PX,
  JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS,
  JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS,
  JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS,
  JOURNEY_CARD_PLAY_RETURN_DURATION_MS,
  JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS,
  getJourneyCardDismissDragDistance,
  getJourneyCardLegendaryDragShineState,
  isJourneyCardVerticalDismissGesture,
  shouldShowJourneyCardLegendaryDragShine,
} from '../journey-card-overlay-modal';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Journey two-sided card overlay prototype', () => {
  test('never turns a valid card or Play tap into a silent route no-op', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const cardHandler = manager.slice(
      manager.indexOf('const handleCardTap = (e: Event) =>'),
      manager.indexOf('// Only treat as tap if finger didn\'t move'),
    );
    expect(cardHandler).toContain('Journey card fallback detail route failed');
    expect(cardHandler).toContain('this.startBoardAreaThenJourneyExit(board.id)');
    expect(cardHandler).toContain('this.openBoardDetails(board, true, fallbackJourneyExitPromise)');

    const gameHandoff = manager.slice(
      manager.indexOf('let didStart = false;'),
      manager.indexOf('private waitForJourneyOverlayReturnReady'),
    );
    expect(gameHandoff).toContain("throw new Error('continueGameWithSavedState function not found')");
    expect(gameHandoff).toContain("throw new Error('startNewRunFromJourney function not found')");
    expect(gameHandoff.indexOf("throw new Error('startNewRunFromJourney function not found')"))
      .toBeLessThan(gameHandoff.lastIndexOf('didStart = true;'));
  });

  test('builds the minimal Stage stats model', () => {
    expect(buildJourneyCardOverlayModalViewModel(5, {
      highScore: 6775.9,
      longestCombo: 14.8,
    }, false)).toEqual({
      stageLabel: 'Stage 05',
      stageNumber: '05',
      highScore: '6,775',
      longestCombo: '14',
      ctaLabel: 'Play',
      ctaAriaLabel: 'Play Stage',
    });
    expect(buildJourneyCardOverlayModalViewModel(0, {
      highScore: -1,
      longestCombo: Number.NaN,
    }, true)).toEqual({
      stageLabel: 'Stage 01',
      stageNumber: '01',
      highScore: '0',
      longestCombo: '0',
      ctaLabel: 'Continue',
      ctaAriaLabel: 'Continue Stage',
    });
    expect(buildJourneyCardOverlayModalViewModel(21, {
      highScore: 10,
      longestCombo: 2,
    }, false).stageLabel).toBe('Stage 01');
  });

  test('keeps only Stage uppercase while stat labels use their written casing and numbers stay orange', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');

    expect(modal).toContain('<span class="journey-card-flip-title-label">STAGE</span>');
    expect(modal).toContain('<span class="journey-card-flip-title-number">${viewModel.stageNumber}</span>');
    expect(css).toMatch(/\.journey-card-flip-title-label \{[\s\S]*?color: #ad8675;/);
    expect(css).toMatch(/\.journey-card-flip-title-number \{[\s\S]*?color: #e8744a;/);
    expect(css).toMatch(/\.journey-card-flip-stat strong \{[\s\S]*?color: #e8744a;/);
    expect(modal).toContain('<strong>${viewModel.highScore}</strong><span>High score</span>');
    expect(modal).toContain('<strong>${viewModel.longestCombo}</strong><span>Longest combo</span>');
    expect(css).toMatch(/\.journey-card-flip-stat span \{[\s\S]*?color: #ad8775;[\s\S]*?text-transform: none;/);
    expect(css).not.toContain('.journey-card-flip-cta.cc-cta .cc-cta__visual');
  });

  test('drives one Legendary reflection directly from front-face drag angle without an idle cadence', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');

    expect(shouldShowJourneyCardLegendaryDragShine('legendary', 'front', false, true)).toBe(true);
    expect(shouldShowJourneyCardLegendaryDragShine('legendary', 'front', false, false)).toBe(false);
    expect(shouldShowJourneyCardLegendaryDragShine('legendary', 'back', false, true)).toBe(false);
    expect(shouldShowJourneyCardLegendaryDragShine('common', 'front', false, true)).toBe(false);
    expect(shouldShowJourneyCardLegendaryDragShine('legendary', 'front', true, true)).toBe(false);
    expect(getJourneyCardLegendaryDragShineState(0).active).toBe(false);
    expect(getJourneyCardLegendaryDragShineState(1).active).toBe(false);
    expect(getJourneyCardLegendaryDragShineState(5).opacity).toBeGreaterThan(0.25);
    expect(getJourneyCardLegendaryDragShineState(36)).toMatchObject({
      active: true,
      backgroundPositionPercent: 85,
      rainbowBackgroundPositionPercent: 29,
    });
    expect(getJourneyCardLegendaryDragShineState(-36)).toMatchObject({
      active: true,
      backgroundPositionPercent: 15,
      rainbowBackgroundPositionPercent: 71,
    });
    expect(getJourneyCardLegendaryDragShineState(72).opacity).toBeCloseTo(0.88, 4);
    expect(getJourneyCardLegendaryDragShineState(90).active).toBe(false);
    expect(getJourneyCardLegendaryDragShineState(180).active).toBe(false);
    expect(getJourneyCardLegendaryDragShineState(Number.NaN).active).toBe(false);
    expect(modal).toContain('class="journey-card-flip-card-host"');
    expect(modal).toContain('class="journey-card-flip-legendary-shine"');
    expect(modal).not.toContain('class="journey-card-flip-legendary-shine cc-journey-interim-shine-light"');
    expect(modal).toContain('setJourneyInterimShineMask(legendaryShine, options.cardImagePath2x)');
    expect(modal).not.toContain('createJourneyInterimShineLoop({');
    expect(modal).not.toContain('JOURNEY_INTERIM_CARD_SHINE_PROFILE.cadenceMs');
    expect(modal).toContain('const paintLegendaryDragShine = (angle: number, allowSettling = false): void => {');
    expect(modal).toContain("activePointerId !== null\n      && stage.classList.contains('is-dragging')\n      && dragAxis === 'horizontal'");
    const pointerDown = modal.slice(
      modal.indexOf('function handlePointerDown('),
      modal.indexOf('function handleAnyPointerInteraction('),
    );
    expect(pointerDown.indexOf("stage.classList.add('is-dragging');"))
      .toBeLessThan(pointerDown.indexOf('clearLegendaryDragShine();'));
    const pointerRelease = modal.slice(
      modal.indexOf('function finishPointer('),
      modal.indexOf('function handlePointerUp('),
    );
    expect(pointerRelease).toContain('paintLegendaryDragShine(settleAngle, true);');
    expect(pointerRelease).toContain('clearLegendaryDragShine();');
    expect(modal).toContain('paintLegendaryDragShine(dragAngle);');
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-legendary-card \.journey-card-flip-shine \{[\s\S]*?display: none;/);
    expect(css).toMatch(/\.journey-card-flip-legendary-shine \{[\s\S]*?-webkit-mask-size: contain;[\s\S]*?mask-size: contain;/);
    expect(css).toMatch(/\.journey-card-flip-legendary-shine \{[\s\S]*?rgba\(255, 137, 211, 0\.20\)[\s\S]*?rgba\(124, 255, 190, 0\.18\)[\s\S]*?background-position: 50% 50%, 50% 50%;[\s\S]*?background-size: 280% 100%, 220% 145%;[\s\S]*?transition: none;/);
    expect(css).not.toContain('.journey-card-flip-overlay .journey-card-flip-legendary-shine::after');
    expect(modal).toContain('`${shine.backgroundPositionPercent}% 50%`');
    expect(modal).toContain('`${shine.rainbowBackgroundPositionPercent}% 50%`');
    expect(modal).toContain('legendaryShine.style.opacity = String(shine.opacity);');
    expect(modal).toContain("legendaryShine?.style.removeProperty('background-position')");
    expect(modal).toContain("legendaryShine?.style.removeProperty('opacity')");
    expect(modal).toContain('clearLegendaryDragShine(true);');
  });

  test('runs the front Legendary idle tilt and holo from one bounded WAAPI owner pair', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');

    expect(JOURNEY_CARD_LEGENDARY_IDLE_TILT_RATIO).toBe(0.3);
    expect(JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG).toBeCloseTo(21.6, 8);
    expect(JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS).toBe(6800);
    expect(modal).toContain('const idleAngles = [');
    expect(modal).toContain('-JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG');
    expect(modal).toContain('JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG');
    expect(modal).toContain('opacity: Math.max(0.12, shine.opacity * 0.58)');
    expect(modal).toContain('legendaryIdleRotorAnimation = rotor.animate(');
    expect(modal).toContain('legendaryIdleShineAnimation = legendaryShine.animate(shineKeyframes');
    expect(modal).toContain('iterations: Infinity');
    expect(modal).toContain('cardRarity !== \'legendary\'');
    expect(modal).toContain("stableFace !== 'front'");
    expect(modal).toContain("stage.classList.contains('is-idle-coach')");
    expect(modal).toContain('legendaryIdleRotorAnimation?.cancel();');
    expect(modal).toContain('legendaryIdleShineAnimation?.cancel();');
    expect(modal).toContain('const cancelMotion = () => {\n    stopSurfaceIdle();');
    expect(css).toContain('.is-legendary-idle-holo)\n  .journey-card-flip-rotor');
    expect(css).toContain('.is-legendary-idle-holo)\n  .journey-card-flip-legendary-shine');
  });

  test('hands the currently rendered Legendary idle angle directly to pointer drag', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const pointerDown = modal.slice(
      modal.indexOf('function handlePointerDown('),
      modal.indexOf('function handleAnyPointerInteraction('),
    );

    expect(getJourneyCardRenderedRotateYAngle('rotateY(-21.6deg)')).toBe(-21.6);
    expect(getJourneyCardRenderedRotateYAngle(
      'matrix3d(0.8660254, 0, -0.5, 0, 0, 1, 0, 0, 0.5, 0, 0.8660254, 0, 0, 0, 0, 1)',
    )).toBeCloseTo(30, 5);
    expect(getJourneyCardRenderedRotateYAngle(
      'matrix3d(0.8660254, 0, 0.5, 0, 0, 1, 0, 0, -0.5, 0, 0.8660254, 0, 0, 0, 0, 1)',
    )).toBeCloseTo(-30, 5);
    expect(getJourneyCardRenderedRotateYAngle('none')).toBeNull();
    expect(pointerDown).toContain('const dragHandoffAngle = readLegendaryIdleHandoffAngle();');
    expect(pointerDown.indexOf('const dragHandoffAngle = readLegendaryIdleHandoffAngle();'))
      .toBeLessThan(pointerDown.indexOf('stopSurfaceIdle();'));
    expect(pointerDown.indexOf('stopSurfaceIdle();'))
      .toBeLessThan(pointerDown.indexOf('setRotorAngle(dragHandoffAngle);'));
    expect(pointerDown).toContain('dragStartAngle = dragHandoffAngle;');
    expect(pointerDown).not.toContain('setRotorAngle(stableRotorAngle());');
  });

  test('keeps enter and return as exact reverse turns with a centered physical edge', () => {
    expect(getJourneyCardFlightFlipAngle(0, 'enter')).toBe(0);
    expect(getJourneyCardFlightFlipAngle(0.32, 'enter')).toBe(0);
    expect(getJourneyCardFlightFlipAngle(0.5, 'enter')).toBe(-90);
    expect(getJourneyCardFlightFlipAngle(0.68, 'enter')).toBe(-180);
    expect(getJourneyCardFlightFlipAngle(1, 'enter')).toBe(-180);

    expect(getJourneyCardFlightFlipAngle(0, 'return')).toBe(-180);
    expect(getJourneyCardFlightFlipAngle(0.32, 'return')).toBe(-180);
    expect(getJourneyCardFlightFlipAngle(0.5, 'return')).toBe(-90);
    expect(getJourneyCardFlightFlipAngle(0.68, 'return')).toBe(0);
    expect(getJourneyCardFlightFlipAngle(1, 'return')).toBe(0);
    for (const progress of [0, 0.1, 0.32, 0.5, 0.68, 0.9, 1]) {
      expect(getJourneyCardFlightFlipAngle(progress, 'return')).toBeCloseTo(
        -180 - getJourneyCardFlightFlipAngle(progress, 'enter'),
        8,
      );
    }
    expect(getJourneyCardFlipEdgeProgress(0, -180)).toBe(0.5);
    expect(getJourneyCardFlipEdgeProgress(36, 180)).toBeCloseTo(0.375, 8);
    expect(getJourneyCardFlipEdgeProgress(-216, -360)).toBeCloseTo(0.375, 8);
  });

  test('scrubs to the 80-percent handoff then completes exactly one physical flip', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    expect(JOURNEY_CARD_FLIP_DRAG_HANDOFF_VIEWPORT_RATIO).toBe(0.4);
    expect(JOURNEY_CARD_FLIP_DRAG_RELEASE_VIEWPORT_RATIO).toBe(0.1);
    expect(shouldCommitJourneyCardReleasedDrag(38.9, 390)).toBe(false);
    expect(shouldCommitJourneyCardReleasedDrag(39, 390)).toBe(true);
    expect(shouldCommitJourneyCardReleasedDrag(-39, 390)).toBe(true);
    expect(shouldCommitJourneyCardReleasedDrag(39, 390, -1)).toBe(false);
    expect(shouldCommitJourneyCardReleasedDrag(-39, 390, -1)).toBe(true);
    expect(JOURNEY_CARD_FLIP_DRAG_SCRUB_MAX_DEG).toBe(72);
    expect(getJourneyCardDragFlipAngle(0, -128, 400)).toBeCloseTo(-57.6, 8);
    expect(getJourneyCardDragFlipAngle(0, -160, 400)).toBe(-72);
    expect(getJourneyCardDragFlipAngle(0, -240, 400)).toBe(-72);
    expect(getJourneyCardDragFlipAngle(-180, 128, 400)).toBeCloseTo(-122.4, 8);
    expect(getJourneyCardDragFlipAngle(-180, 160, 400)).toBe(-108);
    const interactiveFlip = modal.slice(
      modal.indexOf('const animateInteractiveFlip = async'),
      modal.indexOf('const startEntry = async'),
    );
    expect(interactiveFlip).toContain("rotor.animate(keyframes, { duration, easing: 'linear' })");
    expect(interactiveFlip).toContain('easing: JOURNEY_CARD_FLIP_RECOIL_EASE');
    expect(interactiveFlip).toContain(
      'if (flipRecoilAnimation) {\n      flipRecoilAnimation.cancel();\n      flipRecoilAnimation = null;\n      setRotorAngle(stableRotorAngle());\n    }',
    );
    expect(interactiveFlip).toContain(
      '...JOURNEY_CARD_FLIP_RECOIL_STOPS.map((stop): Keyframe => ({',
    );
    expect(interactiveFlip).toContain('to + direction * stop.degrees');
    expect(interactiveFlip).toContain('flipRecoilAnimation = recoil');
    expect(interactiveFlip).toContain('flipping = false');
    expect(interactiveFlip).toContain('preferredDirection?: -1 | 1');
    expect(interactiveFlip).toContain('Math.sign(candidate - from) === preferredDirection');
    expect(interactiveFlip).toContain('animation.currentTime');
    expect(interactiveFlip).toContain('requestAnimationFrame(watchPhysicalEdge)');
    expect(interactiveFlip).not.toContain('setTimeout');
    expect(getJourneyCardFlipFaceForAngle(0)).toBe('front');
    expect(getJourneyCardFlipFaceForAngle(-89)).toBe('front');
    expect(getJourneyCardFlipFaceForAngle(-91)).toBe('back');
    expect(getJourneyCardFlipFaceForAngle(-180)).toBe('back');
    expect(getJourneyCardFlipFaceForAngle(-269)).toBe('back');
    expect(getJourneyCardFlipFaceForAngle(-271)).toBe('front');
    expect(getJourneyCardFlipFaceForAngle(Number.NaN)).toBe('front');
    const pointerMove = modal.slice(
      modal.indexOf('function handlePointerMove('),
      modal.indexOf('function finishPointer('),
    );
    expect(pointerMove).not.toContain('releasePointerCapture');
    expect(pointerMove).toContain("impactShell.style.translate = `${translateX.toFixed(2)}px 0`");
    expect(pointerMove).toContain('getJourneyCardDragFlipAngle(dragStartAngle, deltaX, dragViewportWidth)');
    expect(pointerMove).toContain('dragFlipProgress = clamp01(Math.abs(deltaX) / handoffDistance)');
    expect(pointerMove).toContain('if (dragFlipCommitted) return;');
    expect(pointerMove).toContain('direction !== dragAllowedDirection');
    expect(pointerMove).toContain('dragStartX = dragLatestX;');
    expect(pointerMove).toContain("dragAllowedDirection = committedDirection === -1 ? 1 : -1;");
    expect(pointerMove).toContain("void animateInteractiveFlip(stableFace === 'front' ? 'back' : 'front')");
    expect(modal).toContain('dragPreviewSettleAnimation?.cancel()');
    expect(modal).toContain('visibleRotorTransform');
    expect(modal).not.toContain('disposeSpatialMotion');
    expect(modal).not.toContain('currentTranslateX');
    expect(modal).toContain('if (flipping && flipAnimation)');
    expect(modal).toContain('if (impactAnimation || dragPreviewSettleAnimation)');
    expect(interactiveFlip).toContain('impactAnimation || dragPreviewSettleAnimation');
    expect(modal).toContain('impactAnimation || dragPreviewSettleAnimation');
    const pointerRelease = modal.slice(
      modal.indexOf('function finishPointer('),
      modal.indexOf('function handlePointerUp('),
    );
    expect(pointerRelease).toContain('const fromTranslate = impactShell.style.translate');
    expect(pointerRelease).toContain("void animateInteractiveFlip(targetFace, targetFace === 'back' ? 1 : -1)");
    expect(pointerRelease).toContain("{ translate: 'none' }");
    expect(pointerRelease).toContain('const committedFlipInFlight = allowCommit && dragFlipCommitted;');
    expect(pointerRelease).toContain('const shouldCommitReleasedDrag = !flipping');
    expect(pointerRelease).toContain('shouldCommitJourneyCardReleasedDrag(deltaX, dragViewportWidth, dragAllowedDirection)');
    expect(pointerRelease).toContain("if (shouldCommitReleasedDrag) {");
    expect(pointerRelease).not.toContain('setStableFace(committedFace)');
    expect(pointerRelease).toContain('Number(previewAnimation.currentTime ?? 0) / settleDuration');
    expect(pointerRelease).toContain('const settleAngle = previewFromAngle + (previewToAngle - previewFromAngle) * progress;');
    expect(pointerRelease).toContain('setPaintFaceForAngle(settleAngle);');
    expect(pointerRelease).toContain("if (flipping) {\n        impactShell.style.translate = 'none';\n        return;");
  });

  test('uses a dominant up-or-down gesture to run the canonical dismiss', () => {
    expect(JOURNEY_CARD_DISMISS_DRAG_COMMIT_RATIO).toBe(0.22);
    expect(JOURNEY_CARD_DISMISS_DRAG_MIN_PX).toBe(88);
    expect(JOURNEY_CARD_DISMISS_DRAG_MAX_PX).toBe(140);
    expect(getJourneyCardDismissDragDistance(300)).toBe(88);
    expect(getJourneyCardDismissDragDistance(500)).toBe(110);
    expect(getJourneyCardDismissDragDistance(1000)).toBe(140);
    expect(isJourneyCardVerticalDismissGesture(10, 60)).toBe(true);
    expect(isJourneyCardVerticalDismissGesture(10, -60)).toBe(true);
    expect(isJourneyCardVerticalDismissGesture(60, 10)).toBe(false);

    const modal = read('src/modules/journey-card-overlay-modal.ts');
    expect(modal).toContain("dragAxis: 'horizontal' | 'vertical' | null");
    expect(modal).toContain("dragAxis === 'vertical'");
    expect(modal).toContain("void beginClose('dismiss')");
    const pointerMove = modal.slice(
      modal.indexOf('function handlePointerMove('),
      modal.indexOf('function finishPointer('),
    );
    expect(pointerMove).toContain('getIosResistedModalVerticalDelta');
    expect(pointerMove).toContain('translate3d(0, ${boundedDeltaY}px, 0)');
    expect(pointerMove).not.toContain("beginClose('dismiss')");
    const pointerRelease = modal.slice(
      modal.indexOf('function finishPointer('),
      modal.indexOf('function handlePointerUp('),
    );
    expect(pointerRelease).toContain("void beginClose('dismiss')");
  });

  test('restores the previous randomized opposing card and modal tilt profile', () => {
    const left = createJourneyCardOverlayTiltProfile((() => {
      const samples = [0, 0, 0];
      return () => samples.shift() ?? 0;
    })());
    const right = createJourneyCardOverlayTiltProfile((() => {
      const samples = [1, 1, 1];
      return () => samples.shift() ?? 1;
    })());

    expect(left).toEqual({ cardRotationDeg: -4.75, modalRotationDeg: 2 });
    expect(right).toEqual({ cardRotationDeg: 6.25, modalRotationDeg: -3.25 });
  });

  test('alternates drag and tap coaches after each five-second idle window', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');

    expect(JOURNEY_CARD_FLIP_IDLE_COACH_DELAY_MS).toBe(5000);
    expect(JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS).toBe(2100);
    expect(modal).not.toContain('Tap or swipe to turn');
    expect(modal).toContain("renderIdleCoachLine('DRAG TO FLIP', 0)");
    expect(modal).toContain("renderIdleCoachLine('TAP TO FLIP', 0)");
    expect(modal).toContain("let nextIdleCoachMode: 'drag' | 'tap' = 'drag';");
    expect(modal).toContain("nextIdleCoachMode = coachMode === 'drag' ? 'tap' : 'drag';");
    expect(modal).toContain("stage.classList.add('is-idle-coach', `is-idle-coach-${coachMode}`)");
    expect(modal).toContain('class="journey-card-flip-idle-hand"');
    expect(modal).toContain('idleCoachCardAnimation = cardAnimation;');
    expect(modal).toContain('idleCoachHandAnimation = handAnimation;');
    const idleCoach = modal.slice(
      modal.indexOf('const scheduleIdleCoach = () => {'),
      modal.indexOf('const cancelMotion = () => {'),
    );
    expect(idleCoach).toContain("const cardAnimation = coachMode === 'drag'\n        ? impactShell.animate([");
    expect(idleCoach).not.toContain('rotor.animate(');
    expect(idleCoach).not.toContain('stopLegendaryIdleHolo();');
    expect(idleCoach).not.toContain('startLegendaryIdleHolo();');
    expect(modal).toContain("{ transform: 'scale(1.06)', offset: 0.57 }");
    expect(modal).toContain("stage.addEventListener('pointerdown', handleAnyPointerInteraction, true)");
    expect(modal).toContain("stage.removeEventListener('pointerdown', handleAnyPointerInteraction, true)");
    expect(css).toMatch(/\.journey-card-flip-title-section > h2 \{[\s\S]*?font-size: 32px;/);
    expect(css).toMatch(/\.journey-card-flip-title-section \{[\s\S]*?margin: 20px 0 24px;/);
    expect(css).toMatch(/\.journey-card-flip-stats \{[\s\S]*?margin-bottom: 24px;/);
    expect(css).toContain('.journey-card-flip-turn-control {');
    expect(css).toContain('.journey-card-flip-overlay.is-idle-coach .journey-card-flip-idle-hand {');
    expect(css).toMatch(/\.journey-card-flip-idle-hand \{[\s\S]*?width: min\(36vw, 168px\);/);
    expect(modal).toContain('srcset="./assets/hand-pointer@2x.png 2x, ./assets/hand-pointer@3x.png 3x"');
    expect(css).toContain('.journey-card-flip-overlay.is-idle-coach-drag .journey-card-flip-idle-message.is-drag');
    expect(css).toContain('.journey-card-flip-overlay.is-idle-coach-tap .journey-card-flip-idle-message.is-tap');
    expect(modal).toContain('mountGameplaySheetClose(backShell, () =>');
    expect(modal).toContain("stage.classList.toggle('is-flipping-to-front', targetFace === 'front')");
    expect(modal).toContain("stage.classList.toggle('is-flipping-to-back', targetFace === 'back')");
    expect(modal).toContain("stage.classList.add('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back', 'is-prepainting')");
    expect(modal.match(/stage\.classList\.remove\('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back'\)/g)).toHaveLength(2);
    expect(modal).toContain("stage.classList.add('is-flipping-to-front');\n    stage.classList.add('is-exiting', 'is-backdrop-exiting');");
    expect(css).toContain('.journey-card-flip-overlay.is-flipping-to-front');
    expect(css).not.toContain('.journey-card-flip-overlay.is-flipping-to-front\n  .journey-card-flip-back-shell > .gameplay-sheet-close');
    expect(modal).toContain('class="cc-gameplay-modal-paper-shell journey-card-flip-paper"');
    expect(css).toMatch(/\.journey-card-flip-paper \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/);
    expect(css).toMatch(/\.journey-card-flip-card-host \{[\s\S]*?filter: none;/);
    expect(css).toMatch(/\.journey-card-overlay-portaled-card > \.journey-card-ribbon \{[\s\S]*?top: -8px;[\s\S]*?right: -8px;[\s\S]*?width: 64\.8%;[\s\S]*?max-width: none;/);
    expect(css).toMatch(/@media \(max-width: 768px\) \{[\s\S]*?\.journey-card-overlay-portaled-card > \.journey-card-ribbon \{[\s\S]*?width: 59\.04%;/);
    expect(css).toMatch(/@media \(max-width: 768px\) \{[\s\S]*?\.journey-card-ribbon \{[\s\S]*?width: 63px;[\s\S]*?right: -8px;/);
    expect(css).toMatch(/\.journey-card-ribbon-label \{[\s\S]*?color: #fff3dc;[\s\S]*?opacity: 0\.9;[\s\S]*?font-size: 13cqw;[\s\S]*?font-weight: 800;[\s\S]*?translate3d\(calc\(-50% \+ 8px\), calc\(-50% - 9px\), 0\) rotate\(41deg\);/);
    expect(css).toMatch(/\.journey-card-ribbon-image \{[\s\S]*?filter: none;/);
    expect(css).toMatch(/\.journey-card-overlay-portaled-card > \.journey-card-ribbon > \.journey-card-ribbon-image \{[\s\S]*?filter: drop-shadow\(0 5px 5\.7px #e2774a\);/);
    expect(css).toMatch(/\.journey-board-card > \.journey-card-ribbon > \.journey-card-ribbon-label \{[\s\S]*?font-weight: 700;[\s\S]*?translate3d\(calc\(-50% \+ 11px\), calc\(-50% - 10px\), 0\) rotate\(41deg\);/);
    expect(css).toMatch(/\.journey-card-overlay-portaled-card > \.journey-card-ribbon > \.journey-card-ribbon-label \{[\s\S]*?font-size: 8\.3cqw;[\s\S]*?translate3d\(calc\(-50% \+ 32px\), calc\(-50% - 33px\), 0\) rotate\(41deg\);/);
    expect(css).toMatch(/\.journey-card-ribbon-shimmer \{[\s\S]*?filter: brightness\(1\.32\) saturate\(1\.06\);[\s\S]*?-webkit-mask-image: linear-gradient\(110deg,[\s\S]*?animation: journey-card-ribbon-shimmer 3s ease-in-out infinite;/);
    expect(modal).toContain("stage.classList.toggle(\n    'has-new-ribbon',\n    cardHost.querySelector('.journey-card-ribbon') !== null");
    expect(css).toMatch(/\.journey-card-flip-overlay\.has-new-ribbon \.journey-card-flip-shine \{[\s\S]*?display: none;/);
    expect(css).toMatch(/\.journey-card-overlay-portaled-card > \.journey-card-ribbon > \.journey-card-ribbon-shimmer \{[\s\S]*?animation-duration: 5\.1s;[\s\S]*?animation-iteration-count: 1;/);
    expect(css).toMatch(/\.journey-board-card\.has-new-ribbon::after \{[\s\S]*?animation: none !important;[\s\S]*?opacity: 0 !important;/);
    expect(css).not.toContain('.journey-card-flip-back-shell::after');
    expect(css).toMatch(/\.journey-card-flip-paper::after \{[\s\S]*?inset: 0;[\s\S]*?background-size: calc\(100% \+ 12px\) calc\(100% \+ 16px\);/);
    expect(css).not.toContain('inset: 0 -6px -16px');
    expect(modal).toContain("stage.classList.add('is-visible');\n    backdrop.style.opacity = '1';");
    expect(modal).not.toContain('smoothstep((rotationProgress - 0.5) / 0.5)');
    expect(modal).toContain("stage.classList.add('is-exiting', 'is-backdrop-exiting')");
    expect(css).toMatch(/\.journey-card-flip-backdrop \{[\s\S]*?transition: opacity 520ms/);
    expect(css).toMatch(/\.journey-card-flip-front \{[\s\S]*?drop-shadow\(0 14px 19px rgba\(165, 124, 98, 0\.86\)\);[\s\S]*?transition: filter var\(--journey-card-exit-neutral-duration, 520ms\) linear;/);
    expect(css).not.toContain('.journey-card-flip-overlay[data-paint-face="front"]\n  .journey-card-flip-front {');
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-exiting \.journey-card-flip-front \{[\s\S]*?drop-shadow\(0 14px 19px rgba\(165, 124, 98, 0\)\);/);
    expect(css).toMatch(/\.journey-card-flip-paper \{[\s\S]*?transition: box-shadow var\(--journey-card-exit-neutral-duration, 520ms\) linear;[\s\S]*?box-shadow: 0 14px 36px 0 rgba\(165, 124, 98, 0\.86\);/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-exiting \.journey-card-flip-paper \{[\s\S]*?box-shadow: 0 14px 36px 0 rgba\(165, 124, 98, 0\);[\s\S]*?filter: none;/);
    expect(css).toMatch(/\.journey-card-flip-back-shell::before \{[\s\S]*?transition: opacity var\(--journey-card-exit-neutral-duration, 520ms\) linear;/);
    expect(css).not.toContain('.journey-card-flip-overlay.is-exiting .journey-card-flip-back-shell {');
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-exiting \.journey-card-flip-idle-shell \{[\s\S]*?rotate: 0deg;[\s\S]*?--journey-card-exit-neutral-duration, 680ms[\s\S]*?transition-timing-function: linear;/);
    expect(modal).toContain('const neutralizeExitMotionOwners = (durationMs: number) => {');
    expect(modal).toContain("{ transform: idleTransform },\n        { transform: 'none' }");
    expect(modal).toContain("{ translate: poseTranslate, transform: poseTransform }");
    expect(modal).toContain('neutralizeExitMotionOwners(prefersReducedMotion ? 1 : exitNeutralDurationMs);');
    expect(modal).toContain("stage.style.setProperty('--journey-card-exit-neutral-duration', `${safeDurationMs}ms`)");
    expect(modal).toContain("{ duration: safeDurationMs, easing: 'linear', fill: 'forwards' }");
    expect(css).toContain('.journey-card-flip-overlay[data-paint-face="front"] .journey-card-flip-back');
    expect(css).toContain('.journey-card-flip-overlay[data-paint-face="back"] .journey-card-flip-front');
    expect(css).toMatch(/\.journey-card-flip-pose-shell\.cc-modal-pose-target \{[\s\S]*?translate3d\(0, 0, var\(--cc-modal-pose-z\)\)[\s\S]*?rotateY\(var\(--cc-modal-pose-ry\)\);/);
    expect(css).toMatch(/\.journey-card-flip-back-shell > \.gameplay-sheet-close \{[\s\S]*?backface-visibility: hidden;/);
    expect(css).not.toContain('.journey-card-flip-overlay[data-face="back"]\n  .journey-card-flip-back-shell > .gameplay-sheet-close');
    expect(css).toContain('@keyframes journey-card-flip-idle-copy-lifecycle');
    expect(modal).toContain('class="journey-card-flip-idle-shell"');
    expect(modal).toContain("stage.classList.add('is-surface-idle')");
    expect(css).toContain('animation: cc-gameplay-modal-idle-float 6.8s linear infinite both;');
    expect(css).toContain('rotate: var(--journey-card-flip-front-tilt, -5.5deg);');
    expect(css).toContain('rotate: var(--journey-card-flip-back-tilt, 2.6deg);');
    expect(css).toContain('.journey-card-flip-overlay.is-flipping-to-back .journey-card-flip-idle-shell');
    expect(css).toContain('.journey-card-flip-overlay.is-flipping-to-front .journey-card-flip-idle-shell');
    expect(css).not.toContain('.journey-card-flip-overlay.is-entering .journey-card-flip-idle-shell');
  });

  test('animates stats only on initial modal entry, never again during interactive flips', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');

    expect(modal).toContain('createDetailModalStatsEnterDelays(backContentElements.length)');
    expect(modal).toContain('getDetailModalStatsEnterTotalDuration(backContentElements.length)');
    expect(JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE).toBe(0.5);
    expect(modal).toContain("element.classList.add('is-content-entering')");
    expect(modal).toContain('void ctaController?.enter();');
    expect(modal).toContain('if (angle <= -90) startBackContentEnter();');
    expect(modal).toContain('startBackContentExit(prefersReducedMotion ? 0 : returnEdgeAtMs);');
    expect(css).toMatch(/\.journey-card-flip-stat\.is-content-exiting,[\s\S]*?animation-name: detailStatPopOut;[\s\S]*?animation-duration: 0\.2s;/);
    const interactiveFlip = modal.slice(
      modal.indexOf("const animateInteractiveFlip = async"),
      modal.indexOf('const startEntry = async'),
    );
    expect(interactiveFlip).not.toContain('startBackContentEnter(');
    expect(interactiveFlip).not.toContain('primeBackContentForEnter(');
    expect(css).toMatch(/\.journey-card-flip-stat\.is-content-entering,[\s\S]*?animation-name: detailStatPopOut;[\s\S]*?animation-duration: 0\.2s;[\s\S]*?animation-direction: reverse;/);
  });

  test('keeps one frame owner and two identical faces without a sensor-motion owner', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');

    expect(modal.match(/class="journey-card-flip-rotor"/g)).toHaveLength(1);
    expect(modal.match(/journey-card-flip-face journey-card-flip-(?:front|back)/g)).toHaveLength(2);
    expect(modal).toContain('options.origin.mountInto(cardHost);');
    expect(modal).toContain('captureJourneyCardGeometry(frame, frame)');
    expect(modal).not.toContain('journey-card-overlay-depth-shell');
    expect(modal).not.toContain('beginDepthSwap');
    expect(modal).not.toContain('is-swapping-card-forward');
    expect(css).toContain('.journey-card-flip-face {');
    expect(css).toContain('position: absolute;');
    expect(css).toContain('inset: 0;');
    expect(css).toContain('backface-visibility: hidden;');
    expect(css).toContain('-webkit-backface-visibility: hidden;');
    expect(css).toContain('.journey-card-flip-back {');
    expect(css).toContain('rotateY(-180deg) translateZ(0.6px)');
    expect(css).toMatch(/\[data-paint-face="front"\] \.journey-card-flip-back,[\s\S]*?\[data-paint-face="back"\] \.journey-card-flip-front \{[\s\S]*?visibility: hidden;/);
    expect(css).toMatch(/\.journey-card-flip-card-host > \.journey-card-overlay-portaled-card \{[\s\S]*?border-radius: var\(--journey-card-flip-radius\);[\s\S]*?clip-path: inset\(0 round var\(--journey-card-flip-radius\)\);/);
    expect(modal).toContain('rotor.style.transform = `rotateY(${angle}deg)`;');
    expect(modal).toContain('const deltaX = event.clientX - dragStartX;');
    expect(modal).toContain('Math.min(4, dragCardRect.left - horizontalSafeInset)');
    expect(modal).toContain('Math.min(4, dragViewportWidth - horizontalSafeInset - dragCardRect.right)');
    expect(modal).toContain('Math.min(dragHorizontalMaxX, deltaX * 0.12)');
    expect(modal).toContain('let dragStartAngle = 0;');
    expect(modal).toContain('let dragFlipProgress = 0;');
    expect(modal).toContain('let dragFlipCommitted = false;');
    expect(modal).not.toContain('if (Math.abs(deltaX) >= commitDistance) {');
    expect(modal).not.toContain('dragFlipZone');
    expect(modal).toContain('rotor.releasePointerCapture(event.pointerId)');
    expect(modal).toContain('const deltaY = event.clientY - dragStartY;');
    expect(modal).not.toContain('mountJourneyCardFlipSpatialMotion');
    expect(modal).not.toContain('DeviceOrientationEvent');
  });

  test('shares flight progress with the flip and preserves Play landing choreography', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    expect(JOURNEY_CARD_FLIP_ENTER_DURATION_MS).toBe(520);
    expect(JOURNEY_CARD_FLIP_SNAP_DURATION_MS).toBe(200);
    expect(JOURNEY_CARD_FLIP_RECOIL_DURATION_MS).toBe(260);
    expect(JOURNEY_CARD_FLIP_RECOIL_EASE).toBe('cubic-bezier(0.45, 0, 0.55, 1)');
    expect(JOURNEY_CARD_FLIP_FINAL_SETTLE_EASE).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(JOURNEY_CARD_FLIP_RECOIL_STOPS).toEqual([
      { offset: 0.38, degrees: 12, easing: JOURNEY_CARD_FLIP_FINAL_SETTLE_EASE },
    ]);
    expect(JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS).toBe(100);
    expect(JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS).toBe(500);
    expect(JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS).toBe(120);
    expect(JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS).toBe(400);
    expect(JOURNEY_CARD_PLAY_RETURN_DURATION_MS).toBe(1120);
    expect(modal).toContain("getJourneyCardFlightFlipAngle(progress, 'enter')");
    expect(modal).toContain("getJourneyCardFlightFlipAngle(travelProgress, 'return')");
    expect(modal).toContain('options.onPlayCardReturnStart?.();');
    expect(modal).toContain('options.onPlayCardExitStart?.();');
    expect(modal).toContain('options.onPlayCardExitComplete?.();');
    expect(modal).toContain('await waitForPaints(2);');
    expect(modal).toContain('if (didLandAtOrigin) options.onDismissCardLanded?.();');
    const entryStart = modal.indexOf('const startEntry = async () => {');
    const spatialEnterStart = modal.indexOf('spatialFlight = startJourneyCardSpatialFlight({', entryStart);
    expect(spatialEnterStart).toBeGreaterThan(entryStart);
    expect(modal.slice(entryStart, spatialEnterStart)).not.toContain('await ');
  });

  test('does no layout/style read during pointer movement and excludes real controls', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const pointerMove = modal.slice(
      modal.indexOf('function handlePointerMove'),
      modal.indexOf('function finishPointer'),
    );
    expect(pointerMove).not.toContain('getBoundingClientRect');
    expect(pointerMove).not.toContain('getComputedStyle');
    expect(pointerMove).not.toContain('offsetWidth');
    expect(pointerMove).not.toContain('offsetHeight');
    expect(modal).toContain("target.closest('button, a, input, select, textarea')");
    expect(modal).toContain("rotor.addEventListener('pointercancel', handlePointerCancel)");
    expect(modal).toContain("window.addEventListener('pagehide', handleRouteChange)");
    expect(modal).toContain("window.removeEventListener('pagehide', handleRouteChange)");
  });

  test('profiles modal-open phases with one bounded RAF owner and one native summary', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const manager = read('src/modules/journey-boards-manager.ts');
    expect(modal).toContain("emitNativeConsoleDiagnostic('[CC_JOURNEY_CARD_OPEN]', 'summary'");
    expect(modal).toContain('if (openProfileLongFrames.length < 8)');
    expect(modal).toContain("markOpenProfile('geometry-read-start')");
    expect(modal).toContain("markOpenProfile('geometry-read-complete')");
    expect(modal).toContain("markOpenProfile('dom-appended')");
    expect(modal).toContain("markOpenProfile('flight-started')");
    expect(modal).toContain("'flight-front-static'");
    expect(modal).toContain("'flight-front-turn'");
    expect(modal).toContain("'flight-back-turn'");
    expect(modal).toContain("'flight-back-settle'");
    expect(modal).toContain("markOpenProfile('controls-mounted')");
    expect(modal).toContain("emitOpenProfile('disposed-before-stable')");
    expect(manager).toContain("markOpenProfile('world-paused')");
    expect(manager).toContain('openProfileManagerMarks,');
  });

  test('prepaints both exact modal faces before hiding the live Journey card and starting flight', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const manager = read('src/modules/journey-boards-manager.ts');
    const portal = read('src/modules/journey-card-portal-transition.ts');
    const css = read('src/collectibles-screen.css');
    const prepareSource = modal.split('const prepareAndStartEntry = async () => {')[1]
      ?.split('void prepareAndStartEntry();')[0] ?? '';

    expect(css).toMatch(/\.journey-card-flip-overlay\.is-prepainting \{[\s\S]*?opacity: 0\.001;[\s\S]*?visibility: visible;[\s\S]*?pointer-events: none;[\s\S]*?transition: none;/);
    expect(prepareSource).toContain('await waitForPaints(1)');
    expect(prepareSource).toContain('primeJourneyCardSpatialFlight(');
    expect(prepareSource).toContain('left: destination.centerX - destination.width / 2');
    expect(prepareSource).toContain('waitForModalImageReady(image)');
    expect(prepareSource).toContain("markOpenProfile('prepaint-front-face')");
    expect(prepareSource).toContain("markOpenProfile('prepaint-back-face')");
    const activateIndex = prepareSource.indexOf('options.origin.activatePortal()');
    const flightIndex = prepareSource.indexOf('const entryPromise = startEntry(destination)');
    const revealIndex = prepareSource.indexOf("stage.classList.remove('is-prepainting')");
    expect(activateIndex).toBeGreaterThanOrEqual(0);
    expect(flightIndex).toBeGreaterThan(activateIndex);
    expect(revealIndex).toBeGreaterThan(flightIndex);
    expect(portal).toContain('transformOriginPrimed?: boolean');
    expect(modal).toContain('export function preloadJourneyCardOverlayAssets()');
    expect(manager).toContain('void preloadJourneyCardOverlayAssets();');
  });

  test('profiles dismiss, scroll and rapid reopen as one bounded native summary', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const manager = read('src/modules/journey-boards-manager.ts');
    const profiler = read('src/modules/journey-card-interaction-profiler.ts');
    expect(profiler).toContain("emitNativeConsoleDiagnostic('[CC_JOURNEY_CARD_CHAIN]', 'summary'");
    expect(profiler).toContain('const PROFILE_DURATION_MS = 8000');
    expect(profiler).toContain('if (this.longFrames.length > MAX_LONG_FRAMES)');
    expect(manager).toContain('this.journeyCardInteractionProfiler.begin(board.id)');
    expect(manager).toContain("this.journeyCardInteractionProfiler.mark(`runtime-${snapshot.state}`)");
    expect(manager).toContain("this.journeyCardInteractionProfiler.dispose('manager-cleanup')");
    expect(modal).toContain("options.onPerformancePhase?.('dismiss-style-snapshot-start')");
    expect(modal).toContain("options.onPerformancePhase?.('dismiss-return-flight-start')");
    expect(modal).toContain("options.onPerformancePhase?.('dismiss-origin-stable-paints')");
    expect(modal).toContain("options.onPerformancePhase?.('dismiss-cleanup-complete')");
  });

  test('removes expensive settled shadows only during the active card entry flight', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-entering \.journey-card-flip-front \{[\s\S]*?filter: none;[\s\S]*?transition: none;/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-entering \.journey-card-flip-paper \{[\s\S]*?box-shadow: none;[\s\S]*?transition: none;/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-entering \.journey-card-flip-back-shell::before \{[\s\S]*?animation: none;[\s\S]*?box-shadow: none;[\s\S]*?opacity: 0;[\s\S]*?transition: none;/);
    expect(css).toMatch(/\.journey-card-flip-front \{[\s\S]*?drop-shadow\(0 14px 19px rgba\(165, 124, 98, 0\.86\)\)/);
    expect(css).toMatch(/\.journey-card-flip-paper \{[\s\S]*?box-shadow: 0 14px 36px 0 rgba\(165, 124, 98, 0\.86\)/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-settled:not\(\.is-exiting\) \.journey-card-flip-front \{[\s\S]*?transition-duration: 180ms;/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-settled:not\(\.is-exiting\) \.journey-card-flip-paper \{[\s\S]*?transition-duration: 180ms;/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-settled:not\(\.is-exiting\) \.journey-card-flip-back-shell::before \{[\s\S]*?transition-duration: 180ms;/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-exiting \.journey-card-flip-front \{[\s\S]*?drop-shadow\(0 14px 19px rgba\(165, 124, 98, 0\)\);/);
    expect(modal).toContain('JOURNEY_CARD_SHADOW_EARLY_REVEAL_MS = 200');
    expect(modal).toContain('progress >= shadowRevealProgress');
    expect(modal).toContain("stage.classList.add('is-shadow-ready')");
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-entering\.is-shadow-ready \.journey-card-flip-front \{[\s\S]*?transition: filter 180ms linear;/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-entering\.is-shadow-ready \.journey-card-flip-paper \{[\s\S]*?transition: box-shadow 180ms linear;/);
  });

  test('reveals a bottom-only settled Unit contact shadow after the landing squeeze', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const css = read('src/collectibles-screen.css');
    const settledShadowRule = css.match(
      /#journey-boards-container\s+\.journey-board-card\.unlocked\.journey-board-card-settled-shadow \{([\s\S]*?)\n\}/,
    )?.[1] ?? '';

    expect(settledShadowRule).toContain('filter: none !important;');
    expect(settledShadowRule).toContain('transition-property: transform;');
    expect(settledShadowRule).not.toContain('will-change');
    expect(settledShadowRule).not.toContain('animation');
    expect(css).toMatch(
      /\.journey-board-card-settled-contact-shadow \{[\s\S]*?left: 20%;[\s\S]*?width: 60%;[\s\S]*?height: 20%;[\s\S]*?rgba\(126, 82, 57, 0\.6578\)[\s\S]*?rgba\(142, 94, 66, 0\.3542\)[\s\S]*?filter: blur\(5px\);/,
    );
    expect(css).toMatch(
      /\.journey-board-card\.unlocked\.journey-board-card-settled-shadow:not\(\.journey-board-card-return-placeholder\):not\(\.journey-board-card-return-landing\)[\s\S]*?\+ \.journey-board-card-settled-contact-shadow \{[\s\S]*?opacity: 1;/,
    );
    expect(css).toMatch(
      /\.journey-board-card\.unlocked\.journey-board-card-settled-shadow\.journey-board-card-return-landing \{[\s\S]*?filter: none !important;/,
    );

    const landingBounce = manager.slice(
      manager.indexOf('private playOverlayCardLandingBounce('),
      manager.indexOf('private stopOverlayCardLandingBounce('),
    );
    expect(landingBounce).toContain("card.classList.add('journey-board-card-return-landing')");
    expect(landingBounce.indexOf("card.classList.remove('journey-board-card-return-landing')"))
      .toBeLessThan(landingBounce.indexOf("card.classList.add('journey-board-card-settled-shadow')"));

    const stopLandingBounce = manager.slice(
      manager.indexOf('private stopOverlayCardLandingBounce('),
      manager.indexOf('private stopInterimBounce('),
    );
    expect(stopLandingBounce).toContain("card.classList.remove('journey-board-card-return-landing')");
    expect(stopLandingBounce).toContain("card.dataset.journeyCardViewed === 'true'");
    expect(manager).toContain("card.classList.add('journey-board-card-settled-shadow');\n            isViewed = true;");
    expect(manager).toContain("settledContactShadow.className = 'journey-board-card-settled-contact-shadow'");
    expect(manager).toContain("settledContactShadow.setAttribute('aria-hidden', 'true')");
  });

  test('freezes World paint while the modal owns depth, with exact origin leasing and board handoff', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const portal = read('src/modules/journey-card-portal-transition.ts');
    expect(manager).toContain('export const JOURNEY_CARD_OVERLAY_MODAL_EXPERIMENT_ENABLED = true');
    expect(manager.match(/this\.pauseJourneyWorldForCardOverlay\(/g)).toHaveLength(2);
    expect(manager.match(/this\.resumeJourneyWorldAfterCardOverlay\(/g)).toHaveLength(4);
    const overlayPause = manager.slice(
      manager.indexOf('private pauseJourneyWorldForCardOverlay('),
      manager.indexOf('private resumeJourneyWorldAfterCardOverlay('),
    );
    const overlayResume = manager.slice(
      manager.indexOf('private resumeJourneyWorldAfterCardOverlay('),
      manager.indexOf('private getCurrentJourneyForestAreas('),
    );
    expect(overlayPause).toContain('this.journeyWorldRuntime.openModal()');
    expect(overlayPause).toContain('this.journeyWorldRuntime.endInteractionSettle()');
    expect(overlayPause).not.toContain('this.cleanupJourneyAreaIdleAnimations(false)');
    expect(overlayPause).not.toContain('journeySpatialMotion.suspend()');
    expect(overlayResume).toContain('this.journeyWorldRuntime.beginInteractionSettle()');
    expect(overlayResume).toContain('this.journeyWorldRuntime.closeModal()');
    expect(manager).toContain("snapshot.state === 'scrolling' && this.journeyOverlayLandingCard");
    expect(manager).toContain("cleanupSmokeEffects?.(landingCard)");
    expect(manager).toContain("{ preserveRuntimeSettle: true }");
    expect(manager).toContain('this.trackTimeout(() => this.journeyWorldRuntime.endInteractionSettle(), 48)');
    expect(overlayResume).not.toContain('this.startJourneyAreaIdleAnimations(');
    expect(overlayResume).not.toContain('journeySpatialMotion.resumeJourneyWorld(');
    expect(manager).not.toContain('journeySpatialMotion');
    expect(manager).toContain('await this.startJourneyBoardFromOverlay(board, earlyJourneyExitPromise);');
    expect(manager).toContain('startOverlayPortaledCardJourneyExit(');
    expect(manager.match(/onPlayCardExitStart: \(\) =>/g)).toHaveLength(2);
    expect(manager.match(/onPlayCardExitComplete: \(\) =>/g)).toHaveLength(2);
    expect(manager).toContain('origin.prepareSettledLanding();');
    expect(manager).toContain('origin.captureLandingGeometry();');
    const rapidReopenLandingCleanup = 'this.stopOverlayCardLandingBounce(cardEl, { preserveRuntimeSettle: true });';
    expect(manager).toContain(rapidReopenLandingCleanup);
    expect(manager.indexOf(rapidReopenLandingCleanup)).toBeLessThan(
      manager.indexOf('acquireJourneyCardOriginLease(board.id, cardEl)'),
    );
    expect(manager.indexOf('JOURNEY_CARD_IDLE_BOUNCE.pauseCardMotionForTap(cardEl);')).toBeLessThan(
      manager.indexOf('acquireJourneyCardOriginLease(board.id, cardEl)'),
    );
    expect(manager.indexOf("gsap.set(cardEl, { clearProps: 'transform' });")).toBeLessThan(
      manager.indexOf('acquireJourneyCardOriginLease(board.id, cardEl)'),
    );
    expect(manager).toContain("gsap.set(card, { clearProps: 'transform' })");
    expect(manager).toContain("const phaseCanLaunch = this.journeyV700Phase === 'idle';");
    expect(manager).not.toContain("this.journeyV700Phase === 'entering'\n          || this.journeyV700Phase === 'idle'");
    expect(manager).toContain('wrapperOpacity >= 0.99');
    expect(manager).toContain('screenOpacity >= 0.99');
    expect(manager).toContain('if (stablePaintFrames >= 2)');
    const worldEnterCompletion = manager.slice(
      manager.indexOf("finishWorldEnterAudit('stale-after-enter')"),
      manager.indexOf("finishWorldEnterAudit('complete')"),
    );
    expect(worldEnterCompletion).not.toContain('restoreJourneyBoardCardBaseTransform');
    expect(worldEnterCompletion).not.toContain('restoreJourneyBoardCardVisualTarget');
    expect(worldEnterCompletion).not.toContain('restoreJourneyBoardCardInnerVisual');
    expect(manager).not.toContain('journey-board-local-stage-number');
    expect(manager).not.toContain('timeoutMs = 5200');
    const notReadyBranch = manager.slice(
      manager.indexOf('if (!targetElement) {'),
      manager.indexOf('const origin = acquireJourneyCardOriginLease', manager.indexOf('if (!targetElement) {')),
    );
    expect(notReadyBranch).not.toContain('cancelJourneyCardOverlayReturn');
    expect(manager).toContain('entryInitialOpacity: 1');
    expect(manager).toContain('preserveInitialTransform?: boolean');
    expect(manager).toContain("target.classList.contains('journey-board-card-wrapper') && !options.preserveInitialTransform");
    expect(manager).toContain('rampSeconds: preserveCurrentBoardTransforms ? 1.8 : undefined');
    expect(manager).toContain('entry.startTime += pausedFor;');
    expect(overlayResume).toContain('idleTickerCount: this.journeyAreaIdleTicker ? 1 : 0');
    expect(portal).toContain("card.classList.add('journey-board-card-return-placeholder')");
    expect(portal).toContain('portalVisual = card.cloneNode(true) as HTMLElement;');
    expect(portal).not.toContain('CC_CARD_LANDING');
  });

  test('keeps reduced motion deterministic and all lifecycle cleanup connected', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');
    expect(modal).toContain("prefersReducedMotion ? -180 : getJourneyCardFlightFlipAngle(progress, 'enter')");
    expect(modal).toContain("prefersReducedMotion ? 0 : getJourneyCardFlightFlipAngle(travelProgress, 'return')");
    expect(modal).not.toContain('disposeSpatialMotion');
    expect(modal).toContain('spatialFlight?.cancel();');
    expect(modal).toContain('flipAnimation?.cancel();');
    expect(modal).toContain('restoreEnvironment();');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.journey-card-flip-rotor,');
  });
});
