import { logger } from '../core/logger.js';
import type { CollectiblesShowOptions } from '../collectibles-manager.js';

type CollectiblesWindow = Window & {
  showCollectibles?: (options?: CollectiblesShowOptions) => Promise<void>;
  hideCollectibles?: () => Promise<void>;
  showCollectiblesScreen?: (options?: CollectiblesShowOptions) => Promise<void>;
  hideCollectiblesScreen?: () => Promise<void>;
  hideCollectiblesScreenWithAnimation?: () => void;
  unlockCollectible?: (eventName: string) => Promise<void>;
  unlockCollectibleByNumber?: (num: number) => Promise<void>;
  hideCollectibleByNumber?: (num: number) => Promise<void>;
};

const win = window as CollectiblesWindow;

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

win.unlockCollectible = async (eventName: string) => {
  await withModule(mod => mod.unlockCollectible(eventName));
};

win.unlockCollectibleByNumber = async (num: number) => {
  await withModule(mod => mod.unlockCollectibleByNumber(num));
};

win.hideCollectibleByNumber = async (num: number) => {
  await withModule(mod => mod.hideCollectibleByNumber(num));
};
