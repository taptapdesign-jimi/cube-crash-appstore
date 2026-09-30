jest.mock('pixi.js', () => ({
  Assets: { load: jest.fn(() => Promise.resolve()) },
}));

import { Assets } from 'pixi.js';
import {
  getArcadeStageOneDecodedImageCountForTests,
  getArcadeStageOneNextSpecialVisualSource,
  preloadExactSpecialDropVisual,
  queueArcadeStageOneNextSpecialVisualWarmup,
  resetArcadeStageOneSpecialVisualWarmupForTests,
} from '../arcade-stage-one-special-visual-warmup';

describe('Arcade Stage 1 exact-next special visual warmup', () => {
  const OriginalImage = global.Image;

  beforeEach(() => {
    resetArcadeStageOneSpecialVisualWarmupForTests();
    jest.mocked(Assets.load).mockClear().mockResolvedValue(undefined as any);
    class ReadyImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      decoding = '';
      complete = false;
      naturalWidth = 0;
      decode = jest.fn(() => Promise.resolve());
      set src(_source: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    (global as any).Image = ReadyImage;
    delete (window as any).requestIdleCallback;
  });

  afterAll(() => {
    (global as any).Image = OriginalImage;
  });

  test('selects only the proven Magnet and Bottle Stage 1 sequence', () => {
    expect(getArcadeStageOneNextSpecialVisualSource(1, 0)).toContain('wild-magnet');
    expect(getArcadeStageOneNextSpecialVisualSource(1, 1)).toContain('/bottle/');
    expect(getArcadeStageOneNextSpecialVisualSource(1, 2)).toBeNull();
    expect(getArcadeStageOneNextSpecialVisualSource(1, 3)).toBeNull();
    expect(getArcadeStageOneNextSpecialVisualSource(2, 0)).toBeNull();
  });

  test('warms the exact Pixi texture and DOM decode once per source', async () => {
    await Promise.all([
      preloadExactSpecialDropVisual('./bottle.png'),
      preloadExactSpecialDropVisual('./bottle.png'),
    ]);
    expect(Assets.load).toHaveBeenCalledTimes(1);
    expect(Assets.load).toHaveBeenCalledWith('./bottle.png');
    expect(getArcadeStageOneDecodedImageCountForTests()).toBe(1);
  });

  test('invalidates idle work when its gameplay entry is no longer current', () => {
    let idle: (() => void) | null = null;
    let current = true;
    (window as any).requestIdleCallback = jest.fn((callback: () => void) => {
      idle = callback;
      return 7;
    });

    queueArcadeStageOneNextSpecialVisualWarmup({
      arcadeStage: 1,
      wildSpawnCount: 1,
      isCurrent: () => current,
    });
    current = false;
    idle?.();

    expect(Assets.load).not.toHaveBeenCalled();
  });
});
