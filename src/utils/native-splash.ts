import { logger } from '../core/logger.js';

interface SplashOptions {
  fadeOutDuration?: number;
}

/**
 * Hide native splash if running inside Capacitor. No-op on web.
 * @returns true if hide was invoked, false otherwise.
 */
export async function hideNativeSplash(options: SplashOptions = {}): Promise<boolean> {
  try {
    const maybeCapacitor = (window as any)?.Capacitor;
    const splash = maybeCapacitor?.Plugins?.SplashScreen;
    if (splash?.hide) {
      await splash.hide(options);
      return true;
    }
  } catch (error) {
    logger.warn('⚠️ Failed to hide native splash (falling back to no-op):', error);
  }
  return false;
}
