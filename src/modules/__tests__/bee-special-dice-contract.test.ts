import fs from 'node:fs';
import path from 'node:path';
import {
  BEE_DRAG_FRAME_SECONDS,
  BEE_IDLE_FRAME_SECONDS,
  BEE_ORIGINAL_FRAME_SECONDS,
  getBeeIdleFrameIndex,
  isBeeDiceHostPoseSettled,
  sampleBeeDiceIdleMotion,
  shouldFlipBeeDiceForViewport,
} from '../bee-dice-idle';
import {
  getSpecialDiceFinaleFxForArchetype,
  getSpecialDiceVariant,
  getSpecialDiceSplashOptions,
} from '../special-dice-registry';

describe('Forest Bee special-die contract', () => {
  test('inherits Wild Star gameplay but owns Bee visuals and no orbit', () => {
    const bee = getSpecialDiceVariant('bee');
    expect(bee).toMatchObject({
      archetype: 'wild-star',
      idleOrbit: false,
      idleMotion: 'bee-sprite-cycle',
      finaleScene: 'bee-forest-flight',
    });
    expect(getSpecialDiceFinaleFxForArchetype(bee?.archetype)).toBe('star');
    expect(getSpecialDiceSplashOptions(bee)).toMatchObject({
      text: 'WEEEE!',
      color: '#E6815E',
      finaleScene: 'bee-forest-flight',
    });
  });

  test('uses original speed plus four times that speed while dragging', () => {
    expect(BEE_ORIGINAL_FRAME_SECONDS).toBe(0.16);
    expect(BEE_DRAG_FRAME_SECONDS).toBeCloseTo(0.032, 8);
    expect([0, 0.032, 0.064, 0.096, 0.128].map((seconds) => (
      getBeeIdleFrameIndex(seconds, 4, BEE_DRAG_FRAME_SECONDS)
    ))).toEqual([0, 1, 2, 3, 0]);
  });

  test('cycles sequentially through all four idle frames', () => {
    expect(BEE_IDLE_FRAME_SECONDS).toBeCloseTo(BEE_ORIGINAL_FRAME_SECONDS / 4, 8);
    expect(BEE_IDLE_FRAME_SECONDS).toBeCloseTo(0.04, 8);
    expect([0, 0.04, 0.08, 0.12, 0.16].map((seconds) => getBeeIdleFrameIndex(seconds)))
      .toEqual([0, 1, 2, 3, 0]);
  });

  test('faces right on the left half and flips every Bee frame toward the left on the right half', () => {
    expect(shouldFlipBeeDiceForViewport(0, 390)).toBe(false);
    expect(shouldFlipBeeDiceForViewport(194.99, 390)).toBe(false);
    expect(shouldFlipBeeDiceForViewport(195, 390)).toBe(false);
    expect(shouldFlipBeeDiceForViewport(195.01, 390)).toBe(true);
    expect(shouldFlipBeeDiceForViewport(390, 390)).toBe(true);
    expect(shouldFlipBeeDiceForViewport(Number.NaN, 390)).toBe(false);
    expect(shouldFlipBeeDiceForViewport(300, 0)).toBe(false);

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/bee-dice-idle.ts'),
      'utf8',
    );
    expect(source).toContain('globalCenterX = base.getGlobalPosition().x;');
    expect(source).toContain('? -originalBaseScaleX\n      : originalBaseScaleX;');
    expect(source).toContain('refreshFacing: applyArtworkFacing,');
    expect(source).toContain('if (!base.destroyed && base.scale) base.scale.x = originalBaseScaleX;');

    const dragSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/drag-core.ts'),
      'utf8',
    );
    expect(dragSource.indexOf('t.position.set(parentPoint.x, parentPoint.y);')).toBeLessThan(
      dragSource.indexOf('refreshSpecialDiceIdleDragFacing(t);'),
    );
  });

  test('does not adopt a transient squash or stretch frame as the idle host baseline', () => {
    expect(isBeeDiceHostPoseSettled(1, 1)).toBe(true);
    expect(isBeeDiceHostPoseSettled(0.98, 1.02)).toBe(true);
    expect(isBeeDiceHostPoseSettled(0.08, 1)).toBe(false);
    expect(isBeeDiceHostPoseSettled(1.2, 0.8)).toBe(false);
    expect(isBeeDiceHostPoseSettled(0, 0)).toBe(false);

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/bee-dice-idle.ts'),
      'utf8',
    );
    expect(source).toContain('if (!captureSettledPose()) return;');
  });

  test('keeps the complete Bee die on a gentle hover, wobble and bounce', () => {
    const samples = Array.from({ length: 80 }, (_, index) => sampleBeeDiceIdleMotion(index / 60));
    expect(Math.max(...samples.map((sample) => Math.abs(sample.offsetX)))).toBeLessThanOrEqual(2.8);
    expect(Math.max(...samples.map((sample) => Math.abs(sample.offsetY)))).toBeLessThanOrEqual(5);
    expect(Math.max(...samples.map((sample) => Math.abs(sample.rotation)))).toBeLessThanOrEqual(0.025);
    expect(Math.min(...samples.map((sample) => sample.sizeScale))).toBeGreaterThanOrEqual(0.982);
    expect(Math.max(...samples.map((sample) => sample.sizeScale))).toBeLessThanOrEqual(1.018);
  });

  test('all supplied Bee assets retain complete 1x and 2x pairs', () => {
    for (const [prefix, count] of [['bee', 4], ['fly', 4], ['bush', 4], ['leaf', 6]] as const) {
      for (let index = 1; index <= count; index += 1) {
        for (const density of ['', '@2x']) {
          expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/bee/${prefix}${index}${density}.png`))).toBe(true);
        }
      }
    }
  });
});
