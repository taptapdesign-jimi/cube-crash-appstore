// hud-utils.ts
// Utility functions for HUD system

import { Container, Graphics, Text, Application, Stage } from 'pixi.js';
import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import { 
  HUD_HEIGHT, 
  HUD_PADDING, 
  TEXT_STYLES, 
  HUD_COLORS,
  BOUNCE_OPTIONS,
  EASING
} from './hud-constants.js';

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
 * Bounce text animation
 */
export function bounceText(text: Text, opts: BounceOptions = {}): void {
  const { peak = 1.2, back = 1.05, up = 0.08, down = 0.2 } = opts;
  
  gsap.fromTo(text.scale,
    { x: 1, y: 1 },
    {
      x: peak,
      y: peak,
      duration: up,
      ease: EASING.EASE_OUT,
      onComplete: () => {
        gsap.to(text.scale, {
          x: back,
          y: back,
          duration: down,
          ease: EASING.EASE_OUT
        });
      }
    }
  );
}

/**
 * Create text with style
 */
export function createStyledText(text: string, style: any): Text {
  const textObj = new Text({
    text: text,
    style: style
  });
  
  return textObj;
}

/**
 * Create HUD background
 */
export function createHUDBackground(width: number, height: number): Graphics {
  const bg = new Graphics();
  bg.fill({ color: HUD_COLORS.BACKGROUND, alpha: 0.9 })
    .roundRect(0, 0, width, height, 12);
  
  // Add border
  bg.stroke({ width: 2, color: HUD_COLORS.BORDER, alpha: 0.8 })
    .roundRect(0, 0, width, height, 12);
  
  return bg;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format score with K/M suffixes
 */
export function formatScore(score: number): string {
  if (score >= 1000000) {
    return (score / 1000000).toFixed(1) + 'M';
  } else if (score >= 1000) {
    return (score / 1000).toFixed(1) + 'K';
  }
  return score.toString();
}

/**
 * Format combo with multiplier
 */
export function formatCombo(combo: number): string {
  if (combo <= 1) return '';
  return `x${combo}`;
}

/**
 * Get HUD root container
 */
export function getHUDRoot(): Container | null {
  return HUD_ROOT;
}

/**
 * Set HUD root container
 */
export function setHUDRoot(root: Container | null): void {
  HUD_ROOT = root;
}

/**
 * Get board text
 */
export function getBoardText(): Text | null {
  return boardText;
}

/**
 * Set board text
 */
export function setBoardText(text: Text | null): void {
  boardText = text;
}

/**
 * Get score text
 */
export function getScoreText(): Text | null {
  return scoreText;
}

/**
 * Set score text
 */
export function setScoreText(text: Text | null): void {
  scoreText = text;
}

/**
 * Get combo text
 */
export function getComboText(): Text | null {
  return comboText;
}

/**
 * Set combo text
 */
export function setComboText(text: Text | null): void {
  comboText = text;
}

/**
 * Check if board is tweening
 */
export function isBoardTweening(): boolean {
  return __boardTweening;
}

/**
 * Set board tweening state
 */
export function setBoardTweening(value: boolean): void {
  __boardTweening = value;
}

/**
 * Check if score is tweening
 */
export function isScoreTweening(): boolean {
  return __scoreTweening;
}

/**
 * Set score tweening state
 */
export function setScoreTweening(value: boolean): void {
  __scoreTweening = value;
}

/**
 * Check if combo is tweening
 */
export function isComboTweening(): boolean {
  return __comboTweening;
}

/**
 * Set combo tweening state
 */
export function setComboTweening(value: boolean): void {
  __comboTweening = value;
}

/**
 * Get previous board value
 */
export function getPrevBoard(): number {
  return __prevBoard;
}

/**
 * Set previous board value
 */
export function setPrevBoard(value: number): void {
  __prevBoard = value;
}

/**
 * Get previous score value
 */
export function getPrevScore(): number {
  return __prevScore;
}

/**
 * Set previous score value
 */
export function setPrevScore(value: number): void {
  __prevScore = value;
}

/**
 * Get previous combo value
 */
export function getPrevCombo(): number {
  return __prevCombo;
}

/**
 * Set previous combo value
 */
export function setPrevCombo(value: number): void {
  __prevCombo = value;
}

/**
 * Calculate board size
 */
export function calculateBoardSize(): BoardSize {
  // Implement actual board size calculation
  const boardElement = document.getElementById('board');
  if (boardElement) {
    const rect = boardElement.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }
  return { w: 400, h: 400 };
}

/**
 * Check if HUD is visible
 */
export function isHUDVisible(): boolean {
  return HUD_ROOT !== null && HUD_ROOT.visible;
}

/**
 * Show HUD
 */
export function showHUD(): void {
  if (HUD_ROOT) {
    HUD_ROOT.visible = true;
    HUD_ROOT.alpha = 1;
  }
}

/**
 * Hide HUD
 */
export function hideHUD(): void {
  if (HUD_ROOT) {
    HUD_ROOT.visible = false;
    HUD_ROOT.alpha = 0;
  }
}

/**
 * Update HUD visibility
 */
export function updateHUDVisibility(visible: boolean): void {
  if (HUD_ROOT) {
    HUD_ROOT.visible = visible;
  }
}

/**
 * Update HUD alpha
 */
export function updateHUDAlpha(alpha: number): void {
  if (HUD_ROOT) {
    HUD_ROOT.alpha = alpha;
  }
}

/**
 * Get HUD position
 */
export function getHUDPosition(): { x: number; y: number } {
  if (!HUD_ROOT) return { x: 0, y: 0 };
  return { x: HUD_ROOT.x, y: HUD_ROOT.y };
}

/**
 * Set HUD position
 */
export function setHUDPosition(x: number, y: number): void {
  if (HUD_ROOT) {
    HUD_ROOT.x = x;
    HUD_ROOT.y = y;
  }
}

/**
 * Get HUD scale
 */
export function getHUDScale(): { x: number; y: number } {
  if (!HUD_ROOT) return { x: 1, y: 1 };
  return { x: HUD_ROOT.scale.x, y: HUD_ROOT.scale.y };
}

/**
 * Set HUD scale
 */
export function setHUDScale(x: number, y: number): void {
  if (HUD_ROOT) {
    HUD_ROOT.scale.set(x, y);
  }
}

/**
 * Reset HUD state
 */
export function resetHUDState(): void {
  __boardTweening = false;
  __scoreTweening = false;
  __comboTweening = false;
  __prevBoard = 0;
  __prevScore = 0;
  __prevCombo = 0;
  
  logger.info('🔄 HUD state reset');
}

/**
 * Validate HUD parameters
 */
export function validateHUDParams(params: UpdateHUDParams): UpdateHUDParams {
  const validated: UpdateHUDParams = {};
  
  if (typeof params.score === 'number' && params.score >= 0) {
    validated.score = params.score;
  }
  
  if (typeof params.board === 'number' && params.board >= 0) {
    validated.board = params.board;
  }
  
  if (typeof params.moves === 'number' && params.moves >= 0) {
    validated.moves = params.moves;
  }
  
  if (typeof params.combo === 'number' && params.combo >= 0) {
    validated.combo = params.combo;
  }
  
  return validated;
}

// All functions are already exported individually above
