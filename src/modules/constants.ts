import { logger } from '../core/logger.js';
// src/modules/constants.ts
// PIXI/GSAP putanje ostaju kao i do sada u ostalim fajlovima

// Types
export interface GridDimensions {
  COLS: number;
  ROWS: number;
}

export interface ShadowConfig {
  color: number;
  alpha: number;
  offsetX: number;
  offsetY: number;
  blur: number;
}

// Grid - responsive based on screen size
export function getGridDimensions(): GridDimensions {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // iPad detection: check for iPad-specific characteristics
    // iPad sizes: 768x1024 (portrait), 1024x768 (landscape), 834x1194, 1194x834, etc.
    const isIPad = 
      // Check by user agent
      /iPad/.test(navigator.userAgent) ||
      // Check by screen dimensions (iPad range)
      ((width >= 768 && width <= 1400) && (height >= 768 && height <= 1400)) ||
      // Check for touch support and larger screen (tablet-like)
      (navigator.maxTouchPoints > 1 && width >= 768 && width <= 1400);
    
    if (isIPad) {
      // iPad: 7 columns x 9 rows (extra width and height for larger layout)
      return { COLS: 7, ROWS: 9 };
    }
    
    // Mobile and Desktop: 5x9 board (standard gameplay)
    return { COLS: 5, ROWS: 9 };
  }
  
  // Fallback for server-side rendering
  return { COLS: 5, ROWS: 9 };
}

const gridDims = getGridDimensions();
export const COLS: number = gridDims.COLS;
export const ROWS: number = gridDims.ROWS;

// Debug log with detailed screen info
if (typeof window !== 'undefined') {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;
  logger.info(`🎮 Grid dimensions: ${COLS}x${ROWS} (screen: ${width}x${height}, landscape: ${isLandscape})`);
} else {
  logger.info(`🎮 Grid dimensions: ${COLS}x${ROWS} (server-side)`);
}

export const TILE: number = 128;
export const GAP: number = 20;

// HUD
export const HUD_H: number = 60;
export const HUD_PAD_X: number = 16;
export const HUD_TEXT: number = 0x6b5a4b;
export const HUD_DIV: number = 0x6b5a4b;

// Assets (relative so it works under /cube-crash/)
export const ASSET_TILE: string = './assets/tile.png';
export const ASSET_NUMBERS: string = './assets/tile_numbers.png';
export const ASSET_NUMBERS2: string = './assets/tile_numbers2.png';
export const ASSET_NUMBERS3: string = './assets/tile_numbers3.png';
export const ASSET_NUMBERS4: string = './assets/tile_numbers4.png';
export const ASSET_WILD: string = './assets/wild.png';
export const ASSET_WILD_MAGNET: string = './assets/wild-magnet.png';
export const ASSET_WILD_JUICE: string = './assets/wild-juice.png';
export const ASSET_WILD_TNT: string = './assets/shop/explosion pack/tnt.png';
export const ASSET_MYSTERY: string = './assets/mystery-box.png';
export const ASSET_COIN: string = './assets/gold-coin.png';
export const SFX_EXPLODE: string = './assets/explode.mp3';

// Pips (kvadrati s 4px radiusom, bliže centru)
export const PIP_COLOR: number = 0x815A42;
export const PIP_ALPHA: number = 0.90;
export const PIP_RADIUS: number = 6;
export const PIP_SQUARE: boolean = true;
export const PIPS_INNER_FACTOR: number = 0.40; // manja vrijednost = veći padding od ruba

// Shadow (Figma referenca: X=1, Y=4, Blur≈10, boja #BDA38D)
export const SHADOW_COLOR: number = 0xBDA38D;
export const SHADOW_ALPHA: number = 0.35;
export const SHADOW_OFFSET_X: number = 1;
export const SHADOW_OFFSET_Y: number = 4;
export const SHADOW_BLUR: number = 10;   // jačina blura

// --- Endless / Power-ups scaffolding (append-only) ---
export const ENDLESS: boolean = true;                                  // uključi Endless run
export const STORAGE_BEST: string = 'cc_best_score_v1';

// Nakon 6-ice: broj novih kockica ovisno o stack depthu (1..4)
export const REFILL_ON_SIX_BY_DEPTH: number[] = [2, 2, 2, 2];

// Nakon svakog malog mergea (2..5) otvori 1 novu
export const REFILL_AFTER_SMALL_EVERY: number = 1;

// Bazna šansa za Wild (0% – prvi Wild rješavamo garancijom)
export const POWERUP_WILD_CHANCE: number = 0.00;

// Wild konfiguracija
export const WILD_GUARANTEE_AFTER_FIRST_SIX: boolean = true; // prvu 6-icu prati garantirani Wild u refill-u
export const WILD_GUARANTEE_COUNT: number = 1;              // broj garantirano Wild pločica nakon prve 6-ice
