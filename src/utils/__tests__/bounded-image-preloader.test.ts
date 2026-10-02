import {
  preloadImagesBounded,
  resetBoundedImagePreloaderForTests,
} from '../bounded-image-preloader';

describe('bounded image preloader', () => {
  const OriginalImage = global.Image;

  afterEach(() => {
    global.Image = OriginalImage;
    resetBoundedImagePreloaderForTests();
  });

  test('admits at most the requested number of image jobs', async () => {
    let active = 0;
    let peak = 0;
    class ControlledImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = async () => {};
      set src(_value: string) {
        active += 1;
        peak = Math.max(peak, active);
        queueMicrotask(() => {
          active -= 1;
          this.onload?.();
        });
      }
    }
    global.Image = ControlledImage as unknown as typeof Image;

    await expect(preloadImagesBounded(['a', 'b', 'c', 'd'], { concurrency: 2 }))
      .resolves.toBe(true);
    expect(peak).toBe(2);
  });

  test('stale owner does not admit remaining queued sources', async () => {
    let current = true;
    let started = 0;
    class ControlledImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = async () => {};
      set src(_value: string) {
        started += 1;
        Promise.resolve().then(() => this.onload?.());
      }
    }
    global.Image = ControlledImage as unknown as typeof Image;

    const preparation = preloadImagesBounded(['a', 'b', 'c'], {
      concurrency: 1,
      isCurrent: () => current,
    });
    current = false;
    await expect(preparation).resolves.toBe(false);
    expect(started).toBe(1);
  });

  test('shares the two-job ceiling across concurrent feature callers', async () => {
    let active = 0;
    let peak = 0;
    class ControlledImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = async () => {};
      set src(_value: string) {
        active += 1;
        peak = Math.max(peak, active);
        queueMicrotask(() => {
          active -= 1;
          this.onload?.();
        });
      }
    }
    global.Image = ControlledImage as unknown as typeof Image;

    await Promise.all([
      preloadImagesBounded(['a', 'b', 'c'], { concurrency: 2 }),
      preloadImagesBounded(['d', 'e', 'f'], { concurrency: 2 }),
    ]);
    expect(peak).toBe(2);
  });
});
