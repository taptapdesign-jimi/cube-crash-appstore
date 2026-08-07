import fs from 'node:fs';
import path from 'node:path';
import {
  buildJourneyCardOverlayModalViewModel,
  createJourneyCardOverlayTiltProfile,
  getJourneyCardOverlayExitTiming,
  getJourneyCardSwipeCoachCopy,
  JOURNEY_CARD_MODAL_EXIT_DURATION_MS,
  JOURNEY_CARD_STATS_EXIT_DURATION_MS,
  JOURNEY_CARD_STATS_EXIT_STAGGER_MS,
  JOURNEY_CARD_MODAL_ENTER_START_PROGRESS,
  JOURNEY_CARD_INITIAL_IMPACT_PROGRESS,
  JOURNEY_CARD_DEPTH_SWAP_SEPARATE_MS,
  JOURNEY_CARD_DEPTH_SWAP_SETTLE_MS,
  JOURNEY_CARD_DRAG_COMMIT_DISTANCE_PX,
  JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_X,
  JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_Y,
  JOURNEY_CARD_FLICK_VELOCITY_PX_PER_MS,
  JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS,
  JOURNEY_CARD_OVERLAY_EXIT_DURATION_MS,
  JOURNEY_CARD_REAR_EXIT_START_PROGRESS,
  JOURNEY_CARD_SPATIAL_FLIGHT_DURATION_MS,
  JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS,
  JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS,
  JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS,
  JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS,
  JOURNEY_CARD_PLAY_RETURN_DURATION_MS,
  JOURNEY_CARD_SPATIAL_RETURN_DURATION_MS,
  shouldCommitJourneyCardDepthDrag,
} from '../journey-card-overlay-modal';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Journey regular-card overlay experiment', () => {
  test('describes the visible surface instead of implying Stage navigation', () => {
    expect(getJourneyCardSwipeCoachCopy(false)).toEqual({
      ariaLabel: 'Swipe to view your card',
      lines: ['SWIPE TO VIEW', 'YOUR CARD'],
    });
    expect(getJourneyCardSwipeCoachCopy(true)).toEqual({
      ariaLabel: 'Swipe to view stats',
      lines: ['SWIPE TO VIEW', 'STATS'],
    });
  });

  test('randomizes one stable opposing card/modal tilt pair per presentation', () => {
    const leftSamples = [0.2, 0.4, 0.6];
    const leftCard = createJourneyCardOverlayTiltProfile(() => leftSamples.shift() ?? 0.5);
    expect(leftCard.cardRotationDeg).toBeLessThan(0);
    expect(leftCard.modalRotationDeg).toBeGreaterThan(0);
    expect(Math.abs(leftCard.cardRotationDeg)).toBeGreaterThanOrEqual(4.75);
    expect(Math.abs(leftCard.cardRotationDeg)).toBeLessThanOrEqual(6.25);
    expect(Math.abs(leftCard.modalRotationDeg)).toBeGreaterThanOrEqual(2);
    expect(Math.abs(leftCard.modalRotationDeg)).toBeLessThanOrEqual(3.25);

    const rightSamples = [0.8, 0.4, 0.6];
    const rightCard = createJourneyCardOverlayTiltProfile(() => rightSamples.shift() ?? 0.5);
    expect(rightCard.cardRotationDeg).toBeGreaterThan(0);
    expect(rightCard.modalRotationDeg).toBeLessThan(0);
    expect(Math.sign(rightCard.cardRotationDeg)).toBe(-Math.sign(rightCard.modalRotationDeg));
  });

  test('builds the intentionally minimal Stage stats model', () => {
    expect(buildJourneyCardOverlayModalViewModel(5, {
      highScore: 6775.9,
      longestCombo: 14.8,
    }, false)).toEqual({
      stageLabel: 'Stage 05',
      highScore: '6,775',
      longestCombo: '14',
      ctaLabel: 'Play',
      ctaAriaLabel: 'Play Stage',
    });

    expect(buildJourneyCardOverlayModalViewModel(0, {
      highScore: -20,
      longestCombo: Number.NaN,
    }, true)).toEqual({
      stageLabel: 'Stage 01',
      highScore: '0',
      longestCombo: '0',
      ctaLabel: 'Continue',
      ctaAriaLabel: 'Continue Stage',
    });
  });

  test('keeps the live Journey World mounted until Play or Continue', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const main = read('src/main.ts');
    const experimentBranch = manager.indexOf('if (JOURNEY_CARD_OVERLAY_MODAL_EXPERIMENT_ENABLED)');
    const legacyExit = manager.indexOf('const journeyExitPromise = this.startBoardAreaThenJourneyExit(board.id);', experimentBranch);

    expect(manager).toContain('export const JOURNEY_CARD_OVERLAY_MODAL_EXPERIMENT_ENABLED = true');
    expect(experimentBranch).toBeGreaterThan(-1);
    expect(legacyExit).toBeGreaterThan(experimentBranch);
    expect(manager.slice(experimentBranch, legacyExit)).toContain('openJourneyCardOverlayExperiment(board, cardEl, originLease!)');
    expect(manager.slice(experimentBranch, legacyExit)).toContain('return;');
    expect(manager).toContain('await this.startBoardAreaThenJourneyExit(boardId);');
    expect(manager.match(/onPlayCardExitStart: \(\) =>/g)).toHaveLength(2);
    expect(manager.match(/onPlayCardExitComplete: \(\) =>/g)).toHaveLength(2);
    expect(manager.match(/onPlayCardReturnStart: \(\) =>/g)).toHaveLength(2);
    expect(manager).toContain('startOverlayPortaledCardJourneyExit(');
    expect(manager).toContain('startJourneyWorldContentExitExcludingBoard(boardId)');
    expect(manager).toContain('const selectedUnitExit = this.animateBoardAreaExit(boardId, { skipCard: true });');
    expect(manager).toContain('await Promise.all([selectedUnitExit, contentExit, navExit, cardExitComplete]);');
    expect(manager).toContain('await (earlyJourneyExitPromise ?? this.startBoardAreaThenJourneyExit(boardId));');
    expect(manager).toContain('markJourneyCardOverlayReturn(boardId)');
    expect(manager).toContain('private journeyOverlayReturnInFlight:');
    expect(manager).toContain('if (active.boardId === boardId) return active.promise;');
    expect(manager).toContain('if (controller.didLandAtOrigin) completeJourneyCardOverlayReturn(boardId);');
    expect(manager).toContain('await this.waitForJourneyOverlayReturnReady(boardId)');
    expect(manager).toContain("const phaseCanLaunch = this.journeyV700Phase === 'entering'");
    expect(manager).toContain('wrapperOpacity >= 0.08');
    expect(manager).toContain('screenOpacity >= 0.04');
    expect(manager).not.toContain('stableFrames >= 6');
    expect(manager).toContain('JOURNEY_CARD_IDLE_BOUNCE.pauseCardMotionForTap(targetElement)');
    expect(manager).toContain('origin.captureLandingGeometry();');
    expect(manager).not.toContain('modalEnterStartProgress:');
    expect(manager).toContain('entryInitialOpacity,');
    expect(modal).toContain('rawProgress / 0.38');
    expect(modal).toContain("spatialShell.style.removeProperty('opacity')");
    expect(manager).toContain('Journey gameplay return replayed the exact card-to-modal enter');
    expect(manager).toContain('await this.startJourneyBoardFromOverlay(board, earlyJourneyExitPromise);');
    expect(manager).toContain('const BOARD_AREA_CARD_TAP_EXIT_PUNCH_SCALE = 1.14;');
    expect(manager).toContain('const BOARD_AREA_CARD_TAP_EXIT_PUNCH_DURATION = 0.12;');
    expect(manager).toContain("ease: 'back.out(2.4)'");
    expect(manager).toContain("card.classList.add('journey-card-tapping')");
    expect(manager).toContain("card.classList.remove('journey-card-tapping')");
    const portaledExit = manager.slice(
      manager.indexOf('private startOverlayPortaledCardJourneyExit'),
      manager.indexOf('private installInterimAreaHitTargets'),
    );
    expect(portaledExit).toContain('this.finalizeJourneyViewportAfterCoordinatedWorldExit(boardId);');
    expect(portaledExit).not.toContain('await this.startJourneyExitAnimation();');
    const coordinator = read('src/modules/journey-world-animation-coordinator.ts');
    const coordinatorExit = coordinator.split('public async exit(')[1]
      ?.split('private startIdle(')[0] ?? '';
    expect(coordinatorExit).toContain("target.classList.contains('journey-board-card-wrapper')");
    expect(coordinatorExit).toContain("wrapper.querySelector<HTMLElement>('.journey-board-card')");
    expect(coordinatorExit).toContain('const structuralTargets = unit.targets.filter');
    expect(coordinatorExit).toContain('y: motion.exit.y');
    expect(coordinatorExit).toContain('duration: motion.exit.duration');
    expect(coordinatorExit).toContain('ease: motion.exit.ease');
    expect(coordinatorExit).toContain('scale: 0');
    expect(coordinatorExit).toContain('ease: JOURNEY_V700_UNIT_CARD_EXIT_EASE');
    expect(coordinatorExit).toContain("opacity: 0, visibility: 'hidden'");
    expect(coordinatorExit).toContain('const position = index * stagger');
    expect(coordinatorExit).not.toContain('__ccJourneyToGameExitTween');
    expect(manager).toContain('cardWrapper.dataset.boardId = String(board.id);');
    expect(manager).toContain('cardWrapper.dataset.journeyAreaId = `board-${board.id}`;');
    expect(manager).toContain('world-card-membership-repaired');
    expect(manager).toContain('this.stopJourneyAreaIdleForTargets(this.getJourneyAreaElements(board.id));');
    const restoreHelpers = manager.slice(
      manager.indexOf('private restoreJourneyBoardCardVisualTarget'),
      manager.indexOf('private restoreJourneyBoardCardWrapperVisibility'),
    );
    expect(restoreHelpers.match(/if \(this\.isJourneyCardTapExitProtectedTarget\(target\)\) return;/g))
      .toHaveLength(2);
    expect(manager).not.toContain("presentation: 'restored-open'");
    expect(manager).not.toContain('autoDismissMs: 500');
    expect(manager).not.toContain('journey-board-card-return-placeholder');
    expect(manager).toContain('continueGameWithSavedState');
    expect(manager).toContain('startNewRunFromJourney');
    expect(main).toContain('const overlayReturnBoardId = getJourneyCardOverlayReturnBoardId();');
    expect(main).toContain('journeyBoardsManager.playJourneyOverlayReturnCard(overlayReturnBoardId)');
    expect(main).toContain("presentation: 'spatial-enter-and-hold'");
    expect(main).not.toContain('holdMs: 500');
  });

  test('matches Homepage distance/flick intent in every drag direction', () => {
    expect(JOURNEY_CARD_DRAG_COMMIT_DISTANCE_PX).toBe(100);
    expect(JOURNEY_CARD_FLICK_VELOCITY_PX_PER_MS).toBe(0.35);
    expect(JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_X).toBe(0.216);
    expect(JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_Y).toBe(0.252);
    expect(shouldCommitJourneyCardDepthDrag(100, 0, 0, 0)).toBe(true);
    expect(shouldCommitJourneyCardDepthDrag(0, -100, 0, 0)).toBe(true);
    expect(shouldCommitJourneyCardDepthDrag(20, 18, -0.36, 0)).toBe(true);
    expect(shouldCommitJourneyCardDepthDrag(18, 20, 0, 0.36)).toBe(true);
    expect(shouldCommitJourneyCardDepthDrag(32, -24, 0.12, -0.1)).toBe(false);
  });

  test('finishes the Stage modal exit before the reverse card flight lands', () => {
    const cardInFront = getJourneyCardOverlayExitTiming('dismiss', true);
    expect(cardInFront).toEqual({
      foregroundDurationMs: 620,
      rearStartDelayMs: 248,
      rearDurationMs: 320,
      backdropExitDurationMs: 372,
    });
    expect(cardInFront.rearStartDelayMs + cardInFront.rearDurationMs)
      .toBeLessThan(cardInFront.foregroundDurationMs);

    const modalInFront = getJourneyCardOverlayExitTiming('dismiss', false);
    expect(modalInFront).toEqual({
      foregroundDurationMs: 320,
      rearStartDelayMs: 128,
      rearDurationMs: 620,
      backdropExitDurationMs: 620,
    });
    expect(modalInFront.foregroundDurationMs)
      .toBeLessThan(modalInFront.rearStartDelayMs + modalInFront.rearDurationMs);

    expect(getJourneyCardOverlayExitTiming('play', true)).toEqual({
      foregroundDurationMs: 1120,
      rearStartDelayMs: 448,
      rearDurationMs: 320,
      backdropExitDurationMs: 672,
    });
    expect(getJourneyCardOverlayExitTiming('play', false)).toEqual({
      foregroundDurationMs: 320,
      rearStartDelayMs: 128,
      rearDurationMs: 1120,
      backdropExitDurationMs: 1120,
    });
  });

  test('uses the v915 benchmark owners with one lifecycle and repeatable depth toggle', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');

    for (const owner of [
      'cc-gameplay-modal-bounce-shell',
      'cc-gameplay-modal-flip-shell',
      'cc-gameplay-modal-idle-shell',
      'cc-gameplay-modal-paper-shell',
    ]) {
      expect(modal).toContain(owner);
    }
    expect(modal).toContain('runGameplayModalParallelExit');
    expect(JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS).toBe(580);
    expect(JOURNEY_CARD_MODAL_ENTER_START_PROGRESS).toBe(0.55);
    expect(JOURNEY_CARD_INITIAL_IMPACT_PROGRESS).toBe(0.55);
    expect(JOURNEY_CARD_OVERLAY_EXIT_DURATION_MS).toBe(950);
    expect(JOURNEY_CARD_MODAL_EXIT_DURATION_MS).toBe(320);
    expect(JOURNEY_CARD_STATS_EXIT_DURATION_MS).toBe(240);
    expect(JOURNEY_CARD_STATS_EXIT_STAGGER_MS).toBe(30);
    expect(
      JOURNEY_CARD_STATS_EXIT_DURATION_MS + 2 * JOURNEY_CARD_STATS_EXIT_STAGGER_MS,
    ).toBeLessThan(JOURNEY_CARD_MODAL_EXIT_DURATION_MS);
    expect(JOURNEY_CARD_SPATIAL_FLIGHT_DURATION_MS).toBe(580);
    expect(JOURNEY_CARD_SPATIAL_RETURN_DURATION_MS).toBe(620);
    expect(JOURNEY_CARD_DEPTH_SWAP_SEPARATE_MS).toBe(110);
    expect(JOURNEY_CARD_DEPTH_SWAP_SETTLE_MS).toBe(280);
    expect(JOURNEY_CARD_REAR_EXIT_START_PROGRESS).toBe(0.4);
    expect(Math.round(
      JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS * JOURNEY_CARD_MODAL_ENTER_START_PROGRESS,
    )).toBe(319);
    expect(Math.round(
      JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS * JOURNEY_CARD_INITIAL_IMPACT_PROGRESS,
    )).toBe(319);
    expect(modal).toContain('JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS * JOURNEY_CARD_MODAL_ENTER_START_PROGRESS');
    expect(modal).not.toContain('modalEnterStartProgress?:');
    expect(modal).toContain('foregroundDurationMs * JOURNEY_CARD_REAR_EXIT_START_PROGRESS');
    expect(modal).toContain('getJourneyCardOverlayExitTiming(value, foregroundIsCard)');
    expect(modal).toContain("stage.style.setProperty(\n          '--journey-card-overlay-backdrop-exit-duration'");
    expect(modal).toContain("stage.classList.add('is-backdrop-exiting')");
    expect(modal).toContain("if (value === 'dismiss')");
    expect(modal).toContain('options.onPlayCardExitStart?.()');
    expect(modal).toContain('options.onPlayCardExitComplete?.()');
    expect(modal).toContain("if (resultValue === 'play' && !didLandAtOrigin) options.origin.discard();");
    expect(modal.match(/startSpatialReturn\(\)/g)).toHaveLength(2);
    expect(modal.match(/startSpatialReturn\(true\)/g)).toHaveLength(2);
    expect(JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS).toBe(100);
    expect(JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS).toBe(500);
    expect(JOURNEY_CARD_PLAY_LANDING_PUNCH_DURATION_MS).toBe(120);
    expect(JOURNEY_CARD_PLAY_LANDING_EXIT_DURATION_MS).toBe(400);
    expect(JOURNEY_CARD_PLAY_RETURN_DURATION_MS).toBe(1120);
    expect(modal).toContain('const frozenTarget = hideAfterLanding ? options.origin.readLiveGeometry() : null;');
    expect(modal).toContain('readTarget: () => frozenTarget ?? options.origin.readLiveGeometry()');
    expect(modal).toContain('pathOffset: hideAfterLanding ? computeJourneyCardArcOffset : undefined');
    expect(modal).toContain('(elapsedMs - playTravelStartsAtMs) / JOURNEY_CARD_PLAY_TRAVEL_DURATION_MS');
    expect(modal).toContain('const launchHalfMs = JOURNEY_CARD_PLAY_LAUNCH_BOUNCE_DURATION_MS / 2;');
    expect(modal).toContain('previewFlipShell.style.transform = `scale(${cardScale})`;');
    expect(modal).toContain("previewFlipShell.style.opacity = elapsedMs >= totalDurationMs ? '0' : '1';");
    expect(modal).toContain('const playLandingExitAtMs = playLandingAtMs');
    expect(modal).toContain('cardScale = 1 + (0.14 * punchEase);');
    expect(modal).toContain('cardScale = Math.max(0, 1.14 * (1 - backIn));');
    expect(modal).toContain('options.origin.discard();');
    expect(modal).not.toContain('playCardLandingExit');
    expect(modal).not.toContain('journey-card-play-return-shrinking');
    expect(css).not.toContain('.journey-card-overlay-portaled-card.journey-card-play-return-shrinking');
    expect(modal).not.toContain('export function playJourneyReturnCardTransition');
    expect(modal).toContain('options.origin.mountInto(cardHost)');
    expect(modal).toContain("direction: 'enter'");
    expect(modal).toContain("direction: 'return'");
    expect(modal).toContain('options.origin.restoreNow()');
    expect(modal).toContain("didLandAtOrigin = outcome === 'complete'");
    expect(modal.indexOf('const source = readOverlayCardGeometry();'))
      .toBeLessThan(modal.indexOf("stage.classList.remove('is-card-revealed', 'is-card-impact');"));
    expect(modal).toContain('const enterDelay = (durationMs: number): number => prefersReducedMotion ? 0 : durationMs;');
    expect(modal).not.toContain('<img alt="" draggable="false">');
    expect(modal).toContain('void ctaController?.enter();');
    expect(modal).toContain('createDetailModalStatsEnterDelays(statElements.length)');
    expect(modal).toContain('getDetailModalStatsEnterTotalDuration(statElements.length)');
    expect(modal).toContain("stage.classList.remove('is-stats-enter-primed')");
    expect(modal.indexOf("stage.classList.add('is-modal-visible', 'cc-gameplay-modal-entering')"))
      .toBeLessThan(modal.indexOf('playStatsEnter();'));
    expect(css).toContain('#journey-card-overlay-modal.is-stats-enter-primed');
    expect(css).toContain('.journey-card-overlay-stat-entering {');
    expect(css).toContain('animation-name: detailStatPopOut;');
    expect(css).toContain('animation-duration: 0.4s;');
    expect(css).toContain('animation-direction: reverse;');
    expect(modal).toContain("element.classList.add('journey-card-overlay-stat-exiting')");
    expect(modal).toContain('playStatsExit();');
    expect(css).toContain('.journey-card-overlay-stat-exiting {');
    expect(css).toContain('animation-duration: 0.24s;');
    expect(modal).toContain("'is-spatial-card-entry'");
    expect(modal).toContain("stage.classList.add('is-modal-visible', 'cc-gameplay-modal-entering')");
    expect(modal).toContain("stage.classList.add('cc-gameplay-modal-idle')");
    expect(modal.indexOf("'is-spatial-card-entry'"))
      .toBeLessThan(modal.indexOf("stage.classList.add('is-modal-visible', 'cc-gameplay-modal-entering')"));
    expect(modal).toContain('activeJourneyCardOverlayModal?.dispose()');
    expect(modal).not.toContain("presentation?: 'from-unit' | 'restored-open'");
    expect(modal).not.toContain('autoDismissMs');
    expect(modal).not.toContain('is-restored-open');
    expect(modal).toContain("window.addEventListener('cc-navigation', handleRouteChange)");
    expect(modal).toContain("stage.classList.toggle('is-card-front', cardFront)");
    expect(modal).toContain("stage.classList.add('is-depth-swapping', directionClass)");
    expect(modal).toContain("stage.classList.add('is-depth-swap-settling')");
    expect(modal).not.toContain("depthShell.addEventListener('click', handleDepthShellClick, true)");
    expect(modal).not.toContain("depthShell.addEventListener('pointerup', handleDepthShellClick, true)");
    expect(modal).not.toContain('function handleDepthShellClick');
    expect(modal).not.toContain('function handleDepthShellKeyDown');
    expect(modal).not.toContain('function toggleDepth');
    expect(modal).toContain("preview.addEventListener('click', handleCardTapDepthSwap)");
    expect(modal).toContain("preview.removeEventListener('click', handleCardTapDepthSwap)");
    expect(modal).not.toContain('handleStatsModalTap');
    expect(modal).toContain('if (allowCommit) {');
    expect(modal).not.toContain('allowCommit && !dragStartedOnRear');
    expect(modal).toContain('Tap and drag share the same geometry-aware pointer owner.');
    expect(modal).toContain('beginDepthSwap();');
    expect(modal).not.toContain('is-card-tap-boing');
    expect(css).not.toContain('journey-card-overlay-tap-boing');
    expect(modal).toContain("const candidates: Array<HTMLElement | undefined> = cardFront\n        ? [preview]");
    expect(modal).toContain("target.closest('button, a, input, select, textarea')");
    expect(modal).toContain('function handleCardTapDepthSwap(event: MouseEvent): void');
    expect(modal).toContain('beginDepthSwap(event);');
    expect(modal).toContain("if (event.target !== stage || stage.classList.contains('is-depth-swapping')) return;");
    expect(modal).not.toContain('if (event.target !== stage || cardFront) return;');
    expect(modal).toContain('modalShell.inert = cardFront');
    expect(modal).toContain('mountGameplaySheetClose(idleShell');
    expect(modal).not.toContain('cubesCracked');
    expect(css).toContain('.journey-card-overlay-modal.is-card-front .journey-card-overlay-preview');
    expect(css).toContain('transform 580ms cubic-bezier(0.34, 1.56, 0.64, 1)');
    expect(css).toContain('--journey-card-overlay-peek-y: -12.32dvh;');
    expect(css).toContain('--journey-card-composition-y: clamp(40px, 5.69dvh, 52px);');
    expect(css).toContain('--journey-card-pair-card-rotate: -5.5deg;');
    expect(css).toContain('--journey-card-pair-modal-rotate: 2.6deg;');
    expect(modal).toContain('const tiltProfile = createJourneyCardOverlayTiltProfile();');
    expect(modal).toContain("stage.style.setProperty('--journey-card-pair-card-rotate'");
    expect(modal).toContain("stage.style.setProperty('--journey-card-pair-modal-rotate'");
    expect(css).toContain('rotate(calc(var(--journey-card-pair-card-rotate) + var(--journey-card-rear-drag-rotate)))');
    expect(css).toContain('rotate(calc(var(--journey-card-pair-modal-rotate) + var(--journey-card-drag-rotate)))');
    expect(css).toContain('translate: -50% -50%;');
    expect(css).toContain('calc(-50% + var(--journey-card-composition-y) + var(--journey-card-drag-y))');
    expect(css).toContain('calc(var(--journey-card-composition-y) + var(--journey-card-swap-front-y))');
    expect(css).toContain('calc(-50% + var(--journey-card-drag-x))');
    expect(css).toContain('translate3d(var(--journey-card-drag-x), var(--journey-card-drag-y), 0)');
    expect(css).toContain('.journey-card-overlay-modal.is-card-peeked:not(.is-card-front) .journey-card-overlay-preview');
    expect(css).toContain('var(--journey-card-composition-y)\n        + var(--journey-card-overlay-peek-y)\n        + var(--journey-card-rear-drag-y)');
    expect(css).toContain('--journey-card-front-composition-y: 32px;');
    expect(css).toContain('var(--journey-card-composition-y)\n        + var(--journey-card-front-composition-y)\n        + var(--journey-card-drag-y)');
    expect(css).toContain('+ var(--journey-card-front-composition-y)');
    expect(css).toContain('.journey-card-overlay-paper::after');
    expect(css).toContain('inset: 0 -6px -16px;');
    expect(css).toContain('opacity: 1;\n  filter: none;');
    expect(css).toContain('.journey-card-overlay-modal.is-card-front .journey-card-overlay-depth-shell *');
    expect(css).toContain('rotate(calc(var(--journey-card-pair-modal-rotate) + var(--journey-card-rear-drag-rotate)))\n    scale(0.985);');
    expect(css).toContain('.journey-card-overlay-modal.is-swapping-card-forward .journey-card-overlay-preview');
    expect(css).toContain('.journey-card-overlay-modal.is-swapping-modal-forward .journey-card-overlay-depth-shell');
    expect(css).toContain('calc(var(--journey-card-composition-y) + var(--journey-card-overlay-peek-y) + 2px)');
    expect(css).toContain('translate3d(-8%, var(--journey-card-composition-y), 0) rotate(-11deg)');
    expect(css).toContain('transition-duration: 110ms;');
    expect(css).toContain('transition-duration: 280ms;');
    expect(css).toContain('.journey-card-overlay-modal.is-depth-dragging .journey-card-overlay-preview');
    expect(css).toContain('transition: transform 320ms cubic-bezier(0.34, 1.42, 0.64, 1);');
    expect(css).toContain('.journey-card-overlay-modal.is-gesture-swapping.is-swapping-card-forward');
    expect(modal).toContain("preview.addEventListener('pointerdown', handleDragPointerDown, true)");
    expect(modal).toContain("depthShell.addEventListener('pointerdown', handleDragPointerDown, true)");
    expect(modal).toContain("paper.addEventListener('pointerdown', handleDragPointerDown, true)");
    expect(modal).toContain("stage.addEventListener('pointerdown', handleDragPointerDown, true)");
    expect(modal).toContain('const targetDepth = resolveDragTargetDepth(event);');
    expect(modal).toContain("const foreground = cardFront ? preview : paper;");
    expect(modal).toContain("const rear = cardFront ? paper : preview;");
    expect(modal).toContain("stage.removeEventListener('pointerdown', handleDragPointerDown, true)");
    expect(modal).toContain("return cardFront ? 'rear' : 'front';");
    expect(modal).toContain("dragStartedOnRear = targetDepth === 'rear'");
    expect(modal).toContain('const frontFollow = dragStartedOnRear ? 0.2 : 1;');
    expect(modal).toContain('const rearFollow = dragStartedOnRear ? 1 : 0.2;');
    expect(modal).toContain('startedOnRear: dragStartedOnRear');
    expect(modal).toContain("depthShell.removeEventListener('pointerdown', handleDragPointerDown, true)");
    expect(modal).not.toContain("import('./journey-card-idle-bounce.js')");
    expect(modal).not.toContain('smokeBubblesAtCard');
    expect(modal).not.toContain('playCardEntrySmoke');
    expect(modal).not.toContain('cardSmokeTimer');
    expect(modal).not.toContain('playRevealSmoke');
    expect(modal).not.toContain('const incomingSurface = nextCardFront ? preview : paper;');
    expect(modal).not.toContain('cleanupJourneySmokeEffects(paper)');
    expect(modal).toContain("triggerHapticImpact?.('medium')");
    expect(modal).toContain("triggerHapticImpact?.('light')");
    expect(modal).toContain("stage.classList.add('is-card-revealed', 'is-card-impact')");
    expect(modal).not.toContain('journey-card-overlay-modal-burn');
    expect(modal).not.toContain("stage.classList.add('is-modal-impact')");
    expect(modal).toContain("preview.setAttribute('data-board-id', `${options.boardId}-card`)");
    expect(modal).toContain("paper.setAttribute('data-board-id', `${options.boardId}-modal`)");
    expect(modal).toContain('JOURNEY_CARD_OVERLAY_ENTER_DURATION_MS * JOURNEY_CARD_INITIAL_IMPACT_PROGRESS');
    expect(modal).toContain("stage.addEventListener('pointermove', handleDragPointerMove, true)");
    expect(modal).toContain('shouldCommitJourneyCardDepthDrag(');
    expect(modal).toContain('const visualDeltaX = deltaX * JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_X;');
    expect(modal).toContain('const visualDeltaY = deltaY * JOURNEY_CARD_DRAG_VISUAL_DISTANCE_SCALE_Y;');
    expect(modal).toContain("ariaLabel: 'Swipe to view your card'");
    expect(modal).toContain("ariaLabel: 'Swipe to view stats'");
    expect(modal).not.toContain('Swipe to switch');
    expect(modal).toContain('JOURNEY_CARD_SWIPE_COACH_IDLE_MS = 5000');
    expect(modal).toContain('const amplitude = 1 + Math.random() * 0.4;');
    expect(modal).toContain('scheduleSwipeCoach();');
    expect(modal).toContain("stage.classList.add('is-swipe-coach-active')");
    expect(modal).toContain("stage.style.setProperty('--journey-card-drag-x', `${x}px`)");
    expect(modal).toContain("stage.style.setProperty('--journey-card-rear-drag-x', `${x * -0.2}px`)");
    expect(modal).toContain("stage.addEventListener('pointerdown', handleSwipeCoachInteraction, true)");
    expect(modal).toContain("stage.removeEventListener('pointerdown', handleSwipeCoachInteraction, true)");
    expect(css).toContain('.journey-card-overlay-swipe-copy');
    expect(css).toContain('bottom: calc(40px + env(safe-area-inset-bottom, 0px));');
    expect(css).toContain('font-size: 32px;');
    expect(modal).toContain("currentIndex < 5 ? 'is-accent' : 'is-secondary'");
    expect(css).toContain('.journey-card-overlay-swipe-letter.is-accent');
    expect(css).toContain('.journey-card-overlay-swipe-letter.is-secondary');
    expect(css).toContain('color: #fff;');
    expect(css).toContain('--journey-card-swipe-copy-opacity: 0.9;');
    expect(css).toContain('opacity: var(--journey-card-swipe-copy-opacity, 1);');
    expect(css).toContain('.journey-card-overlay-modal.is-swipe-coach-active .journey-card-overlay-swipe-letter');
    expect(css).toContain('animation: journey-card-swipe-copy-lifecycle 1.7s linear both;');
    expect(css).toContain('@keyframes journey-card-swipe-copy-lifecycle');
    expect(css).toContain('.journey-card-overlay-swipe-hand');
    expect(css).toContain('animation: journey-card-swipe-hand-press 1900ms');
    expect(css).toContain('.journey-card-overlay-modal.is-swipe-coach-active .journey-card-overlay-preview');
    expect(css).toContain('@keyframes journey-card-overlay-idle');
    expect(css).toContain('animation: journey-card-overlay-idle 3s ease-in-out infinite;');
    expect(css).toContain('@keyframes journey-card-overlay-front-boing');
    expect(css).toContain('animation: journey-card-overlay-front-boing 240ms cubic-bezier(0.34, 1.35, 0.64, 1) both;');
    expect(css).toContain('.journey-card-overlay-modal.is-card-front.is-depth-swapping.is-depth-swap-settling .journey-card-overlay-depth-shell');
    expect(css).not.toContain('.journey-card-overlay-modal.is-card-entering .journey-card-overlay-preview-flip-shell');
    expect(css).not.toContain('@keyframes journey-card-overlay-preview-flip-in');
    expect(css).toContain('#journey-card-overlay-modal.cc-gameplay-modal-stage.cc-gameplay-modal-entering\n  .journey-card-overlay-depth-shell > .journey-card-overlay-modal-shell');
    expect(css).toContain('animation: journey-spatial-modal-card-bounce-in 0.58s cubic-bezier(0.34, 1.56, 0.64, 1) both;');
    expect(css).toContain('.journey-card-overlay-depth-shell > .journey-card-overlay-modal-shell > .cc-gameplay-modal-flip-shell');
    expect(css).toContain('animation: journey-spatial-modal-flip-in 0.58s cubic-bezier(0.18, 0.82, 0.3, 1) both;');
    expect(css).toContain('transform: translate3d(0, 14px, -180px) rotateX(17deg) rotateY(-88deg) scale(0.85);');
    expect(modal).toContain('const foregroundIsCard = cardFront;');
    expect(modal).toContain("stage.classList.add('is-exiting-card-first')");
    expect(modal).toContain("stage.classList.add('is-exiting-card-second')");
    expect(modal).toContain("stage.classList.add('cc-gameplay-modal-exiting', 'is-exiting-modal-second')");
    expect(css).toContain('.journey-card-overlay-modal:is(.is-exiting-card-first, .is-exiting-card-second) .journey-card-overlay-preview-flip-shell');
    expect(css).toContain('animation: end-run-centered-modal-flip-out 0.95s cubic-bezier(0.4, 0, 0.2, 1) both;');
    expect(css).toContain('.journey-card-overlay-modal:is(.is-exiting-card-first, .is-exiting-card-second) .journey-card-overlay-preview-bounce-shell');
    expect(css).toContain('animation: end-run-centered-modal-bounce-out 0.95s cubic-bezier(0.4, 0, 0.2, 1) both;');
    expect(css).toContain('#journey-card-overlay-modal.cc-gameplay-modal-stage.cc-gameplay-modal-exiting\n  .journey-card-overlay-depth-shell > .journey-card-overlay-modal-shell');
    expect(css).toContain('animation: end-run-centered-modal-bounce-out 0.32s cubic-bezier(0.4, 0, 0.2, 1) both;');
    expect(css).not.toContain('animation: journey-spatial-modal-card-bounce-out 0.95s');
    expect(css).not.toContain('animation: journey-spatial-modal-flip-out 0.95s');
    expect(css).toContain('.journey-card-overlay-depth-shell > .journey-card-overlay-modal-shell > .cc-gameplay-modal-flip-shell {\n  animation: none;');
    expect(css).toContain('transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1);');
    expect(css).toContain('.journey-card-overlay-modal.is-visible.is-exiting {\n  opacity: 1;');
    expect(css).toContain('.journey-card-overlay-modal.is-visible.is-exiting.is-backdrop-exiting');
    expect(css).toContain('background-color var(--journey-card-overlay-backdrop-exit-duration, 620ms)');
    expect(css).toContain('font-family: "Baloo2", system-ui, -apple-system, sans-serif;');
    expect(modal).toContain('class="cc-gameplay-modal-title"');
    expect(css).not.toContain('.journey-card-overlay-title-section > h2 {\n  margin: 0;\n  color: #AD8675;\n  font-family: "Baloo2", system-ui, -apple-system, sans-serif;\n  font-size: 40px;');
    expect(css).not.toContain('font-family: "Lilita One"');
    expect(css.match(/top: 50%;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(css.match(/width: min\(calc\(100vw - 80px\), 390px\);/g)).toHaveLength(2);
    expect(css).toContain('border-radius: 34px;\n  overflow: visible;');
    expect(css).toContain('background: transparent;\n  box-shadow: none;');
    expect(css).toContain('height: 100%;\n  object-fit: contain;');
    expect(css).toContain('font-weight: 900;');
    expect(css).toContain('color: #AD8675;');
    expect(css).toContain('padding: 32px 24px 40px;');
    expect(css).toContain('overflow: hidden;\n  overscroll-behavior: none;\n  touch-action: none;');
    expect(css).toContain('.journey-card-overlay-cta.cc-cta {');
    expect(modal).toContain('class="journey-card-overlay-cta cc-cta--standard-width"');
    expect(css).not.toContain('.journey-card-overlay-cta.cc-cta {\n  width:');
    expect(css).toContain('width: 80px;');
    expect(css).toContain('color: #e8744a;');
    expect(css).toContain('background: #f9f2e9;');
    expect(css).toContain('height: 100dvh;');
    expect(css).toContain('.journey-card-overlay-shimmer::after');
    expect(css).toContain('animation: journey-card-overlay-shimmer 1.7s linear infinite;');
    expect(css).toContain('@keyframes journey-card-overlay-burn-in');
    expect(css).not.toContain('.journey-card-overlay-modal-burn');
    expect(css).toContain('.journey-card-overlay-spatial-shell');
    expect(css).toContain('.journey-card-overlay-portaled-card');
    expect(css).toContain('.journey-card-overlay-modal.is-spatial-card-return');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('.journey-board-card.journey-board-card-return-placeholder');
    expect(css).not.toContain('.journey-card-overlay-modal.journey-return-card-transition');
    expect(css).toContain('env(safe-area-inset-bottom, 0px)');
  });
});
