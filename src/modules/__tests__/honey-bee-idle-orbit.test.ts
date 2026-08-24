import fs from 'node:fs';
import path from 'node:path';
import { TILE } from '../constants';
import {
  advanceHoneyBeeTrail,
  createHoneyBeeOrbitProfiles,
  HONEY_BEE_SIZE,
  resolveHoneyBeeOrbitBlendTarget,
  sampleHoneyBeeOrbit,
} from '../honey-bee-idle-orbit';

const source = fs.readFileSync(
  path.resolve(__dirname, '../honey-bee-idle-orbit.ts'),
  'utf8',
);
const dragSource = fs.readFileSync(path.resolve(__dirname, '../drag-core.ts'), 'utf8');
const idleSource = fs.readFileSync(path.resolve(__dirname, '../special-dice-idle.ts'), 'utf8');

describe('Honey bee idle orbit', () => {
  test('uses three bees at the latest accepted twenty-percent larger size', () => {
    let seed = 13;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const profiles = createHoneyBeeOrbitProfiles(random);

    expect(HONEY_BEE_SIZE).toBeCloseTo(TILE * 0.24 * 0.6 * 1.2 * 1.4 * 1.5 * 1.2, 6);
    expect(profiles).toHaveLength(3);
    expect(new Set(profiles.map((profile) => profile.phase.toFixed(4))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.radiusX.toFixed(4))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.radiusY.toFixed(4))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.revolutionsPerSecond.toFixed(4))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.turnProgressOffset.toFixed(4))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.reverseAfterLaps.toFixed(4))).size).toBe(3);
    expect(profiles.every((profile) => profile.reverseAfterLaps >= 2.2 && profile.reverseAfterLaps <= 4.2)).toBe(true);
  });

  test('keeps randomized drag-trailing flights within forty percent beyond Honey', () => {
    const profiles = createHoneyBeeOrbitProfiles(() => 0.999);
    const beeHalfSize = (HONEY_BEE_SIZE * 1.14 * 1.1) / 2;
    const tileHalfSize = TILE / 2;
    for (let frame = 0; frame < 360; frame += 1) {
      const elapsed = frame / 60;
      const samples = profiles.map((profile) => sampleHoneyBeeOrbit(profile, elapsed));
      samples.forEach((sample) => {
        expect(Math.abs(sample.x) + beeHalfSize - tileHalfSize).toBeLessThanOrEqual(TILE * 0.4);
        expect(Math.abs(sample.y) + beeHalfSize - tileHalfSize).toBeLessThanOrEqual(TILE * 0.4);
      });
    }
  });

  test('switches depth by orbit half and reuses the Forest direction resolver', () => {
    const profile = {
      ...createHoneyBeeOrbitProfiles(() => 0.5)[0],
      phase: 0,
      direction: 1 as const,
      revolutionsPerSecond: 0.25,
    };
    expect(sampleHoneyBeeOrbit(profile, 1).depth).toBe('front');
    expect(sampleHoneyBeeOrbit(profile, 4).depth).toBe('behind');
    expect(source).toContain('getJourneyForestBeeAssetForVelocity');
    expect(source).toContain("targetLayer = orbitSample.depth === 'behind' ? behindLayer : frontLayer");
    expect(source).toContain("orbitSample.depth === 'front' ? HONEY_FRONT_DEPTH_SCALE : 1");
    expect(source).toContain('const HONEY_FRONT_DEPTH_SCALE = 1.2');
  });

  test('adds lightweight nervous motion without another animation owner', () => {
    expect(source).toContain('const nervousX = Math.sin(');
    expect(source).toContain('const nervousY = Math.cos(');
    expect(source).toContain('state.depthScale += (targetDepthScale - state.depthScale) * 0.14');
    expect(source.match(/animationManager\.trackExternalTween/g)).toHaveLength(1);
  });

  test('starts moving immediately with a pooled staggered front-layer bounce in', () => {
    const profiles = createHoneyBeeOrbitProfiles(() => 0.5);
    expect(profiles.every((profile) => profile.turnProgressOffset > 0.1)).toBe(true);
    expect(new Set(profiles.map((profile) => profile.entranceDelay.toFixed(3))).size).toBe(3);
    expect(source).toContain('bee.alpha = 0');
    expect(source).toContain('bee.scale.set(0)');
    expect(source).toContain('const entranceOvershoot = entranceProgress < 1');
    expect(source).toContain('entranceProgress < 1 ? frontLayer : targetLayer');
    expect(source).toContain('state.bee.alpha = entranceProgress');
    expect(source.match(/animationManager\.trackExternalTween/g)).toHaveLength(1);
  });

  test('reverses direction after several irregular cut-path laps', () => {
    const profile = {
      ...createHoneyBeeOrbitProfiles(() => 0.5)[0],
      phase: 0,
      direction: 1 as const,
      revolutionsPerSecond: 0.25,
      reverseAfterLaps: 2,
      wobblePhase: 0.4,
      cutMix: 0.16,
    };
    const outward = sampleHoneyBeeOrbit(profile, 4);
    const returning = sampleHoneyBeeOrbit(profile, 12);
    expect(Math.abs(outward.velocityY)).toBeGreaterThan(0);
    expect(Math.abs(returning.velocityY)).toBeGreaterThan(0);
    expect(outward.velocityY * returning.velocityY).toBeLessThan(0);
    expect(profile.cutMix).toBeGreaterThan(0);
    expect(profile.bounceAmount).toBeGreaterThan(0);
  });

  test('creates three lightweight elastic followers that lag farther and then catch Honey', () => {
    const profiles = createHoneyBeeOrbitProfiles(() => 0.5);
    expect(new Set(profiles.map((profile) => profile.trailStrength.toFixed(3))).size).toBe(3);
    const state = { x: 0, y: 0, velocityX: 0, velocityY: 0 };
    for (let frame = 0; frame < 24; frame += 1) {
      advanceHoneyBeeTrail(state, -TILE, TILE * 0.4, 1 / 60, 23, 8, TILE * 2.4);
    }
    const lagDistance = Math.hypot(state.x, state.y);
    expect(lagDistance).toBeGreaterThan(TILE * 0.35);
    expect(lagDistance).toBeLessThanOrEqual(TILE * 2.4);
    for (let frame = 0; frame < 120; frame += 1) {
      advanceHoneyBeeTrail(state, 0, 0, 1 / 60, 23, 8, TILE * 2.4);
    }
    expect(Math.hypot(state.x, state.y)).toBeLessThan(TILE * 0.02);
  });

  test('breaks the empty orbit during pursuit and restores it only near Honey', () => {
    expect(resolveHoneyBeeOrbitBlendTarget(true, 0)).toBeCloseTo(0.8, 5);
    expect(resolveHoneyBeeOrbitBlendTarget(true, TILE * 0.35)).toBeCloseTo(0.08, 5);
    expect(resolveHoneyBeeOrbitBlendTarget(false, TILE * 0.35)).toBeCloseTo(0.08, 5);
    expect(resolveHoneyBeeOrbitBlendTarget(false, 0)).toBe(1);
    expect(source).toContain('orbitSample.x * state.orbitBlend');
    expect(source).toContain('TILE * 0.022 * (1 - state.orbitBlend)');
    expect(source).toContain('state.reentryPhasePending && state.orbitBlend < 0.24');
  });

  test('fans all three chase paths apart more strongly during fast drag', () => {
    const profiles = createHoneyBeeOrbitProfiles(() => 0.5);
    expect(new Set(profiles.map((profile) => profile.chaseLaneX.toFixed(3))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.chaseLaneY.toFixed(3))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.chaseFanDistance.toFixed(3))).size).toBe(3);
    expect(source).toContain('chasePerpendicularX * profile.chaseFanDistance * chaseFanStrength');
    expect(source).toContain('chasePerpendicularY * profile.chaseFanDistance * chaseFanStrength');
    expect(source).toContain('clock.elapsed * TAU * profile.chaseDistancePulseRate');
    expect(source).toContain("((dragging ? 1 : 0) - state.chaseLaneBlend) * (dragging ? 0.16 : 0.025)");
  });

  test('gives all three followers independent delayed curved pursuit paths', () => {
    const profiles = createHoneyBeeOrbitProfiles(() => 0.5);
    expect(profiles[0].chaseDelaySeconds).toBeLessThan(profiles[1].chaseDelaySeconds);
    expect(profiles[1].chaseDelaySeconds).toBeLessThan(profiles[2].chaseDelaySeconds);
    expect(new Set(profiles.map((profile) => profile.chaseCurveAmount.toFixed(3))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.chaseCurveRate.toFixed(3))).size).toBe(3);
    expect(new Set(profiles.map((profile) => profile.chaseCurveDirection)).size).toBe(2);
    expect(source).toContain('state.chaseDelayRemaining = profiles[index].chaseDelaySeconds');
    expect(source).toContain('state.chaseDelayRemaining > 0 ? state.trail.x : curvedTargetX');
    expect(source).toContain('state.chaseDelayRemaining > 0 ? state.trail.y : curvedTargetY');
    expect(source).toContain('profile.chaseCurveAmount');
    expect(source).toContain('profile.chaseCurveRate');
  });

  test('keeps asynchronous pursuit inside the existing pooled single-owner loop', () => {
    expect(source).not.toContain('setInterval(');
    expect(source).not.toContain('requestAnimationFrame(');
    expect(source).not.toContain('ticker.add(');
    expect(source.match(/animationManager\.trackExternalTween/g)).toHaveLength(1);
    expect(source).toContain('bees.forEach(({ bee }) => spritePool.release(bee))');
  });

  test('recovers decoded bee textures without live Pixi placeholders or extra animation owners', () => {
    expect(source).not.toContain('Texture.from(source)');
    expect(source).toContain('isUsablePixiImageTexture(cached) ? cached : Texture.EMPTY');
    expect(source).toContain('await Assets.load(source)');
    expect(source).toContain('await reloadPixiImageTexture(source)');
    expect(source).toContain('if (disposed) return');
    expect(source.match(/animationManager\.trackExternalTween/g)).toHaveLength(1);
  });

  test('reapplies the authored local size whenever an empty texture becomes a decoded bee', () => {
    expect(source).toContain('const applyBeeTexture =');
    expect(source).toContain('state.bee.width = state.size');
    expect(source).toContain('state.bee.height = state.size');
    expect(source).toContain('state.baseScaleX = state.bee.scale.x');
    expect(source).toContain('state.baseScaleY = state.bee.scale.y');
    expect(source).not.toContain('state.bee.texture = textures[assetIndex]');
  });

  test('caps settled mobile idle painting while keeping entrance and drag at display cadence', () => {
    expect(source).toContain('MOBILE_RUNTIME_PROFILE.settledIdleMaxFramesPerSecond');
    expect(source).toContain('!dragging && !isEntranceActive && idleFps > 0');
    expect(source).toContain('clock.elapsed - lastPaintElapsed < minIdleFrameSeconds');
  });

  test('owns one tween and returns every sprite to the keyed pool on idempotent disposal', () => {
    expect(source).toContain("getBubbleSpritePool(() => textures[0] || Texture.EMPTY, HONEY_BEE_POOL_KEY)");
    expect(source).toContain('const HONEY_BEE_COUNT = 3');
    expect(source).toContain('animationManager.trackExternalTween(gsap.to(clock');
    expect(source).toContain('updateDragMotion');
    expect(source).toContain('dragScale');
    expect(source).toContain('state.baseScaleX * wingBounce * dragScale');
    expect(source).toContain('if (disposed) return');
    expect(source).toContain('bees.forEach(({ bee }) => spritePool.release(bee))');
  });

  test('retains the same Honey owner and counter-applies exact drag displacement', () => {
    expect(dragSource).toContain('if (!setSpecialDiceIdleDragging(t, true)) stopSpecialDiceIdleMotion(t)');
    expect(dragSource).toContain('px - drag.startX');
    expect(dragSource).toContain('py - drag.startY');
    expect(dragSource).toContain('drag.vx');
    expect(dragSource).toContain('drag.vy');
    expect(source).toContain('state.trail.x -= deltaX');
    expect(source).toContain('state.trail.y -= deltaY');
    expect(source).toContain('state.bee.x -= deltaX');
    expect(source).toContain('state.bee.y -= deltaY');
    expect(source).toContain('toHoneyX * chaseHeadingBlend');
    expect(dragSource).toContain('setSpecialDiceIdleDragging(t, false)');
    expect(idleSource).toContain("if (variant.id === 'honey' && tile._ccHoneyBeeIdleOrbit)");
    expect(idleSource).toContain('tile._ccHoneyBeeIdleOrbit.setDragging?.(false)');
  });
});
