// Global type definitions for Cube Crash

import type { Container } from 'pixi.js';

// Extend Element to include HTMLElement properties (for type safety)
declare global {
  interface Element {
    offsetHeight?: number;
    offsetWidth?: number;
    style?: CSSStyleDeclaration;
  }
}

// Extend Window interface
declare global {
  interface Window {
    // Allow any property access (ultra-permissive)
    [key: string]: any;
    
    // Game state
    FLOW?: GameState;
    HUD?: any;
    HUD_ROOT?: any;
    
    // Debug/test functions
    comboText?: any;
    testCleanAndPrize?: () => void;
    _userMadeMove?: boolean;
    _ghostPlaceholders?: any[];
    
    // Collectibles
    showCollectiblesScreen?: () => Promise<void>;
    hideCollectiblesScreen?: () => Promise<void>;
    
    // Modal/UI state
    isEndRunModalVisible?: boolean;
    isScoreBottomSheetVisible?: boolean;
    setEndRunModalVisible?: (visible: boolean) => void;
    hideScoreBottomSheet?: () => void;
    
    // Haptics
    triggerHapticImpact?: (style?: string) => void;
    
    // iOS specific
    webkit?: {
      messageHandlers?: {
        [key: string]: {
          postMessage: (message: any) => void;
        };
      };
    };
  }
  
  // Global variables
  var _updateHUD: any;
  var _animateScore: any;
  var _animateBoard: any;
  var _setBoard: any;
  var getTiles: any;
  var mergeStarted: any;
  var cleanupPulledTile: any;
  var layout: any;
  var HUD_ROOT: any;

  // ImportMeta extensions for Vite
  interface ImportMeta {
    env: {
      MODE?: string;
      PROD?: boolean;
      DEV?: boolean;
      [key: string]: any;
    };
  }
}

// Game State interface
export interface GameState {
  // Allow any property access (ultra-permissive for quick fix)
  [key: string]: any;
  
  // Core game objects
  app?: any;
  stage?: any;
  board?: any;
  boardBG?: any;
  hud?: any;
  backgroundLayer?: any;
  
  // Game state
  boardNumber?: number;
  wildMeter?: number;
  paused?: boolean;
  gameOver?: boolean;
  
  // Functions
  pauseGame?: () => void;
  resumeGame?: () => void;
}

// Extended Container with game-specific properties
export interface TileContainer extends Container {
  // Allow any property access (ultra-permissive for quick fix)
  [key: string]: any;
  
  // Tile properties
  value?: number;
  special?: string;
  gridX?: number;
  gridY?: number;
  stackDepth?: number;
  locked?: boolean;
  placeholder?: boolean;
  _isLastMerge?: boolean;
  
  // Visual properties
  hover?: boolean;
  translateFactor?: number;
  zIndex?: number;
  scale?: any;
  parent?: any;
  destroyed?: boolean;
  
  // Wild tile properties
  isWild?: boolean;
  isWildFace?: boolean;
  
  // Internal properties
  _fill?: any;
  _dropped?: boolean;
  _hudElements?: any;
  _xButton?: any;
  ghostFrame?: any;
  occluder?: any;
  
  // Methods
  destroy?: (options?: any) => void;
  set?: (property: string, value: any) => void;
}

// GSAP Tween options
export interface TweenOptions {
  duration?: number;
  delay?: number;
  ease?: string;
  onComplete?: () => void;
  onUpdate?: () => void;
  onStart?: () => void;
  translateFactor?: number;
  outDur?: number;
  inDur?: number;
  hold?: number;
  [key: string]: any;
}

// Export empty object to make this a module
export {};

