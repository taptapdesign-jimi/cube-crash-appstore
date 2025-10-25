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

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.on(EVENTS.UI_SHOW_HOMEPAGE, () => {
      this.showHomepage();
    });

    eventBus.on(EVENTS.UI_HIDE_HOMEPAGE, () => {
      this.hideHomepage();
    });

    eventBus.on(EVENTS.UI_SHOW_LOADING, () => {
      this.showLoadingScreen();
    });

    eventBus.on(EVENTS.UI_HIDE_LOADING, () => {
      this.hideLoadingScreen();
    });

    eventBus.on(EVENTS.SCORE_UPDATE, (score: number) => {
      this.updateScore(score);
    });

    eventBus.on(EVENTS.SCORE_HIGH_SCORE, (score: number) => {
      this.updateHighScore(score);
    });
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
    // Setup modal event listeners
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      const closeButton = modal.querySelector('.close-button');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.hideModal(modal.id);
        });
      }
    });
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
    eventBus.clear();
  }
}

export const uiService = new UIService();
