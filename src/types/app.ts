// Type definitions for app.js

import type { Application, Container, Graphics, Text, Rectangle, Texture, Sprite } from 'pixi.js';

// Game state types
export interface GameState {
  score: number;
  bestScore: number;
  moves: number;
  level: number;
  wildProgress: number;
  grid: (any | null)[][];
  tiles: any[];
  gameEnded: boolean;
  timestamp: number;
}

// PIXI types
export interface PIXIApp {
  app: Application;
  stage: Container;
  board: Container;
  boardBG: Graphics;
  hud: Container;
  backgroundLayer?: Container;
}

// Game constants
export interface GameConstants {
  COLS: number;
  ROWS: number;
  TILE: number;
  GAP: number;
  HUD_H: number;
  MOVES_MAX: number;
  COMBO_CAP: number;
  COMBO_IDLE_RESET_MS: number;
}

// Animation types
export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
  onComplete?: () => void;
}

// Effect types
export interface EffectConfig {
  x: number;
  y: number;
  scale?: number;
  duration?: number;
  delay?: number;
}

// HUD types
export interface HUDConfig {
  score: number;
  moves: number;
  level: number;
  wildProgress: number;
  combo: number;
}

// Spawn types
export interface SpawnConfig {
  c: number;
  r: number;
  val: number;
  locked: boolean;
  special?: string;
}

// Merge types
export interface MergeConfig {
  src: any;
  dst: any;
  mult: number;
  combo: number;
}

// Export types (commented out to avoid conflicts)
// export type { GameState, PIXIApp, GameConstants, AnimationConfig, EffectConfig, HUDConfig, SpawnConfig, MergeConfig };
