import { gsap } from 'gsap';
import { Assets, Sprite, type Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.js';
import { isUsablePixiImageTexture, pinPixiImageTexture } from '../utils/pixi-image-texture-health.js';

export const BEE_ORIGINAL_FRAME_SECONDS = 0.16;
export const BEE_IDLE_FRAME_SECONDS = BEE_ORIGINAL_FRAME_SECONDS / 4;
export const BEE_DRAG_FRAME_SECONDS = BEE_ORIGINAL_FRAME_SECONDS / 5;

export function shouldFlipBeeDiceForViewport(
  globalCenterX: number,
  viewportWidth: number,
): boolean {
  return Number.isFinite(globalCenterX)
    && Number.isFinite(viewportWidth)
    && viewportWidth > 0
    && globalCenterX > viewportWidth * 0.5;
}

export function sampleBeeDiceIdleMotion(elapsedSeconds: number): {
  offsetX: number;
  offsetY: number;
  rotation: number;
  sizeScale: number;
} {
  const time = Math.max(0, elapsedSeconds);
  return {
    offsetX: Math.sin(time * Math.PI * 1.7) * 2.8,
    offsetY: Math.sin(time * Math.PI * 2.3 + Math.PI * 0.35) * 5,
    rotation: Math.sin(time * Math.PI * 1.9 + Math.PI * 0.2) * 0.025,
    sizeScale: 1 + Math.sin(time * Math.PI * 2.6 + Math.PI * 0.6) * 0.018,
  };
}

export type BeeDiceIdleController = {
  setDragging: (dragging: boolean) => void;
  refreshFacing: () => void;
  dispose: () => void;
};

export function getBeeIdleFrameIndex(
  elapsedSeconds: number,
  frameCount = 4,
  frameSeconds = BEE_IDLE_FRAME_SECONDS,
): number {
  const count = Math.max(1, Math.floor(frameCount));
  const cadence = Number.isFinite(frameSeconds) && frameSeconds > 0
    ? frameSeconds
    : BEE_IDLE_FRAME_SECONDS;
  return Math.floor(Math.max(0, elapsedSeconds) / cadence) % count;
}

export function startBeeDiceIdle(tile: any, frameSources: string[]): BeeDiceIdleController | null {
  const base = tile?.base as Sprite | null;
  if (!base || base.destroyed || frameSources.length < 2) return null;
  const motionHost = tile?.rotG ?? base.parent;
  if (!motionHost || motionHost.destroyed) return null;

  const originalTexture = base.texture;
  const originalX = motionHost.x;
  const originalY = motionHost.y;
  const originalRotation = motionHost.rotation;
  const originalScaleX = motionHost.scale?.x ?? 1;
  const originalScaleY = motionHost.scale?.y ?? 1;
  const paintedWidth = base.width;
  const paintedHeight = base.height;
  const originalBaseScaleX = base.scale?.x ?? 1;
  let textures: Texture[] = [];
  let disposed = false;
  let dragging = false;
  let paintedFrameIndex = -1;

  const restorePose = () => {
    if (base.destroyed || motionHost.destroyed) return;
    motionHost.x = originalX;
    motionHost.y = originalY;
    motionHost.rotation = originalRotation;
    motionHost.scale?.set?.(originalScaleX, originalScaleY);
    base.width = paintedWidth;
    base.height = paintedHeight;
  };

  const applyArtworkFacing = () => {
    if (base.destroyed || !base.scale) return;
    let globalCenterX = Number.NaN;
    try { globalCenterX = base.getGlobalPosition().x; } catch {}
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    base.scale.x = shouldFlipBeeDiceForViewport(globalCenterX, viewportWidth)
      ? -originalBaseScaleX
      : originalBaseScaleX;
  };

  const timeline = animationManager.trackExternalTimeline(gsap.timeline({
    repeat: -1,
    paused: true,
    onUpdate: () => {
      if (disposed || tile?.destroyed || base.destroyed || textures.length < 2) return;
      const elapsedSeconds = timeline.totalTime();
      const frameIndex = getBeeIdleFrameIndex(
        elapsedSeconds,
        textures.length,
        dragging ? BEE_DRAG_FRAME_SECONDS : BEE_IDLE_FRAME_SECONDS,
      );
      if (frameIndex !== paintedFrameIndex) {
        const texture = textures[frameIndex];
        if (!isUsablePixiImageTexture(texture)) return;
        paintedFrameIndex = frameIndex;
        base.texture = texture;
        applyGameplayTextureFiltering(base.texture);
      }
      applyArtworkFacing();
      if (dragging) {
        restorePose();
        return;
      }
      const motion = sampleBeeDiceIdleMotion(elapsedSeconds);
      motionHost.x = originalX + motion.offsetX;
      motionHost.y = originalY + motion.offsetY;
      motionHost.rotation = originalRotation + motion.rotation;
      motionHost.scale?.set?.(
        originalScaleX * motion.sizeScale,
        originalScaleY * motion.sizeScale,
      );
      base.width = paintedWidth;
      base.height = paintedHeight;
      applyArtworkFacing();
    },
  }));
  timeline.to({}, { duration: BEE_IDLE_FRAME_SECONDS * frameSources.length, ease: 'none' });

  const controller: BeeDiceIdleController = {
    // Drag owns outer tile translation and rotG tilt. Bee texture playback may
    // continue, while this whole-die decorative motion returns to neutral.
    setDragging: (nextDragging: boolean) => {
      dragging = nextDragging;
      if (dragging) restorePose();
      applyArtworkFacing();
    },
    refreshFacing: applyArtworkFacing,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try { animationManager.killExternalTimeline(timeline); } catch { timeline.kill(); }
      const ownsCurrentFrame = textures.includes(base.texture);
      textures = [];
      restorePose();
      if (!base.destroyed && base.scale) base.scale.x = originalBaseScaleX;
      if (!base.destroyed && ownsCurrentFrame && originalTexture) {
        base.texture = originalTexture;
        restorePose();
        if (base.scale) base.scale.x = originalBaseScaleX;
        applyGameplayTextureFiltering(base.texture);
      }
    },
  };

  void Promise.allSettled(frameSources.map((source) => Assets.load(source))).then((results) => {
    if (disposed || tile?.destroyed || tile?._ccBeeDiceIdle !== controller) return;
    textures = results
      .filter((result): result is PromiseFulfilledResult<Texture> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter(isUsablePixiImageTexture);
    if (textures.length < 2) {
      textures = [];
      return;
    }
    textures.forEach(pinPixiImageTexture);
    timeline.play(0);
  });

  return controller;
}
