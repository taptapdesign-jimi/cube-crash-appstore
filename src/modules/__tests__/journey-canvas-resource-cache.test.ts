import {
  releaseJourneyCanvasBackingStore,
  releaseJourneyCanvasCacheExcept,
} from '../journey-canvas-resource-cache';

describe('Journey canvas resource cache', () => {
  test('detaches a canvas and clears its backing-store dimensions immediately', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);

    expect(releaseJourneyCanvasBackingStore(canvas)).toBe(800 * 600 * 4);
    expect(canvas.isConnected).toBe(false);
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
  });

  test('retains only protected active/prepaint worlds and releases every other backing store', () => {
    const forest = document.createElement('canvas');
    forest.width = 400;
    forest.height = 300;
    const beach = document.createElement('canvas');
    beach.width = 500;
    beach.height = 350;
    const area = document.createElement('canvas');
    area.width = 600;
    area.height = 400;
    const cache = new Map([[1, forest], [2, beach], [3, area]]);

    expect(releaseJourneyCanvasCacheExcept(cache, new Set([3]))).toEqual({
      releasedCount: 2,
      estimatedBytes: ((400 * 300) + (500 * 350)) * 4,
    });
    expect(Array.from(cache.keys())).toEqual([3]);
    expect(forest.width).toBe(1);
    expect(beach.width).toBe(1);
    expect(area.width).toBe(600);
  });
});
