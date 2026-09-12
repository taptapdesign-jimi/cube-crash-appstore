import { logger } from '../core/logger.js';
import type { CollectiblesShowOptions } from '../collectibles-manager.js';

type CollectiblesWindow = Window & {
  showCollectibles?: (options?: CollectiblesShowOptions) => Promise<void>;
  hideCollectibles?: () => Promise<void>;
  showCollectiblesScreen?: (options?: CollectiblesShowOptions) => Promise<void>;
  hideCollectiblesScreen?: () => Promise<void>;
  hideCollectiblesScreenWithAnimation?: () => Promise<void>;
  collectiblesManager?: any;
};

const win = window as unknown as CollectiblesWindow;

const loadModule = async () => {
  return import('../collectibles-manager.js');
};

const withModule = async <T>(handler: (mod: typeof import('../collectibles-manager.js')) => Promise<T>): Promise<T> => {
  const mod = await loadModule();
  return handler(mod);
};

win.showCollectibles = async (options?: CollectiblesShowOptions) => {
  logger.info('🎁 showCollectibles bridge invoked');
  await withModule(mod => mod.showCollectiblesScreen(options));
};

win.hideCollectibles = async () => {
  logger.info('🎁 hideCollectibles bridge invoked');
  await withModule(mod => mod.hideCollectiblesScreen());
};

win.showCollectiblesScreen = win.showCollectibles;
win.hideCollectiblesScreen = win.hideCollectibles;
