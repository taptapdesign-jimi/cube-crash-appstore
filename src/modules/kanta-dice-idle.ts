import { gsap } from 'gsap';
import { Assets, Sprite, type Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.js';
import {
  isUsablePixiImageTexture,
  pinPixiImageTexture,
} from '../utils/pixi-image-texture-health.js';

export const KANTA_IDLE_FRAME_SECONDS = 0.16;
export const KANTA_IDLE_ROCK_CYCLE_SECONDS = 2.88;
export const KANTA_IDLE_ROCK_DEGREES = 3;

export type KantaDiceIdleController = {
  setDragging: (dragging: boolean) => void;
  dispose: () => void;
};

export function getKantaIdleFrameIndex(
  elapsedSeconds: number,
  frameCount = 6,
): number {
  const count = Math.max(1, Math.floor(frameCount));
  return Math.floor(Math.max(0, elapsedSeconds) / KANTA_IDLE_FRAME_SECONDS) % count;
}

export function getKantaIdleRockRotation(elapsedSeconds: number): number {
  const time = Math.max(0, elapsedSeconds);
  const amplitude = KANTA_IDLE_ROCK_DEGREES * Math.PI / 180;
  return Math.sin((time / KANTA_IDLE_ROCK_CYCLE_SECONDS) * Math.PI * 2) * amplitude;
}

/**
 * Loops the authored Kanta frames and applies one gentle, grounded rock around
 * the artwork's bottom centre. Drag owns the outer tile transform; while a
 * drag is active this owner keeps only the sprite frames alive and rests the
 * local artwork rotation at its neutral pose.
 */
export function startKantaDiceIdle(
  tile: any,
  frameSources: string[],
): KantaDiceIdleController | null {
  const base = tile?.base as Sprite | null;
  if (!base || base.destroyed || frameSources.length < 2) return null;

  const originalTexture = base.texture;
  const originalX = base.x;
  const originalY = base.y;
  const originalRotation = base.rotation;
  const originalAnchorX = base.anchor?.x ?? 0.5;
  const originalAnchorY = base.anchor?.y ?? 0.5;
  const displayedWidth = base.width;
  const displayedHeight = base.height;
  let textures: Texture[] = [];
  let disposed = false;
  let dragging = false;
  let paintedFrameIndex = -1;

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
  };

  let controller: KantaDiceIdleController;
  const timeline = animationManager.trackExternalTimeline(gsap.timeline({
    repeat: -1,
    onUpdate: () => {
      if (disposed || tile?.destroyed || base.destroyed) return;
      const elapsedSeconds = timeline.totalTime();
      if (textures.length >= 2) {
        const frameIndex = getKantaIdleFrameIndex(elapsedSeconds, textures.length);
        if (frameIndex !== paintedFrameIndex) {
          const texture = textures[frameIndex];
          if (isUsablePixiImageTexture(texture)) {
            paintedFrameIndex = frameIndex;
            base.texture = texture;
            applyGameplayTextureFiltering(base.texture);
          }
        }
      }
      base.x = pivotX;
      base.y = pivotY;
      base.rotation = dragging
        ? originalRotation
        : originalRotation + getKantaIdleRockRotation(elapsedSeconds);
    },
  }));
  timeline.to({}, { duration: KANTA_IDLE_ROCK_CYCLE_SECONDS, ease: 'none' });

  controller = {
    setDragging: (active: boolean) => {
      dragging = active;
      if (dragging) restoreNeutralPose();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try { animationManager.killExternalTimeline(timeline); } catch { timeline.kill(); }
      const ownsCurrentFrame = textures.includes(base.texture);
      textures = [];
      if (base.destroyed) return;
      restoreNeutralPose();
      if (ownsCurrentFrame && originalTexture) {
        base.texture = originalTexture;
        applyGameplayTextureFiltering(base.texture);
      }
      base.anchor.set(originalAnchorX, originalAnchorY);
      base.x = originalX;
      base.y = originalY;
      base.rotation = originalRotation;
    },
  };

  void Promise.allSettled(frameSources.map((source) => Assets.load(source))).then((results) => {
    if (disposed || tile?.destroyed || tile?._ccKantaDiceIdle !== controller) return;
    textures = results
      .filter((result): result is PromiseFulfilledResult<Texture> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter(isUsablePixiImageTexture);
    if (textures.length < 2) {
      textures = [];
      return;
    }
    textures.forEach(pinPixiImageTexture);
  });

  return controller;
}
