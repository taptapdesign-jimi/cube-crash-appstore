import fs from 'node:fs';
import path from 'node:path';
import { createJourneyNewCardTiltProfile } from '../journey-new-card-tilt';

describe('Journey New Reward card tilt handoff', () => {
  test('keeps both transition tilts bounded at 15 degrees and settles like the card modal', () => {
    const left = createJourneyNewCardTiltProfile(() => 0);
    expect(left).toEqual({
      interimRestRotationDeg: -4.75,
      interimRestRotateXDeg: -3,
      interimRestRotateYDeg: -4,
      interimExitRotationDeg: -9,
      interimExitRotateXDeg: -9,
      interimExitRotateYDeg: -9,
      unlockedEntryRotationDeg: 9,
      unlockedEntryRotateXDeg: 9,
      unlockedEntryRotateYDeg: 9,
      unlockedRestRotationDeg: 4.75,
      unlockedRestRotateXDeg: 2,
      unlockedRestRotateYDeg: 3,
      unlockedExitRotationDeg: 9,
      unlockedExitRotateXDeg: -9,
      unlockedExitRotateYDeg: 9,
    });

    const right = createJourneyNewCardTiltProfile(() => 1);
    expect(right).toEqual({
      interimRestRotationDeg: 6.25,
      interimRestRotateXDeg: -6,
      interimRestRotateYDeg: 7,
      interimExitRotationDeg: 15,
      interimExitRotateXDeg: -15,
      interimExitRotateYDeg: 15,
      unlockedEntryRotationDeg: -15,
      unlockedEntryRotateXDeg: 15,
      unlockedEntryRotateYDeg: -15,
      unlockedRestRotationDeg: -6.25,
      unlockedRestRotateXDeg: 4,
      unlockedRestRotateYDeg: -6,
      unlockedExitRotationDeg: -15,
      unlockedExitRotateXDeg: -15,
      unlockedExitRotateYDeg: -15,
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
