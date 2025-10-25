// hud-components.ts
// UI components for HUD system

import { Container, Graphics, Text, Application, Stage } from 'pixi.js';
import { 
  HUD_HEIGHT, 
  HUD_PADDING, 
  TEXT_STYLES, 
  HUD_COLORS,
  HUD_POSITIONS
} from './hud-constants.js';
import { logger } from '../core/logger.js';
import {
  createStyledText,
  createHUDBackground,
  formatScore,
  formatCombo,
  getHUDRoot,
  setHUDRoot,
  setBoardText,
  setScoreText,
  setComboText
} from './hud-utils.js';

// Type definitions
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

interface UnifiedHudInfo {
  score: number;
  board: number;
  moves: number;
  combo: number;
}

/**
 * Create unified HUD container
 */
export function createUnifiedHudContainer(): HTMLElement {
  logger.info('🎨 Creating unified HUD container');
  
  const hudContainer = document.createElement('div');
  hudContainer.id = 'unified-hud';
  hudContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: ${HUD_HEIGHT}px;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    border-bottom: 2px solid #333;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 ${HUD_PADDING}px;
    z-index: 1000;
    font-family: 'Arial', sans-serif;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  `;
  
  // Create score section
  const scoreSection = createScoreSection();
  hudContainer.appendChild(scoreSection);
  
  // Create board section
  const boardSection = createBoardSection();
  hudContainer.appendChild(boardSection);
  
  // Create combo section
  const comboSection = createComboSection();
  hudContainer.appendChild(comboSection);
  
  logger.info('✅ Unified HUD container created');
  
  return hudContainer;
}

/**
 * Create score section
 */
function createScoreSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  `;
  
  const label = document.createElement('div');
  label.textContent = 'SCORE';
  label.style.cssText = `
    font-size: 12px;
    color: #ccc;
    margin-bottom: 2px;
  `;
  
  const value = document.createElement('div');
  value.id = 'hud-score';
  value.textContent = '0';
  value.style.cssText = `
    font-size: 24px;
    font-weight: bold;
    color: #fff;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  `;
  
  section.appendChild(label);
  section.appendChild(value);
  
  return section;
}

/**
 * Create board section
 */
function createBoardSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
  `;
  
  const label = document.createElement('div');
  label.textContent = 'BOARD';
  label.style.cssText = `
    font-size: 12px;
    color: #ccc;
    margin-bottom: 2px;
  `;
  
  const value = document.createElement('div');
  value.id = 'hud-board';
  value.textContent = '1';
  value.style.cssText = `
    font-size: 20px;
    font-weight: bold;
    color: #fff;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  `;
  
  section.appendChild(label);
  section.appendChild(value);
  
  return section;
}

/**
 * Create combo section
 */
function createComboSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  `;
  
  const label = document.createElement('div');
  label.textContent = 'COMBO';
  label.style.cssText = `
    font-size: 12px;
    color: #ccc;
    margin-bottom: 2px;
  `;
  
  const value = document.createElement('div');
  value.id = 'hud-combo';
  value.textContent = '';
  value.style.cssText = `
    font-size: 18px;
    font-weight: bold;
    color: #ffd700;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  `;
  
  section.appendChild(label);
  section.appendChild(value);
  
  return section;
}

/**
 * Create PIXI HUD container
 */
export function createPIXIHUDContainer(): Container {
  logger.info('🎨 Creating PIXI HUD container');
  
  const container = new Container();
  container.name = 'HUD_ROOT';
  
  // Create background
  const background = createHUDBackground(400, HUD_HEIGHT);
  container.addChild(background);
  
  // Create score text
  const scoreText = createStyledText('0', TEXT_STYLES.SCORE);
  scoreText.x = 20;
  scoreText.y = 20;
  scoreText.name = 'scoreText';
  container.addChild(scoreText);
  setScoreText(scoreText);
  
  // Create board text
  const boardText = createStyledText('1', TEXT_STYLES.BOARD);
  boardText.x = 200;
  boardText.y = 20;
  boardText.name = 'boardText';
  container.addChild(boardText);
  setBoardText(boardText);
  
  // Create combo text
  const comboText = createStyledText('', TEXT_STYLES.COMBO);
  comboText.x = 350;
  comboText.y = 20;
  comboText.name = 'comboText';
  container.addChild(comboText);
  setComboText(comboText);
  
  setHUDRoot(container);
  
  logger.info('✅ PIXI HUD container created');
  
  return container;
}

/**
 * Update HUD info
 */
export function updateHUDInfo(info: UnifiedHudInfo): void {
  logger.info('📊 Updating HUD info:', info);
  
  // Update score
  const scoreElement = document.getElementById('hud-score');
  if (scoreElement) {
    scoreElement.textContent = formatScore(info.score);
  }
  
  // Update board
  const boardElement = document.getElementById('hud-board');
  if (boardElement) {
    boardElement.textContent = info.board.toString();
  }
  
  // Update combo
  const comboElement = document.getElementById('hud-combo');
  if (comboElement) {
    comboElement.textContent = formatCombo(info.combo);
  }
}

/**
 * Get unified HUD info
 */
export function getUnifiedHudInfo(): UnifiedHudInfo | null {
  const scoreElement = document.getElementById('hud-score');
  const boardElement = document.getElementById('hud-board');
  const comboElement = document.getElementById('hud-combo');
  
  if (!scoreElement || !boardElement || !comboElement) {
    return null;
  }
  
  return {
    score: parseInt(scoreElement.textContent || '0'),
    board: parseInt(boardElement.textContent || '1'),
    moves: parseInt(movesElement.textContent || '0'),
    combo: parseInt(comboElement.textContent?.replace('x', '') || '0')
  };
}

/**
 * Layout HUD
 */
export function layoutHUD({ app, top = 8 }: LayoutParams): void {
  logger.info('📐 Laying out HUD');
  
  const hudRoot = getHUDRoot();
  if (!hudRoot) return;
  
  // Position HUD at top of screen
  hudRoot.x = 0;
  hudRoot.y = top;
  
  // Center horizontally
  hudRoot.x = (app.screen.width - hudRoot.width) / 2;
  
  logger.info('✅ HUD laid out');
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
  
  // Hide if requested
  if (initialHide) {
    hudContainer.visible = false;
  }
  
  logger.info('✅ HUD initialized');
}

/**
 * Create HUD progress bar
 */
export function createHUDProgressBar(width: number, height: number): Graphics {
  logger.info('📊 Creating HUD progress bar');
  
  const progressBar = new Graphics();
  
  // Background
  progressBar.fill({ color: HUD_COLORS.BACKGROUND, alpha: 0.8 })
    .roundRect(0, 0, width, height, 4);
  
  // Border
  progressBar.stroke({ width: 1, color: HUD_COLORS.BORDER, alpha: 0.8 })
    .roundRect(0, 0, width, height, 4);
  
  return progressBar;
}

/**
 * Update HUD progress bar
 */
export function updateHUDProgressBar(progressBar: Graphics, progress: number): void {
  if (!progressBar) return;
  
  const width = progressBar.width;
  const height = progressBar.height;
  
  // Clear previous progress
  progressBar.clear();
  
  // Background
  progressBar.fill({ color: HUD_COLORS.BACKGROUND, alpha: 0.8 })
    .roundRect(0, 0, width, height, 4);
  
  // Progress fill
  const fillWidth = width * Math.max(0, Math.min(1, progress));
  progressBar.fill({ color: HUD_COLORS.SUCCESS, alpha: 0.9 })
    .roundRect(0, 0, fillWidth, height, 4);
  
  // Border
  progressBar.stroke({ width: 1, color: HUD_COLORS.BORDER, alpha: 0.8 })
    .roundRect(0, 0, width, height, 4);
}

/**
 * Create HUD button
 */
export function createHUDButton(text: string, width: number, height: number): Graphics {
  logger.info(`🎨 Creating HUD button: ${text}`);
  
  const button = new Graphics();
  
  // Background
  button.fill({ color: HUD_COLORS.BACKGROUND, alpha: 0.9 })
    .roundRect(0, 0, width, height, 8);
  
  // Border
  button.stroke({ width: 2, color: HUD_COLORS.BORDER, alpha: 0.8 })
    .roundRect(0, 0, width, height, 8);
  
  // Add text
  const buttonText = createStyledText(text, {
    fontSize: 14,
    fontWeight: 'bold',
    fill: HUD_COLORS.SCORE,
    stroke: 0x000000,
    strokeThickness: 1
  });
  
  buttonText.x = (width - buttonText.width) / 2;
  buttonText.y = (height - buttonText.height) / 2;
  button.addChild(buttonText);
  
  return button;
}

// All functions are already exported individually above
