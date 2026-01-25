// UI Service - Centralized UI management
import { eventBus, EVENTS } from '../core/event-bus.js';
import { logger } from '../core/logger.js';

export interface UIServiceInterface {
  showHomepage(): void;
  hideHomepage(): void;
  showLoadingScreen(): void;
  hideLoadingScreen(): void;
  showModal(modalId: string): void;
  hideModal(modalId: string): void;
  updateScore(score: number): void;
  updateHighScore(score: number): void;
  updateLevel(level: number): void;
  updateMoves(moves: number): void;
}

class UIService implements UIServiceInterface {
  private isInitialized: boolean = false;
  
  // 🔥 FIX: Store bound listeners for proper cleanup
  private boundListeners: {
    onShowHomepage: (() => void) | null;
    onHideHomepage: (() => void) | null;
    onShowLoading: (() => void) | null;
    onHideLoading: (() => void) | null;
    onScoreUpdate: ((score: number) => void) | null;
    onHighScore: ((score: number) => void) | null;
  } = { onShowHomepage: null, onHideHomepage: null, onShowLoading: null, onHideLoading: null, onScoreUpdate: null, onHighScore: null };

  // 🔥 FIX: Track DOM event listeners for cleanup
  private modalCloseListeners: Map<Element, () => void> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 🔥 FIX: Store bound listeners for removal in destroy()
    this.boundListeners.onShowHomepage = () => this.showHomepage();
    this.boundListeners.onHideHomepage = () => this.hideHomepage();
    this.boundListeners.onShowLoading = () => this.showLoadingScreen();
    this.boundListeners.onHideLoading = () => this.hideLoadingScreen();
    this.boundListeners.onScoreUpdate = (score: number) => this.updateScore(score);
    this.boundListeners.onHighScore = (score: number) => this.updateHighScore(score);

    eventBus.on(EVENTS.UI_SHOW_HOMEPAGE, this.boundListeners.onShowHomepage);
    eventBus.on(EVENTS.UI_HIDE_HOMEPAGE, this.boundListeners.onHideHomepage);
    eventBus.on(EVENTS.UI_SHOW_LOADING, this.boundListeners.onShowLoading);
    eventBus.on(EVENTS.UI_HIDE_LOADING, this.boundListeners.onHideLoading);
    eventBus.on(EVENTS.SCORE_UPDATE, this.boundListeners.onScoreUpdate);
    eventBus.on(EVENTS.SCORE_HIGH_SCORE, this.boundListeners.onHighScore);
  }

  init(): void {
    if (this.isInitialized) return;
    
    try {
      this.setupUI();
      this.isInitialized = true;
      logger.info('✅ UI Service initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize UI Service:', error);
      throw error;
    }
  }

  private setupUI(): void {
    // Setup UI elements and event listeners
    this.setupHomepage();
    this.setupLoadingScreen();
    this.setupModals();
    this.setupScoreDisplay();
  }

  private setupHomepage(): void {
    const homepage = document.getElementById('homepage');
    if (homepage) {
      homepage.style.display = 'block';
    }
  }

  private setupLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  }

  private setupModals(): void {
    // 🔥 FIX: Clear any existing listeners before adding new ones
    this.cleanupModalListeners();
    
    // Setup modal event listeners
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      const closeButton = modal.querySelector('.close-button');
      if (closeButton) {
        const handler = () => this.hideModal(modal.id);
        closeButton.addEventListener('click', handler);
        // 🔥 FIX: Track listener for cleanup
        this.modalCloseListeners.set(closeButton, handler);
      }
    });
  }

  // 🔥 FIX: Cleanup modal close button listeners
  private cleanupModalListeners(): void {
    this.modalCloseListeners.forEach((handler, element) => {
      try {
        element.removeEventListener('click', handler);
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    this.modalCloseListeners.clear();
  }

  private setupScoreDisplay(): void {
    // Setup score display elements
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('high-score');
    const levelElement = document.getElementById('level');
    const movesElement = document.getElementById('moves');

    if (scoreElement) {
      scoreElement.textContent = '0';
    }
    if (highScoreElement) {
      highScoreElement.textContent = '0';
    }
    if (levelElement) {
      levelElement.textContent = '1';
    }
    if (movesElement) {
      movesElement.textContent = '0';
    }
  }

  showHomepage(): void {
    const homepage = document.getElementById('homepage');
    if (homepage) {
      homepage.style.display = 'block';
      eventBus.emit(EVENTS.UI_SHOW_HOMEPAGE);
    }
  }

  hideHomepage(): void {
    const homepage = document.getElementById('homepage');
    if (homepage) {
      homepage.style.display = 'none';
      eventBus.emit(EVENTS.UI_HIDE_HOMEPAGE);
    }
  }

  showLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'block';
      eventBus.emit(EVENTS.UI_SHOW_LOADING);
    }
  }

  hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
      eventBus.emit(EVENTS.UI_HIDE_LOADING);
    }
  }

  showModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'block';
      eventBus.emit(EVENTS.UI_SHOW_MODAL, modalId);
    }
  }

  hideModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      eventBus.emit(EVENTS.UI_HIDE_MODAL, modalId);
    }
  }

  updateScore(score: number): void {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
      scoreElement.textContent = score.toString();
    }
  }

  updateHighScore(score: number): void {
    const highScoreElement = document.getElementById('high-score');
    if (highScoreElement) {
      highScoreElement.textContent = score.toString();
    }
  }

  updateLevel(level: number): void {
    const levelElement = document.getElementById('level');
    if (levelElement) {
      levelElement.textContent = level.toString();
    }
  }

  updateMoves(moves: number): void {
    const movesElement = document.getElementById('moves');
    if (movesElement) {
      movesElement.textContent = moves.toString();
    }
  }

  destroy(): void {
    this.isInitialized = false;
    
    // 🔥 FIX: Cleanup DOM listeners first
    this.cleanupModalListeners();
    
    // 🔥 FIX: Remove only this service's listeners, not all eventBus listeners
    if (this.boundListeners.onShowHomepage) {
      eventBus.off(EVENTS.UI_SHOW_HOMEPAGE, this.boundListeners.onShowHomepage);
    }
    if (this.boundListeners.onHideHomepage) {
      eventBus.off(EVENTS.UI_HIDE_HOMEPAGE, this.boundListeners.onHideHomepage);
    }
    if (this.boundListeners.onShowLoading) {
      eventBus.off(EVENTS.UI_SHOW_LOADING, this.boundListeners.onShowLoading);
    }
    if (this.boundListeners.onHideLoading) {
      eventBus.off(EVENTS.UI_HIDE_LOADING, this.boundListeners.onHideLoading);
    }
    if (this.boundListeners.onScoreUpdate) {
      eventBus.off(EVENTS.SCORE_UPDATE, this.boundListeners.onScoreUpdate);
    }
    if (this.boundListeners.onHighScore) {
      eventBus.off(EVENTS.SCORE_HIGH_SCORE, this.boundListeners.onHighScore);
    }
    this.boundListeners = { onShowHomepage: null, onHideHomepage: null, onShowLoading: null, onHideLoading: null, onScoreUpdate: null, onHighScore: null };
    
    logger.info('✅ UI Service destroyed');
  }
}

export const uiService = new UIService();
