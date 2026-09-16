import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { getBubbleSpritePool } from './object-pool.ts';

export const JUICE_FINALE_PROP_SOURCES = {
  cup: './assets/shop/juice/casa.png',
  lid: './assets/shop/juice/poklopac.png',
  straw: './assets/shop/juice/slamka.png',
} as const;

export type JuiceFinaleProp = keyof typeof JUICE_FINALE_PROP_SOURCES;
export const JUICE_FINALE_PROP_POOL_KEY = 'juice-finale-flight-props';
const cachedTextures: Partial<Record<JuiceFinaleProp, Texture>> = {};
let pendingPreload: Promise<void> | null = null;

/** Warm 1x prop art during Beach board preparation without delaying board entry. */
export function preloadJuiceFinalePropTextures(): Promise<void> {
  if (pendingPreload) return pendingPreload;
  const missing = (Object.keys(JUICE_FINALE_PROP_SOURCES) as JuiceFinaleProp[])
    .filter((prop) => !cachedTextures[prop] || cachedTextures[prop]?.destroyed);
  if (missing.length === 0) return Promise.resolve();
  pendingPreload = Promise.all(missing.map(async (prop) => {
    try {
      const texture = await Assets.load(JUICE_FINALE_PROP_SOURCES[prop]) as Texture;
      if (texture && !texture.destroyed) cachedTextures[prop] = texture;
    } catch {
      // A missing optional prop never blocks the existing bubble finale.
    }
  })).then(() => {}).finally(() => { pendingPreload = null; });
  return pendingPreload;
}

export function getJuiceFinalePropTextures(): Partial<Record<JuiceFinaleProp, Texture>> {
  const available: Partial<Record<JuiceFinaleProp, Texture>> = {};
  for (const prop of Object.keys(JUICE_FINALE_PROP_SOURCES) as JuiceFinaleProp[]) {
    const texture = cachedTextures[prop];
    if (texture && !texture.destroyed) available[prop] = texture;
  }
  return available;
}

type FlightPlan = {
  startX: number;
  startY: number;
  endY: number;
  horizontalMargin: number;
  size: number;
  depth: number;
  delay: number;
  duration: number;
  riseAcceleration: number;
  driftX: number;
  weaveAmplitude: number;
  weaveCycles: number;
  weavePhase: number;
  weaveDirection: -1 | 1;
  secondaryWeaveCycles: number;
  secondaryWeavePhase: number;
  rotationAmplitude: number;
  rotationCycles: number;
  rotationPhase: number;
  rotationDirection: -1 | 1;
};

const PROFILES: Record<JuiceFinaleProp, { x: number; y: number; size: number; depth: number; delay: number; duration: number }> = {
  cup: { x: 0.31, y: 1.11, size: 144, depth: -20, delay: 0.55, duration: 2.90 },
  lid: { x: 0.55, y: 1.07, size: 135, depth: 20, delay: 0.26, duration: 2.34 },
  straw: { x: 0.78, y: 1.025, size: 76, depth: 30, delay: 0, duration: 1.88 },
};

/** Draw a fresh, independent upward route for every part of every finale. */
export function createJuiceFinalePropFlightPlan(
  prop: JuiceFinaleProp,
  screenW: number,
  screenH: number,
  random: () => number = Math.random,
): FlightPlan {
  const profile = PROFILES[prop];
  const horizontalMargin = Math.min(screenW * 0.5, profile.size * 0.5 + 6);
  const keepInside = (x: number) => Math.max(horizontalMargin, Math.min(screenW - horizontalMargin, x));
  const startX = keepInside(screenW * profile.x + (random() - 0.5) * screenW * 0.05);
  const driftX = (random() - 0.5) * screenW * 0.06;
  const horizontalRoom = Math.max(0, Math.min(startX - horizontalMargin, screenW - horizontalMargin - startX));
  const weaveAmplitude = Math.min(
    screenW * (0.09 + random() * 0.035),
    Math.max(0, horizontalRoom - Math.abs(driftX)),
  );
  const rotationDegrees = 30 + random() * 10;
  return {
    startX,
    startY: screenH * profile.y,
    endY: -screenH * (0.15 + random() * 0.06),
    horizontalMargin,
    size: profile.size,
    depth: profile.depth,
    delay: profile.delay,
    duration: profile.duration,
    riseAcceleration: 0.12 + random() * 0.16,
    driftX,
    weaveAmplitude,
    weaveCycles: 2.0 + random() * 2.10,
    weavePhase: random() * Math.PI * 2,
    weaveDirection: random() < 0.5 ? -1 : 1,
    secondaryWeaveCycles: 0.65 + random() * 1.35,
    secondaryWeavePhase: random() * Math.PI * 2,
    rotationAmplitude: rotationDegrees * Math.PI / 180,
    rotationCycles: 2.0 + random() * 2.0,
    rotationPhase: random() * Math.PI * 2,
    rotationDirection: random() < 0.5 ? -1 : 1,
  };
}

export function sampleJuiceFinalePropPose(plan: FlightPlan, progress: number): { x: number; y: number; rotation: number } {
  const p = Math.max(0, Math.min(1, progress));
  // Every route rises strictly upward; acceleration varies without changing
  // the part's authored launch order or overall flight duration.
  const upwardProgress = p + plan.riseAcceleration * p * (p - 1);
  // Smoothly reach full sway by 20% of flight without a speed kink at handoff.
  const swayEnvelope = Math.sin(Math.min(1, p * 5) * Math.PI / 2);
  const mainWeave = Math.sin(plan.weavePhase + p * Math.PI * 2 * plan.weaveCycles);
  const secondaryWeave = Math.sin(plan.secondaryWeavePhase + p * Math.PI * 2 * plan.secondaryWeaveCycles);
  return {
    x: plan.startX + plan.driftX * p + plan.weaveDirection * plan.weaveAmplitude
      * (mainWeave * 0.75 + secondaryWeave * 0.25) * swayEnvelope,
    y: plan.startY + (plan.endY - plan.startY) * upwardProgress,
    rotation: plan.rotationDirection * plan.rotationAmplitude
      * Math.sin(plan.rotationPhase + p * Math.PI * 2 * plan.rotationCycles) * swayEnvelope,
  };
}

export type JuiceFinalePropFlight = { release: () => void };

export function createJuiceFinalePropFlights(
  container: Container,
  textures: Partial<Record<JuiceFinaleProp, Texture>>,
  screenW: number,
  screenH: number,
  onComplete: () => void,
  onLaunch?: (prop: JuiceFinaleProp) => void,
): JuiceFinalePropFlight {
  const pool = getBubbleSpritePool(() => Texture.WHITE, JUICE_FINALE_PROP_POOL_KEY);
  const owners: Array<{ sprite: Sprite; timeline?: gsap.core.Timeline }> = [];
  const available = (Object.keys(JUICE_FINALE_PROP_SOURCES) as JuiceFinaleProp[])
    .filter((prop) => textures[prop] && !(textures[prop] as Texture).destroyed);
  let completed = 0;
  let released = false;

  const release = () => {
    if (released) return;
    released = true;
    for (const { sprite, timeline } of owners) {
      try { if (timeline) animationManager.killExternalTimeline(timeline); } catch {}
      try { if (sprite.parent) sprite.parent.removeChild(sprite); } catch {}
      try { pool.release(sprite); } catch {}
    }
    owners.length = 0;
  };

  try {
    for (const prop of available) {
      const texture = textures[prop] as Texture;
      const plan = createJuiceFinalePropFlightPlan(prop, screenW, screenH);
      const sprite = pool.acquire(texture);
      const owner: { sprite: Sprite; timeline?: gsap.core.Timeline } = { sprite };
      owners.push(owner);
      sprite.label = `juice-finale-${prop}`;
      (sprite as Sprite & { _juiceFinaleProp?: boolean })._juiceFinaleProp = true;
      sprite.anchor.set(0.5);
      sprite.x = plan.startX;
      sprite.y = plan.startY;
      sprite.rotation = 0;
      sprite.scale.set(plan.size / Math.max(1, texture.width));
      sprite.zIndex = plan.depth;
      sprite.eventMode = 'none';
      container.addChild(sprite);

      const timeline = animationManager.trackExternalTimeline(gsap.timeline({
        delay: plan.delay,
        onStart: () => {
          if (!released) onLaunch?.(prop);
        },
        onComplete: () => {
          if (released) return;
          completed += 1;
          if (completed === available.length) onComplete();
        },
      }));
      const motion = { progress: 0 };
      timeline.to(motion, {
        progress: 1,
        duration: plan.duration,
        ease: 'none',
        onUpdate: () => {
          if (released || sprite.destroyed) return;
          const pose = sampleJuiceFinalePropPose(plan, motion.progress);
          sprite.x = pose.x;
          sprite.y = pose.y;
          sprite.rotation = pose.rotation;
        },
      });
      owner.timeline = timeline;
    }
  } catch (error) {
    release();
    throw error;
  }

  if (available.length === 0) onComplete();

  return { release };
}
