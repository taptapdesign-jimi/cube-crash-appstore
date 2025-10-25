// Unified animations module for CubeCrash
// Consolidates all animation logic into one file

import { gsap } from 'gsap';
import { logger } from '../core/logger.js';

// Import all animation modules
import * as mergeAnimations from './merge-animations.js';
import * as fxAnimations from './fx-animations.js';
import * as hudAnimations from './hud-animations.js';
import * as cleanBoardAnimations from './clean-board-animations.js';
import * as collectibleRewardAnimations from './collectible-reward-animations.js';
import * as endRunAnimations from './end-run-animations.js';
import * as pauseAnimations from './pause-animations.js';
import * as resumeSheetAnimations from './resume-sheet-animations.js';
import * as dragAnimations from './drag-animations.js';

// Export all animations
export {
  mergeAnimations,
  fxAnimations,
  hudAnimations,
  cleanBoardAnimations,
  collectibleRewardAnimations,
  endRunAnimations,
  pauseAnimations,
  resumeSheetAnimations,
  dragAnimations
};

// Unified animation manager
export class AnimationManager {
  private static instance: AnimationManager;
  
  static getInstance(): AnimationManager {
    if (!AnimationManager.instance) {
      AnimationManager.instance = new AnimationManager();
    }
    return AnimationManager.instance;
  }
  
  // Initialize all animations
  initialize(): void {
    logger.info('Initializing unified animation manager', 'animations-unified');
    
    // Initialize all animation modules
    try {
      // All animations are already loaded via imports
      logger.info('All animation modules loaded successfully', 'animations-unified');
    } catch (error) {
      logger.error('Failed to initialize animation manager', 'animations-unified', error);
    }
  }
  
  // Cleanup all animations
  cleanup(): void {
    logger.info('Cleaning up unified animation manager', 'animations-unified');
    
    // Kill all GSAP animations
    gsap.killTweensOf("*");
    
    logger.info('Animation cleanup completed', 'animations-unified');
  }
}

export default AnimationManager;
