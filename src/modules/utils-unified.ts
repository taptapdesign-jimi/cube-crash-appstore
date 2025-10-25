// Unified utils module for CubeCrash
// Consolidates all utility functions into one file

import { logger } from '../core/logger.js';

// Import all utility modules
import * as mergeUtils from './merge-utils.js';
import * as cleanBoardUtils from './clean-board-utils.js';
import * as collectibleRewardUtils from './collectible-reward-utils.js';
import * as endRunUtils from './end-run-utils.js';
import * as pauseUtils from './pause-utils.js';
import * as resumeSheetUtils from './resume-sheet-utils.js';
import * as dragUtils from './drag-utils.js';
import * as hudUtils from './hud-utils.js';

// Export all utilities
export {
  mergeUtils,
  cleanBoardUtils,
  collectibleRewardUtils,
  endRunUtils,
  pauseUtils,
  resumeSheetUtils,
  dragUtils,
  hudUtils
};

// Unified utils manager
export class UtilsManager {
  private static instance: UtilsManager;
  
  static getInstance(): UtilsManager {
    if (!UtilsManager.instance) {
      UtilsManager.instance = new UtilsManager();
    }
    return UtilsManager.instance;
  }
  
  // Initialize all utilities
  initialize(): void {
    logger.info('Initializing unified utils manager', 'utils-unified');
    
    try {
      // All utilities are already loaded via imports
      logger.info('All utility modules loaded successfully', 'utils-unified');
    } catch (error) {
      logger.error('Failed to initialize utils manager', 'utils-unified', error);
    }
  }
  
  // Cleanup all utilities
  cleanup(): void {
    logger.info('Cleaning up unified utils manager', 'utils-unified');
    logger.info('Utils cleanup completed', 'utils-unified');
  }
}

export default UtilsManager;
