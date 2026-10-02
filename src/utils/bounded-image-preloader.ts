export type BoundedImagePreloadOptions = {
  concurrency?: number;
  isCurrent?: () => boolean;
  decode?: boolean;
};

const readySources = new Set<string>();
const pendingSources = new Map<string, Promise<void>>();
const GLOBAL_IMAGE_LOAD_LIMIT = 2;
let activeImageLoads = 0;
const imageLoadWaiters: Array<() => void> = [];

async function acquireImageLoadSlot(): Promise<() => void> {
  if (activeImageLoads >= GLOBAL_IMAGE_LOAD_LIMIT) {
    await new Promise<void>((resolve) => imageLoadWaiters.push(resolve));
  } else {
    activeImageLoads += 1;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = imageLoadWaiters.shift();
    if (next) next();
    else activeImageLoads = Math.max(0, activeImageLoads - 1);
  };
}

function loadImage(src: string, decode: boolean): Promise<void> {
  if (readySources.has(src)) return Promise.resolve();
  const pending = pendingSources.get(src);
  if (pending) return pending;

  const request = (async () => {
    const releaseSlot = await acquireImageLoadSlot();
    try {
      await new Promise<void>((resolve) => {
        const image = new Image();
        const finish = async (): Promise<void> => {
          if (decode && typeof image.decode === 'function') {
            try { await image.decode(); } catch {}
          }
          readySources.add(src);
          resolve();
        };
        image.onload = () => { void finish(); };
        image.onerror = () => resolve();
        image.src = src;
      });
    } finally {
      releaseSlot();
    }
  })().finally(() => {
    if (pendingSources.get(src) === request) pendingSources.delete(src);
  });

  pendingSources.set(src, request);
  return request;
}

/**
 * Loads only a small number of images at once. Callers retain lifecycle
 * ownership through isCurrent; stale callers stop admitting queued work while
 * already-started browser requests are allowed to settle into the shared cache.
 */
export async function preloadImagesBounded(
  sources: readonly string[],
  options: BoundedImagePreloadOptions = {},
): Promise<boolean> {
  const isCurrent = options.isCurrent ?? (() => true);
  const concurrency = Math.max(1, Math.min(4, Math.floor(options.concurrency ?? 2)));
  const uniqueSources = Array.from(new Set(sources.filter(Boolean)))
    .filter((src) => !readySources.has(src));
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (isCurrent()) {
      const index = cursor++;
      if (index >= uniqueSources.length) return;
      await loadImage(uniqueSources[index], options.decode !== false);
    }
  };

  await Promise.all(Array.from(
    { length: Math.min(concurrency, uniqueSources.length) },
    () => worker(),
  ));
  return isCurrent();
}

export function isImagePreloadReady(src: string): boolean {
  return readySources.has(src);
}

export function resetBoundedImagePreloaderForTests(): void {
  readySources.clear();
  pendingSources.clear();
  activeImageLoads = 0;
  imageLoadWaiters.length = 0;
}
