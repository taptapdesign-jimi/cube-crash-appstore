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

// Helper to convert pixels to percentage (based on typical mobile screen width ~375px)
function pxToPercent(px: number, baseWidth: number = 375): number {
  return (px / baseWidth) * 100;
}

// Card positions - specify in PIXELS, system converts to PERCENTAGES
// Format: { x: pxToPercent(pixels_from_left), top: pxToPercent(pixels_from_top), width, height, rotation }
// IMPORTANT: When adding new cards, DO NOT change existing card positions!
// Standard card width - all cards must be the same size
const STANDARD_CARD_WIDTH = 109.82; // Use consistent width for all cards

const CARD_POSITIONS = [
  // Card 01 - FIRST DAY (0px from left edge, 24px below Boards title, rotated +4° clockwise - reversed)
  { x: pxToPercent(0), top: pxToPercent(24), width: STANDARD_CARD_WIDTH, height: 150, rotation: 4 },
  // Card 02 - SO SPECIAL (centered horizontally 50%, 89px from top, rotated -3° counter-clockwise - reversed)
  { x: 50, top: pxToPercent(89), width: STANDARD_CARD_WIDTH, height: 150, rotation: -3 },
  // Card 03 - ALL STAR (0px from right edge, 154px + 8px = 162px from top, rotated +6° clockwise - reversed)
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH), top: pxToPercent(154 + 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: 6 },
  // Card 04 - FLYING UP (centered horizontally 50%, 277px + 40px - 16px = 301px from top, rotated 2° clockwise)
  { x: 50, top: pxToPercent(277 + 40 - 16), width: STANDARD_CARD_WIDTH, height: 150, rotation: 2 },
  // Card 05 - PLANNER (-8px from left edge - intentionally pushed left, 277px + 86px + 24px = 387px from top, rotated -3° counter-clockwise)
  { x: pxToPercent(-8), top: pxToPercent(277 + 86 + 24), width: STANDARD_CARD_WIDTH, height: 150, rotation: -3 },
  // Card 06 - (0px from right edge, 80px below card 5 = 363px + 80px = 443px, rotated -3° counter-clockwise)
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH), top: pxToPercent(363 + 80), width: STANDARD_CARD_WIDTH, height: 150, rotation: -3 },
  // Card 07 - (64px from left edge, 80px below card 6 = 443px + 80px = 523px from top, rotated +3° clockwise)
  { x: pxToPercent(64), top: pxToPercent(443 + 80), width: STANDARD_CARD_WIDTH, height: 150, rotation: 3 },
  // Card 08 - (20px + 16px = 36px from right edge, 80px below card 7 = 523px + 80px = 603px from top, rotated -3° counter-clockwise)
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH + 36), top: pxToPercent(523 + 80), width: STANDARD_CARD_WIDTH, height: 150, rotation: -3 },
  // Card 09 - (50px - 4px = 46px from left edge, 80px below card 8 = 603px + 80px = 683px from top, rotated -9° counter-clockwise)
  { x: pxToPercent(46), top: pxToPercent(603 + 80), width: STANDARD_CARD_WIDTH, height: 150, rotation: -9 },
  // Card 10 - (84px + 8px = 92px from left edge, 811px from top, rotated +2° clockwise)
  { x: pxToPercent(76 + 16 - 4 - 4 + 8), top: pxToPercent(683 + 80 + 80 - 24 - 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: 2 },
  // Card 11 - (16px + 16px = 32px from right edge, 875px from top, rotated -2° counter-clockwise)
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH + 32), top: pxToPercent(811 + 80 - 16), width: STANDARD_CARD_WIDTH, height: 150, rotation: -2 },
  // Card 12 - (18px - 8px = 10px from left edge, 80px below card 11 + 16px = 875px + 80px + 16px = 971px from top, rotated +3° clockwise)
  { x: pxToPercent(24 - 6 - 8), top: pxToPercent(875 + 80 + 16), width: STANDARD_CARD_WIDTH, height: 150, rotation: 3 },
  // Card 13 - (152px from left edge, 1007px + 2px = 1009px from top, rotated -4° counter-clockwise)
  { x: pxToPercent(120 + 32), top: pxToPercent(971 + 80 - 36 - 8 + 2), width: STANDARD_CARD_WIDTH, height: 150, rotation: -4 },
  // Card 14 - (0px from left edge, 1105px + 6px = 1111px from top, rotated -6° counter-clockwise)
  { x: pxToPercent(0), top: pxToPercent(1009 + 80 + 16 + 6), width: STANDARD_CARD_WIDTH, height: 150, rotation: -6 },
  // Card 15 - (4px from right edge, 1159px from top, rotated +6° clockwise)
  { x: 100 - pxToPercent(STANDARD_CARD_WIDTH + 4), top: pxToPercent(1111 + 80 - 40 + 8), width: STANDARD_CARD_WIDTH, height: 150, rotation: 6 },
  // Card 16 - (102px - 6px = 96px from left edge, 1269px from top, rotated +3° clockwise)
  { x: pxToPercent(106 - 4 - 6), top: pxToPercent(1159 + 80 + 34 - 4), width: STANDARD_CARD_WIDTH, height: 150, rotation: 3 },
];


class JourneyBoardsManager {
  private boards: JourneyBoard[] = [];
  private container: HTMLElement | null = null;

  constructor() {
    this.initializeBoards();
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
    container.innerHTML = '';

    // Create background image container (behind cards)
    // NOTE: Must compensate for .collectibles-scrollable padding (40px + safe-area)
    const bgContainer = document.createElement('div');
    bgContainer.className = 'journey-bg-container';
    bgContainer.style.position = 'absolute';
    bgContainer.style.top = '40px'; // 56px - 16px = 40px below Boards subtitle
    // Compensate for parent padding to stretch edge-to-edge using CSS variables
    bgContainer.style.left = 'calc(-1 * var(--pad-left, 40px))'; // Negative margin to compensate parent padding
    bgContainer.style.right = 'calc(-1 * var(--pad-right, 40px))'; // Negative margin to compensate parent padding
    bgContainer.style.width = 'calc(100% + var(--pad-left, 40px) + var(--pad-right, 40px))'; // Full width including compensation
    bgContainer.style.margin = '0';
    bgContainer.style.padding = '0';
    bgContainer.style.zIndex = '1';
    bgContainer.style.overflow = 'visible'; // Allow full image to show
    
    const bgImage = document.createElement('img');
    bgImage.src = './assets/journey assets/1-16bg.png';
    bgImage.alt = 'Journey background';
    bgImage.style.width = '100%'; // Stretch from edge to edge
    bgImage.style.height = 'auto'; // Maintain aspect ratio
    bgImage.style.display = 'block';
    bgImage.style.margin = '0';
    bgImage.style.padding = '0';
    // No object-fit needed - width: 100% + height: auto maintains aspect ratio naturally
    bgContainer.appendChild(bgImage);
    container.appendChild(bgContainer);

    // Create cards container (above background)
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'journey-cards-container';
    cardsContainer.style.position = 'relative';
    cardsContainer.style.zIndex = '2';
    container.appendChild(cardsContainer);

    // Render cards only (no environment elements, no pathway lines)
    this.boards.forEach((board, index) => {
      const cardElement = this.createBoardCard(board, index);
      cardsContainer.appendChild(cardElement);
    });
  }

  private createBoardCard(board: JourneyBoard, index: number): HTMLElement {
    const position = CARD_POSITIONS[index] || { x: pxToPercent(24), top: pxToPercent(24), rotation: 5, width: STANDARD_CARD_WIDTH, height: 150 };
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'journey-board-card-wrapper';
    cardWrapper.style.position = 'absolute';
    
    // FINAL positions - ALL in percentages (pixels are auto-converted)
    cardWrapper.style.left = `${position.x}%`;
    cardWrapper.style.top = `${position.top}%`;
    
    // Cards with x: 50 are centered horizontally using translateX(-50%)
    // Other cards: positioned from left edge
    if (position.x === 50) {
      cardWrapper.style.transform = `translateX(-50%) rotate(${position.rotation}deg)`;
    } else {
      cardWrapper.style.transform = `rotate(${position.rotation}deg)`;
    }
    
    cardWrapper.style.zIndex = '10';
    // All cards must have the same size - use position width or fallback to standard
    const cardWidth = position.width || STANDARD_CARD_WIDTH;
    const cardHeight = position.height || 150;
    cardWrapper.style.width = `${cardWidth}px`;
    cardWrapper.style.height = `${cardHeight}px`;
    // Ensure dimensions are applied (override any CSS)
    cardWrapper.style.setProperty('width', `${cardWidth}px`, 'important');
    cardWrapper.style.setProperty('height', `${cardHeight}px`, 'important');
    
    // Ensure cards don't move when other elements are added
    cardWrapper.style.willChange = 'transform';
    cardWrapper.style.margin = '0';
    cardWrapper.style.display = 'block';

    const card = document.createElement('div');
    card.className = `journey-board-card ${board.unlocked ? 'unlocked' : 'locked'}`;
    card.dataset.boardId = board.id.toString();
    card.dataset.boardNumber = board.id.toString().padStart(2, '0');
    card.style.width = '100%';
    card.style.height = '100%';
    card.style.cursor = 'pointer';

    if (board.unlocked) {
      // Card image only (no badge, no banner, no overlay)
      const image = document.createElement('img');
      image.src = board.imagePath || '';
      image.alt = board.name || `Board ${board.id}`;
      image.className = 'journey-board-image';
      image.style.width = '100%';
      image.style.height = '100%';
      image.style.objectFit = 'contain';
      image.style.display = 'block';
      card.appendChild(image);

      // Add click handler to open details screen
      card.addEventListener('click', () => {
        this.openBoardDetails(board);
      });
    } else {
      // Locked card placeholder
      const number = document.createElement('div');
      number.className = 'journey-board-number';
      number.textContent = board.id.toString().padStart(2, '0');
      card.appendChild(number);
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
}

// Export singleton instance
export const journeyBoardsManager = new JourneyBoardsManager();
