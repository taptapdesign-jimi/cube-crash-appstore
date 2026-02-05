// @ts-nocheck
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
import uiManager from './ui-manager.js';

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
  
  // Close button section (replaces former board slot)
  const closeSection = createCloseButtonSection();
  hudContainer.appendChild(closeSection);
  
  // Create score section
  const scoreSection = createScoreSection();
  hudContainer.appendChild(scoreSection);
  
  // Create combo section
  const comboSection = createComboSection();
  hudContainer.appendChild(comboSection);
  
  ensureBoardIndicator();
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
    align-items: center;
    text-align: center;
    flex: 1;
  `;
  
  const label = document.createElement('div');
  label.textContent = 'SCORE';
  label.style.cssText = `
    font-size: 12px;
    color: #ccc;
    margin-bottom: 2px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    text-align: center;
    width: 100%;
  `;
  
  const value = document.createElement('div');
  value.id = 'hud-score';
  value.textContent = '0';
  value.style.cssText = `
    font-size: 24px;
    font-weight: bold;
    color: #fff;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    width: 100%;
  `;
  
  section.appendChild(label);
  section.appendChild(value);
  
  return section;
}

/**
 * Create close button section (replaces board indicator slot)
 */
function createCloseButtonSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: flex-start;
  `;
  
  const button = document.createElement('button');
  button.id = 'hud-close-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Close');
  button.style.cssText = `
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: none;
    background: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 18px rgba(90, 47, 26, 0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  `;
  // 🔥 FIX: Store handlers for cleanup
  const handlers = {
    pointerdown: () => { button.style.transform = 'scale(0.92)'; },
    pointerup: () => { button.style.transform = 'scale(1)'; },
    pointerleave: () => { button.style.transform = 'scale(1)'; },
    click: () => handleHUDClose()
  };
  
  button.addEventListener('pointerdown', handlers.pointerdown);
  button.addEventListener('pointerup', handlers.pointerup);
  button.addEventListener('pointerleave', handlers.pointerleave);
  button.addEventListener('click', handlers.click);
  
  // Store cleanup function on button
  (button as any)._cleanupHandlers = () => {
    button.removeEventListener('pointerdown', handlers.pointerdown);
    button.removeEventListener('pointerup', handlers.pointerup);
    button.removeEventListener('pointerleave', handlers.pointerleave);
    button.removeEventListener('click', handlers.click);
  };
  
  const icon = document.createElement('img');
  icon.src = './assets/close-icon.png';
  icon.srcset = './assets/close-icon.png 1x, ./assets/close-icon@3x.png 2x, ./assets/close-icon@3x.png 3x';
  icon.alt = '';
  icon.style.cssText = `
    width: 18px;
    height: 18px;
    object-fit: contain;
    pointer-events: none;
  `;
  button.appendChild(icon);
  
  section.appendChild(button);
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
    flex: 1;
    text-align: right;
  `;
  
  const label = document.createElement('div');
  label.textContent = 'COMBO';
  label.style.cssText = `
    font-size: 12px;
    color: #ccc;
    margin-bottom: 2px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
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

function handleHUDClose(): void {
  try {
    uiManager.showHomepageWithAnimation();
  } catch (error) {
    logger.warn('HUD close failed, falling back to standard homepage', 'hud-components');
    try {
      uiManager.showHomepage();
    } catch {}
  }
}

function ensureBoardIndicator(): void {
  let indicator = document.getElementById('hud-board');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'hud-board';
    indicator.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: 62px;
      height: 62px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(14px);
      box-shadow: 0 18px 30px rgba(60, 32, 20, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;
    const icon = document.createElement('img');
    icon.src = './assets/close-icon.png';
    icon.srcset = './assets/close-icon.png 1x, ./assets/close-icon@3x.png 2x, ./assets/close-icon@3x.png 3x';
    icon.alt = 'Close';
    icon.style.cssText = `
      width: 22px;
      height: 22px;
      object-fit: contain;
      pointer-events: none;
    `;
    indicator.appendChild(icon);
    document.body.appendChild(indicator);
  }
}

/**
 * Create PIXI HUD container
 */
export function createPIXIHUDContainer(): Container {
  logger.info('🎨 Creating PIXI HUD container');
  
  const container = new Container();
  container.label = 'HUD_ROOT';
  
  // Create background
  const background = createHUDBackground(400, HUD_HEIGHT);
  container.addChild(background);
  
  // Close button (left slot)
  const closeContainer = new Container();
  closeContainer.label = 'closeButton';
  closeContainer.x = 16;
  closeContainer.y = 16;
  closeContainer.eventMode = 'static';
  closeContainer.cursor = 'pointer';
  // 🔥 FIX: Store handlers for cleanup
  const closeHandlers = {
    pointertap: () => handleHUDClose(),
    pointerdown: () => { closeContainer.scale.set(0.92); },
    pointerup: () => { closeContainer.scale.set(1); },
    pointerleave: () => { closeContainer.scale.set(1); }
  };
  
  closeContainer.on('pointertap', closeHandlers.pointertap);
  closeContainer.on('pointerdown', closeHandlers.pointerdown);
  closeContainer.on('pointerup', closeHandlers.pointerup);
  closeContainer.on('pointerleave', closeHandlers.pointerleave);
  
  // Store cleanup function on container
  (closeContainer as any)._cleanupHandlers = () => {
    closeContainer.off('pointertap', closeHandlers.pointertap);
    closeContainer.off('pointerdown', closeHandlers.pointerdown);
    closeContainer.off('pointerup', closeHandlers.pointerup);
    closeContainer.off('pointerleave', closeHandlers.pointerleave);
  };
  
  const closeBg = new Graphics()
    .roundRect(0, 0, 56, 56, 18)
    .fill(0xf7d9c1)
    .stroke({ color: 0xe3a884, width: 3 });
  closeContainer.addChild(closeBg);
  
  const closeText = createStyledText('×', {
    ...TEXT_STYLES.SCORE,
    fontSize: 40,
    fill: '#5b2e1f',
  });
  closeText.x = 28;
  closeText.y = 6;
  closeContainer.addChild(closeText);
  container.addChild(closeContainer);
  
  // Create score text (centered)
  const scoreText = createStyledText('0', TEXT_STYLES.SCORE);
  scoreText.x = 180;
  scoreText.y = 20;
  scoreText.label = 'scoreText';
  container.addChild(scoreText);
  setScoreText(scoreText);
  
  // Create board text but hide in PIXI HUD (handled by close button area)
  const boardText = createStyledText('1', TEXT_STYLES.BOARD);
  boardText.visible = false;
  boardText.label = 'boardText';
  container.addChild(boardText);
  setBoardText(boardText);
  
  // Create combo text (right aligned)
  const comboText = createStyledText('', TEXT_STYLES.COMBO);
  comboText.x = 330;
  comboText.y = 20;
  comboText.label = 'comboText';
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
    boardElement.setAttribute('data-board-value', `${info.board}`);
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
  const movesElement = document.getElementById('hud-moves');
  
  if (!scoreElement || !boardElement || !comboElement) {
    return null;
  }
  
  const boardRaw = boardElement.getAttribute('data-board-value') ?? boardElement.textContent ?? '1';
  const boardClean = boardRaw.replace(/[^0-9]/g, '') || '1';
  
  return {
    score: parseInt(scoreElement.textContent || '0'),
    board: parseInt(boardClean),
    moves: parseInt(movesElement?.textContent || '0'),
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
