import { gsap } from 'gsap';
import { Assets, Sprite, type Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.js';
import {
  createJourneyInterimBounceVariant,
  JOURNEY_INTERIM_IDLE_MOTION,
} from './journey-interim-idle-policy.js';
import { isUsablePixiImageTexture, pinPixiImageTexture } from '../utils/pixi-image-texture-health.js';

export const KANTA_IDLE_FRAME_SOURCE = './assets/shop/kanta/04.png';
export const KANTA_IDLE_REPEAT_DELAY_SECONDS = JOURNEY_INTERIM_IDLE_MOTION.repeatDelaySeconds;

export type KantaDiceIdleController = {
  setDragging: (dragging: boolean) => void;
  dispose: () => void;
};

/**
 * Holds Kanta on authored frame 04 and gives only its local artwork the shared
 * random gameplay-card squeeze/stretch cycle. The bottom-centre pivot keeps
 * the die grounded while the outer tile remains exclusively owned by drag.
 */
export function startKantaDiceIdle(
  tile: any,
  frameSources: string[],
): KantaDiceIdleController | null {
  const base = tile?.base as Sprite | null;
  const frameSource = frameSources[0] || KANTA_IDLE_FRAME_SOURCE;
  if (!base || base.destroyed || !frameSource) return null;

  const originalTexture = base.texture;
  const originalX = base.x;
  const originalY = base.y;
  const originalRotation = base.rotation;
  const originalScaleX = base.scale.x;
  const originalScaleY = base.scale.y;
  const originalAnchorX = base.anchor?.x ?? 0.5;
  const originalAnchorY = base.anchor?.y ?? 0.5;
  const displayedWidth = base.width;
  const displayedHeight = base.height;
  let loadedTexture: Texture | null = null;
  let disposed = false;
  let variant = createJourneyInterimBounceVariant();

  base.anchor.set(0.5, 1);
  base.x = originalX + displayedWidth * (0.5 - originalAnchorX);
  base.y = originalY + displayedHeight * (1 - originalAnchorY);
  const pivotX = base.x;
  const pivotY = base.y;

  const restoreNeutralPose = () => {
    if (base.destroyed) return;
    base.x = pivotX;
    base.y = pivotY;
    base.rotation = originalRotation;
    base.scale.set(originalScaleX, originalScaleY);
  };

  const timeline = animationManager.trackExternalTimeline(gsap.timeline({
    repeat: -1,
    repeatDelay: KANTA_IDLE_REPEAT_DELAY_SECONDS,
    repeatRefresh: true,
    onRepeat: () => {
      variant = createJourneyInterimBounceVariant();
    },
  }));
  timeline.to(base.scale, {
    x: originalScaleX * JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleX,
    y: originalScaleY * JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleY,
    duration: JOURNEY_INTERIM_IDLE_MOTION.anticipationDurationSeconds,
    ease: 'power2.in',
  });
  timeline.to(base.scale, {
    x: () => originalScaleX * variant.peakScaleX,
    y: () => originalScaleY * variant.peakScaleY,
    duration: JOURNEY_INTERIM_IDLE_MOTION.riseDurationSeconds,
    ease: 'back.out(2.5)',
  });
  timeline.to(base.scale, {
    x: () => originalScaleX * variant.landScaleX,
    y: () => originalScaleY * variant.landScaleY,
    duration: JOURNEY_INTERIM_IDLE_MOTION.landDurationSeconds,
    ease: 'power2.in',
  });
  timeline.to(base.scale, {
    x: originalScaleX * JOURNEY_INTERIM_IDLE_MOTION.reboundScaleX,
    y: originalScaleY * JOURNEY_INTERIM_IDLE_MOTION.reboundScaleY,
    duration: JOURNEY_INTERIM_IDLE_MOTION.reboundDurationSeconds,
    ease: 'power2.out',
  });
  timeline.to(base.scale, {
    x: originalScaleX,
    y: originalScaleY,
    duration: JOURNEY_INTERIM_IDLE_MOTION.settleDurationSeconds,
    ease: 'back.out(1.7)',
  });

  const controller: KantaDiceIdleController = {
    setDragging: (active: boolean) => {
      if (active) {
        timeline.pause();
        restoreNeutralPose();
      } else if (!disposed) {
        variant = createJourneyInterimBounceVariant();
        timeline.restart();
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try { animationManager.killExternalTimeline(timeline); } catch { timeline.kill(); }
      const ownsLoadedTexture = loadedTexture !== null && base.texture === loadedTexture;
      loadedTexture = null;
      if (base.destroyed) return;
      restoreNeutralPose();
      if (ownsLoadedTexture && originalTexture) {
        base.texture = originalTexture;
        applyGameplayTextureFiltering(base.texture);
      }
      base.anchor.set(originalAnchorX, originalAnchorY);
      base.x = originalX;
      base.y = originalY;
      base.rotation = originalRotation;
      base.scale.set(originalScaleX, originalScaleY);
    },
  };

  void Assets.load<Texture>(frameSource).then((texture) => {
    if (
      disposed
      || tile?.destroyed
      || tile?._ccKantaDiceIdle !== controller
      || !isUsablePixiImageTexture(texture)
    ) return;
    loadedTexture = texture;
    pinPixiImageTexture(texture);
    base.texture = texture;
    applyGameplayTextureFiltering(base.texture);
  }).catch(() => {});

  return controller;
}
