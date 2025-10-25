// Core game types
export interface GameState {
  isGameActive: boolean;
  isPaused: boolean;
  isGameEnded: boolean;
  score: number;
  level: number;
  combo: number;
  highScore: number;
  totalCubesCracked: number;
  totalGamesPlayed: number;
  totalPlayTime: number;
}

export interface Cube {
  id: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isDragging: boolean;
  isAnimating: boolean;
  isWild: boolean;
  isMerged: boolean;
}

export interface Board {
  width: number;
  height: number;
  gridSize: number;
  cubes: Cube[];
  maxCubes: number;
  isFull: boolean;
  isAnimating: boolean;
}

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

export interface UIElement {
  id: string;
  element: HTMLElement;
  isVisible: boolean;
  isAnimating: boolean;
  animationConfig?: AnimationConfig;
}

export interface NavigationItem {
  id: string;
  icon: string;
  label: string;
  isActive: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

export interface SliderSlide {
  id: string;
  title: string;
  description: string;
  image: string;
  ctaText: string;
  ctaAction: () => void;
  isActive: boolean;
  isVisible: boolean;
}

export interface AssetConfig {
  id: string;
  url: string;
  type: 'image' | 'audio' | 'font' | 'json';
  preload: boolean;
  cache: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  loadTime: number;
  errorCount: number;
  warningCount: number;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Config {
  game: {
    boardWidth: number;
    boardHeight: number;
    gridSize: number;
    maxCubes: number;
    animationDuration: number;
    comboMultiplier: number;
    levelUpThreshold: number;
  };
  ui: {
    animationDuration: number;
    transitionDuration: number;
    fadeDuration: number;
    scaleDuration: number;
  };
  performance: {
    targetFPS: number;
    maxMemoryUsage: number;
    enableProfiling: boolean;
    enableLogging: boolean;
  };
  mobile: {
    enableTouch: boolean;
    enableHaptic: boolean;
    enableOrientation: boolean;
    enableSafeArea: boolean;
  };
}

// Event types
export type GameEvent = 
  | 'gameStart'
  | 'gamePause'
  | 'gameResume'
  | 'gameEnd'
  | 'scoreUpdate'
  | 'levelUp'
  | 'comboUpdate'
  | 'cubeSpawn'
  | 'cubeMerge'
  | 'cubeDestroy'
  | 'boardFull'
  | 'boardClear';

export type UIEvent = 
  | 'slideChange'
  | 'navigationClick'
  | 'buttonClick'
  | 'modalOpen'
  | 'modalClose'
  | 'animationStart'
  | 'animationComplete';

export type ErrorEvent = 
  | 'assetLoadError'
  | 'gameLogicError'
  | 'uiError'
  | 'performanceError'
  | 'networkError';

// Function types
export type EventHandler<T = unknown> = (data: T) => void;
export type AnimationFunction = (progress: number) => number;
export type ValidationFunction<T> = (value: T) => boolean;
export type TransformFunction<T, R> = (value: T) => R;

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Module types
export interface Module {
  init(): Promise<void>;
  destroy(): Promise<void>;
  isInitialized: boolean;
  isDestroyed: boolean;
}

export interface StateManager extends Module {
  getState(): GameState;
  setState(state: Partial<GameState>): void;
  subscribe(callback: EventHandler<GameState>): () => void;
  unsubscribe(callback: EventHandler<GameState>): void;
}

export interface AssetManager extends Module {
  loadAsset(config: AssetConfig): Promise<unknown>;
  preloadAssets(configs: AssetConfig[]): Promise<void>;
  getAsset(id: string): unknown;
  unloadAsset(id: string): void;
  clearCache(): void;
}

export interface AnimationManager extends Module {
  animate(element: HTMLElement, config: AnimationConfig): Promise<void>;
  stopAnimation(element: HTMLElement): void;
  stopAllAnimations(): void;
  isAnimating(element: HTMLElement): boolean;
}

export interface UIManager extends Module {
  showElement(id: string): void;
  hideElement(id: string): void;
  toggleElement(id: string): void;
  isElementVisible(id: string): boolean;
  addEventListener(id: string, event: string, handler: EventHandler): void;
  removeEventListener(id: string, event: string, handler: EventHandler): void;
}

export interface GameManager extends Module {
  startGame(): Promise<void>;
  pauseGame(): void;
  resumeGame(): void;
  endGame(): void;
  resetGame(): void;
  saveGame(): void;
  loadGame(): Promise<void>;
  isGameRunning: boolean;
  isGamePaused: boolean;
}
