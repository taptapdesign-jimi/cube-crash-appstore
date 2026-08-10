// @ts-nocheck
// Journey Boards Manager
// Manages rendering of 25 board cards in Journey screen
// 
// IMPORTANT: This system uses PIXEL-TO-PERCENTAGE conversion for positioning
// - You specify positions in PIXELS
// - System automatically converts to PERCENTAGES
// - This system is ONLY and EXCLUSIVELY used in Journey screen
// - Cards can be positioned individually anywhere you want

import { logger } from '../core/logger.js';
import { JOURNEY_CARD_IDLE_BOUNCE, smokeBubblesAtCard } from './journey-card-idle-bounce.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { clearArcadeSaveState, getBoardSaveKey, hasResumableSavedStateForBoard } from '../utils/board-save-utils.js';
import { playNavIconCartoonBounce } from '../utils/nav-icon-bounce.js';
import { arcadeStatsService } from '../services/arcade-stats-service.js';
import { boardStatsService } from '../services/board-stats-service.js';
import {
  cancelJourneyCardOverlayReturn,
  clearJourneyInterimOrigin,
  completeJourneyCardOverlayReturn,
  getJourneyCardOverlayReturnBoardId,
  markJourneyCardOverlayReturn,
  markJourneyGameOrigin,
} from './journey-origin-state.js';
import { getOriginalGsapTo, getOriginalGsapTimeline } from './drag-core.js';
import {
  getJourneyBoardCardBaseTransform,
  rememberJourneyBoardCardBaseTransform,
  restoreJourneyBoardCardBaseTransform,
  setJourneyBoardCardBaseTransform,
} from './journey-card-base-transform.js';
import {
  animateJourneyViewportScreenExit,
  lockJourneyViewportTransition,
  unlockJourneyViewportTransition,
} from '../ui/collectibles-animations.js';
import {
  getJourneyElasticPull,
  getJourneyHubEntryScrollTop,
  shouldCorrectJourneyHubAutomaticScroll,
  getJourneyV700HubEnterStagger,
  getJourneyV700MotionProfile,
  JOURNEY_V700_UNIT_CARD_EXIT_DURATION,
  JOURNEY_V700_UNIT_CARD_EXIT_EASE,
  isJourneyInterimIdleOwnedByEnter,
  shouldIgnoreJourneyV700HubVisibleEnterRequest,
  shouldRestoreJourneyInterimWrapperForIdle,
} from './journey-v700-motion.js';
import { shouldBlockHiddenJourneyRender } from './journey-background-preparation.js';
import { emitIOSNativeDiagnostic } from '../utils/ios-native-diagnostic.js';
import { startIOSJourneyWorldEnterAudit } from '../utils/ios-journey-world-enter-audit.js';
import { formatGameplayProgressLabel } from './gameplay-terminology.ts';
import {
  JourneyWorldAnimationCoordinator,
  type JourneyWorldAnimationUnit,
} from './journey-world-animation-coordinator.js';
import {
  createJourneyInterimBounceVariant,
  JOURNEY_INTERIM_IDLE_MOTION,
} from './journey-interim-idle-policy.js';
import {
  formatJourneyWorldStageNumber,
  reconcileJourneyWorldInterims,
} from './journey-world-stage.js';
import {
  createDetailModalStatsEnterDelays,
  getDetailModalStatsEnterTotalDuration,
} from './detail-modal-stats-enter-motion.js';
import { journeySpatialMotion } from './journey-spatial-motion.js';
import { getJourneyEarnedStars } from './journey-stage-balance.js';
import { ctaMotion, getRegisteredCta, registerCta } from './cta-system.ts';
import { hideHomepageNavigation } from './navigation-control.js';
import {
  presentJourneyCardOverlayModal,
  type JourneyCardOverlayModalController,
} from './journey-card-overlay-modal.js';
import {
  acquireJourneyCardOriginLease,
  type JourneyCardOriginLease,
} from './journey-card-portal-transition.js';

// 🔥 CRITICAL FIX: Use original GSAP functions to prevent infinite recursion
// trackTween/trackTimeline must use original GSAP functions, not gsap.to/gsap.timeline
// because gsap.to/gsap.timeline are overridden in drag-core.ts and might cause circular calls
const trackTimeline = (options: any = {}) => {
  const origTimeline = getOriginalGsapTimeline();
  return animationManager.trackExternalTimeline(origTimeline(options));
};

const trackTween = (target: any, vars: any) => {
  const origTo = getOriginalGsapTo();
  return animationManager.trackExternalTween(origTo(target, vars));
};

const trackFromToTween = (target: any, fromVars: any, toVars: any) => (
  animationManager.trackExternalTween(gsap.fromTo(target, fromVars, toVars))
);

function shouldSkipDetailModalGameAssetPreload(): boolean {
  try {
    const lastGameExitAt = Number((window as any).__ccLastGameExitAt || 0);
    const recentGameExit = lastGameExitAt > 0 && Date.now() - lastGameExitAt < 15000;
    if (recentGameExit) return true;

    const pixiApp = (window as any).STATE?.app || (window as any).CC?.app || (window as any).app;
    const appDestroyed = pixiApp?.destroyed === true || pixiApp?.renderer?.destroyed === true;
    return appDestroyed;
  } catch {
    return true;
  }
}

function waitForImageReady(img: HTMLImageElement, timeoutMs = 1200): Promise<void> {
  if (!img || !img.src) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      resolve();
    };
    const onLoad = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    const onError = finish;
    const timer = window.setTimeout(finish, timeoutMs);

    if (img.complete) {
      if (img.naturalWidth > 0 && typeof img.decode === 'function') {
        // A complete image can still leave decode() pending in Chrome/WebKit.
        // The shared timer guarantees World enter cannot stay hidden forever.
        void img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
      return;
    }

    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
  });
}

function setJourneyAlienBeamIdleReady(target: HTMLElement, ready: boolean): void {
  const beams = target.classList.contains('journey-robo-alien-beam-art')
    ? [target]
    : Array.from(target.querySelectorAll<HTMLElement>('.journey-robo-alien-beam-art'));
  beams.forEach((beam) => {
    beam.classList.toggle('journey-robo-alien-beam-idle-ready', ready);
    if (!ready) beam.style.removeProperty('opacity');
  });
}

function getJourneyAreaTransformOrigin(target: HTMLElement): string {
  return target.dataset.journeyMotionTransformOrigin || '50% 50%';
}

function restoreJourneyAreaTransformOrigin(target: HTMLElement): void {
  target.style.transformOrigin = getJourneyAreaTransformOrigin(target);
}

/** True for iPad / iPadOS (any logical width) or desktop window sizes that use the iPad detail CSS column. */
export function isTabletDetailModalViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mtp = typeof navigator !== 'undefined' ? Number((navigator as any).maxTouchPoints || 0) : 0;
  const isIPadOs =
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && mtp > 1) ||
    (typeof navigator !== 'undefined' && (navigator as any).platform === 'MacIntel' && mtp > 1);
  if (isIPadOs) return true;
  const vw = window.innerWidth;
  return vw >= 769 && vw <= 1366;
}

/** Strip horizontal-swipe inline widths / GSAP x so Journey iPad column layout can center (CSS @media). */
export function resetDetailModalHorizontalSwipeLayout(swipeable: HTMLElement | null | undefined): void {
  if (!swipeable || !isTabletDetailModalViewport()) return;
  try {
    gsap.killTweensOf(swipeable);
    gsap.set(swipeable, { x: 0 });
  } catch {}
  swipeable.style.removeProperty('width');
  swipeable.style.removeProperty('max-width');
  swipeable.style.removeProperty('min-width');
  const sections = swipeable.querySelectorAll('.detail-section') as NodeListOf<HTMLElement>;
  sections.forEach((section) => {
    section.style.removeProperty('width');
    section.style.removeProperty('min-width');
    section.style.removeProperty('max-width');
  });
}

function wasRecentGameExitForDetailMotion(): boolean {
  try {
    const lastGameExitAt = Number((window as any).__ccLastGameExitAt || 0);
    return lastGameExitAt > 0 && Date.now() - lastGameExitAt < 15000;
  } catch {
    return false;
  }
}

function cleanupDetailStatsEnterAnimation(modal: HTMLElement | null | undefined): void {
  if (!modal) return;

  try {
    const tweens = (modal as any).__detailStatsEnterTweens;
    if (Array.isArray(tweens)) {
      tweens.forEach((tween) => {
        try { tween?.kill?.(); } catch {}
      });
    }
    (modal as any).__detailStatsEnterTweens = null;
  } catch {}

  try {
    const timeline = (modal as any).__detailStatsEnterTimeline;
    if (timeline && typeof timeline.kill === 'function') {
      timeline.kill();
    }
    (modal as any).__detailStatsEnterTimeline = null;
  } catch {}

  try {
    const restoreTimer = (modal as any).__detailStatsRestoreTimer;
    if (restoreTimer) {
      window.clearTimeout(restoreTimer);
    }
    (modal as any).__detailStatsRestoreTimer = null;
  } catch {}

  try {
    const statNodes = modal.querySelectorAll('.detail-stat-item, .detail-stat-divider, .detail-stat-icon, .stat-icon, .detail-stat-value, .stat-value, .detail-stat-label, .stat-label, .detail-stat-content, .stat-content');
    statNodes.forEach((node) => {
      try { gsap.killTweensOf(node); } catch {}
      try { (node as HTMLElement).style.removeProperty('will-change'); } catch {}
      try {
        const el = node as HTMLElement;
        el.classList.remove('detail-stat-entering', 'detail-stat-exiting');
        el.style.removeProperty('animation');
        el.style.removeProperty('animation-delay');
      } catch {}
    });
  } catch {}
}

function getElementVisibilitySnapshot(element: HTMLElement | null): Record<string, unknown> | null {
  if (!element) return null;
  const computed = window.getComputedStyle(element);
  return {
    exists: true,
    hidden: element.hidden,
    ariaHidden: element.getAttribute('aria-hidden'),
    className: element.className,
    inlineDisplay: element.style.display,
    inlineVisibility: element.style.visibility,
    inlineOpacity: element.style.opacity,
    inlinePointerEvents: element.style.pointerEvents,
    inlineZIndex: element.style.zIndex,
    inlineTransform: element.style.transform,
    computedDisplay: computed.display,
    computedVisibility: computed.visibility,
    computedOpacity: computed.opacity,
    computedPointerEvents: computed.pointerEvents,
    computedZIndex: computed.zIndex,
    computedTransform: computed.transform,
    rect: {
      x: Math.round(element.getBoundingClientRect().x),
      y: Math.round(element.getBoundingClientRect().y),
      width: Math.round(element.getBoundingClientRect().width),
      height: Math.round(element.getBoundingClientRect().height),
    },
  };
}

function resetDetailStatsDomForOpen(modal: HTMLElement | null | undefined): void {
  if (!modal) return;

  try {
    cleanupDetailStatsEnterAnimation(modal);
  } catch {}

  const statsContainers = [
    modal.querySelector('#detail-section-stats-card') as HTMLElement | null,
    modal.querySelector('.detail-section-stats-card') as HTMLElement | null,
    modal.querySelector('.detail-section-stats') as HTMLElement | null,
    modal.querySelector('.detail-stats-list') as HTMLElement | null,
  ].filter(Boolean) as HTMLElement[];

  statsContainers.forEach((el) => {
    try { gsap.killTweensOf(el); } catch {}
    el.classList.remove('animate-enter', 'animate-exit', 'animate-reset', 'animate-enter-initial');
    el.classList.remove('detail-stat-entering', 'detail-stat-exiting');
    el.style.removeProperty('transform');
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('will-change');
    el.style.removeProperty('transition');
    el.style.removeProperty('animation');
    el.style.removeProperty('animation-delay');
    el.style.setProperty('display', el.classList.contains('detail-stats-list') ? 'flex' : 'flex', 'important');
  });

  const statNodes = modal.querySelectorAll(
    '.detail-stat-item, .detail-stat-divider, .detail-stat-icon, .stat-icon, .detail-stat-value, .stat-value, .detail-stat-label, .stat-label, .detail-stat-content, .stat-content'
  );
  statNodes.forEach((node) => {
    const el = node as HTMLElement;
    try { gsap.killTweensOf(el); } catch {}
    el.classList.remove('animate-enter', 'animate-exit', 'animate-reset', 'animate-enter-initial');
    el.classList.remove('detail-stat-entering', 'detail-stat-exiting');
    el.style.removeProperty('transform');
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('will-change');
    el.style.removeProperty('transition');
    const defaultDisplay = el.classList.contains('detail-stat-divider') ? 'block' : 'flex';
    el.dataset.statOriginalDisplay = defaultDisplay;
    if (
      el.classList.contains('detail-stat-item') ||
      el.classList.contains('detail-stat-divider') ||
      el.classList.contains('detail-stat-icon') ||
      el.classList.contains('stat-icon') ||
      el.classList.contains('detail-stat-content') ||
      el.classList.contains('stat-content')
    ) {
      el.style.setProperty('display', defaultDisplay, 'important');
    } else {
      el.style.removeProperty('display');
    }
  });
}

function playDetailCardTapCartoonBounce(detailImage: HTMLElement | null): void {
  if (!detailImage) return;

  try {
    const existingTimeline = (detailImage as any).__detailCardTapBounceTimeline;
    try { existingTimeline?.kill?.(); } catch {}
    try { gsap.killTweensOf(detailImage); } catch {}
    const motionEl = detailImage.querySelector('.detail-image-motion') as HTMLElement | null;
    detailImage.classList.remove('detail-card-tap-cartoon-bounce');
    detailImage.classList.add('detail-card-tapping');
    detailImage.style.transformOrigin = '50% 50%';
    detailImage.style.willChange = 'transform';
    if (motionEl) {
      motionEl.style.animationPlayState = 'paused';
    }

    const timeline = trackTimeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        if ((detailImage as any).__detailCardTapBounceTimeline === timeline) {
          (detailImage as any).__detailCardTapBounceTimeline = null;
        }
        detailImage.classList.remove('detail-card-tapping');
        if (motionEl) {
          motionEl.style.animationPlayState = 'running';
        }
        detailImage.style.willChange = 'transform';
      },
      onInterrupt: () => {
        detailImage.classList.remove('detail-card-tapping');
        if (motionEl) {
          motionEl.style.animationPlayState = 'running';
        }
        detailImage.style.willChange = 'transform';
      },
    });
    (detailImage as any).__detailCardTapBounceTimeline = timeline;
    timeline
      .set(detailImage, { scale: 1, force3D: true, transformOrigin: '50% 50%' })
      .to(detailImage, { scale: 1.08, duration: 0.14, ease: 'power2.out', force3D: true })
      .to(detailImage, { scale: 1, duration: 0.26, ease: 'back.out(1.6)', force3D: true });
  } catch (error) {
    logger.warn('⚠️ Failed to animate detail card tap cartoon bounce:', error);
  }
}

function playJourneyDetailPlayScreenShake(target: HTMLElement | null): Promise<void> {
  return new Promise((resolve) => {
    if (!target) {
      resolve();
      return;
    }

    try {
      gsap.killTweensOf(target);
      const duration = 0.24;
      const steps = 9;
      const strength = 8;
      const stepDuration = duration / steps;
      const tl = trackTimeline({
        onComplete: () => {
          try { gsap.set(target, { x: 0, y: 0 }); } catch {}
          resolve();
        },
      });

      for (let i = 0; i < steps; i++) {
        const fade = 1 - (i / steps);
        const amp = strength * fade * fade;
        const x = (Math.random() * 2 - 1) * amp;
        const y = (Math.random() * 2 - 1) * amp * 0.55;
        tl.to(target, { x, y, duration: stepDuration, ease: 'sine.inOut', force3D: true }, i * stepDuration);
      }

      tl.to(target, { x: 0, y: 0, duration: 0.08, ease: 'power2.out', force3D: true }, '>');
    } catch (error) {
      logger.warn('⚠️ Failed to animate Journey detail play screen shake:', error);
      try { gsap.set(target, { x: 0, y: 0 }); } catch {}
      resolve();
    }
  });
}

export interface JourneyBoard {
  id: number;
  unlocked: boolean;
  interim?: boolean; // Interim state: board is accessible but not completed (shows common back.png, cannot click for details)
  imagePath?: string;
  name?: string;
}


// Card positions from Figma (converted from pixel offsets to percentages)
// Frame size: 361.51 x 770.32
// All offsets are relative to center (0,0)
// Converting: x_offset / (frame_width/2) * 100 + 50 = percentage
//            y_offset / (frame_height/2) * 100 + 50 = percentage
const FRAME_WIDTH = 361.51;
const FRAME_HEIGHT = 770.32;

// Helper to convert Figma offset to percentage (relative to container center)
function figmaToPercent(xOffset: number, yOffset: number): { x: number; y: number } {
  // Frame center is at (FRAME_WIDTH/2, FRAME_HEIGHT/2)
  // Offset is relative to center, so we add half frame to get absolute position
  const xAbsolute = (FRAME_WIDTH / 2) + xOffset;
  const yAbsolute = (FRAME_HEIGHT / 2) + yOffset;
  // Convert to percentage
  const xPercent = (xAbsolute / FRAME_WIDTH) * 100;
  const yPercent = (yAbsolute / FRAME_HEIGHT) * 100;
  return { x: xPercent, y: yPercent };
}

// ============================================================================
// PIXEL-TO-PERCENTAGE POSITIONING SYSTEM (Journey Screen ONLY)
// ============================================================================
// This system allows you to position cards in PIXELS, which are automatically
// converted to PERCENTAGES for responsive layout.
// 
// Usage: Specify positions in pixels, system converts to percentages
// Example: { x: pxToPercent(24), top: pxToPercent(4) } = 24px from left, 4px from top
// 
// IMPORTANT: 
// - This system is ONLY used in Journey screen
// - When adding new cards, DO NOT change existing card positions
// - Each card can be positioned individually anywhere you want
// ============================================================================

// 🔥 PREMIUM FIX: Viewport-based positioning system for consistent positioning across all iPhone devices
// Using viewport units (vw/vh) directly - cards will be positioned relative to viewport, not container
// This ensures identical positions on all devices (iPhone 13, 14, 17, etc.)
const BASE_VIEWPORT_WIDTH = 390; // iPhone 13/14 base width in pixels (for conversion calculations)
const BASE_VIEWPORT_HEIGHT = 844; // iPhone 13/14 base height in pixels (for conversion calculations)
const JOURNEY_CONTENT_TOP_BASE_PX = 0;
const JOURNEY_CONTENT_SHIFT_UP_PX = 0;
const JOURNEY_CONTENT_TOP_PX = JOURNEY_CONTENT_TOP_BASE_PX - JOURNEY_CONTENT_SHIFT_UP_PX;
const FOREST_WORLD_ASSET_BASE = './assets/journey assets/forest/forest world';
const BEACH_WORLD_ASSET_BASE = './assets/journey assets/beach';
const ROBO_WORLD_ASSET_BASE = './assets/journey assets/robo';
const JOURNEY_WORLD_BANNER_ASSET = './assets/journey assets/natpis.png';
const JOURNEY_WORLD_BANNER_ASSET_2X = './assets/journey assets/natpis@2x.png';
const FOREST_LEVEL_STARS_ASSET_BASE = './assets/journey assets/level stars';
const JOURNEY_LEVEL_STAR_ASSETS = Object.freeze({
  left: Object.freeze({
    filled: `${FOREST_LEVEL_STARS_ASSET_BASE}/star-filled-left.png`,
    empty: `${FOREST_LEVEL_STARS_ASSET_BASE}/star-empty-left.png`,
  }),
  center: Object.freeze({
    filled: `${FOREST_LEVEL_STARS_ASSET_BASE}/star-filled-center-1.png`,
    empty: `${FOREST_LEVEL_STARS_ASSET_BASE}/star-empty-center.png`,
  }),
  right: Object.freeze({
    filled: `${FOREST_LEVEL_STARS_ASSET_BASE}/star-filled-right.png`,
    empty: `${FOREST_LEVEL_STARS_ASSET_BASE}/star-empty-right-1.png`,
  }),
});
const BOARD_TRANSITION_ASSET_BASE = './assets/board transition';
const FOREST_MAP_DESIGN_WIDTH = 390;
const FOREST_MAP_DESIGN_HEIGHT = 760;
const JOURNEY_MAX_BOARDS = 30;
const JOURNEY_RENDERED_BOARDS = 30;
const JOURNEY_FOREST_LAYOUT_STATE_VERSION = 'forest-board-1-interim-v1';
const JOURNEY_DEV_BOARD_REFRESH_KEY = '__ccJourneyDevBoardsDirty';
const JOURNEY_RETURN_BOARD_ID_KEY = '__ccJourneyReturnBoardId';
/** Single start offset for the full Journey world stack; adding later worlds below must not change it. */
const JOURNEY_BOARDSTACK_NUDGE_DOWN_PX = 138;
/** Lift the complete Forest, Beach and Area 55 world scene without changing its internal alignment. */
const JOURNEY_V700_WORLD_CONTENT_LIFT_PX = 0;
/** Position cards/numbers relative to the Journey world/decor layers. */
const JOURNEY_CARDSTACK_OFFSET_FROM_WORLD_PX = 58;
/** Extra scroll room so the lowest Journey cards are not clipped at the bottom. */
const JOURNEY_BOARDSTACK_BOTTOM_ROOM_PX = 4200;
/** V700 scoped world bottom room after the 10th unit; keeps the screen compact without clipping idle/exit motion. */
const JOURNEY_V700_WORLD_BOTTOM_ROOM_PX = 680;
/** Forest-only visual nudge inside V700 scoped world screen. Beach/Area 55 intentionally stay unchanged. */
const JOURNEY_V700_FOREST_SCOPE_EXTRA_DOWN_PX = 16;
const ENABLE_INTERIM_CARD_IDLE_EFFECTS = true;
export const JOURNEY_CARD_OVERLAY_MODAL_EXPERIMENT_ENABLED = true;
const BOARD_AREA_MODAL_ENTER_SCALE = 0.65;
const BOARD_AREA_MODAL_ENTER_DURATION = 0.5;
const BOARD_AREA_MODAL_ENTER_EASE = 'back.out(1.8)';
const BOARD_AREA_MODAL_ENTER_BASE_DELAY = 0.05;
const BOARD_AREA_MODAL_EXIT_DURATION = 0.48;
const BOARD_AREA_MODAL_EXIT_EASE = 'back.in(1.25)';
const BOARD_AREA_MODAL_EXIT_BASE_DELAY = 0;
const BOARD_AREA_MODAL_STAGGER = 0.05;
const BOARD_AREA_MODAL_EXIT_GROUP_STAGGER = 0.035;
const BOARD_AREA_MODAL_EXIT_MIN_SCALE = 0.04;
/** Match the Board detail modal large-card close pop-out timing/ease. */
const BOARD_AREA_CARD_TAP_EXIT_PUNCH_DURATION = 0.12;
const BOARD_AREA_CARD_TAP_EXIT_PUNCH_SCALE = 1.14;
const BOARD_AREA_CARD_TAP_EXIT_DURATION = JOURNEY_V700_UNIT_CARD_EXIT_DURATION;
const BOARD_AREA_CARD_TAP_EXIT_EASE = JOURNEY_V700_UNIT_CARD_EXIT_EASE;
const BOARD_AREA_CARD_REMAINDER_EXIT_OVERLAP_MS = 100;
const JOURNEY_AREA_IDLE_RAMP_IN_SECONDS = 0.52;
const ACTIVE_BOARD_AREA_STORAGE_KEY = '__ccLastActiveJourneyBoardAreaId';
const LAST_ACTIVE_WORLD_STORAGE_KEY = '__ccLastActiveJourneyWorldId';
const LAST_ACTIVE_WORLD_BOARD_STORAGE_KEY = '__ccLastActiveJourneyWorldBoardId';
const JOURNEY_V700_VIEW_STORAGE_KEY = '__ccJourneyV700View';
const JOURNEY_V700_HUB_SCROLL_STORAGE_KEY = '__ccJourneyV700HubScrollTop';
const JOURNEY_V700_WORLD_STORAGE_KEY = '__ccJourneyV700WorldId';
const JOURNEY_WORLD_SIZE = 10;
const JOURNEY_WORLD_MAIN_OFFSETS_PX: Record<number, number> = {
  1: 0,
  2: 1454,
  3: 3166,
};
const JOURNEY_WORLD_LABELS: Record<number, { id: number; name: string; subtitle: string; asset: string; className: string }> = {
  1: {
    id: 1,
    name: 'Forest',
    subtitle: 'Stages 01-10',
    asset: `${FOREST_WORLD_ASSET_BASE}/Forest main.png`,
    className: 'journey-v700-world-forest',
  },
  2: {
    id: 2,
    name: 'Beach',
    subtitle: 'Stages 01-10',
    asset: `${BEACH_WORLD_ASSET_BASE}/beach-main.png`,
    className: 'journey-v700-world-beach',
  },
  3: {
    id: 3,
    name: 'Area 55',
    subtitle: 'Stages 01-10',
    asset: `${ROBO_WORLD_ASSET_BASE}/robo-main.png`,
    className: 'journey-v700-world-robo',
  },
};

type JourneyV700WorldCloudSpec = {
  src: string;
  x: number;
  y: number;
  width: number;
  opacity: number;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
  scale: number;
  worldId?: number;
};

const JOURNEY_V700_WORLD_CLOUD_ASSETS = [
  `${BOARD_TRANSITION_ASSET_BASE}/oblak-forest1.png`,
  `${BOARD_TRANSITION_ASSET_BASE}/oblak-forest2.png`,
  `${BOARD_TRANSITION_ASSET_BASE}/oblak+srednji.png`,
  `${BOARD_TRANSITION_ASSET_BASE}/oblak mali ljevo.png`,
  `${BOARD_TRANSITION_ASSET_BASE}/oblak mali desno.png`,
  `${BOARD_TRANSITION_ASSET_BASE}/oblak veliki ljevo dole.png`,
];

const JOURNEY_V700_HUB_CLOUDS: JourneyV700WorldCloudSpec[] = [
  // Forest framing: upper-left cloud bank, upper-right cloud, and a medium cloud hugging Forest's lower-right edge.
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[5], x: -70, y: -6, width: 272, opacity: 0.78, dx: 8, dy: -5, duration: 7.3, delay: -3.2, scale: 1.03, worldId: 1 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[1], x: -92, y: 58, width: 188, opacity: 0.74, dx: 7, dy: 4, duration: 6.8, delay: -2.4, scale: 1.025, worldId: 1 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[5], x: 100, y: 6, width: 248, opacity: 0.76, dx: 7, dy: -5, duration: 7.1, delay: -4.6, scale: 1.03, worldId: 1 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[2], x: 200, y: 138, width: 166, opacity: 0.72, dx: -7, dy: 5, duration: 6.7, delay: -1.9, scale: 1.02, worldId: 1 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[2], x: -34, y: 76, width: 286, opacity: 0.8, dx: 8, dy: -5, duration: 6.4, delay: -0.8, scale: 1.02 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[0], x: 214, y: 58, width: 184, opacity: 0.72, dx: -7, dy: 6, duration: 5.8, delay: -2.1, scale: 1.04 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[5], x: 24, y: 222, width: 214, opacity: 0.78, dx: -9, dy: 5, duration: 7.2, delay: -1.5, scale: 1.02 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[2], x: 168, y: 240, width: 198, opacity: 0.76, dx: 7, dy: -5, duration: 6.9, delay: -3.4, scale: 1.03 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[3], x: -22, y: 400, width: 176, opacity: 0.68, dx: 8, dy: 5, duration: 6.1, delay: -4.4, scale: 1.05 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[2], x: 136, y: 418, width: 236, opacity: 0.78, dx: -8, dy: 6, duration: 6.6, delay: -1.2, scale: 1.03 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[0], x: 32, y: 576, width: 214, opacity: 0.72, dx: 7, dy: -5, duration: 5.9, delay: -2.7, scale: 1.04 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[5], x: 198, y: 598, width: 184, opacity: 0.68, dx: -7, dy: 5, duration: 7.1, delay: -0.4, scale: 1.03 },
  { src: JOURNEY_V700_WORLD_CLOUD_ASSETS[2], x: -10, y: 632, width: 198, opacity: 0.62, dx: -6, dy: 4, duration: 7.6, delay: -6.1, scale: 1.04, worldId: 3 },
];

// Helper to convert pixels to viewport width units (vw)
// This ensures cards are always at the same position relative to screen width
function pxToVW(px: number, baseWidth: number = BASE_VIEWPORT_WIDTH): number {
  return (px / baseWidth) * 100;
}

// Helper to convert pixels to viewport height units (vh)
// This ensures cards are always at the same position relative to screen height
function pxToVH(px: number, baseHeight: number = BASE_VIEWPORT_HEIGHT): number {
  return (px / baseHeight) * 100;
}

function getJourneyContentTopPx(): number {
  const vw = window.innerWidth || 0;
  // iPad / wide tablet: legacy "Boards x/25" anchor removed (was 0); nudge still applies via JOURNEY_BOARDSTACK_NUDGE_DOWN_PX.
  const layoutAnchor =
    vw >= 769 && vw <= 1366
      ? 0
      : (pxToVH(JOURNEY_CONTENT_TOP_PX, BASE_VIEWPORT_HEIGHT) / 100) * window.innerHeight;
  return layoutAnchor + JOURNEY_BOARDSTACK_NUDGE_DOWN_PX;
}

function getJourneyCardStackTopPx(): number {
  return getJourneyContentTopPx() + JOURNEY_CARDSTACK_OFFSET_FROM_WORLD_PX;
}

function getJourneyWorldContentTopPx(): number {
  return getJourneyContentTopPx() - JOURNEY_V700_WORLD_CONTENT_LIFT_PX;
}

function getJourneyWorldCardStackTopPx(): number {
  return getJourneyCardStackTopPx() - JOURNEY_V700_WORLD_CONTENT_LIFT_PX;
}

// Legacy helpers for backward compatibility - now convert to viewport units
function pxToPercent(px: number, baseWidth: number = BASE_VIEWPORT_WIDTH): number {
  // For horizontal positions, convert to vw equivalent
  return pxToVW(px, baseWidth);
}

function pxToPercentTop(px: number, baseHeight: number = FRAME_HEIGHT): number {
  // For vertical positions, convert to vh equivalent
  // We need to map FRAME_HEIGHT pixels to viewport height
  const viewportRatio = BASE_VIEWPORT_HEIGHT / FRAME_HEIGHT;
  return pxToVH(px * viewportRatio, BASE_VIEWPORT_HEIGHT);
}

function forestTopPercent(px: number): number {
  return (px / FOREST_MAP_DESIGN_HEIGHT) * 100;
}

function getJourneyEarnedLevelStars(score: number, boardNumber: number): number {
  return getJourneyEarnedStars(score, boardNumber);
}

// Card positions - specify in PIXELS, system converts to VIEWPORT UNITS (vw/vh)
// Format: { x: pxToPercent(pixels_from_left) or vw value, top: pxToPercentTop(pixels_from_top) or vh value, width, height, rotation }
// IMPORTANT: When adding new cards, DO NOT change existing card positions!
// Standard card size - all Journey cards use the locked card aspect ratio.
const STANDARD_CARD_WIDTH = 90;
const STANDARD_CARD_HEIGHT = 133;

const CARD_POSITIONS = [
  { x: pxToPercent(28), top: forestTopPercent(155), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -4 },
  { x: pxToPercent(300), top: forestTopPercent(243), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(40), top: forestTopPercent(353), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(232), top: forestTopPercent(441), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(74), top: forestTopPercent(571), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(222), top: forestTopPercent(675), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(40), top: forestTopPercent(779), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(206), top: forestTopPercent(903), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(20), top: forestTopPercent(1007), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(222), top: forestTopPercent(1131), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(36), top: forestTopPercent(1691), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(230), top: forestTopPercent(1821), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(44), top: forestTopPercent(1955), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(222), top: forestTopPercent(2079), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(40), top: forestTopPercent(2193), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(226), top: forestTopPercent(2321), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(40), top: forestTopPercent(2449), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(228), top: forestTopPercent(2569), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(40), top: forestTopPercent(2695), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(226), top: forestTopPercent(2821), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(19), top: forestTopPercent(3419), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(242), top: forestTopPercent(3539), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(56), top: forestTopPercent(3663), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -11 },
  { x: pxToPercent(246), top: forestTopPercent(3775), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 4 },
  { x: pxToPercent(62), top: forestTopPercent(3943), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(234), top: forestTopPercent(4042), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(63), top: forestTopPercent(4176), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -6 },
  { x: pxToPercent(203), top: forestTopPercent(4295), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 6 },
  { x: pxToPercent(20), top: forestTopPercent(4415), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: -8 },
  { x: pxToPercent(240), top: forestTopPercent(4529), width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT, rotation: 10 },
];

const LOCKED_BOARD_NUMBER_OFFSETS: Record<number, { x: number; y: number; rotation?: number }> = {
  2: { x: -4, y: 32, rotation: -15 },
  3: { x: 0, y: 36, rotation: 4 },
  4: { x: 8, y: 32 },
  5: { x: 48, y: 15, rotation: 20 },
  6: { x: 10, y: 32 },
  7: { x: -44, y: 35, rotation: -15 },
  8: { x: 52, y: 32 },
  9: { x: 18, y: 40, rotation: 14 },
  10: { x: 6, y: 32 },
  11: { x: -42, y: 24, rotation: -8 },
  12: { x: 0, y: 23, rotation: -4 },
  13: { x: 12, y: 28, rotation: 8 },
  14: { x: 50, y: 4, rotation: 10 },
  15: { x: 0, y: 16, rotation: 13 },
  16: { x: -16, y: 6, rotation: -16 },
  17: { x: 3, y: 8, rotation: 3 },
  18: { x: 30, y: -2, rotation: 6 },
  19: { x: -8, y: 6, rotation: 4 },
  20: { x: 24, y: -6, rotation: 6 },
  21: { x: 6, y: 36, rotation: 1 },
  22: { x: 0, y: 29, rotation: -4 },
  23: { x: 5, y: 12, rotation: 8 },
  24: { x: 22, y: 36, rotation: 7 },
  25: { x: 40, y: 10, rotation: 21 },
  26: { x: -18, y: 18, rotation: -19 },
  27: { x: 43, y: 39, rotation: 7 },
  28: { x: 30, y: 2, rotation: 6 },
  29: { x: 19, y: 10, rotation: 4 },
  30: { x: -13, y: 13, rotation: -2 },
};


class JourneyBoardsManager {
  private boards: JourneyBoard[] = [];
  private container: HTMLElement | null = null;
  private renderDisposed = false; // Guard async work when screen is torn down
  private cleanupInProgress = false;
  private interimIdleEffectsCard: HTMLElement | null = null;
  private journeyExitPromise: Promise<void> | null = null;
  private journeyViewportExitPromise: Promise<void> | null = null;
  private journeyToGameExitActive = false;
  private journeyToGameExitBoardId: number | null = null;
  private journeyAreaIdleTicker: (() => void) | null = null;
  private journeyAreaIdleEntries: Array<{
    targets: HTMLElement[];
    areaId: string;
    targetStates: Array<{
      target: HTMLElement;
      setY: (value: number) => void;
      setX: ((value: number) => void) | null;
      initialY: number;
      initialX: number;
    }>;
    startTime: number;
    speed: number;
    phaseOffset: number;
    rampSeconds: number;
    amplitude: number;
    xAmplitude: number;
    xPhaseOffset: number;
    visibilityTarget: HTMLElement;
    isVisible: boolean;
  }> = [];
  private journeyAreaIdleVisibilityObserver: IntersectionObserver | null = null;
  private journeyAreaIdleEntryByVisibilityTarget = new Map<HTMLElement, typeof this.journeyAreaIdleEntries[number]>();
  private journeyAreaIdleStartTimeout: number | null = null;
  private journeyScrollSettledTimeout: number | null = null;
  private journeyAreaIdlePausedForInteraction = false;
  private activeBoardAreaEnterPreparedTargets: HTMLElement[] = [];
  private activeBoardAreaEnterInProgress = false;
  private journeyV700View: 'hub' | 'world' = 'hub';
  private journeyV700WorldId: number | null = null;
  private journeyV700NavCloseHandler: ((event: Event) => void) | null = null;
  private journeyDetailReturnEpoch = 0;
  private journeyDetailCloseGuardUntil = 0;
  private journeyDetailCloseInProgress = false;
  private journeyV700WorldOpenInProgress = false;
  private journeyCardOverlayModal: JourneyCardOverlayModalController | null = null;
  private journeyOverlayReturnInFlight: { boardId: number; promise: Promise<void> } | null = null;
  private journeyV700Phase: 'hidden' | 'entering' | 'idle' | 'exiting' = 'hidden';
  private journeyV700HubEnterTweens: gsap.core.Tween[] = [];
  private journeyV700HubEnterEpoch = 0;
  private journeyV700HubPresentationWaiters = new Set<() => void>();
  private journeyWorldAnimation = new JourneyWorldAnimationCoordinator();
  private journeyV700WorldMotionEpoch = 0;
  private journeyV700PreparedWorldEnter: { worldId: number; targets: HTMLElement[] } | null = null;
  private journeyV700HubTopGuard: {
    scrollable: HTMLElement;
    onScroll: () => void;
    onManualIntent: () => void;
  } | null = null;

  // 🔥 USER REQUEST: Shimmer is now triggered together with glow (not independent interval)
  // 🔥 USER REQUEST: Smoke bubbles are now triggered DURING bounce animation (not independent interval)
  
  // 🔥 MEMORY LEAK FIX: Track all requestAnimationFrame calls for proper cleanup
  private _activeRAFs: Set<number> = new Set();
  private _activeTimeouts: Set<number> = new Set();
  private _floatingDetailPlayButtons: Set<HTMLElement> = new Set();
  
  /**
   * 🔥 MEMORY LEAK FIX: Track requestAnimationFrame calls for cleanup
   */
  private trackRAF(callback: FrameRequestCallback): number {
    if (this.renderDisposed) return 0;
    const rafId = requestAnimationFrame((time: number) => {
      this._activeRAFs.delete(rafId);
      callback(time);
    });
    this._activeRAFs.add(rafId);
    return rafId;
  }

  private trackTimeout(callback: () => void, delayMs: number): number {
    if (this.renderDisposed) return 0;
    const timeoutId = window.setTimeout(() => {
      this._activeTimeouts.delete(timeoutId);
      if (this.renderDisposed) return;
      callback();
    }, delayMs);
    this._activeTimeouts.add(timeoutId);
    return timeoutId;
  }
  
  /**
   * 🔥 MEMORY LEAK FIX: Cancel all tracked RAF calls
   */
  private cancelAllRAFs(): void {
    this._activeRAFs.forEach(rafId => {
      try {
        cancelAnimationFrame(rafId);
      } catch (e) {
        // Ignore errors
      }
    });
    this._activeRAFs.clear();
    logger.info(`✅ Cancelled all tracked RAF calls`);
  }

  private cancelAllTimeouts(): void {
    this._activeTimeouts.forEach(timeoutId => {
      try {
        window.clearTimeout(timeoutId);
      } catch {}
    });
    this._activeTimeouts.clear();
    this._floatingDetailPlayButtons.forEach(button => {
      try {
        if (button.parentNode) button.remove();
      } catch {}
    });
    this._floatingDetailPlayButtons.clear();
    this.journeyAreaIdleStartTimeout = null;
    this.journeyScrollSettledTimeout = null;
    logger.info('✅ Cancelled all tracked Journey timeouts');
  }

  private clearJourneyAreaIdleStartTimeout(): void {
    if (!this.journeyAreaIdleStartTimeout) return;
    logger.info('🧭 JourneyForestAnim idle-start-timeout clear', {
      timeoutId: this.journeyAreaIdleStartTimeout,
    });
    try {
      window.clearTimeout(this.journeyAreaIdleStartTimeout);
      this._activeTimeouts.delete(this.journeyAreaIdleStartTimeout);
    } catch {}
    this.journeyAreaIdleStartTimeout = null;
  }

  private isJourneyCardTapExitProtectedTarget(target: HTMLElement): boolean {
    const wrapper = target.classList.contains('journey-board-card-wrapper')
      ? target
      : target.closest('.journey-board-card-wrapper') as HTMLElement | null;
    return !!wrapper && (
      (wrapper as any).__ccJourneyCardTapExitActive === true
      || (wrapper as any).__ccJourneyToGameExitTween === true
    );
  }

  private cleanupJourneyAreaIdleAnimations(resetTransforms = true): void {
    try {
      const tickerCount = this.journeyAreaIdleTicker ? 1 : 0;
      const areaCount = this.journeyAreaIdleEntries.length;
      if (this.journeyAreaIdleTicker) {
        try { gsap.ticker.remove(this.journeyAreaIdleTicker); } catch {}
        this.journeyAreaIdleTicker = null;
      }
      if (this.journeyAreaIdleVisibilityObserver) {
        try { this.journeyAreaIdleVisibilityObserver.disconnect(); } catch {}
        this.journeyAreaIdleVisibilityObserver = null;
      }
      this.journeyAreaIdleEntryByVisibilityTarget.clear();
      this.journeyAreaIdleEntries = [];
      if (resetTransforms) {
        this.journeyAreaIdlePausedForInteraction = false;
      }

      const idleTargets = document.querySelectorAll(
        '.journey-area-idle-target, .journey-board-card-wrapper[data-journey-area-id]'
      );
      idleTargets.forEach((target) => {
        const el = target as HTMLElement;
        if ((el as any).__ccJourneyToGameExitTween) return;
        if (this.isJourneyCardTapExitProtectedTarget(el)) return;
        try { gsap.killTweensOf(el); } catch {}
        if (el.classList.contains('journey-robo-alien-beam-art') || el.querySelector('.journey-robo-alien-beam-art')) {
          setJourneyAlienBeamIdleReady(el, false);
          try { gsap.set(el, { clearProps: 'opacity' }); } catch {}
          el.style.removeProperty('opacity');
        }
        if (resetTransforms) {
          try {
            const resetVars = el.classList.contains('journey-forest-cloud-art') ? { x: 0, y: 0 } : { y: 0 };
            gsap.set(el, resetVars);
            el.style.willChange = '';
          } catch {}
        }
      });
      if (tickerCount > 0 || resetTransforms) {
        logger.info('🧭 JourneyForestAnim idle-cleanup', {
          resetTransforms,
          removedTickers: tickerCount,
          removedAreas: areaCount,
          targetCount: idleTargets.length,
        });
      }
    } catch (error) {
      logger.warn('⚠️ Failed to cleanup Journey area idle animations:', error);
    }
  }

  private stopJourneyAreaIdleForTargets(targets: HTMLElement[]): void {
    try {
      const targetSet = new Set(targets.filter((target) => target && document.body.contains(target)));
      if (!targetSet.size || !this.journeyAreaIdleEntries.length) return;

      const remaining: typeof this.journeyAreaIdleEntries = [];
      let removed = 0;
      this.journeyAreaIdleEntries.forEach((entry) => {
        const overlaps = entry.targets.some((target) => targetSet.has(target));
        if (!overlaps) {
          remaining.push(entry);
          return;
        }
        removed += 1;
        if (this.journeyAreaIdleVisibilityObserver) {
          try { this.journeyAreaIdleVisibilityObserver.unobserve(entry.visibilityTarget); } catch {}
        }
        this.journeyAreaIdleEntryByVisibilityTarget.delete(entry.visibilityTarget);
      });
      this.journeyAreaIdleEntries = remaining;
      if (!remaining.length && this.journeyAreaIdleTicker) {
        try { gsap.ticker.remove(this.journeyAreaIdleTicker); } catch {}
        this.journeyAreaIdleTicker = null;
      }

      targetSet.forEach((target) => {
        if ((target as any).__ccJourneyToGameExitTween) return;
        if (this.isJourneyCardTapExitProtectedTarget(target)) return;
        try { gsap.killTweensOf(target); } catch {}
        target.style.willChange = 'auto';
      });

      logger.info('🧭 JourneyForestAnim idle-stop-targets', {
        targetCount: targetSet.size,
        removedAreas: removed,
        remainingAreas: this.journeyAreaIdleEntries.length,
        frameTickerActive: !!this.journeyAreaIdleTicker,
      });
    } catch (error) {
      logger.warn('⚠️ Failed to stop Journey area idle for targets:', error);
    }
  }

  private createJourneyAreaIdleTimeline(
    areaId: string,
    targets: HTMLElement[],
    options: { amplitude: number; cycleDuration: number; delay: number; xAmplitude?: number; xPhaseOffset?: number; rampSeconds?: number; preserveInitialTransform?: boolean }
  ): void {
    const liveTargets = targets.filter((target) => target && document.body.contains(target));
    if (!liveTargets.length) {
      logger.warn('🧭 JourneyForestAnim idle-skip-empty-area', { areaId });
      return;
    }

    liveTargets.forEach((target) => {
      if (target.classList.contains('journey-board-card-wrapper') && !options.preserveInitialTransform) {
        restoreJourneyBoardCardBaseTransform(target);
      } else {
        target.style.opacity = '1';
        target.style.visibility = 'visible';
      }
      target.classList.add('journey-area-idle-target');
      // `data-journey-area-id` is the canonical V700 Unit identity. Legacy
      // idle used to overwrite Beach/Robo main ownership with `forest-main`
      // and `forest-main-cloud-*`, so the next enter omitted the main PNG.
      // Only backfill identity for genuinely unowned legacy targets.
      if (!target.dataset.journeyAreaId) {
        target.dataset.journeyAreaId = areaId;
      }
      if (
        (target.classList.contains('journey-robo-alien-beam-art') || target.querySelector('.journey-robo-alien-beam-art')) &&
        this.journeyV700Phase === 'idle' &&
        !this.activeBoardAreaEnterInProgress
      ) {
        setJourneyAlienBeamIdleReady(target, true);
      }
      target.style.willChange = target.classList.contains('journey-robo-alien-beam-art')
        ? 'transform, opacity'
        : 'transform';
    });

    const targetStates = liveTargets.map((target) => {
      const initialYRaw = Number(gsap.getProperty(target, 'y') || 0);
      const initialXRaw = Number(gsap.getProperty(target, 'x') || 0);
      return {
        target,
        setY: gsap.quickSetter(target, 'y', 'px') as (value: number) => void,
        setX: options.xAmplitude
          ? gsap.quickSetter(target, 'x', 'px') as (value: number) => void
          : null,
        initialY: Number.isFinite(initialYRaw) ? initialYRaw : 0,
        initialX: Number.isFinite(initialXRaw) ? initialXRaw : 0,
      };
    });
    const speed = (Math.PI * 2) / options.cycleDuration;
    const visibilityTarget = liveTargets.find((target) => target.classList.contains('journey-board-card-wrapper'))
      || liveTargets.find((target) => target.classList.contains('journey-forest-island-art'))
      || liveTargets[0];
    const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
    const visibilityRect = visibilityTarget.getBoundingClientRect();
    const viewportRect = scrollable?.getBoundingClientRect();
    const isInitiallyVisible = viewportRect
      ? visibilityRect.bottom >= viewportRect.top - 240 && visibilityRect.top <= viewportRect.bottom + 240
      : true;
    const entry = {
      targets: liveTargets,
      areaId,
      targetStates,
      startTime: gsap.ticker.time,
      speed,
      phaseOffset: options.delay * speed,
      rampSeconds: options.rampSeconds ?? JOURNEY_AREA_IDLE_RAMP_IN_SECONDS,
      amplitude: options.amplitude,
      xAmplitude: options.xAmplitude || 0,
      xPhaseOffset: options.xPhaseOffset ?? 1.4,
      visibilityTarget,
      isVisible: isInitiallyVisible,
    };
    this.journeyAreaIdleEntries.push(entry);

    if (typeof IntersectionObserver !== 'undefined') {
      if (!this.journeyAreaIdleVisibilityObserver) {
        this.journeyAreaIdleVisibilityObserver = new IntersectionObserver((records) => {
          records.forEach((record) => {
            const target = record.target as HTMLElement;
            const observedEntry = this.journeyAreaIdleEntryByVisibilityTarget.get(target);
            if (!observedEntry) return;
            const nextVisible = record.isIntersecting;
            if (nextVisible && !observedEntry.isVisible) {
              observedEntry.startTime = gsap.ticker.time;
              observedEntry.targetStates.forEach((state) => {
                const y = Number(gsap.getProperty(state.target, 'y') || 0);
                const x = Number(gsap.getProperty(state.target, 'x') || 0);
                state.initialY = Number.isFinite(y) ? y : 0;
                state.initialX = Number.isFinite(x) ? x : 0;
              });
            }
            observedEntry.isVisible = nextVisible;
            observedEntry.targets.forEach((idleTarget) => {
              idleTarget.style.willChange = nextVisible
                ? (idleTarget.classList.contains('journey-robo-alien-beam-art') ? 'transform, opacity' : 'transform')
                : 'auto';
            });
          });
        }, {
          root: scrollable,
          rootMargin: '240px 0px',
          threshold: 0,
        });
      }
      this.journeyAreaIdleEntryByVisibilityTarget.set(visibilityTarget, entry);
      this.journeyAreaIdleVisibilityObserver.observe(visibilityTarget);
    }

    if (!this.journeyAreaIdleTicker) {
      this.journeyAreaIdleTicker = () => {
        if (this.renderDisposed) {
          if (this.journeyAreaIdleTicker) {
            try { gsap.ticker.remove(this.journeyAreaIdleTicker); } catch {}
          }
          this.journeyAreaIdleTicker = null;
          this.journeyAreaIdleEntries = [];
          return;
        }

        const now = gsap.ticker.time;
        this.journeyAreaIdleEntries.forEach((entry) => {
          if (!entry.isVisible) return;
          const elapsed = now - entry.startTime;
          const waveY = Math.sin((elapsed * entry.speed) + entry.phaseOffset) * entry.amplitude;
          const rampProgress = Math.min(1, Math.max(0, elapsed / entry.rampSeconds));
          const ramp = rampProgress * rampProgress * rampProgress * (rampProgress * ((rampProgress * 6) - 15) + 10);
          const waveX = entry.xAmplitude
            ? Math.sin((elapsed * entry.speed * 0.82) + entry.phaseOffset + entry.xPhaseOffset) * entry.xAmplitude
            : 0;

          entry.targetStates.forEach((state) => {
            if (!state.target.isConnected) return;
            state.setY(state.initialY + ((waveY - state.initialY) * ramp));
            if (state.setX && entry.xAmplitude) {
              state.setX(state.initialX + ((waveX - state.initialX) * ramp));
            }
          });
        });
      };
      gsap.ticker.add(this.journeyAreaIdleTicker);
    }
    logger.info('🧭 JourneyForestAnim idle-area-created', {
      areaId,
      targetCount: liveTargets.length,
      amplitude: Number(options.amplitude.toFixed(2)),
      xAmplitude: Number((options.xAmplitude || 0).toFixed(2)),
      cycleDuration: Number(options.cycleDuration.toFixed(2)),
      phaseOffset: Number(options.delay.toFixed(2)),
      initialY: Number((targetStates[0]?.initialY || 0).toFixed(2)),
      rampInSeconds: entry.rampSeconds,
      totalAreas: this.journeyAreaIdleEntries.length,
      frameTickerCount: this.journeyAreaIdleTicker ? 1 : 0,
    });
  }

  private startJourneyBoardAreaIdleAnimation(boardId: number, cardsContainer: HTMLElement): void {
    const forestAreas = this.getCurrentJourneyForestAreas(cardsContainer);
    const targets = [...(forestAreas.boardTargets.get(boardId) || [])];
    const card = cardsContainer.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
    const cardWrapper = card?.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (cardWrapper && !targets.includes(cardWrapper)) {
      cardWrapper.dataset.journeyAreaId = `board-${boardId}`;
      targets.push(cardWrapper);
    }
    if (!targets.length) return;

    this.stopJourneyAreaIdleForTargets(targets);

    this.createJourneyAreaIdleTimeline(`board-${boardId}-unified-resume`, targets, {
      amplitude: 5.4,
      cycleDuration: 3.7,
      delay: 0,
      rampSeconds: 1.8,
    });
    this.startVisibleInterimCardIdleEffects(cardsContainer);
  }

  private pauseJourneyAreaIdleForInteraction(resumeDelayMs = 900): void {
    try {
      // Opening a detail modal is initiated while the coordinated world exit
      // is already in flight. Do not let the modal's generic interaction
      // pause tear down/restart world idle during the short card-shrink
      // overlap: that restart writes every Unit back near y=0 and produces
      // the visible one-frame card jerk before the standard exit.
      if (
        this.journeyToGameExitActive &&
        this.journeyV700View === 'world' &&
        !!this.journeyV700WorldId
      ) {
        logger.info('🧭 JourneyForestAnim interaction-idle-pause-owned-by-world-exit', {
          resumeDelayMs,
          worldId: this.journeyV700WorldId,
          boardId: this.journeyToGameExitBoardId,
        });
        return;
      }

      this.clearJourneyAreaIdleStartTimeout();
      if (!this.journeyAreaIdlePausedForInteraction) {
        this.journeyAreaIdlePausedForInteraction = true;
        this.cleanupJourneyAreaIdleAnimations(false);
      }

      const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement | null;
      const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
      const detailModal = document.getElementById('collectibles-detail-modal') as HTMLElement | null;
      const modalOpen = !!detailModal && detailModal.hidden !== true && detailModal.style.display !== 'none';
      const journeyVisible =
        !!journeyScreen &&
        journeyScreen.hidden !== true &&
        journeyScreen.style.display !== 'none' &&
        window.getComputedStyle(journeyScreen).display !== 'none';

      if (this.journeyScrollSettledTimeout) {
        window.clearTimeout(this.journeyScrollSettledTimeout);
        this._activeTimeouts.delete(this.journeyScrollSettledTimeout);
        this.journeyScrollSettledTimeout = null;
      }

      if (!cardsContainer || !journeyVisible || modalOpen) return;

      const timeoutId = this.trackTimeout(() => {
        this.journeyScrollSettledTimeout = null;
        if (!document.body.contains(cardsContainer)) return;
        const activeDetailModal = document.getElementById('collectibles-detail-modal') as HTMLElement | null;
        const isModalOpen = !!activeDetailModal && activeDetailModal.hidden !== true && activeDetailModal.style.display !== 'none';
        if (isModalOpen) return;
        this.journeyAreaIdlePausedForInteraction = false;
        this.startJourneyAreaIdleAnimations(this.getCurrentJourneyForestAreas(cardsContainer), cardsContainer);
      }, resumeDelayMs);
      this.journeyScrollSettledTimeout = timeoutId || null;
    } catch (error) {
      logger.warn('⚠️ Failed to pause Journey idle for interaction:', error);
    }
  }

  private getJourneyBoardCardVisualTarget(target: HTMLElement): HTMLElement {
    if (!target.classList.contains('journey-board-card-wrapper')) return target;
    return (target.querySelector('.journey-board-card') as HTMLElement | null) || target;
  }

  private isInterimCardWrapper(target: HTMLElement): boolean {
    return target.classList.contains('journey-board-card-wrapper') &&
      !!target.querySelector('.journey-board-card.interim');
  }

  private prepareJourneyBoardCardVisualTarget(target: HTMLElement): HTMLElement {
    const visualTarget = this.getJourneyBoardCardVisualTarget(target);
    if (visualTarget !== target) {
      restoreJourneyBoardCardBaseTransform(target);
      try { gsap.killTweensOf(visualTarget); } catch {}
      visualTarget.style.transformOrigin = '50% 50%';
      visualTarget.style.transition = 'none';
      visualTarget.style.willChange = 'transform, opacity';
    }
    return visualTarget;
  }

  private restoreJourneyBoardCardVisualTarget(target: HTMLElement): void {
    // A late World-enter completion must never reset the card while the
    // selected Unit owns its Play/Continue exit. This protection belongs in
    // the shared restore helper because several async paths call it.
    if (this.isJourneyCardTapExitProtectedTarget(target)) return;
    const visualTarget = this.getJourneyBoardCardVisualTarget(target);
    if (visualTarget === target) return;
    try {
      gsap.killTweensOf(visualTarget);
      gsap.set(visualTarget, {
        scale: 1,
        opacity: 1,
        visibility: 'visible',
        clearProps: 'transform,opacity,visibility',
        overwrite: true,
      });
    } catch {}
    visualTarget.style.transition = '';
    visualTarget.style.willChange = '';
    restoreJourneyBoardCardBaseTransform(target);
  }

  private restoreJourneyBoardCardInnerVisual(target: HTMLElement): void {
    // The active card-exit owner is authoritative until its timeline finishes.
    // Without this guard, a stale World-enter cleanup kills the new tween and
    // makes the restored card appear to disappear without a bounce.
    if (this.isJourneyCardTapExitProtectedTarget(target)) return;
    if (!target.classList.contains('journey-board-card-wrapper')) return;
    const card = target.querySelector('.journey-board-card') as HTMLElement | null;
    if (!card) return;
    try {
      gsap.killTweensOf(card);
      gsap.set(card, {
        scale: 1,
        opacity: 1,
        visibility: 'visible',
        clearProps: 'transform,opacity,visibility',
        overwrite: true,
      });
    } catch {}
    card.style.transition = '';
    card.style.willChange = 'auto';
    card.style.pointerEvents = '';
    card.style.visibility = 'visible';
    card.style.opacity = '1';
    console.log('🧩 JourneyUnitExit active-enter-card-inner-restored', {
      boardId: card.getAttribute('data-board-id') || null,
      scale: Number(gsap.getProperty(card, 'scale') || 0),
      opacity: Number(gsap.getProperty(card, 'opacity') || 0),
    });
  }

  private restoreJourneyBoardCardWrapperVisibility(target: HTMLElement): void {
    if (!target.classList.contains('journey-board-card-wrapper')) return;
    restoreJourneyBoardCardBaseTransform(target);
    try {
      gsap.set(target, {
        opacity: 1,
        visibility: 'visible',
        overwrite: true,
      });
    } catch {}
    target.style.opacity = '1';
    target.style.visibility = 'visible';
    target.style.pointerEvents = '';
    target.style.willChange = 'auto';
  }

  private resetJourneyBoardVisualResidue(reason: string): void {
    try {
      this.clearJourneyAreaIdleStartTimeout();
      this.cleanupJourneyAreaIdleAnimations(false);

      const roots = Array.from(document.querySelectorAll('#journey-screen, #journey-boards-container')) as HTMLElement[];
      const root = roots[0] || document.body;
      const targets = Array.from(new Set(Array.from(root.querySelectorAll(
        [
          '.journey-board-card-wrapper',
          '.journey-forest-main-art',
          '.journey-forest-cloud-art',
          '.journey-forest-island-art',
          '.journey-forest-stump-art',
          '.journey-forest-star-art',
        ].join(', ')
      )))) as HTMLElement[];

      const duplicateCounts = new Map<string, number>();
      targets.forEach((target) => {
        const boardCard = target.classList.contains('journey-board-card-wrapper')
          ? target.querySelector('.journey-board-card') as HTMLElement | null
          : null;
        const boardId = boardCard?.dataset?.boardId;
        if (boardId) {
          duplicateCounts.set(`card-${boardId}`, (duplicateCounts.get(`card-${boardId}`) || 0) + 1);
        }
        const beamClass = Array.from(target.classList).find((className) => className.startsWith('journey-robo-alien-beam-board-'));
        if (beamClass) {
          duplicateCounts.set(beamClass, (duplicateCounts.get(beamClass) || 0) + 1);
        }

        if ((target as any).__ccJourneyToGameExitTween) return;
        try { gsap.killTweensOf(target); } catch {}
        target.classList.remove('journey-area-idle-target');
        target.style.transition = '';
        target.style.pointerEvents = '';
        target.style.willChange = '';

        if (target.classList.contains('journey-board-card-wrapper')) {
          this.restoreJourneyBoardCardWrapperVisibility(target);
          this.restoreJourneyBoardCardVisualTarget(target);
          return;
        }

        if (target.classList.contains('journey-robo-alien-beam-art')) {
          target.style.removeProperty('opacity');
        }

        try {
          gsap.set(target, {
            scale: 1,
            opacity: 1,
            visibility: 'visible',
            x: 0,
            y: 0,
            clearProps: 'scale,x,y',
            overwrite: true,
          });
          target.style.opacity = '1';
          target.style.visibility = 'visible';
        } catch {}
      });

      const duplicates = Array.from(duplicateCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([key, count]) => ({ key, count }));
      if (targets.length || duplicates.length) {
        logger.info('🧭 Journey visual residue reset', {
          reason,
          targetCount: targets.length,
          duplicates,
        });
      }
    } catch (error) {
      logger.warn('⚠️ Failed to reset Journey visual residue:', {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public prepareJourneyBoardCardTransformsForReveal(reason: string): void {
    try {
      const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement | null;
      const root = cardsContainer || document.getElementById('journey-boards-container') || document;
      const wrappers = Array.from(root.querySelectorAll('.journey-board-card-wrapper')) as HTMLElement[];

      wrappers.forEach((wrapper) => {
        if ((wrapper as any).__ccJourneyToGameExitTween) return;
        const visualTarget = this.getJourneyBoardCardVisualTarget(wrapper);
        const isActiveInterimCard =
          visualTarget.classList.contains('journey-board-card') &&
          visualTarget.classList.contains('interim') &&
          (wrapper as any)._interimBounceActive;
        try { gsap.killTweensOf(wrapper); } catch {}
        if (!isActiveInterimCard) {
          try { gsap.killTweensOf(visualTarget); } catch {}
        }

        rememberJourneyBoardCardBaseTransform(wrapper);
        this.restoreJourneyBoardCardWrapperVisibility(wrapper);
        if (!isActiveInterimCard) {
          this.restoreJourneyBoardCardVisualTarget(wrapper);
        }

        wrapper.style.transition = 'none';
        wrapper.style.willChange = 'auto';
        if (!isActiveInterimCard) {
          visualTarget.style.transition = 'none';
          visualTarget.style.willChange = 'auto';
        }

        window.requestAnimationFrame(() => {
          if (!document.body.contains(wrapper)) return;
          wrapper.style.transition = '';
          if (!isActiveInterimCard) {
            visualTarget.style.transition = '';
          }
        });
      });

      logger.info('🧭 Journey card transforms prepared for reveal', {
        reason,
        count: wrappers.length,
      });
    } catch (error) {
      logger.warn('⚠️ Failed to prepare Journey card transforms for reveal:', error);
    }
  }

  private startJourneyAreaIdleAnimations(
    forestAreas: { mainTargets: HTMLElement[]; cloudTargets?: HTMLElement[]; boardTargets: Map<number, HTMLElement[]> },
    cardsContainer: HTMLElement,
    preserveCurrentBoardTransforms = false,
  ): void {
    this.journeyAreaIdlePausedForInteraction = false;
    this.cleanupJourneyAreaIdleAnimations(false);
    if (this.renderDisposed) return;

    const boardTargetCounts = Array.from(forestAreas.boardTargets.entries())
      .map(([boardId, targets]) => ({ boardId, targets: targets.length }));
    logger.info('🧭 JourneyForestAnim idle-start', {
      mainTargets: forestAreas.mainTargets.length,
      cloudTargets: forestAreas.cloudTargets?.length || 0,
      boardTargetCounts,
      cardsContainerConnected: !!cardsContainer && document.body.contains(cardsContainer),
    });

    const randomInRange = (min: number, max: number): number => (
      min + (Math.random() * (max - min))
    );

    this.createJourneyAreaIdleTimeline('forest-main', forestAreas.mainTargets, {
      amplitude: randomInRange(4.8, 6.4),
      cycleDuration: randomInRange(3.1, 3.9),
      delay: randomInRange(0.05, 0.22),
    });

    (forestAreas.cloudTargets || []).forEach((cloud, index) => {
      this.createJourneyAreaIdleTimeline(`forest-main-cloud-${index + 1}`, [cloud], {
        amplitude: randomInRange(9.5, 16),
        xAmplitude: randomInRange(12, 20),
        xPhaseOffset: randomInRange(0.7, 2.4),
        cycleDuration: randomInRange(3.8, 5.6),
        delay: randomInRange(0.05, 1.2),
      });
    });

    forestAreas.boardTargets.forEach((targets, boardId) => {
      const card = cardsContainer.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
      const cardWrapper = card?.closest('.journey-board-card-wrapper') as HTMLElement | null;
      if (cardWrapper) {
        cardWrapper.dataset.journeyAreaId = `board-${boardId}`;
        if (!targets.includes(cardWrapper)) {
          targets.push(cardWrapper);
        }
      }

      this.createJourneyAreaIdleTimeline(`board-${boardId}`, targets, {
        amplitude: randomInRange(6.5, 10.5),
        cycleDuration: randomInRange(2.55, 3.45),
        delay: randomInRange(0.08, 0.72),
        rampSeconds: preserveCurrentBoardTransforms ? 1.8 : undefined,
        preserveInitialTransform: preserveCurrentBoardTransforms,
      });
    });

    this.startVisibleInterimCardIdleEffects(cardsContainer);
  }

  private pauseJourneyWorldForCardOverlay(reason: string): void {
    this.clearJourneyAreaIdleStartTimeout();
    if (this.journeyScrollSettledTimeout) {
      window.clearTimeout(this.journeyScrollSettledTimeout);
      this._activeTimeouts.delete(this.journeyScrollSettledTimeout);
      this.journeyScrollSettledTimeout = null;
    }
    this.journeyAreaIdlePausedForInteraction = true;
    this.cleanupJourneyAreaIdleAnimations(false);
    journeySpatialMotion.profileFrameWindow(`journey-card-overlay:${reason}`, 5000);
    emitIOSNativeDiagnostic('card-overlay-world-idle-paused', {
      reason,
      worldId: this.journeyV700WorldId,
    });
  }

  private resumeJourneyWorldAfterCardOverlay(reason: string): void {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    const cardsContainer = container?.querySelector<HTMLElement>('.journey-cards-container') ?? null;
    if (
      !container ||
      !cardsContainer ||
      this.renderDisposed ||
      this.journeyV700View !== 'world' ||
      !this.journeyV700WorldId
    ) return;
    this.startJourneyAreaIdleAnimations(
      this.getCurrentJourneyForestAreas(cardsContainer),
      cardsContainer,
      true,
    );
    emitIOSNativeDiagnostic('card-overlay-world-idle-resumed', {
      reason,
      worldId: this.journeyV700WorldId,
    });
  }

  private scheduleJourneyAreaIdleAnimations(cardsContainer: HTMLElement, delayMs: number): void {
    this.clearJourneyAreaIdleStartTimeout();
    logger.info('🧭 JourneyForestAnim idle-schedule', {
      delayMs,
      cardsContainerConnected: !!cardsContainer && document.body.contains(cardsContainer),
      activeBoardId: this.getLastActiveJourneyBoardAreaId(),
    });
    const timeoutId = this.trackTimeout(() => {
      this.journeyAreaIdleStartTimeout = null;
      if (!cardsContainer || !document.body.contains(cardsContainer)) {
        logger.warn('🧭 JourneyForestAnim idle-schedule-fired-missing-container');
        return;
      }
      logger.info('🧭 JourneyForestAnim idle-schedule-fired', { delayMs });
      this.startJourneyAreaIdleAnimations(this.getCurrentJourneyForestAreas(cardsContainer), cardsContainer);
    }, delayMs);
    this.journeyAreaIdleStartTimeout = timeoutId || null;
  }

  private getCurrentJourneyForestAreas(
    cardsContainer: HTMLElement
  ): { mainTargets: HTMLElement[]; cloudTargets: HTMLElement[]; boardTargets: Map<number, HTMLElement[]> } {
    const mainTargets = Array.from(
      document.querySelectorAll('[data-journey-area-id="forest-main"], .journey-forest-main-art')
    ) as HTMLElement[];
    const cloudTargets = Array.from(
      document.querySelectorAll('.journey-forest-cloud-art')
    ) as HTMLElement[];
    const boardTargets = new Map<number, HTMLElement[]>();

    this.boards.slice(0, JOURNEY_RENDERED_BOARDS).forEach((board) => {
      const targets = this.getJourneyAreaElements(board.id);
      const card = cardsContainer.querySelector(`.journey-board-card[data-board-id="${board.id}"]`) as HTMLElement | null;
      const cardWrapper = card?.closest('.journey-board-card-wrapper') as HTMLElement | null;
      if (cardWrapper && !targets.includes(cardWrapper)) {
        targets.push(cardWrapper);
      }
      if (targets.length) {
        boardTargets.set(board.id, targets);
      }
    });

    return {
      mainTargets: Array.from(new Set(mainTargets)).filter((target) => target && document.body.contains(target)),
      cloudTargets: Array.from(new Set(cloudTargets)).filter((target) => target && document.body.contains(target)),
      boardTargets,
    };
  }

  public playJourneyForestSceneEnterAnimation(retryCount = 0): void {
    try {
      const journeyContainer = document.getElementById('journey-boards-container') as HTMLElement | null;
      const isV700View =
        this.journeyV700View === 'hub' ||
        this.journeyV700View === 'world' ||
        journeyContainer?.dataset.journeyV700View === 'hub' ||
        journeyContainer?.dataset.journeyV700View === 'world' ||
        (window as any).__ccJourneyV700View === 'hub' ||
        (window as any).__ccJourneyV700View === 'world';
      if (isV700View) {
        this.logJourneyV700Flow('legacy-scene-enter-skipped-v700-owned', { retryCount }, journeyContainer);
        return;
      }

      const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement | null;
      if (!cardsContainer || !document.body.contains(cardsContainer)) {
        logger.warn('🧭 JourneyForestAnim scene-enter-missing-container', { retryCount });
        if (retryCount < 4) {
          this.trackTimeout(() => this.playJourneyForestSceneEnterAnimation(retryCount + 1), 80);
        }
        return;
      }

      const forestAreas = this.getCurrentJourneyForestAreas(cardsContainer);
      const areaGroups: Array<{ areaId: string; targets: HTMLElement[]; isMain?: boolean }> = [];
      if (forestAreas.mainTargets.length) {
        areaGroups.push({ areaId: 'forest-main', targets: forestAreas.mainTargets, isMain: true });
      }
      if (forestAreas.cloudTargets?.length) {
        areaGroups.push({ areaId: 'forest-main-clouds', targets: forestAreas.cloudTargets, isMain: true });
      }
      forestAreas.boardTargets.forEach((targets, boardId) => {
        areaGroups.push({ areaId: `board-${boardId}`, targets });
      });

      if (!areaGroups.length) {
        logger.warn('🧭 JourneyForestAnim scene-enter-no-area-groups', { retryCount });
        if (retryCount < 4) {
          this.trackTimeout(() => this.playJourneyForestSceneEnterAnimation(retryCount + 1), 80);
        }
        return;
      }

      this.cleanupJourneyAreaIdleAnimations(false);

      const allTargets = Array.from(new Set(areaGroups.flatMap((group) => group.targets)))
        .filter((target) => target && document.body.contains(target));
      logger.info('🧭 JourneyForestAnim scene-enter-ready', {
        retryCount,
        activeBoardId: this.getLastActiveJourneyBoardAreaId(),
        areaGroups: areaGroups.map((group) => ({
          areaId: group.areaId,
          targets: group.targets.length,
          isMain: group.isMain === true,
        })),
        allTargets: allTargets.length,
      });
      allTargets.forEach((target) => {
        try { gsap.killTweensOf(target); } catch {}
        target.classList.add('journey-area-idle-target');
        restoreJourneyAreaTransformOrigin(target);
        target.style.willChange = 'auto';
      });

      const idleStartDelayMs = this.getLastActiveJourneyBoardAreaId()
        ? 1200
        : 780;
      logger.info('🧭 JourneyForestAnim scene-enter-idle-delay', {
        idleStartDelayMs,
        activeBoardId: this.getLastActiveJourneyBoardAreaId(),
      });
      this.scheduleJourneyAreaIdleAnimations(cardsContainer, idleStartDelayMs);
    } catch (error) {
      logger.warn('⚠️ Failed to play Journey forest scene enter animation:', error);
    }
  }

  private getLastActiveJourneyBoardAreaId(): number | null {
    try {
      const raw =
        (window as any).__ccLastActiveJourneyBoardAreaId ??
        localStorage.getItem(ACTIVE_BOARD_AREA_STORAGE_KEY);
      const boardId = Number(raw || 0);
      return Number.isFinite(boardId) && boardId > 0 ? boardId : null;
    } catch {
      return null;
    }
  }

  private getJourneyWorldIdForBoard(boardId: number): number | null {
    if (!Number.isFinite(boardId) || boardId <= 0) return null;
    return Math.floor((boardId - 1) / JOURNEY_WORLD_SIZE) + 1;
  }

  private getJourneyWorldRange(worldId: number): { start: number; end: number } | null {
    if (!Number.isFinite(worldId) || worldId <= 0) return null;
    const start = ((Math.floor(worldId) - 1) * JOURNEY_WORLD_SIZE) + 1;
    return {
      start,
      end: Math.min(start + JOURNEY_WORLD_SIZE - 1, JOURNEY_MAX_BOARDS),
    };
  }

  private rememberLastActiveJourneyWorld(boardId: number): void {
    try {
      const worldId = this.getJourneyWorldIdForBoard(boardId);
      if (!worldId) return;
      (window as any).__ccLastActiveJourneyWorldId = worldId;
      (window as any).__ccLastActiveJourneyWorldBoardId = boardId;
      localStorage.setItem(LAST_ACTIVE_WORLD_STORAGE_KEY, String(worldId));
      localStorage.setItem(LAST_ACTIVE_WORLD_BOARD_STORAGE_KEY, String(boardId));
    } catch {}
  }

  private getLastActiveJourneyWorld(): { worldId: number | null; boardId: number | null } {
    try {
      const rawBoardId =
        (window as any).__ccLastActiveJourneyWorldBoardId ??
        localStorage.getItem(LAST_ACTIVE_WORLD_BOARD_STORAGE_KEY) ??
        this.getLastActiveJourneyBoardAreaId();
      const boardId = Number(rawBoardId || 0);
      const rawWorldId =
        (window as any).__ccLastActiveJourneyWorldId ??
        localStorage.getItem(LAST_ACTIVE_WORLD_STORAGE_KEY) ??
        this.getJourneyWorldIdForBoard(boardId);
      const worldId = Number(rawWorldId || 0);

      return {
        worldId: Number.isFinite(worldId) && worldId > 0 ? worldId : null,
        boardId: Number.isFinite(boardId) && boardId > 0 ? boardId : null,
      };
    } catch {
      return { worldId: null, boardId: null };
    }
  }

  private setLastActiveJourneyBoardAreaId(boardId: number): void {
    try {
      if (!Number.isFinite(boardId) || boardId <= 0) return;
      this.rememberLastActiveJourneyWorld(boardId);
      (window as any).__ccLastActiveJourneyBoardAreaId = boardId;
      localStorage.setItem(ACTIVE_BOARD_AREA_STORAGE_KEY, String(boardId));
    } catch {}
  }

  private clearLastActiveJourneyBoardAreaId(expectedBoardId?: number): boolean {
    try {
      if (Number.isFinite(expectedBoardId)) {
        const currentBoardId = this.getLastActiveJourneyBoardAreaId();
        if (currentBoardId !== expectedBoardId) {
          logger.info('🧭 JourneyForestAnim active-board-clear-skip-stale', {
            expectedBoardId,
            currentBoardId,
          });
          return false;
        }
      }
      delete (window as any).__ccLastActiveJourneyBoardAreaId;
      localStorage.removeItem(ACTIVE_BOARD_AREA_STORAGE_KEY);
      this.activeBoardAreaEnterPreparedTargets = [];
      return true;
    } catch {
      return false;
    }
  }

  private getJourneyBoardAreaParts(boardId: number, preparedTargets: HTMLElement[] = []): {
    cardWrapper: HTMLElement | null;
    clouds: HTMLElement[];
    stump: HTMLElement | null;
    stars: HTMLElement[];
    island: HTMLElement | null;
  } {
    const livePreparedTargets = preparedTargets.filter((target) => target && document.body.contains(target));
    const card = document.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
    const resolveMotionOwner = (target: HTMLElement | null): HTMLElement | null => target;

    return {
      cardWrapper:
        (card?.closest('.journey-board-card-wrapper') as HTMLElement | null) ||
        livePreparedTargets.find((target) => target.classList.contains('journey-board-card-wrapper')) ||
        null,
      clouds: (() => {
        const queried = Array.from(
          document.querySelectorAll(`.journey-forest-cloud-board-${boardId}`)
        ) as HTMLElement[];
        const resolved = queried.length
          ? queried
          : livePreparedTargets.filter((target) => target.classList.contains('journey-forest-board-cloud'));
        return Array.from(new Set(resolved.map((target) => resolveMotionOwner(target)).filter(Boolean))) as HTMLElement[];
      })(),
      stump:
        resolveMotionOwner(
          (document.querySelector(`.journey-forest-stump-${boardId}`) as HTMLElement | null) ||
          livePreparedTargets.find((target) => target.classList.contains('journey-forest-stump-art')) ||
          null
        ),
      stars: (() => {
        const queried = Array.from(
          document.querySelectorAll(`.journey-forest-star-board-${boardId}`)
        ) as HTMLElement[];
        const resolved = queried.length
          ? queried
          : livePreparedTargets.filter((target) => target.classList.contains('journey-forest-star-art'));
        return Array.from(new Set(resolved.map((target) => resolveMotionOwner(target)).filter(Boolean))) as HTMLElement[];
      })(),
      island:
        resolveMotionOwner(
          (document.querySelector(`.journey-forest-island-${boardId}`) as HTMLElement | null) ||
          livePreparedTargets.find((target) => target.classList.contains('journey-forest-island-art')) ||
          null
        ),
    };
  }

  private getBoardAreaTransitionItems(parts: {
    cardWrapper: HTMLElement | null;
    clouds: HTMLElement[];
    stump: HTMLElement | null;
    stars: HTMLElement[];
    island: HTMLElement | null;
  }): Array<{
    role: 'card' | 'stump' | 'star' | 'island' | 'cloud';
    target: HTMLElement;
    enterOrder: number;
    exitOrder: number;
    enterDelay: number;
    exitDelay: number;
    enterDuration: number;
    exitDuration: number;
    fromScale: number;
    exitEase: string;
    enterEase: string;
  }> {
    const rawItems: Array<{ role: 'card' | 'stump' | 'star' | 'island' | 'cloud'; target: HTMLElement | null }> = [
      ...parts.clouds.map((cloud) => ({ role: 'cloud' as const, target: cloud })),
      { role: 'island', target: parts.island },
      { role: 'stump', target: parts.stump },
      ...parts.stars.map((star) => ({ role: 'star' as const, target: star })),
      { role: 'card', target: parts.cardWrapper },
    ];

    const seenTargets = new Set<HTMLElement>();
    const liveItems = rawItems
      .filter((item) => {
        if (!item.target || !document.body.contains(item.target) || seenTargets.has(item.target)) return false;
        seenTargets.add(item.target);
        return true;
      })
      .map((item, enterOrder) => ({
        ...item,
        target: item.target as HTMLElement,
        enterOrder,
      }));

    const exitOrderByRole: Record<'card' | 'stump' | 'star' | 'island' | 'cloud', number> = {
      card: 0,
      star: 1,
      stump: 2,
      cloud: 2,
      island: 3,
    };

    return liveItems.map((item) => {
      const exitOrder = exitOrderByRole[item.role] ?? item.enterOrder;
      return {
        role: item.role,
        target: item.target,
        enterOrder: item.enterOrder,
        exitOrder,
        enterDelay: item.role === 'star'
          ? BOARD_AREA_MODAL_ENTER_BASE_DELAY + (Math.max(0, liveItems.length - 2) * BOARD_AREA_MODAL_STAGGER)
          : BOARD_AREA_MODAL_ENTER_BASE_DELAY + (item.enterOrder * BOARD_AREA_MODAL_STAGGER),
        exitDelay: BOARD_AREA_MODAL_EXIT_BASE_DELAY + (exitOrder * BOARD_AREA_MODAL_EXIT_GROUP_STAGGER),
        enterDuration: item.role === 'star' ? BOARD_AREA_MODAL_EXIT_DURATION : BOARD_AREA_MODAL_ENTER_DURATION,
        exitDuration: BOARD_AREA_MODAL_EXIT_DURATION,
        fromScale: item.role === 'star' ? BOARD_AREA_MODAL_EXIT_MIN_SCALE : BOARD_AREA_MODAL_ENTER_SCALE,
        exitEase: BOARD_AREA_MODAL_EXIT_EASE,
        enterEase: item.role === 'star' ? 'back.out(1.25)' : BOARD_AREA_MODAL_ENTER_EASE,
      };
    });
  }

  public prepareActiveJourneyBoardAreaEnterAnimation(retryCount = 0): void {
    let boardId: number | null = null;
    try {
      boardId = this.getLastActiveJourneyBoardAreaId();
      if (!boardId) {
        logger.info('🧭 JourneyForestAnim active-enter-prepare-skip-no-board', { retryCount });
        return;
      }

      const targets = this.getJourneyAreaElements(boardId);
      if (!targets.length) {
        logger.warn('🧭 JourneyForestAnim active-enter-prepare-no-targets', {
          boardId,
          retryCount,
        });
        if (retryCount < 4) {
          this.trackTimeout(() => this.prepareActiveJourneyBoardAreaEnterAnimation(retryCount + 1), 80);
        } else {
          this.clearLastActiveJourneyBoardAreaId(boardId);
        }
        return;
      }

      logger.info('🧭 JourneyForestAnim active-enter-prepare', {
        boardId,
        retryCount,
        targetCount: targets.length,
        targets: targets.map((target) => ({
          className: target.className,
          areaId: target.dataset?.journeyAreaId,
        })),
      });
      emitIOSNativeDiagnostic('active-area-prepared', { boardId, targetCount: targets.length });
      this.activeBoardAreaEnterPreparedTargets = targets;
      targets.forEach((target) => {
        try { gsap.killTweensOf(target); } catch {}
        setJourneyAlienBeamIdleReady(target, false);
        rememberJourneyBoardCardBaseTransform(target);
        restoreJourneyAreaTransformOrigin(target);
        target.style.willChange = 'transform, opacity';
        target.style.pointerEvents = 'none';
        target.style.transition = 'none';
        const visualTarget = this.prepareJourneyBoardCardVisualTarget(target);
        if (visualTarget !== target) {
          this.restoreJourneyBoardCardInnerVisual(target);
          gsap.set(target, {
            scale: 1,
            opacity: 1,
            y: 0,
            visibility: 'hidden',
            clearProps: 'scale,y',
            transformOrigin: getJourneyAreaTransformOrigin(target),
            force3D: false,
            immediateRender: true,
          });
          gsap.set(visualTarget, {
            scale: BOARD_AREA_MODAL_ENTER_SCALE,
            opacity: 0,
            visibility: 'visible',
            transformOrigin: getJourneyAreaTransformOrigin(target),
            force3D: true,
            immediateRender: true,
          });
        } else {
          gsap.set(target, {
            scale: BOARD_AREA_MODAL_ENTER_SCALE,
            opacity: 0,
            y: 0,
            visibility: 'hidden',
            transformOrigin: getJourneyAreaTransformOrigin(target),
            force3D: true,
            immediateRender: true,
          });
        }
      });
    } catch (error) {
      if (boardId) {
        this.clearLastActiveJourneyBoardAreaId(boardId);
      }
      logger.warn('⚠️ Failed to prepare active Journey board area enter animation:', error);
    }
  }

  public playActiveJourneyBoardAreaEnterAnimation(retryCount = 0): void {
    let boardId: number | null = null;
    try {
      boardId = this.getLastActiveJourneyBoardAreaId();
      if (!boardId) {
        logger.info('🧭 JourneyForestAnim active-enter-play-skip-no-board', { retryCount });
        this.activeBoardAreaEnterInProgress = false;
        unlockJourneyViewportTransition('active-enter-skip-no-board');
        return;
      }

      const preparedTargets = this.activeBoardAreaEnterPreparedTargets
        .filter((target) => target && document.body.contains(target));
      const items = this.getBoardAreaTransitionItems(this.getJourneyBoardAreaParts(boardId, preparedTargets));

      const targets = Array.from(new Set([
        ...preparedTargets,
        ...items.map((item) => item.target),
      ]))
        .filter((target) => target && document.body.contains(target));
      const transitionTargets = items
        .map((item) => item.target)
        .filter((target) => target && document.body.contains(target));

      if (!targets.length || !transitionTargets.length) {
        logger.warn('🧭 JourneyForestAnim active-enter-play-no-targets', {
          boardId,
          retryCount,
          preparedTargets: preparedTargets.length,
          itemCount: items.length,
          targets: targets.length,
          transitionTargets: transitionTargets.length,
        });
        if (retryCount < 4) {
          this.trackTimeout(() => this.playActiveJourneyBoardAreaEnterAnimation(retryCount + 1), 80);
        } else {
          this.activeBoardAreaEnterInProgress = false;
          unlockJourneyViewportTransition('active-enter-no-targets');
          this.clearLastActiveJourneyBoardAreaId(boardId);
        }
        return;
      }

      this.activeBoardAreaEnterInProgress = true;
      logger.info('🧭 JourneyForestAnim active-enter-play-start', {
        boardId,
        retryCount,
        preparedTargets: preparedTargets.length,
        targetCount: targets.length,
        itemCount: items.length,
        items: items.map((item) => ({
          role: item.role,
          enterOrder: item.enterOrder,
          enterDelay: Number(item.enterDelay.toFixed(3)),
          duration: item.enterDuration,
          className: item.target.className,
        })),
      });
      emitIOSNativeDiagnostic('active-area-play-start', {
        boardId,
        preparedTargets: preparedTargets.length,
        itemCount: items.length,
      });
      const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement | null;
      // The active Unit owns this interval. Idle must not start while its
      // pop-in is still running; completion below resumes the correct idle
      // owner after every Unit part has settled.
      const cardMotionTargets = targets.filter((target) => target.classList.contains('journey-board-card-wrapper'));
      this.stopJourneyAreaIdleForTargets(cardMotionTargets);
      const restoreTargetsVisible = () => {
        logger.info('🧭 JourneyForestAnim active-enter-complete-restore', {
          boardId,
          targets: targets.length,
          cardsContainerConnected: !!cardsContainer && document.body.contains(cardsContainer),
        });
        emitIOSNativeDiagnostic('active-area-complete', { boardId, targetCount: targets.length });
        targets.forEach((target) => {
          try {
            target.style.willChange = 'auto';
            target.style.pointerEvents = '';
            target.style.transition = '';
            const restoreVars: Record<string, unknown> = {
              scale: 1,
              opacity: 1,
              visibility: 'visible',
              clearProps: 'visibility',
              overwrite: true,
            };
            if (target.classList.contains('journey-board-card-wrapper')) {
              restoreVars.y = 0;
            }
            gsap.set(target, restoreVars);
            if (target.classList.contains('journey-robo-alien-beam-art') || target.querySelector('.journey-robo-alien-beam-art')) {
              target.style.removeProperty('opacity');
              setJourneyAlienBeamIdleReady(target, true);
            }
            restoreJourneyBoardCardBaseTransform(target);
            this.restoreJourneyBoardCardVisualTarget(target);
            this.restoreJourneyBoardCardInnerVisual(target);
          } catch {}
        });
        this.clearJourneyAreaIdleStartTimeout();
        const clearedActiveBoard = this.clearLastActiveJourneyBoardAreaId(boardId);
        if (clearedActiveBoard) {
          this.activeBoardAreaEnterInProgress = false;
          if (cardsContainer && document.body.contains(cardsContainer)) {
            if (this.journeyAreaIdleEntries.length) {
              logger.info('🧭 JourneyForestAnim active-enter-resume-board-idle-only', { boardId });
              this.startJourneyBoardAreaIdleAnimation(boardId, cardsContainer);
            } else {
              logger.info('🧭 JourneyForestAnim active-enter-start-idle-now', { boardId });
              this.startJourneyAreaIdleAnimations(this.getCurrentJourneyForestAreas(cardsContainer), cardsContainer);
            }
          } else {
            logger.warn('🧭 JourneyForestAnim active-enter-idle-skip-missing-container', { boardId });
          }
          unlockJourneyViewportTransition('active-enter-complete');
        } else {
          logger.info('🧭 JourneyForestAnim active-enter-complete-stale-skip-unlock', {
            boardId,
            currentBoardId: this.getLastActiveJourneyBoardAreaId(),
          });
          this.activeBoardAreaEnterInProgress = false;
          unlockJourneyViewportTransition('active-enter-complete-stale');
        }
      };

      let pendingTweens = items.length;
      let restored = false;
      const finishOne = () => {
        pendingTweens -= 1;
        logger.info('🧭 JourneyForestAnim active-enter-item-finished', {
          boardId,
          remaining: pendingTweens,
        });
        if (pendingTweens <= 0 && !restored) {
          restored = true;
          restoreTargetsVisible();
        }
      };

      items.forEach((item) => {
        const target = item.target;
        if (!target || !document.body.contains(target)) {
          finishOne();
          return;
        }

        try { gsap.killTweensOf(target); } catch {}
        rememberJourneyBoardCardBaseTransform(target);
        const visualTarget = this.prepareJourneyBoardCardVisualTarget(target);
        const animTarget = visualTarget;
        target.style.opacity = visualTarget === target ? '0' : '1';
        target.style.visibility = 'hidden';
        restoreJourneyAreaTransformOrigin(target);
        target.style.transition = 'none';
        target.style.willChange = 'transform, opacity';
        target.style.pointerEvents = 'none';

        if (visualTarget !== target) {
          this.restoreJourneyBoardCardInnerVisual(target);
          gsap.set(target, {
            scale: 1,
            opacity: 1,
            visibility: 'hidden',
            clearProps: 'scale,y',
            force3D: false,
            transformOrigin: getJourneyAreaTransformOrigin(target),
            immediateRender: true,
          });
          gsap.set(visualTarget, {
            scale: item.fromScale,
            opacity: 0,
            visibility: 'visible',
            force3D: true,
            transformOrigin: getJourneyAreaTransformOrigin(target),
            immediateRender: true,
          });
        } else {
          gsap.set(target, {
            scale: item.fromScale,
            opacity: 0,
            visibility: 'hidden',
            force3D: true,
            transformOrigin: getJourneyAreaTransformOrigin(target),
            immediateRender: true,
          });
        }

        const enterTweenVars = {
          scale: 1,
          opacity: 1,
          duration: item.enterDuration,
          ease: item.enterEase,
          delay: item.enterDelay,
          force3D: true,
          overwrite: true,
          onStart: () => {
            if (target.classList.contains('journey-board-card-wrapper')) {
              restoreJourneyBoardCardBaseTransform(target);
              this.restoreJourneyBoardCardInnerVisual(target);
            }
            target.style.visibility = 'visible';
            if (item.role !== 'star') {
              target.style.opacity = visualTarget === target ? '0' : '1';
            }
          },
          onComplete: () => {
            if (target.classList.contains('journey-board-card-wrapper')) {
              restoreJourneyBoardCardBaseTransform(target);
              this.restoreJourneyBoardCardInnerVisual(target);
            }
            target.style.visibility = 'visible';
            target.style.opacity = '1';
            if (visualTarget !== target) {
              this.restoreJourneyBoardCardVisualTarget(target);
            }
            if (target.classList.contains('journey-robo-alien-beam-art')) {
              target.style.removeProperty('opacity');
            }
            target.style.willChange = 'auto';
            restoreJourneyBoardCardBaseTransform(target);
            logger.info('🧭 JourneyForestAnim active-enter-item-complete', {
              boardId,
              role: item.role,
              enterOrder: item.enterOrder,
              className: target.className,
            });
            finishOne();
          },
          onInterrupt: () => {
            logger.warn('🧭 JourneyForestAnim active-enter-item-interrupt', {
              boardId,
              role: item.role,
              enterOrder: item.enterOrder,
              className: target.className,
            });
            finishOne();
          },
        };

        if (item.role === 'star') {
          trackFromToTween(animTarget, {
            scale: item.fromScale,
            opacity: 0,
            visibility: 'visible',
            transformOrigin: getJourneyAreaTransformOrigin(target),
            immediateRender: true,
          }, enterTweenVars);
        } else {
          trackTween(animTarget, {
            ...enterTweenVars,
            visibility: 'visible',
          });
        }
      });

    } catch (error) {
      this.activeBoardAreaEnterInProgress = false;
      unlockJourneyViewportTransition('active-enter-error');
      if (boardId) {
        this.clearLastActiveJourneyBoardAreaId(boardId);
      }
      logger.warn('⚠️ Failed to play active Journey board area enter animation:', error);
    }
  }

  private renderForestMapAssets(
    bgContainer: HTMLElement,
    decorContainer: HTMLElement
  ): { mainTargets: HTMLElement[]; cloudTargets: HTMLElement[]; boardTargets: Map<number, HTMLElement[]> } {
    const mainTargets: HTMLElement[] = [];
    const cloudTargets: HTMLElement[] = [];
    const boardTargets = new Map<number, HTMLElement[]>();
    const cloudAssetPool = [
      `${BOARD_TRANSITION_ASSET_BASE}/oblak-forest1.png`,
      `${BOARD_TRANSITION_ASSET_BASE}/oblak-forest2.png`,
      `${BOARD_TRANSITION_ASSET_BASE}/oblak+srednji.png`,
      `${BOARD_TRANSITION_ASSET_BASE}/oblak mali ljevo.png`,
      `${BOARD_TRANSITION_ASSET_BASE}/oblak mali desno.png`,
      `${BOARD_TRANSITION_ASSET_BASE}/oblak veliki ljevo dole.png`,
    ];
    const seededUnit = (seed: number): number => {
      const value = Math.sin(seed * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    };
    const boardLayoutOffsets = {
      stump: { x: 58, y: 52, width: 77, rotation: -4 },
      stars: [
        {
          x: 76,
          y: 82,
          width: 23,
          filledSrc: JOURNEY_LEVEL_STAR_ASSETS.left.filled,
          emptySrc: JOURNEY_LEVEL_STAR_ASSETS.left.empty,
          role: 'left'
        },
        {
          x: 93,
          y: 82,
          width: 29,
          filledSrc: JOURNEY_LEVEL_STAR_ASSETS.center.filled,
          emptySrc: JOURNEY_LEVEL_STAR_ASSETS.center.empty,
          role: 'center'
        },
        {
          x: 116,
          y: 82,
          width: 23,
          filledSrc: JOURNEY_LEVEL_STAR_ASSETS.right.filled,
          emptySrc: JOURNEY_LEVEL_STAR_ASSETS.right.empty,
          role: 'right'
        },
      ],
    };

    const addImage = (
      src: string,
      x: number,
      y: number,
      width: number,
      className: string,
      zIndex: number,
      rotation = 0,
      areaId?: string,
      parent: HTMLElement = bgContainer
    ) => {
      const img = document.createElement('img');
      img.className = className;
      if (areaId) {
        img.classList.add('journey-area-idle-target');
        img.dataset.journeyAreaId = areaId;
      }
      img.src = src;
      img.alt = '';
      img.draggable = false;
      img.setAttribute('aria-hidden', 'true');
      img.style.position = 'absolute';
      img.style.left = `${(x / FOREST_MAP_DESIGN_WIDTH) * 100}%`;
      img.style.top = `${(y / FOREST_MAP_DESIGN_HEIGHT) * 100}%`;
      img.style.width = `${(width / FOREST_MAP_DESIGN_WIDTH) * 100}%`;
      img.style.height = 'auto';
      img.style.zIndex = `${zIndex}`;
      img.style.pointerEvents = 'none';
      img.style.userSelect = 'none';
      img.style.webkitUserDrag = 'none';
      img.style.transform = rotation ? `rotate(${rotation}deg)` : 'none';
      img.style.transformOrigin = '50% 50%';
      parent.appendChild(img);
      return img;
    };
    const applyBeach2xSrcSet = (img: HTMLImageElement, src: string) => {
      const src2x = src.replace(/\.png$/, '@2x.png');
      img.srcset = `${encodeURI(src2x)} 2x`;
    };

    const addForestMainClouds = () => {
      const cloudSlots = [
        { x: -44, y: -38, width: 286, src: `${BOARD_TRANSITION_ASSET_BASE}/oblak+srednji.png`, jitter: false },
        { x: 248, y: -32, width: 184 },
        { x: 332, y: 30, width: 136 },
        { x: -74, y: 266, width: 120 },
        { x: 18, y: 326, width: 84 },
        { x: 112, y: 284, width: 154 },
        { x: 220, y: 266, width: 92 },
        { x: 284, y: 200, width: 132 },
        { x: 344, y: 290, width: 76 },
        { x: -18, y: 238, width: 176, jitter: false },
        { x: 52, y: 278, width: 198, jitter: false },
        { x: 132, y: 252, width: 214, jitter: false },
        { x: 218, y: 206, width: 198, jitter: false },
        { x: 286, y: 166, width: 176, jitter: false },
      ];

      cloudSlots.forEach((slot, index) => {
        const assetIndex = Math.floor(seededUnit(index + 3) * cloudAssetPool.length) % cloudAssetPool.length;
        const sizeJitter = slot.jitter === false ? 1 : 0.82 + (seededUnit(index + 19) * 0.36);
        const cloud = addImage(
          slot.src || cloudAssetPool[assetIndex],
          slot.x,
          slot.y,
          slot.width * sizeJitter,
          `journey-forest-cloud-art journey-forest-main-cloud journey-forest-main-cloud-${index + 1}`,
          1,
          0,
          'forest-main',
          bgContainer
        );
        cloud.style.opacity = `${0.74 + (seededUnit(index + 31) * 0.16)}`;
        cloud.style.willChange = 'transform';
        cloudTargets.push(cloud);
      });
    };

    const addBeachMainClouds = () => {
      const beachCloudSlots = [
        { x: -38, y: 1450, width: 214, src: `${BOARD_TRANSITION_ASSET_BASE}/oblak+srednji.png`, jitter: false },
        { x: 168, y: 1430, width: 184 },
        { x: 276, y: 1498, width: 146 },
        { x: -42, y: 1610, width: 176 },
        { x: 54, y: 1668, width: 206, jitter: false },
        { x: 188, y: 1608, width: 170 },
        { x: 282, y: 1702, width: 118 },
      ];

      beachCloudSlots.forEach((slot, index) => {
        const assetIndex = Math.floor(seededUnit(index + 101) * cloudAssetPool.length) % cloudAssetPool.length;
        const sizeJitter = slot.jitter === false ? 1 : 0.86 + (seededUnit(index + 113) * 0.28);
        const cloud = addImage(
          slot.src || cloudAssetPool[assetIndex],
          slot.x,
          slot.y,
          slot.width * sizeJitter,
          `journey-forest-cloud-art journey-beach-main-cloud journey-beach-main-cloud-${index + 1}`,
          1,
          0,
          'beach-main',
          bgContainer
        );
        cloud.style.opacity = `${0.72 + (seededUnit(index + 127) * 0.14)}`;
        cloud.style.willChange = 'transform';
        cloudTargets.push(cloud);
      });
    };

    const addRoboMainClouds = () => {
      const roboCloudSlots = [
        { x: -34, y: 3162, width: 214, src: `${BOARD_TRANSITION_ASSET_BASE}/oblak+srednji.png`, jitter: false },
        { x: 170, y: 3142, width: 180 },
        { x: 278, y: 3210, width: 144 },
        { x: -38, y: 3320, width: 170 },
        { x: 58, y: 3382, width: 202, jitter: false },
        { x: 190, y: 3320, width: 166 },
        { x: 284, y: 3412, width: 116 },
        { x: 206, y: 3448, width: 214, src: `${BOARD_TRANSITION_ASSET_BASE}/oblak+srednji.png`, jitter: false },
      ];

      roboCloudSlots.forEach((slot, index) => {
        const assetIndex = Math.floor(seededUnit(index + 201) * cloudAssetPool.length) % cloudAssetPool.length;
        const sizeJitter = slot.jitter === false ? 1 : 0.86 + (seededUnit(index + 213) * 0.28);
        const cloud = addImage(
          slot.src || cloudAssetPool[assetIndex],
          slot.x,
          slot.y,
          slot.width * sizeJitter,
          `journey-forest-cloud-art journey-robo-main-cloud journey-robo-main-cloud-${index + 1}`,
          1,
          0,
          'robo-main',
          bgContainer
        );
        cloud.style.opacity = `${0.72 + (seededUnit(index + 227) * 0.14)}`;
        cloud.style.willChange = 'transform';
        cloudTargets.push(cloud);
      });
    };

    const addForestBoardGroup = (
      boardId: number,
      islandX: number,
      islandY: number,
      islandWidth = 200,
      starsOffsetX = 0,
      starsOffsetY = 0,
      islandVisualOffsetX = 0,
      islandVisualOffsetY = 0,
      boardCloudRefs: number[] = []
    ) => {
      const areaId = `board-${boardId}`;
      const targets: HTMLElement[] = [];
      boardTargets.set(boardId, targets);

      type BoardCloudSlot = { ref: number; x: number; y: number; width: number };
      const defaultBoardCloudSlots: BoardCloudSlot[] = [
        { ref: 5, x: -44, y: -24, width: 126 },
        { ref: 4, x: -28, y: 104, width: 92 },
        { ref: 7, x: 88, y: 96, width: 112 },
        { ref: 2, x: 126, y: 8, width: 98 },
      ];
      const boardCloudSlotsByBoard: Record<number, BoardCloudSlot[]> = {
        1: [
          { ref: 4, x: -34, y: 54, width: 92 },
          { ref: 3, x: 56, y: 116, width: 132 },
          { ref: 6, x: 118, y: 82, width: 146 },
        ],
        2: [
          { ref: 4, x: -46, y: 40, width: 88 },
          { ref: 5, x: 94, y: 54, width: 90 },
          { ref: 6, x: -10, y: 126, width: 156 },
        ],
        3: [
          { ref: 7, x: -38, y: 112, width: 136 },
          { ref: 6, x: 54, y: 126, width: 166 },
        ],
        4: [
          { ref: 5, x: 6, y: 26, width: 126 },
          { ref: 6, x: 72, y: 104, width: 168 },
          { ref: 7, x: -2, y: 6, width: 168 },
          { ref: 2, x: 86, y: 8, width: 98 },
        ],
        5: [
          { ref: 6, x: -144, y: -42, width: 166 },
          { ref: 6, x: -48, y: 86, width: 150 },
          { ref: 3, x: 14, y: 22, width: 190 },
        ],
        6: [
          { ref: 3, x: -46, y: 62, width: 142 },
          { ref: 6, x: 74, y: 110, width: 178 },
        ],
        7: [
          { ref: 4, x: -46, y: 8, width: 163 },
          { ref: 3, x: 42, y: 46, width: 108 },
          { ref: 5, x: -12, y: 104, width: 104 },
          { ref: 3, x: 58, y: 88, width: 132 },
        ],
        8: [
          { ref: 4, x: 78, y: 112, width: 82 },
          { ref: 6, x: -58, y: 106, width: 176 },
          { ref: 3, x: 24, y: 128, width: 190 },
          { ref: 6, x: 104, y: 108, width: 176 },
        ],
        9: [
          { ref: 6, x: -50, y: 2, width: 138 },
          { ref: 5, x: 2, y: 22, width: 76 },
          { ref: 3, x: 94, y: 58, width: 110 },
          { ref: 4, x: 66, y: 44, width: 82 },
          { ref: 6, x: -62, y: 106, width: 185 },
          { ref: 3, x: 68, y: 98, width: 142 },
        ],
        10: [
          { ref: 4, x: -28, y: 20, width: 82 },
          { ref: 3, x: 74, y: -20, width: 112 },
          { ref: 5, x: 122, y: 108, width: 76 },
          { ref: 6, x: -94, y: 16, width: 284 },
        ],
      };
      const boardCloudSlots = boardCloudSlotsByBoard[boardId] || defaultBoardCloudSlots;
      boardCloudSlots
        .filter((slot) => boardCloudRefs.includes(slot.ref))
        .forEach((slot) => {
          const assetIndex = ((slot.ref - 1) % cloudAssetPool.length + cloudAssetPool.length) % cloudAssetPool.length;
          const cloud = addImage(
            cloudAssetPool[assetIndex],
            islandX + slot.x,
            islandY + slot.y,
            slot.width,
            `journey-forest-cloud-art journey-forest-board-cloud journey-forest-cloud-board-${boardId} journey-forest-cloud-ref-${slot.ref}`,
            1,
            0,
            areaId,
            bgContainer
          );
          cloud.style.opacity = '0.82';
          cloud.style.willChange = 'transform';
          targets.push(cloud);
        });

      targets.push(addImage(
        `${FOREST_WORLD_ASSET_BASE}/forest${boardId}.png`,
        islandX + islandVisualOffsetX,
        islandY + islandVisualOffsetY,
        islandWidth,
        `journey-forest-island-art journey-forest-island-${boardId}`,
        2,
        0,
        areaId
      ));
      targets.push(addImage(
        `${FOREST_WORLD_ASSET_BASE}/panj1.png`,
        islandX + boardLayoutOffsets.stump.x,
        islandY + boardLayoutOffsets.stump.y,
        boardLayoutOffsets.stump.width,
        `journey-forest-stump-art journey-forest-stump-${boardId}`,
        4,
        boardLayoutOffsets.stump.rotation,
        areaId,
        decorContainer
      ));
      const board = this.boards.find((item) => item.id === boardId);
      const earnedStars = board?.unlocked === true && board?.interim !== true
        ? getJourneyEarnedLevelStars(boardStatsService.getBoardStats(boardId).highScore, boardId)
        : 0;
      const shouldRenderLevelStars = board?.unlocked === true || board?.interim === true;

      if (shouldRenderLevelStars) {
        boardLayoutOffsets.stars.forEach((star, index) => {
          const shouldShowFilledStar = index < earnedStars;
          const starStateClass = shouldShowFilledStar ? 'journey-forest-star-filled' : 'journey-forest-star-empty';
          targets.push(addImage(
            shouldShowFilledStar ? star.filledSrc : star.emptySrc,
            islandX + star.x + starsOffsetX,
            islandY + star.y + starsOffsetY,
            star.width,
            `journey-forest-star-art ${starStateClass} journey-forest-star-${star.role} journey-forest-star-board-${boardId}`,
            6,
            0,
            areaId,
            decorContainer
          ));
        });
      }
    };

    const addBeachBoardGroup = (
      boardId: number,
      beachIndex: number,
      islandX: number,
      islandY: number,
      islandWidth = 200,
      starsOffsetX = 0,
      starsOffsetY = 0
    ) => {
      const areaId = `board-${boardId}`;
      const targets: HTMLElement[] = [];
      boardTargets.set(boardId, targets);

      const sandBeachIndexes = new Set([2, 5, 8]);
      const isSandBeach = sandBeachIndexes.has(beachIndex);
      const islandSrc = `${BEACH_WORLD_ASSET_BASE}/${isSandBeach ? 'beach-beach' : 'beach-water'}${beachIndex}.png`;
      const basePropLayout = isSandBeach
        ? { src: `${BEACH_WORLD_ASSET_BASE}/kanta.png`, x: 72, y: 53, width: 56, rotation: 5 }
        : { src: `${BEACH_WORLD_ASSET_BASE}/kolut.png`, x: 61, y: 52, width: 74, rotation: -4 };
      const beachPropOffsets: Record<number, { x: number; y: number }> = {
        11: { x: -4, y: -12 },
        12: { x: 0, y: 1 },
        13: { x: 2, y: -2 },
        14: { x: -2, y: 0 },
        15: { x: -2, y: 0 },
        16: { x: -2, y: -3 },
        17: { x: 2, y: -2 },
        18: { x: -1, y: 0 },
        19: { x: 0, y: -2 },
        20: { x: -4, y: 0 },
      };
      const propOffset = beachPropOffsets[boardId] || { x: 0, y: 0 };
      const propLayout = {
        ...basePropLayout,
        x: basePropLayout.x + propOffset.x,
        y: basePropLayout.y + propOffset.y,
      };

      const beachCloudSlots = [
        { ref: 6, x: -62, y: 86, width: 158 },
        { ref: 3, x: 54, y: -12, width: 124 },
        { ref: 5, x: 126, y: 74, width: 104 },
      ];

      beachCloudSlots.forEach((slot) => {
        const assetIndex = ((slot.ref - 1) % cloudAssetPool.length + cloudAssetPool.length) % cloudAssetPool.length;
        const cloud = addImage(
          cloudAssetPool[assetIndex],
          islandX + slot.x,
          islandY + slot.y,
          slot.width,
          `journey-forest-cloud-art journey-forest-board-cloud journey-forest-cloud-board-${boardId} journey-forest-cloud-ref-${slot.ref}`,
          1,
          0,
          areaId,
          bgContainer
        );
        cloud.style.opacity = '0.8';
        cloud.style.willChange = 'transform';
        targets.push(cloud);
      });

      const beachIsland = addImage(
        islandSrc,
        islandX,
        islandY,
        islandWidth,
        `journey-forest-island-art journey-beach-island-art journey-forest-island-${boardId}`,
        2,
        0,
        areaId
      );
      applyBeach2xSrcSet(beachIsland, islandSrc);
      targets.push(beachIsland);

      const beachProp = addImage(
        propLayout.src,
        islandX + propLayout.x,
        islandY + propLayout.y,
        propLayout.width,
        `journey-forest-stump-art journey-beach-prop-art journey-forest-stump-${boardId}`,
        4,
        propLayout.rotation,
        areaId,
        decorContainer
      );
      applyBeach2xSrcSet(beachProp, propLayout.src);
      targets.push(beachProp);

      const board = this.boards.find((item) => item.id === boardId);
      const earnedStars = board?.unlocked === true && board?.interim !== true
        ? getJourneyEarnedLevelStars(boardStatsService.getBoardStats(boardId).highScore, boardId)
        : 0;
      const shouldRenderLevelStars = board?.unlocked === true || board?.interim === true;

      if (shouldRenderLevelStars) {
        boardLayoutOffsets.stars.forEach((star, index) => {
          const shouldShowFilledStar = index < earnedStars;
          const starStateClass = shouldShowFilledStar ? 'journey-forest-star-filled' : 'journey-forest-star-empty';
          targets.push(addImage(
            shouldShowFilledStar ? star.filledSrc : star.emptySrc,
            islandX + star.x + starsOffsetX,
            islandY + star.y + starsOffsetY,
            star.width,
            `journey-forest-star-art ${starStateClass} journey-forest-star-${star.role} journey-forest-star-board-${boardId}`,
            6,
            0,
            areaId,
            decorContainer
          ));
        });
      }
    };

    const addRoboBoardGroup = (
      boardId: number,
      roboIndex: number,
      islandX: number,
      islandY: number,
      islandWidth = 200,
      starsOffsetX = 0,
      starsOffsetY = 0
    ) => {
      const areaId = `board-${boardId}`;
      const targets: HTMLElement[] = [];
      boardTargets.set(boardId, targets);

      const roboStarOffsets: Record<number, { x: number; y: number; rotation?: number }> = {
        21: { x: -18, y: 16 },
        22: { x: 19, y: 4 },
        23: { x: 22, y: 0 },
        24: { x: 52, y: -16, rotation: -4 },
        25: { x: 24, y: 30 },
        26: { x: 14, y: 3 },
        27: { x: 26, y: 15 },
        28: { x: -14, y: 17, rotation: 8 },
        29: { x: -13, y: 11 },
        30: { x: 8, y: -2 },
      };
      const starOffset = roboStarOffsets[boardId] || { x: 0, y: 0 };
      const finalStarsOffsetX = starsOffsetX + starOffset.x;
      const finalStarsOffsetY = starsOffsetY + starOffset.y;
      const finalStarsRotation = starOffset.rotation || 0;

      const islandSrc = `${ROBO_WORLD_ASSET_BASE}/robo${roboIndex}.png`;
      const craterLayouts = [
        { src: `${ROBO_WORLD_ASSET_BASE}/crater1.png`, x: 64, y: 62, width: 77, rotation: -3 },
        { src: `${ROBO_WORLD_ASSET_BASE}/crater2.png`, x: 60, y: 60, width: 82, rotation: 4 },
        { src: `${ROBO_WORLD_ASSET_BASE}/crater3.png`, x: 66, y: 58, width: 78, rotation: -1 },
      ];
      const craterSourceOverrides: Record<number, string> = {
        25: craterLayouts[(6 - 1) % craterLayouts.length].src,
        26: craterLayouts[(5 - 1) % craterLayouts.length].src,
      };
      const craterScaleOverrides: Record<number, number> = {
        23: 0.9,
        24: 0.85,
        25: 0.8,
      };
      const craterOffsets: Record<number, { x: number; y: number }> = {
        21: { x: -26, y: 2 },
        22: { x: 20, y: 0 },
        23: { x: 20, y: 8 },
        24: { x: 48, y: -12 },
        25: { x: 29, y: 32 },
        26: { x: 3, y: 0 },
        27: { x: 20, y: 16 },
        28: { x: -13, y: 11 },
        29: { x: -21, y: 7 },
        30: { x: -1, y: -4 },
      };
      const craterBase = craterLayouts[(roboIndex - 1) % craterLayouts.length];
      const craterOffset = craterOffsets[boardId] || { x: 0, y: 0 };
      const craterLayout = {
        ...craterBase,
        src: craterSourceOverrides[boardId] || craterBase.src,
        x: craterBase.x + craterOffset.x,
        y: craterBase.y + craterOffset.y,
        width: craterBase.width * (craterScaleOverrides[boardId] || 1),
      };

      const roboCloudSlotBases = [
        { ref: 6, x: -62, y: 84, width: 150 },
        { ref: 3, x: 56, y: -14, width: 118 },
        { ref: 5, x: 126, y: 72, width: 100 },
      ];
      const roboCloudSlots = roboCloudSlotBases.map((slot, index) => {
        const seed = (boardId * 43) + (index * 17);
        const refOffset = Math.floor(seededUnit(seed + 1) * cloudAssetPool.length);
        return {
          ref: 1 + (((slot.ref + refOffset - 1) % cloudAssetPool.length + cloudAssetPool.length) % cloudAssetPool.length),
          x: slot.x + Math.round((seededUnit(seed + 2) - 0.5) * 42),
          y: slot.y + Math.round((seededUnit(seed + 3) - 0.5) * 32),
          width: Math.round(slot.width * (0.86 + (seededUnit(seed + 4) * 0.34))),
          rotation: Math.round((seededUnit(seed + 5) - 0.5) * 8),
          opacity: 0.68 + (seededUnit(seed + 6) * 0.18),
        };
      });
      if (seededUnit(boardId + 307) > 0.42) {
        const seed = boardId * 59;
        roboCloudSlots.push({
          ref: 1 + Math.floor(seededUnit(seed + 1) * cloudAssetPool.length),
          x: Math.round(-24 + (seededUnit(seed + 2) * 228)),
          y: Math.round(22 + (seededUnit(seed + 3) * 116)),
          width: Math.round(72 + (seededUnit(seed + 4) * 64)),
          rotation: Math.round((seededUnit(seed + 5) - 0.5) * 10),
          opacity: 0.62 + (seededUnit(seed + 6) * 0.16),
        });
      }
      if (boardId === 23) {
        roboCloudSlots.push({
          ref: 6,
          x: -4,
          y: 126,
          width: 208,
          rotation: -2,
          opacity: 0.76,
        });
      }
      if (boardId === 29) {
        roboCloudSlots.push(
          {
            ref: 6,
            x: -64,
            y: 132,
            width: 184,
            rotation: -3,
            opacity: 0.78,
          },
          {
            ref: 4,
            x: 82,
            y: 136,
            width: 188,
            rotation: 2,
            opacity: 0.76,
          },
        );
      }

      roboCloudSlots.forEach((slot) => {
        const assetIndex = ((slot.ref - 1) % cloudAssetPool.length + cloudAssetPool.length) % cloudAssetPool.length;
        const cloud = addImage(
          cloudAssetPool[assetIndex],
          islandX + slot.x,
          islandY + slot.y,
          slot.width,
          `journey-forest-cloud-art journey-forest-board-cloud journey-forest-cloud-board-${boardId} journey-forest-cloud-ref-${slot.ref}`,
          1,
          slot.rotation,
          areaId,
          bgContainer
        );
        cloud.style.opacity = `${slot.opacity}`;
        cloud.style.willChange = 'transform';
        targets.push(cloud);
      });

      const roboIsland = addImage(
        islandSrc,
        islandX,
        islandY,
        islandWidth,
        `journey-forest-island-art journey-robo-island-art journey-forest-island-${boardId}`,
        2,
        0,
        areaId
      );
      applyBeach2xSrcSet(roboIsland, islandSrc);
      targets.push(roboIsland);

      const crater = addImage(
        craterLayout.src,
        islandX + craterLayout.x,
        islandY + craterLayout.y,
        craterLayout.width,
        `journey-forest-stump-art journey-robo-crater-art journey-forest-stump-${boardId}`,
        4,
        craterLayout.rotation,
        areaId,
        decorContainer
      );
      applyBeach2xSrcSet(crater, craterLayout.src);
      targets.push(crater);

      const board = this.boards.find((item) => item.id === boardId);
      const earnedStars = board?.unlocked === true && board?.interim !== true
        ? getJourneyEarnedLevelStars(boardStatsService.getBoardStats(boardId).highScore, boardId)
        : 0;
      const shouldRenderLevelStars = board?.unlocked === true || board?.interim === true;

      if (shouldRenderLevelStars) {
        const beamSrc = `${ROBO_WORLD_ASSET_BASE}/alien beam.png`;
        // The outer beam is a normal Area 55 Unit target, exactly like a
        // Forest/Beach star or prop. Its child owns only the idle opacity pulse
        // so CSS never competes with the shared GSAP enter/exit lifecycle.
        const beamUnit = document.createElement('div');
        beamUnit.className = `journey-forest-star-art journey-forest-star-board-${boardId} journey-robo-alien-beam-art journey-robo-alien-beam-board-${boardId}`;
        beamUnit.style.position = 'absolute';
        beamUnit.style.left = `${((islandX + craterLayout.x + 13) / FOREST_MAP_DESIGN_WIDTH) * 100}%`;
        beamUnit.style.top = `${((islandY + craterLayout.y - 60) / FOREST_MAP_DESIGN_HEIGHT) * 100}%`;
        beamUnit.style.width = `${(54 / FOREST_MAP_DESIGN_WIDTH) * 100}%`;
        beamUnit.style.height = 'auto';
        beamUnit.style.zIndex = '5';
        beamUnit.style.pointerEvents = 'none';
        beamUnit.style.userSelect = 'none';
        beamUnit.style.transformOrigin = '50% 50%';
        beamUnit.dataset.journeyAreaId = areaId;

        const beamVisual = document.createElement('img');
        beamVisual.className = 'journey-robo-alien-beam-visual';
        beamVisual.src = beamSrc;
        beamVisual.alt = '';
        beamVisual.draggable = false;
        beamVisual.setAttribute('aria-hidden', 'true');
        beamVisual.style.display = 'block';
        beamVisual.style.width = '100%';
        beamVisual.style.height = 'auto';
        beamVisual.style.pointerEvents = 'none';
        beamVisual.style.userSelect = 'none';
        beamVisual.style.webkitUserDrag = 'none';
        applyBeach2xSrcSet(beamVisual, beamSrc);
        beamUnit.appendChild(beamVisual);
        decorContainer.appendChild(beamUnit);
        targets.push(beamUnit);

        boardLayoutOffsets.stars.forEach((star, index) => {
          const shouldShowFilledStar = index < earnedStars;
          const starStateClass = shouldShowFilledStar ? 'journey-forest-star-filled' : 'journey-forest-star-empty';
          targets.push(addImage(
            shouldShowFilledStar ? star.filledSrc : star.emptySrc,
            islandX + star.x + finalStarsOffsetX,
            islandY + star.y + finalStarsOffsetY,
            star.width,
            `journey-forest-star-art ${starStateClass} journey-forest-star-${star.role} journey-forest-star-board-${boardId}`,
            6,
            finalStarsRotation,
            areaId,
            decorContainer
          ));
        });
      }
    };

    addForestMainClouds();
    mainTargets.push(addImage(`${FOREST_WORLD_ASSET_BASE}/Forest main.png`, 0, -32, 390, 'journey-forest-main-art', 3, 0, 'forest-main'));
    addForestBoardGroup(1, 4, 284, 200, -10, -4, 0, 0, [4, 3, 6]);
    addForestBoardGroup(2, 190, 374, 200, -12, -6, 0, 0, [4, 5, 6]);
    addForestBoardGroup(3, 18, 484, 200, -10, -4, 0, 0, [7, 6]);
    addForestBoardGroup(4, 204, 572, 200, -12, -6, 0, 0, [5, 7, 2, 4, 6]);
    addForestBoardGroup(5, 52, 702, 262, -10, -4, -62, -76, [6, 3]);
    addForestBoardGroup(6, 194, 806, 200, -12, -6, 0, 0, [3, 6]);
    addForestBoardGroup(7, 18, 910, 200, -10, -4, 0, 0, [4, 3, 5]);
    addForestBoardGroup(8, 178, 1034, 200, -12, -6, 0, 0, [3, 5, 4, 6]);
    addForestBoardGroup(9, -2, 1138, 200, -10, -4, 0, 0, [6, 5, 3, 4]);
    addForestBoardGroup(10, 194, 1262, 200, -12, -6, 0, 0, [4, 3, 5, 6]);
    addBeachMainClouds();
    const beachMainSrc = `${BEACH_WORLD_ASSET_BASE}/beach-main.png`;
    const beachMain = addImage(beachMainSrc, 0, 1454, 390, 'journey-forest-main-art journey-beach-main-art', 3, 0, 'beach-main');
    applyBeach2xSrcSet(beachMain, beachMainSrc);
    mainTargets.push(beachMain);
    addBeachBoardGroup(11, 1, 18, 1820, 200, -14, -3);
    addBeachBoardGroup(12, 2, 194, 1944, 200, -8, 8);
    addBeachBoardGroup(13, 3, 18, 2068, 200, -10, 8);
    addBeachBoardGroup(14, 4, 194, 2192, 200, -12, 10);
    addBeachBoardGroup(15, 5, 18, 2316, 200, -10, 4);
    addBeachBoardGroup(16, 6, 194, 2440, 200, -12, 6);
    addBeachBoardGroup(17, 7, 18, 2564, 200, -10, 8);
    addBeachBoardGroup(18, 8, 194, 2688, 200, -8, 4);
    addBeachBoardGroup(19, 9, 18, 2812, 200, -10, 8);
    addBeachBoardGroup(20, 10, 194, 2936, 200, -12, 10);
    addRoboMainClouds();
    const roboMainSrc = `${ROBO_WORLD_ASSET_BASE}/robo-main.png`;
    const roboMain = addImage(roboMainSrc, 0, 3166, 390, 'journey-forest-main-art journey-robo-main-art', 3, 0, 'robo-main');
    applyBeach2xSrcSet(roboMain, roboMainSrc);
    mainTargets.push(roboMain);
    addRoboBoardGroup(21, 1, 18, 3532, 200, -14, -3);
    addRoboBoardGroup(22, 2, 184, 3646, 200, -8, 8);
    addRoboBoardGroup(23, 3, 18, 3770, 200, -10, 8);
    addRoboBoardGroup(24, 4, 166, 3904, 200, -12, 10);
    addRoboBoardGroup(25, 5, 18, 4028, 200, -10, 4);
    addRoboBoardGroup(26, 6, 186, 4152, 200, -12, 6);
    addRoboBoardGroup(27, 7, 18, 4276, 200, -10, 8);
    addRoboBoardGroup(28, 8, 176, 4400, 200, -8, 4);
    addRoboBoardGroup(29, 9, 18, 4524, 200, -10, 8);
    addRoboBoardGroup(30, 10, 194, 4648, 200, -12, 10);

    return { mainTargets, cloudTargets, boardTargets };
  }

  private cleanupDetailModalRuntimeState(): void {
    this.journeyCardOverlayModal?.dispose();
    this.journeyCardOverlayModal = null;
    journeySpatialMotion.deactivateJourneyDetailModal();
    try {
      const floatingPlay = document.getElementById('board-detail-play-button') as HTMLElement | null;
      if (floatingPlay) {
        try { getRegisteredCta(floatingPlay as HTMLButtonElement)?.dispose(); } catch {}
        try { gsap.killTweensOf(floatingPlay); } catch {}
        floatingPlay.remove();
      }
    } catch {}

    try {
      const modal = document.getElementById('collectibles-detail-modal') as HTMLElement | null;
      if (!modal) return;

      modal.querySelectorAll<HTMLButtonElement>('.cc-journey-detail-cta').forEach(button => {
        try { getRegisteredCta(button)?.dispose(); } catch {}
      });

      cleanupDetailStatsEnterAnimation(modal);

      const swipeableContainer = modal.querySelector('.detail-swipeable-container') as HTMLElement | null;
      const handlers = (swipeableContainer as any)?.__detailSwipeHandlers;
      if (swipeableContainer && handlers) {
        try { swipeableContainer.removeEventListener('touchstart', handlers.touchStart); } catch {}
        try { swipeableContainer.removeEventListener('touchmove', handlers.touchMove); } catch {}
        try { swipeableContainer.removeEventListener('touchend', handlers.touchEnd); } catch {}
        try { swipeableContainer.removeEventListener('touchcancel', handlers.touchEnd); } catch {}
        try { swipeableContainer.removeEventListener('mousedown', handlers.mouseDown); } catch {}
        try { swipeableContainer.removeEventListener('mousemove', handlers.mouseMove); } catch {}
        try { swipeableContainer.removeEventListener('mouseup', handlers.mouseUp); } catch {}
        try { swipeableContainer.removeEventListener('mouseleave', handlers.mouseUp); } catch {}
        try {
          if (handlers.cardTapTouchStart) swipeableContainer.removeEventListener('touchstart', handlers.cardTapTouchStart, { capture: true } as any);
          if (handlers.cardTapTouchEnd) swipeableContainer.removeEventListener('touchend', handlers.cardTapTouchEnd, { capture: true } as any);
          if (handlers.cardTapMouseDown) swipeableContainer.removeEventListener('mousedown', handlers.cardTapMouseDown, { capture: true } as any);
          if (handlers.cardTapMouseUp) swipeableContainer.removeEventListener('mouseup', handlers.cardTapMouseUp, { capture: true } as any);
          if (handlers.cancelSwipeRaf) handlers.cancelSwipeRaf();
        } catch {}
        delete (swipeableContainer as any).__detailSwipeHandlers;
      }

      const modalElements = modal.querySelectorAll('*');
      modalElements.forEach((el) => {
        try { gsap.killTweensOf(el); } catch {}
      });
      try { gsap.killTweensOf(modal); } catch {}
      modal.hidden = true;
      modal.style.display = 'none';
      modal.style.pointerEvents = 'none';
      modal.setAttribute('aria-hidden', 'true');
      delete (modal as any).__detailModalExiting;
    } catch (error) {
      logger.warn('⚠️ Failed to cleanup detail modal runtime state:', error);
    }
  }

  private cleanupJourneyScreenElasticOverscroll(): void {
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
      const handlers = (scrollable as any)?.__journeyScreenElasticHandlers;
      if (scrollable && handlers) {
        try { scrollable.removeEventListener('touchstart', handlers.start); } catch {}
        try { scrollable.removeEventListener('touchmove', handlers.move); } catch {}
        try { scrollable.removeEventListener('touchend', handlers.end); } catch {}
        try { scrollable.removeEventListener('touchcancel', handlers.end); } catch {}
        try { scrollable.removeEventListener('scroll', handlers.lockX); } catch {}
        try {
          if (handlers.releaseTimer) window.clearTimeout(handlers.releaseTimer);
          if (handlers.releaseTween) handlers.releaseTween.kill();
        } catch {}
        delete (scrollable as any).__journeyScreenElasticHandlers;
      }
      const target = document.getElementById('journey-boards-container') as HTMLElement | null;
      if (target) {
        try { gsap.killTweensOf(target); } catch {}
        target.style.transition = '';
        target.style.transform = '';
        target.style.willChange = '';
      }
    } catch (error) {
      logger.warn('⚠️ Failed to cleanup Journey screen elastic overscroll:', error);
    }
  }

  private installJourneyScreenElasticOverscroll(container: HTMLElement): void {
    try {
      const ua = navigator.userAgent || '';
      const isIOSLike = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
      const isMobileJourney = (window.innerWidth || 0) <= 768;
      if (!isIOSLike || !isMobileJourney) {
        this.cleanupJourneyScreenElasticOverscroll();
        return;
      }

      const scrollable = container.closest('.collectibles-scrollable') as HTMLElement | null;
      if (!scrollable) return;

      this.cleanupJourneyScreenElasticOverscroll();
      const contentElasticHandlers = (scrollable as any).__journeyElasticOverscrollHandlers;
      if (contentElasticHandlers) {
        try { scrollable.removeEventListener('touchstart', contentElasticHandlers.start); } catch {}
        try { scrollable.removeEventListener('touchmove', contentElasticHandlers.move); } catch {}
        try { scrollable.removeEventListener('touchend', contentElasticHandlers.end); } catch {}
        try { scrollable.removeEventListener('touchcancel', contentElasticHandlers.end); } catch {}
        try {
          if (contentElasticHandlers.releaseTimer) window.clearTimeout(contentElasticHandlers.releaseTimer);
        } catch {}
        delete (scrollable as any).__journeyElasticOverscrollHandlers;
        scrollable.style.removeProperty('transition');
        scrollable.style.removeProperty('will-change');
        scrollable.style.removeProperty('transform');
      }

      let startY = 0;
      let startX = 0;
      let currentY = 0;
      let edgeStartY: number | null = null;
      let activeEdge: 'top' | 'bottom' | null = null;
      let isDragging = false;
      let isHorizontalLocked = false;
	      let releaseTween: gsap.core.Tween | gsap.core.Timeline | null = null;
      let releaseTimer: number | null = null;
	      const damping = 0.34;
	      const maxPull = 72;
      const lockHorizontalScroll = () => {
        if (scrollable.scrollLeft !== 0) {
          scrollable.scrollLeft = 0;
        }
        if (document.scrollingElement && document.scrollingElement.scrollLeft !== 0) {
          document.scrollingElement.scrollLeft = 0;
        }
      };

      const isAtTop = () => scrollable.scrollTop <= 1;
      const isAtBottom = () => {
        const maxScroll = Math.max(0, scrollable.scrollHeight - scrollable.clientHeight);
        return scrollable.scrollTop >= maxScroll - 1;
      };

      const applyPull = (pull: number) => {
        currentY = pull;
        container.style.willChange = 'transform';
        container.style.transition = 'none';
        gsap.set(container, { y: pull, force3D: true });
      };

      const clearReleaseAnimation = () => {
        if (releaseTimer !== null) {
          window.clearTimeout(releaseTimer);
          releaseTimer = null;
        }
        if (releaseTween) {
          releaseTween.kill();
          releaseTween = null;
        }
      };

      const onStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        lockHorizontalScroll();
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentY = 0;
        edgeStartY = null;
        activeEdge = null;
        isDragging = true;
        isHorizontalLocked = false;
        clearReleaseAnimation();
        try { gsap.killTweensOf(container); } catch {}
        container.style.transition = 'none';
      };

      const onMove = (e: TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return;
        lockHorizontalScroll();
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (isHorizontalLocked || (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15)) {
          isHorizontalLocked = true;
          e.preventDefault();
          if (currentY !== 0) applyPull(0);
          lockHorizontalScroll();
          return;
        }
        const pullingTop = dy > 0 && isAtTop();
        const pullingBottom = dy < 0 && isAtBottom();
        if (!pullingTop && !pullingBottom) {
          edgeStartY = null;
          activeEdge = null;
          if (currentY !== 0) applyPull(0);
          return;
        }
        e.preventDefault();
        const edge: 'top' | 'bottom' = pullingTop ? 'top' : 'bottom';
        const touchY = e.touches[0].clientY;
        if (edgeStartY === null || activeEdge !== edge) {
          edgeStartY = touchY;
          activeEdge = edge;
          if (currentY !== 0) applyPull(0);
          return;
        }
        const pull = getJourneyElasticPull(touchY - edgeStartY, edge, damping, maxPull);
        applyPull(pull);
      };

      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        isHorizontalLocked = false;
        edgeStartY = null;
        activeEdge = null;
        if (currentY === 0) {
          container.style.willChange = '';
          return;
        }
	        const releaseDistance = Math.abs(currentY);
	        const direction = Math.sign(currentY) || 1;
	        const settleOvershoot = -direction * Math.min(8, Math.max(3, releaseDistance * 0.12));
	        const firstLegDuration = Math.min(0.28, Math.max(0.16, 0.13 + releaseDistance / 320));
	        const settleDuration = Math.min(0.58, Math.max(0.38, 0.34 + releaseDistance / 260));
	        clearReleaseAnimation();
	        container.style.transition = 'none';
	        container.style.willChange = 'transform';
	        releaseTween = gsap.timeline({
	          defaults: { force3D: true, overwrite: true },
	          onComplete: () => {
	            currentY = 0;
	            releaseTween = null;
	            if (this.renderDisposed) return;
	            container.style.transition = '';
	            container.style.willChange = '';
	          }
	        });
	        releaseTween
	          .to(container, {
	            y: settleOvershoot,
	            duration: firstLegDuration,
	            ease: 'power3.out',
	          })
	          .to(container, {
	            y: 0,
	            duration: settleDuration,
	            ease: 'elastic.out(1, 0.78)',
	          }, '>-0.06');
	        releaseTimer = window.setTimeout(() => {
	          releaseTimer = null;
	          if (this.renderDisposed) return;
	          container.style.transition = '';
	          container.style.willChange = '';
	        }, Math.ceil((firstLegDuration + settleDuration) * 1000) + 120);
	      };

      scrollable.addEventListener('touchstart', onStart, { passive: true });
      scrollable.addEventListener('touchmove', onMove, { passive: false });
      scrollable.addEventListener('touchend', onEnd, { passive: true });
      scrollable.addEventListener('touchcancel', onEnd, { passive: true });
      scrollable.addEventListener('scroll', lockHorizontalScroll, { passive: true });
      lockHorizontalScroll();
      (scrollable as any).__journeyScreenElasticHandlers = {
        start: onStart,
        move: onMove,
        end: onEnd,
        lockX: lockHorizontalScroll,
        get releaseTween() { return releaseTween; },
        get releaseTimer() { return releaseTimer; }
      };
    } catch (error) {
      logger.warn('⚠️ Failed to install Journey screen elastic overscroll:', error);
    }
  }

  /**
   * Transfer the live iOS elastic offset to the Hub exit without letting the
   * outgoing touchend/release timeline keep moving the complete screen.
   */
  private freezeJourneyV700HubElasticOffsetForExit(container: HTMLElement, reason: string): void {
    const scrollable = container.closest('.collectibles-scrollable') as HTMLElement | null;
    const handlers = scrollable && (scrollable as any).__journeyScreenElasticHandlers;
    if (!scrollable || !handlers) return;

    try { scrollable.removeEventListener('touchstart', handlers.start); } catch {}
    try { scrollable.removeEventListener('touchmove', handlers.move); } catch {}
    try { scrollable.removeEventListener('touchend', handlers.end); } catch {}
    try { scrollable.removeEventListener('touchcancel', handlers.end); } catch {}
    try { scrollable.removeEventListener('scroll', handlers.lockX); } catch {}
    try {
      if (handlers.releaseTimer) window.clearTimeout(handlers.releaseTimer);
      handlers.releaseTween?.kill?.();
    } catch {}
    delete (scrollable as any).__journeyScreenElasticHandlers;

    // Do not clear the container transform here. It is the exact visual frame
    // the player tapped; renderBoards() clears it only after the Hub is gone.
    container.style.pointerEvents = 'none';
    emitIOSNativeDiagnostic('hub-elastic-offset-frozen-for-exit', {
      reason,
      scrollTop: scrollable.scrollTop,
      containerTransform: getComputedStyle(container).transform,
      hadReleaseTween: !!handlers.releaseTween,
    });
  }

  /** Pin the Hub to its exact screen coordinates while iOS momentum is active. */
  private pinJourneyV700HubViewportForExit(container: HTMLElement, reason: string): () => void {
    const scrollable = container.closest('.collectibles-scrollable') as HTMLElement | null;
    const hub = container.querySelector<HTMLElement>('.journey-v700-hub');
    if (!scrollable || !hub) return () => {};

    const frozenScrollTop = scrollable.scrollTop;
    const beforeRect = hub.getBoundingClientRect();
    const previous = {
      hubTransform: hub.style.transform,
      overflowY: scrollable.style.overflowY,
      touchAction: scrollable.style.touchAction,
      webkitOverflowScrolling: scrollable.style.webkitOverflowScrolling,
    };
    let released = false;

    // Both writes happen in one JS task. Moving the Hub up by the captured
    // scroll amount exactly cancels resetting the native scroll owner to zero,
    // so no intermediate geometry can be painted and momentum is eliminated.
    hub.style.transform = `translate3d(0, ${-frozenScrollTop}px, 0)`;
    scrollable.scrollTop = 0;
    scrollable.style.overflowY = 'hidden';
    scrollable.style.touchAction = 'none';
    scrollable.style.webkitOverflowScrolling = 'auto';

    const afterRect = hub.getBoundingClientRect();
    emitIOSNativeDiagnostic('hub-viewport-pinned-for-exit', {
      reason,
      frozenScrollTop,
      topDelta: Math.round((afterRect.top - beforeRect.top) * 1000) / 1000,
      leftDelta: Math.round((afterRect.left - beforeRect.left) * 1000) / 1000,
    });

    return () => {
      if (released) return;
      released = true;
      hub.style.transform = previous.hubTransform;
      scrollable.style.overflowY = previous.overflowY;
      scrollable.style.touchAction = previous.touchAction;
      scrollable.style.webkitOverflowScrolling = previous.webkitOverflowScrolling;
    };
  }

  private hideHomeAndJourneyScreens(
    context: string,
    opts: { setJourneyZIndex?: boolean; hideJourney?: boolean; cleanup?: boolean } = {}
  ): void {
    const collectiblesManager = (window as any).collectiblesManager;
    if (typeof collectiblesManager?.cancelJourneyScreenPreparation === 'function') {
      collectiblesManager.cancelJourneyScreenPreparation(`hide Journey: ${context}`);
    }
    const homeElement = document.getElementById('home');
    const sliderContainer = document.getElementById('slider-container');
    if (homeElement) {
      homeElement.style.display = 'none';
      homeElement.style.visibility = 'hidden';
      homeElement.style.opacity = '0';
      homeElement.style.zIndex = '-9999';
      homeElement.setAttribute('hidden', 'true');
      logger.info(`✅ Homepage hidden (${context})`);
    }
    if (sliderContainer) {
      sliderContainer.style.display = 'none';
      sliderContainer.style.visibility = 'hidden';
      sliderContainer.style.opacity = '0';
      sliderContainer.style.zIndex = '-9999';
      logger.info(`✅ Slider container hidden (${context})`);
    }

    const shouldCleanup = opts.cleanup !== false;
    if (shouldCleanup) {
      this.cleanup();
      logger.info(`✅ Journey boards manager cleaned up (${context})`);
    }

    const shouldHideJourney = opts.hideJourney !== false;
    if (shouldHideJourney) {
      const journeyScreen = document.getElementById('journey-screen');
      if (journeyScreen) {
        journeyScreen.classList.add('hidden');
        journeyScreen.style.display = 'none';
        journeyScreen.style.visibility = 'hidden';
        journeyScreen.style.opacity = '0';
        if (opts.setJourneyZIndex) {
          (journeyScreen as HTMLElement).style.zIndex = '-1';
        }
        logger.info(`✅ Journey screen hidden (${context})`);
      }
    }
  }

  private setJourneyOriginFlags(opts: { fromInterim: boolean; returningFromInterim?: boolean } ): void {
    markJourneyGameOrigin(opts);
  }

  private async exitDetailModalAndHideCollectibles(
    modal: HTMLElement,
    context: string,
    opts: { hideCollectibles?: boolean; hideJourney?: boolean; cleanup?: boolean } = {}
  ): Promise<void> {
    const detailModalExitPromise = this.closeDetailModalWithExitAnimation(modal);
    await detailModalExitPromise;
    logger.info(`✅ Detail modal exit animation completed (${context})`);

    const collectiblesManager = (window as any).collectiblesManager;
    const shouldHideCollectibles = opts.hideCollectibles !== false;
    if (shouldHideCollectibles && collectiblesManager && typeof collectiblesManager.hideCollectibles === 'function') {
      (window as any).__ccJourneyExitMode = 'toGame';
      await collectiblesManager.hideCollectibles();
    }

    if (opts.hideJourney !== false) {
      this.hideHomeAndJourneyScreens(`detail modal exit (${context})`);
    } else if (opts.cleanup !== false) {
      this.cleanup();
    }
  }

  private async showJourneyAfterDetailModalClose(context: string): Promise<void> {
    const returnEpoch = ++this.journeyDetailReturnEpoch;
    this.renderDisposed = false;
    this.cleanupInProgress = false;

    logger.info(`🗺️ Returning to Journey after detail modal close (${context})`, { returnEpoch });
    const isCurrentDetailReturn = (): boolean => returnEpoch === this.journeyDetailReturnEpoch;

    const restoreDirectDetailReturnScroll = (phase: string): void => {
      try {
        unlockJourneyViewportTransition(`detail-modal-return-${phase}`);
        const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
        const scrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement | null;
        const journeyContainer = document.getElementById('journey-boards-container') as HTMLElement | null;
        if (!scrollable) return;

        const screenElasticHandlers = (scrollable as any).__journeyScreenElasticHandlers;
        if (screenElasticHandlers) {
          try { scrollable.removeEventListener('touchstart', screenElasticHandlers.start); } catch {}
          try { scrollable.removeEventListener('touchmove', screenElasticHandlers.move); } catch {}
          try { scrollable.removeEventListener('touchend', screenElasticHandlers.end); } catch {}
          try { scrollable.removeEventListener('touchcancel', screenElasticHandlers.end); } catch {}
          try { scrollable.removeEventListener('scroll', screenElasticHandlers.lockX); } catch {}
          try {
            if (screenElasticHandlers.releaseTimer) window.clearTimeout(screenElasticHandlers.releaseTimer);
            if (screenElasticHandlers.releaseTween) screenElasticHandlers.releaseTween.kill?.();
          } catch {}
          delete (scrollable as any).__journeyScreenElasticHandlers;
        }

        const contentElasticHandlers = (scrollable as any).__journeyElasticOverscrollHandlers;
        if (contentElasticHandlers) {
          try { scrollable.removeEventListener('touchstart', contentElasticHandlers.start); } catch {}
          try { scrollable.removeEventListener('touchmove', contentElasticHandlers.move); } catch {}
          try { scrollable.removeEventListener('touchend', contentElasticHandlers.end); } catch {}
          try { scrollable.removeEventListener('touchcancel', contentElasticHandlers.end); } catch {}
          try {
            if (contentElasticHandlers.releaseTimer) window.clearTimeout(contentElasticHandlers.releaseTimer);
          } catch {}
          delete (scrollable as any).__journeyElasticOverscrollHandlers;
        }

        scrollable.style.touchAction = 'pan-y';
        scrollable.style.pointerEvents = '';
        scrollable.style.overflow = 'auto';
        scrollable.style.overflowY = 'auto';
        scrollable.style.overflowX = 'hidden';
        scrollable.style.webkitOverflowScrolling = 'touch';
        scrollable.style.removeProperty('transform');
        scrollable.style.removeProperty('transition');
        scrollable.style.removeProperty('will-change');

        if (journeyScreen) {
          journeyScreen.style.pointerEvents = '';
        }
        if (journeyContainer) {
          try { gsap.killTweensOf(journeyContainer); } catch {}
          journeyContainer.style.pointerEvents = 'auto';
          journeyContainer.style.removeProperty('transform');
          journeyContainer.style.removeProperty('transition');
          journeyContainer.style.removeProperty('will-change');
        }

        const computed = window.getComputedStyle(scrollable);
        console.info('🧪 JourneyScrollDirectReturn restored', {
          context,
          phase,
          lockFlag: (window as any).__ccJourneyViewportTransitionLocked === true,
          removedScreenElastic: !!screenElasticHandlers,
          removedContentElastic: !!contentElasticHandlers,
          touchAction: computed.touchAction,
          overflowY: computed.overflowY,
          pointerEvents: computed.pointerEvents,
          scrollTop: scrollable.scrollTop,
          scrollHeight: scrollable.scrollHeight,
          clientHeight: scrollable.clientHeight,
        });
      } catch (error) {
        logger.warn('⚠️ Failed to restore Journey scroll after direct detail return:', String(error));
      }
    };

    delete (window as any).__ccSuppressJourneyShowForDirectDetailReturn;
    delete (window as any).__ccDirectDetailModalReturnActive;

    const ensureJourneyBoardsRendered = (phase: string): void => {
      const container = document.getElementById('journey-boards-container') as HTMLElement | null;
      if (!container) {
        logger.warn(`⚠️ Missing journey-boards-container while returning to Journey (${context}, ${phase})`);
        return;
      }

      const cardCount = container.querySelectorAll('.journey-board-card').length;
      const cardsContainer = container.querySelector('.journey-cards-container') as HTMLElement | null;
      const bgContainer = container.querySelector('.journey-bg-container') as HTMLElement | null;
      const needsRender =
        cardCount === 0 ||
        !cardsContainer ||
        cardsContainer.getBoundingClientRect().height <= 0 ||
        container.getBoundingClientRect().height <= 0;

      if (!needsRender) return;

      logger.warn(`⚠️ Journey board DOM empty or invalid while returning (${context}, ${phase}) - rerendering`, {
        cardCount,
        hasCardsContainer: !!cardsContainer,
        hasBgContainer: !!bgContainer,
      });

      try {
        this.renderBoards();
      } catch (error) {
        logger.warn(`⚠️ Failed to rerender Journey boards (${context}, ${phase}):`, error);
      }
    };

    const prepareJourneyScreenForEnter = (phase: string): void => {
      const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
      if (!journeyScreen) {
        logger.warn(`⚠️ Journey enter prep skipped - journey-screen missing (${context}, ${phase})`);
        return;
      }

      try {
        gsap.killTweensOf(journeyScreen);
      } catch {}

      journeyScreen.hidden = false;
      journeyScreen.removeAttribute('hidden');
      journeyScreen.classList.remove('hidden');
      journeyScreen.classList.add('show');
      journeyScreen.style.display = 'flex';
      journeyScreen.style.visibility = 'hidden';
      journeyScreen.style.opacity = '0';
      journeyScreen.style.zIndex = '999999';
      journeyScreen.style.pointerEvents = 'none';
      journeyScreen.style.removeProperty('transform');
      journeyScreen.style.removeProperty('scale');
      journeyScreen.style.removeProperty('translate');
      journeyScreen.style.willChange = 'opacity, transform';

      const header = journeyScreen.querySelector('.collectibles-header') as HTMLElement | null;
      const scrollable = journeyScreen.querySelector('.collectibles-scrollable') as HTMLElement | null;
      [header, scrollable].forEach((element) => {
        if (!element) return;
        try { gsap.killTweensOf(element); } catch {}
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        element.style.removeProperty('transform');
        element.style.willChange = 'opacity, transform';
      });
    };

    const forceJourneyScreenVisible = (phase: string): void => {
      const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
      if (!journeyScreen) {
        logger.warn(`⚠️ Journey force reveal skipped - journey-screen missing (${context}, ${phase})`);
        return;
      }

      try {
        gsap.killTweensOf(journeyScreen);
      } catch {}

      journeyScreen.hidden = false;
      journeyScreen.removeAttribute('hidden');
      journeyScreen.classList.remove('hidden');
      journeyScreen.classList.add('show');
      journeyScreen.style.display = 'flex';
      journeyScreen.style.visibility = 'visible';
      journeyScreen.style.opacity = '1';
      journeyScreen.style.zIndex = '999999';
      journeyScreen.style.pointerEvents = '';
      journeyScreen.style.removeProperty('transform');
      journeyScreen.style.removeProperty('scale');
      journeyScreen.style.removeProperty('translate');
      journeyScreen.style.willChange = 'auto';

      const header = journeyScreen.querySelector('.collectibles-header') as HTMLElement | null;
      const scrollable = journeyScreen.querySelector('.collectibles-scrollable') as HTMLElement | null;
      [header, scrollable].forEach((element) => {
        if (!element) return;
        try { gsap.killTweensOf(element); } catch {}
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        element.style.pointerEvents = '';
        element.style.removeProperty('transform');
        element.style.willChange = 'auto';
      });
    };

    const journeyContainerForReturn = document.getElementById('journey-boards-container') as HTMLElement | null;
    const resolvedReturnWorldId = Number(
      this.journeyV700WorldId ||
      journeyContainerForReturn?.dataset.journeyV700WorldId ||
      (window as any).__ccJourneyV700WorldId ||
      localStorage.getItem(JOURNEY_V700_WORLD_STORAGE_KEY) ||
      0
    );
    const hasPreservedWorldIdentity =
      journeyContainerForReturn?.dataset.journeyV700View === 'world' ||
      (window as any).__ccJourneyV700View === 'world' ||
      localStorage.getItem(JOURNEY_V700_VIEW_STORAGE_KEY) === 'world';
    const preserveVisibleV700World =
      Number.isFinite(resolvedReturnWorldId) &&
      resolvedReturnWorldId > 0 &&
      hasPreservedWorldIdentity &&
      !!journeyContainerForReturn?.querySelector('.journey-cards-container, .journey-bg-container');

    if (preserveVisibleV700World && journeyContainerForReturn) {
      // Board cleanup may reset the manager's in-memory view while the
      // preserved V700 world DOM and persisted identity remain valid. Restore
      // that authoritative identity before selecting animation ownership so
      // this close cannot fall through to showCollectibles and later re-enter.
      this.journeyV700View = 'world';
      this.journeyV700WorldId = resolvedReturnWorldId;
      journeyContainerForReturn.dataset.journeyV700View = 'world';
      journeyContainerForReturn.dataset.journeyV700WorldId = String(resolvedReturnWorldId);
      this.logJourneyV700Flow('detail-modal-return-preserve-world', { context, returnEpoch }, journeyContainerForReturn);
      const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
      const header = journeyScreen?.querySelector('.collectibles-header') as HTMLElement | null;
      const scrollable = journeyScreen?.querySelector('.collectibles-scrollable') as HTMLElement | null;
      const homeElement = document.getElementById('home') as HTMLElement | null;
      const sliderContainer = document.getElementById('slider-container') as HTMLElement | null;
      const worldId = resolvedReturnWorldId;
      const activeBoardId = this.getLastActiveJourneyBoardAreaId();

      // The preserved world is still mounted behind the detail modal. Prime every
      // complete Unit before revealing journey-screen; otherwise the browser can
      // paint the old idle/final transforms for one or more frames before the
      // normal enter lifecycle gets a chance to establish its start state.
      if (activeBoardId) {
        this.getJourneyV700VisibleBoardAreaTargets(journeyContainerForReturn, activeBoardId)
          .forEach((target) => this.restoreJourneyBoardCardInnerVisual(target));
      }
      this.primeJourneyV700WorldEnter(journeyContainerForReturn, worldId, {
        source: 'detail-modal-return-before-reveal',
        lastBoardId: activeBoardId,
      });

      hideHomepageNavigation('journey-detail-modal-return');
      [homeElement, sliderContainer].forEach((element) => {
        if (!element) return;
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
        element.style.zIndex = '-1';
      });

      if (journeyScreen) {
        try { gsap.killTweensOf(journeyScreen); } catch {}
        journeyScreen.hidden = false;
        journeyScreen.removeAttribute('hidden');
        journeyScreen.classList.remove('hidden');
        journeyScreen.classList.add('show');
        journeyScreen.style.display = 'flex';
        journeyScreen.style.visibility = 'visible';
        journeyScreen.style.opacity = '1';
        journeyScreen.style.zIndex = '999999';
        journeyScreen.style.pointerEvents = '';
        journeyScreen.style.removeProperty('transform');
        journeyScreen.style.removeProperty('scale');
        journeyScreen.style.removeProperty('translate');
        journeyScreen.style.willChange = 'auto';
      }

      if (scrollable) {
        scrollable.style.visibility = 'visible';
        scrollable.style.opacity = '1';
        scrollable.style.pointerEvents = '';
      }

	      if (header) {
	        try { gsap.killTweensOf(header); } catch {}
	        header.style.display = '';
	        header.style.visibility = 'visible';
	        header.style.opacity = '0';
	        header.style.pointerEvents = '';
	        header.style.transition = 'none';
	        header.style.willChange = 'transform, opacity';
	        gsap.set(header, {
	          scale: 0,
	          y: 0,
	          opacity: 0,
	          visibility: 'visible',
	          transformOrigin: '50% 0%',
	          force3D: true,
	          overwrite: true,
	        });
	      }

	      this.updateJourneyV700Nav('world', worldId);
	      this.playJourneyV700NavEnter({ transformOrigin: '50% 0%' });
	      restoreDirectDetailReturnScroll('preserve-world-before-enter');

      // This marker belongs to the completed board -> detail-modal handoff. The
      // direct detail close below is now the sole owner of the visible world
      // enter; leaving the marker alive lets a deferred Journey return compete
      // for the same targets and invalidate this motion epoch.
      delete (window as any).__ccReturningFromDetailModal;
      delete (window as any).__ccSuppressJourneyV700AutoWorldEnter;

      if (!isCurrentDetailReturn()) {
        this.logJourneyV700Flow('detail-modal-return-world-enter-skipped-stale', {
          context,
          returnEpoch,
          currentEpoch: this.journeyDetailReturnEpoch,
        }, journeyContainerForReturn);
        return;
      }

      // The preserved world was already displayed before gameplay and all of
      // its assets are local/cached. Start in this same lifecycle tick instead
      // of exposing a primed screen while waiting for every decorative image.
      this.playJourneyV700WorldEnter(journeyContainerForReturn, worldId, {
        source: 'detail-modal-return-after-game',
        lastBoardId: activeBoardId,
        waitForImages: false,
	    });
	    if (activeBoardId) {
	      this.clearLastActiveJourneyBoardAreaId(activeBoardId);
	    }
	    restoreDirectDetailReturnScroll('preserve-world-after-enter-start');
	    this.installJourneyScreenElasticOverscroll(journeyContainerForReturn);
	    [180, 420, 900].forEach((delayMs) => {
	      this.trackTimeout(() => {
	        restoreDirectDetailReturnScroll(`preserve-world-settled-${delayMs}ms`);
	        this.installJourneyScreenElasticOverscroll(journeyContainerForReturn);
	      }, delayMs);
	    });
      return;
    }

    prepareJourneyScreenForEnter('before-showCollectibles');
    const screen = document.getElementById('journey-screen') as HTMLElement | null;

    ensureJourneyBoardsRendered('before-showCollectibles');
    this.prepareJourneyBoardCardTransformsForReveal('detail-modal-return-before-showCollectibles');

    const collectiblesManager = (window as any).collectiblesManager;
    if (collectiblesManager && typeof collectiblesManager.showCollectibles === 'function') {
      try {
        await collectiblesManager.showCollectibles();
        if (!isCurrentDetailReturn()) {
          this.logJourneyV700Flow('detail-modal-return-showCollectibles-skipped-stale', {
            context,
            returnEpoch,
            currentEpoch: this.journeyDetailReturnEpoch,
          }, document.getElementById('journey-boards-container') as HTMLElement | null);
          return;
        }
        ensureJourneyBoardsRendered('after-showCollectibles');
      } catch (error) {
        logger.warn(`⚠️ Failed to show Journey after detail modal close (${context}):`, error);
      }
    } else {
      logger.warn(`⚠️ Missing collectiblesManager.showCollectibles while returning to Journey (${context})`, {
        hasCollectiblesManager: !!collectiblesManager,
      });
    }

    const runJourneyRevealFallback = (attempt = 0) => {
      const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
      const detailModal = document.getElementById('collectibles-detail-modal') as HTMLElement | null;
      const detailModalVisible =
        !!detailModal &&
        detailModal.hidden !== true &&
        detailModal.style.display !== 'none' &&
        detailModal.getAttribute('aria-hidden') !== 'true';

      if (!journeyScreen || detailModalVisible) {
        return;
      }

      const journeyAnimationActive =
        (window as any).__ccJourneyViewportEnterAnimating === true ||
        (window as any).__ccJourneyActiveAreaEnterPending === true ||
        (window as any).__ccJourneyViewportTransitionLocked === true;
      if (journeyAnimationActive && attempt < 6) {
        window.setTimeout(() => runJourneyRevealFallback(attempt + 1), 240);
        return;
      }

      const computed = window.getComputedStyle(journeyScreen);
      const container = document.getElementById('journey-boards-container') as HTMLElement | null;
      const cardCount = container?.querySelectorAll('.journey-board-card').length || 0;
      const containerRect = container?.getBoundingClientRect();
      const stillHidden =
        journeyScreen.hidden === true ||
        journeyScreen.classList.contains('hidden') ||
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        Number(computed.opacity || '1') <= 0.01;
      const contentBlank =
        !container ||
        cardCount === 0 ||
        !containerRect ||
        containerRect.height <= 0;

      if (!stillHidden && !contentBlank) return;

      forceJourneyScreenVisible('fallback');
      ensureJourneyBoardsRendered('fallback');

      logger.warn(`⚠️ Journey was hidden or blank after detail close (${context}) - applied reveal fallback`, {
        journeyScreen: getElementVisibilitySnapshot(journeyScreen),
        journeyContainer: getElementVisibilitySnapshot(document.getElementById('journey-boards-container') as HTMLElement | null),
        journeyCards: document.querySelectorAll('#journey-boards-container .journey-board-card').length,
        app: getElementVisibilitySnapshot(document.getElementById('app') as HTMLElement | null),
        home: getElementVisibilitySnapshot(document.getElementById('home') as HTMLElement | null),
      });

      window.setTimeout(() => {
        ensureJourneyBoardsRendered('fallback-retry');
      }, 250);
    };
    window.setTimeout(() => runJourneyRevealFallback(), 1250);
  }

  constructor() {
    this.initializeBoards();
    this.loadBoardsState();

    // 🔥 USER BUG FIX: Initialize journey_last_viewed_board_id if it doesn't exist
    // This ensures badge works correctly from the start
    if (!localStorage.getItem('journey_last_viewed_board_id')) {
      localStorage.setItem('journey_last_viewed_board_id', '0');
      logger.info('🗺️ Initialized journey_last_viewed_board_id to 0 in constructor');
    }

    // 🏆 LIVE UPDATE: Refresh open detail modal stats when high score changes
    window.addEventListener('cc-board-highscore-updated', async (event: any) => {
      try {
        const detail = event?.detail || {};
        const boardId = detail.boardId;
        if (!Number.isFinite(boardId)) return;

        const board = this.boards.find((item) => item.id === boardId);
        const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
        const journeyIsVisible = !!journeyScreen
          && !journeyScreen.hidden
          && !journeyScreen.classList.contains('hidden')
          && journeyScreen.style.display !== 'none'
          && getComputedStyle(journeyScreen).display !== 'none';

        if (board?.unlocked === true && board?.interim !== true) {
          const refreshed = this.refreshJourneyBoardStarVisuals(boardId, 'high-score-event');
          logger.info(refreshed
            ? `🏆 Journey stars refreshed in place for board ${boardId}`
            : `⏭️ Journey star refresh deferred until board ${boardId} DOM exists`, {
            journeyIsVisible,
            renderDisposed: this.renderDisposed,
          });
        }
        
        const modal = document.getElementById('collectibles-detail-modal');
        if (!modal) return;
        const currentId = Number(modal.getAttribute('data-journey-board-id')) || 0;
        if (currentId !== boardId) return; // Only update if this modal is showing the same board

        const { boardStatsService } = await import('../services/board-stats-service.js');
        const stats = boardStatsService.getBoardStats(boardId);

        const statsContainer = document.getElementById('board-stats-container');
        if (statsContainer) {
          statsContainer.innerHTML = `
            <div class="stat-item">
              <div class="stat-icon">
                <img src="./assets/highscore-icon.png" alt="" aria-hidden="true">
              </div>
              <div class="stat-content">
                <div class="stat-value">${stats.highScore.toLocaleString()}</div>
                <div class="stat-label">High score</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">
                <img src="./assets/combo-icon.png" alt="" aria-hidden="true">
              </div>
              <div class="stat-content">
                <div class="stat-value">${stats.longestCombo}</div>
                <div class="stat-label">Longest combo</div>
              </div>
            </div>
          `;
          logger.info(`🏆 Detail modal stats refreshed for board ${boardId}:`, stats);
        }
      } catch (error) {
        logger.warn('⚠️ Failed to refresh detail modal stats after high score update:', error);
      }
    });
  }

  // Start Journey screen exit animation immediately (safe to call multiple times)
  private startJourneyExitAnimation(): Promise<void> {
    if (this.journeyViewportExitPromise) {
      return this.journeyViewportExitPromise;
    }

    const journeyScreen = document.getElementById('journey-screen');
    const isVisible = !!(
      journeyScreen &&
      journeyScreen.style.display !== 'none' &&
      journeyScreen.style.visibility !== 'hidden' &&
      journeyScreen.style.opacity !== '0'
    );

    if (!isVisible) {
      return Promise.resolve();
    }

    this.journeyViewportExitPromise = (async () => {
      try {
        lockJourneyViewportTransition('journey-screen-exit');
        await animateJourneyViewportScreenExit('journey-screen-exit');
        logger.info('✅ Journey viewport exit animation completed (early start)');
      } catch (error) {
        logger.warn('⚠️ Failed to start Journey viewport exit animation early:', error);
      } finally {
        this.journeyViewportExitPromise = null;
      }
    })();

    return this.journeyViewportExitPromise;
  }

  /**
   * The V700 coordinator has already animated every World Unit and the shared
   * nav out. Do not run the legacy viewport target cascade over the same DOM a
   * second time before presenting the detail modal; only commit the hidden
   * screen state that cascade would otherwise leave behind.
   */
  private finalizeJourneyViewportAfterCoordinatedWorldExit(boardId: number): void {
    const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
    if (!journeyScreen) return;

    journeyScreen.style.visibility = 'hidden';
    journeyScreen.style.pointerEvents = 'none';
    journeyScreen.style.willChange = 'auto';
    try {
      gsap.set(journeyScreen, {
        opacity: 0,
        clearProps: 'transform,scale,y',
        overwrite: true,
      });
    } catch {
      journeyScreen.style.opacity = '0';
      journeyScreen.style.removeProperty('transform');
    }
    emitIOSNativeDiagnostic('coordinated-world-exit-viewport-finalized', { boardId });
  }

  private getJourneyAreaElements(boardId: number): HTMLElement[] {
    const elements = new Set<HTMLElement>();
    const areaId = `board-${boardId}`;

    document.querySelectorAll(`[data-journey-area-id="${areaId}"]`).forEach((element) => {
      elements.add(element as HTMLElement);
    });
    document.querySelectorAll(
      `.journey-forest-island-${boardId}, .journey-forest-stump-${boardId}, .journey-forest-star-board-${boardId}, .journey-forest-cloud-board-${boardId}`
    ).forEach((element) => {
      const target = element as HTMLElement;
      elements.add(target);
    });

    const card = document.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
    const cardWrapper = card?.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (cardWrapper) elements.add(cardWrapper);

    return Array.from(elements).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && document.body.contains(element);
    });
  }

  private animateBoardAreaExit(boardId: number, options: { skipCard?: boolean } = {}): Promise<void> {
    return new Promise((resolve) => {
      try {
        const { skipCard = false } = options;
        logger.info('🧩 JourneyUnitExit area-exit-start', {
          boardId,
          skipCard,
          overlapMs: BOARD_AREA_CARD_REMAINDER_EXIT_OVERLAP_MS,
        });
        const items = this.getBoardAreaTransitionItems(this.getJourneyBoardAreaParts(boardId))
          .filter((item) => !(skipCard && item.role === 'card'));

        const transitionTargets = items
          .map((item) => item.target)
          .filter((target) => target && document.body.contains(target));

        if (!transitionTargets.length) {
          logger.warn('🧭 JourneyForestAnim active-exit-no-targets', {
            boardId,
            itemCount: items.length,
          });
          resolve();
          return;
        }

        // In the coordinated V700 world flow, every visible Unit is owned by
        // JourneyWorldAnimationCoordinator. A global legacy-idle cleanup here
        // kills animation state for every card immediately before the world
        // exit starts, which makes non-tapped cards visibly snap toward y=0.
        // Stop only the tapped Unit; the coordinator will stop the remaining
        // idle motion and animate every other Unit from its current position.
        const hasCoordinatedWorldOwner =
          this.journeyV700View === 'world' &&
          !!this.journeyV700WorldId;
        if (hasCoordinatedWorldOwner) {
          this.stopJourneyAreaIdleForTargets(transitionTargets);
        } else {
          this.cleanupJourneyAreaIdleAnimations(false);
        }

        const debugItems = items.map((item) => ({
            role: item.role,
            exitOrder: item.exitOrder,
            exitDelay: Number(item.exitDelay.toFixed(3)),
            duration: item.exitDuration,
            className: item.target.className,
            dataArea: item.target.dataset?.journeyAreaId || null,
            dataBoard: item.target.dataset?.boardId || null,
        }));
        console.log('🧩 JourneyUnitExit area-exit-targets-ready', {
          boardId,
          itemCount: items.length,
          transitionTargets: transitionTargets.length,
          items: debugItems,
        });
        logger.info('🧩 JourneyUnitExit area-exit-targets-ready', {
          boardId,
          itemCount: items.length,
          transitionTargets: transitionTargets.length,
          items: debugItems,
        });
        transitionTargets.forEach((target) => {
          try { gsap.killTweensOf(target); } catch {}
          setJourneyAlienBeamIdleReady(target, false);
          rememberJourneyBoardCardBaseTransform(target);
          (target as any).__ccJourneyToGameExitTween = true;
          const visualTarget = this.prepareJourneyBoardCardVisualTarget(target);
          restoreJourneyAreaTransformOrigin(target);
          target.style.willChange = 'transform, opacity';
          target.style.pointerEvents = 'none';
          target.style.transition = 'none';
          target.style.opacity = '1';
          target.style.visibility = 'visible';
          if (visualTarget !== target) {
            gsap.set(target, {
              scale: 1,
              opacity: 1,
              visibility: 'visible',
              clearProps: 'scale,y',
              overwrite: true,
            });
            gsap.set(visualTarget, {
              scale: 1,
              opacity: 1,
              visibility: 'visible',
              force3D: true,
              overwrite: true,
            });
          }
        });

        let pendingTweens = items.length;
        let resolved = false;
        const finalizeExitTarget = (target: HTMLElement): void => {
          try {
            target.style.visibility = 'hidden';
            target.style.willChange = 'auto';
            target.style.pointerEvents = '';
            this.restoreJourneyBoardCardVisualTarget(target);
            gsap.set(target, {
              scale: target.classList.contains('journey-board-card-wrapper') ? 1 : BOARD_AREA_MODAL_EXIT_MIN_SCALE,
              opacity: 0,
              overwrite: true,
            });
          } catch {}
        };
        const finishedExitTargets = new WeakSet<HTMLElement>();
        const finishExitTarget = (target: HTMLElement): void => {
          if (finishedExitTargets.has(target)) return;
          finishedExitTargets.add(target);
          finalizeExitTarget(target);
          finishOne();
        };
        const finishOne = () => {
          pendingTweens -= 1;
          logger.info('🧩 JourneyUnitExit area-exit-item-finished', {
            boardId,
            remaining: pendingTweens,
          });
          if (pendingTweens <= 0 && !resolved) {
            resolved = true;
            logger.info('🧩 JourneyUnitExit area-exit-complete', {
              boardId,
              transitionTargets: transitionTargets.length,
            });
            transitionTargets.forEach((target) => {
              try {
                delete (target as any).__ccJourneyToGameExitTween;
                target.style.willChange = 'auto';
                target.style.pointerEvents = '';
              } catch {}
            });
            resolve();
          }
        };

        items.forEach((item) => {
          const target = item.target;
          if (!target || !document.body.contains(target)) {
            finishOne();
            return;
          }

          const visualTarget = this.prepareJourneyBoardCardVisualTarget(target);
          const isCardExit = item.role === 'card';
          const animTarget = visualTarget;

          const completeExit = () => {
            logger.info('🧩 JourneyUnitExit area-exit-item-complete', {
              boardId,
              role: item.role,
              exitOrder: item.exitOrder,
              exitDelay: Number(item.exitDelay.toFixed(3)),
              className: target.className,
            });
            finishExitTarget(target);
          };
          const interruptExit = () => {
            logger.warn('🧩 JourneyUnitExit area-exit-item-interrupt', {
              boardId,
              role: item.role,
              exitOrder: item.exitOrder,
              className: target.className,
              scale: Number(gsap.getProperty(animTarget, 'scale') || 0),
              opacity: Number(gsap.getProperty(animTarget, 'opacity') || 0),
            });
            // Interrupts are usually caused by cleanup or a competing tween. Complete the
            // visual exit state before resolving so the board transition cannot cut mid-motion.
            try {
              gsap.set(animTarget, {
                scale: BOARD_AREA_MODAL_EXIT_MIN_SCALE,
                opacity: 0,
                visibility: 'hidden',
                overwrite: true,
              });
            } catch {}
            finishExitTarget(target);
          };

          if (isCardExit) {
            const exitTimeline = trackTimeline({
              delay: item.exitDelay,
              onComplete: completeExit,
              onInterrupt: interruptExit,
            });
            exitTimeline.to(animTarget, {
              scale: 0,
              opacity: 0,
              duration: BOARD_AREA_CARD_TAP_EXIT_DURATION,
              ease: BOARD_AREA_CARD_TAP_EXIT_EASE,
              force3D: true,
              overwrite: true,
              transformOrigin: '50% 50%',
            });
            return;
          }

          trackTween(animTarget, {
            scale: BOARD_AREA_MODAL_EXIT_MIN_SCALE,
            opacity: 0,
            duration: item.exitDuration,
            ease: item.exitEase,
            delay: item.exitDelay,
            force3D: true,
            overwrite: true,
            onComplete: completeExit,
            onInterrupt: interruptExit,
          });
        });

      } catch (error) {
        logger.warn('⚠️ Failed to animate Journey board area exit:', error);
        resolve();
      }
    });
  }

  /** Shared V625-style tapped-card exit for regular and interim Journey cards. */
  private animateJourneyCardTapExit(boardId: number): Promise<void> {
    return new Promise((resolve) => {
      const card = document.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
      const cardWrapper = card?.closest('.journey-board-card-wrapper') as HTMLElement | null;
      if (!card || !cardWrapper || !document.body.contains(cardWrapper)) {
        console.warn('🧩 JourneyUnitExit card-exit-skip-missing-card', {
          boardId,
          hasCard: !!card,
          hasWrapper: !!cardWrapper,
        });
        logger.warn('🧩 JourneyUnitExit card-exit-skip-missing-card', {
          boardId,
          hasCard: !!card,
          hasWrapper: !!cardWrapper,
        });
        resolve();
        return;
      }

      let finished = false;
      const finish = (reason: 'complete' | 'interrupt' | 'error' = 'complete') => {
        if (finished) return;
        finished = true;
        const scale = card ? Number(gsap.getProperty(card, 'scale') || 0) : null;
        const opacity = card ? Number(gsap.getProperty(card, 'opacity') || 0) : null;
        console.log(`🧩 JourneyUnitExit card-exit-${reason}`, {
          boardId,
          visualTarget: 'card',
          scale,
          opacity,
        });
        logger.info(`🧩 JourneyUnitExit card-exit-${reason}`, {
          boardId,
          visualTarget: 'card',
          scale,
          opacity,
        });
        try {
          delete (cardWrapper as any).__ccJourneyCardTapExitActive;
          card.classList.remove('journey-card-tapping');
          cardWrapper.style.willChange = 'auto';
          card.style.willChange = 'auto';
        } catch {}
        resolve();
      };

      try {
        gsap.killTweensOf(cardWrapper);
        gsap.killTweensOf(card);
        (cardWrapper as any).__ccJourneyCardTapExitActive = true;
        cardWrapper.style.pointerEvents = 'none';
        cardWrapper.style.visibility = 'visible';
        cardWrapper.style.willChange = 'auto';
        cardWrapper.style.transformOrigin = '50% 50%';
        card.style.pointerEvents = 'none';
        card.classList.add('journey-card-tapping');
        card.style.visibility = 'visible';
        card.style.opacity = '1';
        card.style.setProperty('transition', 'none', 'important');
        card.style.willChange = 'transform';
        card.style.transformOrigin = '50% 50%';
        gsap.set(card, {
          scale: 1,
          opacity: 1,
          visibility: 'visible',
          overwrite: false,
        });
        console.log('🧩 JourneyUnitExit card-exit-start', {
          boardId,
          className: cardWrapper.className,
          inlineTransform: cardWrapper.style.transform || null,
          visualTarget: 'card',
          cardInlineTransform: card.style.transform || null,
          opacity: card.style.opacity || null,
        });
        logger.info('🧩 JourneyUnitExit card-exit-start', {
          boardId,
          className: cardWrapper.className,
          inlineTransform: cardWrapper.style.transform || null,
          visualTarget: 'card',
          opacity: cardWrapper.style.opacity || null,
          rect: (() => {
            const rect = cardWrapper.getBoundingClientRect();
            return {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          })(),
        });

        const timeline = getOriginalGsapTimeline()({
          defaults: {
            force3D: true,
            overwrite: false,
            transformOrigin: '50% 50%',
          },
          onComplete: () => finish('complete'),
          onInterrupt: () => {
            try {
              gsap.set(card, {
                scale: 0,
                opacity: 0,
                visibility: 'hidden',
                overwrite: true,
              });
            } catch {}
            finish('interrupt');
          },
        });
        timeline.to(card, {
          scale: BOARD_AREA_CARD_TAP_EXIT_PUNCH_SCALE,
          duration: BOARD_AREA_CARD_TAP_EXIT_PUNCH_DURATION,
          ease: 'back.out(2.4)',
          overwrite: 'auto',
        });
        timeline.to(card, {
          scale: 0,
          duration: BOARD_AREA_CARD_TAP_EXIT_DURATION,
          ease: BOARD_AREA_CARD_TAP_EXIT_EASE,
          overwrite: 'auto',
          onStart: () => {
            console.log('🧩 JourneyUnitExit card-exit-shrink-start', {
              boardId,
              visualTarget: 'card',
              scale: Number(gsap.getProperty(card, 'scale') || 0),
              opacity: Number(gsap.getProperty(card, 'opacity') || 0),
            });
            logger.info('🧩 JourneyUnitExit card-exit-shrink-start', {
              boardId,
              visualTarget: 'card',
              scale: Number(gsap.getProperty(card, 'scale') || 0),
              opacity: Number(gsap.getProperty(card, 'opacity') || 0),
            });
          },
          onComplete: () => {
            try {
              gsap.set(card, {
                opacity: 0,
                visibility: 'hidden',
                overwrite: false,
              });
            } catch {}
          },
        });
      } catch (error) {
        logger.warn('⚠️ Journey shared card tap exit failed:', { boardId, error });
        finish('error');
      }
    });
  }

  private cleanupJourneyTapTransientFx(boardId: number): void {
    try {
      this.stopInterimCardIdleEffects();
      try { JOURNEY_CARD_IDLE_BOUNCE?.cleanupSmokeEffects?.(); } catch {}
      const tappedCard = document.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
      if (tappedCard) {
        try { this.stopInterimBounce(tappedCard, { restoreBase: false }); } catch {}
      }
      document.querySelectorAll('.journey-board-card.interim').forEach((card) => {
        try { this.stopInterimBounce(card as HTMLElement, { restoreBase: false }); } catch {}
      });
      document.querySelectorAll('.journey-card-smoke-container, .journey-card-smoke-particle, .smoke-particle').forEach((node) => {
        const element = node as HTMLElement;
        try { gsap.killTweensOf(element); } catch {}
        try { element.remove(); } catch {}
      });
    } catch (error) {
      logger.warn('⚠️ Failed to cleanup Journey tap transient FX:', { boardId, error });
    }
  }

  private waitForJourneyTapRemainderOverlap(): Promise<void> {
    return new Promise((resolve) => {
      this.trackTimeout(resolve, BOARD_AREA_CARD_REMAINDER_EXIT_OVERLAP_MS);
    });
  }

  private async runClickedJourneyBoardUnitExit(
    boardId: number,
    source: 'regular-card' | 'interim-card',
    onRemainderExitStarted?: () => void,
  ): Promise<void> {
    console.log('🧩 JourneyUnitExit flow-start', {
      boardId,
      source,
      cardExitMs: Math.round(BOARD_AREA_CARD_TAP_EXIT_DURATION * 1000),
      cardExitEase: BOARD_AREA_CARD_TAP_EXIT_EASE,
      remainderOverlapMs: BOARD_AREA_CARD_REMAINDER_EXIT_OVERLAP_MS,
    });
    logger.info('🧩 JourneyUnitExit flow-start', {
      boardId,
      source,
      cardExitMs: Math.round(BOARD_AREA_CARD_TAP_EXIT_DURATION * 1000),
      cardExitEase: BOARD_AREA_CARD_TAP_EXIT_EASE,
      remainderOverlapMs: BOARD_AREA_CARD_REMAINDER_EXIT_OVERLAP_MS,
    });

    this.cleanupJourneyTapTransientFx(boardId);
    console.log('🧩 JourneyUnitExit transient-fx-cleaned', {
      boardId,
      source,
      remainingSmokeNodes: document.querySelectorAll('.journey-card-smoke-container, .journey-card-smoke-particle, .smoke-particle').length,
    });
    logger.info('🧩 JourneyUnitExit transient-fx-cleaned', {
      boardId,
      source,
      remainingSmokeNodes: document.querySelectorAll('.journey-card-smoke-container, .journey-card-smoke-particle, .smoke-particle').length,
    });

    const cardExitPromise = this.animateJourneyCardTapExit(boardId);
    await this.waitForJourneyTapRemainderOverlap();
    console.log('🧩 JourneyUnitExit remainder-exit-start-after-card-shrink', {
      boardId,
      source,
      skipCard: true,
    });
    logger.info('🧩 JourneyUnitExit remainder-exit-start-after-card-shrink', {
      boardId,
      source,
      skipCard: true,
    });
    const areaExitPromise = this.animateBoardAreaExit(boardId, { skipCard: true });
    onRemainderExitStarted?.();
    await Promise.all([cardExitPromise, areaExitPromise]);

    console.log('🧩 JourneyUnitExit flow-complete', {
      boardId,
      source,
    });
    logger.info('🧩 JourneyUnitExit flow-complete', {
      boardId,
      source,
    });
  }

  private startJourneyWorldContentExitExcludingBoard(boardId: number): Promise<void> {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    const useCoordinatedWorldExit =
      !!container &&
      this.journeyV700View === 'world' &&
      !!this.journeyV700WorldId;

    console.log('🧩 JourneyUnitExit world-content-exit-start', {
      boardId,
      coordinatedWorldExit: useCoordinatedWorldExit,
      view: this.journeyV700View,
      worldId: this.journeyV700WorldId,
    });
    if (!useCoordinatedWorldExit || !container) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.playJourneyV700WorldExit(container, () => {
        console.log('🧩 JourneyUnitExit world-content-exit-complete', {
          boardId,
          excludedBoardId: boardId,
        });
        resolve();
      }, { excludeBoardId: boardId });
    });
  }

  private startInterimAreaThenJourneyExit(boardId: number): Promise<void> {
    if (this.journeyExitPromise) {
      logger.warn('🧪 JourneyInterimFX exit-skip-existing-promise', { boardId });
      return this.journeyExitPromise;
    }

    this.setLastActiveJourneyBoardAreaId(boardId);
    this.activeBoardAreaEnterPreparedTargets = [];
    this.journeyV700PreparedWorldEnter = null;
    this.journeyToGameExitActive = true;
    this.journeyToGameExitBoardId = boardId;
    lockJourneyViewportTransition(`journey-interim-area-exit-${boardId}`);

    this.journeyExitPromise = (async () => {
	      let journeyStarted = false;
	      let linkedJourneyExitPromise: Promise<void> | null = null;
	      let contentExitPromise: Promise<void> | null = null;
	      let navExitPromise: Promise<void> | null = null;
	      const startLinkedContentExit = () => {
	        if (contentExitPromise) return;
	        contentExitPromise = this.startJourneyWorldContentExitExcludingBoard(boardId);
	        navExitPromise = this.playJourneyV700NavExit();
	      };
      const startLinkedJourneyExit = () => {
        if (journeyStarted) return;
        journeyStarted = true;
        linkedJourneyExitPromise = this.startJourneyExitAnimation();
      };

      try {
        await this.runClickedJourneyBoardUnitExit(boardId, 'interim-card', startLinkedContentExit);
	        if (contentExitPromise) {
	          await contentExitPromise;
	        }
	        if (navExitPromise) {
	          await navExitPromise;
	        }
	        startLinkedJourneyExit();
        if (linkedJourneyExitPromise) {
          await linkedJourneyExitPromise;
        }
        logger.info('🧪 JourneyInterimFX flow-complete', { boardId });
      } finally {
        this.journeyExitPromise = null;
        this.journeyViewportExitPromise = null;
        this.journeyToGameExitActive = false;
        this.journeyToGameExitBoardId = null;
      }
    })();

    return this.journeyExitPromise;
  }

  private startBoardAreaThenJourneyExit(boardId: number): Promise<void> {
    if (this.journeyExitPromise) {
      logger.warn('🧭 JourneyForestAnim journey-exit-skip-existing-promise', { boardId });
      return this.journeyExitPromise;
    }

    this.setLastActiveJourneyBoardAreaId(boardId);
    this.activeBoardAreaEnterPreparedTargets = [];
    this.journeyToGameExitActive = true;
    this.journeyToGameExitBoardId = boardId;
    lockJourneyViewportTransition(`journey-board-area-exit-${boardId}`);
    logger.info('🧭 JourneyForestAnim journey-exit-flow-start', { boardId });

    this.journeyExitPromise = (async () => {
      try {
	        let contentExitPromise: Promise<void> | null = null;
	        let navExitPromise: Promise<void> | null = null;
	        const startLinkedContentExit = () => {
	          if (contentExitPromise) return;
	          contentExitPromise = this.startJourneyWorldContentExitExcludingBoard(boardId);
	          navExitPromise = this.playJourneyV700NavExit();
	        };

        await this.runClickedJourneyBoardUnitExit(boardId, 'regular-card', startLinkedContentExit);
	        if (contentExitPromise) {
	          await contentExitPromise;
	        }
	        if (navExitPromise) {
	          await navExitPromise;
	        }
	        logger.info('🧭 JourneyForestAnim viewport-exit-after-content', {
          boardId,
          coordinatedWorldExit: !!contentExitPromise,
        });
        if (contentExitPromise) {
          // World Units and nav have already completed the canonical V700 exit.
          // Replaying the generic viewport cascade here adds a visually empty
          // ~0.5 s tail before the detail modal and re-owns the same targets.
          this.finalizeJourneyViewportAfterCoordinatedWorldExit(boardId);
        } else {
          await this.startJourneyExitAnimation();
        }
        logger.info('🧭 JourneyForestAnim journey-exit-flow-complete', { boardId });
      } finally {
        this.journeyExitPromise = null;
        this.journeyViewportExitPromise = null;
        this.journeyToGameExitActive = false;
        this.journeyToGameExitBoardId = null;
      }
    })();

    return this.journeyExitPromise;
  }

  private startOverlayPortaledCardJourneyExit(
    boardId: number,
    cardExitComplete: Promise<void>,
  ): Promise<void> {
    if (this.journeyExitPromise) return this.journeyExitPromise;

    this.setLastActiveJourneyBoardAreaId(boardId);
    this.activeBoardAreaEnterPreparedTargets = [];
    this.journeyToGameExitActive = true;
    this.journeyToGameExitBoardId = boardId;
    lockJourneyViewportTransition(`journey-overlay-card-exit-${boardId}`);

    this.journeyExitPromise = (async () => {
      try {
        // The exact card remains in the overlay portal through its complete
        // landing punch/collapse. Journey owns only Unit/World/nav targets, so
        // no reparent, selector, or stale enter cleanup can interrupt pixels.
        this.cleanupJourneyTapTransientFx(boardId);
        const selectedUnitExit = this.animateBoardAreaExit(boardId, { skipCard: true });
        const contentExit = this.startJourneyWorldContentExitExcludingBoard(boardId);
        const navExit = this.playJourneyV700NavExit();
        await Promise.all([selectedUnitExit, contentExit, navExit, cardExitComplete]);
        // Unit/card/nav owners have already completed. The legacy viewport
        // cascade uses includeHiddenPrepared and can resurrect an already
        // exited card for one final stagger frame. Commit only the viewport
        // shell state here; never re-own child Journey cards a second time.
        this.finalizeJourneyViewportAfterCoordinatedWorldExit(boardId);
      } finally {
        this.journeyExitPromise = null;
        this.journeyViewportExitPromise = null;
        this.journeyToGameExitActive = false;
        this.journeyToGameExitBoardId = null;
      }
    })();

    return this.journeyExitPromise;
  }

  private installInterimAreaHitTargets(cardsContainer: HTMLElement): void {
    try {
      cardsContainer.querySelectorAll('.journey-interim-area-hit-target').forEach((target) => target.remove());

      const interimCards = cardsContainer.querySelectorAll('.journey-board-card.interim') as NodeListOf<HTMLElement>;
      interimCards.forEach((card) => {
        const boardId = Number(card.dataset.boardId || 0);
        if (!Number.isFinite(boardId) || boardId <= 0) return;

        const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement | null;
        const tapHandler = (cardWrapper as any)?._journeyInterimTapHandler;
        if (!cardWrapper || typeof tapHandler !== 'function') return;

        const areaElements = this.getJourneyAreaElements(boardId);
        if (!areaElements.length) return;

        const containerRect = cardsContainer.getBoundingClientRect();
        const rects = areaElements.map((element) => element.getBoundingClientRect());
        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));

        const hitTarget = document.createElement('div');
        hitTarget.className = 'journey-interim-area-hit-target';
        hitTarget.dataset.boardId = String(boardId);
        hitTarget.style.position = 'absolute';
        hitTarget.style.left = `${left - containerRect.left}px`;
        hitTarget.style.top = `${top - containerRect.top}px`;
        hitTarget.style.width = `${right - left}px`;
        hitTarget.style.height = `${bottom - top}px`;
        hitTarget.style.zIndex = '9';
        hitTarget.style.background = 'transparent';
        hitTarget.style.pointerEvents = 'auto';
        hitTarget.style.touchAction = 'pan-y';
        hitTarget.style.cursor = 'pointer';

        let startX = 0;
        let startY = 0;
        let moved = false;
        const threshold = 10;

        hitTarget.addEventListener('touchstart', (event: TouchEvent) => {
          if (!event.touches || event.touches.length === 0) return;
          startX = event.touches[0].clientX;
          startY = event.touches[0].clientY;
          moved = false;
        }, { passive: true });
        hitTarget.addEventListener('touchmove', (event: TouchEvent) => {
          if (!event.touches || event.touches.length === 0) return;
          const dx = event.touches[0].clientX - startX;
          const dy = event.touches[0].clientY - startY;
          moved = (dx * dx + dy * dy) > (threshold * threshold);
        }, { passive: true });
        hitTarget.addEventListener('touchend', (event: TouchEvent) => {
          if (moved) return;
          tapHandler(event);
        }, { passive: false });
        hitTarget.addEventListener('click', (event: MouseEvent) => {
          if (moved) return;
          tapHandler(event);
        });

        cardsContainer.appendChild(hitTarget);
      });
    } catch (error) {
      logger.warn('⚠️ Failed to install interim area hit targets:', error);
    }
  }

  /**
   * 🔥 USER REQUEST: Start independent bounce animation on interim card
   * This is a continuous animation that runs independently from other cards
   */
  private startInterimBounce(card: HTMLElement): void {
    if (!ENABLE_INTERIM_CARD_IDLE_EFFECTS) {
      this.stopInterimBounce(card);
      try { JOURNEY_CARD_IDLE_BOUNCE?.cleanupSmokeEffects?.(card); } catch {}
      return;
    }

    // Get card wrapper for lifecycle flags; animate the card itself so Journey
    // area-idle y/x tickers on the wrapper cannot cancel the interim bounce.
    const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (!cardWrapper) return;
    const cardRect = cardWrapper.getBoundingClientRect();
    if (
      !Number.isFinite(cardRect.width) ||
      !Number.isFinite(cardRect.height) ||
      cardRect.width < 20 ||
      cardRect.height < 20
    ) {
      logger.info('🧪 JourneyInterimFX bounce-start-deferred-invalid-geometry', {
        boardId: card.dataset.boardId,
        width: cardRect.width,
        height: cardRect.height,
      });
      if (!(cardWrapper as any)._interimGeometryRetryScheduled) {
        (cardWrapper as any)._interimGeometryRetryScheduled = true;
        this.scheduleInterimIdleEffectsRetry('invalid-geometry', 140, () => {
          delete (cardWrapper as any)._interimGeometryRetryScheduled;
        });
      }
      return;
    }
    delete (cardWrapper as any)._interimGeometryRetryScheduled;
    
    // 🔥 CRITICAL FIX: Check if bounce animation is already active to prevent duplicates
    if ((cardWrapper as any)._interimBounceActive) {
      logger.warn('⚠️ Interim bounce animation already active, skipping duplicate start');
      return;
    }
    
    // Stop any existing bounce animation (safety check)
    this.stopInterimBounce(card);
    
    const tiltDegrees = JOURNEY_INTERIM_IDLE_MOTION.tiltDegrees;
    const tiltDirection = Math.random() > 0.5 ? 1 : -1;
    let bounceVariant = createJourneyInterimBounceVariant();
    if ((card as any)._interimBounceInlineTransition === undefined) {
      (card as any)._interimBounceInlineTransition = card.style.transition || '';
    }
    card.style.transition = 'none';
    card.style.animation = '';
    card.style.animationPlayState = '';
    card.style.transformOrigin = '50% 50%';
    card.style.willChange = 'transform';
    
    const triggerLandingSmoke = () => {
      if (this.renderDisposed || !card.parentElement) {
        this.stopInterimBounce(card);
        return;
      }

      if (!(cardWrapper as any)._interimBounceActive) {
        logger.debug('ℹ️ Bounce stopped before smoke trigger during teardown, skipping smoke');
        return;
      }

      // Every completed landing gets one fresh, bounded puff. Cleaning the
      // previous container first keeps the cadence exact without overlap buildup.
      try { JOURNEY_CARD_IDLE_BOUNCE?.cleanupSmokeEffects?.(card); } catch {}
      // 40% stronger than the prior 0.68-0.82 range, capped at solid white.
      const randomAlpha = Math.min(1, (0.68 + Math.random() * 0.14) * 1.4);
      smokeBubblesAtCard(card, {
        sizeScale: 0.54,
        distanceScale: 0.58,
        countScale: 0.28,
        haloScale: 0.52,
        strength: 1.55 + Math.random() * 0.2,
        trailAlpha: randomAlpha,
        baseAlpha: randomAlpha,
        allowOverlap: false,
        activeLockMs: 720,
        fadeOutTime: 0.46,
        cleanupTime: 0.92
      });
    };

    if ((cardWrapper as any)._bounceTimeout) {
      clearTimeout((cardWrapper as any)._bounceTimeout);
      (cardWrapper as any)._bounceTimeout = null;
    }

    (cardWrapper as any)._interimBounceActive = true;
    (cardWrapper as any)._interimBounceStartedAt = Date.now();
    const bounceTimeline = trackTimeline({
      delay: 0.3,
      repeat: -1,
      repeatDelay: JOURNEY_INTERIM_IDLE_MOTION.repeatDelaySeconds,
      repeatRefresh: true,
      defaults: {
        transformOrigin: 'center center',
        force3D: true,
      },
      onRepeat: () => {
        if (this.renderDisposed || !card.parentElement || !(cardWrapper as any)._interimBounceActive) {
          this.stopInterimBounce(card);
          return;
        }
        bounceVariant = createJourneyInterimBounceVariant();
      },
    });
    bounceTimeline
      .to(card, {
        scaleX: JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleX,
        scaleY: JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleY,
        y: 1.5,
        duration: JOURNEY_INTERIM_IDLE_MOTION.anticipationDurationSeconds,
        ease: 'power2.in',
      })
      .to(card, {
        scaleX: () => bounceVariant.peakScaleX,
        scaleY: () => bounceVariant.peakScaleY,
        rotation: () => tiltDegrees * tiltDirection * bounceVariant.tiltMultiplier,
        y: -JOURNEY_INTERIM_IDLE_MOTION.liftPx,
        duration: JOURNEY_INTERIM_IDLE_MOTION.riseDurationSeconds,
        ease: 'back.out(2.5)',
      })
      .to(card, {
        scaleX: () => bounceVariant.landScaleX,
        scaleY: () => bounceVariant.landScaleY,
        rotation: () => -tiltDegrees * tiltDirection * bounceVariant.tiltMultiplier * 0.22,
        y: 1,
        duration: JOURNEY_INTERIM_IDLE_MOTION.landDurationSeconds,
        ease: 'power2.in',
        onComplete: triggerLandingSmoke,
      })
      .to(card, {
        scaleX: JOURNEY_INTERIM_IDLE_MOTION.reboundScaleX,
        scaleY: JOURNEY_INTERIM_IDLE_MOTION.reboundScaleY,
        rotation: tiltDegrees * tiltDirection * 0.12,
        y: -2.5,
        duration: JOURNEY_INTERIM_IDLE_MOTION.reboundDurationSeconds,
        ease: 'power2.out',
      })
      .to(card, {
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        y: 0,
        duration: JOURNEY_INTERIM_IDLE_MOTION.settleDurationSeconds,
        ease: 'back.out(1.7)',
      });
    (cardWrapper as any)._interimBounceTimeline = bounceTimeline;
    
    logger.debug('💚 Started interim bounce animation on card');
  }

  private playOverlayCardLandingBounce(card: HTMLElement): void {
    const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (this.renderDisposed || !card.isConnected || !cardWrapper) return;

    this.stopOverlayCardLandingBounce(card);

    const variant = createJourneyInterimBounceVariant();
    const tiltDirection = Math.random() > 0.5 ? 1 : -1;
    const tiltDegrees = JOURNEY_INTERIM_IDLE_MOTION.tiltDegrees;
    const previousTransition = card.style.transition;
    const previousWillChange = card.style.willChange;
    const previousTransformOrigin = card.style.transformOrigin;
    (cardWrapper as any)._overlayLandingBounceRestore = {
      transition: previousTransition,
      willChange: previousWillChange,
      transformOrigin: previousTransformOrigin,
    };

    card.style.transition = 'none';
    card.style.transformOrigin = '50% 50%';
    card.style.willChange = 'transform';

    const finish = () => {
      if ((cardWrapper as any)._overlayLandingBounceTimeline !== timeline) return;
      delete (cardWrapper as any)._overlayLandingBounceTimeline;
      delete (cardWrapper as any)._overlayLandingBounceRestore;
      card.style.transition = previousTransition;
      card.style.willChange = previousWillChange;
      card.style.transformOrigin = previousTransformOrigin;
      gsap.set(card, { clearProps: 'transform' });
    };
    const timeline = trackTimeline({
      defaults: { transformOrigin: 'center center', force3D: true },
      onComplete: finish,
      onInterrupt: finish,
    });
    (cardWrapper as any)._overlayLandingBounceTimeline = timeline;

    timeline
      .to(card, {
        scaleX: JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleX,
        scaleY: JOURNEY_INTERIM_IDLE_MOTION.anticipationScaleY,
        y: 1.5,
        duration: JOURNEY_INTERIM_IDLE_MOTION.anticipationDurationSeconds,
        ease: 'power2.in',
      })
      .to(card, {
        scaleX: variant.peakScaleX,
        scaleY: variant.peakScaleY,
        rotation: tiltDegrees * tiltDirection * variant.tiltMultiplier,
        y: -JOURNEY_INTERIM_IDLE_MOTION.liftPx,
        duration: JOURNEY_INTERIM_IDLE_MOTION.riseDurationSeconds,
        ease: 'back.out(2.5)',
      })
      .to(card, {
        scaleX: variant.landScaleX,
        scaleY: variant.landScaleY,
        rotation: -tiltDegrees * tiltDirection * variant.tiltMultiplier * 0.22,
        y: 1,
        duration: JOURNEY_INTERIM_IDLE_MOTION.landDurationSeconds,
        ease: 'power2.in',
        onComplete: () => {
          if (this.renderDisposed || !card.isConnected) return;
          try { JOURNEY_CARD_IDLE_BOUNCE?.cleanupSmokeEffects?.(card); } catch {}
          const smokeAlpha = Math.min(1, (0.68 + Math.random() * 0.14) * 1.4);
          smokeBubblesAtCard(card, {
            sizeScale: 0.54,
            distanceScale: 0.58,
            countScale: 0.28,
            haloScale: 0.52,
            strength: 1.55 + Math.random() * 0.2,
            trailAlpha: smokeAlpha,
            baseAlpha: smokeAlpha,
            allowOverlap: false,
            allowNonInterim: true,
            activeLockMs: 720,
            fadeOutTime: 0.46,
            cleanupTime: 0.92,
          });
        },
      })
      .to(card, {
        scaleX: JOURNEY_INTERIM_IDLE_MOTION.reboundScaleX,
        scaleY: JOURNEY_INTERIM_IDLE_MOTION.reboundScaleY,
        rotation: tiltDegrees * tiltDirection * 0.12,
        y: -2.5,
        duration: JOURNEY_INTERIM_IDLE_MOTION.reboundDurationSeconds,
        ease: 'power2.out',
      })
      .to(card, {
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        y: 0,
        duration: JOURNEY_INTERIM_IDLE_MOTION.settleDurationSeconds,
        ease: 'back.out(1.7)',
      });
  }

  private stopOverlayCardLandingBounce(card: HTMLElement): void {
    const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (!cardWrapper) return;
    const timeline = (cardWrapper as any)._overlayLandingBounceTimeline;
    const restore = (cardWrapper as any)._overlayLandingBounceRestore as {
      transition: string;
      willChange: string;
      transformOrigin: string;
    } | undefined;
    if (timeline) {
      try { timeline.kill(); } catch {}
    }
    delete (cardWrapper as any)._overlayLandingBounceTimeline;
    delete (cardWrapper as any)._overlayLandingBounceRestore;
    try { gsap.killTweensOf(card); } catch {}
    try { gsap.set(card, { clearProps: 'transform' }); } catch {}
    if (restore) {
      card.style.transition = restore.transition;
      card.style.willChange = restore.willChange;
      card.style.transformOrigin = restore.transformOrigin;
    }
  }
  
  /**
   * 🔥 USER REQUEST: Stop bounce animation on interim card
   */
  private stopInterimBounce(card: HTMLElement, opts: { restoreBase?: boolean } = {}): void {
    const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (!cardWrapper) return;
    
    const timeline = (cardWrapper as any)._interimBounceTimeline;
    if (timeline) {
      animationManager.killExternalTimeline(timeline);
      delete (cardWrapper as any)._interimBounceTimeline;
    }

    // Kill GSAP animations
    gsap.killTweensOf(card, 'scale,scaleX,scaleY,rotation,y');
    if (opts.restoreBase !== false) {
      try {
        gsap.set(card, {
          scale: 1,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          y: 0,
          clearProps: 'transform',
          overwrite: true,
        });
      } catch {}
      card.style.willChange = '';
      const previousTransition = (card as any)._interimBounceInlineTransition;
      if (previousTransition !== undefined) {
        card.style.transition = previousTransition;
        delete (card as any)._interimBounceInlineTransition;
      }
    }
    
    // Clear timeout
    if ((cardWrapper as any)._bounceTimeout) {
      clearTimeout((cardWrapper as any)._bounceTimeout);
      delete (cardWrapper as any)._bounceTimeout;
    }
    
    if (opts.restoreBase !== false) {
      try { gsap.killTweensOf(cardWrapper, 'scale,rotation'); } catch {}
      restoreJourneyBoardCardBaseTransform(cardWrapper);
    }
    
    delete (cardWrapper as any)._interimBounceActive;
    delete (cardWrapper as any)._interimBounceStartedAt;
  }

  private isInterimBounceTimelineHealthy(cardWrapper: HTMLElement, card: HTMLElement): boolean {
    const bounceTimeline = (cardWrapper as any)._interimBounceTimeline;
    if (!bounceTimeline || (bounceTimeline as any)._killed) return false;
    try {
      if (typeof bounceTimeline.paused === 'function' && bounceTimeline.paused()) return false;
      if (typeof bounceTimeline.timeScale === 'function' && bounceTimeline.timeScale() === 0) return false;
    } catch {}

    try {
      if (typeof gsap !== 'undefined' && gsap.isTweening(card)) return true;
    } catch {}

    // During repeatDelay there may be no active tween, so a valid timeline is enough
    // unless smoke health says it is stale.
    return true;
  }

  private isActiveBoardAreaEnterOwned(): boolean {
    return isJourneyInterimIdleOwnedByEnter({
      activeEnter: this.activeBoardAreaEnterInProgress,
      pendingEnter: (window as any).__ccJourneyActiveAreaEnterPending === true,
      connectedPreparedTargets: this.activeBoardAreaEnterPreparedTargets.filter(
        (target) => target && document.body.contains(target)
      ).length,
    });
  }

  private getCurrentJourneyInterimCard(): HTMLElement | null {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    if (!container || container.dataset.journeyV700View !== 'world') return null;
    return container.querySelector('.journey-board-card.interim') as HTMLElement | null;
  }

  private scheduleInterimIdleEffectsRetry(reason: string, delayMs: number, beforeRun?: () => void): void {
    this.trackTimeout(() => {
      beforeRun?.();
      this.startVisibleInterimCardIdleEffects(document);
    }, delayMs);
    logger.info('🧪 JourneyInterimFX idle-retry-scheduled', { reason, delayMs });
  }

  private startVisibleInterimCardIdleEffects(root: ParentNode = document): void {
    if (!ENABLE_INTERIM_CARD_IDLE_EFFECTS || this.renderDisposed) return;
    if (this.isActiveBoardAreaEnterOwned()) {
      logger.info('🧪 JourneyInterimFX idle-start-deferred-active-enter', {
        activeBoardId: this.getLastActiveJourneyBoardAreaId(),
        preparedTargets: this.activeBoardAreaEnterPreparedTargets.filter((target) => target && document.body.contains(target)).length,
        activeBoardAreaEnterInProgress: this.activeBoardAreaEnterInProgress,
        managerPhase: this.journeyV700Phase,
        worldPhase: this.journeyWorldAnimation.getPhase(),
      });
      return;
    }

    try {
      const interimCards = root.querySelectorAll('.journey-board-card.interim') as NodeListOf<HTMLElement>;
      interimCards.forEach((interimCard) => {
        const cardWrapper = interimCard.closest('.journey-board-card-wrapper') as HTMLElement | null;
        if (!cardWrapper || !document.body.contains(cardWrapper)) return;
        const worldPhase = this.journeyWorldAnimation.getPhase();
        const transitionOwnsCard =
          this.journeyToGameExitActive ||
          this.journeyV700Phase === 'entering' ||
          this.journeyV700Phase === 'exiting' ||
          worldPhase === 'entering' ||
          worldPhase === 'exiting' ||
          (cardWrapper as any).__ccJourneyToGameExitTween ||
          (cardWrapper as any).__ccJourneyCardTapExitActive ||
          (interimCard as any)._openingGame;
        if (transitionOwnsCard) return;

        const wrapperStyle = window.getComputedStyle(cardWrapper);
        const wrapperOpacity = Number(wrapperStyle.opacity || cardWrapper.style.opacity || '1');
        const wrapperScale = Number(gsap.getProperty(cardWrapper, 'scale'));
        const hasHiddenResidue = shouldRestoreJourneyInterimWrapperForIdle({
          opacity: wrapperOpacity,
          scale: wrapperScale,
          visibility: wrapperStyle.visibility,
        });
        if (hasHiddenResidue) {
          logger.warn('🧪 JourneyInterimFX restoring hidden wrapper before idle', {
            boardId: interimCard.dataset.boardId,
            opacity: wrapperOpacity,
            scale: wrapperScale,
            visibility: wrapperStyle.visibility,
            managerPhase: this.journeyV700Phase,
            worldPhase,
          });
          try { gsap.killTweensOf(cardWrapper); } catch {}
          this.restoreJourneyBoardCardWrapperVisibility(cardWrapper);
          this.restoreJourneyBoardCardVisualTarget(cardWrapper);
        }
        if ((cardWrapper as any)._interimBounceActive) {
          if (this.isInterimBounceTimelineHealthy(cardWrapper, interimCard)) return;
          logger.warn('⚠️ Interim bounce flag was stale; restarting bounce/smoke loop');
          this.stopInterimBounce(interimCard);
        }
        this.startInterimBounce(interimCard);
      });
    } catch (error) {
      logger.warn('⚠️ Failed to start visible interim idle effects:', error);
    }
  }

  /** Own the complete interim idle lifecycle without recurring class resets/reflows. */
  private startInterimCardIdleEffects(): void {
    if (!ENABLE_INTERIM_CARD_IDLE_EFFECTS) {
      this.stopInterimCardIdleEffects();
      try { JOURNEY_CARD_IDLE_BOUNCE?.cleanupSmokeEffects?.(); } catch {}
      return;
    }

    this.startVisibleInterimCardIdleEffects(document);
    const interimCard = this.getCurrentJourneyInterimCard();
    if (!interimCard || this.renderDisposed) return;
    const cardWrapper = interimCard.closest('.journey-board-card-wrapper') as HTMLElement | null;

    if (this.interimIdleEffectsCard && this.interimIdleEffectsCard !== interimCard) {
      this.interimIdleEffectsCard.classList.remove('interim-idle-effects-active');
      this.interimIdleEffectsCard.closest('.journey-board-card-wrapper')?.classList.remove('interim-idle-effects-active');
    }
    interimCard.classList.add('interim-idle-effects-active');
    cardWrapper?.classList.add('interim-idle-effects-active');
    this.interimIdleEffectsCard = interimCard;
    logger.info('✅ Interim idle session active', {
      boardId: interimCard.dataset.boardId || null,
      frameTickerCount: this.journeyAreaIdleTicker ? 1 : 0,
      idleAreaCount: this.journeyAreaIdleEntries.length,
    });
  }
  
  /** Stop the complete DOM-bound interim idle session. */
  public stopInterimCardIdleEffects(): void {
    const interimCards = document.querySelectorAll('.journey-board-card.interim');
    interimCards.forEach(card => {
      this.stopInterimBounce(card as HTMLElement);
      (card as HTMLElement).classList.remove('interim-idle-effects-active');
      (card as HTMLElement).closest('.journey-board-card-wrapper')?.classList.remove('interim-idle-effects-active');
    });
    this.interimIdleEffectsCard = null;
    try { JOURNEY_CARD_IDLE_BOUNCE?.cleanupSmokeEffects?.(); } catch {}
  }

  public resumeInterimCardIdleEffects(reason = 'resume'): void {
    if (!ENABLE_INTERIM_CARD_IDLE_EFFECTS || this.renderDisposed) return;

    try {
      this.startVisibleInterimCardIdleEffects(document);
      this.startInterimCardIdleEffects();
      [0, 180].forEach((delayMs) => {
        if (delayMs === 0) {
          requestAnimationFrame(() => {
            if (this.renderDisposed) return;
            this.startVisibleInterimCardIdleEffects(document);
          });
          return;
        }
        this.scheduleInterimIdleEffectsRetry(`${reason}:${delayMs}`, delayMs);
      });
      logger.info('✅ Resumed interim card idle effects', { reason });
    } catch (error) {
      logger.warn('⚠️ Failed to resume interim card idle effects:', error);
    }
  }

  /**
   * Clean up journey board elements when screen is hidden
   */
  public cleanup(): void {
    if (this.cleanupInProgress) return;
    this.cleanupInProgress = true;
    this.renderDisposed = true;
    try {
    journeySpatialMotion.deactivate();
    this.cancelJourneyV700HubEnter('cleanup');
    this.activeBoardAreaEnterInProgress = false;
    this.activeBoardAreaEnterPreparedTargets = [];
    this.releaseJourneyV700HubTopGuard('cleanup');
    
    // 🔥 MEMORY LEAK FIX: Cancel all tracked RAF calls
    this.cancelAllRAFs();
    this.cancelAllTimeouts();
    this.journeyWorldAnimation.stop(true);
    this.cleanupJourneyAreaIdleAnimations();
    this.cleanupDetailModalRuntimeState();
    this.cleanupJourneyScreenElasticOverscroll();
    
    this.stopInterimCardIdleEffects();
    
    // 🔥 MEMORY FIX: Ensure all interim bounce animations are stopped
    // Double-check cards that may have detached during the owner cleanup.
    const allInterimCards = document.querySelectorAll('.journey-board-card.interim');
    allInterimCards.forEach(card => {
      this.stopInterimBounce(card as HTMLElement);
      // Kill any remaining GSAP animations on card wrapper
      const cardWrapper = (card as HTMLElement).closest('.journey-board-card-wrapper') as HTMLElement | null;
      if (
        cardWrapper &&
        typeof gsap !== 'undefined' &&
        !this.journeyToGameExitActive &&
        !(cardWrapper as any).__ccJourneyToGameExitTween
      ) {
        gsap.killTweensOf(cardWrapper);
      }
    });
    
    // Remove interaction listeners
    const scrollable = document.querySelector('.collectibles-scrollable') as HTMLElement;
    if (scrollable && (scrollable as any)._journeyIdleScrollHandler) {
      scrollable.removeEventListener('scroll', (scrollable as any)._journeyIdleScrollHandler);
      (scrollable as any)._journeyIdleScrollHandler = null;
      scrollable.classList.remove('journey-scroll-active');
      if ((scrollable as any)._journeyScrollActiveTimeout) {
        window.clearTimeout((scrollable as any)._journeyScrollActiveTimeout);
        (scrollable as any)._journeyScrollActiveTimeout = null;
      }
      if ((scrollable as any)._journeyViewportCheckTimer) {
        window.clearTimeout((scrollable as any)._journeyViewportCheckTimer);
        (scrollable as any)._journeyViewportCheckTimer = null;
      }
    }
    
    const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement;
    if (cardsContainer && (cardsContainer as any)._journeyIdleTouchHandler) {
      cardsContainer.removeEventListener('touchstart', (cardsContainer as any)._journeyIdleTouchHandler);
      cardsContainer.removeEventListener('touchmove', (cardsContainer as any)._journeyIdleTouchHandler);
      (cardsContainer as any)._journeyIdleTouchHandler = null;
    }
    
    // Stop idle bounce animations
    if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
      try {
        JOURNEY_CARD_IDLE_BOUNCE.stop();
        logger.info('✅ Journey card idle bounce stopped in cleanup');
      } catch (e) {
        logger.warn('⚠️ Error stopping journey card idle bounce:', e instanceof Error ? e.message : String(e));
      }
    }

    // 🔥 FAIL-SAFE: Restore touch-action even if idle bounce cleanup missed it
    try {
      const body = document.body;
      const html = document.documentElement;
      if ((body as any)._originalTouchAction !== undefined) {
        body.style.touchAction = (body as any)._originalTouchAction;
        delete (body as any)._originalTouchAction;
      } else {
        body.style.touchAction = '';
      }
      if ((html as any)._originalTouchAction !== undefined) {
        html.style.touchAction = (html as any)._originalTouchAction;
        delete (html as any)._originalTouchAction;
      } else {
        html.style.touchAction = '';
      }
    } catch (e) {
      logger.warn('⚠️ Failed to restore touch-action in Journey cleanup:', e instanceof Error ? e.message : String(e));
    }
    
    // 🔥 APP STORE FIX: Kill all GSAP animations on Journey cards and smoke particles
    const journeyScreen = document.getElementById('journey-screen');
    if (journeyScreen) {
      const cards = journeyScreen.querySelectorAll('.collectible-card-wrapper');
      const smokeParticles = journeyScreen.querySelectorAll('.smoke-particle');
      const interimCards = journeyScreen.querySelectorAll('.journey-board-card.interim');
      
      // 🔥 MEMORY FIX: Cleanup smoke containers (they don't have .smoke-particle class)
      // Smoke containers are tracked in JOURNEY_CARD_IDLE_BOUNCE state, but we also need to
      // cleanup any that might be in DOM from interim card bounce animations
      const cardsContainer = journeyScreen.querySelector('.journey-cards-container');
      if (cardsContainer) {
        try { JOURNEY_CARD_IDLE_BOUNCE?.cleanupSmokeEffects?.(); } catch {}
      }
      
      // Kill card animations
      cards.forEach(card => {
        if (typeof gsap !== 'undefined') {
          gsap.killTweensOf(card);
        }
      });
      
      // 🔥 USER REQUEST: Stop shimmer animations on interim cards
      interimCards.forEach(card => {
        const cardElement = card as HTMLElement;
        // Stop CSS animation by removing animation property
        if (cardElement.style) {
          cardElement.style.animation = 'none';
        }
        // Kill any GSAP animations on card wrapper
        const cardWrapper = cardElement.closest('.journey-board-card-wrapper') as HTMLElement | null;
        if (
          cardWrapper &&
          typeof gsap !== 'undefined' &&
          !this.journeyToGameExitActive &&
          !(cardWrapper as any).__ccJourneyToGameExitTween
        ) {
          gsap.killTweensOf(cardWrapper);
        }
        // Remove ::after pseudo-element animation by removing class or setting animation to none
        // Note: CSS animations stop automatically when element is removed from DOM
      });
      
      // Kill smoke particle animations (if any remain)
      smokeParticles.forEach(particle => {
        if (typeof gsap !== 'undefined') {
          gsap.killTweensOf(particle);
        }
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });

      // A hidden Journey tree must not retain compositor layers or async GSAP work while
      // Pixi gameplay is active. Clean every descendant, including world-specific art
      // that is not covered by the legacy card/smoke selectors above.
      const journeyDescendants = Array.from(journeyScreen.querySelectorAll<HTMLElement>('*'));
      if (typeof gsap !== 'undefined' && journeyDescendants.length > 0) {
        try { gsap.killTweensOf(journeyDescendants); } catch {}
      }
      journeyDescendants.forEach((element) => {
        element.style.removeProperty('will-change');
      });
      
      logger.info(`✅ Killed GSAP tweens for ${cards.length} cards, stopped shimmer on ${interimCards.length} interim cards, and removed ${smokeParticles.length} smoke particles`);
    }
    
    // Remove background and cards containers from journey screen
    if (journeyScreen) {
      const bgContainer = journeyScreen.querySelector('.journey-bg-container');
      const decorContainer = journeyScreen.querySelector('.journey-decor-container');
      const cardsContainer = journeyScreen.querySelector('.journey-cards-container');
      
      // 🔥 USER REQUEST: Stop shimmer animations before removing containers
      if (cardsContainer) {
        const interimCards = cardsContainer.querySelectorAll('.journey-board-card.interim');
        interimCards.forEach(card => {
          const cardElement = card as HTMLElement;
          // Stop CSS animation by setting animation to none
          cardElement.style.animation = 'none';
          // Also stop ::after pseudo-element animation by removing class temporarily
          // (CSS animations stop automatically when element is removed from DOM)
        });
      }
      
      if (bgContainer && bgContainer.parentNode) {
        bgContainer.parentNode.removeChild(bgContainer);
      }
      if (decorContainer && decorContainer.parentNode) {
        decorContainer.parentNode.removeChild(decorContainer);
      }
      if (cardsContainer && cardsContainer.parentNode) {
        cardsContainer.parentNode.removeChild(cardsContainer);
      }

      const journeyBoardsContainer = journeyScreen.querySelector('#journey-boards-container') as HTMLElement | null;
      if (journeyBoardsContainer) {
        journeyBoardsContainer.replaceChildren();
      }
    }
    
    // Also check body (fallback cleanup)
    const bgFromBody = document.body.querySelector('.journey-bg-container');
    const decorFromBody = document.body.querySelector('.journey-decor-container');
    const cardsFromBody = document.body.querySelector('.journey-cards-container');
    
    if (bgFromBody && bgFromBody.parentNode) {
      bgFromBody.parentNode.removeChild(bgFromBody);
    }
    if (decorFromBody && decorFromBody.parentNode) {
      decorFromBody.parentNode.removeChild(decorFromBody);
    }
    if (cardsFromBody && cardsFromBody.parentNode) {
      cardsFromBody.parentNode.removeChild(cardsFromBody);
    }

    // Remove any open card picker overlay to avoid leaking DOM/listeners
    const overlay = document.querySelector('.card-picker-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    } finally {
      this.cleanupInProgress = false;
    }
  }

  private initializeBoards(): void {
    this.boards = Array.from({ length: JOURNEY_MAX_BOARDS }, (_, index) => {
      const boardNumber = index + 1;
      return {
        id: boardNumber,
        unlocked: false,
        interim: boardNumber === 1 || boardNumber === 11 || boardNumber === 21,
        imagePath: this.getBoardImagePath(boardNumber),
        name: this.getBoardName(boardNumber),
      };
    });
  }

  private getBoardImagePath(boardNumber: number): string {
    if (boardNumber === 1) {
      return `${FOREST_WORLD_ASSET_BASE}/cards/forest-1.png`;
    }

    if (boardNumber >= 21 && boardNumber <= 30) {
      const mirroredBoardNumber = boardNumber - 20;
      if (mirroredBoardNumber === 1) {
        return `${FOREST_WORLD_ASSET_BASE}/cards/forest-1.png`;
      }

      return `./assets/colelctibles/common/${mirroredBoardNumber.toString().padStart(2, '0')}.png`;
    }

    // Use existing collectible images for unlocked boards
    // Map board numbers to collectible image paths (01.png, 02.png, etc.)
    const paddedNumber = boardNumber.toString().padStart(2, '0');
    return `./assets/colelctibles/common/${paddedNumber}.png`;
  }

  private getLockedBoardImagePath(_boardNumber: number): string | null {
    return null;
  }

  private getBoardName(boardNumber: number): string {
    const names = [
      'FIRST DAY',
      'SO SPECIAL',
      'ALL STAR',
      'FLYING UP',
      'PLANNER',
      'STACKMAN',
      'PEACEFUL',
      'CRUMBLER',
      'BIG BANG',
      'CUBERO',
      'PEAKABOO',
      'COOL DICE',
      'BEST PLAY',
      'HURRICANE',
      'LEGACY',
      'RUMBLE',
      'SHORELINE',
      'SUN SPLASH',
      'TIDE TURN',
      'CASTAWAY',
      'AREA 55',
      'CRATER RUN',
      'BEAMLINE',
      'MARS METAL',
      'LASER LIFT',
      'DUST SIGNAL',
      'AREA 55 RIFT',
      'ALIEN ARC',
      'ORBIT OUT',
      'FINAL SIGNAL',
    ];
    return names[boardNumber - 1] || formatGameplayProgressLabel('journey', boardNumber);
  }

  /** Scrolls only an unfinished world screen to its active interim card. */
  private restoreOrScrollToInterimCard(): void {
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement;
      if (!scrollable) {
        logger.warn('⚠️ Scrollable container not found');
        return;
      }

      const scrollTarget = this.getPreferredJourneyWorldScrollTarget();
      if (!scrollTarget) {
        logger.info('🗺️ No Journey world scroll target found - skipping scroll');
        return;
      }
      const { cardWrapper, boardId, reason, worldId } = scrollTarget;

      // Čekaj da se layout stabilizira
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Provjeri je li kartica u viewportu
          const viewportH = window.innerHeight;
          const cardRect = cardWrapper.getBoundingClientRect();
          
          // Jednostavna provjera: je li kartica vidljiva na ekranu?
          const cardTop = cardRect.top;
          const cardBottom = cardRect.bottom;
          const isCardVisible = cardTop < viewportH && cardBottom > 0;
          
          // Provjeri je li kartica u "razumnom" dijelu viewporta (ne samo rub ekrana)
          // Kartica treba biti barem 50% u viewportu da se smatra "u vidokrugu"
          const cardHeight = cardRect.height;
          const visibleTop = Math.max(0, cardTop);
          const visibleBottom = Math.min(viewportH, cardBottom);
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const visibilityRatio = visibleHeight / cardHeight;
          const isReasonablyVisible = visibilityRatio > 0.5; // Barem 50% kartice je vidljivo
          
          if (isCardVisible && isReasonablyVisible) {
            // Kartica JE u viewportu → NE radi scroll
            logger.info(`🗺️ Journey target board ${boardId} is in viewport (${(visibilityRatio * 100).toFixed(0)}% visible) - no scroll needed`, {
              worldId,
              reason,
            });
            
            // Osiguraj da je scroll enabled
            scrollable.style.touchAction = 'pan-y';
            scrollable.style.pointerEvents = '';
            return;
          }
          
          logger.info(`🗺️ Journey target board ${boardId} NOT in viewport (${(visibilityRatio * 100).toFixed(0)}% visible) - will scroll to it`, {
            worldId,
            reason,
          });
          this.scrollToInterimCard(boardId);
        });
      });
    } catch (error) {
      logger.warn('⚠️ Failed to check Journey world scroll target viewport:', error instanceof Error ? error.message : String(error));
      this.scrollToInterimCard();
    }
  }

  private getPreferredJourneyWorldScrollTarget(): {
    card: HTMLElement;
    cardWrapper: HTMLElement;
    boardId: number;
    worldId: number | null;
    reason: string;
  } | null {
    const getCardTarget = (boardId: number, reason: string, worldId: number | null) => {
      const card = document.querySelector(`.journey-board-card[data-board-id="${boardId}"]`) as HTMLElement | null;
      const cardWrapper = card?.closest('.journey-board-card-wrapper') as HTMLElement | null;
      return card && cardWrapper
        ? { card, cardWrapper, boardId, worldId, reason }
        : null;
    };

    if (this.journeyV700View !== 'world' || !this.journeyV700WorldId) return null;

    const worldId = this.journeyV700WorldId;
    const range = this.getJourneyWorldRange(worldId);
    if (!range) return null;

    const interimInWorld = this.boards.find((board) => (
      board.id >= range.start &&
      board.id <= range.end &&
      board.interim === true
    ));
    return interimInWorld
      ? getCardTarget(interimInWorld.id, 'world-interim', worldId)
      : null;
  }

  /**
   * 🔥 USER REQUEST: Precise scroll to interim card with "zaletava" animation
   * Exact specification: anticipation → main travel → overshoot + settle
   * Card must be perfectly centered in viewport (50% width, 50% height)
   */
  private scrollToInterimCard(preferredBoardId?: number): void {
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement;
      if (!scrollable) {
        logger.warn('⚠️ Scrollable container not found for interim card scroll');
        return;
      }

      const scrollTarget = preferredBoardId
        ? (() => {
            const card = document.querySelector(`.journey-board-card[data-board-id="${preferredBoardId}"]`) as HTMLElement | null;
            const cardWrapper = card?.closest('.journey-board-card-wrapper') as HTMLElement | null;
            return card && cardWrapper
              ? {
                  card,
                  cardWrapper,
                  boardId: preferredBoardId,
                  worldId: this.getJourneyWorldIdForBoard(preferredBoardId),
                  reason: 'preferred-board',
                }
              : null;
          })()
        : this.getPreferredJourneyWorldScrollTarget();
      if (!scrollTarget) {
        logger.info('🗺️ No Journey world scroll target found - skipping scroll');
        return;
      }
      const { cardWrapper, boardId, worldId, reason } = scrollTarget;

      // Wait for layout to settle and ensure screen is fully visible
      // Use multiple RAF calls to ensure DOM is ready and screen enter animation has started
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Get viewport dimensions
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;
            const viewportCenterX = viewportW / 2;
            const viewportCenterY = viewportH / 2;
            
            // Get positions
            const scrollableRect = scrollable.getBoundingClientRect();
            const cardRect = cardWrapper.getBoundingClientRect();
            
            // 🔥 USER REQUEST: Check if card is actually visible (not hidden by screen animation)
            // If card rect is empty or invalid, wait a bit more
            if (cardRect.width === 0 || cardRect.height === 0) {
              // 🔥 FIX: Add retry limit to prevent infinite recursion
              const retryCount = (this as any)._scrollRetryCount || 0;
              const MAX_RETRIES = 10; // Maximum 10 retries (2 seconds total)
              
              if (retryCount >= MAX_RETRIES) {
                logger.warn('⚠️ Max scroll retries reached, giving up');
                (this as any)._scrollRetryCount = 0;
                return;
              }
              
              logger.warn(`⚠️ Journey target board ${boardId} not yet visible, retrying scroll in 200ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
              (this as any)._scrollRetryCount = retryCount + 1;
              setTimeout(() => {
                this.scrollToInterimCard(boardId);
              }, 200);
              return;
            }
            
            // 🔥 FIX: Reset retry counter on success
            (this as any)._scrollRetryCount = 0;
            
            // 🔥 JEDNOSTAVNO: Uvijek izračunaj scroll distance i odradi animaciju
            // Nema više skipova - svaki poziv scrollToInterimCard() će pokrenuti animaciju do centra
            
            // Izračunaj finalnu scroll poziciju da kartica bude centrirana u viewportu
            const cardTopContent = cardRect.top - scrollableRect.top + scrollable.scrollTop;
            const cardCenterYContent = cardTopContent + cardRect.height / 2;
            const finalScrollY = cardCenterYContent - viewportCenterY;
            
            // Clamp to content bounds
            const contentHeight = scrollable.scrollHeight;
            const finalScrollPosition = Math.max(0, Math.min(finalScrollY, contentHeight - scrollable.clientHeight));
            
            // Get current scroll position
            const startScrollPosition = scrollable.scrollTop;
            
            // Calculate scroll distance
            const scrollDistance = finalScrollPosition - startScrollPosition;
            
            // Scroll distance je >= 20px, pokreni animaciju
            logger.info(`🎁 Starting scroll animation to Journey board ${boardId}. From: ${startScrollPosition}, To: ${finalScrollPosition}, Distance: ${scrollDistance}`, {
              worldId,
              reason,
            });
          
          // Kill any existing scroll animations
          gsap.killTweensOf(scrollable, 'scrollTop');
          gsap.killTweensOf(cardWrapper, 'scale');
          
          // Disable user scroll during animation
          const originalTouchAction = scrollable.style.touchAction || '';
          const originalPointerEvents = scrollable.style.pointerEvents || '';
          scrollable.style.touchAction = 'none';
          scrollable.style.pointerEvents = 'none';
          
          // Calculate deltas
          const anticipationDelta = Math.max(-80, Math.min(-40, scrollDistance * 0.06)); // 4-8% or 40-80px
          const overshootDelta = Math.max(12, Math.min(24, Math.abs(scrollDistance) * 0.015)); // 1-2% or 12-24px
          
          // Timeline with 3 phases
          const tl = trackTimeline({
            onComplete: () => {
              // Hard correction: ensure exact final position
              scrollable.scrollTop = finalScrollPosition;
              
              // Verify position is correct
              requestAnimationFrame(() => {
                const finalCardRect = cardWrapper.getBoundingClientRect();
                const finalCardCenterY = finalCardRect.top + finalCardRect.height / 2;
                const error = Math.abs(finalCardCenterY - viewportCenterY);
                
                if (error > 1) {
                  logger.warn(`⚠️ Position error: ${error}px, correcting...`);
                  scrollable.scrollTop = finalScrollPosition;
                }
                
                // 🔥 CRITICAL FIX: Re-enable user scroll - ensure it's always enabled
                scrollable.style.touchAction = 'pan-y'; // Always use pan-y for vertical scrolling
                scrollable.style.pointerEvents = originalPointerEvents || '';
                
                // 🔥 CRITICAL FIX: Ensure scroll is not blocked by any other styles
                if (scrollable.style.overflow === 'hidden') {
                  scrollable.style.overflow = 'auto';
                }
                if (scrollable.style.overflowY === 'hidden') {
                  scrollable.style.overflowY = 'auto';
                }
                
                // 🔥 CRITICAL FIX: Force enable scrolling by removing any inline styles that might block it
                scrollable.style.userSelect = ''; // Allow text selection (doesn't block scroll but good practice)
                
                // 🔥 CRITICAL FIX: Verify scroll is enabled after a short delay
                setTimeout(() => {
                  const computedTouchAction = window.getComputedStyle(scrollable).touchAction;
                  if (computedTouchAction === 'none' || computedTouchAction === 'auto') {
                    logger.warn(`⚠️ Scroll touchAction is ${computedTouchAction}, forcing pan-y`);
                    scrollable.style.touchAction = 'pan-y';
                  }
                  const computedPointerEvents = window.getComputedStyle(scrollable).pointerEvents;
                  if (computedPointerEvents === 'none') {
                    logger.warn(`⚠️ Scroll pointerEvents is none, enabling`);
                    scrollable.style.pointerEvents = '';
                  }
                }, 50);
                logger.info('✅ Scroll to Journey world target animation completed', {
                  boardId,
                  worldId,
                  reason,
                });
              });
            }
          });
          
          // Phase 1: Anticipation (0.20s) - move slightly opposite direction
          // Increased to 0.20s with 4-8% pullback
          const anticipationPosition = startScrollPosition + anticipationDelta;
          const anticipationDuration = 0.20;
          tl.to(scrollable, {
            scrollTop: anticipationPosition,
            duration: anticipationDuration,
            ease: 'power2.out' // easeOutQuad
          });
          
          // Phase 2: Main travel (1.19s) - fast accelerate then smooth decelerate
          // Slowed down by 40%: 0.85s × 1.4 = 1.19s
          const overshootPosition = finalScrollPosition + overshootDelta;
          const mainTravelDuration = 1.19; // 0.85s × 1.4
          tl.to(scrollable, {
            scrollTop: overshootPosition,
            duration: mainTravelDuration,
            ease: 'power2.inOut' // easeInOutCubic
          });
          
          // Phase 3: Settle (0.42s) - come back and stop perfectly centered
          // Slowed down by 40%: 0.30s × 1.4 = 0.42s
          const settleDuration = 0.42; // 0.30s × 1.4
          tl.to(scrollable, {
            scrollTop: finalScrollPosition,
            duration: settleDuration,
            ease: 'power2.out' // easeOutCubic (or easeOutBack with low overshoot)
          });
          
          // Extra polish: Scale-up card during last 35% of main travel
          // Scale: 1.00 → 1.06 → 1.04
          // Start at 65% of main travel (last 35%)
          const scaleStartTime = anticipationDuration + (mainTravelDuration * 0.65);
          const scaleEndTime = anticipationDuration + mainTravelDuration;
          
          // Ensure card starts at scale 1.0
          gsap.set(cardWrapper, { scale: 1.0 });
          
          tl.to(cardWrapper, {
            scale: 1.06,
            duration: (scaleEndTime - scaleStartTime),
            ease: 'power2.out'
          }, scaleStartTime);
          
          tl.to(cardWrapper, {
            scale: 1.04,
            duration: settleDuration, // Use same duration as settle phase
            ease: 'power2.out'
          }, scaleEndTime);
          });
        });
      });
    } catch (error) {
      logger.warn('⚠️ Failed to scroll to Journey world target:', error instanceof Error ? error.message : String(error));
    }
  }

  public renderBoards(): void {
    const container = document.getElementById('journey-boards-container');
    const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
    const transitionOverlay = document.getElementById('cc-board-transition-overlay') as HTMLElement | null;
    const transitionOverlayVisible = !!transitionOverlay &&
      getComputedStyle(transitionOverlay).display !== 'none' &&
      getComputedStyle(transitionOverlay).visibility !== 'hidden';
    const journeyScreenHidden = !journeyScreen ||
      journeyScreen.hidden ||
      journeyScreen.classList.contains('hidden') ||
      getComputedStyle(journeyScreen).display === 'none';

    if (shouldBlockHiddenJourneyRender(journeyScreenHidden, transitionOverlayVisible)) {
      logger.info('⏭️ Blocked hidden Journey render during board transition');
      return;
    }
    
    // 🔥 USER REQUEST: Ensure all locked cards have 100% opacity after rendering
    // This fixes any locked cards that might have opacity < 100%
    this.trackTimeout(() => {
      const lockedCards = container?.querySelectorAll('.journey-board-card.locked') as NodeListOf<HTMLElement>;
      if (lockedCards) {
        lockedCards.forEach((card) => {
          const currentOpacity = window.getComputedStyle(card).opacity;
          const opacityValue = parseFloat(currentOpacity);
          if (isNaN(opacityValue) || opacityValue < 1.0) {
            card.style.opacity = '1';
            const boardId = card.getAttribute('data-board-id') || 'unknown';
            logger.debug(`✅ Set locked card ${boardId} opacity to 100% (was ${currentOpacity})`);
          }
        });
      }
    }, 100); // Small delay to ensure cards are rendered
    if (!container) {
      logger.warn('⚠️ Journey boards container not found');
      return;
    }
    
    // End the previous DOM-bound idle session before replacing Journey nodes.
    if (this.interimIdleEffectsCard) this.stopInterimCardIdleEffects();

    this.container = container;
    this.renderDisposed = false;
    journeySpatialMotion.deactivate();
    this.cancelJourneyV700HubEnter('render-before-dom-replace');
    this.resetJourneyBoardVisualResidue('renderBoards-before-dom-replace');
    try {
      const staleHubTargets = Array.from(container.querySelectorAll<HTMLElement>(
        '.journey-v700-hub-cloud-layer, .journey-v700-hub-cloud, .journey-v700-world-card'
      ));
      if (staleHubTargets.length) {
        gsap.killTweensOf(staleHubTargets);
        gsap.set(staleHubTargets, { clearProps: 'transform,opacity,visibility,willChange' });
      }
    } catch (error) {
      logger.warn('⚠️ Failed to cleanup stale Journey hub animation targets:', error);
    }
    
    // 🔥 CRITICAL FIX: Clean up previous observer if exists
    if ((container as any)._positionObserver) {
      try {
        (container as any)._positionObserver.disconnect();
        (container as any)._positionObserver = null;
      } catch (e) {
        logger.warn('⚠️ Failed to disconnect previous position observer:', e);
      }
    }
    
    container.innerHTML = '';
    
    // 🔥 APP STORE FIX: Clean up previous fixed-positioned elements from body
    // Remove any existing background or cards containers from previous renders
    const existingBg = document.querySelector('.journey-bg-container');
    const existingDecor = document.querySelector('.journey-decor-container');
    const existingCards = document.querySelector('.journey-cards-container');
    if (existingBg && existingBg.parentNode) {
      existingBg.parentNode.removeChild(existingBg);
    }
    if (existingDecor && existingDecor.parentNode) {
      existingDecor.parentNode.removeChild(existingDecor);
    }
    if (existingCards && existingCards.parentNode) {
      existingCards.parentNode.removeChild(existingCards);
    }
    
    // Initialize journey debug buttons
    this.initJourneyButtons();

	    if (this.journeyV700View !== 'world' || !this.journeyV700WorldId) {
	      this.renderJourneyV700Hub(container);
	      this.installJourneyScreenElasticOverscroll(container);
	      return;
	    }

    // 🔥 APP STORE FIX: Use FIXED viewport-based positioning - NO dynamic calculations
    // Background and cards use position: fixed with viewport units (vw/vh)
    // This ensures identical positions on ALL devices (iPhone 13, 14, 17, etc.)
	    this.renderBoardsFixed(container);
	    this.applyJourneyV700WorldScope(container, this.journeyV700WorldId);
	    this.installJourneyScreenElasticOverscroll(container);
	  }

  private setJourneyV700View(view: 'hub' | 'world', worldId: number | null = null): void {
    this.journeyV700View = view;
    this.journeyV700WorldId = view === 'world' && worldId ? worldId : null;
    try {
      localStorage.setItem(JOURNEY_V700_VIEW_STORAGE_KEY, view);
      if (this.journeyV700WorldId) {
        localStorage.setItem(JOURNEY_V700_WORLD_STORAGE_KEY, String(this.journeyV700WorldId));
        (window as any).__ccJourneyV700WorldId = this.journeyV700WorldId;
      } else {
        localStorage.removeItem(JOURNEY_V700_WORLD_STORAGE_KEY);
        delete (window as any).__ccJourneyV700WorldId;
      }
      (window as any).__ccJourneyV700View = view;
    } catch {}
  }

  private getJourneyV700FlowSnapshot(container?: HTMLElement | null): Record<string, unknown> {
    const journeyContainer = container || document.getElementById('journey-boards-container') as HTMLElement | null;
    const navHeader = document.querySelector('#journey-screen .collectibles-header') as HTMLElement | null;
    const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
    const targets = journeyContainer ? this.getJourneyV700WorldTargets(journeyContainer) : [];
    const visibleTargetCount = targets.filter((target) => {
      const rect = target.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && target.style.display !== 'none';
    }).length;

    return {
      view: this.journeyV700View,
      worldId: this.journeyV700WorldId,
      containerConnected: !!journeyContainer && document.body.contains(journeyContainer),
      containerView: journeyContainer?.dataset.journeyV700View || null,
      containerWorldId: journeyContainer?.dataset.journeyV700WorldId || null,
      closing: journeyContainer ? (journeyContainer as any).__ccJourneyV700Closing === true : false,
      navExists: !!navHeader,
      navOpacity: navHeader ? String(gsap.getProperty(navHeader, 'opacity')) : null,
      navTransform: navHeader ? window.getComputedStyle(navHeader).transform : null,
      scrollTop: scrollable?.scrollTop ?? null,
      visibleTargetCount,
      idleTickerCount: this.journeyAreaIdleTicker ? 1 : 0,
      idleAreaCount: this.journeyAreaIdleEntries.length,
      idlePaused: this.journeyAreaIdlePausedForInteraction,
    };
  }

  private logJourneyV700Flow(label: string, data: Record<string, unknown> = {}, container?: HTMLElement | null): void {
    try {
      logger.info('🧭 JourneyV700Flow', {
        label,
        t: Math.round(performance.now()),
        ...data,
        ...this.getJourneyV700FlowSnapshot(container),
      });
    } catch {}
  }

  private emitJourneyV700HubGeometryDiagnostic(event: string, container: HTMLElement): void {
    const nativeConsole = (window as any).webkit?.messageHandlers?.consoleLog;
    if (!nativeConsole?.postMessage || container.dataset.journeyV700View !== 'hub') return;
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
      const worlds = Array.from(container.querySelectorAll<HTMLElement>('.journey-v700-world-card')).map((card) => {
        const image = card.querySelector<HTMLElement>('.journey-v700-world-visual');
        const cardRect = card.getBoundingClientRect();
        const imageRect = image?.getBoundingClientRect();
        const cardStyle = getComputedStyle(card);
        const imageStyle = image ? getComputedStyle(image) : null;
        return {
          worldId: Number(card.dataset.worldId || 0),
          cardTop: Math.round(cardRect.top * 10) / 10,
          cardLeft: Math.round(cardRect.left * 10) / 10,
          cardTransform: cardStyle.transform,
          cardTranslate: cardStyle.translate,
          imageTop: imageRect ? Math.round(imageRect.top * 10) / 10 : null,
          imageLeft: imageRect ? Math.round(imageRect.left * 10) / 10 : null,
          imageTransform: imageStyle?.transform ?? null,
          imageTranslate: imageStyle?.translate ?? null,
          animationName: imageStyle?.animationName ?? null,
          animationDelay: imageStyle?.animationDelay ?? null,
          animationPlayState: imageStyle?.animationPlayState ?? null,
        };
      });
      emitIOSNativeDiagnostic(`hub-geometry-${event}`, {
        phase: this.journeyV700Phase,
        scrollTop: Math.round((scrollable?.scrollTop || 0) * 10) / 10,
        worlds,
      });
    } catch {}
  }

  private resetJourneyV700HubScrollToTop(reason: string): void {
    const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
    if (!scrollable) return;

    this.armJourneyV700HubTopGuard(scrollable, reason);
    try {
      localStorage.removeItem(JOURNEY_V700_HUB_SCROLL_STORAGE_KEY);
    } catch {}

    const apply = (phase: string) => {
      if (this.journeyV700View !== 'hub') return;
      try { gsap.killTweensOf(scrollable, 'scrollTop'); } catch {}
      scrollable.scrollTop = getJourneyHubEntryScrollTop();
      this.logJourneyV700Flow('hub-scroll-reset-top', {
        reason,
        phase,
        scrollTop: scrollable.scrollTop,
      });
      emitIOSNativeDiagnostic('hub-scroll-reset-top', {
        reason,
        phase,
        scrollTop: scrollable.scrollTop,
      });
    };

    apply('sync');
    this.trackRAF(() => {
      apply('raf-1');
      this.trackRAF(() => apply('raf-2'));
    });
    this.trackTimeout(() => apply('layout-settled'), 160);
  }

  private armJourneyV700HubTopGuard(scrollable: HTMLElement, reason: string): void {
    this.releaseJourneyV700HubTopGuard('replace');

    const onScroll = () => {
      if (this.journeyV700View !== 'hub') {
        this.releaseJourneyV700HubTopGuard('view-changed');
        return;
      }
      if (!shouldCorrectJourneyHubAutomaticScroll(this.journeyV700View, scrollable.scrollTop)) return;

      const attemptedScrollTop = scrollable.scrollTop;
      try { gsap.killTweensOf(scrollable, 'scrollTop'); } catch {}
      scrollable.scrollTop = getJourneyHubEntryScrollTop();
      emitIOSNativeDiagnostic('hub-scroll-auto-corrected', {
        reason,
        attemptedScrollTop,
        correctedScrollTop: scrollable.scrollTop,
      });
    };
    const onManualIntent = () => {
      this.releaseJourneyV700HubTopGuard('manual-input');
    };

    scrollable.addEventListener('scroll', onScroll, { passive: true });
    scrollable.addEventListener('pointerdown', onManualIntent, { passive: true });
    scrollable.addEventListener('touchstart', onManualIntent, { passive: true });
    scrollable.addEventListener('wheel', onManualIntent, { passive: true });
    this.journeyV700HubTopGuard = { scrollable, onScroll, onManualIntent };
    emitIOSNativeDiagnostic('hub-scroll-top-guard-armed', {
      reason,
      scrollTop: scrollable.scrollTop,
    });
  }

  private releaseJourneyV700HubTopGuard(reason: string): void {
    const guard = this.journeyV700HubTopGuard;
    if (!guard) return;

    this.journeyV700HubTopGuard = null;
    guard.scrollable.removeEventListener('scroll', guard.onScroll);
    guard.scrollable.removeEventListener('pointerdown', guard.onManualIntent);
    guard.scrollable.removeEventListener('touchstart', guard.onManualIntent);
    guard.scrollable.removeEventListener('wheel', guard.onManualIntent);
    emitIOSNativeDiagnostic('hub-scroll-top-guard-released', {
      reason,
      scrollTop: guard.scrollable.scrollTop,
    });
  }

  private renderJourneyV700Hub(container: HTMLElement): void {
    this.journeyV700Phase = 'entering';
    this.setJourneyV700View('hub');
    this.updateJourneyV700Nav('hub');
    container.dataset.journeyV700View = 'hub';
    container.style.height = '100%';
    container.style.minHeight = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'visible';

    const highestUnlocked = this.boards.reduce((max, board) => board.unlocked || board.interim ? Math.max(max, board.id) : max, 1);
    const activeWorldId = this.getJourneyWorldIdForBoard(highestUnlocked) || 1;
    this.logJourneyV700Flow('hub-render-start', { highestUnlocked, activeWorldId }, container);

    const hub = document.createElement('div');
    hub.className = 'journey-v700-hub';
    hub.setAttribute('aria-label', 'Journey worlds');

    const hubCloudLayer = document.createElement('div');
    hubCloudLayer.className = 'journey-v700-hub-cloud-layer';
    hubCloudLayer.setAttribute('aria-hidden', 'true');
    JOURNEY_V700_HUB_CLOUDS.forEach((cloudSpec, cloudIndex) => {
      const cloudWorldId = cloudSpec.worldId ?? (cloudSpec.y < 220 ? 1 : cloudSpec.y < 560 ? 2 : 3);
      const cloudLocked = cloudWorldId > activeWorldId;
      const cloud = document.createElement('img');
      cloud.src = cloudSpec.src;
      cloud.alt = '';
      cloud.draggable = false;
      cloud.setAttribute('aria-hidden', 'true');
      cloud.className = `journey-v700-world-cloud journey-v700-hub-cloud journey-v700-hub-cloud-${cloudIndex + 1}${cloudLocked ? ' is-locked' : ''}`;
      cloud.dataset.worldId = String(cloudWorldId);
      cloud.style.setProperty('--cloud-x', `${cloudSpec.x}px`);
      cloud.style.setProperty('--cloud-y', `${cloudSpec.y}px`);
      cloud.style.setProperty('--cloud-width', `${cloudSpec.width}px`);
      cloud.style.setProperty('--cloud-opacity', `${cloudSpec.opacity}`);
      cloud.style.setProperty('--cloud-dx', `${cloudSpec.dx}px`);
      cloud.style.setProperty('--cloud-dy', `${cloudSpec.dy}px`);
      cloud.style.setProperty('--cloud-duration', `${cloudSpec.duration}s`);
      cloud.style.setProperty('--cloud-delay', `${cloudSpec.delay}s`);
      cloud.style.setProperty('--cloud-scale', `${cloudSpec.scale}`);
      hubCloudLayer.appendChild(cloud);
    });
    hub.appendChild(hubCloudLayer);

    const worldIds = [1, 2, 3];
    worldIds.forEach((worldId) => {
      const meta = JOURNEY_WORLD_LABELS[worldId];
      const range = this.getJourneyWorldRange(worldId);
      if (!meta || !range) return;

      const worldBoards = this.boards.filter((board) => board.id >= range.start && board.id <= range.end);
      const unlockedCount = worldBoards.filter((board) => board.unlocked && !board.interim).length;
      const hasInterimCard = worldBoards.some((board) => board.interim);
      // The banner is both current-progress and completed-world history. Keep
      // 10/10 visible after progression moves to the next World's 0/10 card.
      const locked = worldId > activeWorldId && unlockedCount === 0;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `journey-v700-world-card ${meta.className}${locked ? ' is-locked' : ''}${hasInterimCard ? ' has-interim-card' : ''} has-progress-banner`;
      button.dataset.worldId = String(worldId);
      button.setAttribute('aria-label', `${meta.name} world`);

      const visual = document.createElement('div');
      visual.className = 'journey-v700-world-visual';
      visual.setAttribute('aria-hidden', 'true');

      const banner = document.createElement('span');
      banner.className = `journey-v700-world-banner journey-v700-world-banner-${worldId === 2 ? 'left' : 'right'}`;
      banner.setAttribute('aria-hidden', 'true');

      const bannerImage = document.createElement('img');
      bannerImage.src = JOURNEY_WORLD_BANNER_ASSET;
      bannerImage.srcset = `${encodeURI(JOURNEY_WORLD_BANNER_ASSET_2X)} 2x`;
      bannerImage.alt = '';
      bannerImage.draggable = false;
      bannerImage.className = 'journey-v700-world-banner-image';
      banner.appendChild(bannerImage);

      const bannerFlagFx = document.createElement('span');
      bannerFlagFx.className = 'journey-v700-world-banner-flag-fx';
      bannerFlagFx.setAttribute('aria-hidden', 'true');
      banner.appendChild(bannerFlagFx);

      const bannerCount = document.createElement('span');
      bannerCount.className = 'journey-v700-world-banner-count';
      bannerCount.textContent = `${unlockedCount}/${worldBoards.length}`;
      banner.appendChild(bannerCount);
      visual.appendChild(banner);

      const image = document.createElement('img');
      image.src = meta.asset;
      image.alt = '';
      image.draggable = false;
      image.setAttribute('aria-hidden', 'true');
      image.className = 'journey-v700-world-image';
      visual.appendChild(image);
      button.appendChild(visual);

	      let worldCardTouchStartX = 0;
	      let worldCardTouchStartY = 0;
	      let worldCardTouchMoved = false;
	      let suppressNextSyntheticClick = false;
	      const worldCardDragThresholdPx = 12;

	      const onWorldCardTouchStart = (event: TouchEvent) => {
	        if (event.touches.length !== 1) return;
	        worldCardTouchStartX = event.touches[0].clientX;
	        worldCardTouchStartY = event.touches[0].clientY;
	        worldCardTouchMoved = false;
	      };

	      const onWorldCardTouchMove = (event: TouchEvent) => {
	        if (event.touches.length !== 1) return;
	        const dx = event.touches[0].clientX - worldCardTouchStartX;
	        const dy = event.touches[0].clientY - worldCardTouchStartY;
	        if (Math.hypot(dx, dy) >= worldCardDragThresholdPx) {
	          worldCardTouchMoved = true;
	        }
	      };

	      const openWorld = (event: Event) => {
	        if (event.type === 'touchend' && worldCardTouchMoved) {
	          suppressNextSyntheticClick = true;
	          this.logJourneyV700Flow('world-card-touchend-ignored-drag', { worldId }, container);
	          return;
	        }
	        if (event.type === 'click' && suppressNextSyntheticClick) {
	          suppressNextSyntheticClick = false;
	          this.logJourneyV700Flow('world-card-click-ignored-after-drag', { worldId }, container);
	          return;
	        }
	        event.preventDefault();
	        event.stopPropagation();
	        this.logJourneyV700Flow('world-card-tap', { worldId, locked }, container);
        const now = Date.now();
        const lastTap = Number((button as any).__ccJourneyV700LastTap || 0);
        if (now - lastTap < 350) {
          this.logJourneyV700Flow('world-card-tap-ignored-debounce', { worldId, deltaMs: now - lastTap }, container);
          return;
        }
        (button as any).__ccJourneyV700LastTap = now;
        journeySpatialMotion.suspend();
        this.openJourneyV700World(worldId, button);
      };

	      button.addEventListener('touchstart', onWorldCardTouchStart, { passive: true });
	      button.addEventListener('touchmove', onWorldCardTouchMove, { passive: true });
	      button.addEventListener('click', openWorld);
	      button.addEventListener('touchend', openWorld, { passive: false });
      hub.appendChild(button);
    });

    container.appendChild(hub);
    this.resetJourneyV700HubScrollToTop(
      (container as any).__ccJourneyV700ReturningFromWorld === true
        ? 'return-from-world'
        : 'hub-render'
    );

    const returningFromWorld = (container as any).__ccJourneyV700ReturningFromWorld === true;
    delete (container as any).__ccJourneyV700ReturningFromWorld;
    this.journeyV700Phase = 'hidden';
    this.logJourneyV700Flow('hub-render-complete-dom-only', {
      worldCount: hub.querySelectorAll('.journey-v700-world-card').length,
      returningFromWorld,
    }, container);

    // Rendering only creates stable DOM. Presentation is always delegated to
    // the single tracked Hub-enter coordinator, regardless of navigation source.
    if (returningFromWorld) {
      this.playJourneyV700HubEnter('world-return');
    }
  }

  /** Force the first-play destination to the Hub before its hidden preparation. */
  public prepareFirstPlayTutorialHubReturn(): void {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    this.cancelJourneyV700HubEnter('first-play-tutorial-hub-return');
    this.setJourneyV700View('hub');
    if (container) this.renderBoards();
  }

  /** Resolve when the canonical Hub enter has begun painting signs and idle. */
  public waitForJourneyV700HubPresentation(timeoutMs = 2600): Promise<void> {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    const hub = container?.querySelector<HTMLElement>('.journey-v700-hub');
    if (hub?.classList.contains('journey-v700-banners-presented')) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.journeyV700HubPresentationWaiters.delete(finish);
        resolve();
      };
      const timeout = window.setTimeout(finish, timeoutMs);
      this.journeyV700HubPresentationWaiters.add(finish);
    });
  }

  private cancelJourneyV700HubEnter(reason: string): void {
    this.journeyV700HubEnterEpoch += 1;
    const activeTweens = this.journeyV700HubEnterTweens.splice(0);
    activeTweens.forEach((tween) => {
      try { tween.kill(); } catch {}
    });
    if (activeTweens.length > 0) {
      this.logJourneyV700Flow('hub-enter-owner-cancelled', {
        reason,
        tweenCount: activeTweens.length,
      });
    }
  }

  /** One coordinator owns every visible Hub presentation source. */
  private playJourneyV700HubEnter(source: 'homepage' | 'world-return'): void {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    if (!container || container.dataset.journeyV700View !== 'hub') return;

    const worldCards = Array.from(
      container.querySelectorAll<HTMLElement>('.journey-v700-world-card')
    );
    if (!worldCards.length) return;
    const hub = container.querySelector<HTMLElement>('.journey-v700-hub');
    const hubCloudLayer = container.querySelector<HTMLElement>('.journey-v700-hub-cloud-layer');

    // Tween existence is the owner signal. GSAP reports delayed tweens inactive
    // during baseDelay, which previously allowed a second enter to reset them.
    const timelineActive = this.journeyV700HubEnterTweens.length > 0;
    const idleReady = hub?.classList.contains('journey-v700-idle-ready') === true &&
      worldCards.every((card) => card.classList.contains('journey-v700-idle-ready'));
    emitIOSNativeDiagnostic('hub-visible-enter-request', {
      phase: this.journeyV700Phase,
      timelineActive,
      idleReady,
      worldCount: worldCards.length,
    });
    if (shouldIgnoreJourneyV700HubVisibleEnterRequest({
      phase: this.journeyV700Phase,
      timelineActive,
      idleReady,
    })) {
      this.logJourneyV700Flow('hub-visible-enter-ignored-duplicate', {
        phase: this.journeyV700Phase,
        timelineActive,
        idleReady,
      }, container);
      emitIOSNativeDiagnostic('hub-visible-enter-ignored-duplicate', {
        phase: this.journeyV700Phase,
        timelineActive,
        idleReady,
      });
      return;
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const motion = getJourneyV700MotionProfile(reducedMotion);
    const stagger = getJourneyV700HubEnterStagger(reducedMotion);
    const worldFinalOpacity = new Map<HTMLElement, number>(
      worldCards.map((card) => {
        const cssOpacity = Number.parseFloat(getComputedStyle(card).opacity);
        return [card, card.classList.contains('is-locked') && Number.isFinite(cssOpacity) ? cssOpacity : 1];
      }),
    );
    this.cancelJourneyV700HubEnter(`new-${source}-enter`);
    // A background-prepared Hub may still own gyro from an earlier lifecycle.
    // Release it before GSAP takes transform ownership so spatial translation
    // cannot appear halfway through the visible enter.
    journeySpatialMotion.deactivate();
    this.journeyV700Phase = 'entering';
    const enterEpoch = ++this.journeyV700HubEnterEpoch;
    const enterStartedAt = performance.now();
    hub?.classList.remove('journey-v700-idle-ready');
    hub?.classList.remove('journey-v700-banners-presented');
    hub?.classList.remove('journey-v700-banners-retracting');
    // Prime the neutral CSS idle phase before the first GSAP enter frame.
    // A paused animation with a negative delay still renders that delayed
    // keyframe in WebKit, so waiting until completion made Beach/Area 55 fall
    // 7–12px when their delay changed to zero at the idle handoff.
    hub?.classList.add('journey-v700-idle-seamless-start');
    worldCards.forEach((card) => card.classList.remove('journey-v700-idle-ready'));

    try {
      gsap.killTweensOf(worldCards);
      if (hubCloudLayer) gsap.killTweensOf(hubCloudLayer);
      gsap.set(worldCards, {
        y: motion.enter.y,
        scale: motion.enter.scale,
        opacity: 0,
        visibility: 'visible',
        force3D: true,
      });
      if (hubCloudLayer) {
        gsap.set(hubCloudLayer, {
          y: motion.enter.y * 0.55,
          scale: 0.82,
          opacity: 0,
          visibility: 'visible',
          force3D: true,
        });
      }
    } catch {}

    this.logJourneyV700Flow('hub-visible-enter-start', {
      source,
      worldCount: worldCards.length,
      cloudLayer: !!hubCloudLayer,
      stagger,
      duration: motion.enter.duration,
      expectedTotalMs: Math.round((motion.enter.baseDelay + motion.enter.duration + ((worldCards.length - 1) * stagger)) * 1000),
    }, container);

    let bannerEnterStarted = false;
    const startBannerEnter = () => {
      if (bannerEnterStarted || enterEpoch !== this.journeyV700HubEnterEpoch || !container.isConnected) return;
      bannerEnterStarted = true;
      // Start local banner reveal on the first real GSAP enter tick so it runs
      // with the Worlds, while preserving a painted tucked-behind start state.
      hub?.classList.add('journey-v700-banners-presented');
      // The outer World cards own standard enter transforms; the nested visual
      // and cloud layers own idle transforms. Start those independent owners
      // on the first visible enter tick so the Hub is alive throughout enter,
      // without competing for the same transform or creating a handoff gap.
      worldCards.forEach((worldCard) => worldCard.classList.add('journey-v700-idle-ready'));
      hub?.classList.add('journey-v700-idle-ready');
      const presentationWaiters = Array.from(this.journeyV700HubPresentationWaiters);
      this.journeyV700HubPresentationWaiters.clear();
      presentationWaiters.forEach((resolve) => resolve());
    };
    let remainingTargets = worldCards.length + (hubCloudLayer ? 1 : 0);
    const finishVisibleEnterTarget = () => {
      if (enterEpoch !== this.journeyV700HubEnterEpoch || !container.isConnected) return;
      remainingTargets -= 1;
      if (remainingTargets > 0) return;
      this.journeyV700HubEnterTweens = [];
      if (source === 'world-return') {
        this.emitJourneyV700HubGeometryDiagnostic('before-handoff', container);
      }
      // Remove the identity GSAP matrix atomically before CSS idle and gyro
      // take over separate layers.
      gsap.set(worldCards, { clearProps: 'transform,opacity,visibility,willChange' });
      // The Hub root is the sole visual idle owner. Prime its zero-delay phase
      // before marking child cards ready, then start every world/cloud from one
      // root mutation. This prevents Beach/Area 55 from exposing one WebKit
      // frame at their negative animation-delay phase after a World return.
      hub?.classList.add('journey-v700-idle-seamless-start');
      worldCards.forEach((worldCard) => worldCard.classList.add('journey-v700-idle-ready'));
      if (hubCloudLayer) {
        gsap.set(hubCloudLayer, { clearProps: 'transform,opacity,visibility,willChange' });
      }
      hub?.classList.add('journey-v700-idle-ready');
      this.journeyV700Phase = 'idle';
      if (source === 'world-return') {
        this.emitJourneyV700HubGeometryDiagnostic('idle-ready', container);
      }
      journeySpatialMotion.activateJourneyHub(container);
      if (source === 'world-return') {
        this.emitJourneyV700HubGeometryDiagnostic('spatial-activated', container);
        this.trackRAF(() => {
          if (enterEpoch !== this.journeyV700HubEnterEpoch || !container.isConnected) return;
          this.emitJourneyV700HubGeometryDiagnostic('frame-1', container);
          this.trackRAF(() => {
            if (enterEpoch !== this.journeyV700HubEnterEpoch || !container.isConnected) return;
            this.emitJourneyV700HubGeometryDiagnostic('frame-2', container);
          });
        });
      }
      emitIOSNativeDiagnostic('hub-visible-enter-complete', {
        source,
        worldCount: worldCards.length,
        expectedTotalMs: Math.round((motion.enter.baseDelay + motion.enter.duration + ((worldCards.length - 1) * stagger)) * 1000),
        actualTotalMs: Math.round(performance.now() - enterStartedAt),
      });
      this.logJourneyV700Flow('hub-visible-enter-complete', { source, owner: 'tracked-per-unit' }, container);
    };
    if (hubCloudLayer) {
      const cloudTween = trackTween(hubCloudLayer, {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: motion.enter.duration + 0.08,
        delay: Math.max(0, motion.enter.baseDelay - 0.025),
        ease: motion.enter.ease,
        force3D: true,
        overwrite: true,
        onStart: startBannerEnter,
        onComplete: finishVisibleEnterTarget,
      });
      this.journeyV700HubEnterTweens.push(cloudTween);
    }
    worldCards.forEach((worldCard, index) => {
      const worldTween = trackTween(worldCard, {
        y: 0,
        scale: 1,
        // Locked Worlds retain their full CSS opacity throughout enter. Their
        // inactive hierarchy comes only from saturation, never a second fade.
        opacity: worldFinalOpacity.get(worldCard) ?? 1,
        duration: motion.enter.duration,
        delay: motion.enter.baseDelay + (index * stagger),
        ease: motion.enter.ease,
        force3D: true,
        overwrite: true,
        onStart: startBannerEnter,
        onComplete: finishVisibleEnterTarget,
      });
      this.journeyV700HubEnterTweens.push(worldTween);
    });
  }

  public playJourneyV700HubEnterFromHomepage(): void {
    this.playJourneyV700HubEnter('homepage');
  }

  /**
   * Own the visible Journey content enter after homepage/background preparation.
   * A remembered World view must not consume its enter while the screen is hidden.
   */
  public playJourneyV700VisibleEnterFromHomepage(): void {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    if (!container) return;

    const view = container.dataset.journeyV700View || this.journeyV700View;
    if (view === 'world' && this.journeyV700WorldId) {
      this.playJourneyV700WorldEnter(container, this.journeyV700WorldId, {
        source: 'homepage-visible-world',
        waitForImages: false,
      });
      return;
    }

    this.playJourneyV700HubEnterFromHomepage();
  }

  private openJourneyV700World(worldId: number, source?: HTMLElement): void {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    if (!container) return;

    if (this.journeyV700WorldOpenInProgress || (container as any).__ccJourneyV700Opening === true) {
      this.logJourneyV700Flow('open-world-ignored-already-opening', {
        requestedWorldId: worldId,
        currentWorldId: this.journeyV700WorldId,
        managerOpening: this.journeyV700WorldOpenInProgress,
      }, container);
      return;
    }
    if (this.journeyV700View === 'world' && this.journeyV700WorldId === worldId) {
      this.logJourneyV700Flow('open-world-ignored-already-in-world', { requestedWorldId: worldId }, container);
      return;
    }

    this.journeyV700WorldOpenInProgress = true;
    (container as any).__ccJourneyV700Opening = true;
    // A manual Hub -> World tap starts a new visible lifecycle. Return-only
    // suppression markers from a prior game/tutorial may not own this render.
    delete (window as any).__ccSuppressJourneyV700AutoWorldEnter;
    delete (window as any).__ccReturningFromDetailModal;
    delete (window as any).__ccReturningFromInterimBoard;
    localStorage.removeItem('__ccReturningFromInterimBoard');
    this.freezeJourneyV700HubElasticOffsetForExit(container, `open-world-${worldId}`);
    const releaseHubViewportPin = this.pinJourneyV700HubViewportForExit(container, `open-world-${worldId}`);
    this.logJourneyV700Flow('open-world-start', { requestedWorldId: worldId, hasSource: !!source }, container);
    try { (window as any).triggerHapticImpact?.('light'); } catch {}
    const navExitPromise = this.playJourneyV700NavExit();
    const startWorldRender = async () => {
      try {
        this.logJourneyV700Flow('open-world-hub-exit-complete-await-nav', { requestedWorldId: worldId }, container);
        await navExitPromise;
        const journeyScreen = document.getElementById('journey-screen') as HTMLElement | null;
        const journeyStillOwnsScreen = !this.renderDisposed &&
          !!journeyScreen &&
          !journeyScreen.hidden &&
          !journeyScreen.classList.contains('hidden') &&
          getComputedStyle(journeyScreen).display !== 'none';
        if (!journeyStillOwnsScreen) {
          releaseHubViewportPin();
          this.logJourneyV700Flow('open-world-render-cancelled-after-exit', {
            requestedWorldId: worldId,
            renderDisposed: this.renderDisposed,
          }, container);
          return;
        }
        this.logJourneyV700Flow('open-world-nav-exit-complete-render-world', { requestedWorldId: worldId }, container);
        const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
        if (scrollable) {
          try { gsap.killTweensOf(scrollable, 'scrollTop'); } catch {}
          scrollable.style.overflowAnchor = 'none';
          scrollable.scrollTop = 0;
        }
        this.setJourneyV700View('world', worldId);
        this.updateJourneyV700Nav('world', worldId);
        // Release and replace occur synchronously, so the outgoing Hub cannot
        // paint without its compensation transform.
        releaseHubViewportPin();
        this.renderBoards();
        if (scrollable) {
          scrollable.scrollTop = 0;
          this.trackRAF(() => {
            if (this.journeyV700View !== 'world' || this.journeyV700WorldId !== worldId) return;
            scrollable.scrollTop = 0;
          });
        }
        // renderBoards primes every Unit synchronously. Start the visible World
        // and nav enter from a fresh animation-frame clock so expensive DOM
        // construction cannot consume the first ~100ms before the first paint.
        this.trackRAF(() => {
          if (
            this.renderDisposed ||
            this.journeyV700View !== 'world' ||
            this.journeyV700WorldId !== worldId ||
            !document.body.contains(container)
          ) return;
          emitIOSNativeDiagnostic('world-enter-visible-frame-start', {
            worldId,
            source: 'hub-world-open',
          });
          this.playJourneyV700WorldEnter(container, worldId, {
            source: 'hub-world-open',
            lastBoardId: 0,
            waitForImages: false,
          });
          this.playJourneyV700NavEnter();
        });
        this.logJourneyV700Flow('open-world-rendered', { requestedWorldId: worldId }, document.getElementById('journey-boards-container') as HTMLElement | null);
      } finally {
        releaseHubViewportPin();
        this.journeyV700WorldOpenInProgress = false;
        delete (container as any).__ccJourneyV700Opening;
      }
    };

    this.playJourneyV700HubExit(`open-world-${worldId}`, source || null).then(() => {
      startWorldRender();
    }).catch((error) => {
      this.logJourneyV700Flow('open-world-hub-exit-error-fallback', {
        requestedWorldId: worldId,
        error: error instanceof Error ? error.message : String(error),
      }, container);
      startWorldRender();
    });
  }

  private applyJourneyV700WorldScope(container: HTMLElement, worldId: number): void {
    const range = this.getJourneyWorldRange(worldId);
    const worldOffsetPx = JOURNEY_WORLD_MAIN_OFFSETS_PX[worldId] || 0;
    const worldOffsetPercent = (worldOffsetPx / FOREST_MAP_DESIGN_HEIGHT) * 100;
    const forestExtraDownPx = worldId === 1 ? JOURNEY_V700_FOREST_SCOPE_EXTRA_DOWN_PX : 0;
    const forestExtraDownPercent = (forestExtraDownPx / FOREST_MAP_DESIGN_HEIGHT) * 100;
    if (!range) {
      this.logJourneyV700Flow('world-scope-missing-range', { worldId }, container);
      return;
    }

    this.logJourneyV700Flow('world-scope-start', { worldId, rangeStart: range.start, rangeEnd: range.end }, container);

    container.dataset.journeyV700View = 'world';
    container.dataset.journeyV700WorldId = String(worldId);

    const bgContainer = container.querySelector('.journey-bg-container') as HTMLElement | null;
    const decorContainer = container.querySelector('.journey-decor-container') as HTMLElement | null;
    const cardsContainer = container.querySelector('.journey-cards-container') as HTMLElement | null;
    this.applyJourneyV700WorldHeights(container);

    const isAllowedArea = (areaId: string | undefined): boolean => {
      if (!areaId) return false;
      if (worldId === 1 && areaId === 'forest-main') return true;
      if (worldId === 2 && areaId === 'beach-main') return true;
      if (worldId === 3 && areaId === 'robo-main') return true;
      const match = areaId.match(/^board-(\d+)$/);
      if (!match) return false;
      const boardId = Number(match[1]);
      return boardId >= range.start && boardId <= range.end;
    };

    const scopeImage = (element: HTMLElement) => {
      const areaId = element.dataset.journeyAreaId;
      if (!isAllowedArea(areaId)) {
        element.style.display = 'none';
        return;
      }
      element.style.display = '';
      const rawTop = parseFloat(element.style.top || '0');
      if (Number.isFinite(rawTop)) {
        element.style.top = `${rawTop - worldOffsetPercent + forestExtraDownPercent}%`;
      }
    };

    bgContainer?.querySelectorAll<HTMLElement>('[data-journey-area-id]').forEach(scopeImage);
    decorContainer?.querySelectorAll<HTMLElement>('[data-journey-area-id]').forEach(scopeImage);

    cardsContainer?.querySelectorAll<HTMLElement>('.journey-board-card-wrapper').forEach((wrapper) => {
      const boardId = Number(wrapper.querySelector('.journey-board-card')?.getAttribute('data-board-id') || 0);
      if (boardId < range.start || boardId > range.end) {
        wrapper.style.display = 'none';
        return;
      }
      wrapper.style.display = '';
      const rawTop = parseFloat(wrapper.style.top || '0');
      if (Number.isFinite(rawTop)) {
        wrapper.style.top = `${rawTop - worldOffsetPx + forestExtraDownPx}px`;
      }
    });

    this.updateJourneyV700Nav('world', worldId);

    const hasExplicitWorldReturnOwner =
      (window as any).__ccReturningFromDetailModal === true ||
      (window as any).__ccReturningFromInterimBoard === true ||
      localStorage.getItem('__ccReturningFromInterimBoard') === 'true';
    const isVisibleHubToWorldOpen = (container as any).__ccJourneyV700Opening === true;
    if (!isVisibleHubToWorldOpen) {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      const motion = getJourneyV700MotionProfile(reducedMotion);
      const targets = this.getJourneyV700WorldTargets(container);
      try {
        gsap.killTweensOf(targets);
        targets.forEach((target) => restoreJourneyAreaTransformOrigin(target));
        gsap.set(targets, {
          y: motion.enter.y,
          scale: motion.enter.scale,
          opacity: 0,
          visibility: 'visible',
          force3D: true,
          overwrite: true,
        });
      } catch {}
      this.logJourneyV700Flow('world-scope-auto-enter-suppressed', {
        worldId,
        targetCount: targets.length,
        hasExplicitWorldReturnOwner,
        hasSuppressAutoEnterFlag: (window as any).__ccSuppressJourneyV700AutoWorldEnter === true,
        awaitingVisibleScreenOwner: !isVisibleHubToWorldOpen,
      }, container);
      return;
    }

    // Manual Hub → World navigation primes during render and starts from the
    // tracked frame owner in openJourneyV700World. Never begin a timeline from
    // inside the potentially expensive synchronous render pass.
    this.primeJourneyV700WorldEnter(container, worldId, {
      source: 'hub-world-open-render-prime',
      lastBoardId: 0,
    });
  }

  private getJourneyV700WorldTargets(container: HTMLElement): HTMLElement[] {
    const visible = (target: HTMLElement) => target.style.display !== 'none';
    return Array.from(container.querySelectorAll<HTMLElement>(
      '[data-journey-area-id], .journey-board-card-wrapper'
    )).filter(visible);
  }

  private getJourneyV700BoardIdForTarget(target: HTMLElement): number {
    const directBoardId = Number(target.dataset.boardId || 0);
    if (Number.isFinite(directBoardId) && directBoardId > 0) return directBoardId;

    const card = target.classList.contains('journey-board-card-wrapper')
      ? target.querySelector('.journey-board-card') as HTMLElement | null
      : null;
    const cardBoardId = Number(card?.getAttribute('data-board-id') || 0);
    if (Number.isFinite(cardBoardId) && cardBoardId > 0) return cardBoardId;

    const areaMatch = target.dataset.journeyAreaId?.match(/^(?:v700-)?board-(\d+)$/);
    const areaBoardId = Number(areaMatch?.[1] || 0);
    return Number.isFinite(areaBoardId) && areaBoardId > 0 ? areaBoardId : 0;
  }

  private getJourneyV700VisibleBoardAreaTargets(container: HTMLElement, boardId: number): HTMLElement[] {
    const areaId = `board-${boardId}`;
    const areaTargets = Array.from(
      container.querySelectorAll<HTMLElement>(`[data-journey-area-id="${areaId}"]`)
    );
    const canonicalCardWrapper = container.querySelector<HTMLElement>(
      `.journey-board-card-wrapper[data-board-id="${boardId}"]`,
    );
    const legacyCard = container.querySelector<HTMLElement>(
      `.journey-board-card[data-board-id="${boardId}"]`,
    );
    const cardWrapper = canonicalCardWrapper
      || legacyCard?.closest('.journey-board-card-wrapper') as HTMLElement | null;
    const targets = cardWrapper && !areaTargets.includes(cardWrapper)
      ? [...areaTargets, cardWrapper]
      : areaTargets;

    return Array.from(new Set(targets)).filter((target) => {
      if (!document.body.contains(target)) return false;
      if (target.style.display === 'none') return false;
      return true;
    });
  }

	  public playJourneyV700HubExit(reason = 'hub-exit', selectedWorldCard: HTMLElement | null = null): Promise<void> {
	    this.cancelJourneyV700HubEnter(reason);
	    journeySpatialMotion.suspend();
	    this.releaseJourneyV700HubTopGuard(reason);
	    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
	    const worldCards = Array.from(
	      container?.querySelectorAll<HTMLElement>('.journey-v700-world-card') || []
	    ).filter((card) => document.body.contains(card) && card.style.display !== 'none');
	    const hub = container?.querySelector<HTMLElement>('.journey-v700-hub') || null;
	    const hubCloudLayer = container?.querySelector<HTMLElement>('.journey-v700-hub-cloud-layer') || null;
	    const includeNavExit = reason === 'back-to-home';
	    const navTargets = includeNavExit ? this.getJourneyV700NavTargets() : [];
	    let releaseBackToHomeViewportPin: (() => void) | null = null;
	    if (includeNavExit && container) {
	      this.freezeJourneyV700HubElasticOffsetForExit(container, reason);
	      releaseBackToHomeViewportPin = this.pinJourneyV700HubViewportForExit(container, reason);
	    }

	    this.logJourneyV700Flow('hub-exit-start', {
	      reason,
	      worldCount: worldCards.length,
	      cloudLayer: !!hubCloudLayer,
	      navCount: navTargets.length,
	      includeNavExit,
	    }, container);
	    if (!worldCards.length && !hubCloudLayer && !navTargets.length) {
	      this.logJourneyV700Flow('hub-exit-no-worlds', { reason }, container);
	      releaseBackToHomeViewportPin?.();
	      return Promise.resolve();
	    }

    this.journeyV700Phase = 'exiting';
    worldCards.forEach((card) => card.classList.remove('journey-v700-idle-ready'));
    hub?.classList.remove('journey-v700-idle-ready');
    // Retract banners behind their World PNGs in parallel with the canonical
    // World exit. Pausing local idle preserves its live angle without a snap.
    hub?.classList.add('journey-v700-banners-retracting');
    hub?.classList.remove('journey-v700-banners-presented');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const motion = getJourneyV700MotionProfile(reducedMotion);

    return new Promise((resolve) => {
	      let remaining = worldCards.length + (hubCloudLayer ? 1 : 0) + navTargets.length;
	      const finishTarget = () => {
	        remaining -= 1;
	        if (remaining > 0) return;
	        this.logJourneyV700Flow('hub-exit-complete', { reason }, container);
	        resolve();
	        // Resolving queues the caller's await continuation first. It hides the
	        // Journey screen synchronously; release the compensating pin only after
	        // that handoff so iOS cannot paint a final momentum-scroll frame.
	        if (releaseBackToHomeViewportPin) {
	          queueMicrotask(releaseBackToHomeViewportPin);
	        }
	      };

	      navTargets.forEach((target) => {
	        try {
	          gsap.killTweensOf(target);
	          target.style.willChange = 'transform, opacity';
	          target.style.pointerEvents = 'none';
	          gsap.set(target, {
	            scale: 1,
	            opacity: 1,
	            visibility: 'visible',
	            transformOrigin: '50% 0%',
	            force3D: true,
	            overwrite: true,
	          });
	          gsap.to(target, {
	            y: -10,
	            scale: 0.04,
	            opacity: 0,
	            duration: motion.exit.duration,
	            delay: BOARD_AREA_MODAL_EXIT_BASE_DELAY,
	            ease: motion.exit.ease,
	            force3D: true,
	            overwrite: true,
	            onComplete: finishTarget,
	          });
	        } catch {
	          finishTarget();
	        }
	      });

	      if (hubCloudLayer) {
	        try {
          gsap.killTweensOf(hubCloudLayer);
          gsap.to(hubCloudLayer, {
            y: motion.exit.y * 0.55,
            scale: 0.82,
            opacity: 0,
            duration: motion.exit.duration,
            delay: BOARD_AREA_MODAL_EXIT_BASE_DELAY,
            ease: motion.exit.ease,
            force3D: true,
            overwrite: true,
            onComplete: finishTarget,
          });
        } catch {
          finishTarget();
        }
      }

	      worldCards.slice().reverse().forEach((card, index) => {
	        try {
	          gsap.killTweensOf(card);
	          if (card === selectedWorldCard) {
	            gsap.set(card, {
	              y: 0,
	              scale: 1,
	              opacity: 1,
	              visibility: 'visible',
	              transformOrigin: '50% 50%',
	              force3D: true,
	            });
	            gsap.timeline({
	              defaults: { force3D: true, transformOrigin: '50% 50%' },
	              onComplete: finishTarget,
	              onInterrupt: finishTarget,
	            })
	              .to(card, {
	                y: 0,
	                scale: 0,
	                opacity: 1,
	                duration: BOARD_AREA_CARD_TAP_EXIT_DURATION,
	                ease: BOARD_AREA_CARD_TAP_EXIT_EASE,
	                onComplete: () => {
	                  gsap.set(card, { opacity: 0, visibility: 'hidden' });
	                },
	              });
	            return;
	          }
	          const delay = BOARD_AREA_MODAL_EXIT_BASE_DELAY + (index * motion.exit.groupStagger);
	          if (includeNavExit && motion.exit.anticipationDuration > 0) {
	            gsap.set(card, {
	              y: 0,
	              scale: 1,
	              opacity: 1,
	              visibility: 'visible',
	              transformOrigin: '50% 50%',
	              force3D: true,
	              overwrite: true,
	            });
	            gsap.timeline({
	              delay,
	              defaults: { force3D: true, transformOrigin: '50% 50%' },
	              onComplete: finishTarget,
	              onInterrupt: finishTarget,
	            })
	              .to(card, {
	                scale: motion.exit.anticipationScale,
	                duration: motion.exit.anticipationDuration,
	                ease: 'power2.out',
	              })
	              .to(card, {
	                y: motion.exit.y,
	                scale: motion.exit.scale,
	                opacity: 0,
	                duration: Math.max(0.01, motion.exit.duration - motion.exit.anticipationDuration),
	                ease: 'power2.in',
	              });
	            return;
	          }
	          gsap.to(card, {
              y: motion.exit.y,
              scale: motion.exit.scale,
              opacity: 0,
              duration: motion.exit.duration,
              delay,
              ease: motion.exit.ease,
              force3D: true,
              overwrite: true,
              onComplete: finishTarget,
            });
        } catch {
          finishTarget();
        }
      });
    });
  }

  private getJourneyV700WorldTargetGroups(
    container: HTMLElement,
    worldId: number | null,
    options: { excludeBoardId?: number | null; lastBoardId?: number | null; mainExitFirst?: boolean } = {}
  ): HTMLElement[][] {
    const visibleTargets = this.getJourneyV700WorldTargets(container);
    const groups: HTMLElement[][] = [];
    const mainAreaId = worldId === 1 ? 'forest-main' : worldId === 2 ? 'beach-main' : worldId === 3 ? 'robo-main' : null;
    const mainCloudClass = worldId === 1 ? 'journey-forest-main-cloud' : worldId === 2 ? 'journey-beach-main-cloud' : worldId === 3 ? 'journey-robo-main-cloud' : null;
    const isCurrentWorldMainArt = (target: HTMLElement): boolean => {
      if (worldId === 2) return target.classList.contains('journey-beach-main-art');
      if (worldId === 3) return target.classList.contains('journey-robo-main-art');
      if (worldId !== 1 || !target.classList.contains('journey-forest-main-art')) return false;
      return !target.classList.contains('journey-beach-main-art') &&
        !target.classList.contains('journey-robo-main-art');
    };
    const worldRange = worldId ? this.getJourneyWorldRange(worldId) : null;
    const excludeBoardId = Number(options.excludeBoardId || 0);
    const lastBoardId = Number(options.lastBoardId || 0);
    const pushGroup = (group: HTMLElement[]) => {
      if (!group.length) return;
      const boardId = this.getJourneyV700BoardIdForTarget(group.find((target) => this.getJourneyV700BoardIdForTarget(target) > 0) || group[0]);
      if (Number.isFinite(excludeBoardId) && excludeBoardId > 0 && boardId === excludeBoardId) return;
      groups.push(group);
    };

    if (mainAreaId) {
      // Use structural world classes as recovery provenance as well as the
      // canonical area id. Older idle ownership may already have corrupted a
      // live DOM node before this fixed build resumes it.
      const mainTargets = Array.from(container.querySelectorAll<HTMLElement>('[data-journey-area-id], .journey-forest-main-art'))
        .filter((target) => document.body.contains(target))
        .filter((target) => (
        target.dataset.journeyAreaId === mainAreaId ||
        (!!mainCloudClass && target.classList.contains(mainCloudClass)) ||
        isCurrentWorldMainArt(target)
      ));
      mainTargets.forEach((target) => {
        target.dataset.journeyAreaId = mainAreaId;
        target.style.display = '';
      });
      pushGroup(mainTargets);
    }

    if (worldRange) {
      for (let boardId = worldRange.start; boardId <= worldRange.end; boardId += 1) {
        const group = this.getJourneyV700VisibleBoardAreaTargets(container, boardId);
        pushGroup(group);
      }

      // A card wrapper is a first-class part of its Unit. Repair any legacy or
      // transient DOM that reached this snapshot without canonical grouping,
      // instead of letting the final viewport hide cut an orphan card off.
      const visibleCardWrappers = Array.from(
        container.querySelectorAll<HTMLElement>('.journey-board-card-wrapper'),
      ).filter((wrapper) => {
        if (!document.body.contains(wrapper) || wrapper.style.display === 'none') return false;
        const boardId = this.getJourneyV700BoardIdForTarget(wrapper);
        return boardId >= worldRange.start && boardId <= worldRange.end && boardId !== excludeBoardId;
      });
      const repairedBoardIds: number[] = [];
      visibleCardWrappers.forEach((wrapper) => {
        const boardId = this.getJourneyV700BoardIdForTarget(wrapper);
        const memberships = groups
          .map((group, groupIndex) => group.includes(wrapper) ? groupIndex : -1)
          .filter((groupIndex) => groupIndex >= 0);
        if (memberships.length === 1) return;

        memberships.slice(1).forEach((groupIndex) => {
          groups[groupIndex] = groups[groupIndex].filter((target) => target !== wrapper);
        });
        if (!memberships.length) {
          const boardGroup = groups.find((group) => group.some(
            (target) => this.getJourneyV700BoardIdForTarget(target) === boardId,
          ));
          if (boardGroup) boardGroup.push(wrapper);
          else pushGroup(this.getJourneyV700VisibleBoardAreaTargets(container, boardId));
        }
        repairedBoardIds.push(boardId);
      });
      if (repairedBoardIds.length) {
        console.warn('🧩 JourneyUnitExit world-card-membership-repaired', {
          worldId,
          excludeBoardId: excludeBoardId || null,
          boardIds: Array.from(new Set(repairedBoardIds)),
        });
      }
    } else {
      const boardGroups = new Map<number, HTMLElement[]>();
      visibleTargets.forEach((target) => {
        const boardId = this.getJourneyV700BoardIdForTarget(target);
        if (boardId <= 0) return;
        const group = boardGroups.get(boardId) || [];
        group.push(target);
        boardGroups.set(boardId, group);
      });

      Array.from(boardGroups.keys())
        .sort((a, b) => a - b)
        .forEach((boardId) => {
          const group = boardGroups.get(boardId);
          if (group?.length) pushGroup(group);
        });
    }

    if (options.mainExitFirst && mainAreaId) {
      const mainIndex = groups.findIndex((group) => (
        group.some((target) => (
          target.dataset.journeyAreaId === mainAreaId ||
          (!!mainCloudClass && target.classList.contains(mainCloudClass))
        ))
      ));
      // JourneyWorldAnimationCoordinator.exit reverses units, so main last here exits first.
      if (mainIndex >= 0 && mainIndex < groups.length - 1) {
        const [mainGroup] = groups.splice(mainIndex, 1);
        groups.push(mainGroup);
      }
    }

    if (Number.isFinite(lastBoardId) && lastBoardId > 0) {
      const lastIndex = groups.findIndex((group) => (
        group.some((target) => this.getJourneyV700BoardIdForTarget(target) === lastBoardId)
      ));
      if (lastIndex >= 0 && lastIndex < groups.length - 1) {
        const [lastGroup] = groups.splice(lastIndex, 1);
        groups.push(lastGroup);
      }
    }

    return groups;
  }

  private getJourneyV700AnimationUnits(
    container: HTMLElement,
    worldId: number | null,
    options: { excludeBoardId?: number | null; lastBoardId?: number | null; mainExitFirst?: boolean } = {}
  ): JourneyWorldAnimationUnit[] {
    const lastBoardId = Number(options.lastBoardId || 0);
    const groups = this.getJourneyV700WorldTargetGroups(container, worldId, options);
    return groups.map((targets, index) => {
      const id = targets[0]?.dataset.journeyAreaId || `world-unit-${index + 1}`;
      const boardId = this.getJourneyV700BoardIdForTarget(
        targets.find((target) => this.getJourneyV700BoardIdForTarget(target) > 0) || targets[0]
      );
      const clouds = Array.from(new Set(targets.flatMap((target) => {
        const descendants = Array.from(
          target.querySelectorAll<HTMLElement>('.journey-forest-cloud-art')
        );
        return target.classList.contains('journey-forest-cloud-art')
          ? [target, ...descendants]
          : descendants;
      })));
      return {
        id,
        // Lifecycle targets are exactly the canonical area owners returned by
        // the renderer. Descendant clouds are idle-only layers; including both
        // a parent Unit and its child here would compound enter/exit transforms.
        targets: Array.from(new Set(targets)),
        clouds,
        enterDelayOffset: Number.isFinite(lastBoardId) && lastBoardId > 0 && boardId === lastBoardId
          ? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ? 0.075 : 0.24)
          : undefined,
      };
    });
  }

  private primeJourneyV700WorldEnter(
    container: HTMLElement,
    worldId: number,
    options: { source?: string; lastBoardId?: number | null } = {}
  ): void {
    const units = this.getJourneyV700AnimationUnits(container, worldId, {
      lastBoardId: options.lastBoardId ?? this.getLastActiveJourneyBoardAreaId(),
    });
    if (!units.length) {
      this.journeyV700PreparedWorldEnter = null;
      return;
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const motion = getJourneyV700MotionProfile(reducedMotion);
    const allTargets = Array.from(new Set(units.flatMap((unit) => unit.targets)));
    this.clearJourneyAreaIdleStartTimeout();
    this.cleanupJourneyAreaIdleAnimations(false);

    try {
      gsap.killTweensOf(allTargets);
      allTargets.forEach((target) => {
        setJourneyAlienBeamIdleReady(target, false);
        target.style.visibility = 'visible';
        target.style.pointerEvents = 'none';
        restoreJourneyAreaTransformOrigin(target);
      });
      gsap.set(allTargets, {
        y: motion.enter.y,
        scale: motion.enter.scale,
        opacity: 0,
        visibility: 'visible',
        force3D: true,
        overwrite: true,
      });
      this.journeyV700PreparedWorldEnter = { worldId, targets: allTargets };
      emitIOSNativeDiagnostic('world-enter-primed-before-screen-reveal', {
        worldId,
        source: options.source || 'unknown',
        unitCount: units.length,
        targetCount: allTargets.length,
      });
    } catch (error) {
      this.journeyV700PreparedWorldEnter = null;
      this.logJourneyV700Flow('world-enter-prime-error', {
        worldId,
        source: options.source || 'unknown',
        error: error instanceof Error ? error.message : String(error),
      }, container);
    }
  }

  public playJourneyV700WorldEnterFromReturn(source = 'journey-return'): void {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    const worldId = this.journeyV700WorldId || Number((window as any).__ccJourneyV700WorldId || localStorage.getItem(JOURNEY_V700_WORLD_STORAGE_KEY) || 0);
    const isWorldView =
      this.journeyV700View === 'world' ||
      container?.dataset.journeyV700View === 'world' ||
      (window as any).__ccJourneyV700View === 'world' ||
      localStorage.getItem(JOURNEY_V700_VIEW_STORAGE_KEY) === 'world';

    if (!container || !isWorldView || !Number.isFinite(worldId) || worldId <= 0) {
      this.logJourneyV700Flow('world-return-enter-skip', {
        source,
        hasContainer: !!container,
        isWorldView,
        worldId,
      }, container);
      return;
    }

    delete (window as any).__ccSuppressJourneyV700AutoWorldEnter;
    this.journeyV700View = 'world';
    this.journeyV700WorldId = worldId;
    container.dataset.journeyV700View = 'world';
    container.dataset.journeyV700WorldId = String(worldId);
    this.playJourneyV700WorldEnter(container, worldId, { source });
  }

  public prepareJourneyV700WorldEnterFromReturn(source = 'journey-return-pre-reveal'): boolean {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    const worldId = Number(
      this.journeyV700WorldId ||
      container?.dataset.journeyV700WorldId ||
      (window as any).__ccJourneyV700WorldId ||
      localStorage.getItem(JOURNEY_V700_WORLD_STORAGE_KEY) ||
      0
    );
    const isWorldView =
      this.journeyV700View === 'world' ||
      container?.dataset.journeyV700View === 'world' ||
      (window as any).__ccJourneyV700View === 'world' ||
      localStorage.getItem(JOURNEY_V700_VIEW_STORAGE_KEY) === 'world';

    if (!container || !isWorldView || !Number.isFinite(worldId) || worldId <= 0) {
      this.logJourneyV700Flow('world-return-prime-skip', {
        source,
        hasContainer: !!container,
        isWorldView,
        worldId,
      }, container);
      return false;
    }

    this.journeyV700View = 'world';
    this.journeyV700WorldId = worldId;
    container.dataset.journeyV700View = 'world';
    container.dataset.journeyV700WorldId = String(worldId);
    this.primeJourneyV700WorldEnter(container, worldId, {
      source,
      lastBoardId: this.getLastActiveJourneyBoardAreaId(),
    });
    return true;
  }

  private playJourneyV700WorldEnter(
    container: HTMLElement,
    worldId: number,
    options: {
      source?: string;
      lastBoardId?: number | null;
      waitForImages?: boolean;
    } = {}
  ): void {
    const units = this.getJourneyV700AnimationUnits(container, worldId, {
      lastBoardId: options.lastBoardId ?? this.getLastActiveJourneyBoardAreaId(),
    });
    const source = options.source || 'default';
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const motion = getJourneyV700MotionProfile(reducedMotion);
    const motionEpoch = ++this.journeyV700WorldMotionEpoch;
    this.journeyV700Phase = 'entering';
    this.logJourneyV700Flow('world-enter-start', {
      worldId,
      groupCount: units.length,
      source,
      lastBoardId: options.lastBoardId ?? this.getLastActiveJourneyBoardAreaId(),
      benchmark: motion.enter,
      units: units.map((unit, index) => ({
        index,
        areaId: unit.id,
        clouds: unit.clouds.length,
        islands: unit.targets.filter((target) => target.classList.contains('journey-forest-island-art')).length,
        stumps: unit.targets.filter((target) => target.classList.contains('journey-forest-stump-art')).length,
        stars: unit.targets.filter((target) => target.classList.contains('journey-forest-star-art')).length,
        cardsOrNumbers: unit.targets.filter((target) => target.classList.contains('journey-board-card-wrapper')).length,
      })),
    }, container);
    emitIOSNativeDiagnostic('world-enter-start', {
      worldId,
      source,
      unitCount: units.length,
      units: units.map((unit) => ({ id: unit.id, targets: unit.targets.length })),
    });
    if (!units.length) return;
    this.clearJourneyAreaIdleStartTimeout();
    this.cleanupJourneyAreaIdleAnimations(false);
    const allTargets = Array.from(new Set(units.flatMap((unit) => unit.targets)));
    const preparedWorldEnter = this.journeyV700PreparedWorldEnter;
    const preparedTargetSet = preparedWorldEnter ? new Set(preparedWorldEnter.targets) : null;
    const canReusePreparedTargets = preparedWorldEnter?.worldId === worldId &&
      preparedWorldEnter.targets.length === allTargets.length &&
      allTargets.every((target) => preparedTargetSet?.has(target));
    this.journeyV700PreparedWorldEnter = null;
    let targetsPrimed = canReusePreparedTargets;
    try {
      if (!canReusePreparedTargets) {
        gsap.killTweensOf(allTargets);
        allTargets.forEach((target) => {
          setJourneyAlienBeamIdleReady(target, false);
          target.style.visibility = 'visible';
          target.style.pointerEvents = 'none';
          restoreJourneyAreaTransformOrigin(target);
        });
        gsap.set(allTargets, {
          y: motion.enter.y,
          scale: motion.enter.scale,
          opacity: 0,
          visibility: 'visible',
          force3D: true,
        });
        targetsPrimed = true;
      }
      console.log('🧩 JourneyUnitExit world-enter-targets-prepared-visible', {
        worldId,
        source,
        targetCount: allTargets.length,
        reusedPreRevealPreparation: canReusePreparedTargets,
        hiddenAfterPrepare: allTargets.filter((target) => target.style.visibility === 'hidden').length,
      });
    } catch {
      targetsPrimed = false;
    }

    emitIOSNativeDiagnostic('world-enter-preparation-ready', {
      worldId,
      source,
      targetCount: allTargets.length,
      reusedPreRevealPreparation: canReusePreparedTargets,
    });
    const finishWorldEnterAudit = source.includes('game-return')
      ? startIOSJourneyWorldEnterAudit({ worldId, source, unitCount: units.length, targetCount: allTargets.length })
      : () => {};

    const images = Array.from(new Set(allTargets.flatMap((target) => (
      target instanceof HTMLImageElement
        ? [target]
        : Array.from(target.querySelectorAll<HTMLImageElement>('img'))
    ))));
    const imageReadiness = options.waitForImages === false
      ? Promise.resolve()
      : Promise.all(images.map((image) => waitForImageReady(image))).then(() => undefined);
    void imageReadiness.then(async () => {
      if (
        this.journeyV700WorldMotionEpoch !== motionEpoch ||
        this.journeyV700Phase !== 'entering' ||
        this.journeyV700View !== 'world' ||
        this.journeyV700WorldId !== worldId ||
        !document.body.contains(container)
      ) {
        finishWorldEnterAudit('stale-before-enter');
        return;
      }

      this.logJourneyV700Flow('world-enter-images-ready', {
        worldId,
        source,
        imageCount: images.length,
        unitCount: units.length,
      }, container);
      emitIOSNativeDiagnostic('world-enter-images-ready', {
        worldId,
        source,
        imageCount: images.length,
        unitCount: units.length,
      });
      // Spatial motion owns CSS translate while the enter coordinator owns
      // transform. Start that independent owner before the cascade so an
      // already-authorized gyro cannot apply one late all-Unit position jump.
      journeySpatialMotion.activateJourneyWorld(container, worldId);
      await this.journeyWorldAnimation.enter(units, reducedMotion, { targetsPrimed });
      // An early X interrupts the enter timeline. Its promise resolves through
      // onInterrupt, but that does not grant the stale enter continuation
      // permission to restore final opacity/scale over the active exit.
      if (
        this.journeyV700WorldMotionEpoch !== motionEpoch ||
        this.journeyV700Phase !== 'entering' ||
        this.journeyV700View !== 'world' ||
        this.journeyV700WorldId !== worldId
      ) {
        finishWorldEnterAudit('stale-after-enter');
        return;
      }
      finishWorldEnterAudit('complete');
      emitIOSNativeDiagnostic('world-enter-complete', { worldId, source, unitCount: units.length });
      this.journeyV700Phase = 'idle';
      allTargets.forEach((target) => {
        if (target.classList.contains('journey-robo-alien-beam-art') || target.querySelector('.journey-robo-alien-beam-art')) {
          target.style.removeProperty('opacity');
          setJourneyAlienBeamIdleReady(target, true);
        }
      });
      if (source.includes('game-return')) {
        const activeBoardId = this.getLastActiveJourneyBoardAreaId();
        if (activeBoardId) {
          this.clearLastActiveJourneyBoardAreaId(activeBoardId);
        }
        this.activeBoardAreaEnterInProgress = false;
        this.activeBoardAreaEnterPreparedTargets = [];
        this.resumeInterimCardIdleEffects(source);
      } else {
        this.resumeInterimCardIdleEffects(source);
      }
      if (source === 'default') {
        this.restoreOrScrollToInterimCard();
      }
      this.logJourneyV700Flow('world-enter-complete', { worldId, source }, container);
    }).catch((error) => {
      finishWorldEnterAudit('error');
      this.logJourneyV700Flow('world-enter-error', { worldId, error: error instanceof Error ? error.message : String(error) }, container);
    });
  }

  private playJourneyV700WorldExit(
    container: HTMLElement,
    onComplete: () => void,
    options: { excludeBoardId?: number | null } = {}
  ): void {
    journeySpatialMotion.suspend();
    this.journeyV700PreparedWorldEnter = null;
    ++this.journeyV700WorldMotionEpoch;
    const units = this.getJourneyV700AnimationUnits(container, this.journeyV700WorldId, {
      excludeBoardId: options.excludeBoardId,
      mainExitFirst: true,
    });
    console.log('🧩 JourneyUnitExit world-exit-units-ready', {
      worldId: this.journeyV700WorldId,
      excludeBoardId: options.excludeBoardId || null,
      groupCount: units.length,
      groups: units.map((unit, index) => ({
        index,
        id: unit.id,
        targetCount: unit.targets.length,
        cardCount: unit.targets.filter((target) => target.classList.contains('journey-board-card-wrapper')).length,
      })),
    });
    this.logJourneyV700Flow('world-exit-start', {
      worldId: this.journeyV700WorldId,
      excludeBoardId: options.excludeBoardId || null,
      groupCount: units.length,
      groups: units.map((unit, index) => ({
        index,
        size: unit.targets.length,
        cardCount: unit.targets.filter((target) => target.classList.contains('journey-board-card-wrapper')).length,
        areaId: unit.id,
      })),
    }, container);
    if (!units.length) {
      this.logJourneyV700Flow('world-exit-no-groups-complete', {}, container);
      onComplete();
      return;
    }

    this.journeyV700Phase = 'exiting';
    this.clearJourneyAreaIdleStartTimeout();
    this.cleanupJourneyAreaIdleAnimations(false);
    units.flatMap((unit) => unit.targets).forEach((target) => {
      setJourneyAlienBeamIdleReady(target, false);
    });
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    void this.journeyWorldAnimation.exit(units, reducedMotion).then(() => {
      this.logJourneyV700Flow('world-exit-complete', { source: 'coordinator' }, container);
      onComplete();
    }).catch((error) => {
      this.logJourneyV700Flow('world-exit-error', { error: error instanceof Error ? error.message : String(error) }, container);
      onComplete();
    });
  }

  private applyJourneyV700WorldHeights(container: HTMLElement): void {
    const bgContainer = container.querySelector('.journey-bg-container') as HTMLElement | null;
    const decorContainer = container.querySelector('.journey-decor-container') as HTMLElement | null;
    const cardsContainer = container.querySelector('.journey-cards-container') as HTMLElement | null;
    const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
    const worldHeightPx = viewportWidth * (FOREST_MAP_DESIGN_HEIGHT / FOREST_MAP_DESIGN_WIDTH);
    const scopedHeight = Math.max(worldHeightPx + JOURNEY_V700_WORLD_BOTTOM_ROOM_PX, window.innerHeight * 1.45);

    container.style.height = `${scopedHeight}px`;
    container.style.minHeight = `${scopedHeight}px`;
    if (bgContainer) bgContainer.style.height = `${worldHeightPx}px`;
    if (decorContainer) decorContainer.style.height = `${worldHeightPx}px`;
    if (cardsContainer) cardsContainer.style.height = `${scopedHeight}px`;
  }

  private updateJourneyV700Nav(view: 'hub' | 'world', worldId: number | null = null): void {
    const title = document.getElementById('collectibles-title') as HTMLElement | null;
    const backButton = document.getElementById('collectibles-back') as HTMLButtonElement | null;
    const backIcon = backButton?.querySelector('img') as HTMLImageElement | null;
    const meta = worldId ? JOURNEY_WORLD_LABELS[worldId] : null;

    if (title) {
      title.textContent = view === 'world' && meta ? meta.name : 'Journey';
    }

    if (backButton) {
      backButton.setAttribute('aria-label', view === 'world' ? 'Close world' : 'Back to slider');
      backButton.classList.toggle('journey-v700-nav-close', view === 'world');

      if (this.journeyV700NavCloseHandler) {
        backButton.removeEventListener('click', this.journeyV700NavCloseHandler, { capture: true } as any);
        backButton.removeEventListener('touchend', this.journeyV700NavCloseHandler, { capture: true } as any);
        this.journeyV700NavCloseHandler = null;
      }

	      if (view === 'world') {
	        this.journeyV700NavCloseHandler = (event: Event) => {
	          if (event.cancelable) event.preventDefault();
	          event.stopPropagation();
	          (event as any).stopImmediatePropagation?.();
	          this.logJourneyV700Flow('nav-close-handler-fired', { eventType: event.type }, document.getElementById('journey-boards-container') as HTMLElement | null);
	          playNavIconCartoonBounce(backButton);
	          this.closeJourneyV700World();
	        };
        backButton.addEventListener('click', this.journeyV700NavCloseHandler, { capture: true });
        backButton.addEventListener('touchend', this.journeyV700NavCloseHandler, { capture: true, passive: false } as any);
      }
    }

    if (backIcon) {
      backIcon.src = view === 'world' ? './assets/close-icon.png' : './assets/chevron-back.png';
    }
  }

  private getJourneyV700NavTargets(): HTMLElement[] {
    return [
      document.querySelector('#journey-screen .collectibles-header') as HTMLElement | null,
    ].filter((target): target is HTMLElement => !!target && document.body.contains(target));
  }

	  private playJourneyV700NavExit(): Promise<void> {
	    const targets = this.getJourneyV700NavTargets();
	    this.logJourneyV700Flow('nav-exit-start', { targetCount: targets.length }, document.getElementById('journey-boards-container') as HTMLElement | null);
	    if (!targets.length) {
	      this.logJourneyV700Flow('nav-exit-no-targets', {}, document.getElementById('journey-boards-container') as HTMLElement | null);
	      return Promise.resolve();
	    }
	    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
	    const motion = getJourneyV700MotionProfile(reducedMotion);

	    return new Promise((resolve) => {
	      let completed = false;
      const completeOnce = (source: string) => {
        if (completed) return;
        completed = true;
        this.logJourneyV700Flow('nav-exit-complete', { targetCount: targets.length, source }, document.getElementById('journey-boards-container') as HTMLElement | null);
        resolve();
      };
      const fallbackTimer = window.setTimeout(() => {
        this.logJourneyV700Flow('nav-exit-timeout-fallback', { targetCount: targets.length }, document.getElementById('journey-boards-container') as HTMLElement | null);
        completeOnce('timeout-fallback');
	      }, Math.ceil(motion.exit.duration * 1000) + 220);
	      try {
	        gsap.killTweensOf(targets);
	        gsap.set(targets, {
	          scale: 1,
	          opacity: 1,
	          transformOrigin: '50% 0%',
	          visibility: 'visible',
	          force3D: true,
	          overwrite: true,
	        });
	        gsap.to(targets, {
	          y: -10,
	          scale: 0.04,
	          opacity: 0,
	          duration: motion.exit.duration,
	          ease: motion.exit.ease,
	          force3D: true,
	          overwrite: true,
	          onComplete: () => {
            window.clearTimeout(fallbackTimer);
            completeOnce('tween-complete');
          },
        });
      } catch (error) {
        window.clearTimeout(fallbackTimer);
        this.logJourneyV700Flow('nav-exit-error', { error: error instanceof Error ? error.message : String(error) }, document.getElementById('journey-boards-container') as HTMLElement | null);
        completeOnce('error-fallback');
      }
    });
  }

		  private playJourneyV700NavEnter(options: { transformOrigin?: string; delay?: number } = {}): void {
		    const targets = this.getJourneyV700NavTargets();
		    this.logJourneyV700Flow('nav-enter-start', { targetCount: targets.length }, document.getElementById('journey-boards-container') as HTMLElement | null);
		    if (!targets.length) {
		      this.logJourneyV700Flow('nav-enter-no-targets', {}, document.getElementById('journey-boards-container') as HTMLElement | null);
		      return;
		    }
		    const transformOrigin = options.transformOrigin || '50% 0%';
		    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
		    const motion = getJourneyV700MotionProfile(reducedMotion);
		    const delay = Number.isFinite(options.delay) ? Number(options.delay) : motion.enter.baseDelay;

		    try {
		      gsap.killTweensOf(targets);
	      gsap.fromTo(
	        targets,
		        {
		          scale: motion.enter.scale,
		          y: -10,
		          opacity: 0,
		          visibility: 'visible',
		          transformOrigin,
	          force3D: true,
	        },
		        {
	          scale: 1,
	          y: 0,
	          opacity: 1,
	          duration: motion.enter.duration,
	          delay,
		          ease: motion.enter.ease,
		          force3D: true,
		          overwrite: true,
		          onComplete: () => {
            targets.forEach((target) => {
              try { gsap.set(target, { clearProps: 'transform,opacity,visibility,transformOrigin' }); } catch {}
            });
            this.logJourneyV700Flow('nav-enter-complete', { targetCount: targets.length }, document.getElementById('journey-boards-container') as HTMLElement | null);
          },
        }
      );
    } catch (error) {
      this.logJourneyV700Flow('nav-enter-error', { error: error instanceof Error ? error.message : String(error) }, document.getElementById('journey-boards-container') as HTMLElement | null);
    }
  }

  private closeJourneyV700World(): void {
    const container = document.getElementById('journey-boards-container') as HTMLElement | null;
    if (!container) {
      this.logJourneyV700Flow('close-world-no-container');
      return;
    }
    this.logJourneyV700Flow('close-world-start', {}, container);
    journeySpatialMotion.suspend();
    if (this.journeyV700View !== 'world') {
      this.logJourneyV700Flow('close-world-ignored-not-world', {}, container);
      return;
    }
    if ((container as any).__ccJourneyV700Closing === true) {
      this.logJourneyV700Flow('close-world-ignored-already-closing', {}, container);
      return;
    }
    (container as any).__ccJourneyV700Closing = true;

    try { (window as any).triggerHapticImpact?.('light'); } catch {}
    const navExitPromise = this.playJourneyV700NavExit();
    let completed = false;
    const complete = async () => {
      if (completed) {
        this.logJourneyV700Flow('close-world-complete-ignored-duplicate', {}, container);
        return;
      }
      completed = true;
      this.logJourneyV700Flow('close-world-content-exit-complete-await-nav', {}, container);
      await navExitPromise;
      this.logJourneyV700Flow('close-world-nav-exit-complete-render-hub', {}, container);
      try {
        this.setJourneyV700View('hub');
        this.updateJourneyV700Nav('hub');
        (container as any).__ccJourneyV700Closing = false;
        (container as any).__ccJourneyV700ReturningFromWorld = true;
        this.renderBoards();
        this.trackTimeout(() => this.playJourneyV700NavEnter(), 120);
        this.logJourneyV700Flow('close-world-rendered-hub', {}, document.getElementById('journey-boards-container') as HTMLElement | null);
      } catch (error) {
        (container as any).__ccJourneyV700Closing = false;
        this.logJourneyV700Flow('close-world-render-hub-error', { error: error instanceof Error ? error.message : String(error) }, container);
        throw error;
      }
    };

    try {
      this.playJourneyV700WorldExit(container, complete);
    } catch (error) {
      this.logJourneyV700Flow('close-world-exit-error-fallback', { error: error instanceof Error ? error.message : String(error) }, container);
      complete();
    }
  }

  private markJourneyDevBoardRefresh(reason: string): void {
    try {
      (window as any).__ccJourneyDevBoardsDirty = true;
      localStorage.setItem(JOURNEY_DEV_BOARD_REFRESH_KEY, 'true');
      logger.info(`🗺️ Journey dev board refresh marked dirty: ${reason}`);
    } catch (error) {
      logger.warn('⚠️ Failed to mark Journey dev board refresh dirty:', error instanceof Error ? error.message : String(error));
    }
  }

  public consumeJourneyDevBoardRefresh(): boolean {
    const win = window as any;
    let isDirty = win.__ccJourneyDevBoardsDirty === true;
    try {
      isDirty = isDirty || localStorage.getItem(JOURNEY_DEV_BOARD_REFRESH_KEY) === 'true';
    } catch {}
    if (isDirty) {
      try {
        delete win.__ccJourneyDevBoardsDirty;
        localStorage.removeItem(JOURNEY_DEV_BOARD_REFRESH_KEY);
        logger.info('🗺️ Journey dev board refresh consumed - forcing board rerender');
      } catch (error) {
        logger.warn('⚠️ Failed to clear Journey dev board refresh marker:', error instanceof Error ? error.message : String(error));
      }
    }
    return isDirty;
  }

  private renderBoardsFixed(container: HTMLElement): void {
    // 🔥 APP STORE FIX: Fixed background position using viewport units
    // Background starts at a fixed position from top of viewport
    // Based on iPhone 13/14 layout: header + section header + spacing = ~50px from top (moved up 150px)
    // Convert to viewport height units for consistency
    const FIXED_BG_TOP_VH = pxToVH(JOURNEY_CONTENT_TOP_PX, BASE_VIEWPORT_HEIGHT); // Shared Journey content top anchor
    
    const img = new Image();
    const KNOWN_ASPECT_RATIO = FOREST_MAP_DESIGN_HEIGHT / FOREST_MAP_DESIGN_WIDTH;
    
    // 🔥 CRITICAL: Set image src - if already in browser cache, onload fires immediately
    img.src = `${FOREST_WORLD_ASSET_BASE}/Forest main.png`;
    
    // If image is already in browser cache, trigger onload immediately
    if (img.complete && img.naturalWidth > 0) {
      // Image already loaded from cache - trigger onload handler immediately
      setTimeout(() => {
        if (img.onload) img.onload(new Event('load') as any);
      }, 0);
    }
    
    // Load image and calculate dimensions
    img.onload = () => {
      if (this.renderDisposed || !document.body.contains(container)) return;
      const imageAspectRatio = KNOWN_ASPECT_RATIO;
      const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
      const bgHeightPx = viewportWidth * imageAspectRatio; // Calculate height in pixels based on viewport width
      
      // 🔥 SCROLLABLE FIX: Put elements INSIDE journey-boards-container so they scroll with content
      // Calculate top offset in pixels for absolute positioning within container
      const FIXED_BG_TOP_PX = getJourneyWorldContentTopPx();
      const FIXED_CARD_TOP_PX = getJourneyWorldCardStackTopPx();
      
      // Set container height to accommodate FULL background image height + top offset
      const containerHeightPx = bgHeightPx + Math.max(FIXED_BG_TOP_PX, FIXED_CARD_TOP_PX) + JOURNEY_BOARDSTACK_BOTTOM_ROOM_PX;
      container.style.height = `${containerHeightPx}px`;
      container.style.position = 'relative';
      container.style.width = '100%';
      container.style.minHeight = `${containerHeightPx}px`;
      container.style.overflow = 'visible'; // Ensure container doesn't clip background
      
      // Update background container height
      const bgContainer = container.querySelector('.journey-bg-container') as HTMLElement;
      if (bgContainer) {
        bgContainer.style.height = `${bgHeightPx}px`; // Set exact height to show full image
      }

      const decorContainer = container.querySelector('.journey-decor-container') as HTMLElement;
      if (decorContainer) {
        decorContainer.style.height = `${bgHeightPx}px`;
      }
      
      // Update cards container height
      const cardsContainer = container.querySelector('.journey-cards-container') as HTMLElement;
      if (cardsContainer) {
        cardsContainer.style.height = `${containerHeightPx}px`; // Full Journey stack so high-board smoke can render
      }

      if (this.journeyV700View === 'world' && this.journeyV700WorldId) {
        this.applyJourneyV700WorldHeights(container);
      }
    };

    img.onerror = () => {
      if (this.renderDisposed || !document.body.contains(container)) return;
      // Fallback to known aspect ratio if image fails to load
      const imageAspectRatio = KNOWN_ASPECT_RATIO;
      const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
      const bgHeightPx = viewportWidth * imageAspectRatio;
      const FIXED_BG_TOP_PX = getJourneyWorldContentTopPx();
      const FIXED_CARD_TOP_PX = getJourneyWorldCardStackTopPx();
      const containerHeightPx = bgHeightPx + Math.max(FIXED_BG_TOP_PX, FIXED_CARD_TOP_PX) + JOURNEY_BOARDSTACK_BOTTOM_ROOM_PX;
      container.style.height = `${containerHeightPx}px`;
      container.style.minHeight = `${containerHeightPx}px`;
      container.style.overflow = 'visible';
      if (this.journeyV700View === 'world' && this.journeyV700WorldId) {
        this.applyJourneyV700WorldHeights(container);
      }
    };
    
    // Use fallback aspect ratio for initial calculation
    const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
    const initialBgHeightPx = viewportWidth * KNOWN_ASPECT_RATIO;
    const FIXED_BG_TOP_PX = getJourneyWorldContentTopPx();
    const FIXED_CARD_TOP_PX = getJourneyWorldCardStackTopPx();
    const initialContainerHeightPx = initialBgHeightPx + Math.max(FIXED_BG_TOP_PX, FIXED_CARD_TOP_PX) + JOURNEY_BOARDSTACK_BOTTOM_ROOM_PX;
    
    // Set initial container height
    container.style.height = `${initialContainerHeightPx}px`;
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.minHeight = `${initialContainerHeightPx}px`;
    container.style.overflow = 'visible'; // Ensure container doesn't clip background
    
    // Get padding values from CSS custom properties or use defaults
    const scrollableArea = container.closest('.collectibles-scrollable') as HTMLElement;
    
    // 🔥 FIX: Allow parent scrollable container to show full background image
    if (scrollableArea) {
      scrollableArea.style.overflowX = 'visible'; // Allow horizontal overflow for full background image
    }
    
    // Create background image container - ABSOLUTE position within journey-boards-container
    // Set ALL critical styles inline to ensure visibility and edge-to-edge positioning
    const bgContainer = document.createElement('div');
    bgContainer.className = 'journey-bg-container';
    const padLeft = scrollableArea ? 
      parseInt(getComputedStyle(scrollableArea).getPropertyValue('--pad-left') || '40', 10) : 40;
    const padRight = scrollableArea ? 
      parseInt(getComputedStyle(scrollableArea).getPropertyValue('--pad-right') || '40', 10) : 40;
    
    // Use viewport width directly for true edge-to-edge (not relative to parent)
    const vw = window.innerWidth;
    
    // Position and size - edge-to-edge using viewport width directly
    bgContainer.style.position = 'absolute';
    bgContainer.style.top = `${FIXED_BG_TOP_PX}px`;
    bgContainer.style.height = `${initialBgHeightPx}px`; // Will be updated when image loads
    bgContainer.style.left = `-${padLeft}px`; // Negative left to extend beyond parent padding
    bgContainer.style.width = `${vw}px`; // Use viewport width directly for true edge-to-edge
    
    // Background image styles
    bgContainer.style.backgroundImage = 'none';
    bgContainer.style.backgroundSize = 'auto';
    bgContainer.style.backgroundPosition = 'top center';
    bgContainer.style.backgroundRepeat = 'no-repeat';
    
    // Visibility and stacking
    bgContainer.style.zIndex = '1';
    bgContainer.style.margin = '0';
    bgContainer.style.padding = '0';
    bgContainer.style.display = 'block';
    bgContainer.style.visibility = 'visible';
    bgContainer.style.opacity = '1';
    bgContainer.style.overflow = 'visible'; // Don't clip background image
    
    // Append to container (journey-boards-container) so it scrolls with content
    container.appendChild(bgContainer);

    const decorContainer = document.createElement('div');
    decorContainer.className = 'journey-decor-container';
    decorContainer.style.position = 'absolute';
    decorContainer.style.top = `${FIXED_BG_TOP_PX}px`;
    decorContainer.style.height = `${initialBgHeightPx}px`;
    decorContainer.style.left = `-${padLeft}px`;
    decorContainer.style.width = `${vw}px`;
    decorContainer.style.display = 'block';
    decorContainer.style.visibility = 'visible';
    decorContainer.style.opacity = '1';
    container.appendChild(decorContainer);

    this.renderForestMapAssets(bgContainer, decorContainer);
    
    // Create cards container - also ABSOLUTE position within journey-boards-container
    // Set critical dynamic values inline (top, height) - static styles in CSS
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'journey-cards-container';
    // Critical dynamic values must be inline to ensure they're applied
    cardsContainer.style.top = `${FIXED_CARD_TOP_PX}px`;
    cardsContainer.style.height = `${initialContainerHeightPx}px`; // Full Journey stack; updated when image loads
    
    // Append to container (journey-boards-container) so it scrolls with content
    container.appendChild(cardsContainer);

    // Render cards with FIXED viewport-based positions
    this.boards.slice(0, JOURNEY_RENDERED_BOARDS).forEach((board, index) => {
      const cardElement = this.createBoardCardFixed(board, index);
      cardsContainer.appendChild(cardElement);
    });
    this.trackTimeout(() => {
      this.installInterimAreaHitTargets(cardsContainer);
    }, 0);
    // Forest scene idle starts after playJourneyForestSceneEnterAnimation().
    
    // 🔥 CRITICAL: DO NOT start idle bounce animations here - they will interfere with enter animation
    // Idle bounce animations will be started AFTER enter animation completes
    // (moved to collectibles-manager.ts after animateCollectiblesScreenEnter completes)
    // This prevents jerky/laggy behavior on mobile when 16 cards try to animate during enter animation
    
    // Only install interaction listeners during render. The complete interim
    // idle session starts after the visible Journey enter reaches idle.
    requestAnimationFrame(() => {
      this.setupIdleInteractionListeners();
    });
  }
  
  private setupIdleInteractionListeners(): void {
    // Find scrollable container
    const scrollable = document.querySelector('.collectibles-scrollable') as HTMLElement;
    if (!scrollable) return;
    
    // Throttle function to limit notification frequency
    let throttleTimer: number | null = null;
    const notifyThrottled = () => {
      if (throttleTimer) return;
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null;
        if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction === 'function') {
          JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction();
        }
      }, 100); // Throttle to max once per 100ms
    };

    let viewportCheckTimer: number | null = null;
    const scheduleViewportCheck = () => {
      if (viewportCheckTimer !== null) return;
      viewportCheckTimer = window.setTimeout(() => {
        (scrollable as any)._journeyViewportCheckTimer = null;
        viewportCheckTimer = null;
        const scrollTarget = this.getPreferredJourneyWorldScrollTarget();
        const cardWrapper = scrollTarget?.cardWrapper || null;
        if (!cardWrapper) return;

        const cardRect = cardWrapper.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const viewportW = window.innerWidth;
        const viewportCenterX = viewportW / 2;
        const viewportCenterY = viewportH / 2;

        const tolerance = 100;
        const isCardInViewport =
          cardRect.top < viewportH + tolerance &&
          cardRect.bottom > -tolerance &&
          cardRect.left < viewportW + tolerance &&
          cardRect.right > -tolerance;

        const cardCenterX = cardRect.left + cardRect.width / 2;
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const centerDistanceX = Math.abs(cardCenterX - viewportCenterX);
        const centerDistanceY = Math.abs(cardCenterY - viewportCenterY);
        const isCardReasonablyCentered = centerDistanceX < 150 && centerDistanceY < 150;

        if (isCardInViewport && isCardReasonablyCentered) {
          try {
            localStorage.setItem('__ccInterimCardInViewport', 'true');
            logger.info('🗺️ Journey world target scrolled into viewport - saved state', {
              boardId: scrollTarget?.boardId,
              worldId: scrollTarget?.worldId,
              reason: scrollTarget?.reason,
            });
          } catch (e) {
            // Ignore errors
          }
        }
      }, 180);
      (scrollable as any)._journeyViewportCheckTimer = viewportCheckTimer;
    };

    // Scroll listener
    const scrollHandler = () => {
      notifyThrottled();
      scrollable.classList.add('journey-scroll-active');
      if ((scrollable as any)._journeyScrollActiveTimeout) {
        window.clearTimeout((scrollable as any)._journeyScrollActiveTimeout);
      }
      (scrollable as any)._journeyScrollActiveTimeout = window.setTimeout(() => {
        scrollable.classList.remove('journey-scroll-active');
        (scrollable as any)._journeyScrollActiveTimeout = null;
      }, 180);
      scheduleViewportCheck();
    };
    scrollable.addEventListener('scroll', scrollHandler, { passive: true });
    
    // Touch/click listeners on cards container
    const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement;
    if (cardsContainer) {
      const touchHandler = (event?: Event) => {
        notifyThrottled();
        const eventTarget = event?.target as HTMLElement | null;
        const isInterimTapSurface = !!eventTarget?.closest?.('.journey-board-card.interim, .journey-interim-area-hit-target');
        if (event?.type === 'touchstart' && isInterimTapSurface) {
          return;
        }
      };
      cardsContainer.addEventListener('touchstart', touchHandler, { passive: true });
      cardsContainer.addEventListener('touchmove', touchHandler, { passive: true });
      // Store handler for cleanup
      (cardsContainer as any)._journeyIdleTouchHandler = touchHandler;
    }
    
    // Store scroll handler for cleanup
    (scrollable as any)._journeyIdleScrollHandler = scrollHandler;
  }

  private createBoardCardFixed(board: JourneyBoard, index: number): HTMLElement {
    const position = CARD_POSITIONS[index] || { x: pxToPercent(24), top: pxToPercentTop(24), rotation: 5, width: STANDARD_CARD_WIDTH, height: STANDARD_CARD_HEIGHT };
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'journey-board-card-wrapper';
    cardWrapper.dataset.boardId = String(board.id);
    cardWrapper.dataset.journeyAreaId = `board-${board.id}`;
    
    // Calculate background height in pixels
    const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
    const imageAspectRatio = FOREST_MAP_DESIGN_HEIGHT / FOREST_MAP_DESIGN_WIDTH;
    const bgHeightPx = viewportWidth * imageAspectRatio;
    
    // Convert card position to pixels
    let leftPx: number;
    const cardNumber = index + 1; // Card numbers are 1-indexed
    if (position.x === 50) {
      // Centered: 50% of container width
      leftPx = 50; // Will use percentage in CSS
    } else if (typeof position.x === 'number' && position.x < 50) {
      // Left side: convert percentage to pixels
      leftPx = (position.x / 100) * viewportWidth;
    } else {
      // Right side or percentage: convert to pixels
      const xValue = typeof position.x === 'number' ? position.x : parseFloat(String(position.x || 0));
      leftPx = (xValue / 100) * viewportWidth;
    }
    
    const isIPad = false;
    
    // 🔥 USER REQUEST: Card 02 - iPhone: move left by 80px from center (was -96px, now -80px after +16px)
    // This applies BEFORE iPad-specific adjustments
    if (cardNumber === 2 && !isIPad) {
      // iPhone only: move left by 80px from center
      if (typeof leftPx === 'number' && leftPx === 50) {
        // If centered (50%), convert to pixels first, then subtract 80px (move left)
        leftPx = (50 / 100) * viewportWidth - 80;
      } else {
        // Already in pixels, subtract 80px (move left)
        leftPx -= 80;
      }
    }
    
    // Convert top position to pixels (relative to background start)
    const topPercent = typeof position.top === 'number' ? position.top : parseFloat(String(position.top || 0));
    // topPercent is percentage of background height
    let topPx = (topPercent / 100) * bgHeightPx;
    
    // 🔥 iPad FIX: Spusti sve kartice za 10% visine kontejnera prema dole
    if (isIPad) {
      topPx += bgHeightPx * 0.1; // Dodaj 10% visine kontejnera
    }
    
    // 🔥 iPad FIX: Specifične prilagodbe pozicija za pojedinačne kartice
    if (isIPad) {
      // cardNumber is already defined above
      
      if (cardNumber === 1) {
        // Kartica 1: 40px od lijevog ruba, 16px gore
        leftPx = 40;
        topPx -= 16;
      } else if (cardNumber === 2) {
        // Kartica 2 (iPad): horizontalno centrirana u sredinu ekrana.
        topPx -= 24;
        leftPx = (viewportWidth - STANDARD_CARD_WIDTH) / 2 - 8 - 24 - 6; // centar pa 30px ulijevo
      } else if (cardNumber === 3) {
        // Kartica 3: 24px od desnog ruba, 48px gore (28px + 20px), pomjerena 128px lijevo (40px + 48px + 24px + 16px)
        leftPx = viewportWidth - STANDARD_CARD_WIDTH - 24 - 40 - 48 - 24 - 16;
        topPx -= 48; // 28px + 20px gore
      } else if (cardNumber === 4) {
        // Kartica 4: Centrirana u sredinu ekrana iPad, pomjerena 16px desno (4px lijevo + 20px desno), zatim lijevo za 10px i gore za 20px
        // Na iPad-u su kartice 1.76x veće (scale 1.76), tako da trebamo koristiti skaliranu širinu
        const scaledCardWidth = STANDARD_CARD_WIDTH * 1.76;
        leftPx = (viewportWidth / 2) - (scaledCardWidth / 2) + 16 - 10; // Pomjerena lijevo za 10px
        topPx -= 20; // Podignuta gore za 20px
      } else if (cardNumber === 5) {
        // Kartica 5: 30px od lijevog ruba iPad ekrana, 16px gore, zatim gore za 10px i desno za 10px
        leftPx = 30 + 10; // Pomjerena desno za 10px
        topPx -= 16 + 10; // Podignuta gore za 10px (ukupno 26px gore)
      } else if (cardNumber === 6) {
        // Kartica 6: Koristi istu logiku kao kartica 4 - centrirana sa offsetom
        // Na iPad-u su kartice 1.76x veće (scale 1.76), tako da trebamo koristiti skaliranu širinu
        const scaledCardWidth = STANDARD_CARD_WIDTH * 1.76;
        // Centrirana, pomjerena desno (110px od desnog ruba + 16px + 20px + 20px + 20px desno = 76px desno)
        // Izračunaj offset od centra: (viewportWidth - scaledCardWidth - 110 + 76) - (viewportWidth/2 - scaledCardWidth/2)
        const targetLeft = viewportWidth - scaledCardWidth - 110 + 76;
        const centerLeft = (viewportWidth / 2) - (scaledCardWidth / 2);
        const offset = targetLeft - centerLeft;
        leftPx = centerLeft + offset - 40; // Pomjerena lijevo za 40px
      } else if (cardNumber === 7) {
        // Kartica 7: Koristi istu logiku kao kartica 4 - centrirana sa offsetom lijevo
        // Na iPad-u su kartice 1.76x veće (scale 1.76), tako da trebamo koristiti skaliranu širinu
        const scaledCardWidth = STANDARD_CARD_WIDTH * 1.76;
        // Centrirana, pomjerena 120px lijevo (60px + 60px lijevo = -104px)
        leftPx = (viewportWidth / 2) - (scaledCardWidth / 2) - 104;
      } else if (cardNumber === 8) {
        // Kartica 8: Pomjerena desno za 40px i gore za 10px
        leftPx += 40; // Pomjerena desno za 40px
        topPx -= 10; // Podignuta gore za 10px
      } else if (cardNumber === 9) {
        // Kartica 9: Pomjerena desno za 50px + 40px = 90px i gore za 20px
        leftPx += 50 + 40; // Pomjerena desno za ukupno 90px
        topPx -= 20; // Podignuta gore za 20px
      } else if (cardNumber === 10) {
        // Kartica 10: Pomjerena gore za 90px, desno za 40px + 24px = 64px, zatim dole za 10px i lijevo za 8px, zatim dole za 0px (bez promjene)
        leftPx += 40 + 24 - 8; // Pomjerena desno za ukupno 64px, zatim lijevo za 8px = 56px desno
        topPx -= 90 - 10; // Podignuta gore za 90px, zatim spuštena za 10px = 80px gore (bez dodatne promjene)
      } else if (cardNumber === 11) {
        // Kartica 11: Pomjerena desno za 80px, zatim lijevo za 8px i gore za 8px + 20px = 28px
        leftPx += 80 - 8; // Pomjerena desno za 80px, zatim lijevo za 8px = 72px desno
        topPx -= 8 + 20; // Podignuta gore za ukupno 28px
      } else if (cardNumber === 12) {
        // Kartica 12: Pomjerena desno za 20px + 20px = 40px i gore za 40px
        leftPx += 20 + 20; // Pomjerena desno za ukupno 40px
        topPx -= 40; // Podignuta gore za 40px
      } else if (cardNumber === 13) {
        // Kartica 13: Pomjerena gore za 25px + 20px = 45px i desno za 8px, zatim desno za 20px i gore za 10px
        leftPx += 8 + 20; // Pomjerena desno za ukupno 28px
        topPx -= 25 + 20 + 10; // Podignuta gore za ukupno 55px
      } else if (cardNumber === 14) {
        // Kartica 14: Pomjerena desno za 80px i gore za 20px
        leftPx += 80; // Pomjerena desno za 80px
        topPx -= 20; // Podignuta gore za 20px
      } else if (cardNumber === 15) {
        // Kartica 15: Pomjerena desno za 60px i gore za 30px + 20px = 50px
        leftPx += 60; // Pomjerena desno za 60px
        topPx -= 30 + 20; // Podignuta gore za ukupno 50px
      } else if (cardNumber === 16) {
        // Kartica 16: Pomjerena desno za 50px + 20px = 70px i gore za 20px
        leftPx += 50 + 20; // Pomjerena desno za ukupno 70px
        topPx -= 20; // Podignuta gore za 20px
      }
    }
    
    const scaleFactor = 1;
    
    // Set absolute position using pixels
    cardWrapper.style.position = 'absolute';
    
    // Set card dimensions in pixels (keep original size, scale is applied via transform)
    const cardWidth = position.width || STANDARD_CARD_WIDTH;
    const cardHeight = position.height || STANDARD_CARD_HEIGHT;
    const wrapperWidth = cardWidth;
    const wrapperHeight = cardHeight;
    const wrapperLeftOffset = 0;
    const wrapperTopOffset = 0;
    
    // 🔥 USER REQUEST: Card 02 - ensure 40px right offset is applied on all devices
    // For card 2, always use pixel positioning (not centered) to ensure 40px offset is applied
    const isCard2 = (index + 1) === 2;
    if (position.x === 50 && !(isIPad && (index + 1 === 1 || index + 1 === 3 || index + 1 === 4 || index + 1 === 5 || index + 1 === 6 || index + 1 === 7)) && !isCard2) {
      // Centered only if not overridden by iPad-specific positioning AND not card 2
      cardWrapper.style.left = `calc(50% + ${wrapperLeftOffset}px)`;
      cardWrapper.style.transform = `translateX(calc(-50% - ${wrapperLeftOffset}px)) rotate(${position.rotation}deg) scale(${scaleFactor})`;
    } else {
      // 🔥 iPad FIX: Use direct leftPx positioning for iPad-specific cards and card 2
      // For card 2, leftPx already includes 40px offset (and 56px more on iPad)
      cardWrapper.style.left = `${leftPx + wrapperLeftOffset}px`;
      cardWrapper.style.transform = `rotate(${position.rotation}deg) scale(${scaleFactor})`;
    }
    setJourneyBoardCardBaseTransform(cardWrapper, cardWrapper.style.transform || '');
    cardWrapper.style.top = `${topPx + wrapperTopOffset}px`;
    cardWrapper.style.width = `${wrapperWidth}px`;
    cardWrapper.style.height = `${wrapperHeight}px`;
    // 🔥 FIX: Ensure wrapper has no border/outline that could cause 2px difference
    cardWrapper.style.border = 'none';
    cardWrapper.style.outline = 'none';
    cardWrapper.style.padding = '0';
    cardWrapper.style.margin = '0';
    cardWrapper.style.boxSizing = 'border-box';
    cardWrapper.style.pointerEvents = 'auto'; // Enable clicks on cards
    cardWrapper.style.zIndex = '10';
    
    // Create card element (same as before)
    const card = document.createElement('div');
    const isInterim = board.interim === true;
    const isUnlocked = board.unlocked === true;
    card.className = `journey-board-card ${isInterim ? 'interim' : isUnlocked ? 'unlocked' : 'locked'}`;
    card.dataset.boardId = board.id.toString();
    card.dataset.boardNumber = formatJourneyWorldStageNumber(board.id);

    // 🔥 USER REQUEST: Check if this board was already viewed (from localStorage)
    // Mark it as viewed so animations don't start for it
    let isViewed = false;
    if (isUnlocked && !isInterim) {
      try {
        const viewedBoardsJson = localStorage.getItem('journey_viewed_boards');
        if (viewedBoardsJson) {
          const viewedBoardIds: Set<string> = new Set(JSON.parse(viewedBoardsJson));
          if (viewedBoardIds.has(board.id.toString())) {
            card.setAttribute('data-journey-card-viewed', 'true');
            isViewed = true;
            logger.info(`✅ Board ${board.id} marked as viewed from localStorage - animations disabled`);
          }
        }
      } catch (e) {
        logger.warn('⚠️ Error checking viewed boards in localStorage:', e instanceof Error ? e.message : String(e));
      }
    }

    // 🔥 FIX: Ensure all cards (unlocked, interim, locked) exactly match wrapper dimensions
    // This prevents shadow container from being larger than the card
    card.style.width = '100%';
    card.style.height = '100%';
    card.style.boxSizing = 'border-box';
    card.style.margin = '0';
    card.style.padding = '0';
    // 🔥 FIX: Remove any border/outline that could cause 2px difference
    card.style.border = 'none';
    card.style.outline = 'none';
    
    if (isUnlocked) {
      // Unlocked card - show image and can click for details
      const cardImagePath = board.imagePath || '';
      if (cardImagePath) {
        card.style.backgroundImage = `url("${cardImagePath.replace(/"/g, '\\"')}")`;
        card.style.backgroundSize = 'contain';
        card.style.backgroundPosition = 'center center';
        card.style.backgroundRepeat = 'no-repeat';
        card.style.backgroundColor = 'transparent';
      }
      
      const image = document.createElement('img');
      // 🔥 PRODUCTION READY: Set src - if already in browser cache, image displays instantly
      image.src = cardImagePath;
      image.alt = board.name || formatGameplayProgressLabel('journey', board.id);
      image.className = 'journey-board-image journey-board-image-preload';
      // WKWebView can skip lazy images inside Journey's animated/fixed layout on
      // the first open. Load DOM-visible Journey cards immediately, while keeping
      // global startup preloads disabled so these large PNGs are not decoded early.
      image.loading = 'eager';
      (image as any).decoding = 'async';
      (image as any).fetchPriority = isViewed ? 'low' : 'auto';
      // 🔥 iOS FIX: Prevent deep touch (long press) and image dragging
      image.draggable = false; // Prevent HTML5 drag
      image.setAttribute('draggable', 'false'); // Ensure draggable is false
      image.setAttribute('aria-hidden', 'true');
      image.style.position = 'absolute';
      image.style.left = '0';
      image.style.top = '0';
      image.style.width = '1px';
      image.style.height = '1px';
      image.style.opacity = '0';
      image.style.pointerEvents = 'none';
      image.style.visibility = 'hidden';
      card.appendChild(image);

      // 🔥 USER REQUEST: Add ribbon for newly unlocked (not viewed) cards
      if (!isInterim && !isViewed && board.id !== 1) {
        const ribbon = document.createElement('div');
        ribbon.className = 'journey-card-ribbon';
        ribbon.setAttribute('role', 'img');
        ribbon.setAttribute('aria-label', 'New');
        const ribbonImage = document.createElement('img');
        ribbonImage.src = './assets/journey assets/orange-ribbon.png';
        ribbonImage.alt = '';
        ribbonImage.className = 'journey-card-ribbon-image';
        ribbonImage.draggable = false;
        ribbonImage.setAttribute('draggable', 'false');
        const ribbonShimmer = ribbonImage.cloneNode(true) as HTMLImageElement;
        ribbonShimmer.className = 'journey-card-ribbon-shimmer';
        ribbonShimmer.setAttribute('aria-hidden', 'true');
        const ribbonLabel = document.createElement('span');
        ribbonLabel.className = 'journey-card-ribbon-label';
        ribbonLabel.textContent = 'New';
        ribbonLabel.setAttribute('aria-hidden', 'true');
        ribbon.append(ribbonImage, ribbonShimmer, ribbonLabel);
        card.classList.add('has-new-ribbon');
        card.appendChild(ribbon);
        logger.info(`🎀 Added orange ribbon to newly unlocked board ${board.id}`);
      }
      
      // 🔥 iOS FIX: Prevent long press and context menu
      let longPressTimer: number | null = null;
      const preventLongPress = (e: TouchEvent) => {
        // Clear any existing timer
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        // Set timer for long press detection (iOS long press is ~500ms)
        longPressTimer = window.setTimeout(() => {
          if (e.cancelable) {
            e.preventDefault();
          }
          e.stopPropagation();
          longPressTimer = null;
        }, 300); // Prevent after 300ms (before iOS long press triggers)
      };
      
      const cancelLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };
      
      // Prevent context menu (right click or long press menu)
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      
      // Prevent drag start
      card.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      
      image.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      
      // Prevent long press on touch devices
      card.addEventListener('touchstart', preventLongPress, { passive: false });
      card.addEventListener('touchend', cancelLongPress, { passive: true });
      card.addEventListener('touchcancel', cancelLongPress, { passive: true });
      card.addEventListener('touchmove', cancelLongPress, { passive: true });
      
      // Add tap handler to open detail modal (not start game directly)
      const handleCardTap = (e: Event) => {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {}

        // Avoid duplicate trigger: ignore click right after touchend
        const now = Date.now();
        if ((card as any)._lastTapTs && now - (card as any)._lastTapTs < 350) {
          return;
        }
        (card as any)._lastTapTs = now;

        console.log('🧩 JourneyUnitExit regular-card-handler-entry', {
          boardId: board.id,
          className: card.className,
          currentView: this.journeyV700View,
          currentWorldId: this.journeyV700WorldId,
        });
        logger.info(`🖱️🖱️🖱️ CARD CLICKED FOR BOARD ${board.id}`);
        logger.info(`🔍 Board data on click:`, {
          id: board.id,
          name: board.name,
          imagePath: board.imagePath,
          interim: board.interim,
          unlocked: board.unlocked
        });
        const cardEl = card as HTMLElement;
        if (!cardEl) {
          const fallbackJourneyExitPromise = this.startBoardAreaThenJourneyExit(board.id);
          this.openBoardDetails(board, true, fallbackJourneyExitPromise).catch((error) => {
            logger.error('❌ Failed to open board details:', error);
          });
          return;
        }

        // Prevent double-tap re-entry while animation is running
        if ((cardEl as any)._openingDetail === true) {
          return;
        }
        (cardEl as any)._openingDetail = true;

        // A rapid re-open may arrive while the prior dismiss landing bounce
        // still owns the card transform. Normalize that transient owner before
        // origin capture so the modal always leases the full settled card.
        this.stopOverlayCardLandingBounce(cardEl);
        try {
          if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.pauseCardMotionForTap === 'function') {
            JOURNEY_CARD_IDLE_BOUNCE.pauseCardMotionForTap(cardEl);
          }
          cardEl.classList.remove('idle-shimmer-trigger');
          gsap.killTweensOf(cardEl);
          gsap.set(cardEl, { clearProps: 'transform' });
        } catch {}

        // Capture only after card-local squash/stretch owners are normalized.
        // The Unit wrapper still supplies the canonical settled position, but
        // transient non-uniform scale can never leak into modal geometry.
        const originLease = JOURNEY_CARD_OVERLAY_MODAL_EXPERIMENT_ENABLED
          ? acquireJourneyCardOriginLease(board.id, cardEl)
          : null;
        if (JOURNEY_CARD_OVERLAY_MODAL_EXPERIMENT_ENABLED && !originLease) {
          (cardEl as any)._openingDetail = false;
          logger.warn('⚠️ Journey card portal could not capture the live Unit pose', {
            boardId: board.id,
          });
          return;
        }

        // Notify interaction only after the portal has sampled the live pose.
        if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction === 'function') {
          JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction();
        }

        try {
          // Direct card-modal dismiss and gameplay return must share the same
          // settled landing presentation. Restoring the captured inline idle
          // transform after the portal lands produces a one-frame refresh.
          originLease?.prepareSettledLanding();
          originLease?.captureLandingGeometry();
        } catch {}

        if (JOURNEY_CARD_OVERLAY_MODAL_EXPERIMENT_ENABLED) {
          try { (window as any).triggerHapticImpact?.('light'); } catch {}
          void this.openJourneyCardOverlayExperiment(board, cardEl, originLease!)
            .catch((error) => {
              logger.error('❌ Failed to open Journey card overlay experiment:', error);
            })
            .finally(() => {
              (cardEl as any)._openingDetail = false;
            });
          return;
        }

        const journeyExitPromise = this.startBoardAreaThenJourneyExit(board.id);
        console.log('🧩 JourneyUnitExit regular-card-exit-promise-created', {
          boardId: board.id,
          hasPromise: !!journeyExitPromise,
        });

        try {
          // Haptic feedback
          if (typeof (window as any).triggerHapticImpact === 'function') {
              (window as any).triggerHapticImpact('light');
          }

          logger.info(`🚀🚀🚀 CALLING openBoardDetails FOR BOARD ${board.id}`);
          this.openBoardDetails(board, true, journeyExitPromise)
            .catch((error) => {
              logger.error('❌ Failed to open board details:', error);
            })
            .finally(() => {
              (cardEl as any)._openingDetail = false;
            });
        } catch (error) {
          (cardEl as any)._openingDetail = false;
          logger.warn('⚠️ Board area exit failed, opening detail modal immediately:', error);
          this.openBoardDetails(board, true, journeyExitPromise).catch((err) => {
            logger.error('❌ Failed to open board details:', err);
          });
        }
      };

      // Only treat as tap if finger didn't move (drag threshold)
      let touchStartX = 0;
      let touchStartY = 0;
      let touchMoved = false;
      const TAP_MOVE_THRESHOLD = 10; // px

      card.addEventListener('touchstart', (e: TouchEvent) => {
        if (!e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchMoved = false;
      }, { passive: true });

      card.addEventListener('touchmove', (e: TouchEvent) => {
        if (!e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        if ((dx * dx + dy * dy) > (TAP_MOVE_THRESHOLD * TAP_MOVE_THRESHOLD)) {
          touchMoved = true;
        }
      }, { passive: true });

      card.addEventListener('touchend', (e: TouchEvent) => {
        if (touchMoved) {
          return; // drag/scroll - do not trigger tap
        }
        handleCardTap(e);
      }, { passive: false });

      card.addEventListener('click', (e) => {
        // If touch already handled or user was dragging, ignore click
        if (touchMoved) return;
        handleCardTap(e);
      });
    } else if (isInterim) {
      // Interim card - show common back.png, clicking directly continues game (no detail modal)
      const image = document.createElement('img');
      // 🔥 PRODUCTION READY: Set src - if already in browser cache, image displays instantly
      image.src = './assets/colelctibles/common back.png';
      image.alt = `${formatGameplayProgressLabel('journey', board.id)} (interim)`;
      image.className = 'journey-board-image';
      // 🔥 CRITICAL: Set loading="eager" and fetchpriority="high" for instant display
      image.loading = 'eager';
      (image as any).fetchPriority = 'high';
      
      // 🔥 PRODUCTION READY: Verify image is in browser cache before rendering
      // If image is already loaded from cache, trigger onload immediately
      if (image.complete && image.naturalWidth > 0) {
        // Image already loaded from cache - will display instantly
        logger.debug(`✅ Interim card image (common back.png) already in browser cache for board ${board.id}`);
      } else {
        // Image not in cache yet - will load (but should be preloaded during launch screen)
        logger.debug(`⚠️ Interim card image (common back.png) not in browser cache for board ${board.id} - loading now`);
      }
      // 🔥 iOS FIX: Prevent deep touch (long press) and image dragging
      image.draggable = false;
      image.setAttribute('draggable', 'false');
      card.appendChild(image);
      
      // 🔥 iOS FIX: Prevent long press and context menu
      let longPressTimer: number | null = null;
      const preventLongPress = (e: TouchEvent) => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        longPressTimer = window.setTimeout(() => {
          if (e.cancelable) {
            e.preventDefault();
          }
          e.stopPropagation();
          longPressTimer = null;
        }, 300);
      };
      
      const cancelLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };
      
      // Prevent context menu
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      
      // Prevent drag start
      card.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      
      image.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      
      // Prevent long press on touch devices
      card.addEventListener('touchstart', preventLongPress, { passive: false });
      card.addEventListener('touchend', cancelLongPress, { passive: true });
      card.addEventListener('touchcancel', cancelLongPress, { passive: true });
      card.addEventListener('touchmove', cancelLongPress, { passive: true });
      
      // 🔥 USER REQUEST: Interim cards directly continue game (no detail modal)
      card.style.cursor = 'pointer';
      
      // 🔥 USER REQUEST: Add same tap animation as other cards (scale, rotation, shake, haptic)
      const handleInterimCardTap = async (e: Event) => {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {}

        // Avoid duplicate trigger: ignore click right after touchend
        const now = Date.now();
        if ((card as any)._lastTapTs && now - (card as any)._lastTapTs < 350) {
          return;
        }
        (card as any)._lastTapTs = now;

        console.log('🧩 JourneyUnitExit interim-card-handler-entry', {
          boardId: board.id,
          className: card.className,
          currentView: this.journeyV700View,
          currentWorldId: this.journeyV700WorldId,
        });
        logger.info(`🖱️🖱️🖱️ INTERIM CARD TAPPED FOR BOARD ${board.id}`);
        
        // Notify interaction to stop idle animations
        if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction === 'function') {
          JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction();
        }

        const cardEl = card as HTMLElement;
        if (!cardEl) {
          this.continueFromInterimBoard(board).catch((error) => {
            logger.error('❌ Failed to continue from interim board:', error);
          });
          return;
        }

        // 🔥 USER REQUEST: Save current Journey scroll position before entering game
        try {
          const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
          if (scrollable) {
            (window as any).__ccJourneyScrollTop = scrollable.scrollTop;
            try { localStorage.setItem('__ccJourneyScrollTop', String(scrollable.scrollTop)); } catch {}
          }
        } catch {}

        // Prevent double-tap re-entry while animation is running
        if ((cardEl as any)._openingGame === true) {
          return;
        }
        (cardEl as any)._openingGame = true;

        try {
          // Haptic feedback
          if (typeof (window as any).triggerHapticImpact === 'function') {
            (window as any).triggerHapticImpact('light');
          }

          // Stop only the repeating idle loop. Preserve the current visual state
          // and smoke long enough for the board-area tap exit to own the bounce-out.
          try { this.stopInterimBounce(cardEl, { restoreBase: false }); } catch {}

          const journeyExitPromise = this.startInterimAreaThenJourneyExit(board.id);
          console.log('🧩 JourneyUnitExit interim-card-exit-promise-created', {
            boardId: board.id,
            hasPromise: !!journeyExitPromise,
          });
          logger.info(`🚀🚀🚀 CALLING continueFromInterimBoard FOR BOARD ${board.id}`);
          this.continueFromInterimBoard(board, journeyExitPromise)
            .catch((error) => {
              logger.error('❌ Failed to continue from interim board:', error);
            })
            .finally(() => {
              (cardEl as any)._openingGame = false;
            });
        } catch (error) {
          (cardEl as any)._openingGame = false;
          logger.warn('⚠️ Interim card tap animation failed, continuing game immediately:', error);
          const fallbackExitPromise = this.startInterimAreaThenJourneyExit(board.id);
          this.continueFromInterimBoard(board, fallbackExitPromise).catch((err) => {
            logger.error('❌ Failed to continue from interim board:', err);
          });
        }
      };
      (cardWrapper as any)._journeyInterimTapHandler = handleInterimCardTap;
      
      // 🔥 USER REQUEST: Add tap detection (prevent triggering on drag/scroll)
      let touchStartX = 0;
      let touchStartY = 0;
      let touchMoved = false;
      const TAP_MOVE_THRESHOLD = 10; // px

      card.addEventListener('touchstart', (e: TouchEvent) => {
        if (!e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchMoved = false;
      }, { passive: true });

      card.addEventListener('touchmove', (e: TouchEvent) => {
        if (!e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        if ((dx * dx + dy * dy) > (TAP_MOVE_THRESHOLD * TAP_MOVE_THRESHOLD)) {
          touchMoved = true;
        }
      }, { passive: true });

      card.addEventListener('touchend', (e: TouchEvent) => {
        if (touchMoved) {
          return; // drag/scroll - do not trigger tap
        }
        handleInterimCardTap(e);
      }, { passive: false });

      card.addEventListener('click', (e) => {
        // If touch already handled or user was dragging, ignore click
        if (touchMoved) return;
        handleInterimCardTap(e);
      });
    } else {
      // Locked card - show journey-card-empty.png image with number overlay
      const lockedBoardImagePath = this.getLockedBoardImagePath(board.id);
      const lockedContainer = document.createElement('div');
      lockedContainer.className = 'journey-board-locked-container';
      card.classList.add('journey-board-card-number-only');
      
      if (lockedBoardImagePath) {
        // Boards 21-30 reuse existing collectible art instead of rendering as empty number-only cards.
        const image = document.createElement('img');
        image.src = lockedBoardImagePath;
        image.alt = `${formatGameplayProgressLabel('journey', board.id)} (locked)`;
        image.className = 'journey-board-image journey-board-locked-replica-image';
        image.loading = 'eager';
        (image as any).fetchPriority = 'high';
        // 🔥 iOS FIX: Prevent deep touch (long press) and image dragging
        image.draggable = false;
        image.setAttribute('draggable', 'false');
        image.addEventListener('dragstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        });
        lockedContainer.appendChild(image);
      }
      
      // Add number overlay on top of image
      const number = document.createElement('div');
      number.className = 'journey-board-number';
      number.textContent = formatJourneyWorldStageNumber(board.id);
      const lockedNumberOffset = LOCKED_BOARD_NUMBER_OFFSETS[board.id] || { x: 0, y: 32, rotation: 0 };
      number.style.setProperty('--journey-locked-number-x', `${lockedNumberOffset.x}px`);
      number.style.setProperty('--journey-locked-number-y', `${lockedNumberOffset.y}px`);
      number.style.setProperty('--journey-locked-number-rotation', `${lockedNumberOffset.rotation || 0}deg`);
      number.style.setProperty('--journey-locked-number-opacity', '0.8');
      number.style.setProperty('opacity', '0.8', 'important');
      lockedContainer.appendChild(number);
      
      // 🔥 iOS FIX: Prevent long press and context menu on locked cards
      let longPressTimer: number | null = null;
      const preventLongPress = (e: TouchEvent) => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        longPressTimer = window.setTimeout(() => {
          if (e.cancelable) {
            e.preventDefault();
          }
          e.stopPropagation();
          longPressTimer = null;
        }, 300);
      };
      
      const cancelLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };
      
      // Prevent context menu
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      
      // Prevent drag start
      card.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
      
      // Prevent long press on touch devices
      card.addEventListener('touchstart', preventLongPress, { passive: false });
      card.addEventListener('touchend', cancelLongPress, { passive: true });
      card.addEventListener('touchcancel', cancelLongPress, { passive: true });
      card.addEventListener('touchmove', cancelLongPress, { passive: true });
      
      card.appendChild(lockedContainer);
      
      // 🔥 USER REQUEST: Ensure locked cards have 100% opacity (fully visible)
      // Check current opacity and set to 100% if less than 100%
      const currentOpacity = window.getComputedStyle(card).opacity;
      const opacityValue = parseFloat(currentOpacity);
      if (isNaN(opacityValue) || opacityValue < 1.0) {
        card.style.opacity = '1';
        const wasStr = (currentOpacity != null && String(currentOpacity).trim() !== '') ? ` (was ${currentOpacity})` : '';
        logger.debug(`Set locked card ${board.id} opacity to 100%${wasStr}`);
      }
    }

    cardWrapper.appendChild(card);
    
    const currentTransform = cardWrapper.style.transform || '';
    if (currentTransform) {
      setJourneyBoardCardBaseTransform(cardWrapper, currentTransform);
    }
    
    return cardWrapper;
  }

  /**
   * 🔥 JOURNEY PROGRESSION: Handle Journey board tap - start game from this board
   */
  private async openJourneyCardOverlayExperiment(
    board: JourneyBoard,
    cardElement: HTMLElement,
    origin: JourneyCardOriginLease,
  ): Promise<void> {
    let worldPausedForOverlay = false;
    try {
      this.pauseJourneyWorldForCardOverlay('direct-card-open');
      worldPausedForOverlay = true;
      const scrollOwner = document.querySelector(
        '#journey-screen .collectibles-scrollable',
      ) as HTMLElement | null;
      if (scrollOwner) {
        (window as any).__ccJourneyScrollTop = scrollOwner.scrollTop;
        try { localStorage.setItem('__ccJourneyScrollTop', String(scrollOwner.scrollTop)); } catch {}
      }
      (window as any).__ccJourneyReturnBoardId = board.id;
      try { localStorage.setItem(JOURNEY_RETURN_BOARD_ID_KEY, String(board.id)); } catch {}

      clearJourneyInterimOrigin();
      this.rememberLastActiveJourneyWorld(board.id);

      if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.markCardAsViewed === 'function') {
        JOURNEY_CARD_IDLE_BOUNCE.markCardAsViewed(cardElement);
      }
      this.markBoardAsViewed(board.id);

      this.journeyCardOverlayModal?.dispose();
      let earlyJourneyExitPromise: Promise<void> | null = null;
      let resolveOverlayCardExit!: () => void;
      const overlayCardExit = new Promise<void>((resolve) => {
        resolveOverlayCardExit = resolve;
      });
      const controller = presentJourneyCardOverlayModal({
        boardId: board.id,
        origin,
        hasSavedState: hasResumableSavedStateForBoard(board.id, { clearInvalid: true }),
        scrollOwner,
        onCardEntrySettled: () => {
          cardElement.querySelector('.journey-card-ribbon')?.remove();
        },
        onDismissCardLanded: () => {
          this.playOverlayCardLandingBounce(cardElement);
        },
        onPlayCardReturnStart: () => {
          this.stopJourneyAreaIdleForTargets(this.getJourneyAreaElements(board.id));
        },
        onPlayCardExitStart: () => {
          if (this.renderDisposed || earlyJourneyExitPromise) return;
          earlyJourneyExitPromise = this.startOverlayPortaledCardJourneyExit(
            board.id,
            overlayCardExit,
          );
          logger.info('🧪 Journey overlay portaled card collapse started linked Journey exit', {
            boardId: board.id,
          });
        },
        onPlayCardExitComplete: () => {
          resolveOverlayCardExit();
          logger.info('🧪 Journey overlay portaled card exit completed', {
            boardId: board.id,
          });
        },
      });
      this.journeyCardOverlayModal = controller;

      logger.info('🧪 Journey card overlay experiment opened over live World', {
        boardId: board.id,
        worldId: this.journeyV700WorldId,
      });

      const result = await controller.result;
      if (this.journeyCardOverlayModal === controller) {
        this.journeyCardOverlayModal = null;
      }
      if (result !== 'play' || this.renderDisposed) {
        if (result === 'dismiss' && !this.renderDisposed) {
          this.resumeJourneyWorldAfterCardOverlay('direct-card-dismiss');
          worldPausedForOverlay = false;
        }
        return;
      }

      await this.startJourneyBoardFromOverlay(board, earlyJourneyExitPromise);
    } catch (error) {
      logger.error('❌ Journey card overlay experiment failed:', error);
      this.journeyCardOverlayModal?.dispose();
      this.journeyCardOverlayModal = null;
      origin.restoreNow();
      if (worldPausedForOverlay && !this.renderDisposed) {
        this.resumeJourneyWorldAfterCardOverlay('direct-card-error');
      }
      throw error;
    }
  }

  private async startJourneyBoardFromOverlay(
    board: JourneyBoard,
    earlyJourneyExitPromise: Promise<void> | null = null,
  ): Promise<void> {
    const boardId = board.id;
    delete (window as any).__ccSuppressJourneyShowForDirectDetailReturn;
    delete (window as any).__ccDirectDetailModalReturnActive;

    if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
      JOURNEY_CARD_IDLE_BOUNCE.stop();
    }

    this.rememberLastActiveJourneyWorld(boardId);
    const { journeyProgressionState } = await import('./journey-progression-state.js');
    journeyProgressionState.setLastOpenedBoardId(boardId);
    markJourneyCardOverlayReturn(boardId);
    markJourneyGameOrigin({ fromInterim: false });

    const hasSavedState = hasResumableSavedStateForBoard(boardId, { clearInvalid: true });
    logger.info('🧪 Journey overlay CTA starting existing World-to-game handoff', {
      boardId,
      hasSavedState,
    });

    await (earlyJourneyExitPromise ?? this.startBoardAreaThenJourneyExit(boardId));
    this.hideHomeAndJourneyScreens('Journey overlay play after World exit', {
      setJourneyZIndex: true,
      cleanup: false,
    });

    const collectiblesManager = (window as any).collectiblesManager;
    if (typeof collectiblesManager?.hideCollectibles === 'function') {
      (window as any).__ccJourneyExitMode = 'toGame';
      await collectiblesManager.hideCollectibles();
    }
    this.cleanup();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    let didStart = false;
    const startBoard = async () => {
      if (didStart) return;
      didStart = true;
      if (hasSavedState) {
        (window as any).__ccStartAtLevel = boardId;
        (window as any).__ccTriggerHudDrop = true;
        if (typeof (window as any).continueGameWithSavedState === 'function') {
          await (window as any).continueGameWithSavedState();
        } else {
          logger.error('❌ continueGameWithSavedState function not found');
        }
        return;
      }

      if (typeof (window as any).startNewRunFromJourney === 'function') {
        await (window as any).startNewRunFromJourney(boardId);
      } else {
        logger.error('❌ startNewRunFromJourney function not found');
      }
    };

    try {
      const { showBoardTransitionScreen } = await import('./board-transition-screen.js');
      await showBoardTransitionScreen({ boardNumber: boardId, onComplete: startBoard });
      await startBoard();
    } catch (error) {
      logger.warn('⚠️ Journey overlay board transition failed; starting board directly:', error);
      await startBoard();
    }
  }

  private waitForJourneyOverlayReturnReady(boardId: number): Promise<HTMLElement | null> {
    const expectedWorldId = this.getJourneyWorldIdForBoard(boardId);
    let stablePaintFrames = 0;

    return new Promise((resolve) => {
      const sample = () => {
        if (this.renderDisposed) {
          resolve(null);
          return;
        }
        const container = document.getElementById('journey-boards-container');
        const target = container?.querySelector<HTMLElement>(
          `.journey-board-card[data-board-id="${boardId}"]`,
        ) ?? null;
        const wrapper = target?.closest<HTMLElement>('.journey-board-card-wrapper');
        const journeyScreen = document.getElementById('journey-screen');
        const phaseCanLaunch = this.journeyV700Phase === 'idle';
        const ready = !!target
          && !!wrapper
          && target.isConnected
          && wrapper.isConnected
          && this.journeyV700View === 'world'
          && phaseCanLaunch
          && this.journeyV700WorldId === expectedWorldId
          && container?.dataset.journeyV700View === 'world'
          && !journeyScreen?.hasAttribute('hidden');

        if (!ready) {
          stablePaintFrames = 0;
          requestAnimationFrame(sample);
          return;
        }

        const rect = wrapper.getBoundingClientRect();
        const wrapperOpacity = Number.parseFloat(getComputedStyle(wrapper).opacity);
        const screenOpacity = journeyScreen
          ? Number.parseFloat(getComputedStyle(journeyScreen).opacity)
          : 0;
        const hasVisibleFlightOrigin = rect.width > 1
          && rect.height > 1
          && wrapperOpacity >= 0.99
          && screenOpacity >= 0.99;
        if (hasVisibleFlightOrigin) {
          stablePaintFrames += 1;
          if (stablePaintFrames >= 2) {
            resolve(target!);
            return;
          }
          requestAnimationFrame(sample);
          return;
        }
        stablePaintFrames = 0;
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }

  public playJourneyOverlayReturnCard(boardId: number): Promise<void> {
    const active = this.journeyOverlayReturnInFlight;
    if (active) {
      if (active.boardId === boardId) return active.promise;
      return active.promise.then(() => this.playJourneyOverlayReturnCard(boardId));
    }
    const promise = this.runJourneyOverlayReturnCard(boardId).finally(() => {
      if (this.journeyOverlayReturnInFlight?.promise === promise) {
        this.journeyOverlayReturnInFlight = null;
      }
    });
    this.journeyOverlayReturnInFlight = { boardId, promise };
    return promise;
  }

  private async runJourneyOverlayReturnCard(boardId: number): Promise<void> {
    const board = this.getBoardById(boardId);
    if (!board?.unlocked || getJourneyCardOverlayReturnBoardId() !== boardId) return;
    const targetElement = await this.waitForJourneyOverlayReturnReady(boardId);
    if (getJourneyCardOverlayReturnBoardId() !== boardId) return;
    if (!targetElement) {
      logger.warn('⚠️ Journey overlay return stayed pending because its live Unit was not stable', {
        boardId,
        phase: this.journeyV700Phase,
        worldId: this.journeyV700WorldId,
      });
      return;
    }
    const origin = acquireJourneyCardOriginLease(boardId, targetElement);
    if (!origin) {
      logger.warn('⚠️ Journey overlay return could not lease the exact live card', { boardId });
      cancelJourneyCardOverlayReturn(boardId);
      return;
    }

    const scrollOwner = document.querySelector<HTMLElement>(
      '#journey-screen .collectibles-scrollable',
    );
    (targetElement as any)._openingDetail = true;
    let worldPausedForOverlay = false;
    try {
      if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction === 'function') {
        JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction();
      }
      if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.pauseCardMotionForTap === 'function') {
        JOURNEY_CARD_IDLE_BOUNCE.pauseCardMotionForTap(targetElement);
      }
      targetElement.classList.remove('idle-shimmer-trigger');
      try { gsap.killTweensOf(targetElement); } catch {}
      origin.prepareSettledLanding();
      origin.captureLandingGeometry();
      this.pauseJourneyWorldForCardOverlay('game-return-card-open');
      worldPausedForOverlay = true;
      this.journeyCardOverlayModal?.dispose();
      let earlyJourneyExitPromise: Promise<void> | null = null;
      let resolveOverlayCardExit!: () => void;
      const overlayCardExit = new Promise<void>((resolve) => {
        resolveOverlayCardExit = resolve;
      });
      const controller = presentJourneyCardOverlayModal({
        boardId,
        origin,
        hasSavedState: hasResumableSavedStateForBoard(boardId, { clearInvalid: true }),
        scrollOwner,
        entryInitialOpacity: 1,
        onDismissCardLanded: () => {
          this.playOverlayCardLandingBounce(targetElement);
        },
        onPlayCardReturnStart: () => {
          this.stopJourneyAreaIdleForTargets(this.getJourneyAreaElements(board.id));
        },
        onPlayCardExitStart: () => {
          if (this.renderDisposed || earlyJourneyExitPromise) return;
          earlyJourneyExitPromise = this.startOverlayPortaledCardJourneyExit(
            board.id,
            overlayCardExit,
          );
          logger.info('🧪 Journey return overlay portaled card collapse started linked Journey exit', {
            boardId: board.id,
          });
        },
        onPlayCardExitComplete: () => {
          resolveOverlayCardExit();
          logger.info('🧪 Journey return overlay portaled card exit completed', {
            boardId: board.id,
          });
        },
      });
      this.journeyCardOverlayModal = controller;
      logger.info('🧪 Journey gameplay return replayed the exact card-to-modal enter', {
        boardId,
        worldId: this.journeyV700WorldId,
      });
      const result = await controller.result;
      if (this.journeyCardOverlayModal === controller) this.journeyCardOverlayModal = null;
      if (result === 'dismiss') {
        if (controller.didLandAtOrigin) completeJourneyCardOverlayReturn(boardId);
        else cancelJourneyCardOverlayReturn(boardId);
        this.resumeJourneyWorldAfterCardOverlay('game-return-card-dismiss');
        worldPausedForOverlay = false;
        return;
      }
      if (!this.renderDisposed) {
        await this.startJourneyBoardFromOverlay(board, earlyJourneyExitPromise);
      }
    } catch (error) {
      origin.restoreNow();
      cancelJourneyCardOverlayReturn(boardId);
      if (worldPausedForOverlay && !this.renderDisposed) {
        this.resumeJourneyWorldAfterCardOverlay('game-return-card-error');
      }
      logger.warn('⚠️ Journey gameplay return overlay failed safely', {
        boardId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      (targetElement as any)._openingDetail = false;
    }
  }

  private async onJourneyBoardTap(boardId: number): Promise<void> {
    logger.info(`🗺️ Journey board ${boardId} tapped - starting game`);
    
    try {
      const collectiblesManager = (window as any).collectiblesManager;
      if (typeof collectiblesManager?.cancelJourneyScreenPreparation === 'function') {
        collectiblesManager.cancelJourneyScreenPreparation(`Journey board ${boardId} tapped`);
      }
      this.rememberLastActiveJourneyWorld(boardId);

      // 🔥 CRITICAL FIX: Stop Journey card idle bounce animations BEFORE exit animation
      if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
        JOURNEY_CARD_IDLE_BOUNCE.stop();
        logger.info('✅ Journey card idle bounce stopped');
      }
      
      // Play the same local board-area/card pop-out used by modal/interim flows,
      // then let the locked Journey viewport exit run underneath it.
      logger.info('🎬 Starting Journey board-area exit animation...');
      await this.startBoardAreaThenJourneyExit(boardId);
      logger.info('✅ Journey board-area exit animation completed');
      
      // 🔥 CRITICAL FIX: Hide Journey UI BEFORE starting game (cleanup)
      this.hideHomeAndJourneyScreens('before game start');
      
      // Import journey progression state
      const { journeyProgressionState } = await import('./journey-progression-state.js');
      
      // Set lastOpenedBoardId to this board
      journeyProgressionState.setLastOpenedBoardId(boardId);
      
      // 🔥 CRITICAL FIX: Set Journey flag so startNewRun knows we came from Journey
      this.setJourneyOriginFlags({ fromInterim: false });
      logger.info('✅ Journey flags set for proper game start sequence');
      
      // Start new run for this board (exit animation already completed)
      if (typeof (window as any).startNewRun === 'function') {
        await (window as any).startNewRun(boardId);
      } else {
        logger.error('❌ startNewRun function not found');
      }
    } catch (error) {
      logger.error(`❌ Failed to start game from Journey board ${boardId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Close detail modal with exit animation
   * Returns Promise that resolves when animation completes
   */
  private closeDetailModalWithExitAnimation(modal: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      logger.info('🎬 Starting detail modal exit animation');
      
      // 🔥 SAFETY: Prevent duplicate exit animations on the same modal
      if ((modal as any).__detailModalExiting === true) {
        logger.warn('⚠️ Detail modal exit already running - skipping duplicate call');
        resolve();
        return;
      }
      
      // 🔥 CRITICAL: Mark modal as exiting to prevent openBoardDetails from resetting stats during exit
      (modal as any).__detailModalExiting = true;
      journeySpatialMotion.deactivateJourneyDetailModal();
      cleanupDetailStatsEnterAnimation(modal);
      
      // 🔥 FIX: Safety cleanup function to ensure flag is always reset
      const cleanupFlag = () => {
        (modal as any).__detailModalExiting = false;
      };
      
      try {
      
      // 🔥 MEMORY LEAK FIX: Cleanup swipe handlers
      const swipeableContainer = modal.querySelector('.detail-swipeable-container') as HTMLElement;
      if (swipeableContainer && (swipeableContainer as any).__detailSwipeHandlers) {
        const handlers = (swipeableContainer as any).__detailSwipeHandlers;
        
        // Remove event listeners
        swipeableContainer.removeEventListener('touchstart', handlers.touchStart);
        swipeableContainer.removeEventListener('touchmove', handlers.touchMove);
        swipeableContainer.removeEventListener('touchend', handlers.touchEnd);
        swipeableContainer.removeEventListener('touchcancel', handlers.touchEnd);
        swipeableContainer.removeEventListener('mousedown', handlers.mouseDown);
        swipeableContainer.removeEventListener('mousemove', handlers.mouseMove);
        swipeableContainer.removeEventListener('mouseup', handlers.mouseUp);
        swipeableContainer.removeEventListener('mouseleave', handlers.mouseUp);
        if (handlers.cardTapTouchStart) {
          swipeableContainer.removeEventListener('touchstart', handlers.cardTapTouchStart, { capture: true } as any);
        }
        if (handlers.cardTapTouchEnd) {
          swipeableContainer.removeEventListener('touchend', handlers.cardTapTouchEnd, { capture: true } as any);
        }
        if (handlers.cardTapMouseDown) {
          swipeableContainer.removeEventListener('mousedown', handlers.cardTapMouseDown, { capture: true } as any);
        }
        if (handlers.cardTapMouseUp) {
          swipeableContainer.removeEventListener('mouseup', handlers.cardTapMouseUp, { capture: true } as any);
        }
        if (handlers.cancelSwipeRaf) {
          handlers.cancelSwipeRaf();
        }
        
        // Kill GSAP animations
        if (handlers.quickSetX) {
          gsap.killTweensOf(swipeableContainer);
        }
        
        // Clear handlers
        delete (swipeableContainer as any).__detailSwipeHandlers;
        logger.info('✅ Swipe handlers cleaned up');
      }
      
      // 🔥 SMOOTH TRANSITION FIX: Freeze card at current animated position before stopping animation
      // This prevents jarring "snap back" when animation is stopped
      const detailImageEl = modal.querySelector('#detail-card-image') as HTMLElement;
      if (detailImageEl) {
        const detailMotionEl = detailImageEl.querySelector('.detail-image-motion') as HTMLElement | null;
        // Step 1: Capture current computed transform (includes animation position)
        const computedStyle = window.getComputedStyle(detailMotionEl || detailImageEl);
        const currentTransform = computedStyle.transform;
        
        // Step 2: Apply computed transform as inline style to "freeze" at current position
        // This ensures the card stays where it is visually
        if (detailMotionEl && currentTransform && currentTransform !== 'none') {
          detailMotionEl.style.transform = currentTransform;
          logger.info('🎬 Card frozen at current animated position:', currentTransform);
        }
        
        // Step 3: NOW stop the CSS animation (card stays frozen at captured position)
        if (detailMotionEl) {
          detailMotionEl.style.animation = 'none';
          detailMotionEl.style.animationPlayState = 'paused';
        }
        
        // Stop shimmer animation on ::after pseudo-element by stopping parent animation
        logger.info('🧹 Detail image CSS animations stopped (no snap-back)');
      }
      
      // 🔥 USER REQUEST: Cleanup peekaboo tap handlers
      if (swipeableContainer && (swipeableContainer as any).__peekabooTapHandlers) {
        const handlers = (swipeableContainer as any).__peekabooTapHandlers;
        swipeableContainer.removeEventListener('touchstart', handlers.touchStart, { capture: true } as any);
        swipeableContainer.removeEventListener('touchend', handlers.touchEnd, { capture: true } as any);
        delete (swipeableContainer as any).__peekabooTapHandlers;
        logger.info('✅ Peekaboo tap handlers cleaned up');
      }
      
      // 🔥 MEMORY LEAK FIX: Kill GSAP animations on modal elements
      try {
        const gsap = (window as any).gsap;
        if (gsap) {
          const modalElements = modal.querySelectorAll('*');
          modalElements.forEach((el: Element) => {
            try {
              gsap.killTweensOf(el);
            } catch {}
          });
          logger.info('🧹 Detail modal GSAP animations killed');
        }
      } catch (error) {
        logger.warn('⚠️ Failed to kill GSAP animations on detail modal:', error);
      }
      
      // 🔥 USER REQUEST: Exit animation for detail modal (same pattern as collectibles-animations.ts)
      if (!gsap) {
        logger.warn('⚠️ GSAP not available for detail modal exit animation');
        resolve();
        return;
      }

      // Find modal elements (header as group, then content elements)
      const detailHeader = modal.querySelector('.detail-header') as HTMLElement;
      const detailImage = modal.querySelector('#detail-card-image') as HTMLElement;
      const detailRarityBadgeContainer = modal.querySelector('.detail-rarity-badge-container') as HTMLElement;
      const detailDescription = modal.querySelector('#detail-card-description') as HTMLElement;
      const boardStatsContainer = modal.querySelector('.board-stats-container') as HTMLElement;
      const detailStatsListExit = modal.querySelector('.detail-stats-list') as HTMLElement | null;
      // 🔥 CRITICAL: Find PLAY button directly (not from contentElements array)
      // PLAY button is created dynamically and added to modal, so find it directly
      const playButton = (
        modal.querySelector('#board-detail-play-button, #detail-continue-board-btn.cc-cta') ||
        document.getElementById('board-detail-play-button')
      ) as HTMLElement | null;
      
      // 🔥 USER REQUEST: Add animations for stats section, icons, and description text
      const detailStatsSection = modal.querySelector('.detail-section-stats') as HTMLElement;
      const detailStatIcons = modal.querySelectorAll('.detail-stat-icon') as NodeListOf<HTMLElement>;
      const detailStatIconsArray = Array.from(detailStatIcons);

      const otherContentElements = [
        ...(isTabletDetailModalViewport() ? [] : detailDescription ? [detailDescription] : []),
        ...detailStatIconsArray,
        detailRarityBadgeContainer
      ].filter(el => el !== null) as HTMLElement[];
      
      // 🔥 DEBUG: Log PLAY button state
      if (playButton) {
        const isFloatingPlayButton = playButton.id === 'board-detail-play-button';
        logger.info(`✅ PLAY button found for exit animation: id=${playButton.id}, parent=${playButton.parentNode?.nodeName}`);
      } else {
        logger.warn(`⚠️ PLAY button NOT found for exit animation!`);
      }
      
      // 🔥 USER REQUEST: STEP 1: PLAY button exits FIRST (immediately, no delay)
      // This gives instant feedback when user clicks Play
      // 🔥 USER REQUEST: Use EXACT SAME animation as homepage slider CTA button
      let playButtonExitDelay = 0;
      let playButtonExitDuration = ctaMotion.exitDuration;
      let cleanupFloatingPlayButton: () => void = () => {};
      
      if (playButton) {
        // 🔥 CRITICAL: Move PLAY button to body BEFORE starting exit animation
        // This ensures it remains visible when modal is hidden
        if (playButton.parentNode === modal) {
          document.body.appendChild(playButton);
          logger.info('🎮 PLAY button moved to body before exit animation');
        }
        this._floatingDetailPlayButtons.add(playButton);
        cleanupFloatingPlayButton = () => {
          try {
            this._floatingDetailPlayButtons.delete(playButton);
            getRegisteredCta(playButton as HTMLButtonElement)?.dispose();
            if (isFloatingPlayButton && playButton.parentNode) {
              playButton.remove();
              logger.info('🎮 PLAY button removed after CSS exit animation');
            } else {
              playButton.style.setProperty('display', 'none', 'important');
              playButton.style.visibility = 'hidden';
              playButton.style.pointerEvents = 'none';
            }
          } catch {}
        };
        
        void getRegisteredCta(playButton as HTMLButtonElement)?.exit();
        
        // Cleanup is repeated at modal-exit completion below; this local timer must not
        // depend on Journey screen lifecycle because detail close can happen after game return.
        window.setTimeout(cleanupFloatingPlayButton, ctaMotion.exitDuration * 1000);
        
        logger.info(`🎮 PLAY button master CTA exit started at 0ms (duration: ${ctaMotion.exitDuration}s)`);
      }
      
      // STEP 2: Other content elements AFTER Play button starts (container with stats + card)
      // Wait for play button animation to start, then stagger content elements
      const contentStartDelay = 0.1; // Start 100ms after play button (gives it a head start)
      otherContentElements.forEach((element, index) => {
        const stagger = 0.05; // Faster stagger for exit (same as settings screen)
        const delay = contentStartDelay + (index * stagger);
        
        // 🔥 BUG FIX: Ensure CSS transitions are disabled for GSAP scale animation
        if (element) {
          gsap.killTweensOf(element);
          element.style.opacity = '1';
          element.style.visibility = 'visible';
          element.style.transform = 'none';
          element.style.transition = 'none';
        }

        trackTween(element, {
          scale: 0,
          opacity: 0,
          duration: 0.4,
          ease: 'back.in(1.7)',
          delay: delay,
          force3D: true,
          overwrite: true // 🔥 CRITICAL: Prevent duplicate animations
        });
        logger.info(`🎴 Step ${index + 1}: Content element ${index + 1} pop-out - delay ${(delay * 1000).toFixed(0)}ms`);
      });
      
      // 🔥 SMOOTH TRANSITION FIX: Animate card image SEPARATELY to preserve frozen position
      // The card's transform is already frozen at its current animated position (from idle animation)
      // We animate scale and opacity FROM the frozen position - no snap-back!
      if (detailImage) {
        const cardDelay = contentStartDelay + (otherContentElements.length * 0.05); // After other elements
        
        // Don't reset transform - keep the frozen position from the idle animation
        gsap.killTweensOf(detailImage);
        detailImage.style.opacity = '1';
        detailImage.style.visibility = 'visible';
        detailImage.style.transition = 'none';
        // 🔥 CRITICAL: Do NOT reset transform - preserve frozen position
        
        trackTween(detailImage, {
          scale: 0,
          opacity: 0,
          duration: 0.4,
          ease: 'back.in(1.7)',
          delay: cardDelay,
          force3D: true,
          overwrite: true
        });
        logger.info(`🃏 Card image pop-out from frozen position - delay ${(cardDelay * 1000).toFixed(0)}ms (no snap-back)`);
      }
      
      // STEP 2B: Stat items exit individually with pop-out animation (one by one)
      // 🔥 CRITICAL: Use EXACT same pattern as other content elements (like card)
      let statsExitEndTime = 0; // Track when stats exit animations end
      
      // 🔥 CRITICAL: Ensure detailStatsSection stays visible during stat items exit animation
      // Don't animate detailStatsSection itself - let stat items animate individually
      // This prevents the stats area from disappearing before stat items finish their exit animations
      if (detailStatsSection) {
        gsap.killTweensOf(detailStatsSection);
        detailStatsSection.style.opacity = '1';
        detailStatsSection.style.visibility = 'visible';
        detailStatsSection.style.display = 'flex';
        detailStatsSection.style.transform = 'none';
        detailStatsSection.style.transition = 'none';
        logger.info('📊 detailStatsSection kept visible during stat items exit animation');
      }
      
      if (detailStatsListExit) {
        const statChildren = Array.from(detailStatsListExit.querySelectorAll('.detail-stat-item, .detail-stat-divider')) as HTMLElement[];
        // 🔥 CRITICAL: Calculate when stats exit animations will end
        if (statChildren.length > 0) {
          const lastStatDelay = contentStartDelay + 0.05 + (statChildren.length - 1) * 0.05;
          const statsExitDuration = 0.4; // Duration of each stat exit animation
          statsExitEndTime = lastStatDelay + statsExitDuration;
        }
        
        statChildren.forEach((child, i) => {
          // 🔥 BUG FIX: Ensure CSS transitions are disabled for GSAP scale animation (same as other elements)
          if (child) {
            gsap.killTweensOf(child);
            
            // 🔥 CRITICAL: Reset children (icons, values, labels) before exit animation
            const childIcon = child.querySelector('.detail-stat-icon, .stat-icon') as HTMLElement | null;
            const childValue = child.querySelector('.detail-stat-value, .stat-value') as HTMLElement | null;
            const childLabel = child.querySelector('.detail-stat-label, .stat-label') as HTMLElement | null;
            const childContent = child.querySelector('.detail-stat-content, .stat-content') as HTMLElement | null;
            
            if (childIcon) {
              gsap.killTweensOf(childIcon);
              childIcon.style.transition = 'none';
              childIcon.style.opacity = '1';
              childIcon.style.visibility = 'visible';
            }
            if (childValue) {
              gsap.killTweensOf(childValue);
              childValue.style.transition = 'none';
              childValue.style.opacity = '1';
              childValue.style.visibility = 'visible';
            }
            if (childLabel) {
              gsap.killTweensOf(childLabel);
              childLabel.style.transition = 'none';
              childLabel.style.opacity = '1';
              childLabel.style.visibility = 'visible';
            }
            if (childContent) {
              gsap.killTweensOf(childContent);
              childContent.style.transition = 'none';
              childContent.style.opacity = '1';
              childContent.style.visibility = 'visible';
            }
            
            // 🔥 CRITICAL: Ensure parent is visible and ready for animation
            child.style.opacity = '1';
            child.style.visibility = 'visible';
            child.style.transform = 'none';
            child.style.transition = 'none';
          }

          child.classList.remove('detail-stat-exiting');
          child.style.removeProperty('animation');
          child.style.removeProperty('animation-delay');
          child.style.animationDelay = `${contentStartDelay + 0.05 + i * 0.05}s`;
          void child.offsetHeight;
          child.classList.add('detail-stat-exiting');
        });
      }

	      // Header/nav exits immediately on close tap, in sync with the rest of Journey navigation.
	      const headerExitDelay = 0;
	      if (detailHeader) {
        // 🔥 APP STORE: Remove enter animation listener if user closed before enter completed (no leak)
        const enterEndHandler = (detailHeader as any).__detailHeaderEnterEnd;
        if (typeof enterEndHandler === 'function') {
          detailHeader.removeEventListener('animationend', enterEndHandler);
          delete (detailHeader as any).__detailHeaderEnterEnd;
        }
        // 🔥 FIX: Remove CSS enter classes so GSAP owns transform/opacity for exit (no class vs inline conflict)
        detailHeader.classList.remove('detail-header-enter', 'detail-header-enter-done', 'detail-header-before-enter');
        const headerComputedTransform = window.getComputedStyle(detailHeader).transform;
        if (headerComputedTransform && headerComputedTransform !== 'none') {
          detailHeader.style.transform = headerComputedTransform;
        }
        detailHeader.style.removeProperty('opacity');
        gsap.killTweensOf(detailHeader);
        gsap.set(detailHeader, { scale: 1, opacity: 1, visibility: 'visible', force3D: true });

        const detailCloseBtn = modal.querySelector('#detail-close-btn') as HTMLElement;
        if (detailCloseBtn) {
          detailCloseBtn.classList.remove('animate-enter', 'animate-exit', 'animate-enter-initial', 'animate-reset');
          detailCloseBtn.style.setProperty('transition', 'none', 'important');
          const closeComputedTransform = window.getComputedStyle(detailCloseBtn).transform;
          if (closeComputedTransform && closeComputedTransform !== 'none') {
            detailCloseBtn.style.setProperty('transform', closeComputedTransform, 'important');
          }
        }
        const headerChildren = detailHeader.querySelectorAll('*');
        headerChildren.forEach((child: Element) => {
          const childEl = child as HTMLElement;
          childEl.style.setProperty('transition', 'none', 'important');
          const childTransform = window.getComputedStyle(childEl).transform;
          if (childTransform && childTransform !== 'none') {
            childEl.style.setProperty('transform', childTransform, 'important');
          }
        });

	        trackTween(detailHeader, {
	          scale: 0,
	          opacity: 0,
	          duration: 0.4,
	          ease: 'back.in(1.7)',
	          delay: headerExitDelay,
	          force3D: true
	        });
	        logger.info(`📊 Header pop-out - FIRST (X, title, divider animate together as group at ${(headerExitDelay * 1000).toFixed(0)}ms)`);
	      }

      // Calculate total animation duration (content elements + stats + PLAY button + header)
      // 🔥 CRITICAL: Include ALL exit animations in total duration (stats, PLAY button, header)
      const playButtonEndTime = playButtonExitDelay + playButtonExitDuration; // When PLAY button animation ends
	      const headerEndTime = headerExitDelay + 0.4; // When header animation ends
      // 🔥 BUG FIX: Include stats exit animations in total duration calculation
      const totalDuration = Math.max(playButtonEndTime, headerEndTime, statsExitEndTime) * 1000 + 100; // Use the longest one + 100ms buffer
      logger.info(`⏱️ Exit animation durations - Stats: ${(statsExitEndTime * 1000).toFixed(0)}ms, PLAY: ${(playButtonEndTime * 1000).toFixed(0)}ms, Header: ${(headerEndTime * 1000).toFixed(0)}ms, Total: ${totalDuration.toFixed(0)}ms`);

      // Wait for exit animation to complete
      window.setTimeout(() => {
        // 🔥 MEMORY LEAK FIX: Full cleanup of detail image element
        const detailImageEl = modal.querySelector('#detail-card-image') as HTMLElement;
        if (detailImageEl) {
          const detailMotionEl = detailImageEl.querySelector('.detail-image-motion') as HTMLElement | null;
          // Stop CSS animations
          if (detailMotionEl) {
            detailMotionEl.style.animation = 'none';
            detailMotionEl.style.animationPlayState = 'paused';
            detailMotionEl.style.removeProperty('transform');
          }
          // 🔥 CLEANUP: Reset frozen transform from smooth transition fix
          detailImageEl.style.removeProperty('transform');
          // Kill any GSAP animations on this element
          gsap.killTweensOf(detailImageEl);
          detailImageEl.querySelectorAll('img').forEach((img) => {
            try {
              (img as HTMLImageElement).removeAttribute('src');
              (img as HTMLImageElement).src = '';
            } catch {}
          });
          detailImageEl.innerHTML = '';
          logger.info('🧹 Detail image fully cleaned up (animation + transform + GSAP)');
        }

        // 🔥 APP STORE: Reset detail header to clean state for next open (no leftover refs or inline styles)
        const headerForCleanup = modal.querySelector('.detail-header') as HTMLElement;
        if (headerForCleanup) {
          const handler = (headerForCleanup as any).__detailHeaderEnterEnd;
          if (typeof handler === 'function') {
            headerForCleanup.removeEventListener('animationend', handler);
          }
          delete (headerForCleanup as any).__detailHeaderEnterEnd;
          gsap.killTweensOf(headerForCleanup);
          headerForCleanup.style.removeProperty('transform');
          headerForCleanup.style.removeProperty('opacity');
          headerForCleanup.style.removeProperty('visibility');
          headerForCleanup.classList.remove('detail-header-enter', 'detail-header-enter-done', 'detail-header-before-enter');
        }

        // Hide modal (PLAY button is now in body, so it remains visible)
        modal.hidden = true;
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        
        // 🔥 CRITICAL: Reset ALL stat elements to clean state after exit animation
        // This ensures they're ready for next enter animation
        if (detailStatsListExit) {
          const statChildren = Array.from(detailStatsListExit.querySelectorAll('.detail-stat-item, .detail-stat-divider')) as HTMLElement[];
          statChildren.forEach((child) => {
            // Kill any remaining animations
            gsap.killTweensOf(child);
            
            // Reset GSAP values to clean state (scale: 1, opacity: 1) for next open
            gsap.set(child, {
              scale: 1,
              opacity: 1,
              visibility: 'hidden', // Keep hidden until next enter
              force3D: true,
              immediateRender: true
            });
            
            // 🔥 SCREEN ARTIFACTS FIX: FORCE display: none on divideri to prevent ghost artifacts
            // Divideri ostaju vidljivi jedan frame pri brzom in/out ako display nije none!
            if (child.classList.contains('detail-stat-divider')) {
              child.style.setProperty('display', 'none', 'important');
              child.style.setProperty('opacity', '0', 'important');
              child.style.setProperty('visibility', 'hidden', 'important');
            }
            
            // Clear inline styles
            child.style.removeProperty('transform');
            child.style.removeProperty('will-change');
            
            // Reset children (icons, values, labels) to ensure they're visible next time
            const icon = child.querySelector('.detail-stat-icon, .stat-icon');
            const value = child.querySelector('.detail-stat-value, .stat-value');
            const label = child.querySelector('.detail-stat-label, .stat-label');
            const content = child.querySelector('.detail-stat-content, .stat-content');
            [icon, value, label, content].forEach((el) => {
              if (el) {
                gsap.killTweensOf(el);
                (el as HTMLElement).style.removeProperty('opacity');
                (el as HTMLElement).style.removeProperty('visibility');
                (el as HTMLElement).style.removeProperty('transform');
              }
            });
          });
        }
        
        cleanupFloatingPlayButton();
        
        // 🔥 CRITICAL: Clear exiting flag after exit animation completes
        cleanupFlag();
        
        logger.info(`✅ Detail modal exit animation completed (${totalDuration}ms)`);
        logger.info(`🎮 PLAY button exit: delay=${(playButtonExitDelay * 1000).toFixed(0)}ms, duration=${(playButtonExitDuration * 1000).toFixed(0)}ms, ends at=${((playButtonExitDelay + playButtonExitDuration) * 1000).toFixed(0)}ms`);
        resolve();
      }, totalDuration);
      } catch (error) {
        // 🔥 FIX: Ensure flag is reset on error
        logger.error('❌ Detail modal exit animation failed:', error);
        cleanupFlag();
        resolve(); // Still resolve to prevent hanging
      }
    });
  }

  /**
   * 🔥 USER REQUEST: Continue game directly from interim board (no detail modal)
   * This is called when user clicks an interim card
   */
  private async continueFromInterimBoard(
    board: JourneyBoard,
    journeyExitPromise?: Promise<void>
  ): Promise<void> {
    logger.info(`🔄 Continue from interim board ${board.id} - starting cleanup and game`);
    
    try {
      // Keep modal-only sheets from appearing over an already exited Journey screen.
      
      // Step 1: Stop Journey card idle bounce animations immediately
      if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
        JOURNEY_CARD_IDLE_BOUNCE.stop();
        logger.info('✅ Journey card idle bounce stopped');
      }
      
      // Step 2: Set Journey progression state BEFORE exit animation
      const { journeyProgressionState } = await import('./journey-progression-state.js');
      journeyProgressionState.setLastOpenedBoardId(board.id);
      
      // 🔥 Mark from interim so clean board shows "Continue" (only case with Continue on clean board)
      this.setJourneyOriginFlags({ fromInterim: true, returningFromInterim: true });
      logger.info('🗺️ Marked as coming from interim board - clean board will show Continue');
      
      // 🔥 APP STORE FIX: Hide homepage IMMEDIATELY before Journey exit animation
      // This prevents homepage leftover elements from showing during transition
      this.hideHomeAndJourneyScreens('before journey exit', { hideJourney: false, cleanup: false });
      
      // Step 3: Close Journey screen with exit animation (ONLY Journey exit, NO slider exit)
      const exitPromise = journeyExitPromise ?? this.startJourneyExitAnimation();
      
      // Step 4: Wait for exit animation to complete
      await exitPromise;
      logger.info('✅ Journey exit animation completed');

      // Step 5: Hide Journey UI (cleanup after hideCollectibles)
      this.hideHomeAndJourneyScreens('after journey exit', { setJourneyZIndex: true, cleanup: false });
      
      // Step 7: Also call hideCollectibles to ensure proper cleanup (memory leak prevention)
      const collectiblesManager = (window as any).collectiblesManager;
      if (collectiblesManager && typeof collectiblesManager.hideCollectibles === 'function') {
        // Ensure hideCollectibles does NOT try to return to homepage (this is a transition into game)
        (window as any).__ccJourneyExitMode = 'toGame';
        await collectiblesManager.hideCollectibles();
      }
      
      // Cleanup after collectibles hidden
      this.cleanup();
      
      // 🔥 CRITICAL FIX: Wait for next frame to ensure DOM updates are rendered
      // This prevents lag when starting board transition screen
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      logger.info('✅ DOM updates rendered - ready for board transition screen');
      
      // Step 8: Ensure saved game state exists with correct boardNumber
      // 🔥 USER REQUEST: Load score from journey progression state (preserves score from failed board)
      // This creates a unique journey experience with accumulated score
      const currentRunState = journeyProgressionState.getCurrentRunState();
      let savedScore = 0;
      
      // If there's a current run state for this board, use its score
      if (currentRunState && currentRunState.boardId === board.id) {
        savedScore = Number.isFinite(currentRunState.score) ? currentRunState.score : 0;
        logger.info(`🎮 Found journey progression state for board ${board.id} with score ${savedScore}`);
      } else {
        // 🔥 USER REQUEST: Check if there's a saved game state for THIS specific board
        const saveKey = getBoardSaveKey(board.id);
        const savedGame = localStorage.getItem(saveKey);
        if (savedGame) {
          try {
            const gameState = JSON.parse(savedGame);
            savedScore = Number.isFinite(gameState.score) ? gameState.score : 0;
            logger.info(`🎮 Found saved game state for board ${board.id} (${saveKey}) with score ${savedScore}`);
          } catch (e) {
            logger.warn(`⚠️ Failed to parse saved game for board ${board.id}:`, e instanceof Error ? e.message : String(e));
          }
        }
      }
      
      // 🔥 USER REQUEST: Check if we have valid tiles/grid in saved game for THIS specific board
      // If we have tiles, we can continue (resume). If not, we create fresh board.
      const saveKey = getBoardSaveKey(board.id);
      const savedGame = localStorage.getItem(saveKey);
      let hasValidTiles = false;
      let gameState: any = null;
      
      if (savedGame) {
        try {
          gameState = JSON.parse(savedGame);
          // Check if we have tiles array with valid tiles
          const hasTiles = gameState.tiles && Array.isArray(gameState.tiles) && gameState.tiles.length > 0;
          // Check if we have grid array with valid data
          const hasGrid = gameState.grid && Array.isArray(gameState.grid) && gameState.grid.length > 0;
          hasValidTiles = hasTiles || hasGrid;
          
          if (hasValidTiles) {
            logger.info(`🎮 Found valid saved game with tiles/grid for board ${board.id} (${saveKey}) - will continue (resume)`);
          } else {
            logger.info(`🎮 Saved game exists but has no tiles/grid for board ${board.id} (${saveKey}) - will create fresh board`);
          }
        } catch (e) {
        logger.warn(`⚠️ Failed to parse saved game for board ${board.id}:`, e instanceof Error ? e.message : String(e));
          gameState = null;
        }
      }
      
      // 🔥 JOURNEY BOARDS: Always start from score 0 (no accumulation between boards)
      const resetScore = 0;
      
      // 🔥 CRITICAL: Use board-specific save key so main.ts continueGameWithSavedState reads the same key
      // Previously we only wrote to 'cc_saved_game' (global) so board-specific key could be missing → rebuild
      const boardSaveKey = getBoardSaveKey(board.id);
      if (hasValidTiles && gameState) {
        // CASE 1: We have valid saved game with tiles - CONTINUE (resume)
        gameState.boardNumber = board.id;
        gameState.level = board.id;
        gameState.score = resetScore; // 🔥 JOURNEY BOARDS: Always start from 0
        gameState.timestamp = Date.now();
        localStorage.setItem(boardSaveKey, JSON.stringify(gameState));
        logger.info(`🎮 Updated saved game state for CONTINUE: boardNumber=${board.id}, score=${resetScore}, hasTiles=true (${boardSaveKey})`);
        
        // Set flag to skip rebuildBoard and load saved state
        (window as any).__ccSkipRebuildBoard = true;
        logger.info(`🎮 Will CONTINUE saved game with tiles for board ${board.id}`);
      } else {
        // CASE 2: No valid tiles - CREATE FRESH BOARD (new start)
        gameState = {
          boardNumber: board.id,
          level: board.id,
          score: resetScore, // 🔥 JOURNEY BOARDS: Always start from 0
          timestamp: Date.now()
        };
        // 🔥 CRITICAL: Explicitly remove tiles/grid to ensure fresh board creation
        delete gameState.tiles;
        delete gameState.grid;
        localStorage.setItem(boardSaveKey, JSON.stringify(gameState));
        logger.info(`🎮 Created new saved game state for FRESH BOARD: boardNumber=${board.id}, score=${resetScore}, no tiles (${boardSaveKey})`);
        
        // Clear flag so rebuildBoard creates fresh board with tile animations
        delete (window as any).__ccSkipRebuildBoard;
        logger.info(`🎮 Will CREATE FRESH BOARD with tile animations for board ${board.id}`);
      }
      
      // 🔥 CRITICAL FIX: Set currentRunState BEFORE calling continueGameWithSavedState
      // This ensures continueGameWithSavedState can find the active run
      journeyProgressionState.setCurrentRunState(board.id, resetScore);
      logger.info(`🎮 Set currentRunState: board ${board.id}, score ${resetScore}, inProgress: true`);
      
      // 🔥 CRITICAL FIX: Set __ccStartAtLevel BEFORE calling continueGameWithSavedState
      // This ensures startLevel is called with correct board number
      (window as any).__ccStartAtLevel = board.id;
      logger.info(`🎮 Set __ccStartAtLevel: ${board.id}`);
      
      // 🔥 USER REQUEST: Set preserved score so startLevel can use it
      // This ensures score is preserved even when creating fresh board
      (window as any).__ccPreserveScore = savedScore;
      logger.info(`🎮 Set __ccPreserveScore: ${savedScore} for board ${board.id}`);
      
      // Step 9: Show board transition screen, then continue game with saved state (resume interim game)
      // This will load saved game state and continue from where user left off
      // HUD drop animation is already handled in continueGameWithSavedState() for Journey pathway
      let didContinue = false;
      try {
        // Stability: cleanup FX before transition
        try { window.dispatchEvent(new Event('cc-navigation')); } catch {}
        try { (window as any).CC?.cleanupFxForBoardReset?.('journey-transition'); } catch {}
        try { (window as any).CC?.softResetBoardView?.('journey-transition'); } catch {}
        const { showBoardTransitionScreen } = await import('./board-transition-screen.js');
        await showBoardTransitionScreen({
          boardNumber: board.id,
          onComplete: async () => {
            if (typeof (window as any).continueGameWithSavedState === 'function') {
              if (didContinue) {
                return;
              }
              didContinue = true;
              // 🔥 CRITICAL: Always trigger HUD drop on entry from interim card (every time)
              // This ensures _hudDropPending is set even if other flags/state were cleared.
              (window as any).__ccTriggerHudDrop = true;
              logger.info(`🎮 Continuing saved game for board ${board.id} - preserving progress and score`);
              await (window as any).continueGameWithSavedState();
            } else {
              logger.error('❌ continueGameWithSavedState function not found');
            }
          }
        });
        // Fallback: if transition resolves without calling onComplete, continue anyway
        if (!didContinue && typeof (window as any).continueGameWithSavedState === 'function') {
          didContinue = true;
          (window as any).__ccTriggerHudDrop = true;
          logger.info(`🎮 Fallback continue after transition for board ${board.id}`);
          await (window as any).continueGameWithSavedState();
        }
      } catch (transitionError) {
        logger.warn('⚠️ Failed to show board transition screen for interim board, continuing directly:', transitionError);
        if (!didContinue && typeof (window as any).continueGameWithSavedState === 'function') {
          didContinue = true;
          (window as any).__ccTriggerHudDrop = true;
          logger.info(`🎮 Continuing saved game for board ${board.id} - preserving progress and score`);
          await (window as any).continueGameWithSavedState();
        } else {
          logger.error('❌ continueGameWithSavedState function not found');
        }
      }
    } catch (error) {
      logger.error(`❌ Failed to continue game from interim board ${board.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Public method to open board details by ID
  public async openBoardDetailsById(boardId: number, skipJourneyExit: boolean = false): Promise<void> {
    const board = this.boards.find(b => b.id === boardId);
    if (board) {
      // Direct game-return callers use `skipJourneyExit=true` only after the
      // board exit has already completed. Pass an explicitly completed owner
      // promise so openBoardDetails does not mistake the missing card-tap
      // promise for an interrupted Journey Unit exit and start a second exit
      // over the destination modal.
      const completedJourneyExit = skipJourneyExit ? Promise.resolve() : undefined;
      await this.openBoardDetails(board, skipJourneyExit, completedJourneyExit);
    } else {
      logger.warn(`⚠️ Board ${boardId} not found`);
    }
  }

  // 🔥 FIGMA DESIGN: Simple swipe - stats+card+text visible, swipe to buttons
  public initDetailModalSwipe(container: HTMLElement): void {
    if (!container) return;

    if ((container as any).__detailSwipeHandlers) {
      const handlers = (container as any).__detailSwipeHandlers;
      try { container.removeEventListener('touchstart', handlers.touchStart); } catch {}
      try { container.removeEventListener('touchmove', handlers.touchMove); } catch {}
      try { container.removeEventListener('touchend', handlers.touchEnd); } catch {}
      try { container.removeEventListener('touchcancel', handlers.touchEnd); } catch {}
      try { container.removeEventListener('mousedown', handlers.mouseDown); } catch {}
      try { container.removeEventListener('mousemove', handlers.mouseMove); } catch {}
      try { container.removeEventListener('mouseup', handlers.mouseUp); } catch {}
      try { container.removeEventListener('mouseleave', handlers.mouseUp); } catch {}
      try {
        if (handlers.cardTapTouchStart) container.removeEventListener('touchstart', handlers.cardTapTouchStart, { capture: true } as any);
        if (handlers.cardTapTouchEnd) container.removeEventListener('touchend', handlers.cardTapTouchEnd, { capture: true } as any);
        if (handlers.cardTapMouseDown) container.removeEventListener('mousedown', handlers.cardTapMouseDown, { capture: true } as any);
        if (handlers.cardTapMouseUp) container.removeEventListener('mouseup', handlers.cardTapMouseUp, { capture: true } as any);
        if (handlers.cancelSwipeRaf) handlers.cancelSwipeRaf();
      } catch {}
      try { handlers.quickSetX && gsap.killTweensOf(container); } catch {}
      delete (container as any).__detailSwipeHandlers;
      logger.info('🧹 Cleaned stale detail swipe/tap handlers before re-init');
    }

    /* iPad / iPadOS: never apply horizontal-swipe pixel widths — they pin the column left of center */
    if (isTabletDetailModalViewport()) {
      resetDetailModalHorizontalSwipeLayout(container);
      logger.info('📐 Detail modal tablet layout: skipped swipe metrics — cleared inline widths / GSAP x');
      return;
    }
    
    // 🔥 CRITICAL: Calculate actual content width (not viewport width)
    // Content: 24px (left padding) + 246px (stats) + 48px (gap) + 310px (card) + 48px (gap) + 80px (text margin) + text width + right padding
    // Text "The board waits. A single move appears. Everything begins." needs ~220px width (increased from 180px)
    // Container width reduced by 200px from right side (as requested), now additional 100px reduction
    const textWidth = 220; // 🔥 USER REQUEST: Text width increased from 180px to 220px
    const rightPadding = 0; // No right padding (reduced from 80px)
    const baseContentWidth = 24 + 246 + 48 + 310 + 48 + 80 + textWidth + rightPadding; // ~936px
    const actualContentWidth = baseContentWidth - 200 - 100; // 🔥 USER REQUEST: Reduce by 200px + 100px from right side = ~620px
    const sectionWidth = actualContentWidth; // Use reduced content width
    const totalWidth = sectionWidth * 2; // stats+card+text section + buttons section
    const maxScroll = sectionWidth; // Can scroll one section width (to buttons)
    
    container.style.width = `${totalWidth}px`;
    
    // 🔥 CRITICAL: Explicitly set section widths to actual content width
    const statsCardSection = container.querySelector('#detail-section-stats-card') as HTMLElement;
    const buttonsSection = container.querySelector('#detail-section-description') as HTMLElement;
    
    if (statsCardSection) {
      statsCardSection.style.width = `${sectionWidth}px`;
      statsCardSection.style.minWidth = `${sectionWidth}px`;
      statsCardSection.style.maxWidth = `${sectionWidth}px`;
      statsCardSection.style.flexShrink = '0';
      // 🔥 CRITICAL: Ensure consistent padding (no right padding, container reduced by 200px)
      statsCardSection.style.padding = '0 0 24px 24px'; // No right padding (container reduced by 200px)
      statsCardSection.style.paddingTop = '0';
    }
    
    if (buttonsSection) {
      buttonsSection.style.width = `${sectionWidth}px`;
      buttonsSection.style.minWidth = `${sectionWidth}px`;
      buttonsSection.style.maxWidth = `${sectionWidth}px`;
      buttonsSection.style.flexShrink = '0';
      buttonsSection.style.display = 'flex';
      buttonsSection.style.visibility = 'visible';
      buttonsSection.style.opacity = '1';
    }
    
    // 🔥 USER REQUEST: Calculate card focus position (card centered in viewport when swiping left)
    const viewportWidth = container.parentElement?.offsetWidth || container.offsetWidth || 390; // Viewport width
    const leftPadding = 24;
    const statsWidth = 246; // 🔥 USER REQUEST: Increased by 16px (230 + 16 = 246) so "longest combo" fits in 1 line
    const gap1 = 48;
    const cardStartX = leftPadding + statsWidth + gap1; // Position where card starts: 24 + 246 + 48 = 318px
    const cardWidth = 310;
    const cardCenterX = cardStartX + (cardWidth / 2); // Card center: 302 + 155 = 457px
    const viewportCenterX = viewportWidth / 2; // Viewport center: 390 / 2 = 195px
    // To center card in viewport, move container left by: cardCenterX - viewportCenterX
    const cardFocusX = -(cardCenterX - viewportCenterX); // Negative translateX to move container left
    const clampedCardFocusX = Math.max(-maxScroll, Math.min(0, cardFocusX));
    const snapPoints = [0, clampedCardFocusX, -maxScroll];
    const getNearestSnapIndex = (x: number) => {
      let bestIndex = 0;
      let bestDist = Infinity;
      for (let i = 0; i < snapPoints.length; i++) {
        const d = Math.abs(x - snapPoints[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
      return bestIndex;
    };
    
    // 🔥 USER REQUEST: Center text in viewport when on step 3 (position -maxScroll)
    const descEl = container.parentElement?.querySelector('#detail-card-description') as HTMLElement;
    let lastTextSnapIndex: number | null = null;
    const updateTextMarginForPosition = (snapIndex: number) => {
      if (!descEl) return;
      if (lastTextSnapIndex === snapIndex) return;
      lastTextSnapIndex = snapIndex;
      
      if (snapIndex === 2) {
        // Step 3: Center text in viewport using getBoundingClientRect for precise measurement
        // Only run after snap completes to avoid jitter during animation
        requestAnimationFrame(() => {
          const textRect = descEl.getBoundingClientRect();
          const textCenterX = textRect.left + (textRect.width / 2);
          const viewportCenterX = window.innerWidth / 2;
          const offsetX = viewportCenterX - textCenterX;
          descEl.style.transform = `translateX(${offsetX}px)`;
          logger.info(`📐 Step 3: Text centered - text center: ${textCenterX.toFixed(1)}px, viewport center: ${viewportCenterX.toFixed(1)}px, offset: ${offsetX.toFixed(1)}px`);
        });
      } else {
        // Step 0 or 1: Reset transform and use default 80px margin
        descEl.style.transform = 'none';
        descEl.style.marginLeft = '80px';
      }
    };
    const getSnapIndexByVelocity = (startIndex: number, deltaX: number, v: number) => {
      // Require a meaningful swipe before changing positions
      const MIN_SWIPE_DISTANCE = 40; // px
      const MIN_SWIPE_VELOCITY = 0.25;
      if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE && Math.abs(v) < MIN_SWIPE_VELOCITY) {
        return startIndex; // treat as tap / micro-move
      }
      // Positive velocity or deltaX => swipe left -> next position
      if (v > 0 || deltaX > 0) return Math.min(snapPoints.length - 1, startIndex + 1);
      // Negative velocity or deltaX => swipe right -> previous position
      return Math.max(0, startIndex - 1);
    };
    
    const quickSetX = gsap.quickSetter(container, 'x', 'px');
    let currentX = 0;
    let isDragging = false;
    let startX = 0;
    let startTranslateX = 0;
    let dragStartSnapIndex = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let momentumAnimation: gsap.core.Tween | null = null;
    let swipeRafId: number | null = null;
    let pendingSwipeX: number | null = null;
    const detailImageForTap = container.querySelector('#detail-card-image') as HTMLElement | null;
    const detailMotionForSwipe = detailImageForTap?.querySelector('.detail-image-motion') as HTMLElement | null;
    let cardTapStartX = 0;
    let cardTapStartY = 0;
    let cardTapStartTime = 0;
    let lastCardTapBounceAt = 0;
    let lastCardTapTouchAt = 0;
    const CARD_TAP_MOVE_THRESHOLD = 10;
    const CARD_TAP_TIME_THRESHOLD = 320;
    
    quickSetX(0);
    container.style.willChange = 'auto';
    container.style.cursor = 'grab';

    const setDetailSwipeActive = (active: boolean) => {
      const modal = container.closest('#collectibles-detail-modal') as HTMLElement | null;
      modal?.classList.toggle('detail-swipe-active', active);
      if (detailMotionForSwipe) {
        detailMotionForSwipe.style.animationPlayState = active ? 'paused' : 'running';
      }
    };

    const flushSwipeX = () => {
      swipeRafId = null;
      if (pendingSwipeX === null) return;
      quickSetX(pendingSwipeX);
      pendingSwipeX = null;
    };

    const scheduleSwipeX = (x: number) => {
      currentX = x;
      pendingSwipeX = x;
      if (swipeRafId !== null) return;
      swipeRafId = requestAnimationFrame(flushSwipeX);
    };

    const flushPendingSwipeX = () => {
      if (swipeRafId !== null) {
        cancelAnimationFrame(swipeRafId);
        swipeRafId = null;
      }
      if (pendingSwipeX !== null) {
        quickSetX(pendingSwipeX);
        pendingSwipeX = null;
      }
    };
    
    // 🔥 USER REQUEST: Initialize text margin for starting position (step 0)
    updateTextMarginForPosition(0);
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        // 🔥 USER REQUEST: Don't start dragging immediately - wait for actual movement
        // Just store initial position, don't set isDragging = true yet
        startX = e.touches[0].clientX;
        lastX = startX;
        startTranslateX = currentX;
        dragStartSnapIndex = getNearestSnapIndex(startTranslateX);
        lastTime = performance.now();
        velocity = 0;
        // Don't set isDragging = true here - wait for touchmove
        // Don't preventDefault here - allow normal touch behavior
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      
      // 🔥 USER REQUEST: Start dragging only when user actually moves finger (not on tap)
      if (!isDragging) {
        const currentTouchX = e.touches[0].clientX;
        const deltaX = Math.abs(currentTouchX - startX);
        // Only start dragging if moved more than 5px (prevents accidental drag on tap)
        if (deltaX < 5) return;
        
        // Now start dragging
        isDragging = true;
        // Kill any ongoing momentum animation
        if (momentumAnimation) {
          momentumAnimation.kill();
          momentumAnimation = null;
        }
        container.style.willChange = 'transform';
        setDetailSwipeActive(true);
        container.style.cursor = 'grabbing';
      }
      
      const currentTouchX = e.touches[0].clientX;
      const currentTime = performance.now();
      // 🔥 FIX: Natural swipe logic - swipe left (prst ide lijevo) = content ide lijevo
      // deltaX = startX - currentTouchX
      // Swipe left: currentTouchX < startX → deltaX pozitivno → container ide lijevo (negativan translateX)
      // Swipe right: currentTouchX > startX → deltaX negativno → container ide desno (pozitivan translateX)
      const deltaX = startX - currentTouchX; // Positive = swiped left, Negative = swiped right
      const timeDelta = currentTime - lastTime;
      
      // Calculate velocity for momentum (positive = left swipe, negative = right swipe)
      if (timeDelta > 0) {
        velocity = (lastX - currentTouchX) / timeDelta; // Positive = left, Negative = right
      }
      
      // 🔥 APPLE STYLE: Update position with elastic bounds
      // Swipe left (positive deltaX) → move container left (negative translateX)
      // Swipe right (negative deltaX) → move container right (positive translateX)
      let newX = startTranslateX - deltaX; // Subtract deltaX: left swipe (positive) → negative translateX
      
      // Elastic resistance at edges
      if (newX > 0) {
        // Over-scroll right (beyond stats section)
        newX = newX * 0.3; // 70% resistance
      } else if (newX < -maxScroll) {
        // Over-scroll left (beyond description section)
        const overScroll = newX + maxScroll;
        newX = -maxScroll + (overScroll * 0.3); // 70% resistance
      }
      
      scheduleSwipeX(newX);
      
      lastX = currentTouchX;
      lastTime = currentTime;
      e.preventDefault();
    };
    
    const handleTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      flushPendingSwipeX();
      container.style.cursor = 'grab';
      const totalDelta = startTranslateX - currentX; // Positive = swiped left
      const targetIndex = getSnapIndexByVelocity(dragStartSnapIndex, totalDelta, velocity);
      let targetX = snapPoints[targetIndex];
      // Deadzone near start to prevent accidental snap to center on tap
      if (Math.abs(currentX) < 30) {
        targetX = snapPoints[0];
      }
        momentumAnimation = trackTween(container, {
          x: targetX,
        duration: 0.5,
        ease: 'back.out(1.15)',
          force3D: true,
          onUpdate: () => {
            currentX = gsap.getProperty(container, 'x') as number;
          },
          onComplete: () => {
            momentumAnimation = null;
          container.style.willChange = 'auto';
          setDetailSwipeActive(false);
          // Final position update
          const finalIndex = getNearestSnapIndex(currentX);
          updateTextMarginForPosition(finalIndex);
          }
        });
    };
    
    // Mouse handlers for desktop
    const handleMouseDown = (e: MouseEvent) => {
      // 🔥 USER REQUEST: Don't start dragging immediately - wait for actual movement
      // Just store initial position, don't set isDragging = true yet
      startX = e.clientX;
      lastX = startX;
      startTranslateX = currentX;
      dragStartSnapIndex = getNearestSnapIndex(startTranslateX);
      lastTime = performance.now();
      velocity = 0;
      // Don't set isDragging = true here - wait for mousemove
      // Don't preventDefault here - allow normal mouse behavior
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      // 🔥 USER REQUEST: Start dragging only when user actually moves mouse (not on click)
      if (!isDragging) {
        const deltaX = Math.abs(e.clientX - startX);
        // Only start dragging if moved more than 5px (prevents accidental drag on click)
        if (deltaX < 5) return;
        
        // Now start dragging
        isDragging = true;
        // Kill any ongoing momentum animation
        if (momentumAnimation) {
          momentumAnimation.kill();
          momentumAnimation = null;
        }
        container.style.willChange = 'transform';
        setDetailSwipeActive(true);
        container.style.cursor = 'grabbing';
      }
      
      const currentMouseX = e.clientX;
      const currentTime = performance.now();
      // 🔥 FIX: Natural swipe logic - swipe left (prst ide lijevo) = content ide lijevo
      const deltaX = startX - currentMouseX; // Positive = swiped left, Negative = swiped right
      const timeDelta = currentTime - lastTime;
      
      if (timeDelta > 0) {
        velocity = (lastX - currentMouseX) / timeDelta; // Positive = left, Negative = right
      }
      
      // Swipe left (positive deltaX) → move container left (negative translateX)
      let newX = startTranslateX - deltaX;
      
      if (newX > 0) {
        newX = newX * 0.3;
      } else if (newX < -maxScroll) {
        const overScroll = newX + maxScroll;
        newX = -maxScroll + (overScroll * 0.3);
      }
      
      scheduleSwipeX(newX);
      
      lastX = currentMouseX;
      lastTime = currentTime;
      e.preventDefault();
    };
    
    const handleMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      flushPendingSwipeX();
      container.style.cursor = 'grab';
      const totalDelta = startTranslateX - currentX; // Positive = swiped left
      const targetIndex = getSnapIndexByVelocity(dragStartSnapIndex, totalDelta, velocity);
      let targetX = snapPoints[targetIndex];
      if (Math.abs(currentX) < 30) {
        targetX = snapPoints[0];
      }
        momentumAnimation = trackTween(container, {
          x: targetX,
        duration: 0.5,
        ease: 'back.out(1.15)',
          force3D: true,
          onUpdate: () => {
            currentX = gsap.getProperty(container, 'x') as number;
          },
          onComplete: () => {
            momentumAnimation = null;
          container.style.willChange = 'auto';
          setDetailSwipeActive(false);
          // 🔥 USER REQUEST: Update text margin after mouse swipe completes
          const finalIndex = getNearestSnapIndex(currentX);
          updateTextMarginForPosition(finalIndex);
        }
      });
    };
    
    // Attach event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);
    
    // 🔥 USER REQUEST: Function to slide to specific snap position
    const slideToPosition = (snapIndex: number) => {
      if (snapIndex < 0 || snapIndex >= snapPoints.length) return;
      // Don't slide if already dragging
      if (isDragging) {
        logger.info('🎯 Slide to position ignored - user is dragging');
        return;
      }
      const targetX = snapPoints[snapIndex];
      // Kill any ongoing momentum animation
      if (momentumAnimation) {
        momentumAnimation.kill();
        momentumAnimation = null;
      }
      flushPendingSwipeX();
      container.style.willChange = 'transform';
      setDetailSwipeActive(true);
        momentumAnimation = trackTween(container, {
          x: targetX,
        duration: 0.5,
        ease: 'back.out(1.15)',
          force3D: true,
          onUpdate: () => {
            currentX = gsap.getProperty(container, 'x') as number;
          },
          onComplete: () => {
            momentumAnimation = null;
          container.style.willChange = 'auto';
          setDetailSwipeActive(false);
          // 🔥 USER REQUEST: Update text margin after slide completes
          const finalIndex = getNearestSnapIndex(currentX);
          updateTextMarginForPosition(finalIndex);
        }
      });
    };

    const isPointInsideDetailCard = (clientX: number, clientY: number) => {
      if (!detailImageForTap) return false;
      const rect = detailImageForTap.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    };
    const maybePlayCenteredCardTapBounce = (source: string, clientX: number, clientY: number, startX: number, startY: number, startTime: number) => {
      const now = performance.now();
      const insideCard = isPointInsideDetailCard(clientX, clientY);
      if (isDragging || !insideCard) {
        return;
      }
      const moveDistance = Math.sqrt(Math.pow(clientX - startX, 2) + Math.pow(clientY - startY, 2));
      const tapDuration = now - startTime;
      if (moveDistance > CARD_TAP_MOVE_THRESHOLD || tapDuration > CARD_TAP_TIME_THRESHOLD) {
        return;
      }
      if (source === 'mouse' && now - lastCardTapTouchAt < 700) {
        return;
      }
      if (now - lastCardTapBounceAt < 260) {
        return;
      }
      lastCardTapBounceAt = now;
      playDetailCardTapCartoonBounce(detailImageForTap);
      detailImageForTap.dispatchEvent(new CustomEvent('cc:journey-detail-card-play', {
        bubbles: true,
        cancelable: true,
        detail: { source },
      }));
    };

    const handleCardTapTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      cardTapStartX = e.touches[0].clientX;
      cardTapStartY = e.touches[0].clientY;
      cardTapStartTime = performance.now();
    };

    const handleCardTapTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      lastCardTapTouchAt = performance.now();
      const touch = e.changedTouches[0];
      maybePlayCenteredCardTapBounce('touch', touch.clientX, touch.clientY, cardTapStartX, cardTapStartY, cardTapStartTime);
    };

    const handleCardTapMouseDown = (e: MouseEvent) => {
      cardTapStartX = e.clientX;
      cardTapStartY = e.clientY;
      cardTapStartTime = performance.now();
    };

    const handleCardTapMouseUp = (e: MouseEvent) => {
      maybePlayCenteredCardTapBounce('mouse', e.clientX, e.clientY, cardTapStartX, cardTapStartY, cardTapStartTime);
    };

    container.addEventListener('touchstart', handleCardTapTouchStart, { passive: true, capture: true });
    container.addEventListener('touchend', handleCardTapTouchEnd, { passive: true, capture: true });
    container.addEventListener('mousedown', handleCardTapMouseDown, { capture: true });
    container.addEventListener('mouseup', handleCardTapMouseUp, { capture: true });
    
    // Store handlers for cleanup
    (container as any).__detailSwipeHandlers = {
      touchStart: handleTouchStart,
      touchMove: handleTouchMove,
      touchEnd: handleTouchEnd,
      mouseDown: handleMouseDown,
      mouseMove: handleMouseMove,
      mouseUp: handleMouseUp,
      cardTapTouchStart: handleCardTapTouchStart,
      cardTapTouchEnd: handleCardTapTouchEnd,
      cardTapMouseDown: handleCardTapMouseDown,
      cardTapMouseUp: handleCardTapMouseUp,
      cancelSwipeRaf: () => {
        if (swipeRafId !== null) {
          cancelAnimationFrame(swipeRafId);
          swipeRafId = null;
        }
        pendingSwipeX = null;
        setDetailSwipeActive(false);
      },
      quickSetX: quickSetX,
      slideToPosition: slideToPosition,
      snapPoints: snapPoints,
      getIsDragging: () => isDragging // Expose isDragging state
    };
    (container as any).__detailSwipeHandlersSetAt = Date.now();
    
    logger.info('✅ Apple style GSAP smooth swipe initialized');
  }

  private async openBoardDetails(
    board: JourneyBoard,
    skipJourneyExit: boolean = false,
    journeyExitPromise?: Promise<void>
  ): Promise<void> {
    console.log('🧩 JourneyUnitExit openBoardDetails-entry', {
      boardId: board.id,
      interim: board.interim === true,
      skipJourneyExit,
      hasJourneyExitPromise: !!journeyExitPromise,
    });
    if (skipJourneyExit && !journeyExitPromise && !board.interim) {
      console.warn('🧩 JourneyUnitExit openBoardDetails-missing-exit-promise-starting-fallback', {
        boardId: board.id,
      });
      journeyExitPromise = this.startBoardAreaThenJourneyExit(board.id);
    }

    // 🔥 USER REQUEST: Save Journey scroll position BEFORE opening detail modal (restore on close)
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
      if (scrollable) {
        (window as any).__ccJourneyScrollTop = scrollable.scrollTop;
        try { localStorage.setItem('__ccJourneyScrollTop', String(scrollable.scrollTop)); } catch {}
        logger.info(`🗺️ Saved Journey scroll position before detail modal: ${scrollable.scrollTop}`);
      }
      (window as any).__ccJourneyReturnBoardId = board.id;
      try { localStorage.setItem(JOURNEY_RETURN_BOARD_ID_KEY, String(board.id)); } catch {}
      logger.info(`🗺️ Saved Journey return board id before detail modal: ${board.id}`);
    } catch {}

    // 🔥 CRITICAL: Clear interim flags when opening REGULAR (non-interim) board
    // Prevents stale state from interim session when switching back to regular cards → crash on exit
    if (!board.interim) {
      clearJourneyInterimOrigin();
      logger.info('🧹 Cleared interim flags when opening regular board detail modal');
    }
    
    // 🔥 MEMORY LEAK FIX: Stop any existing detail image idle animation from previous modal
    const existingModal = document.getElementById('collectibles-detail-modal') as HTMLElement;
    if (existingModal) {
      cleanupDetailStatsEnterAnimation(existingModal);

      const existingImage = existingModal.querySelector('#detail-card-image') as HTMLElement;
      if (existingImage) {
        const existingMotion = existingImage.querySelector('.detail-image-motion') as HTMLElement | null;
        existingImage.style.animation = 'none';
        existingImage.style.animationPlayState = 'paused';
        if (existingMotion) {
          existingMotion.style.animation = 'none';
          existingMotion.style.animationPlayState = 'paused';
        }
        existingImage.querySelectorAll('img').forEach((img) => {
          try {
            (img as HTMLImageElement).removeAttribute('src');
            (img as HTMLImageElement).src = '';
          } catch {}
        });
        existingImage.innerHTML = '';
        logger.info('🧹 Stopped existing detail image idle animation before opening new modal');
      }
    }

    this.pauseJourneyAreaIdleForInteraction(0);

    // Defer preloads until the modal is settled and not being swiped. Running these during
    // the first modal drag is visible on iOS as card/slider stutter.
    const scheduleDetailIdlePreload = (delayMs = 2400, attempt = 0) => {
      this.trackTimeout(() => {
      const activeDetailModal = document.getElementById('collectibles-detail-modal') as HTMLElement | null;
      const modalStillShowingBoard =
        !!activeDetailModal &&
        activeDetailModal.hidden !== true &&
        activeDetailModal.style.display !== 'none' &&
        activeDetailModal.getAttribute('data-journey-board-id') === String(board.id);
      if (!modalStillShowingBoard) {
        logger.info(`⏭️ Skipping board ${board.id} delayed preload because detail modal is no longer active`);
        return;
      }
      const modalBusy =
        activeDetailModal.classList.contains('detail-swipe-active') ||
        (window as any).__ccJourneyViewportTransitionLocked === true;
      if (modalBusy && attempt < 8) {
        scheduleDetailIdlePreload(900, attempt + 1);
        return;
      }

      const runPreload = () => {
        // 🔥 USER REQUEST: Preload journey board images in background (NON-BLOCKING)
        void import('../utils/comprehensive-image-preloader.js')
          .then(({ preloadJourneyBoardImages }) => preloadJourneyBoardImages([board.id]))
          .then(() => {
            logger.info(`✅ Journey board ${board.id} image preloaded in background`);
          })
          .catch((error) => {
            logger.warn('⚠️ Failed to preload journey board images:', error);
          });

        // 🔥 CRITICAL: Preload game assets in background to avoid delay on Play click.
        if (shouldSkipDetailModalGameAssetPreload()) {
          logger.info(`⏭️ Skipping board ${board.id} game asset preload during detail modal open (recent game exit or inactive PIXI app)`);
          return;
        }

        void import('../utils/board-asset-warmup.js')
          .then(({ warmBoardGameAssetsSoon }) => {
            warmBoardGameAssetsSoon({
              mode: 'journey',
              boardNumber: board.id,
              reason: 'journey-detail-open-idle',
              timeoutMs: 1400,
            });
          })
          .catch((error) => {
            logger.warn('⚠️ Failed to schedule resident game texture preload:', error);
          });
      };

      if (typeof (window as any).requestIdleCallback === 'function') {
        (window as any).requestIdleCallback(runPreload, { timeout: 1800 });
      } else {
        this.trackTimeout(runPreload, 0);
      }
      }, delayMs);
    };
    scheduleDetailIdlePreload();
    
    logger.info(`🎬 Opening board details for board ${board.id}${skipJourneyExit ? ' (skipping Journey exit)' : ' after Journey exit'}`);
    logger.debug('Journey board detail data', {
      id: board.id,
      name: board.name,
      imagePath: board.imagePath,
      interim: board.interim,
      unlocked: board.unlocked
    });
    
    if (!skipJourneyExit) {
      await this.startJourneyExitAnimation();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    } else if (journeyExitPromise) {
      await journeyExitPromise;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    
    // Step 2: Now open detail modal with enter animation
    const detailModal = document.getElementById('collectibles-detail-modal');
    if (detailModal) {
      journeySpatialMotion.deactivateJourneyDetailModal();
      // 🔥 SAFETY: Ensure modal is interactive even after previous exit
      (detailModal as any).__detailModalExiting = false;
      (detailModal as HTMLElement).style.pointerEvents = 'auto';
      resetDetailStatsDomForOpen(detailModal as HTMLElement);
      
      // 🔥 USER BUG FIX: Ensure X button exists and is visible IMMEDIATELY when modal is opened
      // This fixes issue where X button is missing after hard exit
      const detailCloseBtnEarly = detailModal.querySelector('#detail-close-btn') as HTMLElement;
      if (detailCloseBtnEarly) {
        // Force X button to be visible immediately
        detailCloseBtnEarly.style.display = 'flex';
        detailCloseBtnEarly.style.visibility = 'visible';
        detailCloseBtnEarly.style.opacity = '1';
        detailCloseBtnEarly.style.pointerEvents = 'auto';
        detailCloseBtnEarly.style.zIndex = '2000000';
        detailCloseBtnEarly.style.position = 'relative';
        detailCloseBtnEarly.style.cursor = 'pointer';
        
        // Ensure img element exists and is visible
        let closeBtnImgEarly = detailCloseBtnEarly.querySelector('img') as HTMLImageElement;
        if (!closeBtnImgEarly) {
          // If img doesn't exist, create it
          closeBtnImgEarly = document.createElement('img');
          closeBtnImgEarly.src = './assets/close-icon.png';
          closeBtnImgEarly.alt = '';
          closeBtnImgEarly.setAttribute('aria-hidden', 'true');
          detailCloseBtnEarly.appendChild(closeBtnImgEarly);
          logger.info('✅ X button img element created (was missing)');
        }
        
        // Ensure img is visible
        closeBtnImgEarly.style.display = 'block';
        closeBtnImgEarly.style.visibility = 'visible';
        closeBtnImgEarly.style.opacity = '1';
        closeBtnImgEarly.style.width = '24px';
        closeBtnImgEarly.style.height = '24px';
        if (!closeBtnImgEarly.src || closeBtnImgEarly.src.includes('undefined') || closeBtnImgEarly.src.includes('null')) {
          closeBtnImgEarly.src = './assets/close-icon.png';
        }
        
        logger.info('✅ X button made visible IMMEDIATELY when modal opened');
      } else {
        logger.error('❌ CRITICAL: X button (#detail-close-btn) NOT FOUND in modal! Modal may not be rendered correctly.');
      }
      
      detailModal.removeAttribute('hidden');
      (detailModal as HTMLElement).style.display = 'flex';
      // Keep modal invisible until enter animation kicks in (prevents flash)
      (detailModal as HTMLElement).style.visibility = 'hidden';
      (detailModal as HTMLElement).style.opacity = '0';
      
      // 🔥 CRITICAL FIX: Prepare divideri for enter animation (display: block, but opacity: 0)
      // This fixes issue where divideri are missing after Exit → detail modal transition
      // BUT keeps them invisible until enter animation starts (prevents 1-frame flash)
      const detailStatsListEarly = detailModal.querySelector('.detail-stats-list') as HTMLElement | null;
      if (detailStatsListEarly) {
        const statDividersEarly = Array.from(detailStatsListEarly.querySelectorAll('.detail-stat-divider')) as HTMLElement[];
        statDividersEarly.forEach((divider) => {
          // Override exit animation's display: none !important
          divider.style.setProperty('display', 'block', 'important');
          // 🔥 SCREEN ARTIFACTS FIX: Keep opacity: 0 and visibility: hidden until enter animation starts
          divider.style.setProperty('opacity', '0', 'important');
          divider.style.setProperty('visibility', 'hidden', 'important');
          divider.style.removeProperty('transform');
        });
        logger.info(`✅ Prepared ${statDividersEarly.length} divideri for enter animation (display: block, opacity: 0)`);
      }
      
      // ⚡ INSTANT SHOW: Defer non-essential prep to background (runs during animation)
      // This eliminates ~80-120ms of DOM manipulation
      setTimeout(() => {
      // 🔥 USER REQUEST: Mark card as viewed - stop animations forever for this card
      // Only mark unlocked cards (interim cards don't have detail modal, so they keep animating)
      if (!board.interim) {
        // Find the card element by board ID
        const cardElement = document.querySelector(`.journey-board-card[data-board-id="${board.id}"]`) as HTMLElement;
        if (cardElement && JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.markCardAsViewed === 'function') {
          JOURNEY_CARD_IDLE_BOUNCE.markCardAsViewed(cardElement);
          logger.info(`✅ Card for board ${board.id} marked as viewed - animations stopped forever`);
        }
        
        // 🔥 USER REQUEST: Remove ribbon when card is viewed
        if (cardElement) {
          const ribbon = cardElement.querySelector('.journey-card-ribbon');
          if (ribbon) {
            ribbon.remove();
            logger.info(`🎀 Removed ribbon from board ${board.id} (now viewed)`);
          }
        }
        
        // 🔥 USER REQUEST: Mark board as viewed for badge counting
        // Badge count decreases by 1 when details screen is opened
        this.markBoardAsViewed(board.id);
      }
      }, 0);
      
      // Store board ID in modal for Play Board button
      detailModal.setAttribute('data-journey-board-id', board.id.toString());
      
      // ⚡ INSTANT SHOW: Defer reset button setup to background
      setTimeout(() => {
      // 🔥 USER REQUEST: Setup reset stats button (dev tool) - only for journey boards
      const resetStatsBtn = detailModal.querySelector('#detail-reset-stats-btn') as HTMLElement;
      if (resetStatsBtn) {
        // Show reset button for journey boards
        resetStatsBtn.style.display = 'flex';
        resetStatsBtn.style.visibility = 'visible';
        
        // Remove existing listener if any to prevent duplicates
        const newResetBtn = resetStatsBtn.cloneNode(true);
        resetStatsBtn.parentNode?.replaceChild(newResetBtn, resetStatsBtn);
        
        const handleResetStats = async (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          logger.debug(`🔄 Reset stats button clicked for board ${board.id}`);
          
          try {
            const { boardStatsService } = await import('../services/board-stats-service.js');
            boardStatsService.resetBoardStats(board.id);
            logger.info(`🧹 Board ${board.id} stats reset (high score, longest combo, cubes cracked)`);
            
            // Refresh stats display in modal
            const highScoreEl = document.getElementById('detail-stat-highscore-value');
            const comboEl = document.getElementById('detail-stat-combo-value');
            const cubesEl = document.getElementById('detail-stat-cubes-value');
            
            const boardStats = boardStatsService.getBoardStats(board.id);
            if (highScoreEl) {
              highScoreEl.textContent = boardStats.highScore.toLocaleString();
            }
            if (comboEl) {
              comboEl.textContent = boardStats.longestCombo.toString();
            }
            if (cubesEl) {
              cubesEl.textContent = boardStats.cubesCracked.toLocaleString();
            }
            
            // 🔥 CRITICAL FIX: Refresh score bottom sheet if it's currently open
            // This ensures score bottom sheet shows updated stats after reset
            try {
              const scoreBottomSheetModule = await import('../modules/score-bottom-sheet.js');
              if (scoreBottomSheetModule && typeof scoreBottomSheetModule.isScoreBottomSheetVisible === 'function') {
                if (scoreBottomSheetModule.isScoreBottomSheetVisible()) {
                  logger.debug('📊 Score bottom sheet is open - refreshing stats after reset');
                  // showScoreBottomSheet will refresh stats if already visible
                  if (typeof scoreBottomSheetModule.showScoreBottomSheet === 'function') {
                    scoreBottomSheetModule.showScoreBottomSheet();
                  }
                }
              }
            } catch (error) {
              logger.warn('⚠️ Failed to refresh score bottom sheet after reset:', error);
            }
            
            // Show feedback
            alert(`${formatGameplayProgressLabel('journey', board.id)} stats reset to 0`);
          } catch (error) {
            logger.error(`❌ Failed to reset board ${board.id} stats:`, error);
            alert('Error resetting stats');
          }
        };
        
        (newResetBtn as HTMLElement).addEventListener('click', handleResetStats);
        (newResetBtn as HTMLElement).addEventListener('touchend', handleResetStats, { passive: true });
        logger.debug('✅ Reset stats button listener attached');
      }
      }, 0); // End deferred reset button setup
      
      // 🔥 BUG FIX: Set card image - prepare for animation (will be animated, not always visible)
      // ⚡ ESSENTIAL: This MUST run immediately for GSAP animations!
      const imageEl = detailModal.querySelector('#detail-card-image') as HTMLElement;
      if (imageEl) {
        imageEl.innerHTML = '';
        const motionEl = document.createElement('div');
        motionEl.className = 'detail-image-motion';
        const img = document.createElement('img');
        img.src = board.interim ? './assets/colelctibles/common back.png' : (board.imagePath || '');
        img.alt = board.name || formatGameplayProgressLabel('journey', board.id);
        img.loading = 'eager';
        (img as any).decoding = 'async';
        (img as any).fetchPriority = 'high';
        (imageEl as any).__detailImageReady = waitForImageReady(
          img,
          wasRecentGameExitForDetailMotion() ? 160 : 700
        );
        motionEl.appendChild(img);
        imageEl.appendChild(motionEl);
        
        // 🔥 BUG FIX: Set initial hidden state to avoid flash before GSAP enter
        imageEl.style.display = 'flex';
        imageEl.style.transition = 'none';
        imageEl.style.opacity = '0';
        imageEl.style.visibility = 'hidden';
        imageEl.style.transform = 'scale(0)';
        imageEl.style.transformOrigin = 'center center';
        imageEl.style.animation = 'none';
        imageEl.style.animationPlayState = 'paused';
        imageEl.classList.remove('animate-enter-initial', 'animate-enter', 'animate-exit', 'animate-reset');

        motionEl.style.animation = 'none';
        motionEl.style.animationPlayState = 'paused';
        
        img.style.display = 'block';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.opacity = '1';
        img.style.visibility = 'visible';
        img.style.animation = 'none';
        img.style.animationPlayState = 'paused';
      }

      // ⚡ INSTANT SHOW: Defer title, badge, description, stats to background (~60ms saved)
      setTimeout(() => {
      // Set title in header (Board 01, Board 02, etc.)
      const titleEl = detailModal.querySelector('#detail-title');
      if (titleEl) {
        const boardNumberStr = formatJourneyWorldStageNumber(board.id);
        titleEl.textContent = formatGameplayProgressLabel('journey', boardNumberStr);
        logger.info(`✅ Detail modal title set to: ${formatGameplayProgressLabel('journey', boardNumberStr)}`);
      }

      // Set rarity badge to "COMMON"
      const rarityBadge = detailModal.querySelector('#detail-card-rarity');
      if (rarityBadge) {
        rarityBadge.textContent = 'COMMON';
        rarityBadge.classList.remove('legendary');
        logger.info(`✅ Rarity badge set to COMMON for board ${board.id}`);
      }
      
      // 🔥 IMPERATIVE: Text 80px right from card - inside stats+card container
      const descEl = detailModal.querySelector('#detail-card-description') as HTMLElement;
      const statsCardSection = detailModal.querySelector('#detail-section-stats-card') as HTMLElement;
      const isIPad = isTabletDetailModalViewport();
      
      // 🔥 CRITICAL: Ensure consistent padding on stats-card section (no right padding, container reduced by 200px)
      if (statsCardSection && !isIPad) {
        statsCardSection.style.padding = '0 0 24px 24px'; // No right padding (container reduced by 200px)
        statsCardSection.style.paddingTop = '0';
      } else if (statsCardSection && isIPad) {
        statsCardSection.style.padding = '';
        statsCardSection.style.paddingTop = '';
      }
      
      if (descEl) {
        if (isIPad) {
          /* iPad Journey: flavor copy removed — CSS [data-journey-board-id] hides; keep empty & no inline show */
          descEl.textContent = '';
          descEl.setAttribute('aria-hidden', 'true');
          descEl.style.cssText = `
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
            position: absolute !important;
          `;
        } else {
          descEl.removeAttribute('aria-hidden');
          descEl.textContent = "The stage waits.\nA single move appears.\nEverything begins.";
          descEl.style.cssText = `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            color: #AD8775 !important;
            font-size: 20px !important;
            text-align: center !important;
            white-space: pre-line !important;
            margin-left: 80px !important;
            width: 220px !important;
            max-width: 220px !important;
            padding: 0 !important;
            line-height: 1.4 !important;
            flex-shrink: 0 !important;
          `;
        }
      }
      
      // 🔥 JOURNEY BOARDS: Display board stats (High Score, Longest Combo, Cubes Cracked)
      // Load both board stats and global stats
      Promise.all([
        import('../services/board-stats-service.js'),
        import('../services/stats-service.js')
      ]).then(([{ boardStatsService }, { statsService }]) => {
        const boardStats = boardStatsService.getBoardStats(board.id);
        const globalStats = statsService.getStats();
        
        // Update stats values in new swipeable format
        const highScoreEl = document.getElementById('detail-stat-highscore-value');
        const comboEl = document.getElementById('detail-stat-combo-value');
        const cubesEl = document.getElementById('detail-stat-cubes-value');
        
        if (highScoreEl) {
          highScoreEl.textContent = boardStats.highScore.toLocaleString();
        }
        if (comboEl) {
          comboEl.textContent = boardStats.longestCombo.toString();
        }
        if (cubesEl) {
          // 🔥 USER REQUEST: Use per-board cubes cracked instead of global
          cubesEl.textContent = boardStats.cubesCracked.toLocaleString();
        }
        
        logger.info(`✅ Board stats displayed for board ${board.id}:`, {
          highScore: boardStats.highScore,
          longestCombo: boardStats.longestCombo,
          cubesCracked: boardStats.cubesCracked // 🔥 USER REQUEST: Per-board cubes cracked
        });
      }).catch((error) => {
        logger.warn('⚠️ Failed to load board stats:', error);
      });
      }, 0); // End deferred content prep
      
      // 🔥 CLEAN START: Initialize simple swipe
      const swipeableContainer = detailModal.querySelector('.detail-swipeable-container') as HTMLElement;
      if (swipeableContainer) {
        resetDetailModalHorizontalSwipeLayout(swipeableContainer);
        const isIPad = isTabletDetailModalViewport();
        gsap.set(swipeableContainer, { x: 0 });
        setTimeout(() => {
          if (isIPad) {
            resetDetailModalHorizontalSwipeLayout(swipeableContainer);
            swipeableContainer.style.willChange = 'auto';
            if ((swipeableContainer as any).__detailSwipeHandlers) {
              const handlers = (swipeableContainer as any).__detailSwipeHandlers;
              swipeableContainer.removeEventListener('touchstart', handlers.touchStart);
              swipeableContainer.removeEventListener('touchmove', handlers.touchMove);
              swipeableContainer.removeEventListener('touchend', handlers.touchEnd);
              swipeableContainer.removeEventListener('touchcancel', handlers.touchEnd);
              swipeableContainer.removeEventListener('mousedown', handlers.mouseDown);
              swipeableContainer.removeEventListener('mousemove', handlers.mouseMove);
              swipeableContainer.removeEventListener('mouseup', handlers.mouseUp);
              swipeableContainer.removeEventListener('mouseleave', handlers.mouseUp);
              if (handlers.cancelSwipeRaf) {
                handlers.cancelSwipeRaf();
              }
              delete (swipeableContainer as any).__detailSwipeHandlers;
            }
            return;
          }

          this.initDetailModalSwipe(swipeableContainer);
          
          // 🔥 USER REQUEST: Add peekaboo tap detection directly on swipeable container
          // Detect taps on right edge (peekaboo area) when at position 0
          if ((swipeableContainer as any).__detailSwipeHandlers) {
            const handlers = (swipeableContainer as any).__detailSwipeHandlers;
            const slideToPosition = handlers.slideToPosition;
            const snapPoints = handlers.snapPoints;
            
            if (slideToPosition && snapPoints && snapPoints.length >= 2) {
              let peekabooTapStartX = 0;
              let peekabooTapStartY = 0;
              let peekabooTapStartTime = 0;
              const PEEKABOO_TAP_THRESHOLD = 10;
              const PEEKABOO_TAP_TIME_THRESHOLD = 300;
              
              // Listen for taps on swipeable container
              const handlePeekabooTap = (e: TouchEvent) => {
                // Only handle touchend events
                if (e.type !== 'touchend') return;
                
                // Check if we're at position 0
                const currentX = gsap.getProperty(swipeableContainer, 'x') as number;
                const isAtPosition0 = Math.abs(currentX - snapPoints[0]) < 10;
                if (!isAtPosition0) return;
                
                // Check if touch was in peekaboo area (right 100px of screen)
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const viewportWidth = window.innerWidth;
                const peekabooLeft = viewportWidth - 100;
                
                if (endX < peekabooLeft) {
                  // Not in peekaboo area
                  return;
                }
                
                // Check if it was a tap (not a swipe)
                const moveDistance = Math.sqrt(
                  Math.pow(endX - peekabooTapStartX, 2) + 
                  Math.pow(endY - peekabooTapStartY, 2)
                );
                const tapDuration = performance.now() - peekabooTapStartTime;
                const isTap = moveDistance < PEEKABOO_TAP_THRESHOLD && tapDuration < PEEKABOO_TAP_TIME_THRESHOLD;
                
                if (isTap) {
                  logger.info('🎯 Peekaboo area tapped - sliding to full card view');
                  
                  slideToPosition(1);
                }
              };
              
              const handlePeekabooTouchStart = (e: TouchEvent) => {
                if (e.touches.length > 0) {
                  peekabooTapStartX = e.touches[0].clientX;
                  peekabooTapStartY = e.touches[0].clientY;
                  peekabooTapStartTime = performance.now();
                }
              };
              
              // Add listeners with capture to catch before swipe logic
              swipeableContainer.addEventListener('touchstart', handlePeekabooTouchStart, { passive: true, capture: true });
              swipeableContainer.addEventListener('touchend', handlePeekabooTap, { passive: true, capture: true });
              
              // Store handlers for cleanup
              (swipeableContainer as any).__peekabooTapHandlers = {
                touchStart: handlePeekabooTouchStart,
                touchEnd: handlePeekabooTap
              };
              
              logger.debug('✅ Peekaboo tap detection added to swipeable container');
            }
          }
          
          // 🔥 IMPERATIVE: Re-apply 80px margin and 140px width after swipe init
          const descElAfterInit = detailModal.querySelector('#detail-card-description') as HTMLElement;
          
          if (descElAfterInit) {
            const isIPad = isTabletDetailModalViewport();
            if (isIPad) {
              descElAfterInit.textContent = '';
              descElAfterInit.setAttribute('aria-hidden', 'true');
              descElAfterInit.style.cssText = `
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
                position: absolute !important;
              `;
            } else {
              if (!descElAfterInit.textContent || descElAfterInit.textContent.trim() === '') {
                descElAfterInit.textContent = "The stage waits.\nA single move appears.\nEverything begins.";
              }
              descElAfterInit.removeAttribute('aria-hidden');
              descElAfterInit.style.marginLeft = '80px';
              descElAfterInit.style.width = '220px';
              descElAfterInit.style.maxWidth = '220px';
              descElAfterInit.style.textAlign = 'center'; /* 🔥 USER REQUEST: Center text */
              descElAfterInit.style.whiteSpace = 'pre-line'; /* Each sentence on its own line */
              descElAfterInit.style.display = 'block';
              descElAfterInit.style.visibility = 'visible';
              descElAfterInit.style.opacity = '1';
              descElAfterInit.style.flexShrink = '0';
            }
          }
        }, 100);
      }

      // iPad-only: add elastic drag (fake bounce) on detail modal
      const isIPadElastic = (() => {
        const ua = navigator.userAgent || '';
        const isIPadUA = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
        const vw = window.innerWidth || 0;
        return isIPadUA || (vw >= 769 && vw <= 1366);
      })();
      if (isIPadElastic) {
        const modalRoot = detailModal as HTMLElement;
        const elasticTarget = detailModal.querySelector('.detail-content') as HTMLElement | null;
        const headerEl = detailModal.querySelector('.detail-header') as HTMLElement | null;
        const swipeable = detailModal.querySelector('.detail-swipeable-container') as HTMLElement | null;
        if (modalRoot && elasticTarget) {
          if ((elasticTarget as any).__detailElasticHandlers) {
            const handlers = (elasticTarget as any).__detailElasticHandlers;
            elasticTarget.removeEventListener('touchstart', handlers.start);
            elasticTarget.removeEventListener('touchmove', handlers.move);
            elasticTarget.removeEventListener('touchend', handlers.end);
          }
          let startY = 0;
          let currentY = 0;
          let isDragging = false;
          const damping = 0.35;
          const maxPull = 80;
          const onStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            if (headerEl && headerEl.contains(e.target as Node)) return;
            startY = e.touches[0].clientY;
            currentY = 0;
            isDragging = true;
            elasticTarget.style.transition = 'none';
          };
          const onMove = (e: TouchEvent) => {
            if (!isDragging || e.touches.length !== 1) return;
            const dy = e.touches[0].clientY - startY;
            // Only allow a small elastic pull
            const pull = Math.max(-maxPull, Math.min(maxPull, dy * damping));
            currentY = pull;
            // Move only content area (not header)
            if (swipeable) {
              swipeable.style.transform = `translateY(${pull}px)`;
            } else {
              elasticTarget.style.transform = `translateY(${pull}px)`;
            }
          };
          const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            const target = swipeable || elasticTarget;
            target.style.transition = 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)';
            target.style.transform = 'translateY(0px)';
            window.setTimeout(() => {
              target.style.transition = '';
            }, 240);
          };
          elasticTarget.addEventListener('touchstart', onStart, { passive: true });
          elasticTarget.addEventListener('touchmove', onMove, { passive: true });
          elasticTarget.addEventListener('touchend', onEnd, { passive: true });
          (elasticTarget as any).__detailElasticHandlers = { start: onStart, move: onMove, end: onEnd };
        }
      }

      // 🔥 USER REQUEST: Show/hide buttons based on board state
      // ONLY interim board shows "Continue" CTA
      // ALL other boards (including last unlocked) have NO CTA buttons
      const isInterim = board.interim === true;
      const playBoardBtn = detailModal.querySelector('#detail-play-board-btn');
      const continueBoardBtn = detailModal.querySelector('#detail-continue-board-btn');
      
      // 🔥 CRITICAL: Always hide BOTH old buttons first (default state) - use !important to override CSS
      if (playBoardBtn) {
        (playBoardBtn as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      if (continueBoardBtn) {
        (continueBoardBtn as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      
      // 🔥 JOURNEY BOARDS: Create/update floating Play button (non-interim)
      // Remove any floating play button remnants
      const floatingPlay = document.getElementById('board-detail-play-button');
      if (floatingPlay) {
        try { getRegisteredCta(floatingPlay as HTMLButtonElement)?.dispose(); } catch {}
        floatingPlay.remove();
      }
      const previousCardPlayHandler = (detailModal as any).__ccJourneyDetailCardPlayHandler as EventListener | undefined;
      if (previousCardPlayHandler) {
        try {
          detailModal.removeEventListener('cc:journey-detail-card-play', previousCardPlayHandler, { capture: false } as any);
        } catch {}
        delete (detailModal as any).__ccJourneyDetailCardPlayHandler;
      }

      let playButtonForAnimation: HTMLElement | null = null;
      
      if (!isInterim) {
        // Journey-wide rule for every regular board/world: a real
        // board-specific save means resume/Continue; no save means fresh/Play.
        // Exit-without-a-move already clears this save, so reopening the card
        // correctly returns to Play without another UI-specific flag.
        const boardHasSavedState = hasResumableSavedStateForBoard(board.id, { clearInvalid: true });
        const buttonText = boardHasSavedState ? 'Continue' : 'Play';
        const ariaLabel = boardHasSavedState ? 'Continue Stage' : 'Play Stage';
        
        logger.debug(`🎮 Board ${board.id} button will show: "${buttonText}"`, { hasSavedState: boardHasSavedState });
        
        // Create new floating play button - EXACT same style as homepage slider CTA with shimmer
        const floatingPlayButton = document.createElement('button');
        floatingPlayButton.id = 'board-detail-play-button';
        floatingPlayButton.className = 'cc-journey-detail-cta';
        floatingPlayButton.textContent = buttonText;
        floatingPlayButton.setAttribute('type', 'button');
        floatingPlayButton.setAttribute('aria-label', ariaLabel);
        
        // Prevent dragging/moving the button (but keep :active working for tap-scale)
        // Add to modal - append to modal (fixed positioning)
        detailModal.appendChild(floatingPlayButton);
        
        // Fixed positioning at bottom, centered (same as homepage slider CTA)
        // 🔥 CRITICAL: NO inline transform/opacity/visibility - let CSS handle EVERYTHING
        // This allows tap-scale :active and animate-enter classes to work correctly
        floatingPlayButton.style.position = 'fixed';
        floatingPlayButton.style.bottom = 'calc(40px + env(safe-area-inset-bottom, 0px))';
        floatingPlayButton.style.left = 'calc(50% - 124.5px)';
        floatingPlayButton.style.width = '249px';
        floatingPlayButton.style.maxWidth = '249px';
        // 🔥 CTA FIX: z-index must be HIGHER than detail modal (1000000) since button is position: fixed
        floatingPlayButton.style.zIndex = '1000001';
        floatingPlayButton.style.pointerEvents = 'auto';
        floatingPlayButton.style.cursor = 'pointer';
        floatingPlayButton.style.overflow = 'hidden';
        floatingPlayButton.style.display = 'block';
        // 🔥 CRITICAL: Don't set transform/opacity/visibility inline - CSS will handle via classes
        
        playButtonForAnimation = floatingPlayButton;

        // 🔥 CRITICAL: Add click handler IMMEDIATELY after button is created and added to DOM
        // Store board.id in closure to ensure it's captured correctly
        const boardIdForPlay = board.id;
        const boardNameForPlay = board.name;
        
        const handlePlayClick = async (e: Event) => {
          e.preventDefault();
          e.stopPropagation();

          if ((floatingPlayButton as any).__ccPlayStartInFlight === true) {
            logger.warn(`⚠️ Ignoring duplicate Play tap for board ${boardIdForPlay} - start already in flight`);
            return;
          }
          (floatingPlayButton as any).__ccPlayStartInFlight = true;
          floatingPlayButton.setAttribute('aria-busy', 'true');
          floatingPlayButton.style.pointerEvents = 'none';

          logger.info(`🎮 Play button clicked for board ${boardIdForPlay}`, { boardName: boardNameForPlay });
          delete (window as any).__ccSuppressJourneyShowForDirectDetailReturn;
          delete (window as any).__ccDirectDetailModalReturnActive;

          // Haptic feedback (match homepage slider CTA)
          try { (window as any).triggerHapticImpact?.('light'); } catch {}

          const shakeTarget = (
            detailModal.querySelector('.detail-content') ||
            detailModal.querySelector('.detail-swipeable-container') ||
            detailModal
          ) as HTMLElement | null;
          void playJourneyDetailPlayScreenShake(shakeTarget).catch(() => {});

          if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
            JOURNEY_CARD_IDLE_BOUNCE.stop();
            logger.info('✅ Journey card idle bounce stopped');
          }

          // 🔥 USER REQUEST: Exit animation on detail modal only (no Journey screen exit - already hidden)
          await this.exitDetailModalAndHideCollectibles(detailModal, 'play button', { hideJourney: true });

          // Mark that we came from detail modal (for return on exit)
          markJourneyGameOrigin({
            fromInterim: false,
            fromDetailModal: true,
            detailBoardId: boardIdForPlay,
          });
          logger.debug(`🎯 Marked regular Journey detail origin for board ${boardIdForPlay}`);

          // 🔥 USER REQUEST: Check if this board has a saved state (board-specific)
          // If YES → continue saved game (resume)
          // If NO → start fresh board (new game)
          const hasSavedState = hasResumableSavedStateForBoard(boardIdForPlay, { clearInvalid: true });
          logger.debug(`🎮 Board ${boardIdForPlay} saved state exists: ${hasSavedState}`);
          
          try {
            // 🔥 USER REQUEST: Show board transition screen before starting/continuing game
            // Import board transition screen module
            const { showBoardTransitionScreen } = await import('./board-transition-screen.js');
            logger.debug(`🎬 Showing board transition screen for board ${boardIdForPlay}`);
            
            await showBoardTransitionScreen({
              boardNumber: boardIdForPlay,
              onComplete: async () => {
                if (hasSavedState) {
                  // Case A: Board has save state → CONTINUE (resume where left off)
                  logger.info(`🎮 Resuming saved game for board ${boardIdForPlay}`);
                  
                  // Set flag to resume at correct board
                  (window as any).__ccStartAtLevel = boardIdForPlay;
                  (window as any).__ccTriggerHudDrop = true;
                  
                  // Call continueGameWithSavedState to resume
                  if (typeof (window as any).continueGameWithSavedState === 'function') {
                    await (window as any).continueGameWithSavedState();
                    logger.debug(`✅ continueGameWithSavedState call completed for board ${boardIdForPlay}`);
                  } else {
                    logger.error('❌ continueGameWithSavedState function not found');
                  }
                } else {
                  // Case B: Board has NO save state → START FRESH (new game)
                  logger.info(`🎮 Starting fresh game for board ${boardIdForPlay}`);
                  
                  // Call startNewRunFromJourney to create fresh board
                  if (typeof (window as any).startNewRunFromJourney === 'function') {
                    await (window as any).startNewRunFromJourney(boardIdForPlay);
                    logger.debug(`✅ startNewRunFromJourney call completed for board ${boardIdForPlay}`);
                  } else {
                    logger.error('❌ startNewRunFromJourney function not found');
                  }
                }
              }
            });
          } catch (error) {
            logger.error(`❌ Error starting/continuing game for board ${boardIdForPlay}:`, error);
          }
        };
        
        registerCta(floatingPlayButton, {
          variant: 'primary',
          initialState: 'hidden',
          onActivate: () => handlePlayClick(new Event('cta-activate')),
        });
        detailModal.addEventListener('cc:journey-detail-card-play', handlePlayClick as EventListener, { capture: false });
        (detailModal as any).__ccJourneyDetailCardPlayHandler = handlePlayClick as EventListener;
        
        logger.debug(`✅ Play button event listener attached for board ${boardIdForPlay}`);
      }
      
      // 🔥 ONLY CASE: Interim board shows "Continue" button, all others have NO old CTA
      if (isInterim) {
        if (continueBoardBtn) {
          // Remove existing listeners to prevent duplicates
          const newContinueBtn = continueBoardBtn.cloneNode(true) as HTMLElement;
          continueBoardBtn.parentNode?.replaceChild(newContinueBtn, continueBoardBtn);
          newContinueBtn.className = 'detail-continue-board-button cc-journey-detail-cta';
          
          // Set display on cloned element
          newContinueBtn.style.setProperty('display', 'block', 'important');
          
          const handleContinueInterim = async (source: string) => {
            logger.info(`🔄 Continue Stage ${source} for board ${board.id}`);
            try {
              if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
                JOURNEY_CARD_IDLE_BOUNCE.stop();
                logger.info('✅ Journey card idle bounce stopped');
              }
              
              const detailModalExitPromise = this.closeDetailModalWithExitAnimation(detailModal);
              const journeyExitPromise = animateJourneyViewportScreenExit(`detail-continue-board-${board.id}`);
              
              await Promise.all([detailModalExitPromise, journeyExitPromise]);
              logger.info('✅ All exit animations completed');
              
              // Hide collectibles after both exits
              const collectiblesManager = (window as any).collectiblesManager;
              if (collectiblesManager && typeof collectiblesManager.hideCollectibles === 'function') {
                (window as any).__ccJourneyExitMode = 'toGame';
                await collectiblesManager.hideCollectibles();
              }
              
              this.hideHomeAndJourneyScreens('interim continue exit', { setJourneyZIndex: true });
              
              const { journeyProgressionState } = await import('./journey-progression-state.js');
              journeyProgressionState.setLastOpenedBoardId(board.id);
              
              // 🔥 Mark from interim so clean board shows "Continue"
              this.setJourneyOriginFlags({ fromInterim: true });
              logger.info('🗺️ Marked as coming from interim (Continue button) - clean board will show Continue');
              
              if (typeof (window as any).continueGameWithSavedState === 'function') {
                (window as any).__ccTriggerHudDrop = true;
                await (window as any).continueGameWithSavedState();
              } else {
                logger.error('❌ continueGameWithSavedState function not found');
              }
            } catch (error) {
              logger.error(`❌ Failed to continue game from Journey board ${board.id}:`, error instanceof Error ? error.message : String(error));
            }
          };
          
          registerCta(newContinueBtn as HTMLButtonElement, {
            variant: 'primary',
            initialState: 'hidden',
            onActivate: () => handleContinueInterim('master CTA'),
          });
          playButtonForAnimation = newContinueBtn;
          
          logger.info(`✅ Continue Stage button listener attached for board ${board.id}`);
        }
      }
      // 🔥 NEW LOGIC: All other boards (including last unlocked) have NO CTA buttons
      // Both buttons remain hidden (already hidden above)

      // 🔥 CRITICAL: Set initial state FIRST (before showing modal) to prevent flash
      if (!gsap) {
        logger.warn('⚠️ GSAP not available for detail modal enter animation');
        // Show modal without animation
        detailModal.hidden = false;
        detailModal.removeAttribute('hidden');
        detailModal.setAttribute('aria-hidden', 'false');
        detailModal.style.display = 'flex';
        journeySpatialMotion.activateJourneyDetailModal(detailModal as HTMLElement, board.id);
        return;
      }

      // Find modal elements (header as group, then content elements) - BEFORE showing modal
      const detailHeader = detailModal.querySelector('.detail-header') as HTMLElement;
      const detailCloseBtn = detailModal.querySelector('#detail-close-btn') as HTMLElement;
      
      // 🔥 USER BUG FIX: Ensure X button is visible and clickable BEFORE any animations
	                if (detailCloseBtn) {
	                  detailCloseBtn.style.display = 'flex';
	                  detailCloseBtn.style.visibility = 'visible';
	                  detailCloseBtn.style.opacity = '1';
	                  detailCloseBtn.style.pointerEvents = 'auto';
        detailCloseBtn.style.zIndex = '2000000';
        detailCloseBtn.style.position = 'relative';
        detailCloseBtn.style.cursor = 'pointer';
        // Remove any classes that might hide it
        detailCloseBtn.classList.remove('animate-enter-initial', 'animate-enter', 'animate-exit', 'animate-reset');
        
        // 🔥 USER BUG FIX: Ensure img element inside X button is also visible
        const closeBtnImg = detailCloseBtn.querySelector('img') as HTMLImageElement;
        if (closeBtnImg) {
          closeBtnImg.style.display = 'block';
          closeBtnImg.style.visibility = 'visible';
          closeBtnImg.style.opacity = '1';
          closeBtnImg.style.width = '24px';
          closeBtnImg.style.height = '24px';
          // Ensure image src is set
          if (!closeBtnImg.src || closeBtnImg.src.includes('undefined') || closeBtnImg.src.includes('null')) {
            closeBtnImg.src = './assets/close-icon.png';
            logger.info('✅ X button image src set to ./assets/close-icon.png');
          }
          logger.info('✅ X button img element made visible');
        } else {
          logger.warn('⚠️ X button img element not found!');
        }
        
        logger.info('✅ X button made visible and clickable before modal animations');
      } else {
        logger.warn('⚠️ X button (#detail-close-btn) not found in detail modal!');
      }
      
      const detailTitle = detailModal.querySelector('#detail-title') as HTMLElement;
      const detailImage = detailModal.querySelector('#detail-card-image') as HTMLElement;
      const detailRarityBadgeContainer = detailModal.querySelector('.detail-rarity-badge-container') as HTMLElement;
      const detailDescription = detailModal.querySelector('#detail-card-description') as HTMLElement;
      const boardStatsContainer = (
        detailModal.querySelector('.board-stats-container') ||
        detailModal.querySelector('.detail-section-stats')
      ) as HTMLElement | null;
      // 🔥 CRITICAL: Use #board-detail-play-button (floating button created above) instead of #detail-play-board-btn
      const playButton = playButtonForAnimation;
      
      // 🔥 DEBUG: Log button state
      if (playButton) {
        logger.info(`✅ Play button found in DOM: ${playButton.id}, display: ${playButton.style.display}, visibility: ${playButton.style.visibility}`);
      } else {
        logger.warn(`⚠️ Play button NOT found in DOM! Looking for #board-detail-play-button`);
        // Try to find it again
        const playButtonRetry = document.getElementById('board-detail-play-button');
        if (playButtonRetry) {
          logger.info(`✅ Play button found via getElementById: ${playButtonRetry.id}`);
        } else {
          logger.error(`❌ Play button NOT found via getElementById either!`);
        }
      }

      // 🔥 USER REQUEST: Add animations for stats section, icons, and description text
      // Find stats section (container) - stat items themselves are animated separately later
      const detailStatsSection = detailModal.querySelector('.detail-section-stats') as HTMLElement;
      const detailStatsList = detailModal.querySelector('.detail-stats-list') as HTMLElement | null;
      const isIPadDevice = (() => {
        const ua = navigator.userAgent || '';
        const isIPadUA = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
        const vw = window.innerWidth || 0;
        return isIPadUA || (vw >= 769 && vw <= 1366);
      })();
      const statElementsForInit = detailStatsList ? Array.from(detailStatsList.querySelectorAll('.detail-stat-item, .detail-stat-divider')) as HTMLElement[] : [];
      // Pre-hide stat elements to prevent first-frame flash
      // 🔥 CRITICAL: Reset ALL stat elements to clean state (same pattern as card image)
      statElementsForInit.forEach((el) => {
        // 🔥 BUG FIX: Kill any existing GSAP animations first to prevent conflicts (same as card)
        gsap.killTweensOf(el);
        el.classList.remove('animate-enter-initial', 'animate-enter', 'animate-exit', 'animate-reset');
        
        // Store original display
        const defaultDisplay = el.classList.contains('detail-stat-divider') ? 'block' : 'flex';
        el.dataset.statOriginalDisplay = defaultDisplay;
        
        // 🔥 CRITICAL: Set display and transition, but let GSAP control opacity/visibility/transform (same as card)
        // 🔥 SCREEN ARTIFACTS FIX: Force display with !important to override previous exit's display: none !important
        el.style.setProperty('display', defaultDisplay, 'important');
        el.style.transition = 'none';
        // 🔥 SCREEN ARTIFACTS FIX: Set opacity and visibility IMMEDIATELY via inline CSS (not GSAP)
        // This prevents 1-frame flash between display:block and GSAP initialization
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
        el.style.removeProperty('transform');
        el.style.transformOrigin = 'center center';
        el.style.willChange = 'transform, opacity';
        
        // 🔥 CRITICAL: Reset children (icons, values, labels) - ensure they're ready and visible
        const icon = el.querySelector('.detail-stat-icon, .stat-icon');
        const value = el.querySelector('.detail-stat-value, .stat-value');
        const label = el.querySelector('.detail-stat-label, .stat-label');
        const content = el.querySelector('.detail-stat-content, .stat-content');
        [icon, value, label, content].forEach((child) => {
          if (child) {
            gsap.killTweensOf(child);
            // 🔥 CRITICAL: Clear all inline styles from children so they're visible when parent animates
            (child as HTMLElement).style.removeProperty('opacity');
            (child as HTMLElement).style.removeProperty('visibility');
            (child as HTMLElement).style.removeProperty('transform');
            (child as HTMLElement).style.removeProperty('display');
          }
        });
        
        // 🔥 CRITICAL: Use GSAP to set initial state - this ensures proper animation (same as card)
        gsap.set(el, {
          scale: 0,
          opacity: 0,
          visibility: 'hidden',
          force3D: true,
          immediateRender: true
        });
      });
      // Reset containers synchronously. Delayed rAF resets can fire after GSAP
      // prepares stat children and make repeat enters look skipped or jerky.
      if (boardStatsContainer) {
        gsap.killTweensOf(boardStatsContainer);
        boardStatsContainer.style.transform = 'none';
        boardStatsContainer.style.opacity = '1';
        boardStatsContainer.style.visibility = 'visible';
        boardStatsContainer.style.display = 'flex';
        boardStatsContainer.style.willChange = 'auto';
      }
      if (detailStatsSection) {
        gsap.killTweensOf(detailStatsSection);
        detailStatsSection.style.transform = 'none';
        detailStatsSection.style.opacity = '1';
        detailStatsSection.style.visibility = 'visible';
        detailStatsSection.style.display = 'flex';
        detailStatsSection.style.willChange = 'auto';
      }
      if (detailStatsList) {
        gsap.killTweensOf(detailStatsList);
        detailStatsList.dataset.statOriginalDisplay = 'flex';
        detailStatsList.style.transform = 'none';
        detailStatsList.style.opacity = '1';
        detailStatsList.style.visibility = 'visible';
        detailStatsList.style.display = 'flex';
        detailStatsList.style.willChange = 'auto';
      }
      
      // Content elements array (excluding header and card image - card is already animated separately)
      // 🔥 OPTIMIZATION: Exclude stat icons/items here; they get their own staggered GSAP later
      const contentElements = [
        detailRarityBadgeContainer,
        ...(isIPadDevice ? [] : detailDescription ? [detailDescription] : []),
        boardStatsContainer,
        playButton
      ].filter(el => el !== null) as HTMLElement[];
      
      // 🔥 CRITICAL: Set initial state for description (will be animated, not always visible) — non-iPad only
      if (detailDescription && !isIPadDevice) {
        gsap.set(detailDescription, {
          scale: 0,
          opacity: 0,
          visibility: 'hidden',
          force3D: true,
          immediateRender: true
        });
        // Keep text styling
        detailDescription.style.cssText = `
          display: block !important;
          color: #AD8775 !important;
          font-size: 20px !important;
          text-align: center !important;
          white-space: pre-line !important;
          width: 220px !important;
          max-width: 220px !important;
          margin-left: 80px !important;
          padding: 0 !important;
          position: relative !important;
          z-index: 10 !important;
          line-height: 1.4 !important;
        `;
      }

      // 🔥 iOS FIX: Header enter uses pure CSS animation (no GSAP) so compositor owns it and no frame skip at end
      if (detailHeader) {
        gsap.killTweensOf(detailHeader);
        detailHeader.style.removeProperty('transform');
        detailHeader.style.removeProperty('opacity');
        detailHeader.style.removeProperty('visibility');
        detailHeader.classList.remove('detail-header-enter', 'detail-header-enter-done');
        detailHeader.classList.add('detail-header-before-enter');
      }

      // Set initial state for content elements (NOT card image - card is always visible)
      // 🔥 BUG FIX: Separate PLAY button (CSS classes) from other elements (GSAP)
      const playButtonForInit = contentElements.find(el => el && el.id === 'board-detail-play-button');
      const otherElements = contentElements.filter(el => el && el.id !== 'board-detail-play-button');
      
      // PLAY button: use CSS classes (same as homepage CTA)
      if (playButtonForInit) {
        playButtonForInit.style.visibility = 'hidden';
        playButtonForInit.style.pointerEvents = 'none';
      }
      
      // Other elements: use GSAP
      // 🔥 CRITICAL: Exclude the whole stats container/section from generic hide.
      // Stat items animate individually; hiding the parent with scale(0) makes the child enter
      // appear delayed/slow or invisible until a later cleanup restores the parent.
      const elementsToHide = otherElements.filter(el => el !== detailStatsSection && el !== boardStatsContainer);
      
      elementsToHide.forEach(el => {
        if (el) {
          gsap.killTweensOf(el); // 🔥 BUG FIX: Kill existing animations to prevent conflicts
          el.classList.remove('animate-enter-initial', 'animate-enter', 'animate-exit', 'animate-reset');
          el.style.transform = 'none';
          el.style.transition = 'none'; // 🔥 BUG FIX: Remove CSS transitions to prevent fade conflicts
        }
      });
      
      // 🔥 CRITICAL: Keep detailStatsSection visible (it contains the stats list)
      if (detailStatsSection) {
        detailStatsSection.style.display = 'flex';
        detailStatsSection.style.visibility = 'visible';
        detailStatsSection.style.opacity = '1';
      }
      
      gsap.set(elementsToHide, {
        scale: 0,
        opacity: 0,
        visibility: 'hidden',
        force3D: true,
        immediateRender: true
      });
      
      // 🔥 USER REQUEST: Set initial state for card image (will be animated)
      if (detailImage) {
        // 🔥 BUG FIX: Kill any existing GSAP animations first to prevent conflicts
        gsap.killTweensOf(detailImage);
        detailImage.classList.remove('animate-enter-initial', 'animate-enter', 'animate-exit', 'animate-reset');
        
        // 🔥 CRITICAL: Set display and transition, but let GSAP control opacity/visibility/transform
        detailImage.style.display = 'flex';
        detailImage.style.transition = 'none';
        // 🔥 CRITICAL: Remove any inline styles that might interfere with GSAP
        detailImage.style.removeProperty('opacity');
        detailImage.style.removeProperty('visibility');
        detailImage.style.removeProperty('transform');
        
        const img = detailImage.querySelector('img');
        if (img) {
          img.style.display = 'block';
          // 🔥 CRITICAL: Don't set opacity/visibility on img - GSAP controls parent
          img.style.removeProperty('opacity');
          img.style.removeProperty('visibility');
        }
        
        // 🔥 CRITICAL: Use GSAP to set initial state - this ensures proper animation
        gsap.set(detailImage, {
          scale: 0,
          opacity: 0,
          visibility: 'hidden',
          force3D: true,
          immediateRender: true
        });
      }

      // NOW show modal (after initial state is set)
      detailModal.hidden = false;
      detailModal.removeAttribute('hidden');
      detailModal.setAttribute('aria-hidden', 'false');
      detailModal.style.display = 'flex';
      // 🔥 CRITICAL: Keep modal invisible until animations start
      detailModal.style.opacity = '0';
      detailModal.style.visibility = 'hidden';
      // Also hide card container immediately to prevent first-frame flash
      if (detailImage) {
        detailImage.style.opacity = '0';
        detailImage.style.visibility = 'hidden';
        detailImage.style.transform = 'scale(0)';
        detailImage.style.transformOrigin = 'center center';
        detailImage.style.willChange = 'transform, opacity';
      }

      // Now make modal visible and start animations. This must be awaited because
      // direct game-return callers hide the PIXI app immediately after openBoardDetails().
      await new Promise<void>((resolveDetailModalEnterStarted) => {
        requestAnimationFrame(() => {
          try {
          // 🔥 SCREEN ARTIFACTS FIX: Double-check divideri are hidden BEFORE making modal visible
          const dividersBeforeVisible = detailModal.querySelectorAll('.detail-stat-divider') as NodeListOf<HTMLElement>;
          dividersBeforeVisible.forEach((div) => {
            div.style.opacity = '0';
            div.style.visibility = 'hidden';
          });
          
          // Make modal visible
          detailModal.style.opacity = '1';
          detailModal.style.visibility = 'visible';

          // STEP 1: Header FIRST – pure CSS animation (iOS: compositor-owned, no frame skip at end)
          if (detailHeader) {
            if (detailCloseBtn) {
              detailCloseBtn.style.display = 'flex';
              detailCloseBtn.style.visibility = 'visible';
              detailCloseBtn.style.opacity = '1';
              detailCloseBtn.style.pointerEvents = 'auto';
              const closeBtnImg = detailCloseBtn.querySelector('img') as HTMLImageElement;
              if (closeBtnImg) {
                closeBtnImg.style.display = 'block';
                closeBtnImg.style.visibility = 'visible';
                closeBtnImg.style.opacity = '1';
                closeBtnImg.style.width = '24px';
                closeBtnImg.style.height = '24px';
                if (!closeBtnImg.src || closeBtnImg.src.includes('undefined') || closeBtnImg.src.includes('null')) {
                  closeBtnImg.src = './assets/close-icon.png';
                }
              }
              logger.info('✅ X button made visible before header animation');
            }
            detailHeader.classList.remove('detail-header-before-enter');
            detailHeader.style.visibility = 'visible';
            detailHeader.classList.add('detail-header-enter');
            const onHeaderEnterEnd = () => {
              detailHeader.removeEventListener('animationend', onHeaderEnterEnd);
              delete (detailHeader as any).__detailHeaderEnterEnd;
              detailHeader.classList.remove('detail-header-enter');
              detailHeader.classList.add('detail-header-enter-done');
              requestAnimationFrame(() => {
                if (detailCloseBtn) {
                  detailCloseBtn.style.display = 'flex';
                  detailCloseBtn.style.visibility = 'visible';
                  detailCloseBtn.style.opacity = '1';
                  detailCloseBtn.style.pointerEvents = 'auto';
                  const closeBtnImg = detailCloseBtn.querySelector('img') as HTMLImageElement;
                  if (closeBtnImg) {
                    closeBtnImg.style.display = 'block';
                    closeBtnImg.style.visibility = 'visible';
                    closeBtnImg.style.opacity = '1';
                    if (!closeBtnImg.src || closeBtnImg.src.includes('undefined') || closeBtnImg.src.includes('null')) {
                      closeBtnImg.src = './assets/close-icon.png';
	                    }
	                  }
	                  detailCloseBtn.classList.remove('detail-close-enter-cartoon-bounce');
	                  void detailCloseBtn.offsetWidth;
	                  detailCloseBtn.classList.add('detail-close-enter-cartoon-bounce');
	                  this.trackTimeout(() => {
	                    detailCloseBtn.classList.remove('detail-close-enter-cartoon-bounce');
	                  }, 460);
	                  logger.info('✅ X button verified visible after header animation completes');
	                }
              });
            };
            (detailHeader as any).__detailHeaderEnterEnd = onHeaderEnterEnd;
            detailHeader.addEventListener('animationend', onHeaderEnterEnd);
            logger.info('📊 Step 1: Detail header pop-in (CSS animation) - FIRST');
          }

          // STEP 2: PLAY button SECOND (0ms delay, immediately after header, BEFORE card and content)
          // 🔥 USER REQUEST: PLAY button appears BEFORE container with card and stats
          const playButtonForEnter = contentElements.find(el => el && el.id === 'board-detail-play-button');
          const otherContentElements = contentElements.filter(el => el && el.id !== 'board-detail-play-button');
          
          if (playButtonForEnter) {
            void getRegisteredCta(playButtonForEnter as HTMLButtonElement)?.enter();
          }

          // STEP 3: Card image animation (after PLAY button, before other content elements)
          if (detailImage) {
            // 🔥 CRITICAL: Ensure card is hidden before animation starts and no stale tweens exist
            gsap.killTweensOf(detailImage);
            const detailMotionEl = detailImage.querySelector('.detail-image-motion') as HTMLElement | null;
            if (detailMotionEl) {
              gsap.killTweensOf(detailMotionEl);
              detailMotionEl.style.animation = 'none';
              detailMotionEl.style.animationPlayState = 'paused';
              detailMotionEl.style.removeProperty('transform');
            }
            const detailImgEl = detailImage.querySelector('img') as HTMLElement | null;
            if (detailImgEl) {
              gsap.killTweensOf(detailImgEl);
            }
            detailImage.style.opacity = '0';
            detailImage.style.visibility = 'hidden';
            detailImage.style.transform = 'scale(0)';
            detailImage.style.transformOrigin = 'center center';
            detailImage.style.transition = 'none';
            detailImage.style.willChange = 'transform, opacity';
            if (detailImgEl) {
              detailImgEl.style.transition = 'none';
              detailImgEl.style.opacity = '1';
              detailImgEl.style.visibility = 'visible';
              detailImgEl.style.willChange = 'auto';
            }
            
            const playDetailImageEnter = () => {
              if (!detailModal || detailModal.hidden || detailModal.style.display === 'none') return;

              // Hard-set start state then pop to visible (avoids fade-only on first frame)
              gsap.fromTo(
                detailImage,
                {
                  scale: BOARD_AREA_MODAL_ENTER_SCALE,
                  opacity: 0,
                  visibility: 'hidden',
                  force3D: true,
                  transformOrigin: 'center center'
                },
                {
                  scale: 1,
                  opacity: 1,
                  visibility: 'visible',
                  duration: BOARD_AREA_MODAL_ENTER_DURATION,
                  ease: BOARD_AREA_MODAL_ENTER_EASE,
                  delay: BOARD_AREA_MODAL_ENTER_BASE_DELAY,
                  force3D: true,
                  overwrite: true,
                  onStart: () => {
                    detailImage.style.visibility = 'visible';
                    if (detailImgEl) {
                      detailImgEl.style.visibility = 'visible';
                      detailImgEl.style.opacity = '1';
                    }
                  },
                  onComplete: () => {
                    // 🔥 MEMORY LEAK FIX: Only start idle animation if modal is still active and visible
                    if (!detailModal || detailModal.hidden || detailModal.style.display === 'none') {
                      logger.warn('⚠️ Modal is closed - skipping idle animation start');
                      return;
                    }
                    
                    // 🔥 CRITICAL: Ensure card remains visible after animation
                    detailImage.style.visibility = 'visible';
                    detailImage.style.opacity = '1';
                    if (detailImgEl) {
                      detailImgEl.style.visibility = 'visible';
                      detailImgEl.style.opacity = '1';
                    }
                    
                    // 🔥 USER REQUEST: Restore idle animation on detail card image
                    // Only if modal is still active (prevents memory leak if modal closed during animation)
                    if (detailModal && !detailModal.hidden && detailModal.style.display !== 'none') {
                      if (detailMotionEl) {
                        detailMotionEl.style.animation = 'detailImageIdle 3s ease-in-out infinite';
                        detailMotionEl.style.animationPlayState = 'running';
                      }
                      logger.info('🃏 Card image idle animation started - modal is active');
                    } else {
                      logger.warn('⚠️ Modal is not active - idle animation not started');
                    }
                  }
                }
              );
              logger.info('🃏 Step 3: Card image pop-in');
            };

            const detailImageReady = (detailImage as any).__detailImageReady;
            if (detailImageReady && typeof detailImageReady.finally === 'function') {
              detailImageReady.finally(playDetailImageEnter);
            } else {
              playDetailImageEnter();
            }
          }

          // STEP 4: Other content elements and stats enter as one coordinated content beat.
          const baseDelay = 0.2; // Start after card image begins animating
          const regularStagger = 0.08; // Stagger for non-stat elements
          
          // 🔥 OPTIMIZATION: Find stat-items for individual animation
          // 🔥 CRITICAL: Use correct class names - HTML uses .detail-stat-item, not .stat-item
          const detailStatsListFromContainer = boardStatsContainer ? boardStatsContainer.querySelector('.detail-stats-list') as HTMLElement : null;
          const detailStatsListResolved = detailStatsList || detailStatsListFromContainer;
          
          // 🔥 DEBUG: Log found elements
          if (!detailStatsListResolved) {
            logger.warn(`⚠️ detail-stats-list NOT found in boardStatsContainer!`);
          } else {
            logger.info(`✅ detail-stats-list found with ${detailStatsListResolved.children.length} children`);
          }
          
          const statItems = detailStatsListResolved ? Array.from(detailStatsListResolved.querySelectorAll('.detail-stat-item')) as HTMLElement[] : [];
          const statDividers = detailStatsListResolved ? Array.from(detailStatsListResolved.querySelectorAll('.detail-stat-divider')) as HTMLElement[] : [];
          
          logger.info(`🔍 Found ${statItems.length} stat-items and ${statDividers.length} dividers for animation`);
          
          // 🔥 RESET: Clear any CSS animation classes on stats container to prevent group fade
          if (boardStatsContainer) {
            gsap.killTweensOf(boardStatsContainer);
            boardStatsContainer.classList.remove('animate-enter', 'animate-exit', 'animate-reset', 'animate-enter-initial');
            boardStatsContainer.style.transition = 'none';
            boardStatsContainer.style.opacity = '1';
            boardStatsContainer.style.visibility = 'visible';
            boardStatsContainer.style.transform = 'none';
            boardStatsContainer.style.willChange = 'auto';
          }
          
          if (detailStatsSection) {
            gsap.killTweensOf(detailStatsSection);
            detailStatsSection.classList.remove('animate-enter', 'animate-exit', 'animate-reset', 'animate-enter-initial');
            detailStatsSection.style.transition = 'none';
            detailStatsSection.style.opacity = '1';
            detailStatsSection.style.visibility = 'visible';
            detailStatsSection.style.transform = 'none';
            detailStatsSection.style.willChange = 'auto';
          }
          
          // 🔥 CRITICAL: Ensure detailStatsSection is visible (it contains the stats list)
          if (detailStatsSection) {
            detailStatsSection.style.display = 'flex';
            detailStatsSection.style.visibility = 'visible';
            detailStatsSection.style.opacity = '1';
          }
          
          // 🔥 CRITICAL: Ensure detailStatsList is visible
          if (detailStatsListResolved) {
            detailStatsListResolved.style.display = 'flex';
            detailStatsListResolved.style.visibility = 'visible';
            detailStatsListResolved.style.opacity = '1';
            detailStatsListResolved.style.transform = 'none';
            detailStatsListResolved.style.willChange = 'auto';
          }
          
          // 🔥 iPad FIX: Force tight horizontal stats layout (override any CSS/inlines)
          const isIPad = isIPadDevice;
          if (isIPad && detailStatsListResolved) {
            detailStatsListResolved.style.flexDirection = 'row';
            detailStatsListResolved.style.gap = 'calc(8px + 4%)';
            detailStatsListResolved.style.width = 'fit-content';
            detailStatsListResolved.style.maxWidth = '100%';
            detailStatsListResolved.style.minWidth = '0';
            detailStatsListResolved.style.justifyContent = 'center';
            detailStatsListResolved.style.marginLeft = 'auto';
            detailStatsListResolved.style.marginRight = 'auto';
            detailStatsListResolved.style.overflow = 'visible';
            detailStatsListResolved.style.padding = '0';
            detailStatsListResolved.style.alignSelf = 'center';
            const statItemsIPad = Array.from(detailStatsListResolved.querySelectorAll('.detail-stat-item')) as HTMLElement[];
            statItemsIPad.forEach((item) => {
              item.style.flex = '0 0 auto';
              item.style.width = 'auto';
              item.style.minWidth = '0';
              item.style.maxWidth = '150px';
              item.style.padding = '0';
              item.style.margin = '0';
            });
            const statDividersIPad = Array.from(detailStatsListResolved.querySelectorAll('.detail-stat-divider')) as HTMLElement[];
            statDividersIPad.forEach((divider) => {
              divider.style.display = 'block';
            });
          }
          
          const nonStatElements = otherContentElements.filter(el => {
            if (!el) return false;
            // Exclude boardStatsContainer and detailStatsSection from regular animation (we'll animate stat-items individually)
            return el !== boardStatsContainer && el !== detailStatsSection;
          });
          
          // Animate non-stat elements first
          let currentIndex = 0;
          nonStatElements.forEach((element) => {
            if (!element) return;
            
            const delay = baseDelay + (currentIndex * regularStagger);
            currentIndex++;
            
            // 🔥 OPTIMIZATION: Kill any existing animations first
            gsap.killTweensOf(element);
            
            // 🔥 OPTIMIZATION: Set initial state BEFORE animation to prevent "trzanje"
            element.style.transition = 'none';
            element.style.opacity = '0';
            element.style.visibility = 'hidden';
            element.style.transform = 'scale(0)';
            element.style.transformOrigin = 'center center';
            element.style.willChange = 'transform, opacity';
            
            // 🔥 OPTIMIZATION: Use fromTo for smoother animation (avoids initial flash)
            gsap.fromTo(
              element,
              {
                scale: 0,
                opacity: 0,
                visibility: 'hidden',
                force3D: true,
                transformOrigin: 'center center',
                immediateRender: true
              },
              {
                scale: 1,
                opacity: 1,
                visibility: 'visible',
                duration: 0.5,
                ease: 'back.out(1.7)',
                delay: delay,
                force3D: true,
                immediateRender: false,
                overwrite: true,
                onStart: () => {
                  // Ensure element is visible when animation starts
                  element.style.visibility = 'visible';
                },
                onComplete: () => {
                  // Ensure element remains visible after animation
                  element.style.visibility = 'visible';
                  element.style.opacity = '1';
                  element.style.willChange = 'auto'; // Remove will-change after animation
                }
              }
            );
          });
          
          // 🔥 USER REQUEST: Animate stat-items and dividers one by one individually
          // Each stat-item contains: icon, value (number), and label (text) - animate as whole
          // 🔥 CRITICAL: Get all children of detail-stats-list in order (stat-items and dividers alternate)
          const statElements: HTMLElement[] = [];
          if (detailStatsListResolved) {
            // Get all direct children in order (they alternate: stat-item, divider, stat-item, divider, stat-item)
            const allChildren = Array.from(detailStatsListResolved.children) as HTMLElement[];
            allChildren.forEach((child) => {
              if (child.classList.contains('detail-stat-item') || child.classList.contains('detail-stat-divider')) {
                statElements.push(child);
              }
            });
          }
          
          // 🔥 CRITICAL: If no stat elements found, try alternative selector
          if (statElements.length === 0 && boardStatsContainer) {
            logger.warn(`⚠️ No stat elements found with .detail-stat-item/.detail-stat-divider, trying .stat-item`);
            const fallbackItems = Array.from(boardStatsContainer.querySelectorAll('.stat-item')) as HTMLElement[];
            statElements.push(...fallbackItems);
            logger.info(`🔍 Found ${fallbackItems.length} fallback stat-items`);
          }
          
          logger.info(`🔍 Created statElements array with ${statElements.length} elements (stat-items + dividers)`);
          
          // One shared contract owns both directions: this is the accepted five-beat
          // CSS exit played backwards with the same DOM order and 50ms spacing.
          const statEnterDelays = createDetailModalStatsEnterDelays(statElements.length);
          
          const restoreStatsVisibility = () => {
            if (!detailModal || detailModal.hidden || detailModal.style.display === 'none' || (detailModal as any).__detailModalExiting === true) {
              return;
            }
            if (boardStatsContainer) {
              boardStatsContainer.style.opacity = '1';
              boardStatsContainer.style.visibility = 'visible';
              boardStatsContainer.style.display = 'flex';
              boardStatsContainer.style.transform = 'none';
              boardStatsContainer.style.willChange = 'auto';
            }
            if (detailStatsSection) {
              detailStatsSection.style.opacity = '1';
              detailStatsSection.style.visibility = 'visible';
              detailStatsSection.style.display = 'flex';
              detailStatsSection.style.transform = 'none';
              detailStatsSection.style.willChange = 'auto';
            }
            if (detailStatsListResolved) {
              const defaultDisplay = detailStatsListResolved.classList.contains('detail-stat-divider') ? 'block' : 'flex';
              detailStatsListResolved.style.display = detailStatsListResolved.dataset.statOriginalDisplay || defaultDisplay || 'flex';
              detailStatsListResolved.style.opacity = '1';
              detailStatsListResolved.style.visibility = 'visible';
              detailStatsListResolved.style.transform = 'none';
              detailStatsListResolved.style.willChange = 'auto';
            }
            statElements.forEach((el) => {
              const defaultDisplay = el.classList.contains('detail-stat-divider') ? 'block' : 'flex';
              el.classList.remove('detail-stat-entering', 'detail-stat-exiting');
              el.style.removeProperty('animation');
              el.style.removeProperty('animation-delay');
              el.style.setProperty('display', el.dataset.statOriginalDisplay || defaultDisplay, 'important');
              el.style.opacity = '1';
              el.style.visibility = 'visible';
              el.style.transform = 'none';
              el.style.willChange = 'auto';
              const children = el.querySelectorAll('.detail-stat-icon, .stat-icon, .detail-stat-value, .stat-value, .detail-stat-label, .stat-label, .detail-stat-content, .stat-content') as NodeListOf<HTMLElement>;
              children.forEach((child) => {
                child.style.visibility = 'visible';
                child.style.opacity = '1';
                child.style.removeProperty('transform');
                child.style.willChange = 'auto';
              });
            });
          };
          
          if (statElements.length > 0) {
            cleanupDetailStatsEnterAnimation(detailModal as HTMLElement);
            if (isIPad) {
              // iPad: single centered row (aligned with card). Avoid 5-col grid — it reads left-heavy.
              if (detailStatsSection) {
                detailStatsSection.style.width = '100%';
                detailStatsSection.style.maxWidth = '100%';
                detailStatsSection.style.display = 'flex';
                detailStatsSection.style.flexDirection = 'column';
                detailStatsSection.style.alignItems = 'center';
                detailStatsSection.style.justifyContent = 'center';
              }
              if (detailStatsListResolved) {
                detailStatsListResolved.style.display = 'flex';
                detailStatsListResolved.style.flexDirection = 'row';
                detailStatsListResolved.style.flexWrap = 'nowrap';
                detailStatsListResolved.style.gap = 'calc(8px + 4%)';
                detailStatsListResolved.style.justifyContent = 'center';
                detailStatsListResolved.style.alignItems = 'center';
                detailStatsListResolved.style.alignSelf = 'center';
                detailStatsListResolved.style.width = 'fit-content';
                detailStatsListResolved.style.maxWidth = '100%';
                detailStatsListResolved.style.minWidth = '0';
                detailStatsListResolved.style.marginLeft = 'auto';
                detailStatsListResolved.style.marginRight = 'auto';
                detailStatsListResolved.style.padding = '0';
                detailStatsListResolved.style.gridTemplateColumns = '';
                detailStatsListResolved.style.columnGap = '';
                detailStatsListResolved.style.rowGap = '';
                detailStatsListResolved.style.justifyItems = '';
              }
              const children = detailStatsListResolved ? Array.from(detailStatsListResolved.children) as HTMLElement[] : statElements;
              children.forEach((element) => {
                if (!element) return;
                const isDivider = element.classList.contains('detail-stat-divider');
                const elementDefaultDisplay = isDivider ? 'block' : 'flex';
                element.style.setProperty('display', elementDefaultDisplay, 'important');
                element.style.willChange = 'transform, opacity';
                if (isDivider) {
                  element.style.width = '2px';
                  element.style.height = '64px';
                  element.style.marginLeft = '0';
                  element.style.marginRight = '0';
                  element.style.background = '#ECE2D9';
                } else {
                  element.style.width = 'auto';
                  element.style.maxWidth = '170px';
                  element.style.justifyContent = 'center';
                  element.style.alignItems = 'center';
                  element.style.paddingLeft = '0';
                  element.style.paddingRight = '0';
                  element.style.margin = '0';
                }
              });
            }

            statElements.forEach((element, elementIndex) => {
              if (!element) return;
              
              const delay = statEnterDelays[elementIndex] ?? 0;
              const isDivider = element.classList.contains('detail-stat-divider');

              gsap.killTweensOf(element);
              const elementIcon = element.querySelector('.detail-stat-icon, .stat-icon') as HTMLElement | null;
              const elementValue = element.querySelector('.detail-stat-value, .stat-value') as HTMLElement | null;
              const elementLabel = element.querySelector('.detail-stat-label, .stat-label') as HTMLElement | null;
              const elementContent = element.querySelector('.detail-stat-content, .stat-content') as HTMLElement | null;
              
              if (elementIcon) gsap.killTweensOf(elementIcon);
              if (elementValue) gsap.killTweensOf(elementValue);
              if (elementLabel) gsap.killTweensOf(elementLabel);
              if (elementContent) gsap.killTweensOf(elementContent);
              
              element.classList.remove('detail-stat-entering', 'detail-stat-exiting');
              element.style.removeProperty('animation');
              element.style.removeProperty('animation-delay');
              element.style.opacity = '0';
              element.style.visibility = 'hidden';
              element.style.transform = 'scale(0)';
              element.style.transformOrigin = 'center center';
              element.style.transition = 'none';
              element.style.willChange = 'transform, opacity';
              element.style.animationDelay = `${delay}s`;

              const elementDefaultDisplay = isDivider ? 'block' : 'flex';
              element.style.setProperty('display', elementDefaultDisplay, 'important');
              
              // Children stay visible; the parent stat item owns opacity/scale for enter.
              if (elementIcon) {
                elementIcon.style.transition = 'none';
                elementIcon.style.opacity = '1';
                elementIcon.style.visibility = 'visible';
                elementIcon.style.willChange = 'auto';
              }
              if (elementValue) {
                elementValue.style.transition = 'none';
                elementValue.style.opacity = '1';
                elementValue.style.visibility = 'visible';
              }
              if (elementLabel) {
                elementLabel.style.transition = 'none';
                elementLabel.style.opacity = '1';
                elementLabel.style.visibility = 'visible';
              }
              if (elementContent) {
                elementContent.style.transition = 'none';
                elementContent.style.opacity = '1';
                elementContent.style.visibility = 'visible';
              }

            });

            // Prime every item first, then start the CSS cascade in one layout flush.
            void detailStatsListResolved?.offsetHeight;
            if ((detailModal as any).__detailModalExiting !== true) {
              statElements.forEach((element) => element.classList.add('detail-stat-entering'));
              const restoreDelayMs = Math.ceil(
                getDetailModalStatsEnterTotalDuration(statElements.length) * 1000,
              ) + 34;
              (detailModal as any).__detailStatsRestoreTimer = window.setTimeout(() => {
                (detailModal as any).__detailStatsRestoreTimer = null;
                restoreStatsVisibility();
              }, restoreDelayMs);
            }

            logger.info(`📊 Detail stats enter is the exact CSS reverse of exit (${statElements.length} elements)`);
          } else {
            logger.error(`❌ No stat elements found to animate!`);
            // Fallback: show stats container so content is visible even without animation
            if (boardStatsContainer) {
              boardStatsContainer.style.opacity = '1';
              boardStatsContainer.style.visibility = 'visible';
            }
            if (detailStatsSection) {
              detailStatsSection.style.opacity = '1';
              detailStatsSection.style.visibility = 'visible';
            }
            if (detailStatsListResolved) {
              detailStatsListResolved.style.opacity = '1';
              detailStatsListResolved.style.visibility = 'visible';
              const defaultDisplay = detailStatsListResolved.classList.contains('detail-stat-divider') ? 'block' : 'flex';
              detailStatsListResolved.style.display = detailStatsListResolved.dataset.statOriginalDisplay || defaultDisplay || 'flex';
            }
            // Also ensure any stat elements we pre-hid are restored
            restoreStatsVisibility();
          }
          } finally {
            resolveDetailModalEnterStarted();
          }
        }); // End detail modal enter start frame
      });

      journeySpatialMotion.activateJourneyDetailModal(detailModal as HTMLElement, board.id);

      // 🔥 CRITICAL: Replace collectibles-manager event listener with journey boards exit animation
      // This ensures X button uses GSAP exit animation (header as group) instead of CSS animation (child elements separately)
      if (detailCloseBtn) {
        // Remove any existing event listeners by cloning the button
        const newCloseBtn = detailCloseBtn.cloneNode(true) as HTMLElement;
        detailCloseBtn.parentNode?.replaceChild(newCloseBtn, detailCloseBtn);
        
        // 🔥 USER BUG FIX: Ensure X button is visible and clickable after cloning
        newCloseBtn.style.display = 'flex';
        newCloseBtn.style.visibility = 'visible';
        newCloseBtn.style.opacity = '1';
        newCloseBtn.style.pointerEvents = 'auto';
        newCloseBtn.style.zIndex = '2000000';
        newCloseBtn.style.position = 'relative';
        newCloseBtn.style.cursor = 'pointer';
        // Remove any classes that might hide it
        newCloseBtn.classList.remove('animate-enter-initial', 'animate-enter', 'animate-exit', 'animate-reset');
        
        // 🔥 USER BUG FIX: Ensure img element inside X button is also visible after cloning
        const newCloseBtnImg = newCloseBtn.querySelector('img') as HTMLImageElement;
        if (newCloseBtnImg) {
          newCloseBtnImg.style.display = 'block';
          newCloseBtnImg.style.visibility = 'visible';
          newCloseBtnImg.style.opacity = '1';
          newCloseBtnImg.style.width = '24px';
          newCloseBtnImg.style.height = '24px';
          // Ensure image src is set
          if (!newCloseBtnImg.src || newCloseBtnImg.src.includes('undefined') || newCloseBtnImg.src.includes('null')) {
            newCloseBtnImg.src = './assets/close-icon.png';
            logger.info('✅ X button image src set to ./assets/close-icon.png after cloning');
          }
          logger.info('✅ X button img element made visible after cloning');
        } else {
          logger.warn('⚠️ X button img element not found after cloning!');
        }
        
        logger.info('✅ X button made visible and clickable after cloning');

        const cleanupDetailCloseHandlers = () => {
          const previousCloseDelegates = (detailModal as any).__ccJourneyDetailCloseDelegatedHandlers as {
            closeButton?: HTMLElement;
            handleClosePointerDown?: EventListener;
            handleClosePointerUp?: EventListener;
            handleCloseClick?: EventListener;
            handleCloseTouchEnd?: EventListener;
            modalPointerUp?: EventListener;
            modalClick?: EventListener;
            modalTouchEnd?: EventListener;
            documentPointerUp?: EventListener;
            documentClick?: EventListener;
            documentTouchEnd?: EventListener;
          } | undefined;

          if (!previousCloseDelegates) return;

          const previousCloseButton = previousCloseDelegates.closeButton;
          if (previousCloseButton) {
            if (previousCloseDelegates.handleClosePointerDown) {
              previousCloseButton.removeEventListener('pointerdown', previousCloseDelegates.handleClosePointerDown);
            }
            if (previousCloseDelegates.handleClosePointerUp) {
              previousCloseButton.removeEventListener('pointerup', previousCloseDelegates.handleClosePointerUp, true);
            }
            if (previousCloseDelegates.handleCloseClick) {
              previousCloseButton.removeEventListener('click', previousCloseDelegates.handleCloseClick, true);
              previousCloseButton.removeEventListener('click', previousCloseDelegates.handleCloseClick, false);
              if (previousCloseButton.onclick === previousCloseDelegates.handleCloseClick) {
                previousCloseButton.onclick = null;
              }
            }
            if (previousCloseDelegates.handleCloseTouchEnd) {
              previousCloseButton.removeEventListener('touchend', previousCloseDelegates.handleCloseTouchEnd, true);
            }
          }

          if (previousCloseDelegates.modalPointerUp) {
            detailModal.removeEventListener('pointerup', previousCloseDelegates.modalPointerUp, true);
          }
          if (previousCloseDelegates.modalClick) {
            detailModal.removeEventListener('click', previousCloseDelegates.modalClick, true);
          }
          if (previousCloseDelegates.modalTouchEnd) {
            detailModal.removeEventListener('touchend', previousCloseDelegates.modalTouchEnd, true);
          }
          if (previousCloseDelegates.documentPointerUp) {
            document.removeEventListener('pointerup', previousCloseDelegates.documentPointerUp, true);
          }
          if (previousCloseDelegates.documentClick) {
            document.removeEventListener('click', previousCloseDelegates.documentClick, true);
          }
          if (previousCloseDelegates.documentTouchEnd) {
            document.removeEventListener('touchend', previousCloseDelegates.documentTouchEnd, true);
          }

          delete (detailModal as any).__ccJourneyDetailCloseDelegatedHandlers;
        };

        cleanupDetailCloseHandlers();

        const getCloseButtonFromEvent = (event: Event): HTMLElement | null => {
          const target = event.target as Element | null;
          const closeButton = target?.closest?.('#detail-close-btn') as HTMLElement | null;
          if (!closeButton || !detailModal.contains(closeButton)) {
            return null;
          }
          return closeButton;
        };

        const runDetailClose = async (source: string, event?: Event, closeButton: HTMLElement = newCloseBtn) => {
          event?.preventDefault();
          event?.stopPropagation();
          (event as any)?.stopImmediatePropagation?.();

          const now = performance.now();
          if (
            this.journeyDetailCloseInProgress ||
            now < this.journeyDetailCloseGuardUntil ||
            (window as any).__ccJourneyDetailCloseInProgress === true
          ) {
            logger.info('⏭️ Journey detail modal close ignored by manager guard', {
              source,
              inProgress: this.journeyDetailCloseInProgress,
              guardRemainingMs: Math.max(0, Math.round(this.journeyDetailCloseGuardUntil - now)),
              windowGuard: (window as any).__ccJourneyDetailCloseInProgress === true,
            });
            return;
          }

          logger.info('🎁 Journey boards detail modal close requested - using GSAP exit animation', { source });

          if (
            closeButton.getAttribute('data-detail-close-exit-pending') === 'true' ||
            detailModal.getAttribute('data-detail-close-exit-pending') === 'true'
          ) {
            logger.info('⏭️ Journey detail modal close ignored because exit is already pending', { source });
            return;
          }

          closeButton.setAttribute('data-detail-close-exit-pending', 'true');
          detailModal.setAttribute('data-detail-close-exit-pending', 'true');
          this.journeyDetailCloseInProgress = true;
          this.journeyDetailCloseGuardUntil = now + 1800;
          (window as any).__ccJourneyDetailCloseInProgress = true;
          playNavIconCartoonBounce(closeButton);

          try {
            // 🔥 USER REQUEST: Mark that we're returning from detail modal (skip auto-scroll)
            (window as any).__ccReturningFromDetailModal = true;
            const returnBoardId = Number(detailModal.getAttribute('data-journey-board-id') || 0);
            if (Number.isFinite(returnBoardId) && returnBoardId > 0) {
              (window as any).__ccJourneyReturnBoardId = returnBoardId;
              this.setLastActiveJourneyBoardAreaId(returnBoardId);
              try { localStorage.setItem(JOURNEY_RETURN_BOARD_ID_KEY, String(returnBoardId)); } catch {}
            }

            await this.exitDetailModalAndHideCollectibles(detailModal, source, { hideCollectibles: false, hideJourney: false, cleanup: false });

            await this.showJourneyAfterDetailModalClose(source);
          } finally {
            this.journeyDetailCloseInProgress = false;
            this.journeyDetailCloseGuardUntil = performance.now() + 700;
            delete (window as any).__ccJourneyDetailCloseInProgress;
            closeButton.removeAttribute('data-detail-close-exit-pending');
            detailModal.removeAttribute('data-detail-close-exit-pending');
            cleanupDetailCloseHandlers();
          }
        };

        const createDelegatedCloseHandler = (source: string): EventListener => {
          return (event: Event) => {
            const closeButton = getCloseButtonFromEvent(event);
            if (!closeButton) {
              return;
            }
            void runDetailClose(source, event, closeButton);
          };
        };

        const handleClosePointerDown = () => {
          playNavIconCartoonBounce(newCloseBtn);
        };
        const handleCloseClick: EventListener = (event) => {
          void runDetailClose('detail close button direct click', event, newCloseBtn);
        };
        const handleClosePointerUp: EventListener = (event) => {
          void runDetailClose('detail close button direct pointerup', event, newCloseBtn);
        };
        const handleCloseTouchEnd: EventListener = (event) => {
          void runDetailClose('detail close button direct touchend', event, newCloseBtn);
        };

        newCloseBtn.addEventListener('pointerdown', handleClosePointerDown, { passive: true });
        newCloseBtn.addEventListener('pointerup', handleClosePointerUp, { capture: true });
        newCloseBtn.addEventListener('click', handleCloseClick, { capture: true });
        newCloseBtn.addEventListener('click', handleCloseClick, { capture: false });
        newCloseBtn.addEventListener('touchend', handleCloseTouchEnd, { capture: true, passive: false });
        newCloseBtn.onclick = handleCloseClick;

        const closeDelegates = {
          closeButton: newCloseBtn,
          handleClosePointerDown,
          handleClosePointerUp,
          handleCloseClick,
          handleCloseTouchEnd,
          modalPointerUp: createDelegatedCloseHandler('detail close modal delegated pointerup'),
          modalClick: createDelegatedCloseHandler('detail close modal delegated click'),
          modalTouchEnd: createDelegatedCloseHandler('detail close modal delegated touchend'),
          documentPointerUp: createDelegatedCloseHandler('detail close document delegated pointerup'),
          documentClick: createDelegatedCloseHandler('detail close document delegated click'),
          documentTouchEnd: createDelegatedCloseHandler('detail close document delegated touchend'),
        };

        detailModal.addEventListener('pointerup', closeDelegates.modalPointerUp, true);
        detailModal.addEventListener('click', closeDelegates.modalClick, true);
        detailModal.addEventListener('touchend', closeDelegates.modalTouchEnd, { capture: true, passive: false });
        document.addEventListener('pointerup', closeDelegates.documentPointerUp, true);
        document.addEventListener('click', closeDelegates.documentClick, true);
        document.addEventListener('touchend', closeDelegates.documentTouchEnd, { capture: true, passive: false });
        (detailModal as any).__ccJourneyDetailCloseDelegatedHandlers = closeDelegates;
        
        logger.info('✅ Journey boards detail modal close button listeners attached (direct + delegated GSAP exit animation)');
      }
      
      logger.info('✅ Detail modal shown with enter animation');
    } else {
      logger.warn('⚠️ Collectibles detail modal not found');
    }
  }


  public updateCounter(): void {
    const counter = document.getElementById('boards-counter');
    if (counter) {
      const unlockedCount = this.boards.filter(b => b.unlocked).length;
      // 🔥 USER REQUEST: Show "0/30" instead of "00/30" when count is 0
      counter.textContent = `${unlockedCount}/${JOURNEY_MAX_BOARDS}`;
    }
  }

  private refreshJourneyBoardStarVisuals(boardId: number, reason: string): boolean {
    const board = this.boards.find((item) => item.id === boardId);
    if (!board?.unlocked || board.interim) return false;

    const earnedStars = getJourneyEarnedLevelStars(
      boardStatsService.getBoardStats(boardId).highScore,
      boardId,
    );
    const roleOrder = ['left', 'center', 'right'] as const;
    const stars = roleOrder.map((role) => document.querySelector<HTMLImageElement>(
      `.journey-forest-star-board-${boardId}.journey-forest-star-${role}`,
    ));
    if (stars.every((star) => !star)) return false;

    stars.forEach((star, index) => {
      if (!star) return;
      const role = roleOrder[index];
      const filled = index < earnedStars;
      const nextSrc = filled
        ? JOURNEY_LEVEL_STAR_ASSETS[role].filled
        : JOURNEY_LEVEL_STAR_ASSETS[role].empty;
      if (star.getAttribute('src') !== nextSrc) star.src = nextSrc;
      star.classList.toggle('journey-forest-star-filled', filled);
      star.classList.toggle('journey-forest-star-empty', !filled);
    });

    emitIOSNativeDiagnostic('journey-board-stars-refreshed', {
      boardId,
      reason,
      earnedStars,
      mountedStars: stars.filter(Boolean).length,
    });
    return true;
  }

  // 🔥 CRITICAL FIX: Method to refresh background position after screen animation completes
  // This ensures consistent positioning when screen is shown again
  public refreshBackgroundPosition(): void {
    const container = this.container || document.getElementById('journey-boards-container');
    if (!container) return;
    
    const bgContainer = container.querySelector('.journey-bg-container') as HTMLElement;
    if (!bgContainer) return;
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!container || !bgContainer) return;
          
          const imageAspectRatio = FOREST_MAP_DESIGN_HEIGHT / FOREST_MAP_DESIGN_WIDTH;
          const containerWidth = container.offsetWidth || container.clientWidth || 375;
          const calculatedHeight = containerWidth * imageAspectRatio;
          
          const isWorldView = this.journeyV700View === 'world' && this.journeyV700WorldId !== null;
          const topOffset = isWorldView ? getJourneyWorldContentTopPx() : getJourneyContentTopPx();
          const cardsTopOffset = isWorldView ? getJourneyWorldCardStackTopPx() : getJourneyCardStackTopPx();
          const stackBottomOffset = Math.max(topOffset, cardsTopOffset);
          
          // Update positions - hide during update if position changed significantly
          const currentTop = parseFloat(bgContainer.style.top) || 0;
          const positionChanged = Math.abs(currentTop - topOffset) > 1;
          
          if (positionChanged && bgContainer.style.opacity !== '0') {
            // Position changed significantly, hide during update to prevent visible jump
            bgContainer.style.opacity = '0';
            bgContainer.style.transition = 'none';
          } else {
            bgContainer.style.transition = 'none';
          }
          
          container.style.height = `${calculatedHeight + stackBottomOffset + JOURNEY_BOARDSTACK_BOTTOM_ROOM_PX}px`;
          bgContainer.style.height = `${calculatedHeight}px`;
          bgContainer.style.top = `${topOffset}px`;
          bgContainer.style.position = 'absolute';

          const cardsContainer = container.querySelector('.journey-cards-container') as HTMLElement | null;
          if (cardsContainer) {
            cardsContainer.style.height = `${calculatedHeight + stackBottomOffset + JOURNEY_BOARDSTACK_BOTTOM_ROOM_PX}px`;
            cardsContainer.style.top = `${cardsTopOffset}px`;
          }

          const decorContainer = container.querySelector('.journey-decor-container') as HTMLElement | null;
          if (decorContainer) {
            decorContainer.style.height = `${calculatedHeight}px`;
            decorContainer.style.top = `${topOffset}px`;
          }
          
          // Show container after position is set (if it was hidden)
          if (positionChanged) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                bgContainer.style.opacity = '1';
                bgContainer.style.visibility = 'visible';
              });
            });
          } else {
            // Ensure it's visible
            bgContainer.style.opacity = '1';
            bgContainer.style.visibility = 'visible';
          }
          
          logger.debug('📐 Journey background position refreshed:', { topOffset, cardsTopOffset, calculatedHeight });
        });
      });
  }

  /** Give Forest, Beach and Area 55 independent next-stage markers. */
  private ensureWorldInterimCards(): void {
    const interimBoardIds = reconcileJourneyWorldInterims(this.boards);
    logger.debug('🗺️ Ensured Journey World interim cards', { interimBoardIds });
  }

  public unlockBoardByNumber(boardNumber: number): boolean {
    if (boardNumber < 1 || boardNumber > JOURNEY_MAX_BOARDS) return false;
    
    const board = this.boards.find(b => b.id === boardNumber);
    if (!board) return false;
    
    if (!board.unlocked) {
      board.unlocked = true;
      board.interim = false; // Remove interim status when unlocking
      this.markJourneyDevBoardRefresh(`unlock board ${boardNumber}`);
      
      // Keep the next playable marker independent inside every Journey World.
      this.ensureWorldInterimCards();
      
      this.saveBoardsState();
      this.renderBoards();
      this.updateCounter();
      logger.info(`🗺️ Journey board ${boardNumber.toString().padStart(2, '0')} unlocked.`);
      return true;
    }
    return false;
  }

  public lockBoardByNumber(boardNumber: number): boolean {
    if (boardNumber < 1 || boardNumber > JOURNEY_MAX_BOARDS) return false;
    
    const board = this.boards.find(b => b.id === boardNumber);
    if (!board) return false;
    
    if (board.unlocked || board.interim) {
      board.unlocked = false;
      board.interim = false; // Also remove interim status when locking
      this.markJourneyDevBoardRefresh(`lock board ${boardNumber}`);
      
      // 🔥 USER REQUEST: Reset all stats for this board when hiding card
      try {
        import('../services/board-stats-service.js').then(({ boardStatsService }) => {
          boardStatsService.resetBoardStats(boardNumber);
          logger.info(`🧹 Board ${boardNumber} stats reset (high score, longest combo, cubes cracked)`);
        }).catch((error) => {
          logger.warn(`⚠️ Failed to reset board ${boardNumber} stats:`, error);
        });
      } catch (error) {
        logger.warn(`⚠️ Failed to import board stats service:`, error);
      }
      
      // Keep the next playable marker independent inside every Journey World.
      this.ensureWorldInterimCards();
      
      this.saveBoardsState();
      this.renderBoards();
      this.updateCounter();
      logger.info(`🗺️ Journey board ${boardNumber.toString().padStart(2, '0')} locked.`);
      
      // 🔥 DEV BUTTON RESET: Check if all boards are locked except board 1
      // If so, reset game progress (highestBoard, boardNumber, badge count)
      this.checkAndResetProgressIfNeeded();
      
      return true;
    }
    return false;
  }

  /**
   * Check if all boards are locked except board 1, and reset game progress if needed
   * This is called when using dev button "hide cards" to reset progress
   */
  private checkAndResetProgressIfNeeded(): void {
    try {
      // Check if only board 1 is unlocked
      const unlockedBoards = this.boards.filter(b => b.unlocked);
      const onlyFirstBoardUnlocked = unlockedBoards.length === 1 && unlockedBoards[0].id === 1;
      
      if (onlyFirstBoardUnlocked) {
        logger.info('🗺️ DEV RESET: All boards locked except board 1 - resetting game progress');
        
        // Reset game progress (highestBoard, boardNumber)
        try {
          const statsService = (window as any).statsService;
          if (statsService && typeof statsService.resetHighestBoard === 'function') {
            statsService.resetHighestBoard();
            logger.info('✅ DEV RESET: Game progress (highestBoard) reset');
          } else {
            // Fallback: manually reset highestBoard in localStorage
            localStorage.removeItem('cc_highest_board');
            localStorage.removeItem('cc_stats');
            logger.info('✅ DEV RESET: Game progress reset via localStorage');
          }
        } catch (error) {
          logger.warn('⚠️ DEV RESET: Failed to reset game progress:', error instanceof Error ? error.message : String(error));
        }
        
        // 🔥 USER REQUEST: Also reset viewed boards when resetting game progress
        try {
          localStorage.removeItem('journey_viewed_boards');
          logger.info('✅ DEV RESET: Viewed boards reset');
        } catch (error) {
          logger.warn('⚠️ DEV RESET: Failed to reset viewed boards:', error instanceof Error ? error.message : String(error));
        }
        
        // Reset boardNumber in saved game state
        try {
          const savedGame = localStorage.getItem('cc_saved_game');
          if (savedGame) {
            const gameState = JSON.parse(savedGame) as any;
            gameState.boardNumber = 1;
            gameState.level = 1;
            localStorage.setItem('cc_saved_game', JSON.stringify(gameState));
            logger.info('✅ DEV RESET: Board number reset to 1 in saved game state');
          }
        } catch (error) {
          logger.warn('⚠️ DEV RESET: Failed to reset boardNumber:', error instanceof Error ? error.message : String(error));
        }
        
        // Reset badge count (journey_last_viewed_board_id)
        localStorage.setItem('journey_last_viewed_board_id', '0'); // Reset to 0 (no boards viewed)
        logger.info('✅ DEV RESET: Badge count reset (journey_last_viewed_board_id = 0)');
        
        // Reset badge in UI
        if (typeof (window as any).updateNavBadge === 'function') {
          (window as any).updateNavBadge(0, 1, { forceReset: true }); // Reset journey badge (slideIndex 1)
          logger.info('✅ DEV RESET: Journey badge reset in UI');
        }
      }
    } catch (error) {
      logger.warn('⚠️ DEV RESET: Failed to check and reset progress:', error instanceof Error ? error.message : String(error));
    }
  }

  private saveBoardsState(): void {
    try {
      // 🔥 CRITICAL FIX: Save both unlocked AND interim status
      // This ensures interim cards persist after hard exit
      const state = this.boards.map(b => ({ 
        id: b.id, 
        unlocked: b.unlocked,
        interim: b.interim || false // 🔥 CRITICAL: Save interim status
      }));
      localStorage.setItem('journey_boards_state', JSON.stringify(state));
      logger.info('✅ Journey boards state saved (including interim status)');
    } catch (error) {
      logger.warn('Failed to save journey boards state:', error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * 🔥 CRITICAL FIX: Public method to get board by ID (for external access)
   */
  public getBoardById(boardId: number): JourneyBoard | undefined {
    return this.boards.find(b => b.id === boardId);
  }
  
  /**
   * 🔥 CRITICAL FIX: Public method to save boards state (for external access)
   */
  public saveBoardsStatePublic(): void {
    this.ensureWorldInterimCards();
    this.saveBoardsState();
  }

  private loadBoardsState(): void {
    try {
      const version = localStorage.getItem('journey_forest_layout_state_version');
      const shouldResetForForestLayout = version !== JOURNEY_FOREST_LAYOUT_STATE_VERSION;
      const saved = shouldResetForForestLayout ? null : localStorage.getItem('journey_boards_state');

      if (saved) {
        const state = JSON.parse(saved);
        state.forEach((savedBoard: { id: number; unlocked: boolean; interim?: boolean }) => {
          if (savedBoard.id < 1 || savedBoard.id > JOURNEY_MAX_BOARDS) return;
          const board = this.boards.find(b => b.id === savedBoard.id);
          if (board) {
            board.unlocked = savedBoard.unlocked;
            board.interim = savedBoard.interim || false;
          }
        });
      }

      this.boards = this.boards.slice(0, JOURNEY_MAX_BOARDS);
      this.ensureWorldInterimCards();
      localStorage.setItem('journey_forest_layout_state_version', JOURNEY_FOREST_LAYOUT_STATE_VERSION);
      this.saveBoardsState();
    } catch (error) {
      logger.warn('Failed to load journey boards state:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Sync journey boards with game progress (boardNumber)
   * Sets current board to interim (shows common back.png, cannot click)
   * Only unlocks boards that have been completed (won)
   */
  public syncWithGameProgress(_boardNumber?: number): void {
    this.ensureWorldInterimCards();
    this.saveBoardsState();
  }

  /**
   * Unlock board when it's completed (won)
   * This is called when board is successfully completed (clean board)
   */
  public unlockBoardOnCompletion(boardNumber: number): void {
    try {
      if (boardNumber < 1 || boardNumber > JOURNEY_MAX_BOARDS) return;
      
      const board = this.boards.find(b => b.id === boardNumber);
      if (!board) return;
      
      // Check if board was already unlocked (for Board 1 which starts unlocked)
      const wasAlreadyUnlocked = board.unlocked;

      // An interim win is a fresh unlock even if this Stage ID was viewed in an
      // older progression/dev cycle. Clear only this board before render so the
      // resident Unit and automatic return portal both receive the New ribbon.
      if (!wasAlreadyUnlocked) {
        try {
          const viewedBoards: unknown[] = JSON.parse(
            localStorage.getItem('journey_viewed_boards') || '[]',
          );
          const nextViewedBoards = viewedBoards.filter(
            (viewedBoardId) => Number(viewedBoardId) !== boardNumber,
          );
          if (nextViewedBoards.length !== viewedBoards.length) {
            localStorage.setItem('journey_viewed_boards', JSON.stringify(nextViewedBoards));
            logger.info(`🎀 Board ${boardNumber} restored to New state after interim completion`);
          }
        } catch (error) {
          logger.warn('⚠️ Failed to restore completed interim board New state:', error);
        }
      }
      
      // Unlock the board (remove interim status, set unlocked)
      board.unlocked = true;
      board.interim = false;
      // The preserved World DOM can remain mounted behind gameplay. Refresh
      // only this Unit's star images so its return enter uses the newly saved
      // score without replacing the complete World and its animation owner.
      this.refreshJourneyBoardStarVisuals(boardNumber, 'board-completion');
      
      // 🔥 PRODUCTION READY: Preload and cache this board's card image immediately
      // This ensures the card image is always available, even after hard exit
      if (board.imagePath) {
        import('../utils/comprehensive-image-preloader.js').then(({ preloadJourneyBoardImages }) => {
          preloadJourneyBoardImages([boardNumber]).catch((error) => {
            logger.warn(`⚠️ Failed to preload journey board image for board ${boardNumber}:`, error);
          });
        }).catch((error) => {
          logger.warn(`⚠️ Failed to import preloadJourneyBoardImages for board ${boardNumber}:`, error);
        });
      }
      
      // Advance only the affected World's next-stage marker while preserving
      // the first interim card in Worlds that have no completed Stage yet.
      this.ensureWorldInterimCards();
      
      // 🔥 CRITICAL FIX: Save + render AFTER interim is ensured.
      // Otherwise the Journey screen can keep a stale render (it often skips re-render if boards already exist),
      // leading to "missing interim card" even though state is correct.
      this.saveBoardsState();
      this.renderBoards();
      this.updateCounter();
      logger.info(`🗺️ Board ${boardNumber.toString().padStart(2, '0')} unlocked on completion (won) - was already unlocked: ${wasAlreadyUnlocked}`);
      
      // 🔥 JOURNEY PROGRESSION: Update highestUnlockedBoardId
      try {
        import('./journey-progression-state.js').then(({ journeyProgressionState }) => {
          const nextLevel = boardNumber + 1;
          const currentHighest = journeyProgressionState.getHighestUnlockedBoardId() || 1;
          const newHighest = Math.max(currentHighest, nextLevel);
          journeyProgressionState.setHighestUnlockedBoardId(newHighest);
          logger.info(`🗺️ Journey: Highest unlocked board updated to ${newHighest} after completing board ${boardNumber}`);
        }).catch((error) => {
          logger.warn('⚠️ Failed to update highest unlocked board ID:', error instanceof Error ? error.message : String(error));
        });
      } catch (error) {
        logger.warn('⚠️ Failed to update highest unlocked board ID:', error instanceof Error ? error.message : String(error));
      }
      
      // 🔥 USER BUG FIX: Update navigation badge immediately after unlocking board
      // This ensures badge shows newly unlocked board count even when user is still in game
      // Even if board was already unlocked (like Board 1), we still need to check badge count
      const newlyUnlockedCount = this.getNewlyUnlockedCount();
      logger.debug(`🗺️ unlockBoardOnCompletion: Badge count calculated: ${newlyUnlockedCount} for board ${boardNumber} (was already unlocked: ${wasAlreadyUnlocked})`);
      
      if (typeof (window as any).updateNavBadge === 'function') {
        (window as any).updateNavBadge(newlyUnlockedCount, 1); // Pass slideIndex 1 for Journey
        logger.debug(`🗺️ Journey badge updated after unlocking board ${boardNumber}: ${newlyUnlockedCount} newly unlocked boards (was already unlocked: ${wasAlreadyUnlocked})`);
      } else {
        logger.warn(`⚠️ updateNavBadge function not found! Badge will not be updated for board ${boardNumber}`);
      }
    } catch (error) {
      logger.warn('Failed to unlock board on completion:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get count of newly unlocked boards (boards that were just unlocked/won)
   * This is used for badge notification
   * 
   * IMPORTANT: Badge shows ONLY unlocked (completed/won) boards that user hasn't viewed yet
   * - Interim boards are NOT counted (they are accessible but not won yet)
   * - Only unlocked boards count towards badge
   * - Badge resets to 0 when user visits journey screen
   * 
   * Example:
   * - Win Board 1 → Board 1 unlocked → badge = 1
   * - Start Board 2 → Board 2 interim (NOT unlocked) → badge = 1 (still, Board 2 doesn't count)
   * - Win Board 2 → Board 2 unlocked → badge = 2
   * - Visit journey screen → badge = 0 (all unlocked boards marked as viewed)
   * - Win Board 3 → Board 3 unlocked → badge = 1 (Board 1 and 2 were already viewed)
   */
  public getNewlyUnlockedCount(): number {
    try {
      // 🔥 USER REQUEST: Get list of viewed boards (individual tracking)
      // Each board is marked as viewed when user opens its details screen
      const viewedBoardsStr = localStorage.getItem('journey_viewed_boards') || '[]';
      const viewedBoards: number[] = JSON.parse(viewedBoardsStr);
      
      // Count ONLY unlocked boards (completed/won boards)
      // Interim boards are NOT counted - they are accessible but not won yet
      const unlockedBoards = this.boards.filter(b => b.unlocked);
      const unlockedCount = unlockedBoards.length;
      
      // Count how many unlocked boards user has NOT viewed yet
      // A board is "viewed" if its ID is in the viewedBoards list
      // Only unlocked boards count towards badge
      const newUnlockedBoards = unlockedBoards.filter(b => !viewedBoards.includes(b.id));
      const newCount = newUnlockedBoards.length;
      
      logger.info(`🗺️ Badge count: ${unlockedCount} unlocked boards total, viewed boards: [${viewedBoards.join(', ')}], new boards: [${newUnlockedBoards.map(b => b.id).join(', ')}], ${newCount} new unlocked boards not viewed yet (interim boards NOT counted)`);
      
      return newCount;
    } catch (error) {
      logger.warn('Failed to get newly unlocked count:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Get total unlocked boards count (excluding board 1)
   * This is used to show badge with total number of unlocked boards
   */
  public getTotalUnlockedCount(): number {
    try {
      const currentUnlockedCount = this.boards.filter(b => b.unlocked).length;
      // Subtract 1 for board 1 which is always unlocked
      const unlockedBoardsExcludingFirst = Math.max(0, currentUnlockedCount - 1);
      return unlockedBoardsExcludingFirst;
    } catch (error) {
      logger.warn('Failed to get total unlocked count:', error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * 🔥 USER REQUEST: Mark a specific board as viewed (when details screen is opened)
   * Badge count decreases by 1 each time a board details screen is opened
   * 
   * @param boardId - The ID of the board to mark as viewed
   */
  public markBoardAsViewed(boardId: number): void {
    try {
      // Get current list of viewed boards
      const viewedBoardsStr = localStorage.getItem('journey_viewed_boards') || '[]';
      const viewedBoards: number[] = JSON.parse(viewedBoardsStr);
      
      // Add board ID to list if not already there
      if (!viewedBoards.includes(boardId)) {
        viewedBoards.push(boardId);
        localStorage.setItem('journey_viewed_boards', JSON.stringify(viewedBoards));
        logger.info(`🗺️ Board ${boardId} marked as viewed (total viewed: ${viewedBoards.length})`);
        
        // Update badge count in UI
        const newBadgeCount = this.getNewlyUnlockedCount();
        if (typeof (window as any).updateNavBadge === 'function') {
          (window as any).updateNavBadge(newBadgeCount, 1, { forceReset: true }); // Update journey badge (slideIndex 1)
          logger.debug(`🗺️ Journey badge updated to ${newBadgeCount} after viewing board ${boardId}`);
        }
      } else {
        logger.info(`🗺️ Board ${boardId} already marked as viewed - no action needed`);
      }
    } catch (error) {
      logger.warn('Failed to mark board as viewed:', error instanceof Error ? error.message : String(error));
    }
  }
  
  /**
   * @deprecated Use markBoardAsViewed(boardId) instead for individual tracking
   * Mark all currently unlocked (completed/won) boards as viewed (reset badge count)
   * This is called when user visits journey screen
   * 
   * IMPORTANT: Only unlocked boards are marked as viewed (interim boards don't count)
   * Badge resets to 0 after user visits journey screen
   */
  public markAsViewed(): void {
    try {
      // 🔥 USER REQUEST: Don't reset badge when opening journey screen
      // Badge should only decrease when individual board details are opened
      // Keep this method for backward compatibility but don't reset badge
      logger.info('🗺️ markAsViewed() called - badge will NOT be reset (use markBoardAsViewed() instead)');
    } catch (error) {
      logger.warn('Failed to mark journey boards as viewed:', error instanceof Error ? error.message : String(error));
    }
  }

  public async resetBoardByNumber(boardNumber: number): Promise<boolean> {
    if (boardNumber < 1 || boardNumber > JOURNEY_MAX_BOARDS) return false;

    try {
      const { boardStatsService } = await import('../services/board-stats-service.js');
      boardStatsService.resetBoardStats(boardNumber);
      logger.info(`🧹 Board ${boardNumber} stats reset (high score, longest combo, cubes cracked)`);
    } catch (error) {
      logger.warn(`⚠️ Failed to reset board ${boardNumber} stats:`, error);
    }

    try {
      const { clearBoardSaveState } = await import('../utils/board-save-utils.js');
      clearBoardSaveState(boardNumber);
      logger.info(`🧹 Board ${boardNumber} saved state cleared`);
    } catch (error) {
      logger.warn(`⚠️ Failed to clear board ${boardNumber} saved state:`, error);
    }

    try {
      const scoreBottomSheetModule = await import('../modules/score-bottom-sheet.js');
      if (scoreBottomSheetModule?.isScoreBottomSheetVisible?.()) {
        scoreBottomSheetModule.showScoreBottomSheet?.();
      }
    } catch (error) {
      logger.warn('⚠️ Failed to refresh score bottom sheet after board reset:', error);
    }

    this.markJourneyDevBoardRefresh(`reset board ${boardNumber}`);
    return true;
  }

  private resetArcadeProgressForDev(): void {
    try {
      arcadeStatsService.resetStats();
      clearArcadeSaveState();

      try {
        localStorage.removeItem('cc_saved_game');
        localStorage.removeItem('cubeCrash_gameState');
        localStorage.removeItem('cc_board_completed');
      } catch {}

      try {
        delete (window as any).__ccForceArcadeRestartStage01;
        delete (window as any).__ccArcadeStageContinuePreserveWild;
        delete (window as any).__ccArcadeStageWildMeterCarryover;
        delete (window as any).__ccArcadePlayAgainStarting;
      } catch {}

      try {
        import('../modules/score-bottom-sheet.js').then((scoreBottomSheetModule) => {
          if (scoreBottomSheetModule?.isScoreBottomSheetVisible?.()) {
            scoreBottomSheetModule.showScoreBottomSheet?.();
          }
        }).catch(() => {});
      } catch {}

      logger.info('🧹 Arcade stats and run save reset from Reset Board modal');
    } catch (error) {
      logger.warn('⚠️ Failed to reset Arcade progress from Reset Board modal:', error);
    }
  }

  public showBoardPickerModal(action: 'show' | 'hide' | 'reset'): void {
    logger.debug('🗺️ showBoardPickerModal called', { action });
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-picker-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0, 0, 0, 0.5) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 9999999999 !important;
      backdrop-filter: blur(4px) !important;
      pointer-events: auto !important;
      touch-action: manipulation !important;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'card-picker-modal';
    modal.style.cssText = `
      background: url('../../assets/modals/paper.png');
      background-size: cover;
      background-position: center;
      border-radius: 24px;
      padding: 24px;
      max-width: 90vw;
      width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = action === 'show'
      ? 'Show Stages'
      : action === 'hide'
        ? 'Hide Stages'
        : 'Reset Stage';
    title.style.cssText = `
      font-size: 24px;
      font-weight: 800;
      color: #ad8775;
      margin: 0 0 20px 0;
      text-align: center;
    `;

    // Grid container
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    `;

    // Store selected boards
    const selectedBoards: Set<number> = new Set();
    let arcadeSelected = false;

    const setPickerButtonSelected = (btn: HTMLButtonElement, selected: boolean) => {
      btn.style.background = selected ? '#e8734a' : '#f3eee8';
      btn.style.borderColor = selected ? '#e8734a' : '#e0e0e0';
      btn.style.color = selected ? 'white' : '#333';
    };

    if (action === 'reset') {
      const arcadeBtn = document.createElement('button');
      arcadeBtn.textContent = 'Arcade';
      arcadeBtn.style.cssText = `
        background: #f3eee8;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px 8px;
        font-size: 16px;
        font-weight: 700;
        color: #333;
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      arcadeBtn.addEventListener('click', () => {
        arcadeSelected = !arcadeSelected;
        setPickerButtonSelected(arcadeBtn, arcadeSelected);
      });

      grid.appendChild(arcadeBtn);
    }

    // Create one debug button per configured Journey board.
    for (let i = 1; i <= JOURNEY_MAX_BOARDS; i++) {
      const btn = document.createElement('button');
      btn.textContent = i.toString().padStart(2, '0');
      
      // Check current state
      const board = this.boards.find(b => b.id === i);
      const isUnlocked = board?.unlocked ?? false;
      
      // For "show" action, only show locked boards.
      // For "hide" action, only show unlocked boards.
      // For "reset", allow every board to be selected.
      const shouldShow = action === 'show' ? !isUnlocked : action === 'hide' ? isUnlocked : true;
      
      btn.style.cssText = `
        background: ${shouldShow ? '#f3eee8' : '#e0e0e0'};
        border: 2px solid ${shouldShow ? '#e0e0e0' : '#ccc'};
        border-radius: 12px;
        padding: 16px;
        font-size: 16px;
        font-weight: 600;
        color: ${shouldShow ? '#333' : '#999'};
        cursor: ${shouldShow ? 'pointer' : 'not-allowed'};
        transition: all 0.2s ease;
        opacity: ${shouldShow ? '1' : '0.5'};
      `;

      if (shouldShow) {
        btn.addEventListener('click', () => {
          if (selectedBoards.has(i)) {
            // Deselect
            selectedBoards.delete(i);
            setPickerButtonSelected(btn, false);
          } else {
            // Select
            selectedBoards.add(i);
            setPickerButtonSelected(btn, true);
          }
        });
      }

      grid.appendChild(btn);
    }

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 12px;
    `;

    // OK button
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = `
      flex: 1;
      background: #e8734a;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-size: 16px;
      font-weight: 600;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    okBtn.addEventListener('mouseenter', () => {
      okBtn.style.background = '#d1653a';
    });

    okBtn.addEventListener('mouseleave', () => {
      okBtn.style.background = '#e8734a';
    });

    // 🔥 MEMORY LEAK FIX: Centralized close - remove listeners before removing overlay
    let closed = false;
    const handleClose = () => {
      if (closed) return;
      closed = true;
      overlay.removeEventListener('click', handleOverlayClick);
      overlay.removeEventListener('touchend', handleOverlayTouchend, { capture: false });
      try {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      } catch {}
      logger.debug('✅ Board picker modal closed and cleaned up');
    };

    const handleOverlayClick = (e: Event) => {
      if (e.target === overlay) handleClose();
    };
    const handleOverlayTouchend = (e: TouchEvent) => {
      if (e.target === overlay) {
        e.preventDefault();
        handleClose();
      }
    };

    okBtn.addEventListener('click', async () => {
      const resetLabels: string[] = [];

      if (action === 'reset' && arcadeSelected) {
        this.resetArcadeProgressForDev();
        resetLabels.push('Arcade');
      }

      for (const boardNum of selectedBoards) {
        if (action === 'show') {
          this.unlockBoardByNumber(boardNum);
        } else if (action === 'hide') {
          this.lockBoardByNumber(boardNum);
        } else {
          await this.resetBoardByNumber(boardNum);
          resetLabels.push(boardNum.toString().padStart(2, '0'));
        }
      }
      if (action === 'reset' && resetLabels.length > 0) {
        alert(`Reset: ${resetLabels.join(', ')}`);
      }
      handleClose();
    });

    // Cancel button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cancel';
    closeBtn.style.cssText = `
      flex: 1;
      background: #e0e0e0;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-size: 16px;
      font-weight: 600;
      color: #666;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#ccc';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = '#e0e0e0';
    });

    closeBtn.addEventListener('click', handleClose);

    // Assemble modal
    modal.appendChild(title);
    modal.appendChild(grid);
    buttonContainer.appendChild(okBtn);
    buttonContainer.appendChild(closeBtn);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);
    
    document.body.appendChild(overlay);
    void overlay.offsetHeight;

    overlay.addEventListener('click', handleOverlayClick);
    overlay.addEventListener('touchend', handleOverlayTouchend);
  }

  private initJourneyButtons(): void {
    const unlockBtn = document.getElementById('journey-unlock-btn') as HTMLButtonElement | null;
    if (unlockBtn) {
      // 🔥 CHROME FIX: Don't use cloneNode - just remove old listeners via onclick
      // Remove any existing onclick handler
      unlockBtn.onclick = null;
      
      // 🔥 CHROME + MOBILE FIX: Use onclick for better cross-browser compatibility
      const handleUnlock = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        logger.debug('🗺️ Journey Show Card button clicked/touched', { type: e.type });
        this.showBoardPickerModal('show');
      };
      
      // Use onclick property (overwrites any existing handler)
      unlockBtn.onclick = handleUnlock;
      
      // 🔥 CHROME FIX: Ensure button is interactive
      unlockBtn.style.pointerEvents = 'auto';
      unlockBtn.style.cursor = 'pointer';
      unlockBtn.disabled = false;
      
      logger.debug('Journey Show Card button listener attached', undefined, { onclick: true });
    }

    const hideBtn = document.getElementById('journey-hide-btn') as HTMLButtonElement | null;
    if (hideBtn) {
      // 🔥 CHROME FIX: Don't use cloneNode - just remove old listeners via onclick
      // Remove any existing onclick handler
      hideBtn.onclick = null;
      
      // 🔥 CHROME + MOBILE FIX: Use onclick for better cross-browser compatibility
      const handleHide = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        logger.debug('🗺️ Journey Hide Card button clicked/touched', { type: e.type });
        this.showBoardPickerModal('hide');
      };
      
      // Use onclick property (overwrites any existing handler)
      hideBtn.onclick = handleHide;
      
      // 🔥 CHROME FIX: Ensure button is interactive
      hideBtn.style.pointerEvents = 'auto';
      hideBtn.style.cursor = 'pointer';
      hideBtn.disabled = false;
      
      logger.debug('Journey Hide Card button listener attached', undefined, { onclick: true });
    }
  }
}

// Export singleton instance
export const journeyBoardsManager = new JourneyBoardsManager();
