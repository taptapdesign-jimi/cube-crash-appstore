import fs from 'node:fs';
import path from 'node:path';
import {
  presentJourneyCardReturnReminder,
  getJourneyCardReturnReminderApex,
  getJourneyCardReturnReminderFlipAngle,
  getJourneyCardReturnReminderImpactPose,
  getJourneyCardReturnReminderMotionBase,
  getJourneyCardReturnReminderSqueezePose,
  JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET,
  JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET_2X,
  JOURNEY_CARD_RETURN_REMINDER_BACK_DURATION_MS,
  JOURNEY_CARD_RETURN_REMINDER_CYCLE_DURATION_MS,
  JOURNEY_CARD_RETURN_REMINDER_LANDING_ANTICIPATION_PROGRESS,
  JOURNEY_CARD_RETURN_REMINDER_LANDING_IMPACT_DURATION_MS,
  JOURNEY_CARD_RETURN_REMINDER_LANDING_PEAK_PROGRESS,
  JOURNEY_CARD_RETURN_REMINDER_LANDING_REBOUND_PROGRESS,
  JOURNEY_CARD_RETURN_REMINDER_LANDING_SMOKE_PROGRESS,
  JOURNEY_CARD_RETURN_REMINDER_LAUNCH_IMPACT_DURATION_MS,
  JOURNEY_CARD_RETURN_REMINDER_OUT_DURATION_MS,
  JOURNEY_CARD_RETURN_REMINDER_TRAVEL_RATIO,
} from '../journey-card-return-reminder';
import {
  acquireJourneyCardOriginLease,
  computeJourneyCardSpatialPose,
} from '../journey-card-portal-transition';
import { JOURNEY_CARD_FLIP_ENTER_DURATION_MS } from '../journey-card-overlay-modal';
import {
  createJourneyInterimBounceVariant,
  JOURNEY_CARD_RETURN_LANDING_SQUASH_STRENGTH,
} from '../journey-interim-idle-policy';

const root = process.cwd();
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Journey gameplay-return card reminder', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('connects the stage before validating its live-card portal', () => {
    document.body.innerHTML = `
      <div class="journey-board-card-wrapper">
        <div class="journey-board-card unlocked" data-board-id="4"></div>
      </div>
    `;
    const card = document.querySelector<HTMLElement>('.journey-board-card')!;
    Object.defineProperties(card, {
      offsetWidth: { configurable: true, value: 100 },
      offsetHeight: { configurable: true, value: 150 },
    });
    card.getBoundingClientRect = () => ({
      x: 20, y: 40, left: 20, top: 40, right: 120, bottom: 190,
      width: 100, height: 150, toJSON: () => ({}),
    });
    const origin = acquireJourneyCardOriginLease(4, card)!;

    const controller = presentJourneyCardReturnReminder({ boardId: 4, origin });

    expect(controller.element.isConnected).toBe(true);
    expect(controller.element.querySelector('.journey-card-overlay-portaled-card')).not.toBeNull();
    controller.dispose();
  });

  test('turns around at exactly 30% of the former full modal path', () => {
    const origin = {
      centerX: 80,
      centerY: 640,
      width: 90,
      height: 133,
      rotationDeg: -6,
    };
    const apex = getJourneyCardReturnReminderApex(origin, 90 / 133, 390, 844);

    expect(JOURNEY_CARD_RETURN_REMINDER_TRAVEL_RATIO).toBe(0.3);
    expect(apex.centerX).toBeCloseTo(114.5, 6);
    expect(apex.centerY).toBeCloseTo(574.6, 6);
    expect(apex.width).toBeCloseTo(160.8, 6);
    expect(apex.height).toBeCloseTo(237.6267, 4);
    expect(apex.rotationDeg).toBeCloseTo(-4.2, 6);

    const compactApex = getJourneyCardReturnReminderApex(origin, 90 / 133, 390, 680);
    expect(compactApex.width).toBeCloseTo(155.4, 6);
  });

  test('uses one original-flip-speed symmetric no-dwell cycle with authored launch and landing squash', () => {
    expect(JOURNEY_CARD_RETURN_REMINDER_CYCLE_DURATION_MS).toBe(JOURNEY_CARD_FLIP_ENTER_DURATION_MS);
    expect(JOURNEY_CARD_RETURN_REMINDER_OUT_DURATION_MS).toBe(260);
    expect(JOURNEY_CARD_RETURN_REMINDER_BACK_DURATION_MS).toBe(260);
    expect(
      JOURNEY_CARD_RETURN_REMINDER_OUT_DURATION_MS
        + JOURNEY_CARD_RETURN_REMINDER_BACK_DURATION_MS,
    ).toBe(JOURNEY_CARD_FLIP_ENTER_DURATION_MS);
    expect(getJourneyCardReturnReminderSqueezePose(0)).toEqual({ scaleX: 1, scaleY: 1 });
    expect(getJourneyCardReturnReminderSqueezePose(0.08)).toEqual({ scaleX: 1.035, scaleY: 0.965 });
    expect(getJourneyCardReturnReminderSqueezePose(0.22)).toEqual({ scaleX: 0.96, scaleY: 1.105 });
    expect(getJourneyCardReturnReminderSqueezePose(0.5)).toEqual({ scaleX: 1, scaleY: 1 });
    expect(getJourneyCardReturnReminderSqueezePose(0.78)).toEqual({ scaleX: 0.96, scaleY: 1.105 });
    expect(getJourneyCardReturnReminderSqueezePose(0.92)).toEqual({ scaleX: 1.075, scaleY: 0.94 });
    expect(getJourneyCardReturnReminderSqueezePose(1)).toEqual({ scaleX: 1, scaleY: 1 });
  });

  test('continues the same flip direction through the back-face apex without a middle dwell', () => {
    expect(getJourneyCardReturnReminderFlipAngle(0)).toBe(0);
    expect(getJourneyCardReturnReminderFlipAngle(0.5)).toBe(-180);
    expect(getJourneyCardReturnReminderFlipAngle(1)).toBe(-360);

    const sampledAngles = [0, 0.25, 0.49, 0.5, 0.51, 0.75, 1]
      .map(getJourneyCardReturnReminderFlipAngle);
    sampledAngles.slice(1).forEach((angle, index) => {
      expect(angle).toBeLessThan(sampledAngles[index]);
    });
    expect(getJourneyCardReturnReminderFlipAngle(0.49)).toBeLessThan(-170);
    expect(getJourneyCardReturnReminderFlipAngle(0.51)).toBeLessThan(-180);
  });

  test('bookends the flight with the full modal-card squeeze/stretch impact language', () => {
    const stretch = createJourneyInterimBounceVariant(0);
    expect(JOURNEY_CARD_RETURN_REMINDER_LAUNCH_IMPACT_DURATION_MS).toBe(180);
    expect(JOURNEY_CARD_RETURN_REMINDER_LANDING_IMPACT_DURATION_MS).toBe(790);
    expect(JOURNEY_CARD_RETURN_LANDING_SQUASH_STRENGTH).toBe(2.2);
    expect(getJourneyCardReturnReminderImpactPose('launch', 0, stretch, -1)).toEqual({
      scaleX: 1,
      scaleY: 1,
      y: 0,
      rotationDeg: 0,
    });
    expect(getJourneyCardReturnReminderImpactPose('launch', 0.68, stretch, -1)).toEqual({
      scaleX: 0.96,
      scaleY: 1.105,
      y: -7.92,
      rotationDeg: -1.35,
    });
    const landingAnticipation = getJourneyCardReturnReminderImpactPose(
      'landing',
      JOURNEY_CARD_RETURN_REMINDER_LANDING_ANTICIPATION_PROGRESS,
      stretch,
      -1,
    );
    expect(landingAnticipation.scaleX).toBeCloseTo(1.077, 8);
    expect(landingAnticipation.scaleY).toBeCloseTo(0.923, 8);
    expect(landingAnticipation.y).toBe(1.5);
    expect(landingAnticipation.rotationDeg).toBe(0);
    const landingPeak = getJourneyCardReturnReminderImpactPose(
      'landing',
      JOURNEY_CARD_RETURN_REMINDER_LANDING_PEAK_PROGRESS,
      stretch,
      -1,
    );
    expect(landingPeak.scaleX).toBeCloseTo(0.912, 8);
    expect(landingPeak.scaleY).toBeCloseTo(1.231, 8);
    expect(landingPeak.y).toBe(-11);
    expect(landingPeak.rotationDeg).toBeCloseTo(-1.35, 8);
    const landingImpact = getJourneyCardReturnReminderImpactPose(
      'landing',
      JOURNEY_CARD_RETURN_REMINDER_LANDING_SMOKE_PROGRESS,
      stretch,
      -1,
    );
    expect(landingImpact.scaleX).toBeCloseTo(1.165, 8);
    expect(landingImpact.scaleY).toBeCloseTo(0.868, 8);
    expect(landingImpact.y).toBe(1);
    expect(landingImpact.rotationDeg).toBeCloseTo(0.297, 8);
    const landingRebound = getJourneyCardReturnReminderImpactPose(
      'landing',
      JOURNEY_CARD_RETURN_REMINDER_LANDING_REBOUND_PROGRESS,
      stretch,
      -1,
    );
    expect(landingRebound.scaleX).toBeCloseTo(0.967, 8);
    expect(landingRebound.scaleY).toBeCloseTo(1.055, 8);
    expect(landingRebound.y).toBe(-2.5);
    expect(landingRebound.rotationDeg).toBeCloseTo(-0.162, 8);
    expect(getJourneyCardReturnReminderImpactPose('landing', 1, stretch, -1)).toEqual({
      scaleX: 1,
      scaleY: 1,
      y: 0,
      rotationDeg: 0,
    });
  });

  test('keeps the authored card tilt through the terminal portal handoff', () => {
    const origin = {
      centerX: 80,
      centerY: 640,
      width: 90,
      height: 133,
      rotationDeg: -6,
    };
    const apex = getJourneyCardReturnReminderApex(origin, 90 / 133, 390, 844);
    const motionBase = getJourneyCardReturnReminderMotionBase(origin);

    expect(motionBase.rotationDeg).toBe(0);
    expect(computeJourneyCardSpatialPose(motionBase, origin, apex, 0).rotationDeg).toBe(-6);
    expect(computeJourneyCardSpatialPose(motionBase, apex, origin, 1).rotationDeg).toBe(-6);
  });

  test('uses the supplied cardflip artwork for the complete back face', () => {
    expect(JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET).toBe('./assets/colelctibles/cardflip.png');
    expect(JOURNEY_CARD_RETURN_REMINDER_BACK_ASSET_2X).toBe('./assets/colelctibles/cardflip@22.png');
    expect(fs.existsSync(path.join(root, 'assets/colelctibles/cardflip.png'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'assets/colelctibles/cardflip@22.png'))).toBe(true);
  });

  test('replaces only the post-World modal replay with the automatic reminder', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const main = read('src/main.ts');
    const returnMethod = manager.slice(
      manager.indexOf('private async runJourneyOverlayReturnCard'),
      manager.indexOf('private async onJourneyBoardTap'),
    );

    expect(returnMethod).toContain('presentJourneyCardReturnReminder({');
    expect(returnMethod).not.toContain('presentJourneyCardOverlayModal({');
    expect(returnMethod).not.toContain('await this.startJourneyBoardFromOverlay');
    expect(returnMethod).toContain("if (result === 'complete')");
    expect(returnMethod).toContain('completeJourneyCardOverlayReturn(boardId);');
    expect(main).toContain("presentation: 'shortened-auto-reminder'");
  });

  test('has no modal surface, controls, dwell timer or input interception', () => {
    const reminder = read('src/modules/journey-card-return-reminder.ts');
    const css = read('src/collectibles-screen.css');

    expect(reminder).not.toContain("setAttribute('role', 'dialog')");
    expect(reminder).not.toContain('aria-modal');
    expect(reminder).not.toContain('journey-card-flip-backdrop');
    expect(reminder).not.toContain('journey-card-flip-cta');
    expect(reminder).not.toContain('setTimeout(');
    expect(reminder.match(/spatialProgress: smoothstep/g)).toHaveLength(2);
    expect(reminder.match(/transformOriginPrimed: true/g)).toHaveLength(2);
    expect(reminder.match(/baseGeometry: motionBase/g)).toHaveLength(2);
    expect(reminder).toContain("await runImpact('launch', impactVariant, tiltDirection)");
    expect(reminder).toContain("await runImpact('landing', impactVariant, tiltDirection)");
    expect(reminder).toContain('options.onImpactSmoke?.(phase)');
    expect(reminder).toContain('getJourneyCardReturnReminderFlipAngle(progress * 0.5)');
    expect(reminder).toContain('getJourneyCardReturnReminderFlipAngle(0.5 + progress * 0.5)');
    expect(reminder).not.toContain("getJourneyCardFlightFlipAngle(progress, 'return')");
    expect(reminder.indexOf('const outboundResult = await flight.result;')).toBeLessThan(
      reminder.indexOf("direction: 'return'"),
    );
    expect(css).toMatch(/\.journey-card-return-reminder \{[\s\S]*?pointer-events: none;/);
  });

  test('owns interruption cleanup and exact live-card restoration', () => {
    const reminder = read('src/modules/journey-card-return-reminder.ts');
    const manager = read('src/modules/journey-boards-manager.ts');

    expect(reminder).toContain("window.addEventListener('cc-navigation', handleRouteChange);");
    expect(reminder).toContain("window.addEventListener('pagehide', handleRouteChange);");
    expect(reminder).toContain('flight?.cancel();');
    expect(reminder).toContain('options.origin.restoreNow();');
    expect(reminder).toContain("readTarget: () => options.origin.readLiveGeometry()");
    expect(manager).toContain('this.journeyCardReturnReminder?.dispose();');
    expect(manager).toContain('private journeyOverlayReturnInFlight:');
    expect(manager).not.toContain('if (this.journeyOverlayReturnInFlight || this.journeyCardReturnReminder) return;');
    expect(manager).toContain('const activeReturnReminder = this.journeyCardReturnReminder;');
    expect(manager).toContain('activeReturnReminder.dispose();');
    expect(manager).not.toContain("this.pauseJourneyWorldForCardOverlay('game-return-card-reminder'");
  });

  test('keeps completion, fail and Exit Game on the shared Journey receipt hook', () => {
    const completion = read('src/modules/endgame-flow.ts');
    const fail = read('src/modules/board-fail-modal.ts');
    const exitGame = read('src/modules/end-run-modal.ts');
    const originState = read('src/modules/journey-origin-state.ts');

    expect(completion).toContain('resolveJourneyReturnTarget(');
    expect(fail).toContain('prepareJourneyFailReturnTarget(');
    expect(exitGame).toContain('resolveJourneyReturnTarget(');
    expect(originState).toContain('getJourneyCardOverlayReturnBoardId()');
    expect(originState).toContain('if (overlayReturnBoardId === normalizedBoardId)');
    expect(originState).toMatch(/if \(overlayReturnBoardId === normalizedBoardId\) \{[\s\S]*?target: 'journey'/);
  });

  test('arms and accepts the reminder for direct interim Unit gameplay', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const directInterimStart = manager.slice(
      manager.indexOf('private async continueFromInterimBoard'),
      manager.indexOf('private async openBoardDetails'),
    );
    const returnMethod = manager.slice(
      manager.indexOf('private async runJourneyOverlayReturnCard'),
      manager.indexOf('private async onJourneyBoardTap'),
    );

    expect(directInterimStart).toContain("source: 'interim-direct-play'");
    expect(directInterimStart).toContain('const reminderBoardId = markJourneyCardOverlayReturn(board.id);');
    expect(directInterimStart.indexOf('await exitPromise;')).toBeLessThan(
      directInterimStart.indexOf('const reminderBoardId = markJourneyCardOverlayReturn(board.id);'),
    );
    expect(returnMethod).toContain(
      'const reminderEligible = canPresentJourneyCardReturnReminder(board, receiptBoardId);',
    );
    expect(returnMethod).toContain('if (!reminderEligible) return;');

    const retainedInterimContinue = manager.slice(
      manager.indexOf("logger.info(`🔄 Continue Stage ${source} for board ${board.id}`)"),
      manager.indexOf("logger.info(`✅ Continue Stage button listener attached for board ${board.id}`)"),
    );
    expect(retainedInterimContinue).toContain("source: 'interim-detail-continue'");
    expect(retainedInterimContinue).toContain('markJourneyCardOverlayReturn(board.id);');
  });

  test('arms the reminder when regular gameplay starts through the detail fallback', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const regularDetailPlay = manager.slice(
      manager.indexOf('const handlePlayClick = async (e: Event) => {'),
      manager.indexOf('registerCta(floatingPlayButton, {'),
    );

    expect(regularDetailPlay).toContain('const reminderBoardId = markJourneyCardOverlayReturn(boardIdForPlay);');
    expect(regularDetailPlay).toContain("source: 'regular-detail-play'");
  });
});
