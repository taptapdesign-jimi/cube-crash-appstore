import { logger } from '../core/logger.js';

type StartupReadinessOptions = {
  reason?: string;
  timeoutMs?: number;
};

type ImageReadinessResult = {
  total: number;
  decoded: number;
  failed: number;
};

const STARTUP_IMAGE_SELECTOR = [
  '#slider-wrapper .hero-image',
  '#home-logo',
  '.logo-addon',
  '#home-fixed-shadow-bottom',
  '#launch-studio-logo',
  '#launch-studio-character',
].join(', ');

let criticalStartupReadinessPromise: Promise<void> | null = null;

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}

function withHardCap<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T | 'timeout'> {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      logger.warn(`⚠️ ${label} readiness hard cap reached; continuing with fallback`, undefined, { timeoutMs });
      resolve('timeout');
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
}

async function waitForFontsReady(): Promise<void> {
  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch (error) {
    logger.warn('⚠️ Startup font readiness failed softly', String(error));
  }
}

async function waitForImageDecoded(img: HTMLImageElement): Promise<boolean> {
  try {
    img.loading = 'eager';
    img.decoding = 'async';
    try { (img as any).fetchPriority = 'high'; } catch {}

    if (!img.currentSrc && !img.src) return false;

    if (!img.complete) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          img.removeEventListener('load', finish);
          img.removeEventListener('error', finish);
          resolve();
        };
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
      });
    }

    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return false;

    if (typeof img.decode === 'function') {
      await img.decode();
    }
    return true;
  } catch {
    return false;
  }
}

async function waitForStartupImagesDecoded(selector = STARTUP_IMAGE_SELECTOR): Promise<ImageReadinessResult> {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
    .filter((img) => !!(img.currentSrc || img.src));

  if (images.length === 0) {
    return { total: 0, decoded: 0, failed: 0 };
  }

  const results = await Promise.allSettled(images.map(waitForImageDecoded));
  const decoded = results.filter((result) => result.status === 'fulfilled' && result.value === true).length;
  return {
    total: images.length,
    decoded,
    failed: images.length - decoded,
  };
}

async function waitForCriticalPixiAssets(): Promise<void> {
  try {
    const { assetPreloader } = await import('../modules/asset-preloader.js');
    await assetPreloader.preloadCriticalAssetsOnly();
  } catch (error) {
    logger.warn('⚠️ Startup Pixi critical asset readiness failed softly', String(error));
  }
}

export function waitForCriticalStartupReadiness(options: StartupReadinessOptions = {}): Promise<void> {
  if (criticalStartupReadinessPromise) return criticalStartupReadinessPromise;

  const reason = options.reason || 'startup';
  const timeoutMs = Math.max(3000, options.timeoutMs ?? 10000);
  const startedAt = performance.now();

  criticalStartupReadinessPromise = (async () => {
    const readiness = Promise.allSettled([
      waitForCriticalPixiAssets(),
      waitForFontsReady(),
      waitForStartupImagesDecoded(),
      waitFrames(2),
    ]);

    const result = await withHardCap(readiness, timeoutMs, 'Critical startup');
    const elapsedMs = Math.round(performance.now() - startedAt);

    if (result === 'timeout') {
      logger.warn('⚠️ Critical startup readiness continued after hard cap', undefined, { reason, elapsedMs, timeoutMs });
      return;
    }

    const imageResult = result[2];
    const images = imageResult.status === 'fulfilled'
      ? imageResult.value
      : { total: 0, decoded: 0, failed: 0 };

    logger.info('✅ Critical startup readiness complete', undefined, {
      reason,
      elapsedMs,
      imageCount: images.total,
      decodedImages: images.decoded,
      failedImages: images.failed,
    });
  })();

  return criticalStartupReadinessPromise;
}

export async function waitForHomepageFirstPaintReady(options: StartupReadinessOptions = {}): Promise<void> {
  const reason = options.reason || 'homepage-first-paint';
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 3500);
  const startedAt = performance.now();

  const readiness = (async () => {
    const images = await waitForStartupImagesDecoded(
      '#slider-wrapper .hero-image, #home-logo, .logo-addon, #home-fixed-shadow-bottom'
    );
    await waitFrames(2);
    logger.info('✅ Homepage first paint readiness complete', undefined, {
      reason,
      elapsedMs: Math.round(performance.now() - startedAt),
      imageCount: images.total,
      decodedImages: images.decoded,
      failedImages: images.failed,
    });
  })();

  const result = await withHardCap(readiness, timeoutMs, 'Homepage first paint');
  if (result === 'timeout') {
    logger.warn('⚠️ Homepage first paint readiness continued after hard cap', undefined, {
      reason,
      elapsedMs: Math.round(performance.now() - startedAt),
      timeoutMs,
    });
  }
}
