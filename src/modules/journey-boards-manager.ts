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
  private glowPulseInterval: number | null = null; // Interval for continuous glow pulse
  // 🔥 USER REQUEST: Shimmer is now triggered together with glow (not independent interval)
  // 🔥 USER REQUEST: Smoke bubbles are now triggered DURING bounce animation (not independent interval)

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
      gsap.to(cardWrapper, {
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
              logger.warn('⚠️ Bounce stopped before smoke trigger, skipping smoke');
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
          gsap.to(cardWrapper, {
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
      const isIPad = window.innerWidth >= 769 && window.innerWidth <= 1024;
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
      logger.warn('⚠️ Glow pulse already active, stopping before restart');
      this.stopGlowPulse();
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
    this.renderDisposed = true;
    
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
              logger.warn('⚠️ Interim card not yet visible, retrying scroll in 200ms...');
              setTimeout(() => {
                this.scrollToInterimCard();
              }, 200);
              return;
            }
            
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
          const tl = gsap.timeline({
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
    
    // 🔥 FIX: Load image asynchronously to get exact dimensions
    const img = new Image();
    const KNOWN_ASPECT_RATIO = 1.97; // Fallback aspect ratio
    
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
    
    img.src = './assets/journey assets/1-17bg.png';
    
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
        // Kartica 2: 24px gore i desno za 56px (20px + 12px + 24px) - iPad ONLY
        // iPhone keeps original centered position (50%)
        topPx -= 24;
        // Ensure leftPx is in pixels (not percentage) before adding iPad offset
        if (typeof leftPx === 'number' && leftPx === 50) {
          leftPx = (50 / 100) * viewportWidth;
        }
        leftPx += 56; // Pomjerena desno za 56px na iPad-u (iPhone ostaje centrirana)
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
      image.src = board.imagePath || '';
      image.alt = board.name || `Board ${board.id}`;
      image.className = 'journey-board-image';
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
      
      // Add click handler to open detail modal (not start game directly)
      card.addEventListener('click', () => {
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
        // Open detail modal for this board (with exit animation on Journey screen first)
        logger.info(`🚀🚀🚀 CALLING openBoardDetails FOR BOARD ${board.id}`);
        this.openBoardDetails(board).catch((error) => {
          logger.error('❌ Failed to open board details:', error);
        });
      });
    } else if (isInterim) {
      // Interim card - show common back.png, clicking directly continues game (no detail modal)
      const image = document.createElement('img');
      image.src = './assets/colelctibles/common back.png';
      image.alt = `Board ${board.id} (interim)`;
      image.className = 'journey-board-image';
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
      card.addEventListener('click', async () => {
        // Notify interaction to stop idle animations
        if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction === 'function') {
          JOURNEY_CARD_IDLE_BOUNCE.notifyInteraction();
        }
        // Directly continue game from interim board (no detail modal)
        await this.continueFromInterimBoard(board);
      });
    } else {
      // Locked card - show journey-card-empty.png image with number overlay
      const lockedContainer = document.createElement('div');
      lockedContainer.className = 'journey-board-locked-container';
      
      // Add empty card image
      const image = document.createElement('img');
      image.src = './assets/colelctibles/journey-card-empty.png';
      image.alt = `Board ${board.id} (locked)`;
      image.className = 'journey-board-empty-image';
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
      
      // 🔥 CRITICAL FIX: Hide homepage and slider BEFORE starting game (cleanup)
      const homeElement = document.getElementById('home');
      const sliderContainer = document.getElementById('slider-container');
      if (homeElement) {
        homeElement.style.display = 'none';
        homeElement.style.visibility = 'hidden';
        homeElement.style.opacity = '0';
        homeElement.style.zIndex = '-9999';
        homeElement.setAttribute('hidden', 'true');
        logger.info('✅ Homepage hidden BEFORE game start');
      }
      if (sliderContainer) {
        sliderContainer.style.display = 'none';
        sliderContainer.style.visibility = 'hidden';
        sliderContainer.style.opacity = '0';
        sliderContainer.style.zIndex = '-9999';
        logger.info('✅ Slider container hidden BEFORE game start');
      }
      
      // Cleanup Journey boards manager (memory leak prevention)
      this.cleanup();
      logger.info('✅ Journey boards manager cleaned up');
      
      // Hide Journey screen completely
      const journeyScreen = document.getElementById('journey-screen');
      if (journeyScreen) {
        journeyScreen.classList.add('hidden');
        journeyScreen.style.display = 'none';
        journeyScreen.style.visibility = 'hidden';
        journeyScreen.style.opacity = '0';
        logger.info('✅ Journey screen hidden completely');
      }
      
      // Import journey progression state
      const { journeyProgressionState } = await import('./journey-progression-state.js');
      
      // Set lastOpenedBoardId to this board
      journeyProgressionState.setLastOpenedBoardId(boardId);
      
      // 🔥 CRITICAL FIX: Set Journey flag so startNewRun knows we came from Journey
      (window as any).__ccCameFromJourney = true;
      (window as any).__ccCameFromHomepage = false;
      localStorage.setItem('__ccCameFromJourney', 'true');
      localStorage.removeItem('__ccCameFromHomepage');
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
      
      // 🔥 MEMORY LEAK FIX: Stop CSS infinite animations before exit animation
      const detailImageEl = modal.querySelector('#detail-card-image') as HTMLElement;
      if (detailImageEl) {
        // Stop detailImageIdle animation (3s ease-in-out infinite)
        detailImageEl.style.animation = 'none';
        detailImageEl.style.animationPlayState = 'paused';
        // Stop shimmer animation on ::after pseudo-element by stopping parent animation
        logger.info('🧹 Detail image CSS animations stopped');
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
      // 🔥 CRITICAL: Find PLAY button directly (not from contentElements array)
      // PLAY button is created dynamically and added to modal, so find it directly
      const playButton = modal.querySelector('#board-detail-play-button') as HTMLElement || document.getElementById('board-detail-play-button') as HTMLElement;
      
      // 🔥 USER REQUEST: Add animations for stats section, icons, and description text
      const detailStatsSection = modal.querySelector('.detail-section-stats') as HTMLElement;
      const detailStatIcons = modal.querySelectorAll('.detail-stat-icon') as NodeListOf<HTMLElement>;
      const detailStatIconsArray = Array.from(detailStatIcons);

      // 🔥 USER REQUEST: Content elements array (EXCLUDE PLAY button - it's handled separately)
      // Include stats section, icons, and description in exit animation
      const otherContentElements = [
        boardStatsContainer,
        detailDescription,
        ...detailStatIconsArray,
        detailStatsSection,
        detailRarityBadgeContainer,
        detailImage
      ].filter(el => el !== null) as HTMLElement[];
      
      // 🔥 DEBUG: Log PLAY button state
      if (playButton) {
        logger.info(`✅ PLAY button found for exit animation: id=${playButton.id}, parent=${playButton.parentNode?.nodeName}`);
      } else {
        logger.warn(`⚠️ PLAY button NOT found for exit animation!`);
      }
      
      // STEP 1: Other content elements FIRST (container with stats + card)
      otherContentElements.forEach((element, index) => {
        const baseDelay = 0; // Start immediately
        const stagger = 0.05; // Faster stagger for exit (same as settings screen)
        const delay = baseDelay + (index * stagger);
        
        // 🔥 BUG FIX: Ensure CSS transitions are disabled for GSAP scale animation
        if (element) {
          element.style.transition = 'none';
        }

        gsap.to(element, {
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
      
      // STEP 2: PLAY button AFTER container finishes (stats + card duration is 0.4s, so start at 0.4s + buffer)
      // 🔥 USER REQUEST: PLAY button exits AFTER container (stats + card) animation completes
      let playButtonExitDelay = 0;
      let playButtonExitDuration = 0;
      
      if (playButton) {
        playButton.classList.remove('animate-enter', 'animate-enter-initial', 'animate-reset');
        playButton.style.removeProperty('transform');
        playButton.style.removeProperty('transition');
        void playButton.offsetHeight; // Force reflow
        
        // Calculate delay: container elements start at 0ms, last element starts at (otherContentElements.length - 1) * 0.05
        // Container animation duration is 0.4s, so wait for that + small buffer
        const lastElementDelay = otherContentElements.length > 0 ? ((otherContentElements.length - 1) * 0.05) : 0;
        const containerAnimationDuration = 0.4; // Duration of container exit animation
        playButtonExitDelay = lastElementDelay + containerAnimationDuration + 0.05; // Wait for container to finish + 50ms buffer
        playButtonExitDuration = 0.65; // CSS animation duration (from collectibles-screen.css)
        
        // 🔥 CRITICAL: Move PLAY button to body BEFORE starting exit animation
        // This ensures it remains visible when modal is hidden
        if (playButton.parentNode === modal) {
          document.body.appendChild(playButton);
          logger.info('🎮 PLAY button moved to body before exit animation');
        }
        
        // Start exit animation AFTER container finishes
        setTimeout(() => {
          if (playButton && playButton.parentNode) {
            playButton.classList.add('animate-exit');
            logger.info(`🎮 PLAY button exit animation started at ${(playButtonExitDelay * 1000).toFixed(0)}ms`);
          } else {
            logger.warn('⚠️ PLAY button not found when trying to start exit animation!');
          }
        }, playButtonExitDelay * 1000);
      }

      // STEP 3: Header LAST (includes X, title, divider - animated as group, same as settings screen)
      // 🔥 CRITICAL: Animate header EXACTLY like enter animation - as parent element, not child elements
      // This ensures all child elements (X, title, divider) animate together as a group
      // 🔥 BUG FIX: Use otherContentElements.length (not contentElements.length) since PLAY button is separate
      const lastDelay = otherContentElements.length > 0 ? (otherContentElements.length * 0.05) : 0;
      if (detailHeader) {
        // 🔥 CRITICAL: Remove CSS transition classes and disable transitions on header child elements
        // This ensures GSAP animation controls all header elements (X, title, divider) as a group
        const detailCloseBtn = modal.querySelector('#detail-close-btn') as HTMLElement;
        if (detailCloseBtn) {
          detailCloseBtn.classList.remove('animate-enter', 'animate-exit', 'animate-enter-initial', 'animate-reset');
          detailCloseBtn.style.setProperty('transition', 'none', 'important');
          detailCloseBtn.style.setProperty('transform', 'none', 'important');
        }
        
        // Disable transitions on all nested header child elements to ensure GSAP controls everything
        const headerChildren = detailHeader.querySelectorAll('*');
        headerChildren.forEach((child: Element) => {
          const childEl = child as HTMLElement;
          childEl.style.setProperty('transition', 'none', 'important');
          childEl.style.setProperty('transform', 'none', 'important');
        });
        
        // 🔥 CRITICAL: Animate header parent element EXACTLY like enter animation
        // All child elements (X, title, divider) will animate together as a group
        // This matches the enter animation pattern where header is animated as parent
        gsap.to(detailHeader, {
          scale: 0,
          opacity: 0,
          duration: 0.4,
          ease: 'back.in(1.7)',
          delay: lastDelay + 0.05,
          force3D: true
        });
        logger.info(`📊 Header pop-out - LAST (X, title, divider animate together as group at ${((lastDelay + 0.05) * 1000).toFixed(0)}ms)`);
      }

      // Calculate total animation duration (content elements + PLAY button + header)
      // 🔥 CRITICAL: Include PLAY button exit animation in total duration
      const playButtonEndTime = playButtonExitDelay + playButtonExitDuration; // When PLAY button animation ends
      const headerEndTime = lastDelay + 0.05 + 0.4; // When header animation ends
      const totalDuration = Math.max(playButtonEndTime, headerEndTime) * 1000 + 100; // Use the longer one + 100ms buffer

      // Wait for exit animation to complete
      setTimeout(() => {
        // 🔥 MEMORY LEAK FIX: Ensure CSS animations are stopped
        const detailImageEl = modal.querySelector('#detail-card-image') as HTMLElement;
        if (detailImageEl) {
          detailImageEl.style.animation = 'none';
          detailImageEl.style.animationPlayState = 'paused';
        }
        
        // Hide modal (PLAY button is now in body, so it remains visible)
        modal.hidden = true;
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        
        // 🔥 CRITICAL: Remove PLAY button AFTER its animation completes
        // PLAY button exit animation duration is 0.65s, so wait for that
        if (playButton && playButtonExitDelay > 0) {
          const playButtonRemoveDelay = (playButtonExitDelay + playButtonExitDuration) * 1000;
          setTimeout(() => {
            if (playButton && playButton.parentNode) {
              playButton.remove();
              logger.info('🎮 PLAY button removed after exit animation completed');
            }
          }, playButtonRemoveDelay);
        }
        
        logger.info(`✅ Detail modal exit animation completed (${totalDuration}ms)`);
        logger.info(`🎮 PLAY button exit: delay=${(playButtonExitDelay * 1000).toFixed(0)}ms, duration=${(playButtonExitDuration * 1000).toFixed(0)}ms, ends at=${((playButtonExitDelay + playButtonExitDuration) * 1000).toFixed(0)}ms`);
        resolve();
      }, totalDuration);
    });
  }

  /**
   * 🔥 USER REQUEST: Continue game directly from interim board (no detail modal)
   * This is called when user clicks an interim card
   */
  private async continueFromInterimBoard(board: JourneyBoard): Promise<void> {
    logger.info(`🔄 Continue from interim board ${board.id} - starting cleanup and game`);
    
    try {
      // Step 0: Check if player has hearts available
      const { heartsSystem } = await import('./hearts-system.js');
      if (!heartsSystem.hasHearts()) {
        logger.info('💔 No hearts available - showing hearts bottom sheet instead of starting game');
        const { showHeartsModal } = await import('./hearts-bottom-sheet.js');
        showHeartsModal();
        return; // Don't continue to game
      }
      
      // Step 1: Stop Journey card idle bounce animations immediately
      if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
        JOURNEY_CARD_IDLE_BOUNCE.stop();
        logger.info('✅ Journey card idle bounce stopped');
      }
      
      // Step 2: Set Journey progression state BEFORE exit animation
      const { journeyProgressionState } = await import('./journey-progression-state.js');
      journeyProgressionState.setLastOpenedBoardId(board.id);
      
      // 🔥 USER REQUEST: Mark that we came from Journey screen BEFORE exit animation
      // This ensures exitToMenu returns to Journey (slide 1) instead of homepage (slide 0)
      (window as any).__ccCameFromJourney = true;
      (window as any).__ccCameFromHomepage = false;
      // 🔥 FIX: Also store in localStorage for persistence across game sessions
      localStorage.setItem('__ccCameFromJourney', 'true');
      localStorage.removeItem('__ccCameFromHomepage');
      logger.info('🗺️ Marked as coming from Journey screen (interim card click) - stored in localStorage');
      
      // 🔥 APP STORE FIX: Hide homepage IMMEDIATELY before Journey exit animation
      // This prevents homepage leftover elements from showing during transition
      const homeElement = document.getElementById('home');
      const sliderContainer = document.getElementById('slider-container');
      
      if (homeElement) {
        homeElement.style.display = 'none';
        homeElement.style.visibility = 'hidden';
        homeElement.style.opacity = '0';
        homeElement.style.zIndex = '-9999';
        homeElement.setAttribute('hidden', 'true');
        logger.info('✅ Homepage hidden BEFORE Journey exit animation');
      }
      
      if (sliderContainer) {
        sliderContainer.style.display = 'none';
        sliderContainer.style.visibility = 'hidden';
        sliderContainer.style.opacity = '0';
        sliderContainer.style.zIndex = '-9999';
        logger.info('✅ Slider container hidden BEFORE Journey exit animation');
      }
      
      logger.info('✅ Homepage completely hidden before Journey exit - no leftovers possible');
      
      // Step 3: Close Journey screen with exit animation (ONLY Journey exit, NO slider exit)
      const { animateCollectiblesScreenExit } = await import('../ui/collectibles-animations.js');
      const journeyExitPromise = animateCollectiblesScreenExit();
      
      // Step 4: Wait for exit animation to complete
      await journeyExitPromise;
      logger.info('✅ Journey exit animation completed');
      
      // Step 5: Cleanup Journey boards manager (memory leak prevention)
      this.cleanup();
      
      // Step 6: Hide Journey screen completely (ensure it's not visible during game start)
      const journeyScreen = document.getElementById('journey-screen');
      if (journeyScreen) {
        journeyScreen.classList.add('hidden');
        journeyScreen.style.display = 'none';
        journeyScreen.style.visibility = 'hidden';
        journeyScreen.style.opacity = '0';
        // 🔥 CRITICAL: Set z-index to ensure it's behind app element
        (journeyScreen as HTMLElement).style.zIndex = '-1';
        logger.info('✅ Journey screen completely hidden');
      }
      
      // Step 7: Also call hideCollectibles to ensure proper cleanup (memory leak prevention)
      const collectiblesManager = (window as any).collectiblesManager;
      if (collectiblesManager && typeof collectiblesManager.hideCollectibles === 'function') {
        // Ensure hideCollectibles does NOT try to return to homepage (this is a transition into game)
        (window as any).__ccJourneyExitMode = 'toGame';
        await collectiblesManager.hideCollectibles();
      }
      
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
        // Check if there's a saved game state with score
        const savedGame = localStorage.getItem('cc_saved_game');
        if (savedGame) {
          try {
            const gameState = JSON.parse(savedGame);
            savedScore = Number.isFinite(gameState.score) ? gameState.score : 0;
            logger.info(`🎮 Found saved game state with score ${savedScore}`);
          } catch (e) {
            logger.warn('⚠️ Failed to parse saved game:', e instanceof Error ? e.message : String(e));
          }
        }
      }
      
      // 🔥 USER REQUEST: Check if we have valid tiles/grid in saved game
      // If we have tiles, we can continue (resume). If not, we create fresh board.
      const savedGame = localStorage.getItem('cc_saved_game');
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
            logger.info(`🎮 Found valid saved game with tiles/grid for board ${board.id} - will continue (resume)`);
          } else {
            logger.info(`🎮 Saved game exists but has no tiles/grid for board ${board.id} - will create fresh board`);
          }
        } catch (e) {
        logger.warn('⚠️ Failed to parse saved game:', e instanceof Error ? e.message : String(e));
          gameState = null;
        }
      }
      
      // 🔥 JOURNEY BOARDS: Always start from score 0 (no accumulation between boards)
      const resetScore = 0;
      
      if (hasValidTiles && gameState) {
        // CASE 1: We have valid saved game with tiles - CONTINUE (resume)
        gameState.boardNumber = board.id;
        gameState.level = board.id;
        gameState.score = resetScore; // 🔥 JOURNEY BOARDS: Always start from 0
        gameState.timestamp = Date.now();
        localStorage.setItem('cc_saved_game', JSON.stringify(gameState));
        logger.info(`🎮 Updated saved game state for CONTINUE: boardNumber=${board.id}, score=${resetScore}, hasTiles=true`);
        
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
        localStorage.setItem('cc_saved_game', JSON.stringify(gameState));
        logger.info(`🎮 Created new saved game state for FRESH BOARD: boardNumber=${board.id}, score=${resetScore}, no tiles`);
        
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
      
      // Step 9: Continue game with saved state (resume interim game)
      // 🔥 CRITICAL FIX: Use continueGameWithSavedState() to preserve progress and score
      // This will load saved game state and continue from where user left off
      // HUD drop animation is already handled in continueGameWithSavedState() for Journey pathway
      if (typeof (window as any).continueGameWithSavedState === 'function') {
        // 🔥 CRITICAL: Always trigger HUD drop on entry from interim card (every time)
        // This ensures _hudDropPending is set even if other flags/state were cleared.
        (window as any).__ccTriggerHudDrop = true;
        logger.info(`🎮 Continuing saved game for board ${board.id} - preserving progress and score`);
        await (window as any).continueGameWithSavedState();
      } else {
        logger.error('❌ continueGameWithSavedState function not found');
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
    
    const quickSetX = gsap.quickSetter(container, 'x', 'px');
    let currentX = 0;
    let isDragging = false;
    let startX = 0;
    let startTranslateX = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let momentumAnimation: gsap.core.Tween | null = null;
    
    quickSetX(0);
    container.style.willChange = 'transform';
    container.style.cursor = 'grab';
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        // 🔥 USER REQUEST: Don't start dragging immediately - wait for actual movement
        // Just store initial position, don't set isDragging = true yet
        startX = e.touches[0].clientX;
        lastX = startX;
        startTranslateX = currentX;
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
      
      // 🔥 APPLE STYLE: Apply momentum with smooth deceleration
      // Velocity: positive = left swipe, negative = right swipe
      if (Math.abs(velocity) > 0.05) {
        const momentum = velocity * 300; // Momentum multiplier
        // Velocity is positive for left swipe → negative translateX
        // Velocity is negative for right swipe → positive translateX
        let targetX = currentX - momentum; // Subtract momentum: left swipe (positive velocity) → negative translateX
        
        // Clamp to bounds
        targetX = Math.max(-maxScroll, Math.min(0, targetX));
        
        // Smooth deceleration animation
        momentumAnimation = gsap.to(container, {
          x: targetX,
          duration: 0.6,
          ease: 'power2.out', // Smooth deceleration
          force3D: true,
          onUpdate: () => {
            currentX = gsap.getProperty(container, 'x') as number;
          },
          onComplete: () => {
            momentumAnimation = null;
          }
        });
      } else {
        // No momentum - snap to nearest focus point
        let targetX = currentX;
        
        // 🔥 USER REQUEST: Snap logic - prioritize card focus when swiping left
        // If swiping left (positive velocity or negative currentX), snap to card focus
        // Otherwise snap to section boundaries
        if (velocity > 0 || currentX < -50) {
          // Swiping left - snap to card focus position
          targetX = Math.max(cardFocusX, -maxScroll); // Don't go beyond maxScroll
        } else if (currentX > -50 && currentX < 0) {
          // Close to start - snap to beginning (stats+card section)
          targetX = 0;
        } else {
          // Otherwise - snap to description section
          targetX = -maxScroll;
        }
        
        momentumAnimation = gsap.to(container, {
          x: targetX,
          duration: 0.3,
          ease: 'power2.out',
          force3D: true,
          onUpdate: () => {
            currentX = gsap.getProperty(container, 'x') as number;
          },
          onComplete: () => {
            momentumAnimation = null;
          }
        });
      }
    };
    
    // Mouse handlers for desktop
    const handleMouseDown = (e: MouseEvent) => {
      // 🔥 USER REQUEST: Don't start dragging immediately - wait for actual movement
      // Just store initial position, don't set isDragging = true yet
      startX = e.clientX;
      lastX = startX;
      startTranslateX = currentX;
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
      
      if (Math.abs(velocity) > 0.05) {
        const momentum = velocity * 300;
        // Velocity: positive = left swipe → negative translateX
        let targetX = currentX - momentum;
        targetX = Math.max(-maxScroll, Math.min(0, targetX));
        
        momentumAnimation = gsap.to(container, {
          x: targetX,
          duration: 0.6,
          ease: 'power2.out',
          force3D: true,
          onUpdate: () => {
            currentX = gsap.getProperty(container, 'x') as number;
          },
          onComplete: () => {
            momentumAnimation = null;
          }
        });
      } else {
        // 🔥 USER REQUEST: Snap logic - prioritize card focus when swiping left
        let targetX = currentX;
        if (velocity > 0 || currentX < -50) {
          // Swiping left - snap to card focus position
          targetX = Math.max(cardFocusX, -maxScroll);
        } else if (currentX > -50 && currentX < 0) {
          // Close to start - snap to beginning
          targetX = 0;
        } else {
          // Otherwise - snap to description section
          targetX = -maxScroll;
        }
        
        momentumAnimation = gsap.to(container, {
          x: targetX,
          duration: 0.3,
          ease: 'power2.out',
          force3D: true,
          onUpdate: () => {
            currentX = gsap.getProperty(container, 'x') as number;
          },
          onComplete: () => {
            momentumAnimation = null;
          }
        });
      }
    };
    
    // Attach event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);
    
    // Store handlers for cleanup
    (container as any).__detailSwipeHandlers = {
      touchStart: handleTouchStart,
      touchMove: handleTouchMove,
      touchEnd: handleTouchEnd,
      mouseDown: handleMouseDown,
      mouseMove: handleMouseMove,
      mouseUp: handleMouseUp,
      quickSetX: quickSetX
    };
    
    logger.info('✅ Apple style GSAP smooth swipe initialized');
  }

  private async openBoardDetails(board: JourneyBoard, skipJourneyExit: boolean = false): Promise<void> {
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
    
    // Step 1: Exit animation on Journey screen (only if it's visible and not already hidden)
    if (!skipJourneyExit) {
      const journeyScreen = document.getElementById('journey-screen');
      if (journeyScreen && journeyScreen.style.opacity !== '0' && journeyScreen.style.visibility !== 'hidden') {
        const { animateCollectiblesScreenExit } = await import('../ui/collectibles-animations.js');
        await animateCollectiblesScreenExit();
        logger.info('✅ Journey screen exit animation completed');
      } else {
        logger.info('✅ Journey screen already hidden - skipping exit animation');
      }
    } else {
      logger.info('✅ Skipping Journey screen exit animation (already hidden)');
    }
    
    // Step 2: Now open detail modal with enter animation
    const detailModal = document.getElementById('collectibles-detail-modal');
    if (detailModal) {
      detailModal.removeAttribute('hidden');
      (detailModal as HTMLElement).style.display = 'flex';
      // Keep modal invisible until enter animation kicks in (prevents flash)
      (detailModal as HTMLElement).style.visibility = 'hidden';
      (detailModal as HTMLElement).style.opacity = '0';
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
      
      // Store board ID in modal for Play Board button
      detailModal.setAttribute('data-journey-board-id', board.id.toString());
      
      // 🔥 BUG FIX: Set card image - prepare for animation (will be animated, not always visible)
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
      
      // 🔥 CRITICAL: Ensure consistent padding on stats-card section (no right padding, container reduced by 200px)
      if (statsCardSection) {
        statsCardSection.style.padding = '0 0 24px 24px'; // No right padding (container reduced by 200px)
        statsCardSection.style.paddingTop = '0';
      }
      
      if (descEl) {
        descEl.textContent = "The board waits.\nA single move appears.\nEverything begins.";
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
          cubesEl.textContent = globalStats.cubesCracked.toLocaleString();
        }
        
        logger.info(`✅ Board stats displayed for board ${board.id}:`, {
          highScore: boardStats.highScore,
          longestCombo: boardStats.longestCombo,
          cubesCracked: globalStats.cubesCracked
        });
      }).catch((error) => {
        logger.warn('⚠️ Failed to load board stats:', error);
      });
      
      // 🔥 CLEAN START: Initialize simple swipe
      const swipeableContainer = detailModal.querySelector('.detail-swipeable-container') as HTMLElement;
      if (swipeableContainer) {
        gsap.set(swipeableContainer, { x: 0 });
        setTimeout(() => {
          this.initDetailModalSwipe(swipeableContainer);
          
          // 🔥 IMPERATIVE: Re-apply 80px margin and 140px width after swipe init
          const descElAfterInit = detailModal.querySelector('#detail-card-description') as HTMLElement;
          
          if (descElAfterInit) {
            if (!descElAfterInit.textContent || descElAfterInit.textContent.trim() === '') {
              descElAfterInit.textContent = "The board waits.\nA single move appears.\nEverything begins.";
            }
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
        }, 100);
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
        // Create new floating play button - EXACT same style as homepage slider CTA with shimmer
        const floatingPlayButton = document.createElement('button');
        floatingPlayButton.id = 'board-detail-play-button';
        floatingPlayButton.className = 'slide-button tap-scale menu-btn-primary';
        floatingPlayButton.textContent = 'Play';
        floatingPlayButton.setAttribute('type', 'button');
        floatingPlayButton.setAttribute('aria-label', 'Play Board');
        
        // Prevent dragging/moving the button
        floatingPlayButton.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        floatingPlayButton.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        
        // Add to modal - append to modal (fixed positioning)
        detailModal.appendChild(floatingPlayButton);
        
        // Fixed positioning at bottom, centered (same as collectibles-manager.ts)
        floatingPlayButton.style.setProperty('position', 'fixed', 'important');
        floatingPlayButton.style.setProperty('bottom', 'calc(40px + env(safe-area-inset-bottom, 0px))', 'important');
        floatingPlayButton.style.setProperty('left', '50%', 'important');
        floatingPlayButton.style.setProperty('width', '249px', 'important');
        floatingPlayButton.style.setProperty('max-width', '249px', 'important');
        floatingPlayButton.style.setProperty('z-index', '1001', 'important');
        floatingPlayButton.style.setProperty('pointer-events', 'auto', 'important');
        floatingPlayButton.style.setProperty('cursor', 'pointer', 'important');
        floatingPlayButton.style.setProperty('overflow', 'hidden', 'important');
        floatingPlayButton.style.setProperty('display', 'block', 'important');
        // 🔥 USER REQUEST: Transform will be set by GSAP (xPercent: -50 for centering)
        
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

          try { (window as any).playHaptic?.('light'); } catch {}

          if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
            JOURNEY_CARD_IDLE_BOUNCE.stop();
            logger.info('✅ Journey card idle bounce stopped');
          }

          // 🔥 USER REQUEST: Exit animation on detail modal only (no Journey screen exit - already hidden)
          const detailModalExitPromise = this.closeDetailModalWithExitAnimation(detailModal);
          await detailModalExitPromise;
          logger.info('✅ Detail modal exit animation completed');

          this.cleanup();

          const collectiblesManager = (window as any).collectiblesManager;
          if (collectiblesManager && typeof collectiblesManager.hideCollectibles === 'function') {
            (window as any).__ccJourneyExitMode = 'toGame';
            await collectiblesManager.hideCollectibles();
          }

          // Mark that we came from detail modal (for return on exit)
          (window as any).__ccCameFromDetailModal = true;
          (window as any).__ccDetailModalBoardId = boardIdForPlay;
          console.log(`🎯 Marked as coming from detail modal for board ${boardIdForPlay}`);

          // 🔥 CRITICAL: Check if function exists and call it
          if (typeof (window as any).startNewRunFromJourney === 'function') {
            console.log(`🎮 About to call startNewRunFromJourney with boardId: ${boardIdForPlay}`);
            logger.info(`🎮 Calling startNewRunFromJourney for board ${boardIdForPlay}`);
            try {
              await (window as any).startNewRunFromJourney(boardIdForPlay);
              console.log(`✅ startNewRunFromJourney call completed for board ${boardIdForPlay}`);
            } catch (error) {
              console.error(`❌ Error calling startNewRunFromJourney:`, error);
              logger.error(`❌ Error calling startNewRunFromJourney:`, error);
            }
          } else {
            console.error('❌ startNewRunFromJourney function NOT FOUND on window object!');
            logger.error('❌ startNewRunFromJourney function not found on window object!');
            // Try to find it
            console.log('🔍 Available window functions:', Object.keys(window).filter(k => k.includes('start') || k.includes('journey')));
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
          
          // Add click listener for Continue Board
          (newContinueBtn as HTMLElement).addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            logger.info(`🔄 Continue Board button clicked for board ${board.id}`);
            
            // 🔥 COMPREHENSIVE CLEANUP & EXIT ANIMATION SEQUENCE
            try {
              // Step 1: Stop Journey card idle bounce animations immediately
              if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
                JOURNEY_CARD_IDLE_BOUNCE.stop();
                logger.info('✅ Journey card idle bounce stopped');
              }
              
              // Step 2: Close detail modal with exit animation
              const detailModalExitPromise = this.closeDetailModalWithExitAnimation(detailModal);
              
              // Step 3: Close Journey screen with exit animation (runs in parallel with modal exit)
              const { animateCollectiblesScreenExit } = await import('../ui/collectibles-animations.js');
              const journeyExitPromise = animateCollectiblesScreenExit();
              
              // Step 4: Wait for both exit animations to complete
              await Promise.all([detailModalExitPromise, journeyExitPromise]);
              logger.info('✅ All exit animations completed');
              
              // Step 5: Cleanup Journey boards manager
              this.cleanup();
              
              // Step 6: Hide collectibles screen
              const collectiblesManager = (window as any).collectiblesManager;
              if (collectiblesManager && typeof collectiblesManager.hideCollectibles === 'function') {
                (window as any).__ccJourneyExitMode = 'toGame';
                await collectiblesManager.hideCollectibles();
              }
              
              // Step 7: Set Journey progression state
              const { journeyProgressionState } = await import('./journey-progression-state.js');
              journeyProgressionState.setLastOpenedBoardId(board.id);
              
              // Step 8: Continue game with saved state (resume interim game)
              if (typeof (window as any).continueGameWithSavedState === 'function') {
                (window as any).__ccTriggerHudDrop = true;
                await (window as any).continueGameWithSavedState();
              } else {
                logger.error('❌ continueGameWithSavedState function not found');
              }
            } catch (error) {
              logger.error(`❌ Failed to continue game from Journey board ${board.id}:`, error instanceof Error ? error.message : String(error));
            }
          });
          
          // Add touch listener for mobile
          (newContinueBtn as HTMLElement).addEventListener('touchend', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            logger.info(`🔄 Continue Board button touched (touchend) for board ${board.id}`);
            
            // 🔥 COMPREHENSIVE CLEANUP & EXIT ANIMATION SEQUENCE (same as click)
            try {
              // Step 1: Stop Journey card idle bounce animations immediately
              if (JOURNEY_CARD_IDLE_BOUNCE && typeof JOURNEY_CARD_IDLE_BOUNCE.stop === 'function') {
                JOURNEY_CARD_IDLE_BOUNCE.stop();
                logger.info('✅ Journey card idle bounce stopped');
              }
              
              // Step 2: Close detail modal with exit animation
              const detailModalExitPromise = this.closeDetailModalWithExitAnimation(detailModal);
              
              // Step 3: Close Journey screen with exit animation (runs in parallel with modal exit)
              const { animateCollectiblesScreenExit } = await import('../ui/collectibles-animations.js');
              const journeyExitPromise = animateCollectiblesScreenExit();
              
              // Step 4: Wait for both exit animations to complete
              await Promise.all([detailModalExitPromise, journeyExitPromise]);
              logger.info('✅ All exit animations completed');
              
              // Step 5: Cleanup Journey boards manager
              this.cleanup();
              
              // Step 6: Hide collectibles screen
              const collectiblesManager = (window as any).collectiblesManager;
              if (collectiblesManager && typeof collectiblesManager.hideCollectibles === 'function') {
                (window as any).__ccJourneyExitMode = 'toGame';
                await collectiblesManager.hideCollectibles();
              }
              
              // Step 7: Set Journey progression state
              const { journeyProgressionState } = await import('./journey-progression-state.js');
              journeyProgressionState.setLastOpenedBoardId(board.id);
              
              // 🔥 USER REQUEST: Mark that we came from Journey screen
              // This ensures exitToMenu returns to Journey (slide 1) instead of homepage (slide 0)
              (window as any).__ccCameFromJourney = true;
              (window as any).__ccCameFromHomepage = false;
              logger.info('🗺️ Marked as coming from Journey screen (interim Continue button)');
              
              // Step 8: Continue game with saved state (resume interim game)
              if (typeof (window as any).continueGameWithSavedState === 'function') {
                (window as any).__ccTriggerHudDrop = true;
                await (window as any).continueGameWithSavedState();
              } else {
                logger.error('❌ continueGameWithSavedState function not found');
              }
            } catch (error) {
              logger.error(`❌ Failed to continue game from Journey board ${board.id}:`, error instanceof Error ? error.message : String(error));
            }
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
      // Find stats section and stat icons
      const detailStatsSection = detailModal.querySelector('.detail-section-stats') as HTMLElement;
      const detailStatIcons = detailModal.querySelectorAll('.detail-stat-icon') as NodeListOf<HTMLElement>;
      const detailStatIconsArray = Array.from(detailStatIcons);
      
      // Content elements array (excluding header and card image - card is already animated separately)
      const contentElements = [
        detailRarityBadgeContainer,
        detailStatsSection,
        ...detailStatIconsArray,
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

      // 🔥 CRITICAL: Set initial state IMMEDIATELY (before showing modal) to prevent flash
      if (detailHeader) {
        gsap.set(detailHeader, {
          scale: 0,
          opacity: 0,
          visibility: 'hidden',
          force3D: true,
          immediateRender: true
        });
      }

      // Set initial state for content elements (NOT card image - card is always visible)
      // 🔥 BUG FIX: Separate PLAY button (CSS classes) from other elements (GSAP)
      const playButtonForInit = contentElements.find(el => el && el.id === 'board-detail-play-button');
      const otherElements = contentElements.filter(el => el && el.id !== 'board-detail-play-button');
      
      // PLAY button: use CSS classes (same as homepage CTA)
      if (playButtonForInit) {
        playButtonForInit.classList.remove('animate-enter', 'animate-exit', 'animate-reset');
        playButtonForInit.style.removeProperty('transform');
        playButtonForInit.style.removeProperty('transition');
      }
      
      // Other elements: use GSAP
      otherElements.forEach(el => {
        if (el) {
          gsap.killTweensOf(el); // 🔥 BUG FIX: Kill existing animations to prevent conflicts
          el.classList.remove('animate-enter-initial', 'animate-enter', 'animate-exit', 'animate-reset');
          el.style.transform = 'none';
          el.style.transition = 'none'; // 🔥 BUG FIX: Remove CSS transitions to prevent fade conflicts
        }
      });
      
      gsap.set(otherElements, {
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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Make modal visible
          detailModal.style.opacity = '1';
          detailModal.style.visibility = 'visible';

          // STEP 1: Header FIRST (0ms delay) - animates as group (includes divider and shadow)
          if (detailHeader) {
            gsap.set(detailHeader, { visibility: 'visible', immediateRender: true });
            gsap.to(detailHeader, {
              scale: 1,
              opacity: 1,
              duration: 0.5,
              ease: 'back.out(1.7)',
              delay: 0,
              force3D: true,
              immediateRender: false
            });
            logger.info('📊 Step 1: Detail header pop-in - FIRST');
          }

          // STEP 2: PLAY button SECOND (0ms delay, immediately after header, BEFORE card and content)
          // 🔥 USER REQUEST: PLAY button appears BEFORE container with card and stats
          const playButtonForEnter = contentElements.find(el => el && el.id === 'board-detail-play-button');
          const otherContentElements = contentElements.filter(el => el && el.id !== 'board-detail-play-button');
          
          if (playButtonForEnter) {
            playButtonForEnter.classList.remove('animate-exit', 'animate-reset', 'animate-enter');
            playButtonForEnter.style.removeProperty('transition');
            playButtonForEnter.style.visibility = 'hidden';
            void playButtonForEnter.offsetHeight; // Force reflow
            
            // Add animate-enter-initial class for initial state (preserves translateX(-50%))
            playButtonForEnter.classList.add('animate-enter-initial');
            void playButtonForEnter.offsetHeight; // Force reflow
            
            // Animate using CSS class (same as homepage CTA) - preserves translateX(-50%)
            // Start immediately after header (0ms delay)
            setTimeout(() => {
              playButtonForEnter.classList.remove('animate-enter-initial');
              playButtonForEnter.classList.add('animate-enter');
              playButtonForEnter.style.visibility = 'visible';
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
                  // 🔥 CRITICAL: Ensure card remains visible after animation
                  detailImage.style.visibility = 'visible';
                  detailImage.style.opacity = '1';
                  if (detailImgEl) {
                    detailImgEl.style.visibility = 'visible';
                    detailImgEl.style.opacity = '1';
                  }
                  logger.info('🃏 Card image animation completed - card is now visible');
                }
              }
            );
            logger.info('🃏 Step 3: Card image pop-in');
          }

          // STEP 4: Other content elements sequentially (staggered, after card)
          otherContentElements.forEach((element, index) => {
            const baseDelay = 0.18; // Start after card image (0.1 + 0.08)
            const stagger = 0.08;
            const delay = baseDelay + (index * stagger);
            
            // 🔥 BUG FIX: Ensure CSS transitions are disabled for GSAP scale animation
            if (element) {
              element.style.transition = 'none';
            }
            gsap.set(element, { visibility: 'visible', immediateRender: true });
            gsap.to(element, {
              scale: 1,
              opacity: 1,
              duration: 0.5,
              ease: 'back.out(1.7)',
              delay: delay,
              force3D: true,
              immediateRender: false
            });
          });
        });
      });
      
      // 🔥 CRITICAL: Replace collectibles-manager event listener with journey boards exit animation
      // This ensures X button uses GSAP exit animation (header as group) instead of CSS animation (child elements separately)
      if (detailCloseBtn) {
        // Remove any existing event listeners by cloning the button
        const newCloseBtn = detailCloseBtn.cloneNode(true) as HTMLElement;
        detailCloseBtn.parentNode?.replaceChild(newCloseBtn, detailCloseBtn);
        
        // Set pointer events explicitly to ensure it's always clickable
        newCloseBtn.style.pointerEvents = 'auto';
        newCloseBtn.style.zIndex = '2000000';
        newCloseBtn.style.position = 'relative';
        newCloseBtn.style.cursor = 'pointer';
        
        // Add click listener that uses journey boards exit animation (GSAP, header as group)
        const handleCloseClick = async (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          logger.info('🎁 Journey boards detail modal close button clicked - using GSAP exit animation');
          
          // Use journey boards exit animation (header animates as group)
          await this.closeDetailModalWithExitAnimation(detailModal);
          
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
          
          // Use journey boards exit animation (header animates as group)
          await this.closeDetailModalWithExitAnimation(detailModal);
          
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

    okBtn.addEventListener('click', () => {
      // Apply action to all selected boards
      selectedBoards.forEach(boardNum => {
        if (action === 'show') {
          this.unlockBoardByNumber(boardNum);
        } else {
          this.lockBoardByNumber(boardNum);
        }
      });
      document.body.removeChild(overlay);
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

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // Assemble modal
    modal.appendChild(title);
    modal.appendChild(grid);
    buttonContainer.appendChild(okBtn);
    buttonContainer.appendChild(closeBtn);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);
    
    // 🔥 iPad FIX: Ensure modal is added to body and visible
    document.body.appendChild(overlay);
    console.log('✅ Modal overlay added to body, z-index:', overlay.style.zIndex);
    
    // Force reflow to ensure modal is rendered
    void overlay.offsetHeight;

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });
    
    // 🔥 iPad FIX: Also add touch event for overlay
    overlay.addEventListener('touchend', (e) => {
      if (e.target === overlay) {
        e.preventDefault();
        document.body.removeChild(overlay);
      }
    });
  }

  private initJourneyButtons(): void {
    const unlockBtn = document.getElementById('journey-unlock-btn');
    if (unlockBtn) {
      // Remove existing listener if any to prevent duplicates
      const newUnlockBtn = unlockBtn.cloneNode(true);
      unlockBtn.parentNode?.replaceChild(newUnlockBtn, unlockBtn);
      
      // 🔥 iPad FIX: Add both click and touchend events for better iPad compatibility
      const handleUnlock = (e: Event) => {
        e.stopPropagation();
        console.log('🗺️ Journey Show Card button clicked/touched', e.type);
        this.showBoardPickerModal('show');
      };
      
      (newUnlockBtn as HTMLElement).addEventListener('click', handleUnlock);
      (newUnlockBtn as HTMLElement).addEventListener('touchend', handleUnlock, { passive: true });
      console.log('✅ Journey Show Card button listener attached');
    } else {
      console.warn('⚠️ journey-unlock-btn not found');
    }

    const hideBtn = document.getElementById('journey-hide-btn');
    if (hideBtn) {
      // Remove existing listener if any to prevent duplicates
      const newHideBtn = hideBtn.cloneNode(true);
      hideBtn.parentNode?.replaceChild(newHideBtn, hideBtn);
      
      // 🔥 iPad FIX: Add both click and touchend events for better iPad compatibility
      const handleHide = (e: Event) => {
        e.stopPropagation();
        console.log('🗺️ Journey Hide Card button clicked/touched', e.type);
        this.showBoardPickerModal('hide');
      };
      
      (newHideBtn as HTMLElement).addEventListener('click', handleHide);
      (newHideBtn as HTMLElement).addEventListener('touchend', handleHide, { passive: true });
      console.log('✅ Journey Hide Card button listener attached');
    } else {
      console.warn('⚠️ journey-hide-btn not found');
    }
  }
}

// Export singleton instance
export const journeyBoardsManager = new JourneyBoardsManager();
