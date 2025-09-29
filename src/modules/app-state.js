// src/modules/app-state.js
// Centralized mutable state for the game (single source of truth).
// Everything else imports/reads/writes from here to avoid circular deps.

import { Application, Container, Graphics, Rectangle } from 'pixi.js';
import { gsap } from 'gsap';
import {
  COLS, ROWS, TILE, GAP,
  HUD_H, HUD_PAD_X, HUD_TEXT, HUD_DIV,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_WILD,
  SFX_EXPLODE, ENDLESS, STORAGE_BEST,
  REFILL_ON_SIX_BY_DEPTH, REFILL_AFTER_SMALL_EVERY, POWERUP_WILD_CHANCE,
} from './constants.js';

// Singleton state
export const STATE = {
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
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_WILD,
  SFX_EXPLODE, ENDLESS, STORAGE_BEST,
  REFILL_ON_SIX_BY_DEPTH, REFILL_AFTER_SMALL_EVERY, POWERUP_WILD_CHANCE,
};
