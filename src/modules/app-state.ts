// src/modules/app-state.ts
// Centralized mutable state for the game (single source of truth).
// Everything else imports/reads/writes from here to avoid circular deps.

import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import { gsap } from 'gsap';
import {
  COLS, ROWS, TILE, GAP,
  HUD_H, HUD_PAD_X, HUD_TEXT, HUD_DIV,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD,
  SFX_EXPLODE, ENDLESS, STORAGE_BEST,
  REFILL_ON_SIX_BY_DEPTH, REFILL_AFTER_SMALL_EVERY, POWERUP_WILD_CHANCE,
} from './constants.js';

// Types
interface GameState {
  // PIXI scene
  app: Application | null;
  stage: Container | null;
  board: Container | null;
  boardBG: Graphics | null;
  divider: Graphics | null;
  hud: Container | null;

  // grid & tiles
  grid: (Container | null)[][];
  tiles: Container[];

  // gameplay
  score: number;
  level: number;
  moves: number;
  bestScore: number;
  wildGuaranteedOnce: boolean;
  busyEnding: boolean;

  // HUD refs
  scoreNumText: Text | null;
  movesNumText: Text | null;

  // drag manager
  drag: any | null;
}

// Singleton state
export const STATE: GameState = {
  // PIXI scene
  app: null,
  stage: null,
  board: null,
  boardBG: null,
  divider: null,
  hud: null,

  // grid & tiles
  grid: [],
  tiles: [],

  // gameplay
  score: 0,
  level: 1,
  moves: 0,
  bestScore: +(localStorage.getItem(STORAGE_BEST) || 0),
  wildGuaranteedOnce: false,
  busyEnding: false,

  // HUD refs
  scoreNumText: null,
  movesNumText: null,

  // drag manager
  drag: null,
};

// Re-exports for convenience (keeps old imports working if needed)
export const app = STATE.app;
export const stage = STATE.stage;
export const board = STATE.board;
export const divider = STATE.divider;
export const hud = STATE.hud;

export {
  COLS, ROWS, TILE, GAP,
  HUD_H, HUD_PAD_X, HUD_TEXT, HUD_DIV,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD,
  SFX_EXPLODE, ENDLESS, STORAGE_BEST,
  REFILL_ON_SIX_BY_DEPTH, REFILL_AFTER_SMALL_EVERY, POWERUP_WILD_CHANCE,
};

