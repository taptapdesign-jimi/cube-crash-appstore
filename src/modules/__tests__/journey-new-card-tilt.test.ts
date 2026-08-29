import fs from 'node:fs';
import path from 'node:path';
import { createJourneyNewCardTiltProfile } from '../journey-new-card-tilt';

describe('Journey New Reward card tilt handoff', () => {
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
    expect(source).toMatch(/\.set\(unlockedSurface, \{[\s\S]*?y: -18,[\s\S]*?scale: 0\.58/);
  });

  test('clips every unlocked-card shimmer to the actual card alpha mask', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
      'utf8',
    );
    expect(source).toContain('setLightMask(unlockedLight, safeCardPath);');
    expect(source).toMatch(/surface--interim[\s\S]*light--interim/);
    expect(source).toMatch(/surface--unlocked[\s\S]*light--unlocked/);
    expect(source).toContain('-webkit-mask-type: alpha;');
    expect(source).toContain('mask-mode: alpha;');
    expect(source).not.toContain('clearLightMask(unlockedLight);\n              setLightFrameScale(unlockedLight, 0.95);');
  });
});
