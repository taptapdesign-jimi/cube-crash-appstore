// app-core.ts
// Core boot and initialization logic for CubeCrash
import { Application, Container, Graphics, Text, Rectangle, Texture, Sprite, SCALE_MODES } from 'pixi.js';
import { gsap } from 'gsap';

import {
  COLS, ROWS, TILE, GAP, HUD_H,
  ASSET_TILE, ASSET_NUMBERS, ASSET_NUMBERS2, ASSET_NUMBERS3, ASSET_NUMBERS4, ASSET_WILD
} from './constants.js';
import { STATE } from './app-state.js';
import { container } from '../core/dependency-injection.js';
import { logger } from '../core/logger.js';

// Type definitions for app-core.ts
interface Tile extends Container {
  value: number;
  locked: boolean;
  special?: string;
  base?: Sprite;
  num?: Text;
  pips?: Graphics;
  rotG?: Container;
  hover?: Graphics;
  _spawned?: boolean;
  isWild?: boolean;
  isWildFace?: boolean;
  stackDepth?: number;
  gridX?: number;
  gridY?: number;
  occluder?: Graphics;
  ghostFrame?: Graphics;
  _wildMergeTarget?: number;
  refreshShadow?: () => void;
}

interface Board extends Container {
  _wildZoomTl?: gsap.core.Timeline;
}

interface GameState {
  app: Application | null;
  stage: Container | null;
  board: Board | null;
  boardBG: Graphics | null;
  hud: Container | null;
  grid: (Tile | null)[][];
  tiles: Tile[];
  score: number;
  level: number;
  moves: number;
  boardNumber: number;
  wildMeter: number;
  bestScore: number;
  combo: number;
  wildSpawnInProgress: boolean;
  busyEnding: boolean;
  gamePaused: boolean;
}

// Core constants
const MOVES_MAX = 50;
const COMBO_CAP = 99;
const COMBO_IDLE_RESET_MS = 2000;
const WILD_INC_SMALL = 0.10;

/**
 * Get board size
 */
function boardSize(): { w: number; h: number } {
  return {
    w: COLS * TILE + (COLS - 1) * GAP,
    h: ROWS * TILE + (ROWS - 1) * GAP
  };
}
const WILD_INC_BIG = 0.22;
const SCORE_CAP = 999999;

// Global state variables
let app: Application | null = null;
let stage: Container | null = null;
let board: Board | null = null;
let boardBG: Graphics | null = null;
let hud: Container | null = null;
let grid: (Tile | null)[][] = [];
let tiles: Tile[] = [];
let score = 0;
let level = 1;
let moves = 0;
let boardNumber = 1;
let wildMeter = 0;
let bestScore = 0;
let combo = 0;
let wildSpawnInProgress = false;
let busyEnding = false;
let gamePaused = false;

// Combo decay timer
let comboDecayTimer: NodeJS.Timeout | null = null;

// Wild spawn retry timer
let wildSpawnRetryTimer: NodeJS.Timeout | null = null;

/**
 * Schedule combo decay timer
 */
function scheduleComboDecay(): void {
  if (comboDecayTimer) {
    clearTimeout(comboDecayTimer);
  }
  
  comboDecayTimer = setTimeout(() => {
    if (combo > 0) {
      combo = Math.max(0, combo - 1);
      hudSetCombo(combo);
      if (combo > 0) {
        scheduleComboDecay();
      }
    }
  }, COMBO_IDLE_RESET_MS);
}

/**
 * Set combo value in HUD
 */
function hudSetCombo(v: number): void {
  const comboEl = document.getElementById('combo-value');
  if (comboEl) {
    comboEl.textContent = v.toString();
  }
}

/**
 * Reset combo in HUD
 */
function hudResetCombo(): void {
  combo = 0;
  hudSetCombo(0);
  if (comboDecayTimer) {
    clearTimeout(comboDecayTimer);
    comboDecayTimer = null;
  }
}

/**
 * Create empty grid
 */
function createEmptyGrid(): (Tile | null)[][] {
  const newGrid: (Tile | null)[][] = [];
  for (let r = 0; r < ROWS; r++) {
    newGrid[r] = [];
    for (let c = 0; c < COLS; c++) {
      newGrid[r][c] = null;
    }
  }
  return newGrid;
}

/**
 * Sync shared state
 */
function syncSharedState(): GameState {
  return {
    app,
    stage,
    board,
    boardBG,
    hud,
    grid,
    tiles,
    score,
    level,
    moves,
    boardNumber,
    wildMeter,
    bestScore,
    combo,
    wildSpawnInProgress,
    busyEnding,
    gamePaused
  };
}

/**
 * Boot function - Initialize PIXI app
 */
export async function boot(): Promise<void> {
  logger.info('Initializing PIXI app', 'app-core');
  
  // CRITICAL: Check for unsaved high score on boot
  setTimeout(() => {
    if (typeof window.checkForUnsavedHighScore === 'function') {
      window.checkForUnsavedHighScore();
    }
  }, 2000);
  
  logger.info('Boot function started successfully', 'app-core');
  
  // DESTROY existing app if it exists
  if (app && app.canvas) {
    logger.info('Destroying existing PIXI app', 'app-core');
    try {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    } catch (e) {
      logger.error('Error destroying app', 'app-core', e);
    }
    app = null;
  }
  
  // Clear any existing canvas
  const host = document.getElementById('app') || document.body;
  const existingCanvas = host.querySelector('canvas');
  if (existingCanvas) {
    existingCanvas.remove();
  }
  
          logger.info('Creating fresh PIXI app', 'app-core');
          app = new Application();
          await app.init({
            resizeTo: window,
            background: 0xf5f5f5, // Game background color
            antialias: false, // Disable antialiasing for pixel-perfect rendering
            resolution: window.devicePixelRatio || 1,
            powerPreference: "high-performance" // Optimize for performance
          });
  
  // Add fade in animation for background transition
  const canvas = app.view as HTMLCanvasElement;
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 0.6s ease';
  setTimeout(() => {
    if (canvas) {
      canvas.style.opacity = '1';
    }
  }, 100);

  // Add canvas to DOM
  host.appendChild(canvas);
  
  // Get stage reference
  stage = app.stage;
  
  // Set up stage properties
  stage.sortableChildren = true;
  
  // Initialize game state
  grid = createEmptyGrid();
  tiles = [];
  score = 0;
  level = 1;
  moves = MOVES_MAX;
  boardNumber = 1;
  wildMeter = 0;
  bestScore = 0;
  combo = 0;
  wildSpawnInProgress = false;
  busyEnding = false;
  gamePaused = false;
  
  // Load best score from localStorage
  try {
    const savedBestScore = localStorage.getItem('cubeCrashBestScore');
    if (savedBestScore) {
      bestScore = parseInt(savedBestScore, 10) || 0;
    }
  } catch (error) {
    logger.warn('Failed to load best score', 'app-core', error);
  }
  
  logger.info('PIXI app initialized successfully', 'app-core');
  logger.info('Game state initialized', 'app-core');
  
  // Update STATE object with current values
  STATE.app = app;
  STATE.stage = stage;
  STATE.board = board;
  STATE.boardBG = boardBG;
  STATE.hud = hud;
  STATE.grid = grid;
  STATE.tiles = tiles;
  STATE.score = score;
  STATE.level = level;
  STATE.moves = moves;
  STATE.bestScore = bestScore;
  STATE.busyEnding = busyEnding;
  
  // Set up dependency injection container
  container.setMultiple({
    app,
    stage,
    board,
    boardBG,
    hud,
    grid,
    tiles,
    score,
    level,
    moves,
    boardNumber,
    wildMeter,
    bestScore,
    combo,
    wildSpawnInProgress,
    busyEnding,
    gamePaused
  });
}

/**
 * Layout function - Set up initial layout
 */
export async function layout(): Promise<void> {
  if (!app || !stage) {
    logger.warn('Cannot layout - app or stage not initialized', 'app-core');
    return;
  }
  
  logger.info('Setting up layout', 'app-core');
  
  // Create board container
  board = new Container() as Board;
  board.sortableChildren = true;
  
  // Create board background
  boardBG = new Graphics();
  
  // Create HUD container
  hud = new Container();
  
  // Add containers to stage
  stage.addChild(boardBG);
  stage.addChild(board);
  stage.addChild(hud);
  
  // Set up board size and position
  const boardDimensions = boardSize();
  board.x = (app.screen.width - boardDimensions.w) / 2;
  board.y = (app.screen.height - boardDimensions.h) / 2 + HUD_H / 2;
  
  // Set up HUD position
  hud.x = 0;
  hud.y = 0;
  
  logger.info('Layout setup complete', 'app-core');
  
  // Create initial tiles
  await createInitialTiles();
  
  // Initialize HUD
  await initHUDSystem();
  
  // Initialize drag system
  await initDragSystem();
  
  // Update dependency injection container
  container.setMultiple({
    board,
    boardBG,
    hud
  });
}

/**
 * Create initial tiles
 */
async function createInitialTiles(): Promise<void> {
  logger.info('Creating initial tiles', 'app-core');
  
  // Import board functions
  const { createTile } = await import('./board.js');
  
  // Clear existing tiles
  tiles = [];
  grid = [];
  
  // Initialize grid
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = null;
    }
  }
  
  // Create initial tiles
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const value = Math.floor(Math.random() * 6) + 1; // Random value 1-6
      const tile = createTile({ 
        board: board!, 
        grid, 
        tiles, 
        c, 
        r, 
        val: value, 
        locked: false 
      });
      
      if (tile) {
        grid[r][c] = tile;
        tiles.push(tile);
      }
    }
  }
  
  logger.info(`Created ${tiles.length} initial tiles`, 'app-core');
}

/**
 * Initialize HUD
 */
async function initHUDSystem(): Promise<void> {
  logger.info('Initializing HUD', 'app-core');
  
  if (!app || !stage) {
    logger.warn('Cannot initialize HUD - app or stage not initialized', 'app-core');
    return;
  }
  
  // Import HUD functions
  const { initHUD } = await import('./hud-core.js');
  
  // Initialize HUD with required parameters
  initHUD({ stage: stage!, app: app!, top: 8, initialHide: false });
  
  logger.info('HUD initialized', 'app-core');
}

/**
 * Initialize drag system
 */
async function initDragSystem(): Promise<void> {
  logger.info('Initializing drag system', 'app-core');
  
  if (!app || !stage || !board) {
    logger.warn('Cannot initialize drag system - app, stage, or board not initialized', 'app-core');
    return;
  }
  
  // Import drag functions
  const { initDrag } = await import('./drag-core.js');
  
  // Initialize drag system with required parameters
  initDrag({
    app,
    board,
    TILE: 128, // Default tile size
    getTiles: () => tiles,
    cellXY: (x: number, y: number) => ({ x: x * 128 + 64, y: y * 128 + 64 }),
    merge: () => {} // Placeholder merge function
  });
  
  logger.info('Drag system initialized', 'app-core');
}

/**
 * Get cell position
 */
function cellXY(c: number, r: number): { x: number; y: number } {
  return {
    x: c * (TILE + GAP),
    y: r * (TILE + GAP)
  };
}

// All functions are already exported individually above
