// src/modules/constants.js
// PIXI/GSAP putanje ostaju kao i do sada u ostalim fajlovima

// Grid - responsive based on screen size
function getGridDimensions() {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // iPad and tablet (768px - 1024px)
    if (width >= 768 && width <= 1024) {
      return { COLS: 6, ROWS: 8 };
    }
    // Desktop and larger
    else if (width > 1024) {
      return { COLS: 5, ROWS: 9 };
    }
    // Mobile (default)
    else {
      return { COLS: 5, ROWS: 9 };
    }
  }
  // Fallback for server-side rendering
  return { COLS: 5, ROWS: 9 };
}

const gridDims = getGridDimensions();
export const COLS = gridDims.COLS;
export const ROWS = gridDims.ROWS;
export const TILE = 128;
export const GAP  = 20;

// Debug log for grid dimensions
console.log(`🎮 Grid dimensions: ${COLS}x${ROWS} (screen: ${typeof window !== 'undefined' ? window.innerWidth : 'unknown'}px)`);

// HUD
export const HUD_H     = 60;
export const HUD_PAD_X = 16;
export const HUD_TEXT  = 0x6b5a4b;
export const HUD_DIV   = 0x6b5a4b;

// Assets (relative so it works under /cube-crash/)
export const ASSET_TILE        = './assets/tile.png';
export const ASSET_NUMBERS     = './assets/tile_numbers.png';
export const ASSET_NUMBERS2    = './assets/tile_numbers2.png';
export const ASSET_NUMBERS3    = './assets/tile_numbers3.png';
export const ASSET_NUMBERS4    = './assets/tile_numbers4.png';
export const ASSET_WILD        = './assets/wild.png';
export const ASSET_MYSTERY     = './assets/mystery-box.png';
export const ASSET_COIN        = './assets/gold-coin.png';
export const SFX_EXPLODE       = './assets/explode.mp3';

// Pips (kvadrati s 4px radiusom, bliže centru)
export const PIP_COLOR         = 0x6B5A4B;
export const PIP_ALPHA         = 0.90;
export const PIP_RADIUS        = 6;
export const PIP_SQUARE        = true;
export const PIPS_INNER_FACTOR = 0.40; // manja vrijednost = veći padding od ruba

// Shadow (Figma referenca: X=1, Y=4, Blur≈10, boja #BDA38D)
export const SHADOW_COLOR     = 0xBDA38D;
export const SHADOW_ALPHA     = 0.35;
export const SHADOW_OFFSET_X  = 1;
export const SHADOW_OFFSET_Y  = 4;
export const SHADOW_BLUR      = 10;   // jačina blura

// --- Endless / Power-ups scaffolding (append-only) ---
export const ENDLESS = true;                                  // uključi Endless run
export const STORAGE_BEST = 'cc_best_score_v1';

// Nakon 6-ice: broj novih kockica ovisno o stack depthu (1..4)
export const REFILL_ON_SIX_BY_DEPTH = [2, 2, 2, 2];

// Nakon svakog malog mergea (2..5) otvori 1 novu
export const REFILL_AFTER_SMALL_EVERY = 1;

// Bazna šansa za Wild (0% – prvi Wild rješavamo garancijom)
export const POWERUP_WILD_CHANCE = 0.00;

// Wild konfiguracija
export const WILD_GUARANTEE_AFTER_FIRST_SIX = true; // prvu 6-icu prati garantirani Wild u refill-u
export const WILD_GUARANTEE_COUNT = 1;              // broj garantirano Wild pločica nakon prve 6-ice
