import { gsap } from 'gsap';
import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import animationManager from './animation-manager.js';
import { graphicsPool } from './object-pool.js';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.js';
import { acquirePixiMobileActivityLease } from './pixi-mobile-frame-controller.js';
import {
  createJourneyInterimBounceVariant,
  JOURNEY_INTERIM_IDLE_MOTION,
} from './journey-interim-idle-policy.js';
import { isUsablePixiImageTexture, pinPixiImageTexture } from '../utils/pixi-image-texture-health.js';

export const KANTA_IDLE_FRAME_SOURCE = './assets/shop/kanta/04.png';
export const KANTA_IDLE_BACK_LEFT_SOURCE = './assets/shop/kanta/02.png';
export const KANTA_IDLE_BACK_SCALE = 0.80 * 0.95;
export const KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO = 0.40;
export const KANTA_IDLE_BACK_LOWER_RATIO = -0.10;
export const KANTA_IDLE_FRONT_OFFSET_X_PX = 8;
export const KANTA_IDLE_BACK_OFFSET_Y_PX = -2;
export const KANTA_IDLE_BACK_POP_IN_SECONDS = 0.42;
export const KANTA_IDLE_TOP_BUBBLE_COLOR = 0x06F4FF;
export const KANTA_IDLE_TOP_BUBBLE_INSET_PX = 3;
export const KANTA_IDLE_TOP_BUBBLE_Z_INDEX = 2600;
export const KANTA_IDLE_TOP_BUBBLE_ORIGIN_FROM_BOTTOM_RATIO = 0.75;
export const KANTA_IDLE_TOP_BUBBLE_TRAVEL_RATIO = 0.48 * 1.15;
export const KANTA_IDLE_TOP_BUBBLE_COUNT = 9;
export const KANTA_IDLE_TOP_BUBBLE_INITIAL_BURST_COUNT = 3;
export const KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS = 0.11 * 1.35;
export const KANTA_IDLE_TOP_BUBBLE_EMIT_MAX_SECONDS = 0.19 * 1.35;
export const KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS = 0.76 * 1.35;
export const KANTA_IDLE_TOP_BUBBLE_TRAVEL_MAX_SECONDS = 1.08 * 1.35;
export const KANTA_IDLE_BACK_TILT_MIN_DEGREES = 3;
export const KANTA_IDLE_BACK_TILT_MAX_DEGREES = 7;
export const KANTA_IDLE_REPEAT_DELAY_SECONDS = JOURNEY_INTERIM_IDLE_MOTION.repeatDelaySeconds;

export type KantaDiceIdleController = {
  setDragging: (dragging: boolean) => void;
  dispose: () => void;
};

export function getKantaBackdropSide(globalX: number, viewportWidth: number): -1 | 1 {
  return Number.isFinite(globalX) && Number.isFinite(viewportWidth) && globalX > viewportWidth * 0.5
    ? 1
    : -1;
}

export function getKantaIdleCompositeCenterCorrectionX(
  displayedWidth: number,
  backdropSide: -1 | 1,
): number {
  const frontCenterX = KANTA_IDLE_FRONT_OFFSET_X_PX;
  const frontHalfWidth = displayedWidth * 0.5;
  const backCenterX = backdropSide * displayedWidth * KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO;
  const backHalfWidth = displayedWidth * KANTA_IDLE_BACK_SCALE * 0.5;
  const leftEdge = Math.min(frontCenterX - frontHalfWidth, backCenterX - backHalfWidth);
  const rightEdge = Math.max(frontCenterX + frontHalfWidth, backCenterX + backHalfWidth);
  return -(leftEdge + rightEdge) * 0.5;
}

/**
 * Holds Kanta on authored frame 04 and gives only its local artwork the shared
 * random gameplay-card squeeze/stretch cycle. The bottom-centre pivot keeps
 * the die grounded while the outer tile remains exclusively owned by drag.
 */
export function startKantaDiceIdle(
  tile: any,
  frameSources: string[],
  visualSize?: { width?: number; height?: number },
): KantaDiceIdleController | null {
  const base = tile?.base as Sprite | null;
  const frameSource = frameSources[0] || KANTA_IDLE_FRAME_SOURCE;
  const backdropSources = [frameSources[1] || KANTA_IDLE_BACK_LEFT_SOURCE];
  if (!base || base.destroyed || !frameSource) return null;

  const originalTexture = base.texture;
  const originalX = base.x;
  const originalY = base.y;
  const originalRotation = base.rotation;
  const originalAnchorX = base.anchor?.x ?? 0.5;
  const originalAnchorY = base.anchor?.y ?? 0.5;
  const displayedWidth = Number.isFinite(visualSize?.width) && Number(visualSize?.width) > 0
    ? Number(visualSize?.width)
    : base.width;
  const displayedHeight = Number.isFinite(visualSize?.height) && Number(visualSize?.height) > 0
    ? Number(visualSize?.height)
    : base.height;
  // Board reconstruction can hand this owner a Sprite whose scale still
  // reflects a previous squeeze frame. Reassert the authored dimensions before
  // capturing the neutral scale so repeated board entries cannot accumulate a
  // flattened aspect ratio.
  base.width = displayedWidth;
  base.height = displayedHeight;
  const originalScaleX = base.scale.x;
  const originalScaleY = base.scale.y;
  const topBubbleTravelPx = displayedHeight * KANTA_IDLE_TOP_BUBBLE_TRAVEL_RATIO;
  let loadedTexture: Texture | null = null;
  const backdropSprites: Array<{
    sprite: Sprite;
    neutralScaleX: number;
    neutralScaleY: number;
    offsetX: number;
  }> = [];
  const backdropReveal = { progress: 0 };
  let backdropRevealTween: gsap.core.Tween | null = null;
  let topBubbleContainer: Container | null = null;
  let backBubbleContainer: Container | null = null;
  let topBubbleSpawnCall: gsap.core.Tween | null = null;
  let releaseTopBubbleMobileActivity: (() => void) | null = null;
  const topBubbleGraphics: Graphics[] = [];
  const topBubbleTweens = new Set<gsap.core.Tween>();
  const topBubbleTweenMap = new Map<Graphics, Set<gsap.core.Tween>>();
  let disposed = false;
  let variant = createJourneyInterimBounceVariant();
  let backdropSide: -1 | 1 = -1;
  let backdropTiltDegrees = KANTA_IDLE_BACK_TILT_MIN_DEGREES;
  let bubbleEmissionCount = 0;

  base.anchor.set(0.5, 1);
  const naturalPivotX = originalX + displayedWidth * (0.5 - originalAnchorX);
  base.x = naturalPivotX + KANTA_IDLE_FRONT_OFFSET_X_PX;
  base.y = originalY + displayedHeight * (1 - originalAnchorY);
  let pivotX = base.x;
  const pivotY = base.y;
  let compositeCenterCorrectionX = 0;

  const refreshBackdropPlacement = () => {
    let globalX = pivotX;
    try { globalX = base.getGlobalPosition().x; } catch {}
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : Math.max(1, pivotX * 2);
    backdropSide = getKantaBackdropSide(globalX, viewportWidth);
    compositeCenterCorrectionX = getKantaIdleCompositeCenterCorrectionX(displayedWidth, backdropSide);
    pivotX = naturalPivotX + KANTA_IDLE_FRONT_OFFSET_X_PX + compositeCenterCorrectionX;
    base.x = pivotX;
    backdropTiltDegrees = Math.random() < 0.28
      ? 0
      : KANTA_IDLE_BACK_TILT_MIN_DEGREES
        + Math.random() * (KANTA_IDLE_BACK_TILT_MAX_DEGREES - KANTA_IDLE_BACK_TILT_MIN_DEGREES);
    backdropSprites.forEach((state) => {
      state.offsetX = backdropSide * displayedWidth * KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO;
    });
  };
  refreshBackdropPlacement();

  const syncBackdropPose = () => {
    const scaleRatioX = originalScaleX === 0 ? 1 : base.scale.x / originalScaleX;
    const scaleRatioY = originalScaleY === 0 ? 1 : base.scale.y / originalScaleY;
    const opposingScaleRatioX = Math.max(0.8, 2 - scaleRatioX);
    const opposingScaleRatioY = Math.max(0.8, 2 - scaleRatioY);
    backdropSprites.forEach(({ sprite, neutralScaleX, neutralScaleY, offsetX }) => {
      if (sprite.destroyed) return;
      sprite.x = naturalPivotX + compositeCenterCorrectionX + offsetX * opposingScaleRatioX;
      sprite.y = pivotY
        + displayedHeight * KANTA_IDLE_BACK_LOWER_RATIO * opposingScaleRatioY
        + KANTA_IDLE_BACK_OFFSET_Y_PX;
      const sideDirection = Math.sign(offsetX) || -1;
      sprite.rotation = originalRotation
        + sideDirection * backdropTiltDegrees * (Math.PI / 180);
      sprite.scale.set(
        neutralScaleX * opposingScaleRatioX * backdropReveal.progress,
        neutralScaleY * opposingScaleRatioY * backdropReveal.progress,
      );
      sprite.alpha = Math.min(1, backdropReveal.progress * 1.6);
    });
    if (topBubbleContainer && !topBubbleContainer.destroyed) {
      topBubbleContainer.x = pivotX;
      topBubbleContainer.y = pivotY
        - displayedHeight * KANTA_IDLE_TOP_BUBBLE_ORIGIN_FROM_BOTTOM_RATIO * scaleRatioY
        + KANTA_IDLE_TOP_BUBBLE_INSET_PX;
    }
    if (backBubbleContainer && !backBubbleContainer.destroyed) {
      backBubbleContainer.x = naturalPivotX + compositeCenterCorrectionX
        + backdropSide * displayedWidth * KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO * opposingScaleRatioX;
      backBubbleContainer.y = pivotY
        + displayedHeight * KANTA_IDLE_BACK_LOWER_RATIO * opposingScaleRatioY
        + KANTA_IDLE_BACK_OFFSET_Y_PX
        - displayedHeight * KANTA_IDLE_BACK_SCALE
          * KANTA_IDLE_TOP_BUBBLE_ORIGIN_FROM_BOTTOM_RATIO * opposingScaleRatioY
        + KANTA_IDLE_TOP_BUBBLE_INSET_PX;
      backBubbleContainer.alpha = backdropReveal.progress;
    }
  };

  const restoreNeutralPose = () => {
    if (base.destroyed) return;
    base.x = pivotX;
    base.y = pivotY;
    base.rotation = originalRotation;
    base.scale.set(originalScaleX, originalScaleY);
    syncBackdropPose();
  };

  const timeline = animationManager.trackExternalTimeline(gsap.timeline({
    repeat: -1,
    repeatDelay: KANTA_IDLE_REPEAT_DELAY_SECONDS,
    repeatRefresh: true,
    onRepeat: () => {
      variant = createJourneyInterimBounceVariant();
    },
    onUpdate: syncBackdropPose,
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
        backdropRevealTween?.pause();
        restoreNeutralPose();
      } else if (!disposed) {
        variant = createJourneyInterimBounceVariant();
        refreshBackdropPlacement();
        timeline.restart();
        backdropRevealTween?.resume();
        releaseTopBubbleMobileActivity ??= acquirePixiMobileActivityLease('kanta-idle-bubbles');
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try { animationManager.killExternalTimeline(timeline); } catch { timeline.kill(); }
      try { animationManager.killExternalTween(backdropRevealTween); } catch { backdropRevealTween?.kill(); }
      backdropRevealTween = null;
      try { animationManager.killExternalTween(topBubbleSpawnCall); } catch { topBubbleSpawnCall?.kill(); }
      topBubbleSpawnCall = null;
      topBubbleTweens.forEach((tween) => {
        try { animationManager.killExternalTween(tween); } catch { tween.kill(); }
      });
      topBubbleTweens.clear();
      topBubbleTweenMap.clear();
      releaseTopBubbleMobileActivity?.();
      releaseTopBubbleMobileActivity = null;
      const ownsLoadedTexture = loadedTexture !== null && base.texture === loadedTexture;
      loadedTexture = null;
      backdropSprites.splice(0).forEach(({ sprite }) => {
        if (sprite.destroyed) return;
        try { sprite.parent?.removeChild(sprite); } catch {}
        try { sprite.destroy(); } catch {}
      });
      topBubbleGraphics.splice(0).forEach((bubble) => {
        if (bubble.destroyed || graphicsPool.isInPool(bubble)) return;
        try { graphicsPool.release(bubble); } catch {}
      });
      if (topBubbleContainer && !topBubbleContainer.destroyed) {
        try { topBubbleContainer.parent?.removeChild(topBubbleContainer); } catch {}
        try { topBubbleContainer.destroy({ children: false }); } catch {}
      }
      topBubbleContainer = null;
      if (backBubbleContainer && !backBubbleContainer.destroyed) {
        try { backBubbleContainer.parent?.removeChild(backBubbleContainer); } catch {}
        try { backBubbleContainer.destroy({ children: false }); } catch {}
      }
      backBubbleContainer = null;
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
      base.width = displayedWidth;
      base.height = displayedHeight;
    },
  };

  const bubbleParent = base.parent;
  if (bubbleParent) {
    const container = new Container();
    container.label = 'kanta-idle-top-bubbles';
    container.zIndex = KANTA_IDLE_TOP_BUBBLE_Z_INDEX;
    container.visible = true;
    container.renderable = true;
    container.eventMode = 'none';
    container.interactiveChildren = false;
    bubbleParent.sortableChildren = true;
    bubbleParent.addChild(container);
    topBubbleContainer = container;

    const rearContainer = new Container();
    rearContainer.label = 'kanta-idle-back-bubbles';
    rearContainer.zIndex = (base.zIndex || 0) - 1;
    rearContainer.visible = true;
    rearContainer.renderable = true;
    rearContainer.eventMode = 'none';
    rearContainer.interactiveChildren = false;
    bubbleParent.addChild(rearContainer);
    backBubbleContainer = rearContainer;
    bubbleParent.sortChildren();

    const ownBubbleTween = (bubble: Graphics, tween: gsap.core.Tween): gsap.core.Tween => {
      topBubbleTweens.add(tween);
      let owned = topBubbleTweenMap.get(bubble);
      if (!owned) {
        owned = new Set();
        topBubbleTweenMap.set(bubble, owned);
      }
      owned.add(tween);
      return tween;
    };

    const retireBubble = (bubble: Graphics) => {
      if (bubble.destroyed || graphicsPool.isInPool(bubble)) return;
      const owned = topBubbleTweenMap.get(bubble);
      owned?.forEach((tween) => topBubbleTweens.delete(tween));
      owned?.clear();
      topBubbleTweenMap.delete(bubble);
      const index = topBubbleGraphics.indexOf(bubble);
      if (index >= 0) topBubbleGraphics.splice(index, 1);
      try { bubble.parent?.removeChild(bubble); } catch {}
      try { graphicsPool.release(bubble); } catch {}
    };

    const spawnBubble = () => {
      if (disposed || !container.parent || topBubbleGraphics.length >= KANTA_IDLE_TOP_BUBBLE_COUNT) return;
      const bubble = graphicsPool.acquire();
      const isBackBubble = bubbleEmissionCount % 2 === 1;
      bubbleEmissionCount += 1;
      const bubbleHost = isBackBubble ? rearContainer : container;
      const hostWidth = displayedWidth * (isBackBubble ? KANTA_IDLE_BACK_SCALE : 1);
      const radius = 3.5 + Math.random() * 3;
      const startX = (Math.random() - 0.5) * hostWidth * 0.66;
      const crossDirection = Math.random() < 0.5 ? -1 : 1;
      const crossDistance = 6 + Math.random() * 6;
      const duration = KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS
        + Math.random() * (
          KANTA_IDLE_TOP_BUBBLE_TRAVEL_MAX_SECONDS - KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS
        );
      bubble.label = `kanta-idle-top-bubble-${Date.now()}-${topBubbleGraphics.length + 1}`;
      bubble.eventMode = 'none';
      bubble.circle(0, 0, radius).fill({ color: KANTA_IDLE_TOP_BUBBLE_COLOR, alpha: 1 });
      bubble.circle(-radius * 0.2, -radius * 0.2, radius * 0.30)
        .fill({ color: 0xFFFFFF, alpha: 0.86 });
      bubble.circle(0, 0, radius)
        .stroke({ color: KANTA_IDLE_TOP_BUBBLE_COLOR, alpha: 1, width: 1.5 });
      bubble.x = startX;
      bubble.y = radius + 3;
      bubble.alpha = 0.82 + Math.random() * 0.18;
      bubble.scale.set(0.28 + Math.random() * 0.12);
      bubbleHost.addChild(bubble);
      topBubbleGraphics.push(bubble);

      ownBubbleTween(bubble, animationManager.trackExternalTween(gsap.to(bubble.scale, {
        x: 1.12,
        y: 1.05,
        duration: duration * 0.42,
        ease: 'power2.out',
      })));
      ownBubbleTween(bubble, animationManager.trackExternalTween(gsap.to(bubble, {
        keyframes: [
          { x: startX + crossDirection * crossDistance, y: radius + 3 - topBubbleTravelPx * 0.32 },
          { x: startX - crossDirection * crossDistance * 0.72, y: radius + 3 - topBubbleTravelPx * 0.68 },
          { x: startX + crossDirection * crossDistance * 0.35, y: radius + 3 - topBubbleTravelPx },
        ],
        duration,
        ease: 'sine.inOut',
        onComplete: () => {
          queueMicrotask(() => {
            if (!disposed) retireBubble(bubble);
          });
        },
      })));
      ownBubbleTween(bubble, animationManager.trackExternalTween(gsap.to(bubble, {
        alpha: 0,
        duration: duration * 0.10,
        delay: duration * 0.90,
        ease: 'power3.in',
      })));
      ownBubbleTween(bubble, animationManager.trackExternalTween(gsap.to(bubble.scale, {
        x: 1.58,
        y: 1.58,
        duration: duration * 0.12,
        delay: duration * 0.88,
        ease: 'back.in(2.4)',
      })));
    };

    const scheduleNextBubble = () => {
      if (disposed || !container.parent) return;
      const nextDelay = KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS
        + Math.random() * (
          KANTA_IDLE_TOP_BUBBLE_EMIT_MAX_SECONDS - KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS
        );
      topBubbleSpawnCall = animationManager.trackExternalTween(gsap.delayedCall(nextDelay, () => {
        topBubbleSpawnCall = null;
        spawnBubble();
        scheduleNextBubble();
      }));
    };

    for (let index = 0; index < KANTA_IDLE_TOP_BUBBLE_INITIAL_BURST_COUNT; index += 1) {
      spawnBubble();
    }
    scheduleNextBubble();
    releaseTopBubbleMobileActivity = acquirePixiMobileActivityLease('kanta-idle-bubbles');
    syncBackdropPose();
  }

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
    base.width = displayedWidth;
    base.height = displayedHeight;
    applyGameplayTextureFiltering(base.texture);
  }).catch(() => {});

  void Promise.all(backdropSources.map((source) => Assets.load<Texture>(source))).then((textures) => {
    if (
      disposed
      || tile?.destroyed
      || tile?._ccKantaDiceIdle !== controller
      || base.destroyed
      || !base.parent
      || textures.some((texture) => !isUsablePixiImageTexture(texture))
    ) return;
    const parent = base.parent;
    const baseIndex = parent.getChildIndex(base);
    textures.forEach((texture, index) => {
      pinPixiImageTexture(texture);
      applyGameplayTextureFiltering(texture);
      const sprite = new Sprite(texture);
      sprite.label = 'kanta-idle-back';
      sprite.eventMode = 'none';
      sprite.zIndex = (base.zIndex || 0) - 2;
      sprite.anchor.set(0.5, 1);
      sprite.width = displayedWidth * KANTA_IDLE_BACK_SCALE;
      sprite.height = displayedHeight * KANTA_IDLE_BACK_SCALE;
      const offsetX = backdropSide * displayedWidth * KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO;
      backdropSprites.push({
        sprite,
        neutralScaleX: sprite.scale.x,
        neutralScaleY: sprite.scale.y,
        offsetX,
      });
      parent.addChildAt(sprite, Math.min(baseIndex + index, parent.children.length));
    });
    parent.sortChildren();
    syncBackdropPose();
    backdropRevealTween = animationManager.trackExternalTween(gsap.to(backdropReveal, {
      progress: 1,
      duration: KANTA_IDLE_BACK_POP_IN_SECONDS,
      ease: 'back.out(2.35)',
      onUpdate: syncBackdropPose,
    }));
  }).catch(() => {});

  return controller;
}
