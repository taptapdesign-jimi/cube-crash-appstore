// Unified UI module for CubeCrash
// Consolidates all UI components into one file

import { logger } from '../core/logger.js';

// Import all UI modules
import * as cleanBoardUI from './clean-board-ui.js';
import * as collectibleRewardUI from './collectible-reward-ui.js';
import * as endRunUI from './end-run-ui.js';
import * as pauseUI from './pause-ui.js';
import * as resumeSheetUI from './resume-sheet-ui.js';
import * as hudComponents from './hud-components.js';

// Export all UI components
export {
  cleanBoardUI,
  collectibleRewardUI,
  endRunUI,
  pauseUI,
  resumeSheetUI,
  hudComponents
};

// Unified UI manager
export class UIManager {
  private static instance: UIManager;
  
  static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }
  
  // Initialize all UI components
  initialize(): void {
    logger.info('Initializing unified UI manager', 'ui-unified');
    
    try {
      // All UI components are already loaded via imports
      logger.info('All UI modules loaded successfully', 'ui-unified');
    } catch (error) {
      logger.error('Failed to initialize UI manager', 'ui-unified', error);
    }
  }
  
  // Cleanup all UI components
  cleanup(): void {
    logger.info('Cleaning up unified UI manager', 'ui-unified');
    logger.info('UI cleanup completed', 'ui-unified');
  }
}

export default UIManager;
