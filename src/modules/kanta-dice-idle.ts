import { gsap } from 'gsap';
import { Assets, Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js';
import animationManager from './animation-manager.js';
import { graphicsPool } from './object-pool.js';
import { applyGameplayTextureFiltering } from './gameplay-texture-filtering.js';
import { STATE } from './app-state.js';
import {
  createJourneyInterimBounceVariant,
  JOURNEY_INTERIM_IDLE_MOTION,
} from './journey-interim-idle-policy.js';
import { isUsablePixiImageTexture, pinPixiImageTexture } from '../utils/pixi-image-texture-health.js';

export const KANTA_IDLE_FRAME_SOURCE = './assets/shop/kanta/04.png';
export const KANTA_IDLE_BACK_LEFT_SOURCE = './assets/shop/kanta/02.png';
// The rear can is one fixed depth layer of the same die, not a second equal
// die or an interaction variant.
export const KANTA_IDLE_BACK_SCALE = 0.70;
export const KANTA_IDLE_BACK_SIDE = -1 as const;
export const KANTA_IDLE_BACK_HORIZONTAL_OFFSET_RATIO = 0.40;
export const KANTA_IDLE_BACK_LOWER_RATIO = -0.14;
export const KANTA_IDLE_FRONT_OFFSET_X_PX = 8;
export const KANTA_IDLE_BACK_OFFSET_Y_PX = 0;
export const KANTA_IDLE_BACK_POP_IN_DELAY_SECONDS = 0.12;
export const KANTA_IDLE_BACK_POP_IN_START_SCALE = 0.12;
export const KANTA_IDLE_BACK_POP_IN_PEAK_SCALE = 1.26;
export const KANTA_IDLE_BACK_POP_IN_DIP_SCALE = 0.86;
export const KANTA_IDLE_BACK_POP_IN_RISE_SECONDS = 0.18;
export const KANTA_IDLE_BACK_POP_IN_DIP_SECONDS = 0.08;
export const KANTA_IDLE_BACK_POP_IN_SETTLE_SECONDS = 0.22;
export const KANTA_IDLE_TOP_BUBBLE_COLOR = 0x06F4FF;
export const KANTA_IDLE_TOP_BUBBLE_INSET_PX = 3;
export const KANTA_IDLE_TOP_BUBBLE_Z_INDEX = 2600;
export const KANTA_IDLE_TOP_BUBBLE_ORIGIN_FROM_BOTTOM_RATIO = 0.75;
export const KANTA_IDLE_TOP_BUBBLE_TRAVEL_RATIO = 0.48 * 1.15;
export const KANTA_IDLE_TOP_BUBBLE_COUNT = 3;
export const KANTA_IDLE_TOP_BUBBLE_INITIAL_BURST_COUNT = 1;
export const KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS = 0.70;
export const KANTA_IDLE_TOP_BUBBLE_EMIT_MAX_SECONDS = 1.10;
export const KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS = 1.10;
export const KANTA_IDLE_TOP_BUBBLE_TRAVEL_MAX_SECONDS = 1.50;
export const KANTA_IDLE_TOP_BUBBLE_DOUBLE_EVERY = 4;
export const KANTA_IDLE_TOP_BUBBLE_DOUBLE_DELAY_SECONDS = 0.12;
export const KANTA_IDLE_BACK_TILT_MIN_DEGREES = 3;
export const KANTA_IDLE_BACK_TILT_MAX_DEGREES = 10;
export const KANTA_IDLE_REPEAT_DELAY_SECONDS = 1.60;
export const KANTA_IDLE_BREATH_DURATION_SECONDS = 1.20;
export const KANTA_IDLE_BREATH_SCALE_X = 0.992;
export const KANTA_IDLE_BREATH_SCALE_Y = 1.012;
export const KANTA_IDLE_ACCENT_STRENGTH = 0.50;

type KantaIdleBubbleState = {
  bubble: Graphics;
  active: boolean;
  ageSeconds: number;
  durationSeconds: number;
  startX: number;
  crossDirection: -1 | 1;
  crossDistance: number;
  restingAlpha: number;
  startScale: number;
};

function softenScale(target: number): number {
  return 1 + (target - 1) * KANTA_IDLE_ACCENT_STRENGTH;
}

export type KantaDiceIdleController = {
  setDragging: (dragging: boolean) => void;
  dispose: () => void;
};

type KantaBackdropSpriteState = {
  sprite: Sprite;
  neutralScaleX: number;
  neutralScaleY: number;
  offsetX: number;
  revealScale: number;
  revealAlpha: number;
  popInTimeline: gsap.core.Timeline | null;
};

export function getKantaOutwardTiltDirection(
  globalX: number,
  viewportWidth: number,
): -1 | 1 {
  return Number.isFinite(globalX)
    && Number.isFinite(viewportWidth)
    && globalX > viewportWidth * 0.5
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
  let neutralScaleX = base.scale.x;
  let neutralScaleY = base.scale.y;
  const topBubbleTravelPx = displayedHeight * KANTA_IDLE_TOP_BUBBLE_TRAVEL_RATIO;
  let loadedTexture: Texture | null = null;
  const backdropSprites: KantaBackdropSpriteState[] = [];
  let topBubbleContainer: Container | null = null;
  let backBubbleContainer: Container | null = null;
  const topBubbleGraphics: Graphics[] = [];
  const topBubbleStates: KantaIdleBubbleState[] = [];
  let topBubbleTicker: Ticker | null = null;
  let topBubbleTick: ((ticker: Ticker) => void) | null = null;
  let nextBubbleInSeconds = KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS;
  let pendingDoubleInSeconds = 0;
  let bubbleSlotCursor = 0;
  let bubbleRuntimePaused = false;
  let disposed = false;
  let variant = createJourneyInterimBounceVariant();
  const backdropSide = KANTA_IDLE_BACK_SIDE;
  let spawnGlobalX = originalX;
  try { spawnGlobalX = base.getGlobalPosition().x; } catch {}
  const viewportWidth = typeof window !== 'undefined'
    ? window.innerWidth
    : Number(STATE.app?.screen?.width || Math.max(1, spawnGlobalX * 2));
  const backdropTiltDirection = getKantaOutwardTiltDirection(spawnGlobalX, viewportWidth);
  const backdropTiltDegrees = KANTA_IDLE_BACK_TILT_MIN_DEGREES
    + Math.random() * (KANTA_IDLE_BACK_TILT_MAX_DEGREES - KANTA_IDLE_BACK_TILT_MIN_DEGREES);
  let bubbleEmissionCount = 0;

  base.anchor.set(0.5, 1);
  const naturalPivotX = originalX + displayedWidth * (0.5 - originalAnchorX);
  base.x = naturalPivotX + KANTA_IDLE_FRONT_OFFSET_X_PX;
  base.y = originalY + displayedHeight * (1 - originalAnchorY);
  const compositeCenterCorrectionX = getKantaIdleCompositeCenterCorrectionX(
    displayedWidth,
    backdropSide,
  );
  const pivotX = naturalPivotX + KANTA_IDLE_FRONT_OFFSET_X_PX + compositeCenterCorrectionX;
  base.x = pivotX;
  const pivotY = base.y;

  const syncBackdropPose = () => {
    const scaleRatioX = neutralScaleX === 0 ? 1 : base.scale.x / neutralScaleX;
    const scaleRatioY = neutralScaleY === 0 ? 1 : base.scale.y / neutralScaleY;
    const opposingScaleRatioX = Math.max(0.8, 2 - scaleRatioX);
    const opposingScaleRatioY = Math.max(0.8, 2 - scaleRatioY);
    backdropSprites.forEach((state) => {
      const { sprite, neutralScaleX, neutralScaleY, offsetX } = state;
      if (sprite.destroyed) return;
      sprite.x = naturalPivotX + compositeCenterCorrectionX + offsetX * opposingScaleRatioX;
      sprite.y = pivotY
        + displayedHeight * KANTA_IDLE_BACK_LOWER_RATIO
        + KANTA_IDLE_BACK_OFFSET_Y_PX;
      sprite.rotation = originalRotation
        + backdropTiltDirection * backdropTiltDegrees * (Math.PI / 180);
      sprite.scale.set(
        neutralScaleX * opposingScaleRatioX * state.revealScale,
        neutralScaleY * opposingScaleRatioY * state.revealScale,
      );
      sprite.alpha = state.revealAlpha;
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
        + displayedHeight * KANTA_IDLE_BACK_LOWER_RATIO
        + KANTA_IDLE_BACK_OFFSET_Y_PX
        - displayedHeight * KANTA_IDLE_BACK_SCALE
          * KANTA_IDLE_TOP_BUBBLE_ORIGIN_FROM_BOTTOM_RATIO * opposingScaleRatioY
        + KANTA_IDLE_TOP_BUBBLE_INSET_PX;
      backBubbleContainer.alpha = 1;
    }
  };

  const restoreNeutralPose = () => {
    if (base.destroyed) return;
    base.x = pivotX;
    base.y = pivotY;
    base.rotation = originalRotation;
    base.scale.set(neutralScaleX, neutralScaleY);
    syncBackdropPose();
  };

  const stopBackdropPopIn = (state: KantaBackdropSpriteState, settle: boolean) => {
    const activePopIn = state.popInTimeline;
    state.popInTimeline = null;
    if (activePopIn) {
      try { animationManager.killExternalTimeline(activePopIn); } catch { activePopIn.kill(); }
    }
    if (settle) {
      state.revealScale = 1;
      state.revealAlpha = 1;
    }
  };

  const playBackdropPopIn = (
    state: KantaBackdropSpriteState,
    delaySeconds: number,
  ) => {
    stopBackdropPopIn(state, false);
    state.revealScale = KANTA_IDLE_BACK_POP_IN_START_SCALE;
    state.revealAlpha = 0;
    syncBackdropPose();

    const popInTimeline = animationManager.trackExternalTimeline(gsap.timeline({
      onComplete: () => {
        if (state.popInTimeline !== popInTimeline) return;
        state.popInTimeline = null;
        state.revealScale = 1;
        state.revealAlpha = 1;
        syncBackdropPose();
      },
      onInterrupt: () => {
        if (state.popInTimeline !== popInTimeline) return;
        state.popInTimeline = null;
        // Interruption must release the rear-can entrance at its canonical
        // 0.70 target, never at the tiny 0.12/overshoot intermediate frame.
        if (!disposed) {
          state.revealScale = 1;
          state.revealAlpha = 1;
          syncBackdropPose();
        }
      },
    }));
    state.popInTimeline = popInTimeline;
    popInTimeline
      .set(state, { revealAlpha: 1 }, delaySeconds)
      .to(state, {
        revealScale: KANTA_IDLE_BACK_POP_IN_PEAK_SCALE,
        duration: KANTA_IDLE_BACK_POP_IN_RISE_SECONDS,
        ease: 'back.out(3.4)',
        onUpdate: syncBackdropPose,
      }, delaySeconds)
      .to(state, {
        revealScale: KANTA_IDLE_BACK_POP_IN_DIP_SCALE,
        duration: KANTA_IDLE_BACK_POP_IN_DIP_SECONDS,
        ease: 'power2.inOut',
        onUpdate: syncBackdropPose,
      })
      .to(state, {
        revealScale: 1,
        duration: KANTA_IDLE_BACK_POP_IN_SETTLE_SECONDS,
        ease: 'elastic.out(1, 0.68)',
        onUpdate: syncBackdropPose,
      });
  };

  const resumeArtwork = () => {
    restoreNeutralPose();
    backdropSprites.forEach((state) => {
      if (state.revealAlpha < 1 || state.revealScale < 1) {
        playBackdropPopIn(state, 0);
      }
    });
    timeline.restart();
    bubbleRuntimePaused = false;
    pendingDoubleInSeconds = 0;
    nextBubbleInSeconds = 0.25;
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
    x: () => neutralScaleX * KANTA_IDLE_BREATH_SCALE_X,
    y: () => neutralScaleY * KANTA_IDLE_BREATH_SCALE_Y,
    duration: KANTA_IDLE_BREATH_DURATION_SECONDS,
    ease: 'sine.inOut',
  });
  timeline.to(base.scale, {
    x: () => neutralScaleX,
    y: () => neutralScaleY,
    duration: KANTA_IDLE_BREATH_DURATION_SECONDS,
    ease: 'sine.inOut',
  });
  timeline.to(base.scale, {
    x: () => neutralScaleX * softenScale(JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleX),
    y: () => neutralScaleY * softenScale(JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleY),
    duration: JOURNEY_INTERIM_IDLE_MOTION.anticipationDurationSeconds,
    ease: 'power2.in',
  });
  timeline.to(base.scale, {
    x: () => neutralScaleX * softenScale(variant.peakScaleX),
    y: () => neutralScaleY * softenScale(variant.peakScaleY),
    duration: JOURNEY_INTERIM_IDLE_MOTION.riseDurationSeconds,
    ease: 'back.out(2.5)',
  });
  timeline.to(base.scale, {
    x: () => neutralScaleX * softenScale(variant.landScaleX),
    y: () => neutralScaleY * softenScale(variant.landScaleY),
    duration: JOURNEY_INTERIM_IDLE_MOTION.landDurationSeconds,
    ease: 'power2.in',
  });
  timeline.to(base.scale, {
    x: () => neutralScaleX * softenScale(JOURNEY_INTERIM_IDLE_MOTION.reboundScaleX),
    y: () => neutralScaleY * softenScale(JOURNEY_INTERIM_IDLE_MOTION.reboundScaleY),
    duration: JOURNEY_INTERIM_IDLE_MOTION.reboundDurationSeconds,
    ease: 'power2.out',
  });
  timeline.to(base.scale, {
    x: () => neutralScaleX,
    y: () => neutralScaleY,
    duration: JOURNEY_INTERIM_IDLE_MOTION.settleDurationSeconds,
    ease: 'back.out(1.7)',
  });

  const controller: KantaDiceIdleController = {
    setDragging: (active: boolean) => {
      if (active) {
        timeline.pause();
        backdropSprites.forEach((state) => stopBackdropPopIn(state, true));
        bubbleRuntimePaused = true;
        topBubbleStates.forEach((state) => {
          state.active = false;
          state.bubble.visible = false;
          state.bubble.renderable = false;
        });
        restoreNeutralPose();
      } else if (!disposed) {
        resumeArtwork();
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try { animationManager.killExternalTimeline(timeline); } catch { timeline.kill(); }
      if (topBubbleTicker && topBubbleTick) {
        try { topBubbleTicker.remove(topBubbleTick); } catch {}
      }
      topBubbleTicker = null;
      topBubbleTick = null;
      topBubbleStates.length = 0;
      const ownsLoadedTexture = loadedTexture !== null && base.texture === loadedTexture;
      loadedTexture = null;
      backdropSprites.splice(0).forEach((state) => {
        stopBackdropPopIn(state, false);
        const { sprite } = state;
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
      base.scale.set(neutralScaleX, neutralScaleY);
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

    const deactivateBubble = (state: KantaIdleBubbleState) => {
      state.active = false;
      state.bubble.visible = false;
      state.bubble.renderable = false;
      state.bubble.alpha = 0;
    };

    for (let index = 0; index < KANTA_IDLE_TOP_BUBBLE_COUNT; index += 1) {
      const bubble = graphicsPool.acquire();
      const isBackBubble = index % 2 === 1;
      const radius = 3.8 + index * 0.9;
      bubble.label = `kanta-idle-top-bubble-slot-${index + 1}`;
      bubble.eventMode = 'none';
      bubble.circle(0, 0, radius).fill({ color: KANTA_IDLE_TOP_BUBBLE_COLOR, alpha: 1 });
      bubble.circle(-radius * 0.2, -radius * 0.2, radius * 0.30)
        .fill({ color: 0xFFFFFF, alpha: 0.86 });
      bubble.circle(0, 0, radius)
        .stroke({ color: KANTA_IDLE_TOP_BUBBLE_COLOR, alpha: 1, width: 1.5 });
      (isBackBubble ? rearContainer : container).addChild(bubble);
      topBubbleGraphics.push(bubble);
      const state: KantaIdleBubbleState = {
        bubble,
        active: false,
        ageSeconds: 0,
        durationSeconds: KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS,
        startX: 0,
        crossDirection: 1,
        crossDistance: 8,
        restingAlpha: 1,
        startScale: 0.32,
      };
      topBubbleStates.push(state);
      deactivateBubble(state);
    }

    const activateNextBubble = (): boolean => {
      for (let offset = 0; offset < topBubbleStates.length; offset += 1) {
        const index = (bubbleSlotCursor + offset) % topBubbleStates.length;
        const state = topBubbleStates[index];
        if (state.active) continue;
        bubbleSlotCursor = (index + 1) % topBubbleStates.length;
        const isBackBubble = state.bubble.parent === rearContainer;
        const hostWidth = displayedWidth * (isBackBubble ? KANTA_IDLE_BACK_SCALE : 1);
        state.active = true;
        state.ageSeconds = 0;
        state.durationSeconds = KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS
          + Math.random() * (
            KANTA_IDLE_TOP_BUBBLE_TRAVEL_MAX_SECONDS - KANTA_IDLE_TOP_BUBBLE_TRAVEL_MIN_SECONDS
          );
        state.startX = (Math.random() - 0.5) * hostWidth * 0.62;
        state.crossDirection = Math.random() < 0.5 ? -1 : 1;
        state.crossDistance = 6 + Math.random() * 6;
        state.restingAlpha = 0.82 + Math.random() * 0.18;
        state.startScale = 0.28 + Math.random() * 0.12;
        state.bubble.position.set(state.startX, 6);
        state.bubble.scale.set(state.startScale);
        state.bubble.alpha = state.restingAlpha;
        state.bubble.visible = true;
        state.bubble.renderable = true;
        bubbleEmissionCount += 1;
        return true;
      }
      return false;
    };

    const updateBubble = (state: KantaIdleBubbleState, deltaSeconds: number) => {
      if (!state.active) return;
      state.ageSeconds += deltaSeconds;
      const progress = Math.min(1, state.ageSeconds / state.durationSeconds);
      const lateralWave = Math.sin(progress * Math.PI * 3) * state.crossDistance * (1 - progress * 0.30);
      state.bubble.x = state.startX + state.crossDirection * lateralWave;
      state.bubble.y = 6 - topBubbleTravelPx * progress;
      const scale = progress < 0.42
        ? state.startScale + (1.10 - state.startScale) * (progress / 0.42)
        : progress < 0.88
          ? 1.10
          : 1.10 + (1.48 - 1.10) * ((progress - 0.88) / 0.12);
      state.bubble.scale.set(scale, scale * 0.96);
      state.bubble.alpha = progress < 0.90
        ? state.restingAlpha
        : state.restingAlpha * (1 - (progress - 0.90) / 0.10);
      if (progress >= 1) deactivateBubble(state);
    };

    for (let index = 0; index < KANTA_IDLE_TOP_BUBBLE_INITIAL_BURST_COUNT; index += 1) {
      activateNextBubble();
    }
    nextBubbleInSeconds = KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS
      + Math.random() * (
        KANTA_IDLE_TOP_BUBBLE_EMIT_MAX_SECONDS - KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS
      );
    topBubbleTicker = STATE.app?.ticker as Ticker | null;
    if (topBubbleTicker) {
      topBubbleTick = (ticker: Ticker) => {
        if (disposed || bubbleRuntimePaused || document.hidden || !container.parent) return;
        const deltaSeconds = Math.max(0, Math.min(0.10, ticker.deltaMS / 1000));
        topBubbleStates.forEach((state) => updateBubble(state, deltaSeconds));
        if (pendingDoubleInSeconds > 0) {
          pendingDoubleInSeconds -= deltaSeconds;
          if (pendingDoubleInSeconds <= 0) activateNextBubble();
        }
        nextBubbleInSeconds -= deltaSeconds;
        if (nextBubbleInSeconds > 0) return;
        const emitted = activateNextBubble();
        if (emitted && bubbleEmissionCount % KANTA_IDLE_TOP_BUBBLE_DOUBLE_EVERY === 0) {
          pendingDoubleInSeconds = KANTA_IDLE_TOP_BUBBLE_DOUBLE_DELAY_SECONDS;
        }
        nextBubbleInSeconds = KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS
          + Math.random() * (
            KANTA_IDLE_TOP_BUBBLE_EMIT_MAX_SECONDS - KANTA_IDLE_TOP_BUBBLE_EMIT_MIN_SECONDS
          );
      };
      topBubbleTicker.add(topBubbleTick);
    }
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
    // A restored holder can still own a regular/@2x texture while this frame
    // decodes. Width/height setters encode their result in Sprite.scale, so a
    // scale captured from that temporary texture is not portable to Kanta's
    // 128x171 source. Rebase the neutral scale after the authored frame is
    // attached and invalidate every function-based tween endpoint.
    timeline.pause();
    base.texture = texture;
    base.width = displayedWidth;
    base.height = displayedHeight;
    neutralScaleX = base.scale.x;
    neutralScaleY = base.scale.y;
    restoreNeutralPose();
    timeline.invalidate();
    if (!bubbleRuntimePaused) timeline.restart();
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
      const state: KantaBackdropSpriteState = {
        sprite,
        neutralScaleX: sprite.scale.x,
        neutralScaleY: sprite.scale.y,
        offsetX,
        revealScale: KANTA_IDLE_BACK_POP_IN_START_SCALE,
        revealAlpha: 0,
        popInTimeline: null,
      };
      backdropSprites.push(state);
      parent.addChildAt(sprite, Math.min(baseIndex + index, parent.children.length));
      if (!bubbleRuntimePaused) {
        playBackdropPopIn(state, KANTA_IDLE_BACK_POP_IN_DELAY_SECONDS);
      }
    });
    parent.sortChildren();
    syncBackdropPose();
  }).catch(() => {});

  return controller;
}
