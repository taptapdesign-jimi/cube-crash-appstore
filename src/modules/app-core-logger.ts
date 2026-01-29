import { logger } from '../core/logger.js';

export const devLog = (message: unknown, ...args: unknown[]) => {
  if (!(import.meta as any)?.env?.DEV) return;
  if (args.length === 0) {
    logger.debug(String(message), 'app-core');
    return;
  }
  logger.debug(String(message), 'app-core', args.length === 1 ? args[0] : args);
};

export const devWarn = (message: unknown, ...args: unknown[]) => {
  if (!(import.meta as any)?.env?.DEV) return;
  if (args.length === 0) {
    logger.warn(String(message), 'app-core');
    return;
  }
  logger.warn(String(message), 'app-core', args.length === 1 ? args[0] : args);
};

export const devError = (message: unknown, ...args: unknown[]) => {
  if (!(import.meta as any)?.env?.DEV) return;
  if (args.length === 0) {
    logger.error(String(message), 'app-core');
    return;
  }
  logger.error(String(message), 'app-core', args.length === 1 ? args[0] : args);
};
