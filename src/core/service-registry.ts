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
});

container.register(SERVICES.LOGGER, {
  instance: logger,
  singleton: true,
});

// Register game services
container.register(SERVICES.GAME_STATE, {
  instance: gameStateService,
  singleton: true,
});

container.register(SERVICES.UI_MANAGER, {
  instance: uiService,
  singleton: true,
});

container.register('boardService', {
  instance: boardService,
  singleton: true,
});

// Register legacy services (for backward compatibility)
container.register('gameState', {
  instance: gameStateService,
  singleton: true,
});

container.register('uiManager', {
  instance: uiService,
  singleton: true,
});

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
    getUIManager().init();
    
    logger.info('✅ All services initialized');
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

// Cleanup all services
export function cleanupServices(): void {
  try {
    getGameState().destroy();
    getUIManager().destroy();
    getBoardService().destroy();
    
    logger.info('✅ All services cleaned up');
  } catch (error) {
    logger.error('❌ Failed to cleanup services:', error);
  }
}
