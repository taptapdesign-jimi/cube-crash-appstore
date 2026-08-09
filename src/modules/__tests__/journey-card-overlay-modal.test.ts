import fs from 'node:fs';
import path from 'node:path';
import {
  buildJourneyCardOverlayModalViewModel,
  createJourneyCardOverlayTiltProfile,
  getJourneyCardFlightFlipAngle,
  getJourneyCardFlipEdgeProgress,
  JOURNEY_CARD_FLIP_DRAG_COMMIT_RATIO,
  JOURNEY_CARD_FLIP_DRAG_PREVIEW_MAX_DEG,
  JOURNEY_CARD_FLIP_ENTER_DURATION_MS,
  JOURNEY_CARD_FLIP_FLICK_VELOCITY_PX_PER_MS,
  JOURNEY_CARD_FLIP_IDLE_COACH_DELAY_MS,
  JOURNEY_CARD_FLIP_IDLE_COACH_DURATION_MS,
  JOURNEY_CARD_FLIP_SNAP_DURATION_MS,
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
  isJourneyCardDownwardDismissGesture,
  shouldCommitJourneyCardFlipDrag,
} from '../journey-card-overlay-modal';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Journey two-sided card overlay prototype', () => {
  test('builds the minimal Stage stats model', () => {
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
      highScore: -1,
      longestCombo: Number.NaN,
    }, true)).toEqual({
      stageLabel: 'Stage 01',
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

  test('uses a horizontal rotateY drag threshold and velocity flick', () => {
    expect(JOURNEY_CARD_FLIP_DRAG_COMMIT_RATIO).toBe(0.2);
    expect(JOURNEY_CARD_FLIP_DRAG_PREVIEW_MAX_DEG).toBe(36);
    expect(JOURNEY_CARD_FLIP_FLICK_VELOCITY_PX_PER_MS).toBe(0.34);
    expect(shouldCommitJourneyCardFlipDrag(64, 0, 320)).toBe(true);
    expect(shouldCommitJourneyCardFlipDrag(-64, 0, 320)).toBe(true);
    expect(shouldCommitJourneyCardFlipDrag(63, 0, 320)).toBe(false);
    expect(shouldCommitJourneyCardFlipDrag(20, -0.35, 320)).toBe(true);
    expect(shouldCommitJourneyCardFlipDrag(40, 0.2, 320)).toBe(false);
  });

  test('uses a dominant downward-only gesture to run the canonical dismiss', () => {
    expect(JOURNEY_CARD_DISMISS_DRAG_COMMIT_RATIO).toBe(0.16);
    expect(JOURNEY_CARD_DISMISS_DRAG_MIN_PX).toBe(56);
    expect(JOURNEY_CARD_DISMISS_DRAG_MAX_PX).toBe(96);
    expect(getJourneyCardDismissDragDistance(300)).toBe(56);
    expect(getJourneyCardDismissDragDistance(500)).toBe(80);
    expect(getJourneyCardDismissDragDistance(1000)).toBe(96);
    expect(isJourneyCardDownwardDismissGesture(10, 60)).toBe(true);
    expect(isJourneyCardDownwardDismissGesture(60, 10)).toBe(false);
    expect(isJourneyCardDownwardDismissGesture(10, -60)).toBe(false);

    const modal = read('src/modules/journey-card-overlay-modal.ts');
    expect(modal).toContain("dragAxis: 'horizontal' | 'vertical' | null");
    expect(modal).toContain("dragAxis === 'vertical'");
    expect(modal).toContain("void beginClose('dismiss')");
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
    expect(modal).toContain('idleCoachRotorAnimation = rotorAnimation;');
    expect(modal).toContain('idleCoachHandAnimation = handAnimation;');
    expect(modal).toContain('idleCoachImpactAnimation = impactCoachAnimation;');
    expect(modal).toContain("{ transform: 'scale(1.06)', offset: 0.57 }");
    expect(modal).toContain("stage.addEventListener('pointerdown', handleAnyPointerInteraction, true)");
    expect(modal).toContain("stage.removeEventListener('pointerdown', handleAnyPointerInteraction, true)");
    expect(css).toMatch(/\.journey-card-flip-title-section > h2 \{[\s\S]*?font-size: 32px;/);
    expect(css).toMatch(/\.journey-card-flip-title-section \{[\s\S]*?margin: 20px 0 24px;/);
    expect(css).toMatch(/\.journey-card-flip-stats \{[\s\S]*?margin-bottom: 24px;/);
    expect(css).toContain('.journey-card-flip-turn-control {');
    expect(css).toContain('.journey-card-flip-overlay.is-idle-coach .journey-card-flip-idle-hand {');
    expect(css).toContain('.journey-card-flip-overlay.is-idle-coach-drag .journey-card-flip-idle-message.is-drag');
    expect(css).toContain('.journey-card-flip-overlay.is-idle-coach-tap .journey-card-flip-idle-message.is-tap');
    expect(modal).toContain('mountGameplaySheetClose(backShell, () =>');
    expect(modal).toContain("stage.classList.toggle('is-flipping-to-front', targetFace === 'front')");
    expect(modal).toContain("stage.classList.toggle('is-flipping-to-back', targetFace === 'back')");
    expect(modal).toContain("stage.classList.add('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back')");
    expect(modal.match(/stage\.classList\.remove\('is-entering', 'is-spatial-card-entry', 'is-flipping-to-back'\)/g)).toHaveLength(2);
    expect(modal).toContain("stage.classList.add('is-flipping-to-front');\n    stage.classList.add('is-exiting', 'is-backdrop-exiting');");
    expect(css).toContain('.journey-card-flip-overlay.is-flipping-to-front');
    expect(css).not.toContain('.journey-card-flip-overlay.is-flipping-to-front\n  .journey-card-flip-back-shell > .gameplay-sheet-close');
    expect(modal).toContain('class="cc-gameplay-modal-paper-shell journey-card-flip-paper"');
    expect(css).toMatch(/\.journey-card-flip-paper \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/);
    expect(css).toMatch(/\.journey-card-flip-card-host \{[\s\S]*?filter: none;/);
    expect(css).not.toContain('.journey-card-flip-back-shell::after');
    expect(css).toMatch(/\.journey-card-flip-paper::after \{[\s\S]*?inset: 0;[\s\S]*?background-size: calc\(100% \+ 12px\) calc\(100% \+ 16px\);/);
    expect(css).not.toContain('inset: 0 -6px -16px');
    expect(modal).toContain("stage.classList.add('is-visible');\n    backdrop.style.opacity = '1';");
    expect(modal).not.toContain('smoothstep((rotationProgress - 0.5) / 0.5)');
    expect(modal).toContain("stage.classList.add('is-exiting', 'is-backdrop-exiting')");
    expect(css).toMatch(/\.journey-card-flip-backdrop \{[\s\S]*?transition: opacity 520ms/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-exiting \.journey-card-flip-card-host \{[\s\S]*?filter: none;[\s\S]*?transition: none;/);
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-exiting \.journey-card-flip-paper \{[\s\S]*?box-shadow: none;[\s\S]*?filter: none;/);
    expect(css).not.toContain('.journey-card-flip-overlay.is-exiting .journey-card-flip-back-shell {');
    expect(css).toMatch(/\.journey-card-flip-overlay\.is-exiting \.journey-card-flip-idle-shell \{[\s\S]*?rotate: 0deg;[\s\S]*?--journey-card-exit-neutral-duration, 680ms[\s\S]*?transition-timing-function: linear;/);
    expect(modal).toContain('const neutralizeExitMotionOwners = (durationMs: number) => {');
    expect(modal).toContain("{ transform: idleTransform },\n        { transform: 'none' }");
    expect(modal).toContain("{ translate: gyroTranslate, transform: gyroTransform }");
    expect(modal).toContain('neutralizeExitMotionOwners(prefersReducedMotion ? 1 : exitNeutralDurationMs);');
    expect(modal).toContain("stage.style.setProperty('--journey-card-exit-neutral-duration', `${safeDurationMs}ms`)");
    expect(modal).toContain("{ duration: safeDurationMs, easing: 'linear', fill: 'forwards' }");
    expect(css).toContain('.journey-card-flip-overlay[data-paint-face="front"] .journey-card-flip-back');
    expect(css).toContain('.journey-card-flip-overlay[data-paint-face="back"] .journey-card-flip-front');
    expect(css).toMatch(/\.journey-card-flip-gyro-shell\.cc-modal-spatial-target \{[\s\S]*?translate3d\(0, 0, var\(--cc-modal-gyro-z\)\)[\s\S]*?rotateY\(var\(--cc-modal-gyro-ry\)\);/);
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

  test('reuses the previous detail-modal stats and CTA enter inside the back face', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');

    expect(modal).toContain('createDetailModalStatsEnterDelays(backContentElements.length)');
    expect(modal).toContain('getDetailModalStatsEnterTotalDuration(backContentElements.length)');
    expect(JOURNEY_CARD_FLIP_STATS_ENTER_TIME_SCALE).toBe(0.5);
    expect(modal).toContain("element.classList.add('is-content-entering')");
    expect(modal).toContain('void ctaController?.enter();');
    expect(modal).toContain('if (angle <= -90) startBackContentEnter();');
    expect(modal).toContain('startBackContentEnter(Math.round(duration * edgeProgress));');
    expect(modal).toContain('startBackContentExit(prefersReducedMotion ? 0 : returnEdgeAtMs);');
    expect(css).toMatch(/\.journey-card-flip-stat\.is-content-exiting,[\s\S]*?animation-name: detailStatPopOut;[\s\S]*?animation-duration: 0\.2s;/);
    expect(modal).toContain("if (targetFace === 'front') primeBackContentForEnter();");
    expect(css).toMatch(/\.journey-card-flip-stat\.is-content-entering,[\s\S]*?animation-name: detailStatPopOut;[\s\S]*?animation-duration: 0\.2s;[\s\S]*?animation-direction: reverse;/);
  });

  test('keeps one frame owner, one gyro target, and two identical mounted faces', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');
    const spatial = read('src/modules/gameplay-modal-spatial-motion.ts');

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
    expect(modal).toContain('rotor.style.transform = `translate3d(${translateX}px, 0, 0) rotateY(${angle}deg)`;');
    expect(modal).toContain('const deltaX = event.clientX - dragStartX;');
    expect(modal).toContain('const previewProgress = clamp01(Math.abs(deltaX) / commitDistance);');
    expect(modal).toContain('const translateX = Math.max(-44, Math.min(44, deltaX * 0.35));');
    expect(modal).toContain('dragDirection = deltaX >= 0 ? 1 : -1;');
    expect(modal).toContain('if (Math.abs(deltaX) >= commitDistance) {');
    expect(modal).toContain('rotor.releasePointerCapture(event.pointerId)');
    expect(modal).toContain('const deltaY = event.clientY - dragStartY;');
    expect(spatial).toContain('mountJourneyCardFlipSpatialMotion');
    expect(spatial).toContain('registerModalTargets(stage, [');
    expect(spatial).toContain('{ element: target, ...JOURNEY_FLIP_CARD_PROFILE }');
  });

  test('shares flight progress with the flip and preserves Play landing choreography', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    expect(JOURNEY_CARD_FLIP_ENTER_DURATION_MS).toBe(680);
    expect(JOURNEY_CARD_FLIP_SNAP_DURATION_MS).toBe(520);
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

  test('retains World suspension, exact origin leasing, and the existing board handoff', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const portal = read('src/modules/journey-card-portal-transition.ts');
    expect(manager).toContain('export const JOURNEY_CARD_OVERLAY_MODAL_EXPERIMENT_ENABLED = true');
    expect(manager.match(/this\.suspendJourneyWorldForCardOverlay\(/g)).toHaveLength(2);
    expect(manager.match(/this\.resumeJourneyWorldAfterCardOverlay\(/g)).toHaveLength(4);
    expect(manager).toContain('await this.startJourneyBoardFromOverlay(board, earlyJourneyExitPromise);');
    expect(manager).toContain('startOverlayPortaledCardJourneyExit(');
    expect(manager.match(/onPlayCardExitStart: \(\) =>/g)).toHaveLength(2);
    expect(manager.match(/onPlayCardExitComplete: \(\) =>/g)).toHaveLength(2);
    expect(manager).toContain('origin.prepareSettledLanding();');
    expect(manager).toContain('origin.captureLandingGeometry();');
    expect(manager).toContain('this.stopOverlayCardLandingBounce(cardEl);');
    expect(manager.indexOf('this.stopOverlayCardLandingBounce(cardEl);')).toBeLessThan(
      manager.indexOf('acquireJourneyCardOriginLease(board.id, cardEl)'),
    );
    expect(manager).toContain("gsap.set(card, { clearProps: 'transform' })");
    expect(manager).toContain("const phaseCanLaunch = this.journeyV700Phase === 'idle';");
    expect(manager).not.toContain("this.journeyV700Phase === 'entering'\n          || this.journeyV700Phase === 'idle'");
    expect(manager).toContain('wrapperOpacity >= 0.99');
    expect(manager).toContain('screenOpacity >= 0.99');
    expect(manager).toContain('if (stablePaintFrames >= 2)');
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
    expect(manager).toContain("this.getCurrentJourneyForestAreas(cardsContainer),\n      cardsContainer,\n      true,");
    expect(portal).toContain("card.classList.add('journey-board-card-return-placeholder')");
    expect(portal).toContain('portalVisual = card.cloneNode(true) as HTMLElement;');
    expect(portal).toContain("emitLandingDiagnostic('after-restore-raf-2')");
  });

  test('keeps reduced motion deterministic and all lifecycle cleanup connected', () => {
    const modal = read('src/modules/journey-card-overlay-modal.ts');
    const css = read('src/collectibles-screen.css');
    expect(modal).toContain("prefersReducedMotion ? -180 : getJourneyCardFlightFlipAngle(progress, 'enter')");
    expect(modal).toContain("prefersReducedMotion ? 0 : getJourneyCardFlightFlipAngle(travelProgress, 'return')");
    expect(modal).toContain('disposeSpatialMotion?.();');
    expect(modal).toContain('spatialFlight?.cancel();');
    expect(modal).toContain('flipAnimation?.cancel();');
    expect(modal).toContain('restoreEnvironment();');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.journey-card-flip-rotor,');
  });
});
