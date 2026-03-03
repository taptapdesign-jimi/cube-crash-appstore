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
import { isAssetAliasRegistered, markAssetAliasRegistered } from '../utils/asset-registry.js';
import { JOURNEY_CARD_IDLE_BOUNCE, smokeBubblesAtCard } from './journey-card-idle-bounce.js';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { getBoardSaveKey, hasSavedStateForBoard } from '../utils/board-save-utils.js';
import { getOriginalGsapTo, getOriginalGsapTimeline } from './drag-core.js';

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

// Card positions - specify in PIXELS, system converts to VIEWPORT UNITS (vw/vh)
// Format: { x: pxToPercent(pixels_from_left) or vw value, top: pxToPercentTop(pixels_from_top) or vh value, width, height, rotation }
// IMPORTANT: When adding new cards, DO NOT change existing card positions!
// Standard card width - all cards must be the same size
const STANDARD_CARD_WIDTH = 109.82; // Use consistent width for all cards

const CARD_POSITIONS = [
  // Card 01 - FIRST DAY (moved 8px left from left edge, moved up additional 48px from current position) - total moved up 72px from original, lowered by 8px
  { x: pxToPercent(-8), top: pxToPercentTop(24 - 24 - 24 - 48 + 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: 4 },
  // Card 02 - SO SPECIAL (centered horizontally 50%, 89px - 24px = 65px from top, rotated -3° counter-clockwise - reversed) - moved up 24px, moved right 40px (applied in code)
  { x: 50, top: pxToPercentTop(89 - 24 - 24), width: STANDARD_CARD_WIDTH, height: 150, rotation: -3 },
  // Card 03 - ALL STAR (moved left 40px from right edge - 24px + 16px, 154px + 8px - 120px + 80px - 8px = 114px from top, rotated +6° clockwise - reversed) - moved up 24px, lowered by 32px total
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH + 24 + 16), top: pxToPercentTop(154 + 8 - 120 + 80 - 8 - 24 + 16 + 8 + 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: 6 },
  // Card 04 - FLYING UP (centered horizontally 50%, 277px + 40px - 16px - 150px + 80px - 24px - 16px = 191px from top, rotated 2° clockwise) - moved up 24px, lowered by 144px total
  { x: 50, top: pxToPercentTop(277 + 40 - 16 - 150 + 80 - 24 - 16 - 24 + 40 + 40 + 40 + 8 + 16), width: STANDARD_CARD_WIDTH, height: 150, rotation: 2 },
  // Card 05 - PLANNER (-8px from left edge - intentionally pushed left, 277px + 86px + 24px - 250px + 80px + 32px = 249px from top, rotated -3° counter-clockwise) - moved up 24px, lowered by 208px total
  { x: pxToPercent(-8), top: pxToPercentTop(277 + 86 + 24 - 250 + 80 + 32 - 24 + 40 + 120 + 24 + 24), width: STANDARD_CARD_WIDTH, height: 150, rotation: -3 },
  // Card 06 - (42px from right edge, 80px below card 5 = 363px + 80px - 150px - 16px = 277px, rotated -3° counter-clockwise) - moved up 24px, lowered by 242px total (raised by 148px total, moved left by 42px)
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH + 42), top: pxToPercentTop(363 + 80 - 150 - 16 - 24 + 150 + 240 + 300 - 300 - 80 - 40 - 4 - 24), width: STANDARD_CARD_WIDTH, height: 150, rotation: -3 },
  // Card 07 - (64px from left edge, 80px below card 6 = 443px + 80px - 300px + 100px + 10px = 333px from top, rotated +3° clockwise) - moved up 24px, lowered by 298px total (raised by 352px total)
  { x: pxToPercent(64), top: pxToPercentTop(443 + 80 - 300 + 100 + 10 - 24 + 400 + 250 - 200 - 120 - 16 - 16), width: STANDARD_CARD_WIDTH, height: 150, rotation: 3 },
  // Card 08 - (60px from right edge - moved left 24px, 80px below card 7 = 523px + 80px = 603px from top, rotated -3° counter-clockwise) - moved up 24px, lowered by 170px total (raised by 96px total, moved left 24px) - raised by additional 24px, lowered by 8px, moved left by 8px
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH + 36 + 24 + 8), top: pxToPercentTop(523 + 80 - 24 + 250 - 80 - 16 - 24 + 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: -3 },
  // Card 09 - (50px - 4px = 46px from left edge, 80px below card 8 = 603px + 80px = 683px from top, rotated -9° counter-clockwise) - moved up 24px, lowered by 250px - raised by additional 80px, lowered by 8px, raised by 50px, moved left by 16px, lowered by 8px
  { x: pxToPercent(46 - 16), top: pxToPercentTop(603 + 80 - 24 + 250 - 80 + 8 - 50 + 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: -9 },
  // Card 10 - (84px + 8px = 92px from left edge, 811px from top, rotated +2° clockwise) - moved up 24px, lowered by 250px, raised by 16px, moved right by 8px, raised by 24px, raised by additional 24px, moved left by 16px
  { x: pxToPercent(76 + 16 - 4 - 4 + 8 - 8 - 16), top: pxToPercentTop(683 + 80 + 80 - 24 - 8 - 24 + 250 - 16 - 24 - 24), width: STANDARD_CARD_WIDTH, height: 150, rotation: 2 },
  // Card 11 - (16px + 16px = 32px from right edge, 875px from top, rotated -2° counter-clockwise) - moved up 24px, lowered by 250px, raised by 24px, moved left by 32px, moved left by additional 8px, rotated 2 degrees more to the left
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH + 32 + 32 + 8), top: pxToPercentTop(811 + 80 - 16 - 24 + 250 - 24), width: STANDARD_CARD_WIDTH, height: 150, rotation: -4 },
  // Card 12 - (18px - 8px = 10px from left edge, 80px below card 11 + 16px = 875px + 80px + 16px = 971px from top, rotated +3° clockwise) - moved up 24px, lowered by 250px, lowered by 8px
  { x: pxToPercent(24 - 6 - 8), top: pxToPercentTop(875 + 80 + 16 - 24 + 250 + 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: 3 },
  // Card 13 - (152px from left edge, 1007px + 2px = 1009px from top, rotated -4° counter-clockwise) - moved up 24px, lowered by 250px, lowered by 24px
  { x: pxToPercent(120 + 32), top: pxToPercentTop(971 + 80 - 36 - 8 + 2 - 24 + 250 + 24), width: STANDARD_CARD_WIDTH, height: 150, rotation: -4 },
  // Card 14 - (0px from left edge, 1105px + 6px = 1111px from top, rotated -6° counter-clockwise) - moved up 24px, lowered by 250px, lowered by 80px, raised by 10px, moved left by 6px, raised by additional 8px
  { x: pxToPercent(0 - 6), top: pxToPercentTop(1009 + 80 + 16 + 6 - 24 + 250 + 80 - 10 - 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: -6 },
  // Card 15 - (4px from right edge, 1159px from top, rotated +6° clockwise) - moved up 24px, lowered by 250px, lowered by 100px, moved left by 24px, raised by 10px, moved left by additional 20px, raised by 4px, moved right by 2px
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH + 4 + 24 + 20 - 2), top: pxToPercentTop(1111 + 80 - 40 + 8 - 24 + 250 + 100 - 10 - 4), width: STANDARD_CARD_WIDTH, height: 150, rotation: 6 },
  // Card 16 - (102px - 6px = 96px from left edge, 1269px from top, rotated +3° clockwise) - moved up 24px, lowered by 250px, lowered by 84px, lowered by additional 24px, moved left by 10px
  { x: pxToPercent(106 - 4 - 6 - 10), top: pxToPercentTop(1159 + 80 + 34 - 4 - 24 + 250 + 84 + 24), width: STANDARD_CARD_WIDTH, height: 150, rotation: 3 },
];


class JourneyBoardsManager {
  private boards: JourneyBoard[] = [];
  private container: HTMLElement | null = null;
  private renderDisposed = false; // Guard async work when screen is torn down
  private cleanupInProgress = false;
  private glowPulseInterval: number | null = null; // Interval for continuous glow pulse
  private journeyExitPromise: Promise<void> | null = null;
  // 🔥 USER REQUEST: Shimmer is now triggered together with glow (not independent interval)
  // 🔥 USER REQUEST: Smoke bubbles are now triggered DURING bounce animation (not independent interval)
  
  // 🔥 MEMORY LEAK FIX: Track all requestAnimationFrame calls for proper cleanup
  private _activeRAFs: Set<number> = new Set();
  
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

  private hideHomeAndJourneyScreens(
    context: string,
    opts: { setJourneyZIndex?: boolean; hideJourney?: boolean; cleanup?: boolean } = {}
  ): void {
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
    (window as any).__ccCameFromJourney = true;
    (window as any).__ccCameFromHomepage = false;
    localStorage.setItem('__ccCameFromJourney', 'true');
    localStorage.removeItem('__ccCameFromHomepage');

    if (opts.fromInterim) {
      (window as any).__ccFromInterimBoard = true;
      (window as any).__ccIsInterimBoard = true;
      try { localStorage.setItem('__ccFromInterimBoard', 'true'); } catch {}
      if (opts.returningFromInterim) {
        (window as any).__ccReturningFromInterimBoard = true;
        try { localStorage.setItem('__ccReturningFromInterimBoard', 'true'); } catch {}
      }
    } else {
      (window as any).__ccFromInterimBoard = false;
      (window as any).__ccIsInterimBoard = false;
      try { localStorage.removeItem('__ccFromInterimBoard'); } catch {}
    }
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
    if (this.journeyExitPromise) {
      return this.journeyExitPromise;
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

    this.journeyExitPromise = (async () => {
      try {
        const { animateCollectiblesScreenExit } = await import('../ui/collectibles-animations.js');
        await animateCollectiblesScreenExit();
        logger.info('✅ Journey screen exit animation completed (early start)');
      } catch (error) {
        logger.warn('⚠️ Failed to start Journey exit animation early:', error);
      } finally {
        this.journeyExitPromise = null;
      }
    })();

    return this.journeyExitPromise;
  }

  /**
   * 🔥 USER REQUEST: Start independent bounce animation on interim card
   * This is a continuous animation that runs independently from other cards
   */
  private startInterimBounce(card: HTMLElement): void {
    // Get card wrapper (has the transform/rotation)
    const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (!cardWrapper) return;
    
    // 🔥 CRITICAL FIX: Check if bounce animation is already active to prevent duplicates
    if ((cardWrapper as any)._interimBounceActive) {
      logger.warn('⚠️ Interim bounce animation already active, skipping duplicate start');
      return;
    }
    
    // Stop any existing bounce animation (safety check)
    this.stopInterimBounce(card);
    
    // Get current rotation and scale from transform
    const transform = cardWrapper.style.transform || '';
    const rotationMatch = transform.match(/rotate\(([^)]+)\)/);
    const originalRotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;
    
    // 🔥 iPad FIX: Detect iPad and adjust scale values to account for existing scale(1.76)
    const isIPad = window.innerWidth >= 769 && window.innerWidth <= 1024;
    let originalScale = isIPad ? 1.76 : 1; // Default scale based on device (1.76 for iPad, 1 for others)
    // Extract existing scale if present
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    if (scaleMatch && scaleMatch[1]) {
      originalScale = parseFloat(scaleMatch[1]) || originalScale;
    }
    
    // Animation parameters (similar to journey-card-idle-bounce.ts)
    const baseScale = originalScale; // Use detected scale (1.76 for iPad, 1 for others)
    const scaleUp = originalScale * 1.05; // Scale up by 5% from base (2 -> 2.1 for iPad, 1 -> 1.05 for others)
    const tiltDegrees = 2.5;
    const tiltDirection = Math.random() > 0.5 ? 1 : -1;
    
    // Store original transform
    (cardWrapper as any)._originalTransform = transform || '';
    
    // Create continuous bounce animation
    const animateBounce = () => {
      if (this.renderDisposed || !card.parentElement) {
        this.stopInterimBounce(card);
        return;
      }
      
      // 🔥 CRITICAL FIX: Double-check that bounce is still active (prevent race conditions)
      if (!(cardWrapper as any)._interimBounceActive) {
        logger.warn('⚠️ Bounce animation stopped externally, aborting animateBounce');
        return;
      }
      
      // Kill any existing animation
      gsap.killTweensOf(cardWrapper, 'scale,rotation');
      
      // logger.info('💚 Starting bounce animation: scale up (0.1s) -> smoke at peak -> scale down (0.1s) -> wait 1.5-2.5s');
      
      // Phase 1: Scale up with rotation - fast 0.1s (original speed)
      trackTween(cardWrapper, {
        scale: scaleUp,
        rotation: originalRotation + tiltDegrees * tiltDirection,
        duration: 0.1, // 🔥 USER REQUEST: Fast bounce (original speed)
        ease: 'power2.out',
        transformOrigin: 'center center',
        onComplete: () => {
          // 🔥 USER REQUEST: Trigger smoke bubbles at peak of bounce animation (at 0.1s peak)
          if (card && card.parentElement) {
            // 🔥 CRITICAL FIX: Check if bounce is still active before triggering smoke
            if (!(cardWrapper as any)._interimBounceActive) {
              // Expected during fast teardown/slide exits; avoid noisy warning.
              logger.debug('ℹ️ Bounce stopped before smoke trigger during teardown, skipping smoke');
              return;
            }
            
            // logger.info('💨 Triggering smoke bubbles at bounce peak (0.1s)');
            const randomAlpha = 0.8 + Math.random() * 0.2; // Random between 0.8 and 1.0
            smokeBubblesAtCard(card, {
              sizeScale: 0.55, // Better quality (similar to tiles)
              distanceScale: 0.55, // Better quality (similar to tiles)
              countScale: 0.45, // More particles (better quality)
              haloScale: 0.55, // Better halo
              strength: 1.8 + Math.random() * 0.7, // ~100% jače
              trailAlpha: randomAlpha, // Random alpha for trail/plume (0.8-1.0)
              baseAlpha: randomAlpha // Random alpha for base smoke particles (0.8-1.0)
            });
          }
          
          // Phase 2: Return to scale and rotation - fast 0.1s (original speed)
          trackTween(cardWrapper, {
            scale: baseScale,
            rotation: originalRotation,
            duration: 0.1, // 🔥 USER REQUEST: Fast bounce (original speed)
            ease: 'power2.in',
            transformOrigin: 'center center',
            onComplete: () => {
              // 🔥 CRITICAL FIX: Check if bounce is still active before scheduling next bounce
              if (!(cardWrapper as any)._interimBounceActive || this.renderDisposed || !card.parentElement) {
                logger.warn('⚠️ Bounce stopped during animation, not scheduling next bounce');
                return;
              }
              
              // Restore original transform (includes scale(1.76) for iPad)
              const storedTransform = (cardWrapper as any)._originalTransform;
              if (storedTransform) {
                cardWrapper.style.transform = storedTransform;
              } else {
                // Fallback: rebuild transform with original rotation and scale
                let restoredTransform = '';
                if (transform.includes('translateX(-50%)')) {
                  restoredTransform = `translateX(-50%) rotate(${originalRotation}deg)`;
                } else {
                  restoredTransform = `rotate(${originalRotation}deg)`;
                }
                // 🔥 iPad FIX: Add scale using originalScale (1.76 for iPad, 1 for others)
                if (originalScale !== 1) {
                  restoredTransform += ` scale(${originalScale})`;
                }
                cardWrapper.style.transform = restoredTransform;
              }
              
              // 🔥 CRITICAL FIX: Clear any existing timeout before setting new one
              if ((cardWrapper as any)._bounceTimeout) {
                clearTimeout((cardWrapper as any)._bounceTimeout);
                (cardWrapper as any)._bounceTimeout = null;
              }
              
              // 🔥 USER REQUEST: Very fast interval between bounces (0.5-0.8 seconds)
              const nextBounceDelay = 500 + Math.random() * 300; // 0.5-0.8 seconds (was 1.5-2.5s)
              logger.debug(`💚 Bounce complete, scheduling next bounce in ${nextBounceDelay}ms`);
              (cardWrapper as any)._bounceTimeout = setTimeout(animateBounce, nextBounceDelay);
            }
          });
        }
      });
    };
    
    // 🔥 CRITICAL FIX: Clear any existing timeout before setting new one
    if ((cardWrapper as any)._bounceTimeout) {
      clearTimeout((cardWrapper as any)._bounceTimeout);
      (cardWrapper as any)._bounceTimeout = null;
    }
    
    // 🔥 USER REQUEST: Start first bounce after very short delay (0.25s)
    (cardWrapper as any)._bounceTimeout = setTimeout(animateBounce, 250);
    
    // Store reference for cleanup
    (cardWrapper as any)._interimBounceActive = true;
    
    logger.debug('💚 Started interim bounce animation on card');
  }
  
  /**
   * 🔥 USER REQUEST: Stop bounce animation on interim card
   */
  private stopInterimBounce(card: HTMLElement): void {
    const cardWrapper = card.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (!cardWrapper) return;
    
    // Kill GSAP animations
    gsap.killTweensOf(cardWrapper, 'scale,rotation');
    
    // Clear timeout
    if ((cardWrapper as any)._bounceTimeout) {
      clearTimeout((cardWrapper as any)._bounceTimeout);
      delete (cardWrapper as any)._bounceTimeout;
    }
    
    // Restore original transform (includes scale(1.76) for iPad)
    const storedTransform = (cardWrapper as any)._originalTransform;
    if (storedTransform) {
      cardWrapper.style.transform = storedTransform;
    } else {
      // Fallback: rebuild transform with original rotation and scale
      const currentTransform = cardWrapper.style.transform || '';
      const rotationMatch = currentTransform.match(/rotate\(([^)]+)\)/);
      const originalRotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;
      
      // 🔥 iPad FIX: Detect iPad and restore scale (1.76 for iPad, 1 for others)
      const isIPad = window.innerWidth >= 769 && window.innerWidth <= 1366;
      let originalScale = isIPad ? 1.76 : 1; // Default scale based on device
      // Extract existing scale if present
      const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
      if (scaleMatch && scaleMatch[1]) {
        originalScale = parseFloat(scaleMatch[1]) || originalScale;
      }
      
      let restoredTransform = '';
      if (currentTransform.includes('translateX(-50%)')) {
        restoredTransform = `translateX(-50%) rotate(${originalRotation}deg)`;
      } else {
        restoredTransform = `rotate(${originalRotation}deg)`;
      }
      // 🔥 iPad FIX: Add scale using originalScale (1.76 for iPad, 1 for others)
      if (originalScale !== 1) {
        restoredTransform += ` scale(${originalScale})`;
      }
      cardWrapper.style.transform = restoredTransform;
    }
    
    delete (cardWrapper as any)._interimBounceActive;
  }

  /**
   * 🔥 USER REQUEST: Start independent animations on interim card
   * - Bounce animation: continuous (independent from other cards)
   * - Smoke bubbles: every 2.7 seconds
   * - Shimmer: every 2.0 seconds
   * - Glow: every 3.0 seconds
   * With proper cleanup to prevent memory leaks
   */
  private startGlowPulse(): void {
    // 🔥 CRITICAL FIX: Stop any existing intervals first to prevent duplicates
    if (this.glowPulseInterval !== null) {
      this.stopGlowPulse();
      return; // Already running; avoid restart storm from repeated renderBoards calls
    }
    
    // Find interim card
    const interimCard = document.querySelector('.journey-board-card.interim') as HTMLElement;
    if (!interimCard) {
      logger.warn('⚠️ No interim card found for glow pulse');
      return; // No interim card found
    }
    
    // 🔥 CRITICAL FIX: Check if bounce is already active on this card before starting
    const cardWrapper = interimCard.closest('.journey-board-card-wrapper') as HTMLElement | null;
    if (cardWrapper && (cardWrapper as any)._interimBounceActive) {
      logger.warn('⚠️ Interim bounce already active on card, skipping duplicate start');
    } else {
      // 🔥 USER REQUEST: Start independent bounce animation (continuous, independent from other cards)
      // Smoke bubbles are triggered DURING bounce animation (at 0.3s peak), not independently
      this.startInterimBounce(interimCard);
    }
    
    // 🔥 FIXED: Simplified interval that reliably triggers shimmer and glow every 3 seconds
    const triggerShimmerAndGlow = () => {
      const currentInterimCard = document.querySelector('.journey-board-card.interim') as HTMLElement;
      if (!currentInterimCard || this.renderDisposed) {
        logger.warn('⚠️ Interim card not found or disposed, stopping glow pulse');
        this.stopGlowPulse();
        return;
      }
      
      // Clear any pending timeouts from a previous tick
      const existingRemove = (currentInterimCard as any)._interimShimmerRemoveTimeout;
      if (existingRemove) {
        clearTimeout(existingRemove);
        (currentInterimCard as any)._interimShimmerRemoveTimeout = null;
      }
      const existingGlow = (currentInterimCard as any)._interimGlowTimeout;
      if (existingGlow) {
        clearTimeout(existingGlow);
        (currentInterimCard as any)._interimGlowTimeout = null;
      }
      const existingGlowCleanup = (currentInterimCard as any)._interimGlowCleanup;
      if (existingGlowCleanup) {
        clearTimeout(existingGlowCleanup);
        (currentInterimCard as any)._interimGlowCleanup = null;
      }
      
      // 1) Remove classes to reset animation state
      currentInterimCard.classList.remove('interim-shimmer-trigger');
      currentInterimCard.classList.remove('interim-glow-pulse');
      
      // 2) Force reflow so the browser sees the removal
      void currentInterimCard.offsetHeight;
      
      // 3) Use requestAnimationFrame to ensure styles are flushed
      requestAnimationFrame(() => {
        if (this.renderDisposed || !currentInterimCard.parentElement) {
          return;
        }
        
        // 4) Re-add shimmer class to restart animation - shimmer starts immediately
        currentInterimCard.classList.add('interim-shimmer-trigger');
        // logger.info('✨ Shimmer triggered on interim card');
        
        // 5) Glow 150ms later so shimmer is clearly visible BEFORE glow
        (currentInterimCard as any)._interimGlowTimeout = window.setTimeout(() => {
          if (!this.renderDisposed && currentInterimCard.parentElement) {
            this.triggerGlowPulse(currentInterimCard);
          }
        }, 150);
        
        // 6) Remove shimmer class AFTER animation completes (1.7s animation)
        (currentInterimCard as any)._interimShimmerRemoveTimeout = window.setTimeout(() => {
          if (!this.renderDisposed && currentInterimCard.parentElement) {
            currentInterimCard.classList.remove('interim-shimmer-trigger');
            // Force reflow so next add restarts cleanly
            void currentInterimCard.offsetHeight;
        // logger.info('✨ Shimmer stopped on interim card');
          }
          (currentInterimCard as any)._interimShimmerRemoveTimeout = null;
        }, 1700); // Remove after animation completes (1.7s)
      });
    };
    
    // 🔥 FIXED: Use setInterval for reliable timing (every 2.9 seconds - same as v102)
    // Trigger immediately first
    triggerShimmerAndGlow();
    
    // Then set up interval for subsequent triggers
    this.glowPulseInterval = window.setInterval(() => {
      triggerShimmerAndGlow();
    }, 2900) as any; // Convert to number for compatibility (2.9s like v102)
    
    logger.info('✅ Started independent bounce (with smoke bubbles at peak), shimmer (150ms before glow) + glow (2.9s interval) on interim card');
  }
  
  /**
   * Trigger single glow pulse animation on interim card
   * 🔥 FIXED: Simplified to ensure glow always triggers reliably on both mobile and iPad
   */
  private triggerGlowPulse(card: HTMLElement): void {
    // Remove class first to reset animation
    card.classList.remove('interim-glow-pulse');
    
    // Force reflow to ensure class removal is processed
    void card.offsetHeight;
    
    // 🔥 MOBILE FIX: Use double requestAnimationFrame for more reliable class application on mobile
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Add class to trigger animation
        card.classList.add('interim-glow-pulse');
        
        // Force style recalculation to ensure animation starts
        void card.offsetHeight;
      });
    });
  }
  
  // 🔥 USER REQUEST: triggerShimmer removed - shimmer is now handled directly in interval
  // 🔥 USER REQUEST: triggerSmokeBubbles removed - smoke bubbles are now triggered DURING bounce animation
  
  /**
   * 🔥 MEMORY LEAK FIX: Stop glow pulse, shimmer, smoke bubbles, and bounce intervals and cleanup
   * Made public so it can be called from ui-manager.ts during exit animation
   */
  public stopGlowPulse(): void {
    // Stop glow pulse interval
    if (this.glowPulseInterval !== null) {
      clearInterval(this.glowPulseInterval);
      this.glowPulseInterval = null;
      logger.info('✅ Stopped glow pulse interval');
    }
    
    // 🔥 USER REQUEST: Shimmer is now part of glow animation (no separate interval needed)
    // 🔥 USER REQUEST: Smoke bubbles are now part of bounce animation (no separate interval needed)
    
    // 🔥 USER REQUEST: Stop bounce animation
    const interimCards = document.querySelectorAll('.journey-board-card.interim');
    interimCards.forEach(card => {
      this.stopInterimBounce(card as HTMLElement);
    });
    
    // Remove glow pulse and shimmer classes from all interim cards
    interimCards.forEach(card => {
      const cardEl = card as HTMLElement;
      
      // Clear pending shimmer/glow timeouts so they don't fire after stop
      const pendingRemove = (cardEl as any)._interimShimmerRemoveTimeout;
      if (pendingRemove) {
        clearTimeout(pendingRemove);
        (cardEl as any)._interimShimmerRemoveTimeout = null;
      }
      const pendingGlow = (cardEl as any)._interimGlowTimeout;
      if (pendingGlow) {
        clearTimeout(pendingGlow);
        (cardEl as any)._interimGlowTimeout = null;
      }
      const pendingGlowCleanup = (cardEl as any)._interimGlowCleanup;
      if (pendingGlowCleanup) {
        clearTimeout(pendingGlowCleanup);
        (cardEl as any)._interimGlowCleanup = null;
      }
      
      cardEl.classList.remove('interim-glow-pulse');
      cardEl.classList.remove('interim-shimmer-trigger');
    });
  }

  /**
   * Clean up journey board elements when screen is hidden
   */
  public cleanup(): void {
    if (this.cleanupInProgress) return;
    this.cleanupInProgress = true;
    this.renderDisposed = true;
    try {
    
    // 🔥 MEMORY LEAK FIX: Cancel all tracked RAF calls
    this.cancelAllRAFs();
    
    // 🔥 MEMORY LEAK FIX: Stop glow pulse interval (this also stops interim bounce animations)
    this.stopGlowPulse();
    
    // 🔥 MEMORY FIX: Ensure all interim bounce animations are stopped
    // stopGlowPulse() should handle this, but double-check for safety
    const allInterimCards = document.querySelectorAll('.journey-board-card.interim');
    allInterimCards.forEach(card => {
      this.stopInterimBounce(card as HTMLElement);
      // Kill any remaining GSAP animations on card wrapper
      const cardWrapper = (card as HTMLElement).closest('.journey-board-card-wrapper') as HTMLElement | null;
      if (cardWrapper && typeof gsap !== 'undefined') {
        gsap.killTweensOf(cardWrapper);
      }
    });
    
    // Remove interaction listeners
    const scrollable = document.querySelector('.collectibles-scrollable') as HTMLElement;
    if (scrollable && (scrollable as any)._journeyIdleScrollHandler) {
      scrollable.removeEventListener('scroll', (scrollable as any)._journeyIdleScrollHandler);
      (scrollable as any)._journeyIdleScrollHandler = null;
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
        // Find all smoke containers (they are direct children of cards container)
        // Smoke containers don't have a specific class, but they contain smoke particles
        const allDivs = cardsContainer.querySelectorAll('div');
        allDivs.forEach(div => {
          const divEl = div as HTMLElement;
          // Check if this is a smoke container (has smoke particles as children)
          const hasSmokeParticles = divEl.querySelectorAll('div[style*="border-radius: 50%"]').length > 0;
          if (hasSmokeParticles && divEl.style.position === 'absolute') {
            // This is likely a smoke container - kill animations and remove
            if (typeof gsap !== 'undefined') {
              gsap.killTweensOf(divEl);
              // Kill animations on all children (smoke particles)
              const children = divEl.querySelectorAll('*');
              children.forEach(child => {
                gsap.killTweensOf(child);
              });
            }
            if (divEl.parentNode) {
              divEl.parentNode.removeChild(divEl);
            }
          }
        });
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
        if (cardWrapper && typeof gsap !== 'undefined') {
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
      
      logger.info(`✅ Killed GSAP tweens for ${cards.length} cards, stopped shimmer on ${interimCards.length} interim cards, and removed ${smokeParticles.length} smoke particles`);
    }
    
    // Remove background and cards containers from journey screen
    if (journeyScreen) {
      const bgContainer = journeyScreen.querySelector('.journey-bg-container');
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
      if (cardsContainer && cardsContainer.parentNode) {
        cardsContainer.parentNode.removeChild(cardsContainer);
      }
    }
    
    // Also check body (fallback cleanup)
    const bgFromBody = document.body.querySelector('.journey-bg-container');
    const cardsFromBody = document.body.querySelector('.journey-cards-container');
    
    if (bgFromBody && bgFromBody.parentNode) {
      bgFromBody.parentNode.removeChild(bgFromBody);
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
    // Initialize boards - only first board is unlocked by default
    // Other boards will be unlocked based on game progress (boardNumber)
    this.boards = [
      {
        id: 1,
        unlocked: false, // 🔥 USER REQUEST: Board 1 starts as interim (not unlocked)
        interim: true, // 🔥 USER REQUEST: Board 1 is interim by default - shows "Continue" CTA
        imagePath: this.getBoardImagePath(1),
        name: this.getBoardName(1),
      },
      {
        id: 2,
        unlocked: false, // Locked until board 2 is completed
        interim: false, // Will be set to true when board 1 is completed
        imagePath: this.getBoardImagePath(2),
        name: this.getBoardName(2),
      },
      {
        id: 3,
        unlocked: false,
        imagePath: this.getBoardImagePath(3),
        name: this.getBoardName(3),
      },
      {
        id: 4,
        unlocked: false,
        imagePath: this.getBoardImagePath(4),
        name: this.getBoardName(4),
      },
      {
        id: 5,
        unlocked: false,
        imagePath: this.getBoardImagePath(5),
        name: this.getBoardName(5),
      },
      {
        id: 6,
        unlocked: false,
        imagePath: this.getBoardImagePath(6),
        name: this.getBoardName(6),
      },
      {
        id: 7,
        unlocked: false,
        imagePath: this.getBoardImagePath(7),
        name: this.getBoardName(7),
      },
      {
        id: 8,
        unlocked: false,
        imagePath: this.getBoardImagePath(8),
        name: this.getBoardName(8),
      },
      {
        id: 9,
        unlocked: false,
        imagePath: this.getBoardImagePath(9),
        name: this.getBoardName(9),
      },
      {
        id: 10,
        unlocked: false,
        imagePath: this.getBoardImagePath(10),
        name: this.getBoardName(10),
      },
      {
        id: 11,
        unlocked: false,
        imagePath: this.getBoardImagePath(11),
        name: this.getBoardName(11),
      },
      {
        id: 12,
        unlocked: false,
        imagePath: this.getBoardImagePath(12),
        name: this.getBoardName(12),
      },
      {
        id: 13,
        unlocked: false,
        imagePath: this.getBoardImagePath(13),
        name: this.getBoardName(13),
      },
      {
        id: 14,
        unlocked: false,
        imagePath: this.getBoardImagePath(14),
        name: this.getBoardName(14),
      },
      {
        id: 15,
        unlocked: false,
        imagePath: this.getBoardImagePath(15),
        name: this.getBoardName(15),
      },
      {
        id: 16,
        unlocked: false,
        imagePath: this.getBoardImagePath(16),
        name: this.getBoardName(16),
      },
    ];
  }

  private getBoardImagePath(boardNumber: number): string {
    // Use existing collectible images for unlocked boards
    // Map board numbers to collectible image paths (01.png, 02.png, etc.)
    const paddedNumber = boardNumber.toString().padStart(2, '0');
    return `./assets/colelctibles/common/${paddedNumber}.png`;
  }

  private getBoardName(boardNumber: number): string {
    const names = [
      'FIRST DAY',
      'SO SPECIAL',
      'ALL STAR',
      'FLYING UP',
      'PLANNER',
      'PEACEFUL',
    ];
    return names[(boardNumber - 1) % names.length] || `Board ${boardNumber}`;
  }

  /**
   * 🔥 FINALNA VERZIJA: Pametna logika za scroll do interim kartice
   * 
   * PRAVILA (točno prema zahtjevu):
   * 1) Kad uđem u Journey (s homepage-a) → scrollaj do interim kartice
   * 2) Kad uđem u igru preko interim kartice i izađem (Exit) → vrati me gdje sam bio:
   *    - ako je interim kartica ostala u vidokrugu → NE radi ništa
   *    - ako je izašla iz viewporta → scrollaj do nje (bilo gore ili dolje)
   * 3) Kad izađem iz Journey screena i vratim se → 
   *    - ako je interim bila u viewportu → ne treba scroll
   *    - ako nije → animiraj scroll
   */
  private restoreOrScrollToInterimCard(): void {
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement;
      if (!scrollable) {
        logger.warn('⚠️ Scrollable container not found');
        return;
      }

      // Provjeri je li interim kartica trenutno u viewportu
      const interimCard = document.querySelector('.journey-board-card.interim') as HTMLElement;
      if (!interimCard) {
        logger.info('🗺️ No interim card found - skipping scroll');
        return;
      }

      const cardWrapper = interimCard.closest('.journey-board-card-wrapper') as HTMLElement;
      if (!cardWrapper) {
        logger.warn('⚠️ Interim card wrapper not found');
        return;
      }

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
            logger.info(`🗺️ Interim card is in viewport (${(visibilityRatio * 100).toFixed(0)}% visible) - no scroll needed`);
            
            // Osiguraj da je scroll enabled
            scrollable.style.touchAction = 'pan-y';
            scrollable.style.pointerEvents = '';
            return;
          }
          
          // Kartica NIJE u viewportu → scrollaj do nje
          logger.info(`🗺️ Interim card NOT in viewport (${(visibilityRatio * 100).toFixed(0)}% visible) - will scroll to it`);
          this.scrollToInterimCard();
        });
      });
    } catch (error) {
      logger.warn('⚠️ Failed to check interim card viewport:', error instanceof Error ? error.message : String(error));
      // Fallback: pokušaj scroll do interim
      this.scrollToInterimCard();
    }
  }

  /**
   * 🔥 USER REQUEST: Precise scroll to interim card with "zaletava" animation
   * Exact specification: anticipation → main travel → overshoot + settle
   * Card must be perfectly centered in viewport (50% width, 50% height)
   */
  private scrollToInterimCard(): void {
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement;
      if (!scrollable) {
        logger.warn('⚠️ Scrollable container not found for interim card scroll');
        return;
      }

      // Find interim card
      const interimCard = document.querySelector('.journey-board-card.interim') as HTMLElement;
      if (!interimCard) {
        logger.info('🗺️ No interim card found - skipping scroll');
        return;
      }

      const cardWrapper = interimCard.closest('.journey-board-card-wrapper') as HTMLElement;
      if (!cardWrapper) {
        logger.warn('⚠️ Interim card wrapper not found');
        return;
      }

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
              
              logger.warn(`⚠️ Interim card not yet visible, retrying scroll in 200ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
              (this as any)._scrollRetryCount = retryCount + 1;
              setTimeout(() => {
                this.scrollToInterimCard();
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
            logger.info(`🎁 Starting scroll animation to interim card. From: ${startScrollPosition}, To: ${finalScrollPosition}, Distance: ${scrollDistance}`);
          
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
                logger.info('✅ Scroll to interim card animation completed');
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
      logger.warn('⚠️ Failed to scroll to interim card:', error instanceof Error ? error.message : String(error));
    }
  }

  public renderBoards(): void {
    const container = document.getElementById('journey-boards-container');
    
    // 🔥 USER REQUEST: Ensure all locked cards have 100% opacity after rendering
    // This fixes any locked cards that might have opacity < 100%
    setTimeout(() => {
      const lockedCards = container?.querySelectorAll('.journey-board-card.locked') as NodeListOf<HTMLElement>;
      if (lockedCards) {
        lockedCards.forEach((card) => {
          const currentOpacity = window.getComputedStyle(card).opacity;
          const opacityValue = parseFloat(currentOpacity);
          if (isNaN(opacityValue) || opacityValue < 1.0) {
            card.style.opacity = '1';
            const boardId = card.getAttribute('data-board-id') || 'unknown';
            console.log(`✅ Set locked card ${boardId} opacity to 100% (was ${currentOpacity})`);
            logger.info(`✅ Set locked card ${boardId} opacity to 100% (was ${currentOpacity})`);
          }
        });
      }
    }, 100); // Small delay to ensure cards are rendered
    if (!container) {
      logger.warn('⚠️ Journey boards container not found');
      return;
    }
    
    // 🔥 FIX: Stop glow pulse before re-rendering to prevent duplicates
    if (this.glowPulseInterval !== null) {
      this.stopGlowPulse();
    }

    this.container = container;
    this.renderDisposed = false;
    
    // 🔥 CRITICAL FIX: Clean up previous observer if exists
    if ((container as any)._positionObserver) {
      try {
        (container as any)._positionObserver.disconnect();
        (container as any)._positionObserver = null;
      } catch (e) {
        console.warn('⚠️ Failed to disconnect previous position observer:', e);
      }
    }
    
    container.innerHTML = '';
    
    // 🔥 APP STORE FIX: Clean up previous fixed-positioned elements from body
    // Remove any existing background or cards containers from previous renders
    const existingBg = document.querySelector('.journey-bg-container');
    const existingCards = document.querySelector('.journey-cards-container');
    if (existingBg && existingBg.parentNode) {
      existingBg.parentNode.removeChild(existingBg);
    }
    if (existingCards && existingCards.parentNode) {
      existingCards.parentNode.removeChild(existingCards);
    }
    
    // Initialize journey debug buttons
    this.initJourneyButtons();

    // 🔥 APP STORE FIX: Use FIXED viewport-based positioning - NO dynamic calculations
    // Background and cards use position: fixed with viewport units (vw/vh)
    // This ensures identical positions on ALL devices (iPhone 13, 14, 17, etc.)
    this.renderBoardsFixed(container);
  }

  private renderBoardsFixed(container: HTMLElement): void {
    // 🔥 APP STORE FIX: Fixed background position using viewport units
    // Background starts at a fixed position from top of viewport
    // Based on iPhone 13/14 layout: header + section header + spacing = ~50px from top (moved up 150px)
    // Convert to viewport height units for consistency
    const FIXED_BG_TOP_VH = pxToVH(50, BASE_VIEWPORT_HEIGHT); // Fixed top position in vh (moved up 150px from original 200px)
    
    // 🔥 PRODUCTION READY: Verify image is in browser cache before rendering
    // This ensures instant display, no loading delay
    const img = new Image();
    const KNOWN_ASPECT_RATIO = 1.97; // Fallback aspect ratio
    
    // 🔥 CRITICAL: Set image src - if already in browser cache, onload fires immediately
    img.src = './assets/journey assets/1-17bg.png';
    
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
      const imageAspectRatio = img.height / img.width;
      const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
      const bgHeightPx = viewportWidth * imageAspectRatio; // Calculate height in pixels based on viewport width
      
      // 🔥 SCROLLABLE FIX: Put elements INSIDE journey-boards-container so they scroll with content
      // Calculate top offset in pixels for absolute positioning within container
      const FIXED_BG_TOP_PX = (FIXED_BG_TOP_VH / 100) * window.innerHeight;
      
      // Set container height to accommodate FULL background image height + top offset
      const containerHeightPx = bgHeightPx + FIXED_BG_TOP_PX;
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
      
      // Update cards container height
      const cardsContainer = container.querySelector('.journey-cards-container') as HTMLElement;
      if (cardsContainer) {
        cardsContainer.style.height = `${bgHeightPx}px`; // Match background height
      }
    };

    img.onerror = () => {
      if (this.renderDisposed || !document.body.contains(container)) return;
      // Fallback to known aspect ratio if image fails to load
      const imageAspectRatio = KNOWN_ASPECT_RATIO;
      const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
      const bgHeightPx = viewportWidth * imageAspectRatio;
      const FIXED_BG_TOP_PX = (FIXED_BG_TOP_VH / 100) * window.innerHeight;
      const containerHeightPx = bgHeightPx + FIXED_BG_TOP_PX;
      container.style.height = `${containerHeightPx}px`;
      container.style.minHeight = `${containerHeightPx}px`;
      container.style.overflow = 'visible';
    };
    
    // Use fallback aspect ratio for initial calculation
    const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
    const initialBgHeightPx = viewportWidth * KNOWN_ASPECT_RATIO;
    const FIXED_BG_TOP_PX = (FIXED_BG_TOP_VH / 100) * window.innerHeight;
    const initialContainerHeightPx = initialBgHeightPx + FIXED_BG_TOP_PX;
    
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
    bgContainer.style.backgroundImage = "url('./assets/journey assets/1-17bg.png')";
    bgContainer.style.backgroundSize = '100% auto'; // Maintain aspect ratio, full width
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
    
    // Debug: Verify edge-to-edge positioning (with delay to ensure styles are applied)
    setTimeout(() => {
      if (this.renderDisposed || !document.body.contains(container)) return;
      const computed = window.getComputedStyle(bgContainer);
      const containerRect = container.getBoundingClientRect();
      const bgRect = bgContainer.getBoundingClientRect();
      console.log('🎨 Background edge-to-edge check:', {
        containerLeft: containerRect.left,
        containerWidth: containerRect.width,
        bgLeft: bgRect.left,
        bgWidth: bgRect.width,
        viewportWidth: window.innerWidth,
        padLeft,
        padRight,
        inlineWidth: bgContainer.style.width,
        inlineLeft: bgContainer.style.left,
        computedWidth: computed.width,
        computedLeft: computed.left,
        isEdgeToEdge: bgRect.left <= 0 && bgRect.width >= window.innerWidth
      });
    }, 100);

    // Create cards container - also ABSOLUTE position within journey-boards-container
    // Set critical dynamic values inline (top, height) - static styles in CSS
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'journey-cards-container';
    // Critical dynamic values must be inline to ensure they're applied
    cardsContainer.style.top = `${FIXED_BG_TOP_PX}px`;
    cardsContainer.style.height = `${initialBgHeightPx}px`; // Will be updated when image loads
    
    // Append to container (journey-boards-container) so it scrolls with content
    container.appendChild(cardsContainer);

    // Render cards with FIXED viewport-based positions
    this.boards.forEach((board, index) => {
      const cardElement = this.createBoardCardFixed(board, index);
      cardsContainer.appendChild(cardElement);
    });
    
    // 🔥 CRITICAL: DO NOT start idle bounce animations here - they will interfere with enter animation
    // Idle bounce animations will be started AFTER enter animation completes
    // (moved to collectibles-manager.ts after animateCollectiblesScreenEnter completes)
    // This prevents jerky/laggy behavior on mobile when 16 cards try to animate during enter animation
    
    // Only setup listeners and glow pulse (non-animated effects)
    requestAnimationFrame(() => {
      // Add scroll and touch listeners (these don't interfere with enter animation)
      this.setupIdleInteractionListeners();
      
      // 🔥 USER REQUEST: Start continuous glow pulse on interim card (non-animated, doesn't interfere)
      this.startGlowPulse();
      
      // 🔥 CRITICAL FIX: Scroll to interim card is now handled AFTER enter animation completes
      // (moved to collectibles-manager.ts after animateCollectiblesScreenEnter call)
      // DO NOT scroll here - it will cause scroll during enter animation
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
    
    // Scroll listener
    const scrollHandler = () => {
      notifyThrottled();
      
      // 🔥 USER REQUEST: Check if interim card is in viewport during scroll
      // If user manually scrolls to interim card, save state to skip auto-scroll later
      const interimCard = document.querySelector('.journey-board-card.interim') as HTMLElement;
      if (interimCard) {
        const cardWrapper = interimCard.closest('.journey-board-card-wrapper') as HTMLElement;
        if (cardWrapper) {
          const cardRect = cardWrapper.getBoundingClientRect();
          const viewportH = window.innerHeight;
          const viewportW = window.innerWidth;
          const viewportCenterX = viewportW / 2;
          const viewportCenterY = viewportH / 2;
          
          // Check if card is visible in viewport
          const tolerance = 100;
          const isCardInViewport = 
            cardRect.top < viewportH + tolerance && 
            cardRect.bottom > -tolerance &&
            cardRect.left < viewportW + tolerance &&
            cardRect.right > -tolerance;
          
          // Check if card center is reasonably close to viewport center
          const cardCenterX = cardRect.left + cardRect.width / 2;
          const cardCenterY = cardRect.top + cardRect.height / 2;
          const centerDistanceX = Math.abs(cardCenterX - viewportCenterX);
          const centerDistanceY = Math.abs(cardCenterY - viewportCenterY);
          const isCardReasonablyCentered = centerDistanceX < 150 && centerDistanceY < 150;
          
          // If card is in viewport and reasonably centered, save state
          if (isCardInViewport && isCardReasonablyCentered) {
            try {
              localStorage.setItem('__ccInterimCardInViewport', 'true');
              logger.info('🗺️ Interim card scrolled into viewport - saved state');
            } catch (e) {
              // Ignore errors
            }
          }
        }
      }
    };
    scrollable.addEventListener('scroll', scrollHandler, { passive: true });
    
    // Touch/click listeners on cards container
    const cardsContainer = document.querySelector('.journey-cards-container') as HTMLElement;
    if (cardsContainer) {
      const touchHandler = () => notifyThrottled();
      cardsContainer.addEventListener('touchstart', touchHandler, { passive: true });
      cardsContainer.addEventListener('touchmove', touchHandler, { passive: true });
      // Store handler for cleanup
      (cardsContainer as any)._journeyIdleTouchHandler = touchHandler;
    }
    
    // Store scroll handler for cleanup
    (scrollable as any)._journeyIdleScrollHandler = scrollHandler;
  }

  private createBoardCardFixed(board: JourneyBoard, index: number): HTMLElement {
    const position = CARD_POSITIONS[index] || { x: pxToPercent(24), top: pxToPercentTop(24), rotation: 5, width: STANDARD_CARD_WIDTH, height: 150 };
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'journey-board-card-wrapper';
    
    // 🔥 SCROLLABLE FIX: Use pixel-based positioning within scrollable container
    // Background starts at FIXED_BG_TOP_PX, so we add card's top offset to that
    const FIXED_BG_TOP_PX = (pxToVH(50, BASE_VIEWPORT_HEIGHT) / 100) * window.innerHeight; // Moved up 150px from original 200px
    
    // Calculate background height in pixels
    const viewportWidth = window.innerWidth || BASE_VIEWPORT_WIDTH;
    const imageAspectRatio = 1.97; // Known aspect ratio
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
    
    // Detect iPad screen size (769px - 1024px width) - must be before any device-specific logic
    const isIPad = window.innerWidth >= 769 && window.innerWidth <= 1024;
    
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
    let topPx = FIXED_BG_TOP_PX + (topPercent / 100) * bgHeightPx;
    
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
    
    // 🔥 iPad FIX: Unlocked kartice (kliknute i nekliknute) su iste veličine kao interim kartice
    const baseScaleFactor = isIPad ? 1.76 : 1; // 176% base scale for iPad
    // Unlocked kartice (kliknute i nekliknute) trebaju biti iste veličine kao interim kartice
    // Interim kartice su već na 1.76, tako da unlocked kartice također trebaju biti na 1.76
    const scaleFactor = isIPad ? 1.76 : 1; // 176% scale for all cards on iPad (unlocked, locked, interim)
    
    // Set absolute position using pixels
    cardWrapper.style.position = 'absolute';
    
    // Set card dimensions in pixels (keep original size, scale is applied via transform)
    const cardWidth = position.width || STANDARD_CARD_WIDTH;
    const cardHeight = position.height || 150;
    
    // 🔥 FIX: Reduce wrapper dimensions consistently by 8px on each side to prevent ghost container
    // This maintains aspect ratio and prevents visual issues
    // Shadow is still visible because it extends from the card inside
    const wrapperWidth = cardWidth - 16; // 8px sa svake strane (lijeva i desna)
    const wrapperHeight = cardHeight - 16; // 8px sa svake strane (gore i dolje)
    const wrapperLeftOffset = 8; // 8px offset za lijevu stranu
    const wrapperTopOffset = 8; // 8px offset za gornju stranu
    
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
    card.className = `journey-board-card ${isUnlocked ? 'unlocked' : isInterim ? 'interim' : 'locked'}`;
    card.dataset.boardId = board.id.toString();
    card.dataset.boardNumber = board.id.toString().padStart(2, '0');
    
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
      
      const image = document.createElement('img');
      // 🔥 PRODUCTION READY: Set src - if already in browser cache, image displays instantly
      image.src = board.imagePath || '';
      image.alt = board.name || `Board ${board.id}`;
      image.className = 'journey-board-image';
      // Eager-load card images once in DOM to ensure they appear reliably
      image.loading = 'eager';
      (image as any).fetchPriority = 'high';
      // 🔥 iOS FIX: Prevent deep touch (long press) and image dragging
      image.draggable = false; // Prevent HTML5 drag
      image.setAttribute('draggable', 'false'); // Ensure draggable is false
      card.appendChild(image);
      
      // 🔥 USER REQUEST: Add ribbon for newly unlocked (not viewed) cards
      if (!isInterim && !isViewed) {
        const ribbon = document.createElement('img');
        ribbon.src = './assets/journey assets/orange-ribbon.png';
        ribbon.alt = 'New';
        ribbon.className = 'journey-card-ribbon';
        ribbon.draggable = false;
        ribbon.setAttribute('draggable', 'false');
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
          e.preventDefault();
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

        logger.info(`🖱️🖱️🖱️ CARD CLICKED FOR BOARD ${board.id}`);
        logger.info(`🔍 Board data on click:`, {
          id: board.id,
          name: board.name,
          imagePath: board.imagePath,
          interim: board.interim,
          unlocked: board.unlocked
        });
        // Notify interaction to stop idle animations
        if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction === 'function') {
          JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction();
        }

        const cardEl = card as HTMLElement;
        if (!cardEl) {
        this.openBoardDetails(board).catch((error) => {
          logger.error('❌ Failed to open board details:', error);
        });
          return;
        }

        // Prevent double-tap re-entry while animation is running
        if ((cardEl as any)._openingDetail === true) {
          return;
        }
        (cardEl as any)._openingDetail = true;

        const journeyExitPromise = this.startJourneyExitAnimation();

        // 🔥 USER REQUEST: Tap feedback animation (pop out + pop in), screen shake, haptic
        // Total duration: 300ms, immediate on tap
        const totalMs = 300;
        const downMs = 90;
        const upMs = 120;
        const settleMs = totalMs - downMs - upMs; // 90ms
        const rotationDeg = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 6); // up to 8deg

        try {
          // Haptic feedback
          if (typeof (window as any).triggerHapticImpact === 'function') {
            (window as any).triggerHapticImpact('medium');
          }

          // Screen shake on Journey screen (like explosion feel)
          const shakeTarget =
            document.getElementById('journey-screen') ||
            document.getElementById('home') ||
            document.body;
          if (shakeTarget) {
            try { gsap.killTweensOf(shakeTarget); } catch {}
            const shakeTl = trackTimeline({
              onComplete: () => {
                try { gsap.set(shakeTarget, { x: 0, y: 0 }); } catch {}
              }
            });
            const strength = 10;
            const steps = 6;
            const dt = 0.18 / steps;
            for (let i = 0; i < steps; i++) {
              const p = 1 - (i / steps);
              const amp = strength * p;
              const dx = (Math.random() * 2 - 1) * amp;
              const dy = (Math.random() * 2 - 1) * amp;
              shakeTl.to(shakeTarget, { x: dx, y: dy, duration: dt, ease: 'sine.inOut' }, i * dt);
            }
          }

          // Card pop animation (scale down, pop up, settle)
          cardEl.style.transformOrigin = '50% 50%';
          try { gsap.killTweensOf(cardEl); } catch {}
          const tl = trackTimeline({
            onComplete: () => {
              (cardEl as any)._openingDetail = false;
              logger.info(`🚀🚀🚀 CALLING openBoardDetails FOR BOARD ${board.id}`);
              this.openBoardDetails(board, true, journeyExitPromise).catch((error) => {
                logger.error('❌ Failed to open board details:', error);
              });
            }
          });
          tl.to(cardEl, { scale: 0.7, rotation: 0, duration: downMs / 1000, ease: 'power2.out' })
            .to(cardEl, { scale: 1.69, rotation: rotationDeg, duration: upMs / 1000, ease: 'power2.out' })
            .to(cardEl, { scale: 1.0, rotation: 0, duration: settleMs / 1000, ease: 'power2.inOut' });
        } catch (error) {
          (cardEl as any)._openingDetail = false;
          logger.warn('⚠️ Tap animation failed, opening detail modal immediately:', error);
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
      image.alt = `Board ${board.id} (interim)`;
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
          e.preventDefault();
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

        logger.info(`🖱️🖱️🖱️ INTERIM CARD TAPPED FOR BOARD ${board.id}`);
        
        // Notify interaction to stop idle animations
        if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction === 'function') {
          JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction();
        }

        const cardEl = card as HTMLElement;
        if (!cardEl) {
          // 🔥 CRITICAL FIX: Check hearts BEFORE calling continueFromInterimBoard (fallback path)
          try {
            const { heartsSystem } = await import('./hearts-system.js');
            if (!heartsSystem.hasHearts()) {
              logger.info('💔 No hearts available (fallback path) - showing hearts bottom sheet');
              const { showHeartsModal } = await import('./hearts-bottom-sheet.js');
              showHeartsModal();
              return; // Stay on Journey screen!
            }
          } catch (error) {
            logger.warn('⚠️ Failed to check hearts (fallback), continuing anyway:', error);
          }
          
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

        // 🔥 CRITICAL FIX: Check hearts BEFORE starting Journey exit animation!
        // If no hearts, show hearts bottom sheet and DON'T exit Journey screen
        try {
          const { heartsSystem } = await import('./hearts-system.js');
          if (!heartsSystem.hasHearts()) {
            (cardEl as any)._openingGame = false; // Reset flag
            logger.info('💔 No hearts available - showing hearts bottom sheet, NOT exiting Journey screen');
            const { showHeartsModal } = await import('./hearts-bottom-sheet.js');
            showHeartsModal();
            return; // Stay on Journey screen!
          }
        } catch (error) {
          logger.warn('⚠️ Failed to check hearts, continuing anyway:', error);
        }

        const journeyExitPromise = this.startJourneyExitAnimation();

        // 🔥 USER REQUEST: Tap feedback animation (pop out + pop in), screen shake, haptic
        // Total duration: 300ms, immediate on tap
        const totalMs = 300;
        const downMs = 90;
        const upMs = 120;
        const settleMs = totalMs - downMs - upMs; // 90ms
        const rotationDeg = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 6); // up to 8deg

        try {
          // Haptic feedback
          if (typeof (window as any).triggerHapticImpact === 'function') {
            (window as any).triggerHapticImpact('medium');
          }

          // Screen shake on Journey screen (like explosion feel)
          const shakeTarget =
            document.getElementById('journey-screen') ||
            document.getElementById('home') ||
            document.body;
          if (shakeTarget) {
            try { gsap.killTweensOf(shakeTarget); } catch {}
            const shakeTl = trackTimeline({
              onComplete: () => {
                try { gsap.set(shakeTarget, { x: 0, y: 0 }); } catch {}
              }
            });
            const strength = 10;
            const steps = 6;
            const dt = 0.18 / steps;
            for (let i = 0; i < steps; i++) {
              const p = 1 - (i / steps);
              const amp = strength * p;
              const dx = (Math.random() * 2 - 1) * amp;
              const dy = (Math.random() * 2 - 1) * amp;
              shakeTl.to(shakeTarget, { x: dx, y: dy, duration: dt, ease: 'sine.inOut' }, i * dt);
            }
          }

          // Card pop animation (scale down, pop up, settle)
          // 🔥 CRITICAL: Animate the same target as the interim bounce (wrapper), for visible effect
          const cardWrapper = cardEl.closest('.journey-board-card-wrapper') as HTMLElement | null;
          const animTarget = cardWrapper || cardEl;

          // Stop interim bounce so it doesn't fight with tap animation
          try { this.stopInterimBounce(cardEl); } catch {}

          // 🔥 CRITICAL: Preserve wrapper transforms; only reset transform on card itself
          if (animTarget === cardEl) {
            animTarget.style.transform = 'none';
          }
          animTarget.style.transformOrigin = '50% 50%';
          animTarget.style.willChange = 'transform';
          try { gsap.killTweensOf(animTarget); } catch {}
          
          // 🔥 USER REQUEST: Match exact animation from regular cards (0.7 -> 1.69 -> 1.0)
          const tl = trackTimeline({
            onComplete: () => {
              (cardEl as any)._openingGame = false;
              // Reset will-change
              animTarget.style.willChange = 'auto';
              logger.info(`🚀🚀🚀 CALLING continueFromInterimBoard FOR BOARD ${board.id}`);
              this.continueFromInterimBoard(board, journeyExitPromise).catch((error) => {
                logger.error('❌ Failed to continue from interim board:', error);
              });
            }
          });
          tl.to(animTarget, { 
            scale: 0.7, 
            rotation: 0, 
            duration: downMs / 1000, 
            ease: 'power2.out',
            force3D: true 
          })
          .to(animTarget, { 
            scale: 1.28, 
            rotation: rotationDeg, 
            duration: upMs / 1000, 
            ease: 'power2.out',
            force3D: true 
          })
          .to(animTarget, { 
            scale: 1.0, 
            rotation: 0, 
            duration: settleMs / 1000, 
            ease: 'power2.inOut',
            force3D: true 
          });
        } catch (error) {
          (cardEl as any)._openingGame = false;
          logger.warn('⚠️ Interim card tap animation failed, continuing game immediately:', error);
          this.continueFromInterimBoard(board, journeyExitPromise).catch((err) => {
            logger.error('❌ Failed to continue from interim board:', err);
          });
        }
      };
      
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
      const lockedContainer = document.createElement('div');
      lockedContainer.className = 'journey-board-locked-container';
      
      // Add empty card image
      const image = document.createElement('img');
      // 🔥 PRODUCTION READY: Set src - if already in browser cache, image displays instantly
      image.src = './assets/colelctibles/journey-card-empty.png';
      image.alt = `Board ${board.id} (locked)`;
      image.className = 'journey-board-empty-image';
      // 🔥 CRITICAL: Set loading="eager" and fetchpriority="high" for instant display
      image.loading = 'eager';
      (image as any).fetchPriority = 'high';
      // 🔥 iOS FIX: Prevent deep touch (long press) and image dragging
      image.draggable = false;
      image.setAttribute('draggable', 'false');
      lockedContainer.appendChild(image);
      
      // Add number overlay on top of image
      const number = document.createElement('div');
      number.className = 'journey-board-number';
      number.textContent = board.id.toString().padStart(2, '0');
      lockedContainer.appendChild(number);
      
      // 🔥 iOS FIX: Prevent long press and context menu on locked cards
      let longPressTimer: number | null = null;
      const preventLongPress = (e: TouchEvent) => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        longPressTimer = window.setTimeout(() => {
          e.preventDefault();
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
    
    // 🔥 iPad FIX: Store original transform for interim cards immediately after rendering
    // This ensures scale is preserved even if animation hasn't started yet
    if (isInterim) {
      const currentTransform = cardWrapper.style.transform || '';
      if (currentTransform && !(cardWrapper as any)._originalTransform) {
        (cardWrapper as any)._originalTransform = currentTransform;
        logger.info('✅ Stored original transform for interim card:', currentTransform);
      }
    }
    
    return cardWrapper;
  }

  /**
   * 🔥 JOURNEY PROGRESSION: Handle Journey board tap - start game from this board
   */
  private async onJourneyBoardTap(boardId: number): Promise<void> {
    logger.info(`🗺️ Journey board ${boardId} tapped - starting game`);
    
    try {
      // 🔥 CRITICAL FIX: Stop Journey card idle bounce animations BEFORE exit animation
      if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
        JOURNEY_CARD_IDLE_BOUNCE.stop();
        logger.info('✅ Journey card idle bounce stopped');
      }
      
      // 🔥 CRITICAL FIX: Play Journey screen exit animation BEFORE starting game
      // This ensures user sees smooth transition and board game animations have proper timing
      logger.info('🎬 Starting Journey screen exit animation...');
      const { animateCollectiblesScreenExit } = await import('../ui/collectibles-animations.js');
      await animateCollectiblesScreenExit();
      logger.info('✅ Journey screen exit animation completed');
      
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
        swipeableContainer.removeEventListener('mousedown', handlers.mouseDown);
        swipeableContainer.removeEventListener('mousemove', handlers.mouseMove);
        swipeableContainer.removeEventListener('mouseup', handlers.mouseUp);
        swipeableContainer.removeEventListener('mouseleave', handlers.mouseUp);
        
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
        // Step 1: Capture current computed transform (includes animation position)
        const computedStyle = window.getComputedStyle(detailImageEl);
        const currentTransform = computedStyle.transform;
        
        // Step 2: Apply computed transform as inline style to "freeze" at current position
        // This ensures the card stays where it is visually
        if (currentTransform && currentTransform !== 'none') {
          detailImageEl.style.transform = currentTransform;
          logger.info('🎬 Card frozen at current animated position:', currentTransform);
        }
        
        // Step 3: NOW stop the CSS animation (card stays frozen at captured position)
        detailImageEl.style.animation = 'none';
        detailImageEl.style.animationPlayState = 'paused';
        
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
      const playButton = modal.querySelector('#board-detail-play-button') as HTMLElement || document.getElementById('board-detail-play-button') as HTMLElement;
      
      // 🔥 USER REQUEST: Add animations for stats section, icons, and description text
      const detailStatsSection = modal.querySelector('.detail-section-stats') as HTMLElement;
      const detailStatIcons = modal.querySelectorAll('.detail-stat-icon') as NodeListOf<HTMLElement>;
      const detailStatIconsArray = Array.from(detailStatIcons);

      // 🔥 USER REQUEST: Content elements array (EXCLUDE PLAY button - it's handled separately)
      // 🔥 CRITICAL: EXCLUDE detailStatsSection - it contains stat items that animate individually
      // 🔥 CRITICAL: EXCLUDE detailImage - it's animated separately to preserve frozen transform position
      const otherContentElements = [
        detailDescription,
        ...detailStatIconsArray,
        // detailStatsSection, // 🔥 REMOVED: Stats section is NOT animated here - stat items animate individually
        detailRarityBadgeContainer
        // detailImage - 🔥 REMOVED: Card is animated separately to prevent snap-back
      ].filter(el => el !== null) as HTMLElement[];
      
      // 🔥 DEBUG: Log PLAY button state
      if (playButton) {
        logger.info(`✅ PLAY button found for exit animation: id=${playButton.id}, parent=${playButton.parentNode?.nodeName}`);
      } else {
        logger.warn(`⚠️ PLAY button NOT found for exit animation!`);
      }
      
      // 🔥 USER REQUEST: STEP 1: PLAY button exits FIRST (immediately, no delay)
      // This gives instant feedback when user clicks Play
      // 🔥 USER REQUEST: Use EXACT SAME animation as homepage slider CTA button
      let playButtonExitDelay = 0; // Start immediately (FIRST)
      let playButtonExitDuration = 0.65; // CSS animation duration (same as homepage)
      
      if (playButton) {
        // 🔥 CRITICAL: Move PLAY button to body BEFORE starting exit animation
        // This ensures it remains visible when modal is hidden
        if (playButton.parentNode === modal) {
          document.body.appendChild(playButton);
          logger.info('🎮 PLAY button moved to body before exit animation');
        }
        
        // 🔥 USER REQUEST: Copy EXACT animation from homepage slider CTA button
        // Homepage uses CSS: .animate-exit { transform: translateY(20px) scale(0); transition: 0.65s cubic-bezier(...); }
        // We use same CSS class for consistency!
        playButton.classList.remove('animate-enter', 'animate-enter-initial', 'animate-reset');
        playButton.style.removeProperty('transform');
        playButton.style.removeProperty('transition');
        void playButton.offsetHeight; // Force reflow
        
        // Add animate-exit class (same as homepage slider CTA)
        playButton.classList.add('animate-exit');
        
        // Remove button after animation completes (0.65s)
        setTimeout(() => {
          if (playButton && playButton.parentNode) {
            playButton.remove();
            logger.info('🎮 PLAY button removed after CSS exit animation');
          }
        }, 650); // 0.65s animation duration
        
        logger.info(`🎮 PLAY button CSS exit animation started at 0ms (FIRST, duration: 0.65s, EXACT same as homepage CTA)`);
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

          // 🔥 CRITICAL: Animate parent with onUpdate to sync children (same pattern as enter)
          trackTween(child, {
            scale: 0,
            opacity: 0,
            duration: 0.4,
            ease: 'back.in(1.7)',
            delay: contentStartDelay + 0.05 + i * 0.05,
            force3D: true,
            overwrite: true, // 🔥 CRITICAL: Prevent duplicate animations
            onUpdate: () => {
              // 🔥 CRITICAL: Sync children opacity with parent during exit animation
              const currentOpacity = gsap.getProperty(child, 'opacity') as number;
              const childIcon = child.querySelector('.detail-stat-icon, .stat-icon') as HTMLElement | null;
              const childValue = child.querySelector('.detail-stat-value, .stat-value') as HTMLElement | null;
              const childLabel = child.querySelector('.detail-stat-label, .stat-label') as HTMLElement | null;
              const childContent = child.querySelector('.detail-stat-content, .stat-content') as HTMLElement | null;
              
              if (childIcon) {
                childIcon.style.opacity = currentOpacity.toString();
              }
              if (childValue) {
                childValue.style.opacity = currentOpacity.toString();
              }
              if (childLabel) {
                childLabel.style.opacity = currentOpacity.toString();
              }
              if (childContent) {
                childContent.style.opacity = currentOpacity.toString();
              }
            },
            onComplete: () => {
              // 🔥 CRITICAL: Ensure children are hidden after animation
              const childIcon = child.querySelector('.detail-stat-icon, .stat-icon') as HTMLElement | null;
              const childValue = child.querySelector('.detail-stat-value, .stat-value') as HTMLElement | null;
              const childLabel = child.querySelector('.detail-stat-label, .stat-label') as HTMLElement | null;
              const childContent = child.querySelector('.detail-stat-content, .stat-content') as HTMLElement | null;
              
              if (childIcon) {
                childIcon.style.opacity = '0';
                childIcon.style.visibility = 'hidden';
              }
              if (childValue) {
                childValue.style.opacity = '0';
                childValue.style.visibility = 'hidden';
              }
              if (childLabel) {
                childLabel.style.opacity = '0';
                childLabel.style.visibility = 'hidden';
              }
              if (childContent) {
                childContent.style.opacity = '0';
                childContent.style.visibility = 'hidden';
              }
            }
          });
        });
      }

      // STEP 3: Header LAST (includes X, title, divider - animated as group, same as settings screen)
      // 🔥 CRITICAL: Animate header EXACTLY like enter animation - as parent element, not child elements
      const lastDelay = contentStartDelay + (otherContentElements.length > 0 ? (otherContentElements.length * 0.05) : 0);
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
          delay: lastDelay + 0.05,
          force3D: true
        });
        logger.info(`📊 Header pop-out - LAST (X, title, divider animate together as group at ${((lastDelay + 0.05) * 1000).toFixed(0)}ms)`);
      }

      // Calculate total animation duration (content elements + stats + PLAY button + header)
      // 🔥 CRITICAL: Include ALL exit animations in total duration (stats, PLAY button, header)
      const playButtonEndTime = playButtonExitDelay + playButtonExitDuration; // When PLAY button animation ends
      const headerEndTime = lastDelay + 0.05 + 0.4; // When header animation ends
      // 🔥 BUG FIX: Include stats exit animations in total duration calculation
      const totalDuration = Math.max(playButtonEndTime, headerEndTime, statsExitEndTime) * 1000 + 100; // Use the longest one + 100ms buffer
      logger.info(`⏱️ Exit animation durations - Stats: ${(statsExitEndTime * 1000).toFixed(0)}ms, PLAY: ${(playButtonEndTime * 1000).toFixed(0)}ms, Header: ${(headerEndTime * 1000).toFixed(0)}ms, Total: ${totalDuration.toFixed(0)}ms`);

      // Wait for exit animation to complete
      setTimeout(() => {
        // 🔥 MEMORY LEAK FIX: Full cleanup of detail image element
        const detailImageEl = modal.querySelector('#detail-card-image') as HTMLElement;
        if (detailImageEl) {
          // Stop CSS animations
          detailImageEl.style.animation = 'none';
          detailImageEl.style.animationPlayState = 'paused';
          // 🔥 CLEANUP: Reset frozen transform from smooth transition fix
          detailImageEl.style.removeProperty('transform');
          // Kill any GSAP animations on this element
          gsap.killTweensOf(detailImageEl);
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
        
        // 🔥 NOTE: PLAY button is removed by GSAP animation's onComplete callback
        // No need for setTimeout - GSAP handles cleanup automatically
        
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
      // 🔥 REMOVED: Hearts check moved to BEFORE Journey exit animation (in handleCardTap)
      // This prevents showing hearts bottom sheet on empty screen with Journey already exited
      // Hearts are now checked BEFORE startJourneyExitAnimation() is called
      
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
      
      // 🔥 CRITICAL FIX: Add small delay to ensure exit animation fully completes and browser can render
      // This prevents lag when starting board transition screen immediately after exit animation
      await new Promise(resolve => setTimeout(resolve, 100));
      logger.info('✅ Delay after exit animation - ensuring smooth transition');
      
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
      await this.openBoardDetails(board, skipJourneyExit);
    } else {
      logger.warn(`⚠️ Board ${boardId} not found`);
    }
  }

  // 🔥 FIGMA DESIGN: Simple swipe - stats+card+text visible, swipe to buttons
  public initDetailModalSwipe(container: HTMLElement): void {
    if (!container) return;
    
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
    
    quickSetX(0);
    container.style.willChange = 'transform';
    container.style.cursor = 'grab';
    
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
      
      quickSetX(newX);
      currentX = newX;
      
      lastX = currentTouchX;
      lastTime = currentTime;
      e.preventDefault();
    };
    
    const handleTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
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
      
      quickSetX(newX);
      currentX = newX;
      
      lastX = currentMouseX;
      lastTime = currentTime;
      e.preventDefault();
    };
    
    const handleMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
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
          // 🔥 USER REQUEST: Update text margin after mouse swipe completes
          const finalIndex = getNearestSnapIndex(currentX);
          updateTextMarginForPosition(finalIndex);
        }
      });
    };
    
    // Attach event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
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
          // 🔥 USER REQUEST: Update text margin after slide completes
          const finalIndex = getNearestSnapIndex(currentX);
          updateTextMarginForPosition(finalIndex);
        }
      });
    };
    
    // Store handlers for cleanup
    (container as any).__detailSwipeHandlers = {
      touchStart: handleTouchStart,
      touchMove: handleTouchMove,
      touchEnd: handleTouchEnd,
      mouseDown: handleMouseDown,
      mouseMove: handleMouseMove,
      mouseUp: handleMouseUp,
      quickSetX: quickSetX,
      slideToPosition: slideToPosition,
      snapPoints: snapPoints,
      getIsDragging: () => isDragging // Expose isDragging state
    };
    
    logger.info('✅ Apple style GSAP smooth swipe initialized');
  }

  private async openBoardDetails(
    board: JourneyBoard,
    skipJourneyExit: boolean = false,
    journeyExitPromise?: Promise<void>
  ): Promise<void> {
    // 🔥 USER REQUEST: Save Journey scroll position BEFORE opening detail modal (restore on close)
    try {
      const scrollable = document.querySelector('#journey-screen .collectibles-scrollable') as HTMLElement | null;
      if (scrollable) {
        (window as any).__ccJourneyScrollTop = scrollable.scrollTop;
        try { localStorage.setItem('__ccJourneyScrollTop', String(scrollable.scrollTop)); } catch {}
        logger.info(`🗺️ Saved Journey scroll position before detail modal: ${scrollable.scrollTop}`);
      }
    } catch {}

    // 🔥 CRITICAL: Clear interim flags when opening REGULAR (non-interim) board
    // Prevents stale state from interim session when switching back to regular cards → crash on exit
    if (!board.interim) {
      (window as any).__ccFromInterimBoard = false;
      (window as any).__ccIsInterimBoard = false;
      try { localStorage.removeItem('__ccFromInterimBoard'); } catch {}
      logger.info('🧹 Cleared interim flags when opening regular board detail modal');
    }
    
    // 🔥 MEMORY LEAK FIX: Stop any existing detail image idle animation from previous modal
    const existingModal = document.getElementById('collectibles-detail-modal') as HTMLElement;
    if (existingModal) {
      const existingImage = existingModal.querySelector('#detail-card-image') as HTMLElement;
      if (existingImage) {
        existingImage.style.animation = 'none';
        existingImage.style.animationPlayState = 'paused';
        logger.info('🧹 Stopped existing detail image idle animation before opening new modal');
      }
    }
    // 🔥 PERFORMANCE FIX: Defer preloads so first detail enter animation stays smooth.
    // We still warm assets before PLAY in most cases, but we never block UI opening.
    const preloadAfterEnterDelayMs = 550;
    window.setTimeout(() => {
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
      void import('pixi.js')
        .then(({ Assets }) => {
          const gameAssets = [
            './assets/tile.png',
            './assets/tile_numbers.png',
            './assets/tile_numbers2.png',
            './assets/tile_numbers3.png',
            './assets/tile_numbers4.png',
            './assets/wild.png',
            './assets/wild@2x.png',
            './assets/wild@3x.png',
            './assets/wild-magnet.png',
            './assets/wild-juice.png',
            './assets/wild-juice@2x.png',
            './assets/wild-juice@3x.png',
            './assets/shop/explosion pack/tnt.png',
            './assets/shop/explosion pack/tnt@2x.png',
            './assets/shop/explosion pack/tnt@3x.png',
          ];

          logger.info(`🎮 Preloading ${gameAssets.length} game assets for board ${board.id}...`);

          return Promise.allSettled(
            gameAssets.map(async (assetPath) => {
              try {
                const existing = Assets.get(assetPath);
                if (existing) return;
                if (!isAssetAliasRegistered(assetPath) && (typeof Assets.cache?.has !== 'function' || !Assets.cache.has(assetPath))) {
                  try {
                    Assets.add({ alias: assetPath, src: assetPath });
                    markAssetAliasRegistered(assetPath);
                  } catch {
                    // Already registered.
                  }
                }
                await Assets.load(assetPath);
                logger.debug(`✅ Loaded ${assetPath} into PIXI Assets cache`);
              } catch (err) {
                logger.warn(`⚠️ Failed to preload ${assetPath}:`, err);
              }
            })
          );
        })
        .then(() => {
          logger.info(`✅ All game assets preloaded for board ${board.id}`);
        })
        .catch((error) => {
          logger.warn('⚠️ Failed to preload game assets:', error);
        });
    }, preloadAfterEnterDelayMs);
    
    // 🔥 USER REQUEST: First exit animation on Journey screen (if visible), then enter animation on detail modal
    console.log(`🎬🎬🎬 OPENING BOARD DETAILS FOR BOARD ${board.id}${skipJourneyExit ? ' (skipping Journey exit)' : ' - exit Journey screen first'}`);
    logger.info(`🎬🎬🎬 OPENING BOARD DETAILS FOR BOARD ${board.id}${skipJourneyExit ? ' (skipping Journey exit)' : ' - exit Journey screen first'}`);
    console.log(`🔍 Board data:`, {
      id: board.id,
      name: board.name,
      imagePath: board.imagePath,
      interim: board.interim,
      unlocked: board.unlocked
    });
    logger.info(`🔍 Board data:`, {
      id: board.id,
      name: board.name,
      imagePath: board.imagePath,
      interim: board.interim,
      unlocked: board.unlocked
    });
    
    // 🔥 USER REQUEST: Wait for Journey exit animation to complete BEFORE opening detail modal
    // This ensures smooth transition: Journey exits → THEN detail modal enters
    if (!skipJourneyExit) {
      console.log('⏱️ Waiting for Journey exit animation to complete before opening detail modal...');
      await this.startJourneyExitAnimation();
      console.log('✅ Journey exit animation complete');
      
      // 🔥 CRITICAL FIX: Add small delay to ensure exit animation fully completes and browser can render
      // This prevents lag when opening detail modal immediately after exit animation
      await new Promise(resolve => setTimeout(resolve, 100));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      console.log('✅ Delay after exit animation - opening detail modal now');
    } else if (journeyExitPromise) {
      console.log('⏱️ Waiting for Journey exit promise to complete...');
      await journeyExitPromise;
      console.log('✅ Journey exit promise resolved');
      
      // 🔥 CRITICAL FIX: Add small delay to ensure exit animation fully completes
      await new Promise(resolve => setTimeout(resolve, 100));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      console.log('✅ Delay after exit promise - opening detail modal now');
    }
    
    // Step 2: Now open detail modal with enter animation
    const detailModal = document.getElementById('collectibles-detail-modal');
    if (detailModal) {
      // 🔥 SAFETY: Ensure modal is interactive even after previous exit
      (detailModal as any).__detailModalExiting = false;
      (detailModal as HTMLElement).style.pointerEvents = 'auto';
      
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
          console.log(`🔄 Reset stats button clicked for board ${board.id}`);
          
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
                  console.log('📊 Score bottom sheet is open - refreshing stats after reset');
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
            alert(`Board ${board.id} stats reset to 0`);
          } catch (error) {
            logger.error(`❌ Failed to reset board ${board.id} stats:`, error);
            alert('Error resetting stats');
          }
        };
        
        (newResetBtn as HTMLElement).addEventListener('click', handleResetStats);
        (newResetBtn as HTMLElement).addEventListener('touchend', handleResetStats, { passive: true });
        console.log('✅ Reset stats button listener attached');
      }
      }, 0); // End deferred reset button setup
      
      // 🔥 BUG FIX: Set card image - prepare for animation (will be animated, not always visible)
      // ⚡ ESSENTIAL: This MUST run immediately for GSAP animations!
      const imageEl = detailModal.querySelector('#detail-card-image') as HTMLElement;
      if (imageEl) {
        imageEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = board.interim ? './assets/colelctibles/common back.png' : (board.imagePath || '');
        img.alt = board.name || `Board ${board.id}`;
        imageEl.appendChild(img);
        
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
        
        img.style.display = 'block';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.opacity = '0';
        img.style.visibility = 'hidden';
        img.style.animation = 'none';
        img.style.animationPlayState = 'paused';
      }

      // ⚡ INSTANT SHOW: Defer title, badge, description, stats to background (~60ms saved)
      setTimeout(() => {
      // Set title in header (Board 01, Board 02, etc.)
      const titleEl = detailModal.querySelector('#detail-title');
      if (titleEl) {
        const boardNumberStr = board.id.toString().padStart(2, '0');
        titleEl.textContent = `Board ${boardNumberStr}`;
        logger.info(`✅ Detail modal title set to: Board ${boardNumberStr}`);
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
      const isIPad = window.innerWidth >= 769 && window.innerWidth <= 1024;
      
      // 🔥 CRITICAL: Ensure consistent padding on stats-card section (no right padding, container reduced by 200px)
      if (statsCardSection && !isIPad) {
        statsCardSection.style.padding = '0 0 24px 24px'; // No right padding (container reduced by 200px)
        statsCardSection.style.paddingTop = '0';
      } else if (statsCardSection && isIPad) {
        statsCardSection.style.padding = '';
        statsCardSection.style.paddingTop = '';
      }
      
      if (descEl) {
        descEl.textContent = "The board waits.\nA single move appears.\nEverything begins.";
        if (isIPad) {
          descEl.style.cssText = `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            color: #AD8775 !important;
            font-size: 20px !important;
            text-align: center !important;
            white-space: normal !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 520px !important;
            padding: 0 24px !important;
            line-height: 1.4 !important;
            flex-shrink: 0 !important;
            align-self: center !important;
            margin-top: 8% !important;
          `;
        } else {
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
        const isIPad = window.innerWidth >= 769 && window.innerWidth <= 1366;
        gsap.set(swipeableContainer, { x: 0 });
        setTimeout(() => {
          if (isIPad) {
            // iPad: no horizontal swipe. Reset any inline widths and remove handlers.
            swipeableContainer.style.width = '100%';
            swipeableContainer.style.transform = 'none';
            swipeableContainer.style.willChange = 'auto';
            const sections = swipeableContainer.querySelectorAll('.detail-section') as NodeListOf<HTMLElement>;
            sections.forEach((section) => {
              section.style.width = '100%';
              section.style.minWidth = '0';
              section.style.maxWidth = 'none';
              section.style.flexShrink = '0';
            });
            if ((swipeableContainer as any).__detailSwipeHandlers) {
              const handlers = (swipeableContainer as any).__detailSwipeHandlers;
              swipeableContainer.removeEventListener('touchstart', handlers.touchStart);
              swipeableContainer.removeEventListener('touchmove', handlers.touchMove);
              swipeableContainer.removeEventListener('touchend', handlers.touchEnd);
              swipeableContainer.removeEventListener('mousedown', handlers.mouseDown);
              swipeableContainer.removeEventListener('mousemove', handlers.mouseMove);
              swipeableContainer.removeEventListener('mouseup', handlers.mouseUp);
              swipeableContainer.removeEventListener('mouseleave', handlers.mouseUp);
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
                  console.log('🎯 Peekaboo area tapped - sliding to full card view');
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
              
              console.log('✅ Peekaboo tap detection added to swipeable container');
              logger.info('✅ Peekaboo tap detection added to swipeable container');
            }
          }
          
          // 🔥 IMPERATIVE: Re-apply 80px margin and 140px width after swipe init
          const descElAfterInit = detailModal.querySelector('#detail-card-description') as HTMLElement;
          
          if (descElAfterInit) {
            const isIPad = window.innerWidth >= 769 && window.innerWidth <= 1366;
            if (!descElAfterInit.textContent || descElAfterInit.textContent.trim() === '') {
              descElAfterInit.textContent = "The board waits.\nA single move appears.\nEverything begins.";
            }
            if (!isIPad) {
              descElAfterInit.style.marginLeft = '80px';
              descElAfterInit.style.width = '220px';
              descElAfterInit.style.maxWidth = '220px';
            } else {
              descElAfterInit.style.marginLeft = '0';
              descElAfterInit.style.width = '100%';
              descElAfterInit.style.maxWidth = '520px';
            }
            descElAfterInit.style.textAlign = 'center'; /* 🔥 USER REQUEST: Center text */
            descElAfterInit.style.whiteSpace = 'pre-line'; /* Each sentence on its own line */
            descElAfterInit.style.display = 'block';
            descElAfterInit.style.visibility = 'visible';
            descElAfterInit.style.opacity = '1';
            descElAfterInit.style.flexShrink = '0';
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
      if (floatingPlay) floatingPlay.remove();

      let playButtonForAnimation: HTMLElement | null = null;
      
      if (!isInterim) {
        // 🔥 USER REQUEST: Always show PLAY on board detail CTA (never CONTINUE).
        const boardHasSavedState = hasSavedStateForBoard(board.id);
        const buttonText = 'Play';
        const ariaLabel = 'Play Board';
        
        console.log(`🎮 Board ${board.id} CTA button text: "${buttonText}" (hasSavedState: ${boardHasSavedState})`);
        logger.info(`🎮 Board ${board.id} button will show: "${buttonText}"`);
        
        // Create new floating play button - EXACT same style as homepage slider CTA with shimmer
        const floatingPlayButton = document.createElement('button');
        floatingPlayButton.id = 'board-detail-play-button';
        floatingPlayButton.className = 'slide-button tap-scale menu-btn-primary';
        floatingPlayButton.textContent = buttonText; // Always "Play"
        floatingPlayButton.setAttribute('type', 'button');
        floatingPlayButton.setAttribute('aria-label', ariaLabel);
        
        // Prevent dragging/moving the button (but keep :active working for tap-scale)
        floatingPlayButton.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });
        floatingPlayButton.addEventListener('touchstart', (e) => {
          e.stopPropagation();
        });
        
        // Add to modal - append to modal (fixed positioning)
        detailModal.appendChild(floatingPlayButton);
        
        // Fixed positioning at bottom, centered (same as homepage slider CTA)
        // 🔥 CRITICAL: NO inline transform/opacity/visibility - let CSS handle EVERYTHING
        // This allows tap-scale :active and animate-enter classes to work correctly
        floatingPlayButton.style.position = 'fixed';
        floatingPlayButton.style.bottom = 'calc(40px + env(safe-area-inset-bottom, 0px))';
        floatingPlayButton.style.left = '50%';
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

          console.log(`🎮🎮🎮 PLAY BUTTON CLICKED! Board ID: ${boardIdForPlay}, Board Name: ${boardNameForPlay}`);
          logger.info(`🎮 Play button clicked for board ${boardIdForPlay}`);

          // Haptic feedback (match homepage slider CTA)
          try { (window as any).triggerHapticImpact?.('light'); } catch {}

          // 🔥 USER REQUEST: Check hearts BEFORE starting game (same as interim board)
          // If no hearts, show hearts bottom sheet instead of starting game
          try {
            const { heartsSystem } = await import('./hearts-system.js');
            if (!heartsSystem.hasHearts()) {
              logger.info('💔 No hearts available - showing hearts bottom sheet instead of starting game');
              const { showHeartsModal } = await import('./hearts-bottom-sheet.js');
              showHeartsModal();
              return; // Don't start game - show hearts modal instead
            }
          } catch (error) {
            logger.warn('⚠️ Failed to check hearts, continuing anyway:', error);
            // Continue if hearts check fails (fallback behavior)
          }

          if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
            JOURNEY_CARD_IDLE_BOUNCE.stop();
            logger.info('✅ Journey card idle bounce stopped');
          }

          // 🔥 USER REQUEST: Exit animation on detail modal only (no Journey screen exit - already hidden)
          await this.exitDetailModalAndHideCollectibles(detailModal, 'play button', { hideJourney: true });

          // Mark that we came from detail modal (for return on exit)
          (window as any).__ccCameFromDetailModal = true;
          (window as any).__ccDetailModalBoardId = boardIdForPlay;
          // 🔥 CRITICAL FIX: Also mark as coming from Journey so exitToMenu returns to Journey slide (slide 1)
          // This ensures proper navigation when exiting game - returns to Journey with enter animation
          this.setJourneyOriginFlags({ fromInterim: false });
          console.log(`🎯 Marked as coming from detail modal AND Journey (REGULAR BOARD, not interim) for board ${boardIdForPlay}`);

          // 🔥 USER REQUEST: Check if this board has a saved state (board-specific)
          // If YES → continue saved game (resume)
          // If NO → start fresh board (new game)
          const hasSavedState = hasSavedStateForBoard(boardIdForPlay);
          console.log(`🎮 Board ${boardIdForPlay} has saved state: ${hasSavedState}`);
          logger.info(`🎮 Board ${boardIdForPlay} saved state exists: ${hasSavedState}`);
          
          try {
            // 🔥 USER REQUEST: Show board transition screen before starting/continuing game
            // Import board transition screen module
            const { showBoardTransitionScreen } = await import('./board-transition-screen.js');
            console.log(`🎬 Showing board transition screen for board ${boardIdForPlay}`);
            
            await showBoardTransitionScreen({
              boardNumber: boardIdForPlay,
              onComplete: async () => {
                if (hasSavedState) {
                  // Case A: Board has save state → CONTINUE (resume where left off)
                  console.log(`🎮 Board ${boardIdForPlay} has saved state - will CONTINUE (resume)`);
                  logger.info(`🎮 Resuming saved game for board ${boardIdForPlay}`);
                  
                  // Set flag to resume at correct board
                  (window as any).__ccStartAtLevel = boardIdForPlay;
                  (window as any).__ccTriggerHudDrop = true;
                  
                  // Call continueGameWithSavedState to resume
                  if (typeof (window as any).continueGameWithSavedState === 'function') {
                    await (window as any).continueGameWithSavedState();
                    console.log(`✅ continueGameWithSavedState call completed for board ${boardIdForPlay}`);
                  } else {
                    console.error('❌ continueGameWithSavedState function NOT FOUND on window object!');
                    logger.error('❌ continueGameWithSavedState function not found');
                  }
                } else {
                  // Case B: Board has NO save state → START FRESH (new game)
                  console.log(`🎮 Board ${boardIdForPlay} has NO saved state - will START FRESH (new game)`);
                  logger.info(`🎮 Starting fresh game for board ${boardIdForPlay}`);
                  
                  // Call startNewRunFromJourney to create fresh board
                  if (typeof (window as any).startNewRunFromJourney === 'function') {
                    await (window as any).startNewRunFromJourney(boardIdForPlay);
                    console.log(`✅ startNewRunFromJourney call completed for board ${boardIdForPlay}`);
                  } else {
                    console.error('❌ startNewRunFromJourney function NOT FOUND on window object!');
                    logger.error('❌ startNewRunFromJourney function not found');
                  }
                }
              }
            });
          } catch (error) {
            console.error(`❌ Error starting/continuing game for board ${boardIdForPlay}:`, error);
            logger.error(`❌ Error starting/continuing game for board ${boardIdForPlay}:`, error);
          }
        };
        
        // Add both click and touchend for better mobile support
        floatingPlayButton.addEventListener('click', handlePlayClick, { capture: false });
        floatingPlayButton.addEventListener('touchend', handlePlayClick, { capture: false, passive: false });
        
        console.log(`✅ Play button event listener attached for board ${boardIdForPlay}`);
        logger.info(`✅ Play button event listener attached for board ${boardIdForPlay}`);
      }
      
      // 🔥 ONLY CASE: Interim board shows "Continue" button, all others have NO old CTA
      if (isInterim) {
        if (continueBoardBtn) {
          // Remove existing listeners to prevent duplicates
          const newContinueBtn = continueBoardBtn.cloneNode(true) as HTMLElement;
          continueBoardBtn.parentNode?.replaceChild(newContinueBtn, continueBoardBtn);
          
          // Set display on cloned element
          newContinueBtn.style.setProperty('display', 'block', 'important');
          
          const handleContinueInterim = async (source: string) => {
            logger.info(`🔄 Continue Board ${source} for board ${board.id}`);
            try {
              if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
                JOURNEY_CARD_IDLE_BOUNCE.stop();
                logger.info('✅ Journey card idle bounce stopped');
              }
              
              const detailModalExitPromise = this.closeDetailModalWithExitAnimation(detailModal);
              const { animateCollectiblesScreenExit } = await import('../ui/collectibles-animations.js');
              const journeyExitPromise = animateCollectiblesScreenExit();
              
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
          
          (newContinueBtn as HTMLElement).addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await handleContinueInterim('button click');
          });
          
          (newContinueBtn as HTMLElement).addEventListener('touchend', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await handleContinueInterim('touchend');
          }, { capture: true, passive: false });
          
          logger.info(`✅ Continue Board button listener attached for board ${board.id}`);
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
      const boardStatsContainer = detailModal.querySelector('.board-stats-container') as HTMLElement;
      // 🔥 CRITICAL: Use #board-detail-play-button (floating button created above) instead of #detail-play-board-btn
      const playButton = detailModal.querySelector('#board-detail-play-button') as HTMLElement;
      
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
        const recordedDisplay = el.dataset.statOriginalDisplay || el.style.display || '';
        el.dataset.statOriginalDisplay = recordedDisplay;
        
        // 🔥 CRITICAL: Set display and transition, but let GSAP control opacity/visibility/transform (same as card)
        // 🔥 SCREEN ARTIFACTS FIX: Force display with !important to override previous exit's display: none !important
        el.style.setProperty('display', defaultDisplay, 'important');
        el.style.transition = 'none';
        // 🔥 SCREEN ARTIFACTS FIX: Set opacity and visibility IMMEDIATELY via inline CSS (not GSAP)
        // This prevents 1-frame flash between display:block and GSAP initialization
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
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
      // Reset containers so previous exit animation doesn't leave them scaled/hidden
      // 🔥 CRITICAL: Only reset if modal is not currently animating exit (prevent race condition)
      // Check if modal is currently exiting - if so, don't reset stats (they're still animating)
      const isModalExiting = (detailModal as any).__detailModalExiting === true;
      if (!isModalExiting) {
        // Use requestAnimationFrame to ensure exit animations have completed
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (boardStatsContainer) {
              gsap.killTweensOf(boardStatsContainer);
              boardStatsContainer.style.transform = 'none';
              boardStatsContainer.style.opacity = '1';
              boardStatsContainer.style.visibility = 'visible';
              boardStatsContainer.style.display = 'flex';
            }
            if (detailStatsSection) {
              gsap.killTweensOf(detailStatsSection);
              detailStatsSection.style.transform = 'none';
              detailStatsSection.style.opacity = '1';
              detailStatsSection.style.visibility = 'visible';
              detailStatsSection.style.display = 'flex';
            }
            if (detailStatsList) {
              gsap.killTweensOf(detailStatsList);
              detailStatsList.style.transform = 'none';
              detailStatsList.style.opacity = '1';
              detailStatsList.style.visibility = 'visible';
              detailStatsList.style.display = detailStatsList.dataset.statOriginalDisplay || 'flex';
            }
          });
        });
      } else {
        logger.info('⏸️ Modal is currently exiting - skipping stats container reset to prevent animation interruption');
      }
      
      // Content elements array (excluding header and card image - card is already animated separately)
      // 🔥 OPTIMIZATION: Exclude stat icons/items here; they get their own staggered GSAP later
      const contentElements = [
        detailRarityBadgeContainer,
        detailDescription,
        boardStatsContainer,
        playButton
      ].filter(el => el !== null) as HTMLElement[];
      
      // 🔥 CRITICAL: Set initial state for description (will be animated, not always visible)
      if (detailDescription) {
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
        playButtonForInit.classList.remove('animate-enter', 'animate-exit', 'animate-reset', 'animate-enter-initial');
        // 🔥 CRITICAL: Remove ALL inline transform/transition/opacity to let CSS handle everything
        playButtonForInit.style.removeProperty('transform');
        playButtonForInit.style.removeProperty('transition');
        playButtonForInit.style.removeProperty('opacity');
        playButtonForInit.style.removeProperty('visibility');
        // 🔥 CSS will handle base transform (translateX(-50%)) and all animations
      }
      
      // Other elements: use GSAP
      // 🔥 CRITICAL: Exclude detailStatsSection from initial hide - we'll animate stat-items individually
      const elementsToHide = otherElements.filter(el => el !== detailStatsSection);
      
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

      // Now make modal visible and start animations
      // ⚡ SPEED FIX: Use single rAF (minimal delay ~16ms, but prevents layout thrashing)
        requestAnimationFrame(() => {
          // 🔥 SCREEN ARTIFACTS FIX: Double-check divideri are hidden BEFORE making modal visible
          const dividersBeforeVisible = detailModal.querySelectorAll('.detail-stat-divider') as NodeListOf<HTMLElement>;
          dividersBeforeVisible.forEach((div) => {
            div.style.setProperty('opacity', '0', 'important');
            div.style.setProperty('visibility', 'hidden', 'important');
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
            // 🔥 CRITICAL: Use CSS animate-enter class (same as homepage slider)
            // Remove all inline styles that could conflict with CSS
            playButtonForEnter.classList.remove('animate-exit', 'animate-reset', 'animate-enter');
            playButtonForEnter.style.removeProperty('transition');
            playButtonForEnter.style.removeProperty('opacity');
            playButtonForEnter.style.removeProperty('visibility');
            playButtonForEnter.style.removeProperty('transform'); // 🔥 Let CSS handle transform completely
            
            // Add CSS class for enter animation (same as homepage)
            playButtonForEnter.classList.add('animate-enter-initial');
            void playButtonForEnter.offsetHeight; // Force reflow
            
            // Trigger animation by adding animate-enter class
            setTimeout(() => {
              playButtonForEnter.classList.remove('animate-enter-initial');
              playButtonForEnter.classList.add('animate-enter');
            }, 0);
          }

          // STEP 3: Card image animation (after PLAY button, before other content elements)
          if (detailImage) {
            // 🔥 CRITICAL: Ensure card is hidden before animation starts and no stale tweens exist
            gsap.killTweensOf(detailImage);
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
              detailImgEl.style.opacity = '0';
              detailImgEl.style.visibility = 'hidden';
              detailImgEl.style.willChange = 'transform, opacity';
            }
            
            // Hard-set start state then pop to visible (avoids fade-only on first frame)
            gsap.fromTo(
              detailImage,
              {
                scale: 0.65,
                opacity: 0,
                visibility: 'hidden',
                force3D: true,
                transformOrigin: 'center center'
              },
              {
                scale: 1,
                opacity: 1,
                visibility: 'visible',
                duration: 0.5,
                ease: 'back.out(1.8)',
                delay: 0.05,
                force3D: true,
                overwrite: true,
                onStart: () => {
                  detailImage.style.visibility = 'visible';
                  if (detailImgEl) {
                    detailImgEl.style.visibility = 'visible';
                    detailImgEl.style.opacity = '0';
                  }
                },
                onUpdate: () => {
                  if (detailImgEl) {
                    // Keep img in sync with wrapper opacity to avoid flicker
                    const currentOpacity = gsap.getProperty(detailImage, 'opacity') as number;
                    detailImgEl.style.opacity = currentOpacity.toString();
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
                    detailImage.style.animation = 'detailImageIdle 3s ease-in-out infinite';
                    detailImage.style.animationPlayState = 'running';
                    logger.info('🃏 Card image idle animation started - modal is active');
                  } else {
                    logger.warn('⚠️ Modal is not active - idle animation not started');
                  }
                }
              }
            );
            logger.info('🃏 Step 3: Card image pop-in');
          }

          // STEP 4: Other content elements sequentially (staggered, after card)
          // 🔥 USER REQUEST: Start at 0.2s and animate stat-items one by one with better stagger
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
          }
          
          if (detailStatsSection) {
            gsap.killTweensOf(detailStatsSection);
            detailStatsSection.classList.remove('animate-enter', 'animate-exit', 'animate-reset', 'animate-enter-initial');
            detailStatsSection.style.transition = 'none';
            detailStatsSection.style.opacity = '1';
            detailStatsSection.style.visibility = 'visible';
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
          }
          
          // 🔥 iPad FIX: Force tight horizontal stats layout (override any CSS/inlines)
          const isIPad = isIPadDevice;
          if (isIPad && detailStatsListResolved) {
            detailStatsListResolved.style.flexDirection = 'row';
            detailStatsListResolved.style.gap = '2px';
            detailStatsListResolved.style.width = '100%';
            detailStatsListResolved.style.maxWidth = '100%';
            detailStatsListResolved.style.minWidth = '0';
            detailStatsListResolved.style.justifyContent = 'center';
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
          
          // 🔥 OPTIMIZATION: Animate each stat element (stat-item or divider) one by one
          // 🔥 USER REQUEST: Better stagger for fluid enter animation (more time between elements)
          const statStagger = 0.08; // Better stagger for fluidity (0.08s between each element - more visible than 0.05s)
          const statBaseDelay = baseDelay + (currentIndex * regularStagger); // Start after other elements
          
          const restoreStatsVisibility = () => {
            if (boardStatsContainer) {
              boardStatsContainer.style.opacity = '1';
              boardStatsContainer.style.visibility = 'visible';
              boardStatsContainer.style.display = 'flex';
            }
            if (detailStatsSection) {
              detailStatsSection.style.opacity = '1';
              detailStatsSection.style.visibility = 'visible';
              detailStatsSection.style.display = 'flex';
            }
            if (detailStatsListResolved) {
              const defaultDisplay = detailStatsListResolved.classList.contains('detail-stat-divider') ? 'block' : 'flex';
              detailStatsListResolved.style.display = detailStatsListResolved.dataset.statOriginalDisplay || defaultDisplay || 'flex';
              detailStatsListResolved.style.opacity = '1';
              detailStatsListResolved.style.visibility = 'visible';
            }
            statElements.forEach((el) => {
              const defaultDisplay = el.classList.contains('detail-stat-divider') ? 'block' : 'flex';
              // 🔥 SCREEN ARTIFACTS FIX: Force display with !important to override exit's display: none !important
              el.style.setProperty('display', el.dataset.statOriginalDisplay || defaultDisplay, 'important');
              // 🔥 SCREEN ARTIFACTS FIX: DON'T set visibility/opacity here - let GSAP handle it in animation
              // This prevents 1-frame flash where divideri are visible before GSAP starts animating
              // el.style.opacity = '1';
              // el.style.visibility = 'visible';
              el.style.transform = 'none';
              el.style.willChange = 'auto';
            });
          };
          
          if (statElements.length > 0) {
            if (isIPad) {
              // iPad: keep layout rules but animate like mobile for smoothness
              if (detailStatsSection) {
                detailStatsSection.style.width = '100%';
                detailStatsSection.style.maxWidth = '100%';
                detailStatsSection.style.alignItems = 'center';
                detailStatsSection.style.justifyContent = 'center';
              }
              if (detailStatsListResolved) {
                detailStatsListResolved.style.display = 'grid';
                detailStatsListResolved.style.gridTemplateColumns = 'minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr)';
                detailStatsListResolved.style.columnGap = '0';
                detailStatsListResolved.style.rowGap = '0';
                detailStatsListResolved.style.width = '100%';
                detailStatsListResolved.style.maxWidth = '100%';
                detailStatsListResolved.style.justifyItems = 'center';
                detailStatsListResolved.style.alignItems = 'center';
                detailStatsListResolved.style.padding = '0 24px';
              }
              const children = detailStatsListResolved ? Array.from(detailStatsListResolved.children) as HTMLElement[] : statElements;
              children.forEach((element, idx) => {
                if (!element) return;
                const isDivider = element.classList.contains('detail-stat-divider');
                const elementDefaultDisplay = isDivider ? 'block' : 'flex';
                element.style.setProperty('display', elementDefaultDisplay, 'important');
                element.style.willChange = 'transform, opacity';
                if (isDivider) {
                  element.style.width = '2px';
                  element.style.height = '64px';
                  element.style.marginLeft = '3%';
                  element.style.marginRight = '3%';
                  element.style.background = '#ECE2D9';
                }
                if (!isDivider) {
                  element.style.width = '100%';
                  element.style.maxWidth = '100%';
                  element.style.justifyContent = 'center';
                  if (idx === 0) {
                    element.style.paddingRight = '3%';
                    element.style.paddingLeft = '0';
                  } else if (idx === children.length - 1) {
                    element.style.paddingLeft = '3%';
                    element.style.paddingRight = '0';
                  } else {
                    element.style.paddingLeft = '3%';
                    element.style.paddingRight = '3%';
                  }
                }
              });
            }
            statElements.forEach((element, elementIndex) => {
              if (!element) return;
              
              // 🔥 USER REQUEST: First stat element needs more time to show bounce animation
              // Other elements use better stagger (0.08s) for fluidity
              const isFirstElement = elementIndex === 0;
              const delay = statBaseDelay + (elementIndex * statStagger); // Use consistent stagger for all elements
              
              // 🔥 USER REQUEST: First element needs longer duration to see bounce animation
              // All elements use same duration and ease for consistency and fluidity
              const duration = 0.5; // All elements: 0.5s for better bounce visibility
              const ease = 'back.out(1.8)'; // All elements: back.out(1.8) for consistent bounce
              
              // 🔥 CRITICAL: Use EXACT same pattern as card image enter animation
              // 🔥 CRITICAL: Ensure element is hidden before animation starts and no stale tweens exist
              gsap.killTweensOf(element);
              const elementIcon = element.querySelector('.detail-stat-icon, .stat-icon') as HTMLElement | null;
              const elementValue = element.querySelector('.detail-stat-value, .stat-value') as HTMLElement | null;
              const elementLabel = element.querySelector('.detail-stat-label, .stat-label') as HTMLElement | null;
              const elementContent = element.querySelector('.detail-stat-content, .stat-content') as HTMLElement | null;
              
              if (elementIcon) gsap.killTweensOf(elementIcon);
              if (elementValue) gsap.killTweensOf(elementValue);
              if (elementLabel) gsap.killTweensOf(elementLabel);
              if (elementContent) gsap.killTweensOf(elementContent);
              
              // 🔥 SCREEN ARTIFACTS FIX: CRITICAL - Set ALL properties with !important to prevent 1-frame flash
              // Inline stilovi sa !important override-uju SVE (čak i GSAP u prvom frame-u)
              element.style.setProperty('opacity', '0', 'important');
              element.style.setProperty('visibility', 'hidden', 'important');
              element.style.setProperty('transform', 'scale(0)', 'important');
              element.style.setProperty('transform-origin', 'center center', 'important');
              element.style.setProperty('transition', 'none', 'important');
              element.style.setProperty('will-change', 'transform, opacity', 'important');
              
              // 🔥 SCREEN ARTIFACTS FIX: FORCE display AFTER opacity/visibility to prevent flash
              // Divideri moraju biti display: block PRIJE nego što GSAP animacija krene, ALI nakon opacity: 0!
              const elementDefaultDisplay = element.classList.contains('detail-stat-divider') ? 'block' : 'flex';
              element.style.setProperty('display', elementDefaultDisplay, 'important');
              
              // 🔥 CRITICAL: Reset children (icons, values, labels) - ensure they're visible
              if (elementIcon) {
                elementIcon.style.transition = 'none';
                elementIcon.style.opacity = '0';
                elementIcon.style.visibility = 'hidden';
                elementIcon.style.willChange = 'transform, opacity';
              }
              if (elementValue) {
                elementValue.style.transition = 'none';
                elementValue.style.opacity = '0';
                elementValue.style.visibility = 'hidden';
              }
              if (elementLabel) {
                elementLabel.style.transition = 'none';
                elementLabel.style.opacity = '0';
                elementLabel.style.visibility = 'hidden';
              }
              if (elementContent) {
                elementContent.style.transition = 'none';
                elementContent.style.opacity = '0';
                elementContent.style.visibility = 'hidden';
              }
              
              // Hard-set start state then pop to visible (first element has longer duration for better bounce visibility)
              gsap.fromTo(
                element,
                {
                  scale: 0.65,
                  opacity: 0,
                  visibility: 'hidden',
                  force3D: true,
                  transformOrigin: 'center center'
                },
                {
                  scale: 1,
                  opacity: 1,
                  visibility: 'visible',
                  duration: duration, // First: 0.5s for better bounce visibility, others: 0.4s for fluidity
                  ease: ease, // First: back.out(1.8) for more bounce, others: back.out(1.7) for speed
                  delay: delay,
                  force3D: true,
                  overwrite: true,
                  onStart: () => {
                    // 🔥 SCREEN ARTIFACTS FIX: Remove !important flags so GSAP can animate properly
                    element.style.removeProperty('opacity');
                    element.style.removeProperty('visibility');
                    element.style.removeProperty('transform');
                    element.style.removeProperty('transform-origin');
                    element.style.removeProperty('transition');
                    element.style.removeProperty('will-change');
                    
                    // Set visibility without !important
                    element.style.visibility = 'visible';
                    // 🔥 CRITICAL: Make children visible when animation starts (same as card)
                    if (elementIcon) {
                      elementIcon.style.visibility = 'visible';
                      elementIcon.style.opacity = '0';
                    }
                    if (elementValue) elementValue.style.visibility = 'visible';
                    if (elementLabel) elementLabel.style.visibility = 'visible';
                    if (elementContent) elementContent.style.visibility = 'visible';
                  },
                  onUpdate: () => {
                    // 🔥 CRITICAL: Sync children opacity with parent during animation (same as card)
                    if (elementIcon) {
                      const currentOpacity = gsap.getProperty(element, 'opacity') as number;
                      elementIcon.style.opacity = currentOpacity.toString();
                    }
                    if (elementValue) {
                      const currentOpacity = gsap.getProperty(element, 'opacity') as number;
                      elementValue.style.opacity = currentOpacity.toString();
                    }
                    if (elementLabel) {
                      const currentOpacity = gsap.getProperty(element, 'opacity') as number;
                      elementLabel.style.opacity = currentOpacity.toString();
                    }
                    if (elementContent) {
                      const currentOpacity = gsap.getProperty(element, 'opacity') as number;
                      elementContent.style.opacity = currentOpacity.toString();
                    }
                  },
                  onComplete: () => {
                    // 🔥 CRITICAL: Ensure element and children remain visible after animation (same as card)
                    element.style.visibility = 'visible';
                    element.style.opacity = '1';
                    if (elementIcon) {
                      elementIcon.style.visibility = 'visible';
                      elementIcon.style.opacity = '1';
                    }
                    if (elementValue) {
                      elementValue.style.visibility = 'visible';
                      elementValue.style.opacity = '1';
                    }
                    if (elementLabel) {
                      elementLabel.style.visibility = 'visible';
                      elementLabel.style.opacity = '1';
                    }
                    if (elementContent) {
                      elementContent.style.visibility = 'visible';
                      elementContent.style.opacity = '1';
                    }
                  }
                }
              );
            });
            
            // 🔒 Safety net: after animations finish, force stats visible in final state
            const totalDelay = statBaseDelay + (statElements.length * statStagger) + 0.6;
            window.setTimeout(restoreStatsVisibility, totalDelay * 1000);
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
        }); // End forEach for other content elements
      
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
        
        // Add click listener that uses journey boards exit animation (GSAP, header as group)
        const handleCloseClick = async (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          logger.info('🎁 Journey boards detail modal close button clicked - using GSAP exit animation');
          
          // 🔥 USER REQUEST: Mark that we're returning from detail modal (skip auto-scroll)
          (window as any).__ccReturningFromDetailModal = true;
          
          // Use journey boards exit animation (header animates as group)
          await this.exitDetailModalAndHideCollectibles(detailModal, 'detail close button', { hideCollectibles: false, hideJourney: false, cleanup: true });
          
          // Show Journey screen after modal closes
          const collectiblesManager = (window as any).collectiblesManager;
          if (collectiblesManager && typeof collectiblesManager.showCollectibles === 'function') {
            collectiblesManager.showCollectibles();
          }
        };
        
        // Multiple ways to attach listener for maximum compatibility
        newCloseBtn.addEventListener('click', handleCloseClick, { capture: true });
        newCloseBtn.addEventListener('click', handleCloseClick, { capture: false });
        newCloseBtn.onclick = handleCloseClick;
        
        // Also handle touch events for mobile
        newCloseBtn.addEventListener('touchend', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          logger.info('🎁 Journey boards detail modal close button touched - using GSAP exit animation');
          
          // 🔥 USER REQUEST: Mark that we're returning from detail modal (skip auto-scroll)
          (window as any).__ccReturningFromDetailModal = true;
          
          // Use journey boards exit animation (header animates as group)
          await this.exitDetailModalAndHideCollectibles(detailModal, 'detail close touch', { hideCollectibles: false, hideJourney: false, cleanup: true });
          
          // Show Journey screen after modal closes
          const collectiblesManager = (window as any).collectiblesManager;
          if (collectiblesManager && typeof collectiblesManager.showCollectibles === 'function') {
            collectiblesManager.showCollectibles();
          }
        }, { capture: true, passive: false });
        
        logger.info('✅ Journey boards detail modal close button listener attached (GSAP exit animation)');
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
      // 🔥 USER REQUEST: Show "0/25" instead of "00/25" when count is 0
      counter.textContent = `${unlockedCount}/25`;
    }
  }

  // 🔥 CRITICAL FIX: Method to refresh background position after screen animation completes
  // This ensures consistent positioning when screen is shown again
  public refreshBackgroundPosition(): void {
    const container = this.container || document.getElementById('journey-boards-container');
    if (!container) return;
    
    const bgContainer = container.querySelector('.journey-bg-container') as HTMLElement;
    if (!bgContainer) return;
    
    // Find the image element to get dimensions
    const img = new Image();
    img.onload = () => {
      // Use double requestAnimationFrame to ensure DOM is stable
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!container || !bgContainer) return;
          
          const imageAspectRatio = img.height / img.width;
          const containerWidth = container.offsetWidth || container.clientWidth || 375;
          const calculatedHeight = containerWidth * imageAspectRatio;
          
          // Find the "Boards" subtitle header
          const sectionHeader = container.closest('.collectibles-section')?.querySelector('.collectibles-section-header');
          let topOffset = 0;
          
          if (sectionHeader) {
            const containerRect = container.getBoundingClientRect();
            const headerRect = sectionHeader.getBoundingClientRect();
            const containerTop = containerRect.top;
            const headerBottom = headerRect.bottom;
            const headerBottomRelativeToContainer = headerBottom - containerTop;
            topOffset = Math.max(0, headerBottomRelativeToContainer + 160 - 24 - 24 - 24);
          }
          
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
          
          container.style.height = `${calculatedHeight + topOffset}px`;
          bgContainer.style.height = `${calculatedHeight}px`;
          bgContainer.style.top = `${topOffset}px`;
          bgContainer.style.position = 'absolute';
          
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
          
          console.log('📐 Journey background position refreshed:', { topOffset, calculatedHeight });
        });
      });
    };
    
    img.src = './assets/journey assets/1-17bg.png';
    
    // If image is cached, trigger immediately
    if (img.complete) {
      img.onload(null as any);
    }
  }

  /**
   * 🔥 USER REQUEST: Ensure only ONE interim card exists at a time
   * Clears all interim statuses and sets only the correct one
   */
  private ensureSingleInterimCard(): void {
    // Clear ALL interim statuses first
    this.boards.forEach(b => {
      b.interim = false;
    });
    
    // Find highest unlocked board
    const unlockedBoards = this.boards.filter(b => b.unlocked);
    if (unlockedBoards.length > 0) {
      const highestUnlocked = unlockedBoards.reduce((max, b) => b.id > max.id ? b : max);
      const nextBoardNumber = highestUnlocked.id + 1;
      
      // Set ONLY the next board after highest unlocked to interim
      if (nextBoardNumber <= 16) {
        const nextBoard = this.boards.find(b => b.id === nextBoardNumber);
        if (nextBoard && !nextBoard.unlocked) {
          nextBoard.interim = true;
          logger.debug(`🗺️ Ensured single interim card: board ${nextBoardNumber} (next after highest unlocked ${highestUnlocked.id})`);
        }
      } else {
        // All boards unlocked (or highest is last) — keep an interim card on the last board for consistency
        highestUnlocked.interim = true;
        logger.info(`🗺️ All boards unlocked; keeping interim on board ${highestUnlocked.id} to ensure presence`);
      }
    } else {
      // No unlocked boards - set board 1 to interim
      const board1 = this.boards.find(b => b.id === 1);
      if (board1) {
        board1.interim = true;
        logger.debug(`🗺️ Ensured single interim card: board 1 (no unlocked boards)`);
      }
    }
  }

  public unlockBoardByNumber(boardNumber: number): boolean {
    if (boardNumber < 1 || boardNumber > 16) return false;
    
    const board = this.boards.find(b => b.id === boardNumber);
    if (!board) return false;
    
    if (!board.unlocked) {
      board.unlocked = true;
      board.interim = false; // Remove interim status when unlocking
      
      // 🔥 USER REQUEST: Ensure only ONE interim card exists
      this.ensureSingleInterimCard();
      
      this.saveBoardsState();
      this.renderBoards();
      this.updateCounter();
      logger.info(`🗺️ Journey board ${boardNumber.toString().padStart(2, '0')} unlocked.`);
      return true;
    }
    return false;
  }

  public lockBoardByNumber(boardNumber: number): boolean {
    if (boardNumber < 1 || boardNumber > 16) return false;
    
    const board = this.boards.find(b => b.id === boardNumber);
    if (!board) return false;
    
    if (board.unlocked || board.interim) {
      board.unlocked = false;
      board.interim = false; // Also remove interim status when locking
      
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
      
      // 🔥 USER REQUEST: Ensure only ONE interim card exists
      this.ensureSingleInterimCard();
      
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
    this.saveBoardsState();
  }

  private loadBoardsState(): void {
    try {
      const saved = localStorage.getItem('journey_boards_state');
      if (saved) {
        const state = JSON.parse(saved);
        state.forEach((savedBoard: { id: number; unlocked: boolean; interim?: boolean }) => {
          const board = this.boards.find(b => b.id === savedBoard.id);
          if (board) {
            board.unlocked = savedBoard.unlocked;
            board.interim = savedBoard.interim || false;
          }
        });
      } else {
        // 🔥 USER REQUEST: If no saved state, ensure Board 1 is interim (not unlocked)
        const board1 = this.boards.find(b => b.id === 1);
        if (board1) {
          board1.unlocked = false;
          board1.interim = true;
          logger.info('🗺️ No saved state - Board 1 set to interim (default state)');
        }
      }
      
      // 🔥 CRITICAL: Also sync with game progress (boardNumber from localStorage or game state)
      // This ensures journey boards are unlocked based on actual game progress
      // 🔥 CRITICAL FIX: Only sync if we have a saved game state
      // If no saved game (hard exit after fail), preserve interim status from localStorage
      const savedGame = localStorage.getItem('cc_saved_game');
      if (savedGame) {
        this.syncWithGameProgress();
      } else {
        // No saved game - preserve interim status from localStorage (user failed and exited)
        // Don't call syncWithGameProgress() as it might overwrite interim status
        logger.info('🗺️ No saved game state - preserving interim status from localStorage');
        // 🔥 CRITICAL FIX: Ensure we have EXACTLY ONE interim card (but don't overwrite if already exists)
        // Check if we have any interim card first
        const hasInterim = this.boards.some(b => b.interim === true);
        if (!hasInterim) {
          // No interim card found - ensure we have one
          this.ensureSingleInterimCard();
          logger.info('🗺️ No interim card found after load - ensured single interim card');
        } else {
          logger.info('🗺️ Interim card already exists - preserving it');
        }
        this.saveBoardsState();
      }
    } catch (error) {
      logger.warn('Failed to load journey boards state:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Sync journey boards with game progress (boardNumber)
   * Sets current board to interim (shows common back.png, cannot click)
   * Only unlocks boards that have been completed (won)
   */
  public syncWithGameProgress(boardNumber?: number): void {
    // 🔥 USER REQUEST: Ensure only ONE interim card before syncing
    // This prevents multiple interim cards from existing
    this.ensureSingleInterimCard();
    try {
      // Get boardNumber from game state if not provided
      if (boardNumber === undefined) {
        try {
          const savedGame = localStorage.getItem('cc_saved_game');
          if (savedGame) {
            const gameState = JSON.parse(savedGame);
            boardNumber = Number(gameState.boardNumber) || 1;
          } else {
            // Try to get from stats service
            const statsService = (window as any).statsService;
            if (statsService && typeof statsService.getHighestBoard === 'function') {
              boardNumber = statsService.getHighestBoard() || 1;
            } else {
              boardNumber = 1;
            }
          }
        } catch (e) {
          boardNumber = 1;
        }
      }
      
      // 🔥 USER FIX: Only set board to interim if user has actually started playing
      // Check if user has started game by looking for saved game or highest board > 0
      let hasStartedGame = false;
      try {
        const savedGame = localStorage.getItem('cc_saved_game');
        if (savedGame) {
          hasStartedGame = true;
        } else {
          const statsService = (window as any).statsService;
          if (statsService && typeof statsService.getHighestBoard === 'function') {
            const highestBoard = statsService.getHighestBoard() || 0;
            // User has started if they've reached at least Board 1 (highestBoard >= 1)
            // But we need to be careful - if highestBoard is exactly 1, it might mean they just started
            // So we check if they've made progress beyond initial state
            hasStartedGame = highestBoard >= 1;
          }
        }
      } catch (e) {
        // If we can't check, don't set interim status
        hasStartedGame = false;
      }
      
      // 🔥 USER REQUEST: Board 1 starts as interim (not unlocked)
      // When user completes a board, next board becomes interim
      const targetBoard = boardNumber ?? 1;
      const currentBoard = this.boards.find(b => b.id === targetBoard);
      
      // Set interim if:
      // 1. Board is not already unlocked
      // 2. Board matches current boardNumber (user is playing this board)
      // 🔥 CRITICAL FIX: Don't overwrite interim status if it's already set from localStorage
      // This ensures interim cards persist after hard exit
      if (currentBoard && !currentBoard.unlocked) {
        // Only set interim if it's not already set (preserve existing interim status from localStorage)
        if (!currentBoard.interim) {
          currentBoard.interim = true;
          this.saveBoardsState();
          logger.info(`🗺️ Board ${targetBoard} set to interim (currently playing, not yet won)`);
        } else {
          logger.info(`🗺️ Board ${targetBoard} already has interim status (preserved from localStorage)`);
        }
      }
      
      // Note: Next board is set to interim when current board is completed (in unlockBoardOnCompletion)
      // This ensures that board N+1 becomes interim only after board N is won
      
      // Note: Boards are unlocked (unlocked=true, interim=false) only when they are completed (won)
      // This is done in unlockBoardByNumber() which is called when board is completed
      
      // 🔥 USER REQUEST: Ensure only ONE interim card exists after syncing
      this.ensureSingleInterimCard();
      this.saveBoardsState();
    } catch (error) {
      logger.warn('Failed to sync journey boards with game progress:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Unlock board when it's completed (won)
   * This is called when board is successfully completed (clean board)
   */
  public unlockBoardOnCompletion(boardNumber: number): void {
    try {
      if (boardNumber < 1 || boardNumber > 16) return;
      
      const board = this.boards.find(b => b.id === boardNumber);
      if (!board) return;
      
      // Check if board was already unlocked (for Board 1 which starts unlocked)
      const wasAlreadyUnlocked = board.unlocked;
      
      // Unlock the board (remove interim status, set unlocked)
      board.unlocked = true;
      board.interim = false;
      
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
      
      // 🔥 USER REQUEST: Ensure only ONE interim card exists after unlocking
      // This will set the next board to interim (if exists and not already unlocked)
      this.ensureSingleInterimCard();
      
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

  public showBoardPickerModal(action: 'show' | 'hide'): void {
    console.log('🗺️ showBoardPickerModal called with action:', action);
    
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
    title.textContent = action === 'show' ? 'Show Boards' : 'Hide Boards';
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

    // Create 16 buttons (01-16)
    for (let i = 1; i <= 16; i++) {
      const btn = document.createElement('button');
      btn.textContent = i.toString().padStart(2, '0');
      
      // Check current state
      const board = this.boards.find(b => b.id === i);
      const isUnlocked = board?.unlocked ?? false;
      
      // For "show" action, only show locked boards
      // For "hide" action, only show unlocked boards
      const shouldShow = action === 'show' ? !isUnlocked : isUnlocked;
      
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
            btn.style.background = '#f3eee8';
            btn.style.borderColor = '#e0e0e0';
            btn.style.color = '#333';
          } else {
            // Select
            selectedBoards.add(i);
            btn.style.background = '#e8734a';
            btn.style.borderColor = '#e8734a';
            btn.style.color = 'white';
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
      console.log('✅ Board picker modal closed and cleaned up');
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

    okBtn.addEventListener('click', () => {
      selectedBoards.forEach(boardNum => {
        if (action === 'show') {
          this.unlockBoardByNumber(boardNum);
        } else {
          this.lockBoardByNumber(boardNum);
        }
      });
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
        console.log('🗺️ Journey Show Card button clicked/touched', e.type);
        this.showBoardPickerModal('show');
      };
      
      // Use onclick property (overwrites any existing handler)
      unlockBtn.onclick = handleUnlock;
      
      // 🔥 CHROME FIX: Ensure button is interactive
      unlockBtn.style.pointerEvents = 'auto';
      unlockBtn.style.cursor = 'pointer';
      unlockBtn.disabled = false;
      
      logger.debug('Journey Show Card button listener attached', undefined, { onclick: true });
    } else {
      console.warn('⚠️ journey-unlock-btn not found');
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
        console.log('🗺️ Journey Hide Card button clicked/touched', e.type);
        this.showBoardPickerModal('hide');
      };
      
      // Use onclick property (overwrites any existing handler)
      hideBtn.onclick = handleHide;
      
      // 🔥 CHROME FIX: Ensure button is interactive
      hideBtn.style.pointerEvents = 'auto';
      hideBtn.style.cursor = 'pointer';
      hideBtn.disabled = false;
      
      logger.debug('Journey Hide Card button listener attached', undefined, { onclick: true });
    } else {
      console.warn('⚠️ journey-hide-btn not found');
    }
  }
}

// Export singleton instance
export const journeyBoardsManager = new JourneyBoardsManager();
