import { Assets, Container, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { TILE } from './constants.js';
import { getJourneyForestBeeAssetForVelocity } from './journey-forest-bee-orbits.js';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.js';
import { getBubbleSpritePool } from './object-pool.js';
import { isUsablePixiImageTexture, reloadPixiImageTexture } from '../utils/pixi-image-texture-health.js';

const TAU = Math.PI * 2;
const HONEY_BEE_COUNT = 3;
export const HONEY_BEE_SIZE = TILE * 0.435456;
const HONEY_ORBIT_CLOCK_SECONDS = 3600;
const HONEY_DRAG_SCALE = 1.1;
const HONEY_FRONT_DEPTH_SCALE = 1.2;
const HONEY_MAX_DRAG_TRAIL = TILE * 2.4;
const HONEY_BEE_POOL_KEY = 'honey-idle-bees';
const HONEY_BEE_SOURCES = Array.from({ length: 7 }, (_, index) => {
  const name = `bee${index + 1}`;
  const use2x = typeof window !== 'undefined' && (window.devicePixelRatio || 1) > 1.5;
  return `./assets/shop/honey/${name}${use2x ? '@2x' : ''}.png`;
});

export interface HoneyBeeOrbitSample {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  depth: 'behind' | 'front';
}

export interface HoneyBeeOrbitProfile {
  phase: number;
  turnProgressOffset: number;
  direction: 1 | -1;
  revolutionsPerSecond: number;
  radiusX: number;
  radiusY: number;
  centerY: number;
  wobblePhase: number;
  wobbleAmount: number;
  bounceAmount: number;
  cutMix: number;
  reverseAfterLaps: number;
  trailStrength: number;
  trailSpring: number;
  trailDamping: number;
  chaseLaneX: number;
  chaseLaneY: number;
  chaseFanDistance: number;
  chaseDistancePulseRate: number;
  chaseDelaySeconds: number;
  chaseCurveAmount: number;
  chaseCurveRate: number;
  chaseCurvePhase: number;
  chaseCurveDirection: 1 | -1;
  entranceDelay: number;
  entranceDuration: number;
  sizeScale: number;
}

export interface HoneyBeeTrailState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

const randomBetween = (min: number, max: number, random: () => number) => (
  min + (max - min) * random()
);

export function createHoneyBeeOrbitProfiles(random: () => number = Math.random): HoneyBeeOrbitProfile[] {
  const radiusXBands = [[0.45, 0.48], [0.49, 0.52], [0.53, 0.55]] as const;
  const radiusYBands = [[0.39, 0.43], [0.45, 0.48], [0.50, 0.53]] as const;
  const chaseLaneX = [-0.30, 0.05, 0.34] as const;
  const chaseLaneY = [-0.20, -0.58, -0.34] as const;
  const chaseFanDistance = [-0.58, 0.12, 0.62] as const;
  const chaseDelayBands = [[0.035, 0.075], [0.105, 0.165], [0.19, 0.27]] as const;
  const chaseCurveDirections = [-1, 1, -1] as const;
  const turnProgressOffsets = [0.18, 0.43, 0.71] as const;
  return Array.from({ length: HONEY_BEE_COUNT }, (_, index) => {
    const [radiusXMin, radiusXMax] = radiusXBands[index];
    const [radiusYMin, radiusYMax] = radiusYBands[(index + 1) % HONEY_BEE_COUNT];
    const [chaseDelayMin, chaseDelayMax] = chaseDelayBands[index];
    return {
      phase: (index / HONEY_BEE_COUNT) * TAU + randomBetween(-0.24, 0.24, random),
      turnProgressOffset: turnProgressOffsets[index] + randomBetween(-0.035, 0.035, random),
      direction: random() > 0.5 ? 1 : -1,
      revolutionsPerSecond: randomBetween(0.19, 0.31, random),
      radiusX: TILE * randomBetween(radiusXMin, radiusXMax, random),
      radiusY: TILE * randomBetween(radiusYMin, radiusYMax, random),
      centerY: TILE * randomBetween(-0.015, 0.015, random),
      wobblePhase: randomBetween(0, TAU, random),
      wobbleAmount: TILE * randomBetween(0.009, 0.016, random),
      bounceAmount: TILE * randomBetween(0.008, 0.016, random),
      cutMix: randomBetween(0.08, 0.14, random),
      reverseAfterLaps: randomBetween(2.2, 4.2, random),
      trailStrength: randomBetween(0.58 + index * 0.17, 0.70 + index * 0.17, random),
      trailSpring: randomBetween(19 + index * 3, 25 + index * 3, random),
      trailDamping: randomBetween(7.2, 9.4, random),
      chaseLaneX: TILE * (chaseLaneX[index] + randomBetween(-0.035, 0.035, random)),
      chaseLaneY: TILE * (chaseLaneY[index] + randomBetween(-0.04, 0.04, random)),
      chaseFanDistance: TILE * (chaseFanDistance[index] + randomBetween(-0.04, 0.04, random)),
      chaseDistancePulseRate: randomBetween(0.72, 1.28, random),
      chaseDelaySeconds: randomBetween(chaseDelayMin, chaseDelayMax, random),
      chaseCurveAmount: TILE * randomBetween(0.16 + index * 0.035, 0.24 + index * 0.045, random),
      chaseCurveRate: randomBetween(0.52 + index * 0.12, 0.78 + index * 0.16, random),
      chaseCurvePhase: randomBetween(0, TAU, random),
      chaseCurveDirection: chaseCurveDirections[index],
      entranceDelay: index * 0.055 + randomBetween(0, 0.025, random),
      entranceDuration: randomBetween(0.30, 0.40, random),
      sizeScale: randomBetween(0.86, 1.14, random),
    };
  });
}

const DEFAULT_HONEY_BEE_PROFILES = createHoneyBeeOrbitProfiles(() => 0.5);

export function advanceHoneyBeeTrail(
  state: HoneyBeeTrailState,
  targetX: number,
  targetY: number,
  deltaSeconds: number,
  spring: number,
  damping: number,
  maxDistance: number,
): HoneyBeeTrailState {
  const dt = Math.min(0.05, Math.max(1 / 240, deltaSeconds));
  state.velocityX += (targetX - state.x) * spring * dt;
  state.velocityY += (targetY - state.y) * spring * dt;
  const dampingFactor = Math.exp(-damping * dt);
  state.velocityX *= dampingFactor;
  state.velocityY *= dampingFactor;
  state.x += state.velocityX * dt;
  state.y += state.velocityY * dt;
  const distance = Math.hypot(state.x, state.y);
  if (distance > maxDistance && distance > 0) {
    const bound = maxDistance / distance;
    state.x *= bound;
    state.y *= bound;
  }
  return state;
}

export function resolveHoneyBeeOrbitBlendTarget(dragging: boolean, trailDistance: number): number {
  const normalizedDistance = Math.min(1, Math.max(0, trailDistance) / (TILE * 0.35));
  if (dragging) return 0.8 - (normalizedDistance * 0.72);
  if (normalizedDistance >= 0.46) return 0.08;
  return 1 - (normalizedDistance / 0.46) * 0.92;
}

export function sampleHoneyBeeOrbit(
  profileOrIndex: HoneyBeeOrbitProfile | number,
  elapsedSeconds: number,
  lagX = 0,
  lagY = 0,
): HoneyBeeOrbitSample {
  const profile = typeof profileOrIndex === 'number'
    ? DEFAULT_HONEY_BEE_PROFILES[profileOrIndex % HONEY_BEE_COUNT]
    : profileOrIndex;
  const halfCycleSeconds = profile.reverseAfterLaps / profile.revolutionsPerSecond;
  const turnPosition = profile.turnProgressOffset + Math.max(0, elapsedSeconds) / halfCycleSeconds;
  const turnIndex = Math.floor(turnPosition);
  const turnProgress = turnPosition - turnIndex;
  const easedTurnProgress = 0.5 - (0.5 * Math.cos(Math.PI * turnProgress));
  const forward = turnIndex % 2 === 0;
  const travelProgress = forward ? easedTurnProgress : 1 - easedTurnProgress;
  const angle = profile.phase
    + travelProgress * TAU * profile.reverseAfterLaps * profile.direction;
  const turnVelocity = Math.sin(Math.PI * turnProgress)
    * (forward ? 1 : -1)
    * profile.direction;
  const wobble = Math.sin(angle * 2.3 + profile.wobblePhase) * profile.wobbleAmount;
  const cutX = (
    Math.cos(angle) * (1 - profile.cutMix)
    + Math.cos(angle * 2.15 + profile.wobblePhase) * profile.cutMix
  );
  const cutY = (
    Math.sin(angle) * (1 - profile.cutMix)
    + Math.sin(angle * 1.72 - profile.wobblePhase) * profile.cutMix
  );
  const verticalBounce = Math.sin(angle * 3.35 + profile.wobblePhase) * profile.bounceAmount;
  return {
    x: cutX * profile.radiusX + wobble + lagX,
    y: profile.centerY + cutY * profile.radiusY + verticalBounce + lagY,
    velocityX: turnVelocity * (-Math.sin(angle) * profile.radiusX),
    velocityY: turnVelocity * (Math.cos(angle) * profile.radiusY),
    depth: Math.sin(angle) < 0 ? 'behind' : 'front',
  };
}

export interface HoneyBeeIdleOrbitController {
  dispose(): void;
  setDragging(dragging: boolean): void;
  updateDragMotion(offsetX: number, offsetY: number, velocityX: number, velocityY: number): void;
  getSnapshot(): { disposed: boolean; beeCount: number; tweenCount: number };
}

export function startHoneyBeeIdleOrbit(tile: any): HoneyBeeIdleOrbitController | null {
  const host = tile?.rotG;
  if (!host || host.destroyed) return null;

  // Never attach Texture.from(path)'s unresolved placeholder to a live Pixi
  // sprite. On iOS that source can be invalidated after cache pressure while
  // the Honey controller itself remains alive, leaving three moving but empty
  // sprites. Keep the pooled sprites empty until a decoded texture is ready.
  const textures = HONEY_BEE_SOURCES.map((source) => {
    const cached = Assets.get(source) as Texture | undefined;
    return isUsablePixiImageTexture(cached) ? cached : Texture.EMPTY;
  });
  const spritePool = getBubbleSpritePool(() => textures[0] || Texture.EMPTY, HONEY_BEE_POOL_KEY);
  const behindLayer = new Container();
  behindLayer.label = 'honey-idle-bee-orbit-behind';
  behindLayer.eventMode = 'none';
  behindLayer.interactiveChildren = false;
  behindLayer.zIndex = -2;
  const frontLayer = new Container();
  frontLayer.label = 'honey-idle-bee-orbit-front';
  frontLayer.eventMode = 'none';
  frontLayer.interactiveChildren = false;
  frontLayer.zIndex = 12;
  host.sortableChildren = true;
  host.addChild(behindLayer, frontLayer);
  host.sortChildren();

  const profiles = createHoneyBeeOrbitProfiles();
  const bees = Array.from({ length: HONEY_BEE_COUNT }, (_, index) => {
    const bee = spritePool.acquire(textures[index % textures.length]);
    const size = HONEY_BEE_SIZE * profiles[index].sizeScale;
    bee.label = `honey-idle-bee-${index + 1}`;
    bee.eventMode = 'none';
    bee.anchor.set(0.5);
    bee.width = size;
    bee.height = size;
    const baseScaleX = bee.scale.x;
    const baseScaleY = bee.scale.y;
    bee.alpha = 0;
    bee.scale.set(0);
    frontLayer.addChild(bee);
    return {
      bee,
      asset: '',
      size,
      baseScaleX,
      baseScaleY,
      depthScale: 1,
      orbitBlend: 1,
      chaseLaneBlend: 0,
      chaseDelayRemaining: 0,
      reentryPhasePending: false,
      trail: { x: 0, y: 0, velocityX: 0, velocityY: 0 } as HoneyBeeTrailState,
    };
  });

  const applyBeeTexture = (state: (typeof bees)[number], texture: Texture): void => {
    if (!texture || texture === Texture.EMPTY || !isUsablePixiImageTexture(texture)) return;
    state.bee.texture = texture;
    // Width/height must be reapplied after replacing Texture.EMPTY. Otherwise
    // Pixi preserves the placeholder-derived scale against the decoded PNG's
    // much larger natural dimensions and the bee can cover the whole screen.
    state.bee.width = state.size;
    state.bee.height = state.size;
    state.baseScaleX = state.bee.scale.x;
    state.baseScaleY = state.bee.scale.y;
  };

  let disposed = false;
  let dragging = false;
  let dragScale = 1;
  let lastElapsed = 0;
  let lastPaintElapsed = Number.NEGATIVE_INFINITY;
  let lastDragOffsetX = 0;
  let lastDragOffsetY = 0;
  let chasePerpendicularX = 0;
  let chasePerpendicularY = 1;
  let chaseFanStrength = 0;
  const clock = { elapsed: 0 };
  const render = (force = false) => {
    if (disposed || tile?.destroyed || host.destroyed) return;
    const idleFps = MOBILE_RUNTIME_PROFILE.settledIdleMaxFramesPerSecond;
    const isEntranceActive = clock.elapsed < 0.6;
    if (!force && !dragging && !isEntranceActive && idleFps > 0) {
      const minIdleFrameSeconds = 1 / idleFps;
      if (clock.elapsed - lastPaintElapsed < minIdleFrameSeconds) return;
    }
    lastPaintElapsed = clock.elapsed;
    const deltaSeconds = Math.min(0.05, Math.max(1 / 240, clock.elapsed - lastElapsed || 1 / 60));
    lastElapsed = clock.elapsed;
    dragScale += ((dragging ? HONEY_DRAG_SCALE : 1) - dragScale) * 0.16;
    bees.forEach((state, index) => {
      const profile = profiles[index];
      state.chaseLaneBlend += ((dragging ? 1 : 0) - state.chaseLaneBlend) * (dragging ? 0.16 : 0.025);
      const chaseDistancePulse = 0.78 + Math.sin(
        clock.elapsed * TAU * profile.chaseDistancePulseRate + profile.wobblePhase,
      ) * 0.22;
      const laneTargetX = (
        profile.chaseLaneX
        + chasePerpendicularX * profile.chaseFanDistance * chaseFanStrength
      ) * chaseDistancePulse * state.chaseLaneBlend;
      const laneTargetY = (
        profile.chaseLaneY
        + chasePerpendicularY * profile.chaseFanDistance * chaseFanStrength
      ) * chaseDistancePulse * state.chaseLaneBlend;
      state.chaseDelayRemaining = Math.max(0, state.chaseDelayRemaining - deltaSeconds);
      const approachX = laneTargetX - state.trail.x;
      const approachY = laneTargetY - state.trail.y;
      const approachLength = Math.hypot(approachX, approachY) || 1;
      const curveEnvelope = Math.min(1, approachLength / (TILE * 0.42));
      const curveWave = Math.sin(
        clock.elapsed * TAU * profile.chaseCurveRate + profile.chaseCurvePhase,
      );
      const curveOffset = profile.chaseCurveDirection
        * profile.chaseCurveAmount
        * curveEnvelope
        * (0.68 + Math.abs(curveWave) * 0.32);
      const curvedTargetX = laneTargetX + (-approachY / approachLength) * curveOffset;
      const curvedTargetY = laneTargetY + (approachX / approachLength) * curveOffset;
      const chaseTargetX = state.chaseDelayRemaining > 0 ? state.trail.x : curvedTargetX;
      const chaseTargetY = state.chaseDelayRemaining > 0 ? state.trail.y : curvedTargetY;
      advanceHoneyBeeTrail(
        state.trail,
        chaseTargetX,
        chaseTargetY,
        deltaSeconds,
        profile.trailSpring,
        profile.trailDamping,
        HONEY_MAX_DRAG_TRAIL * profile.trailStrength,
      );
      const trailDistance = Math.hypot(state.trail.x, state.trail.y);
      const orbitBlendTarget = resolveHoneyBeeOrbitBlendTarget(dragging, trailDistance);
      state.orbitBlend += (orbitBlendTarget - state.orbitBlend) * (dragging ? 0.16 : 0.09);
      if (state.reentryPhasePending && state.orbitBlend < 0.24) {
        profile.phase += randomBetween(-Math.PI, Math.PI, Math.random);
        state.reentryPhasePending = false;
      }
      const orbitSample = sampleHoneyBeeOrbit(profile, clock.elapsed);
      const chaseVelocityLength = Math.hypot(state.trail.velocityX, state.trail.velocityY);
      const chaseDirectionX = chaseVelocityLength > 0.01 ? state.trail.velocityX : -state.trail.x;
      const chaseDirectionY = chaseVelocityLength > 0.01 ? state.trail.velocityY : -state.trail.y;
      const chaseLength = Math.hypot(chaseDirectionX, chaseDirectionY) || 1;
      const chaseWobble = Math.sin(
        clock.elapsed * TAU * (2.4 + index * 0.35) + profile.wobblePhase,
      ) * TILE * 0.022 * (1 - state.orbitBlend);
      const chaseWobbleX = (-chaseDirectionY / chaseLength) * chaseWobble;
      const chaseWobbleY = (chaseDirectionX / chaseLength) * chaseWobble;
      const nervousX = Math.sin(clock.elapsed * TAU * (4.8 + index * 0.7) + profile.wobblePhase)
        * TILE * 0.005;
      const nervousY = Math.cos(clock.elapsed * TAU * (5.6 + index * 0.6) - profile.wobblePhase)
        * TILE * 0.004;
      const toHoneyX = -(state.trail.x + orbitSample.x * state.orbitBlend);
      const toHoneyY = -(state.trail.y + orbitSample.y * state.orbitBlend);
      const chaseHeadingBlend = 1 - state.orbitBlend;
      const asset = getJourneyForestBeeAssetForVelocity(
        orbitSample.velocityX * state.orbitBlend + toHoneyX * chaseHeadingBlend,
        orbitSample.velocityY * state.orbitBlend + toHoneyY * chaseHeadingBlend,
        index % 2 === 0 ? 'bee1' : 'bee3',
      );
      if (state.asset !== asset) {
        const assetIndex = Math.max(0, Number(asset.slice(3)) - 1);
        applyBeeTexture(state, textures[assetIndex] || textures[0]);
        state.asset = asset;
      }
      state.bee.x = state.trail.x
        + orbitSample.x * state.orbitBlend
        + chaseWobbleX
        + nervousX;
      state.bee.y = state.trail.y
        + orbitSample.y * state.orbitBlend
        + chaseWobbleY
        + nervousY;
      const targetLayer = orbitSample.depth === 'behind' ? behindLayer : frontLayer;
      const entranceProgress = Math.max(0, Math.min(1,
        (clock.elapsed - profile.entranceDelay) / profile.entranceDuration,
      ));
      const entranceOvershoot = entranceProgress < 1
        ? 1 + 2.70158 * Math.pow(entranceProgress - 1, 3)
          + 1.70158 * Math.pow(entranceProgress - 1, 2)
        : 1;
      const visibleLayer = entranceProgress < 1 ? frontLayer : targetLayer;
      if (state.bee.parent !== visibleLayer) visibleLayer.addChild(state.bee);
      state.bee.alpha = entranceProgress;
      const targetDepthScale = orbitSample.depth === 'front' ? HONEY_FRONT_DEPTH_SCALE : 1;
      state.depthScale += (targetDepthScale - state.depthScale) * 0.14;
      const wingBounce = 1
        + Math.sin((clock.elapsed * TAU * 2.7) + index) * 0.038
        + Math.sin((clock.elapsed * TAU * 6.1) + profile.wobblePhase) * 0.008;
      state.bee.scale.set(
        state.baseScaleX * wingBounce * dragScale * state.depthScale * entranceOvershoot,
        state.baseScaleY * wingBounce * dragScale * state.depthScale * entranceOvershoot,
      );
    });
  };
  render(true);

  // Preloading normally makes this a cache-only path. If iOS discarded or
  // invalidated a source, reload it once and update the existing three pooled
  // sprites in place; no sprite/ticker/timeline is created by recovery.
  void Promise.all(HONEY_BEE_SOURCES.map(async (source, index) => {
    const cached = Assets.get(source) as Texture | undefined;
    if (isUsablePixiImageTexture(cached)) return { index, texture: cached };
    try {
      const loaded = await Assets.load(source) as Texture | undefined;
      if (isUsablePixiImageTexture(loaded)) return { index, texture: loaded };
    } catch {}
    try {
      const recovered = await reloadPixiImageTexture(source);
      return { index, texture: recovered };
    } catch {
      return { index, texture: null };
    }
  })).then((resolved) => {
    if (disposed) return;
    resolved.forEach(({ index, texture }) => {
      if (texture && isUsablePixiImageTexture(texture)) textures[index] = texture;
    });
    bees.forEach((state, index) => {
      const assetIndex = state.asset
        ? Math.max(0, Number(state.asset.slice(3)) - 1)
        : index % textures.length;
      const texture = textures[assetIndex] || textures[0];
      applyBeeTexture(state, texture);
    });
    render(true);
  }).catch(() => {});

  const tween = animationManager.trackExternalTween(gsap.to(clock, {
    elapsed: HONEY_ORBIT_CLOCK_SECONDS,
    duration: HONEY_ORBIT_CLOCK_SECONDS,
    ease: 'none',
    onUpdate: render,
  }));

  const setDragging = (nextDragging: boolean) => {
    const wasDragging = dragging;
    dragging = nextDragging;
    if (!wasDragging && dragging) {
      lastDragOffsetX = 0;
      lastDragOffsetY = 0;
      bees.forEach((state, index) => {
        state.chaseDelayRemaining = profiles[index].chaseDelaySeconds;
      });
    }
    if (!dragging) {
      if (wasDragging) bees.forEach((state) => {
        state.chaseDelayRemaining = 0;
        state.reentryPhasePending = true;
      });
    }
  };

  const updateDragMotion = (
    offsetX: number,
    offsetY: number,
    velocityX: number,
    velocityY: number,
  ) => {
    if (!dragging) return;
    const deltaX = offsetX - lastDragOffsetX;
    const deltaY = offsetY - lastDragOffsetY;
    lastDragOffsetX = offsetX;
    lastDragOffsetY = offsetY;
    const speed = Math.hypot(velocityX, velocityY);
    if (speed > 0.004) {
      chasePerpendicularX = -velocityY / speed;
      chasePerpendicularY = velocityX / speed;
    }
    chaseFanStrength += (Math.min(1, speed / 0.32) - chaseFanStrength) * 0.28;
    bees.forEach((state, index) => {
      state.chaseLaneBlend = 1;
      state.trail.x -= deltaX;
      state.trail.y -= deltaY;
      // Pointer movement and GSAP's orbit clock do not necessarily paint in
      // the same frame. Counter-shift the already-rendered sprite immediately
      // as well as its logical trail so the bee cluster cannot tug Honey's
      // silhouette for one frame before the next orbit render catches up.
      state.bee.x -= deltaX;
      state.bee.y -= deltaY;
      const distance = Math.hypot(state.trail.x, state.trail.y);
      const maxDistance = HONEY_MAX_DRAG_TRAIL * profiles[index].trailStrength;
      if (distance > maxDistance && distance > 0) {
        const bound = maxDistance / distance;
        state.trail.x *= bound;
        state.trail.y *= bound;
      }
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try { animationManager.killExternalTween(tween); } catch {
      try { tween.kill(); } catch {}
    }
    bees.forEach(({ bee }) => spritePool.release(bee));
    bees.length = 0;
    [behindLayer, frontLayer].forEach((layer) => {
      try { layer.parent?.removeChild(layer); } catch {}
      try { layer.destroy({ children: false }); } catch {}
    });
  };

  return {
    dispose,
    setDragging,
    updateDragMotion,
    getSnapshot: () => ({
      disposed,
      beeCount: disposed ? 0 : bees.length,
      tweenCount: disposed ? 0 : 1,
    }),
  };
}
