import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.ts';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
} from '../utils/pixi-image-texture-health.ts';

export interface RoboCubeIdleController {
  dispose: () => void;
  setDragging: (dragging: boolean) => void;
}

const EXPRESSION_FRAME_SECONDS = 0.35;
const EXPRESSION_CYCLE_SECONDS = EXPRESSION_FRAME_SECONDS * 4;
const CROSSFADE_SECONDS = 0.12;
const PRELOAD_BATCH_SIZE = 3;
const ANTENNA_TRAIL_PARTICLE_COUNT = 15;
const ANTENNA_TRAIL_BURST_COUNT = 5;
const ANTENNA_TRAIL_EMISSION_INTERVAL_SECONDS = 0.06;
const ANTENNA_TRAIL_BOUNCE_IN_SECONDS = 0.16;
const ANTENNA_TRAIL_FADE_OUT_SECONDS = 0.20;

/**
 * Crossfades Robo Cube expressions with one reusable overlay sprite.
 * Loading is generation-owned so a removed/recycled tile can never receive a
 * late frame or retain a timeline after board cleanup.
 */
export function startRoboCubeIdle(
  tile: any,
  frameSources: string[],
  finalePreloadSources: string[] = [],
): RoboCubeIdleController {
  let disposed = false;
  let dragging = false;
  let overlay: Sprite | null = null;
  let trailContainer: Container | null = null;
  let timeline: gsap.core.Timeline | null = null;
  let trailTimeline: gsap.core.Timeline | null = null;
  let applyDraggingVisual: ((active: boolean) => void) | null = null;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    applyDraggingVisual = null;
    if (timeline) {
      try { animationManager.killExternalTimeline(timeline); } catch {
        try { timeline.kill(); } catch {}
      }
      timeline = null;
    }
    if (trailTimeline) {
      try { animationManager.killExternalTimeline(trailTimeline); } catch {
        try { trailTimeline.kill(); } catch {}
      }
      trailTimeline = null;
    }
    if (overlay) {
      try {
        gsap.killTweensOf(overlay);
        gsap.killTweensOf(overlay.scale);
        overlay.parent?.removeChild(overlay);
        overlay.destroy({ texture: false, textureSource: false });
      } catch {}
      overlay = null;
    }
    if (trailContainer) {
      try {
        trailContainer.children.forEach((particle) => {
          gsap.killTweensOf(particle);
          gsap.killTweensOf(particle.scale);
        });
        trailContainer.parent?.removeChild(trailContainer);
        trailContainer.destroy({ children: true });
      } catch {}
      trailContainer = null;
    }
  };

  const warmFinaleInBoundedBatches = async () => {
    for (let index = 0; index < finalePreloadSources.length && !disposed; index += PRELOAD_BATCH_SIZE) {
      const batch = finalePreloadSources.slice(index, index + PRELOAD_BATCH_SIZE);
      await Promise.allSettled(batch.map((source) => Assets.load(source)));
    }
  };

  void Promise.all(frameSources.map((source) => Assets.load(source)))
    .then((loaded) => {
      if (disposed || tile?.destroyed) return;
      const base = tile?.base as Sprite | null;
      const parent = base?.parent;
      const textures = loaded.filter(isUsablePixiImageTexture) as Texture[];
      if (!base || base.destroyed || !parent || textures.length < 2) return;
      textures.forEach(pinPixiImageTexture);

      const paintedWidth = base.width;
      const paintedHeight = base.height;
      base.texture = textures[0];
      base.width = paintedWidth;
      base.height = paintedHeight;
      applyGameplayTextureFiltering(base.texture);

      overlay = new Sprite(textures[0]);
      overlay.label = 'robo-cube-idle-crossfade';
      overlay.anchor.set(base.anchor.x, base.anchor.y);
      overlay.position.set(base.x, base.y);
      overlay.rotation = base.rotation;
      overlay.width = paintedWidth;
      overlay.height = paintedHeight;
      overlay.alpha = 0;
      overlay.eventMode = 'none';
      overlay.renderable = true;
      applyGameplayTextureFiltering(overlay.texture);
      const baseIndex = parent.getChildIndex(base);
      trailContainer = new Container();
      trailContainer.label = 'robo-cube-antenna-trail';
      trailContainer.position.set(base.x, base.y);
      trailContainer.eventMode = 'none';
      const trailSize = Math.max(2.2, Math.min(4, paintedWidth * 0.045)) * 3;
      const trailParticles = Array.from({ length: ANTENNA_TRAIL_PARTICLE_COUNT }, (_, particleIndex) => {
        const shapeIndex = particleIndex % 3;
        const particle = new Graphics();
        if (shapeIndex === 0) {
          particle.rect(-trailSize, -trailSize, trailSize * 2, trailSize * 2)
            .fill({ color: 0x8AEEFE, alpha: 0.92 });
        } else if (shapeIndex === 1) {
          particle.circle(0, 0, trailSize)
            .fill({ color: 0x8AEEFE, alpha: 0.92 });
        } else {
          particle.poly([
            0, -trailSize * 1.25,
            trailSize * 1.12, trailSize,
            -trailSize * 1.12, trailSize,
          ]).fill({ color: 0x8AEEFE, alpha: 0.92 });
        }
        particle.alpha = 0;
        particle.eventMode = 'none';
        trailContainer?.addChild(particle);
        return particle;
      });
      parent.addChildAt(trailContainer, Math.min(parent.children.length, baseIndex + 1));
      parent.addChildAt(overlay, Math.min(parent.children.length, parent.getChildIndex(base) + 2));

      const antennaEmitterY = -paintedHeight * 0.54 + 8;
      let trailDirection: -1 | 1 = -1;
      const prepareTrailParticle = (particle: Graphics) => {
        trailDirection = trailDirection === -1 ? 1 : -1;
        const distance = 10 + Math.random() * 18;
        const rise = 16 + Math.random() * 18;
        (particle as any)._ccTrailTargetX = trailDirection * distance;
        (particle as any)._ccTrailTargetY = antennaEmitterY - rise;
        (particle as any)._ccTrailExitX = trailDirection * (distance + 6 + Math.random() * 8);
        (particle as any)._ccTrailExitY = antennaEmitterY - rise - 12 - Math.random() * 8;
        (particle as any)._ccTrailPeakScale = 0.82 + Math.random() * 0.68;
        particle.position.set(0, antennaEmitterY);
        particle.rotation = Math.random() * 0.5 - 0.25;
        particle.alpha = 0;
        particle.scale.set(0.32 + Math.random() * 0.46);
      };

      let pendingTexture = textures[0];
      let currentFrameIndex = 0;
      const prepareRandomFrame = () => {
        if (disposed || !overlay || overlay.destroyed || tile?.destroyed) return;
        const candidates = textures
          .map((texture, index) => ({ texture, index }))
          .filter(({ texture, index }) => index !== currentFrameIndex && isUsablePixiImageTexture(texture));
        if (candidates.length === 0) return;
        currentFrameIndex = candidates[Math.floor(Math.random() * candidates.length)]?.index ?? currentFrameIndex;
        pendingTexture = textures[currentFrameIndex];
        if (!isUsablePixiImageTexture(pendingTexture)) return;
        overlay.texture = pendingTexture;
        overlay.anchor.set(base.anchor.x, base.anchor.y);
        overlay.position.set(base.x - 2, base.y + 1);
        overlay.rotation = base.rotation - 0.018;
        overlay.width = base.width;
        overlay.height = base.height;
        overlay.scale.set(overlay.scale.x * 0.97, overlay.scale.y * 1.03);
        overlay.alpha = 0;
        applyGameplayTextureFiltering(overlay.texture);
      };
      const commitFrame = () => {
        if (disposed || !overlay || tile?.destroyed || base.destroyed) return;
        if (!isUsablePixiImageTexture(pendingTexture)) return;
        const width = base.width;
        const height = base.height;
        base.texture = pendingTexture;
        base.width = width;
        base.height = height;
        applyGameplayTextureFiltering(base.texture);
      };

      timeline = animationManager.trackExternalTimeline(gsap.timeline({ repeat: -1 }));
      for (let frameIndex = 0; frameIndex < textures.length; frameIndex += 1) {
        const phaseStart = frameIndex * EXPRESSION_FRAME_SECONDS;
        timeline.call(prepareRandomFrame, undefined, phaseStart);
        timeline.to(overlay, {
          x: base.x,
          y: base.y,
          rotation: base.rotation,
          alpha: 1,
          duration: CROSSFADE_SECONDS,
          ease: 'sine.inOut',
        }, phaseStart);
        timeline.call(commitFrame, undefined, phaseStart + CROSSFADE_SECONDS);
        timeline.to(overlay, {
          x: base.x + 2,
          y: base.y - 1,
          rotation: base.rotation + 0.018,
          alpha: 0,
          duration: CROSSFADE_SECONDS,
          ease: 'sine.inOut',
        }, phaseStart + CROSSFADE_SECONDS);
      }
      // Preserve the complete 350ms slot after the fourth expression instead
      // of letting the final crossfade shorten the repeating cycle.
      timeline.call(() => {}, undefined, EXPRESSION_CYCLE_SECONDS);

      // The antenna keeps its accepted emission density and lifetime on a
      // separate lifecycle-owned timeline, so it cannot stretch the four-frame
      // expression cycle beyond the requested 350ms-per-frame cadence.
      trailTimeline = animationManager.trackExternalTimeline(gsap.timeline({ repeat: -1 }));
      for (let frameIndex = 0; frameIndex < textures.length; frameIndex += 1) {
        const phaseStart = trailTimeline.duration();
        for (let burstIndex = 0; burstIndex < ANTENNA_TRAIL_BURST_COUNT; burstIndex += 1) {
          const particleIndex = frameIndex * ANTENNA_TRAIL_BURST_COUNT + burstIndex;
          const particle = trailParticles[particleIndex % trailParticles.length];
          const emissionStart = phaseStart + burstIndex * ANTENNA_TRAIL_EMISSION_INTERVAL_SECONDS;
          trailTimeline.call(prepareTrailParticle, [particle], emissionStart);
          trailTimeline.to(particle, {
            x: () => (particle as any)._ccTrailTargetX,
            y: () => (particle as any)._ccTrailTargetY,
            alpha: 1,
            rotation: '+=0.35',
            duration: ANTENNA_TRAIL_BOUNCE_IN_SECONDS,
            ease: 'power2.out',
          }, emissionStart);
          trailTimeline.to(particle.scale, {
            x: () => (particle as any)._ccTrailPeakScale,
            y: () => (particle as any)._ccTrailPeakScale,
            duration: ANTENNA_TRAIL_BOUNCE_IN_SECONDS,
            ease: 'back.out(2.2)',
          }, emissionStart);
          trailTimeline.to(particle, {
            x: () => (particle as any)._ccTrailExitX,
            y: () => (particle as any)._ccTrailExitY,
            alpha: 0,
            rotation: '+=0.45',
            duration: ANTENNA_TRAIL_FADE_OUT_SECONDS,
            ease: 'sine.inOut',
          }, emissionStart + ANTENNA_TRAIL_BOUNCE_IN_SECONDS);
          trailTimeline.to(particle.scale, {
            x: 0.18,
            y: 0.18,
            duration: ANTENNA_TRAIL_FADE_OUT_SECONDS,
            ease: 'back.in(1.5)',
          }, emissionStart + ANTENNA_TRAIL_BOUNCE_IN_SECONDS);
        }
      }

      applyDraggingVisual = (active: boolean) => {
        if (disposed || tile?.destroyed || base.destroyed) return;
        if (active) {
          timeline?.pause();
          trailTimeline?.pause();
          if (overlay && !overlay.destroyed) overlay.alpha = 0;
          if (trailContainer && !trailContainer.destroyed) trailContainer.visible = false;
          const width = base.width;
          const height = base.height;
          currentFrameIndex = Math.min(1, textures.length - 1);
          const dragTexture = textures[currentFrameIndex];
          if (!isUsablePixiImageTexture(dragTexture)) return;
          base.texture = dragTexture;
          base.width = width;
          base.height = height;
          applyGameplayTextureFiltering(base.texture);
          return;
        }
        if (trailContainer && !trailContainer.destroyed) trailContainer.visible = true;
        timeline?.resume();
        trailTimeline?.resume();
      };
      if (dragging) applyDraggingVisual(true);

      void warmFinaleInBoundedBatches();
    })
    .catch(() => {
      // The canonical robo-cube1 texture remains visible if optional idle
      // frames cannot decode; gameplay must never depend on cosmetic frames.
    });

  return {
    dispose,
    setDragging: (active: boolean) => {
      dragging = active;
      applyDraggingVisual?.(active);
    },
  };
}
