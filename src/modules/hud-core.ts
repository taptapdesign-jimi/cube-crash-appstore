// hud-core.ts
// Core HUD functionality for CubeCrash

import { Container, Graphics, Text, Application, Stage } from 'pixi.js';
import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import { HUD_H, COLS, ROWS, TILE, GAP } from './constants.js';

// Import refactored modules
import {
  bounceText,
  createStyledText,
  createHUDBackground,
  formatScore,
  formatCombo,
  getHUDRoot,
  setHUDRoot,
  getBoardText,
  setBoardText,
  getScoreText,
  setScoreText,
  getComboText,
  setComboText,
  isBoardTweening,
  setBoardTweening,
  isScoreTweening,
  setScoreTweening,
  isComboTweening,
  setComboTweening,
  getPrevBoard,
  setPrevBoard,
  getPrevScore,
  setPrevScore,
  getPrevCombo,
  setPrevCombo,
  calculateBoardSize,
  isHUDVisible,
  showHUD,
  hideHUD,
  updateHUDVisibility,
  updateHUDAlpha,
  getHUDPosition,
  setHUDPosition,
  getHUDScale,
  setHUDScale,
  resetHUDState,
  validateHUDParams
} from './hud-utils.js';

import {
  animateHUDDrop,
  animateTextBounce,
  animateComboBump,
  animateScoreIncrease,
  animateBoardUpdate,
  animateComboUpdate,
  animateHUDFadeIn,
  animateHUDFadeOut,
  animateHUDSlideIn,
  animateHUDSlideOut,
  animateHUDScale,
  animateTextColorChange,
  killContainerAnimations,
  killTextAnimations
} from './hud-animations.js';

import {
  createUnifiedHudContainer,
  createPIXIHUDContainer,
  updateHUDInfo,
  getUnifiedHudInfo,
  layoutHUD,
  initHUD,
  createHUDProgressBar,
  updateHUDProgressBar,
  createHUDButton
} from './hud-components.js';


// Type definitions
interface PlayHudDropParams {
  duration?: number;
}

interface UpdateHUDParams {
  score?: number;
  board?: number;
  moves?: number;
  combo?: number;
}

interface BumpComboOptions {
  peak?: number;
  back?: number;
  up?: number;
  down?: number;
}

interface BounceOptions {
  peak?: number;
  back?: number;
  up?: number;
  down?: number;
}

interface BoardSize {
  w: number;
  h: number;
}

interface UnifiedHudInfo {
  score: number;
  board: number;
  moves: number;
  combo: number;
}

interface LayoutParams {
  app: Application;
  top?: number;
}

interface InitHUDParams {
  stage: Stage;
  app: Application;
  top?: number;
  initialHide?: boolean;
}

// Global state
let HUD_ROOT: Container | null = null;
let boardText: Text | null = null;
let scoreText: Text | null = null;
let comboText: Text | null = null;
let __boardTweening = false;
let __scoreTweening = false;
let __comboTweening = false;
let __prevBoard = 0;
let __prevScore = 0;
let __prevCombo = 0;

/**
 * Create unified HUD container
 */
export function createUnifiedHudContainer(): HTMLElement {
  return createUnifiedHudContainer();
}

/**
 * Animate unified HUD drop
 */
export function animateUnifiedHudDrop(): void {
  logger.info('🎬 Animating unified HUD drop');
  animateHUDDrop();
}

/**
 * Get unified HUD info
 */
export function getUnifiedHudInfo(): UnifiedHudInfo | null {
  return getUnifiedHudInfo();
}

/**
 * Layout HUD
 */
export function layout({ app, top = 8 }: LayoutParams): void {
  logger.info('📐 Laying out HUD');
  layoutHUD({ app, top });
}

/**
 * Initialize HUD
 */
export function initHUD({ stage, app, top = 8, initialHide = false }: InitHUDParams): void {
  logger.info('🚀 Initializing HUD');
  
  // Create PIXI HUD container
  const hudContainer = createPIXIHUDContainer();
  
  // Add to stage
  stage.addChild(hudContainer);
  
  // Layout HUD
  layoutHUD({ app, top });
  
  // Optionally hide initially
  if (initialHide) {
    hideHUD();
  }
  
  logger.info('✅ HUD initialized');
}

/**
 * Play HUD drop animation
 */
export function playHudDrop({ duration = 0.8 }: PlayHudDropParams = {}): void {
  logger.info(`🎬 Playing HUD drop: ${duration}s`);
  animateHUDDrop({ duration });
}

/**
 * Update HUD
 */
export function updateHUD({ score, board, moves, combo }: UpdateHUDParams): void {
  logger.info('📊 Updating HUD:', { score, board, moves, combo });
  
  // Validate parameters
  const validated = validateHUDParams({ score, board, moves, combo });
  
  // Update score
  if (validated.score !== undefined) {
    setScore(validated.score);
  }
  
  // Update board
  if (validated.board !== undefined) {
    setBoard(validated.board);
  }
  
  // Update combo
  if (validated.combo !== undefined) {
    setCombo(validated.combo);
  }
  
  // Update HUD info
  const hudInfo = getUnifiedHudInfo();
  if (hudInfo) {
    updateHUDInfo(hudInfo);
  }
}

/**
 * Set score
 */
export function setScore(v: number): void {
  logger.info(`💰 Setting score: ${v}`);
  
  const scoreText = getScoreText();
  if (!scoreText) return;
  
  const prevScore = getPrevScore();
  
  if (isScoreTweening()) {
    gsap.killTweensOf(scoreText);
  }
  
  setScoreTweening(true);
  
  animateScoreIncrease(scoreText, prevScore, v).then(() => {
    setScoreTweening(false);
    setPrevScore(v);
  });
}

/**
 * Set board
 */
export function setBoard(v: number): void {
  logger.info(`🎯 Setting board: ${v}`);
  
  const boardText = getBoardText();
  if (!boardText) return;
  
  const prevBoard = getPrevBoard();
  
  if (isBoardTweening()) {
    gsap.killTweensOf(boardText);
  }
  
  setBoardTweening(true);
  
  animateBoardUpdate(boardText, prevBoard, v).then(() => {
    setBoardTweening(false);
    setPrevBoard(v);
  });
}

/**
 * Set combo
 */
export function setCombo(v: number): void {
  logger.info(`🔥 Setting combo: ${v}`);
  
  const comboText = getComboText();
  if (!comboText) return;
  
  const prevCombo = getPrevCombo();
  
  if (isComboTweening()) {
    gsap.killTweensOf(comboText);
  }
  
  setComboTweening(true);
  
  animateComboUpdate(comboText, prevCombo, v).then(() => {
    setComboTweening(false);
    setPrevCombo(v);
  });
}

/**
 * Reset combo
 */
export function resetCombo(): void {
  logger.info('🔄 Resetting combo');
  setCombo(0);
}

/**
 * Bump combo
 */
export function bumpCombo(opts: BumpComboOptions = {}): void {
  logger.info('🔥 Bumping combo');
  
  const comboText = getComboText();
  if (!comboText) return;
  
  animateComboBump(comboText, opts);
}

/**
 * Show HUD
 */
export function showHUD(): void {
  logger.info('👁️ Showing HUD');
  showHUD();
}

/**
 * Hide HUD
 */
export function hideHUD(): void {
  logger.info('🙈 Hiding HUD');
  hideHUD();
}

/**
 * Toggle HUD visibility
 */
export function toggleHUD(): void {
  const visible = isHUDVisible();
  if (visible) {
    hideHUD();
  } else {
    showHUD();
  }
}

/**
 * Get HUD state
 */
export function getHUDState(): {
  visible: boolean;
  position: { x: number; y: number };
  scale: { x: number; y: number };
  score: number;
  board: number;
  combo: number;
} {
  return {
    visible: isHUDVisible(),
    position: getHUDPosition(),
    scale: getHUDScale(),
    score: getPrevScore(),
    board: getPrevBoard(),
    combo: getPrevCombo()
  };
}

/**
 * Reset HUD state
 */
export function resetHUD(): void {
  logger.info('🔄 Resetting HUD');
  resetHUDState();
}

/**
 * Destroy HUD
 */
export function destroyHUD(): void {
  logger.info('🗑️ Destroying HUD');
  
  const hudRoot = getHUDRoot();
  if (hudRoot) {
    killContainerAnimations(hudRoot);
    if (hudRoot.parent) {
      hudRoot.parent.removeChild(hudRoot);
    }
  }
  
  resetHUDState();
  setHUDRoot(null);
}

// Export core HUD functions
// All functions are already exported individually above
