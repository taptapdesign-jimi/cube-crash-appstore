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
    expect(source).toContain('animation: ccJourneyNewCardAutoTilt 3s ease-in-out infinite both;');
    expect(source).toContain('rotationZ: revealTilt.interimRestRotationDeg');
    expect(source).toContain('rotationX: revealTilt.interimExitRotateXDeg');
    expect(source).toContain('rotationY: revealTilt.interimExitRotateYDeg');
    expect(source).toContain('rotationX: revealTilt.unlockedEntryRotateXDeg');
    expect(source).toContain('rotationY: revealTilt.unlockedRestRotateYDeg');
    expect(source).toContain('rotationX: revealTilt.unlockedExitRotateXDeg');
    expect(source).toContain('.to(unlockedSurface, {');
    expect(source).not.toMatch(/\.to\(hero, \{[^}]*rotate:\s*0/s);
    expect(source).toContain('const coverExitDuration = rd(0.32);');
    expect(source).toContain('const cardEnterStart = 0;');
    expect(source).toContain('const cardEnterDuration = rd(0.52);');
    expect(source).toMatch(/\.to\(interimSurface, \{[\s\S]*?scale: 0,[\s\S]*?ease: 'back\.in\(1\.65\)'/);
    expect(source).toMatch(/\.set\(unlockedSurface, \{[\s\S]*?y: JOURNEY_NEW_CARD_UNLOCKED_OFFSET_Y_PX - 18,[\s\S]*?scale: 0\.58/);
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
    expect(source).toContain('setLightMask(unlockedLight, safeCardPath);');
    expect(source).toMatch(/surface--interim[\s\S]*light--interim/);
    expect(source).toMatch(/surface--unlocked[\s\S]*light--unlocked/);
    expect(source).toContain('cc-journey-interim-shine-light');
    expect(css).toMatch(/\.journey-interim-shine-light \{[\s\S]*?-webkit-mask-type: alpha;[\s\S]*?mask-mode: alpha;/);
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
    expect(source).toContain('unlockedIdleTiltAnimation = unlockedAutoTilt.animate(');
    expect(source).toContain('unlockedIdleHoloAnimation = unlockedLegendaryHolo.animate(shineKeyframes');
    expect(source).toContain("safeCardRarity !== 'legendary'");
    expect(source).toContain("if (activeFace === 'unlocked') startUnlockedIdleMotion();");
    expect(source).toContain("if (safeCardRarity === 'legendary') return;");
    expect(source).toContain('setLightMask(unlockedLegendaryHolo, safeCardPath);');
    expect(source).toContain('unlockedIdleTiltAnimation?.cancel();');
    expect(source).toContain('unlockedIdleHoloAnimation?.cancel();');
    const coach = source.slice(
      source.indexOf('const stopContinueCoach = () => {'),
      source.indexOf('cleanupFns.push(() => {'),
    );
    expect(coach).not.toContain('stopUnlockedIdleMotion();');
  });
});
