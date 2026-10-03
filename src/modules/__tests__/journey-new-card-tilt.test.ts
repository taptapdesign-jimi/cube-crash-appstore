import fs from 'node:fs';
import path from 'node:path';
import {
  createJourneyNewCardTiltProfile,
  getJourneyNewCardDragTiltAngle,
  isJourneyNewCardCollectDrag,
  JOURNEY_NEW_CARD_DRAG_FULL_RANGE_VIEWPORT_RATIO,
  JOURNEY_NEW_CARD_DRAG_MAX_TILT_DEG,
} from '../journey-new-card-tilt';
import {
  JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS,
  JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG,
} from '../journey-card-overlay-modal';

describe('Journey New Reward card tilt handoff', () => {
  test('caps horizontal drag at 40 percent without ever reaching a card flip', () => {
    expect(JOURNEY_NEW_CARD_DRAG_FULL_RANGE_VIEWPORT_RATIO).toBe(0.4);
    expect(JOURNEY_NEW_CARD_DRAG_MAX_TILT_DEG).toBe(28.8);
    expect(getJourneyNewCardDragTiltAngle(0, 0, 400)).toBe(0);
    expect(getJourneyNewCardDragTiltAngle(0, 80, 400)).toBe(14.4);
    expect(getJourneyNewCardDragTiltAngle(0, 160, 400)).toBe(28.8);
    expect(getJourneyNewCardDragTiltAngle(0, 800, 400)).toBe(28.8);
    expect(getJourneyNewCardDragTiltAngle(0, -160, 400)).toBe(-28.8);
    expect(getJourneyNewCardDragTiltAngle(0, -800, 400)).toBe(-28.8);
  });

  test('collects on a deliberate dominant drag in either vertical direction', () => {
    expect(isJourneyNewCardCollectDrag(4, 64, 500)).toBe(true);
    expect(isJourneyNewCardCollectDrag(-4, -64, 500)).toBe(true);
    expect(isJourneyNewCardCollectDrag(80, 64, 500)).toBe(false);
    expect(isJourneyNewCardCollectDrag(4, 40, 500)).toBe(false);
  });

  test('routes revealed-card pointer ownership without allowing a horizontal flip', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
      'utf8',
    );

    expect(source).toContain("touch-action: none;");
    expect(source).toMatch(/\.cc-journey-new-card-auto-tilt-shell--unlocked \{[\s\S]*?animation: none;/);
    expect(source).not.toContain("unlockedAutoTilt.style.animationPlayState = 'paused'");
    expect(source).toContain("hero?.addEventListener('pointerdown', handleUnlockedPointerDown)");
    expect(source).toContain("hero?.addEventListener('pointermove', handleUnlockedPointerMove)");
    expect(source).toContain("hero?.addEventListener('pointerup', handleUnlockedPointerUp)");
    expect(source).toContain("hero?.addEventListener('pointercancel', handleUnlockedPointerCancel)");
    expect(source).toContain('getJourneyNewCardDragTiltAngle(');
    expect(source).toContain('isJourneyNewCardCollectDrag(');
    expect(source).toContain('suppressClickUntil = Date.now() + 500;');
    expect(source).toContain('settleUnlockedCardAfterDrag();');
    expect(source).not.toContain('flipUnlockedCard');
    expect(source).toContain('unlockedDragSettleAnimation?.cancel();');
    expect(source).toContain('unlockedDragHoloSettleAnimation?.cancel();');
    expect(source).toContain("hero?.removeEventListener('pointercancel', handleUnlockedPointerCancel)");
  });

  test('uses half-strength Journey transition and rest tilts', () => {
    const left = createJourneyNewCardTiltProfile(() => 0);
    expect(left).toEqual({
      interimRestRotationDeg: -2.38,
      interimRestRotateXDeg: -1.5,
      interimRestRotateYDeg: -2,
      interimExitRotationDeg: -4.5,
      interimExitRotateXDeg: -4.5,
      interimExitRotateYDeg: -4.5,
      unlockedEntryRotationDeg: 4.5,
      unlockedEntryRotateXDeg: 4.5,
      unlockedEntryRotateYDeg: 4.5,
      unlockedRestRotationDeg: 2.38,
      unlockedRestRotateXDeg: 1,
      unlockedRestRotateYDeg: 1.5,
      unlockedExitRotationDeg: 4.5,
      unlockedExitRotateXDeg: -4.5,
      unlockedExitRotateYDeg: 4.5,
    });

    const right = createJourneyNewCardTiltProfile(() => 1);
    expect(right).toEqual({
      interimRestRotationDeg: 3.13,
      interimRestRotateXDeg: -3,
      interimRestRotateYDeg: 3.5,
      interimExitRotationDeg: 7.5,
      interimExitRotateXDeg: -7.5,
      interimExitRotateYDeg: 7.5,
      unlockedEntryRotationDeg: -7.5,
      unlockedEntryRotateXDeg: 7.5,
      unlockedEntryRotateYDeg: -7.5,
      unlockedRestRotationDeg: -3.13,
      unlockedRestRotateXDeg: 2,
      unlockedRestRotateYDeg: -3,
      unlockedExitRotationDeg: -7.5,
      unlockedExitRotateXDeg: -7.5,
      unlockedExitRotateYDeg: -7.5,
    });
  });

  test('uses isolated 3D owners for hidden rest, interim exit, unlocked enter/rest, and final exit', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
      'utf8',
    );
    expect(source).toContain('const revealTilt = createJourneyNewCardTiltProfile();');
    expect(source).toContain('perspective: 1050px;');
    expect(source).toMatch(/\.cc-journey-new-card-motion \{[\s\S]*?transform-style: preserve-3d;[\s\S]*?-webkit-transform-style: preserve-3d;/);
    expect(source).toMatch(/\.cc-journey-new-card-surface \{[\s\S]*?transform-style: preserve-3d;[\s\S]*?-webkit-transform-style: preserve-3d;/);
    expect(source).toContain('cc-journey-new-card-surface--interim');
    expect(source).toContain('cc-journey-new-card-surface--unlocked');
    expect(source).toContain('cc-journey-new-card-pose-shell');
    expect(source).toContain('cc-journey-new-card-auto-tilt-shell--interim');
    expect(source).toContain('cc-journey-new-card-auto-tilt-shell--unlocked');
    expect(source).not.toContain('mountGameplayModalSpatialMotion');
    expect(source).not.toContain('DeviceOrientationEvent');
    expect(source).toMatch(/\.cc-journey-new-card-auto-tilt-shell \{[\s\S]*?animation: none;/);
    expect(source).toContain('rotationZ: revealTilt.interimRestRotationDeg');
    expect(source).toContain('rotationX: revealTilt.interimExitRotateXDeg');
    expect(source).toContain('rotationY: revealTilt.interimExitRotateYDeg');
    expect(source).toContain('rotationX: revealTilt.unlockedEntryRotateXDeg');
    expect(source).toContain('rotationY: revealTilt.unlockedRestRotateYDeg');
    expect(source).toContain('rotationX: revealTilt.unlockedExitRotateXDeg');
    expect(source).toContain('.to(unlockedSurface, {');
    expect(source).not.toMatch(/\.to\(hero, \{[^}]*rotate:\s*0/s);
    expect(source).toContain('JOURNEY_WORLD_CARTOON_BOUNCE_ENTER');
    expect(source).toContain('JOURNEY_NEW_CARD_TRANSITION_SPEED_SCALE = 0.8');
    expect(source).toContain('const coverExitDuration = transitionTotalDuration;');
    expect(source).toContain('const cardEnterStart = coverExitDuration;');
    expect(source).toContain('JOURNEY_NEW_CARD_UNLOCKED_ENTER_DURATION_SECONDS = 0.28');
    expect(source).toMatch(/\.to\(interimSurface, \{[\s\S]*?JOURNEY_WORLD_CARTOON_BOUNCE_ENTER\.scaleX[\s\S]*?JOURNEY_WORLD_CARTOON_BOUNCE_ENTER\.bounceEase/);
    expect(source).toMatch(/\.to\(interimSurface, \{[\s\S]*?scaleX: 0,[\s\S]*?JOURNEY_WORLD_CARTOON_BOUNCE_ENTER\.exitEase/);
    expect(source).toContain("ease: prefersReducedMotion ? 'power1.out' : 'back.out(2.1)'");
    expect(source).toMatch(/\.set\(unlockedSurface, \{[\s\S]*?y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX - 18,[\s\S]*?scale: 0\.58/);
  });

  test('keeps the closed question-mark card moving in owned finite three-second cycles', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
      'utf8',
    );

    expect(source).toContain('JOURNEY_NEW_CARD_INTERIM_IDLE_DURATION_MS = 3000');
    expect(source).toContain('const startInterimIdleMotion = () => {');
    expect(source).toContain("{ transform: 'translateY(-8px) scale(1.02)', offset: 0.5 }");
    expect(source).toContain("rotateX(-2.3deg) rotateY(2.6deg)");
    expect(source).toContain('Promise.allSettled([motionAnimation.finished, tiltAnimation.finished])');
    expect(source).toMatch(/playInterimIdleShineOnce\(\);\s*startInterimIdleMotion\(\);/);
    expect(source).toContain('playInterimIdleShineOnce = () => {');
    expect(source).toContain('const interimIdleShineTimelines = new Set<gsap.core.Timeline>();');
    expect(source).toContain("onPulse: withHaptic ? () => triggerHaptic('light') : undefined");
    expect(source).toContain("if (activeFace === 'interim') startInterimIdleMotion();");
    expect(source).toContain("setCardIdleTiltState('none');");
    expect(source).toContain('stopInterimIdleMotion();');
    expect(source).not.toContain('iterations: Infinity');
    expect(source).not.toContain('window.setInterval(');
  });

  test('clips every unlocked-card shimmer to the actual card alpha mask', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
      'utf8',
    );
    const css = fs.readFileSync(
      path.resolve(process.cwd(), 'src/collectibles-screen.css'),
      'utf8',
    );
    expect(source).toContain('setLightMask(unlockedLight, safeCardMaskPath);');
    expect(source).toMatch(/surface--interim[\s\S]*light--interim/);
    expect(source).toMatch(/surface--unlocked[\s\S]*light--unlocked/);
    expect(source).toContain('cc-journey-interim-shine-light');
    expect(source).toMatch(/\.cc-journey-new-card-light \{[\s\S]*?-webkit-mask-type: alpha;[\s\S]*?mask-mode: alpha;/);
    expect(css).not.toContain('.journey-interim-shine-light {');
    expect(source).not.toContain('clearLightMask(unlockedLight);\n              setLightFrameScale(unlockedLight, 0.95);');
  });

  test('starts the modal-matched auto rotation and Legendary holo as soon as reveal settles', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
      'utf8',
    );

    expect(JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG).toBeCloseTo(21.6, 8);
    expect(JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS).toBe(6800);
    expect(source).toContain('JOURNEY_CARD_LEGENDARY_IDLE_TILT_DEG');
    expect(source).toContain('JOURNEY_CARD_LEGENDARY_IDLE_DURATION_MS');
    expect(source).toContain('const startUnlockedIdleMotion = () => {');
    expect(source).toContain('const tiltAnimation = unlockedAutoTilt.animate(');
    expect(source).toContain('const holoAnimation = unlockedLegendaryHolo.animate(shineKeyframes');
    expect(source).toContain('iterations: 1');
    expect(source).not.toContain('iterations: Infinity');
    expect(source).toContain("safeCardRarity !== 'legendary'");
    expect(source).toContain("if (activeFace === 'unlocked') scheduleUnlockedIdleMotion();");
    expect(source).toContain('JOURNEY_CARD_MOBILE_IDLE_CALM_MS');
    expect(source).toContain('JOURNEY_NEW_CARD_UNLOCKED_IDLE_REPEAT_DELAY_MS = 3000');
    expect(source).toContain('scheduleUnlockedIdleMotion(JOURNEY_NEW_CARD_UNLOCKED_IDLE_REPEAT_DELAY_MS);');
    expect(source).toContain("if (safeCardRarity === 'legendary') return;");
    expect(source).toContain('setLightMask(unlockedLegendaryHolo, safeCardMaskPath);');
    expect(source).toContain('unlockedIdleTiltAnimation?.cancel();');
    expect(source).toContain('unlockedIdleHoloAnimation?.cancel();');
    const coach = source.slice(
      source.indexOf('const stopContinueCoach = () => {'),
      source.indexOf('cleanupFns.push(() => {'),
    );
    expect(coach).not.toContain('stopUnlockedIdleMotion();');
  });
});
