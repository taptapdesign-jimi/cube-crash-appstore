// @ts-nocheck
// Service Registry - Register all services in DI container
import { container, SERVICES } from './dependency-injection.js';
import { eventBus } from './event-bus.js';
import { logger } from './logger.js';
import { gameStateService } from '../services/game-state-service.js';
import { uiService } from '../services/ui-service.js';
import { boardService } from '../services/board-service.js';

// Register core services
container.register(SERVICES.EVENT_BUS, {
  instance: eventBus,
  singleton: true,
} as any);

container.register(SERVICES.LOGGER, {
  instance: logger,
  singleton: true,
} as any);

// Register game services
container.register(SERVICES.GAME_STATE, {
  instance: gameStateService,
  singleton: true,
} as any);

container.register(SERVICES.UI_MANAGER, {
  instance: uiService,
  singleton: true,
} as any);

container.register('boardService', {
  instance: boardService,
  singleton: true,
});

// Register legacy services (for backward compatibility)
container.register('gameState', {
  instance: gameStateService,
  singleton: true,
} as any);

container.register('uiManager', {
  instance: uiService,
  singleton: true,
} as any);

container.register('boardService', {
  instance: boardService,
  singleton: true,
});

// Export service getters for easy access
export const getGameState = () => container.get(SERVICES.GAME_STATE);
export const getUIManager = () => container.get(SERVICES.UI_MANAGER);
export const getBoardService = () => container.get(SERVICES.BOARD_SERVICE);
export const getEventBus = () => container.get(SERVICES.EVENT_BUS);
export const getLogger = () => container.get(SERVICES.LOGGER);

// Initialize all services
export function initializeServices(): void {
  try {
    // Initialize services that need initialization
    const uiManager: any = getUIManager();
    if (uiManager && typeof uiManager.init === 'function') {
      uiManager.init();
    }
    
    logger.info('✅ All services initialized');
  } catch (error) {
    logger.error('❌ Failed to initialize services:', String(error));
    throw error;
  }
}

// Cleanup all services
export function cleanupServices(): void {
  try {
    const gameState: any = getGameState();
    const uiManager: any = getUIManager();
    const boardService: any = getBoardService();
    
    if (gameState && typeof gameState.destroy === 'function') gameState.destroy();
    if (uiManager && typeof uiManager.destroy === 'function') uiManager.destroy();
    if (boardService && typeof boardService.destroy === 'function') boardService.destroy();
    
    logger.info('✅ All services cleaned up');
  } catch (error) {
    logger.error('❌ Failed to cleanup services:', String(error));
  }
}
