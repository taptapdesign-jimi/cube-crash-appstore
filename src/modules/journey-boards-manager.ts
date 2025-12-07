// Journey Boards Manager
// Manages rendering of 25 board cards in Journey screen
// 
// IMPORTANT: This system uses PIXEL-TO-PERCENTAGE conversion for positioning
// - You specify positions in PIXELS
// - System automatically converts to PERCENTAGES
// - This system is ONLY and EXCLUSIVELY used in Journey screen
// - Cards can be positioned individually anywhere you want

import { logger } from '../core/logger.js';

export interface JourneyBoard {
  id: number;
  unlocked: boolean;
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
  // Card 02 - SO SPECIAL (centered horizontally 50%, 89px - 24px = 65px from top, rotated -3° counter-clockwise - reversed) - moved up 24px
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

  constructor() {
    this.initializeBoards();
    this.loadBoardsState();
  }

  /**
   * Clean up journey board elements when screen is hidden
   */
  public cleanup(): void {
    // Remove background and cards containers from journey screen
    const journeyScreen = document.getElementById('collectibles-screen');
    if (journeyScreen) {
      const bgContainer = journeyScreen.querySelector('.journey-bg-container');
      const cardsContainer = journeyScreen.querySelector('.journey-cards-container');
      
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
  }

  private initializeBoards(): void {
    // Initialize first 5 boards
    this.boards = [
      {
        id: 1,
        unlocked: true,
        imagePath: this.getBoardImagePath(1),
        name: this.getBoardName(1),
      },
      {
        id: 2,
        unlocked: true,
        imagePath: this.getBoardImagePath(2),
        name: this.getBoardName(2),
      },
      {
        id: 3,
        unlocked: true,
        imagePath: this.getBoardImagePath(3),
        name: this.getBoardName(3),
      },
      {
        id: 4,
        unlocked: true,
        imagePath: this.getBoardImagePath(4),
        name: this.getBoardName(4),
      },
      {
        id: 5,
        unlocked: true,
        imagePath: this.getBoardImagePath(5),
        name: this.getBoardName(5),
      },
      {
        id: 6,
        unlocked: true,
        imagePath: this.getBoardImagePath(6),
        name: this.getBoardName(6),
      },
      {
        id: 7,
        unlocked: true,
        imagePath: this.getBoardImagePath(7),
        name: this.getBoardName(7),
      },
      {
        id: 8,
        unlocked: true,
        imagePath: this.getBoardImagePath(8),
        name: this.getBoardName(8),
      },
      {
        id: 9,
        unlocked: true,
        imagePath: this.getBoardImagePath(9),
        name: this.getBoardName(9),
      },
      {
        id: 10,
        unlocked: true,
        imagePath: this.getBoardImagePath(10),
        name: this.getBoardName(10),
      },
      {
        id: 11,
        unlocked: true,
        imagePath: this.getBoardImagePath(11),
        name: this.getBoardName(11),
      },
      {
        id: 12,
        unlocked: true,
        imagePath: this.getBoardImagePath(12),
        name: this.getBoardName(12),
      },
      {
        id: 13,
        unlocked: true,
        imagePath: this.getBoardImagePath(13),
        name: this.getBoardName(13),
      },
      {
        id: 14,
        unlocked: true,
        imagePath: this.getBoardImagePath(14),
        name: this.getBoardName(14),
      },
      {
        id: 15,
        unlocked: true,
        imagePath: this.getBoardImagePath(15),
        name: this.getBoardName(15),
      },
      {
        id: 16,
        unlocked: true,
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

  public renderBoards(): void {
    const container = document.getElementById('journey-boards-container');
    if (!container) {
      logger.warn('⚠️ Journey boards container not found');
      return;
    }

    this.container = container;
    
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
    
    // Convert top position to pixels (relative to background start)
    const topPercent = typeof position.top === 'number' ? position.top : parseFloat(String(position.top || 0));
    // topPercent is percentage of background height
    const topPx = FIXED_BG_TOP_PX + (topPercent / 100) * bgHeightPx;
    
    // Set absolute position using pixels
    cardWrapper.style.position = 'absolute';
    if (position.x === 50) {
      cardWrapper.style.left = '50%';
      cardWrapper.style.transform = `translateX(-50%) rotate(${position.rotation}deg)`;
    } else {
      cardWrapper.style.left = `${leftPx}px`;
      cardWrapper.style.transform = `rotate(${position.rotation}deg)`;
    }
    cardWrapper.style.top = `${topPx}px`;
    
    // Set card dimensions in pixels
    const cardWidth = position.width || STANDARD_CARD_WIDTH;
    const cardHeight = position.height || 150;
    cardWrapper.style.width = `${cardWidth}px`;
    cardWrapper.style.height = `${cardHeight}px`;
    cardWrapper.style.pointerEvents = 'auto'; // Enable clicks on cards
    cardWrapper.style.zIndex = '10';
    
    // Create card element (same as before)
    const card = document.createElement('div');
    card.className = `journey-board-card ${board.unlocked ? 'unlocked' : 'locked'}`;
    card.dataset.boardId = board.id.toString();
    card.dataset.boardNumber = board.id.toString().padStart(2, '0');

    if (board.unlocked) {
      // Unlocked card - show image
      const image = document.createElement('img');
      image.src = board.imagePath || '';
      image.alt = board.name || `Board ${board.id}`;
      image.className = 'journey-board-image';
      card.appendChild(image);
      
      // Add click handler to open details screen
      card.addEventListener('click', () => {
        this.openBoardDetails(board);
      });
    } else {
      // Locked card placeholder
      const lockedContainer = document.createElement('div');
      lockedContainer.className = 'journey-board-locked-container';
      
      const number = document.createElement('div');
      number.className = 'journey-board-number';
      number.textContent = board.id.toString().padStart(2, '0');
      
      lockedContainer.appendChild(number);
      card.appendChild(lockedContainer);
    }

    cardWrapper.appendChild(card);
    return cardWrapper;
  }

  private openBoardDetails(board: JourneyBoard): void {
    // Use collectibles manager to show card detail (same as collectibles screen)
    if (typeof (window as any).showCollectibleDetail === 'function') {
      (window as any).showCollectibleDetail('common-1', 'common');
    } else {
      // Fallback: Open collectibles detail modal directly
      const detailModal = document.getElementById('collectibles-detail-modal');
      if (detailModal) {
        // Set card image
        const imageEl = detailModal.querySelector('#detail-card-image');
        if (imageEl && board.imagePath) {
          imageEl.innerHTML = `<img src="${board.imagePath}" alt="${board.name}" style="width: 100%; height: 100%; object-fit: contain;" />`;
        }

        // Set card description
        const descEl = detailModal.querySelector('#detail-card-description');
        if (descEl) {
          descEl.textContent = board.name || `Board ${board.id}`;
        }

        // Show modal
        detailModal.hidden = false;
        detailModal.style.display = 'block';
      } else {
        logger.warn('⚠️ Collectibles detail modal not found');
      }
    }
  }


  public updateCounter(): void {
    const counter = document.getElementById('boards-counter');
    if (counter) {
      const unlockedCount = this.boards.filter(b => b.unlocked).length;
      counter.textContent = `${unlockedCount.toString().padStart(2, '0')}/25`;
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

  public unlockBoardByNumber(boardNumber: number): boolean {
    if (boardNumber < 1 || boardNumber > 16) return false;
    
    const board = this.boards.find(b => b.id === boardNumber);
    if (!board) return false;
    
    if (!board.unlocked) {
      board.unlocked = true;
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
    
    if (board.unlocked) {
      board.unlocked = false;
      this.saveBoardsState();
      this.renderBoards();
      this.updateCounter();
      logger.info(`🗺️ Journey board ${boardNumber.toString().padStart(2, '0')} locked.`);
      return true;
    }
    return false;
  }

  private saveBoardsState(): void {
    try {
      const state = this.boards.map(b => ({ id: b.id, unlocked: b.unlocked }));
      localStorage.setItem('journey_boards_state', JSON.stringify(state));
    } catch (error) {
      logger.warn('Failed to save journey boards state:', error instanceof Error ? error.message : String(error));
    }
  }

  private loadBoardsState(): void {
    try {
      const saved = localStorage.getItem('journey_boards_state');
      if (saved) {
        const state = JSON.parse(saved);
        state.forEach((savedBoard: { id: number; unlocked: boolean }) => {
          const board = this.boards.find(b => b.id === savedBoard.id);
          if (board) {
            board.unlocked = savedBoard.unlocked;
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to load journey boards state:', error instanceof Error ? error.message : String(error));
    }
  }

  public showBoardPickerModal(action: 'show' | 'hide'): void {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-picker-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100001;
      backdrop-filter: blur(4px);
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'card-picker-modal';
    modal.style.cssText = `
      background: white;
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
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
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
      (newUnlockBtn as HTMLElement).addEventListener('click', () => {
        console.log('🗺️ Journey Show Card button clicked');
        this.showBoardPickerModal('show');
      });
      console.log('✅ Journey Show Card button listener attached');
    } else {
      console.warn('⚠️ journey-unlock-btn not found');
    }

    const hideBtn = document.getElementById('journey-hide-btn');
    if (hideBtn) {
      // Remove existing listener if any to prevent duplicates
      const newHideBtn = hideBtn.cloneNode(true);
      hideBtn.parentNode?.replaceChild(newHideBtn, hideBtn);
      (newHideBtn as HTMLElement).addEventListener('click', () => {
        console.log('🗺️ Journey Hide Card button clicked');
        this.showBoardPickerModal('hide');
      });
      console.log('✅ Journey Hide Card button listener attached');
    } else {
      console.warn('⚠️ journey-hide-btn not found');
    }
  }
}

// Export singleton instance
export const journeyBoardsManager = new JourneyBoardsManager();
