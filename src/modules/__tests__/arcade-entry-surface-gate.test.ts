import {
  engageArcadeEntrySurfaceGate,
  enforceArcadeEntrySurfaceGate,
  isArcadeEntrySurfaceGateActive,
  releaseArcadeEntrySurfaceGateAfterPreparedFrame,
} from '../arcade-entry-surface-gate';

describe('Arcade entry surface gate', () => {
  test('keeps a reused canvas hidden until a prepared Pixi frame crosses a paint barrier', () => {
    const canvas = document.createElement('canvas');
    const render = jest.fn();
    const frames: FrameRequestCallback[] = [];
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    engageArcadeEntrySurfaceGate(canvas);
    expect(isArcadeEntrySurfaceGateActive()).toBe(true);
    expect(enforceArcadeEntrySurfaceGate(canvas)).toBe(true);
    expect(canvas.style.visibility).toBe('hidden');
    expect(canvas.style.opacity).toBe('0');

    releaseArcadeEntrySurfaceGateAfterPreparedFrame({ canvas, renderer: { render } }, {});
    expect(render).toHaveBeenCalledTimes(1);
    expect(canvas.style.visibility).toBe('hidden');

    frames.shift()?.(16);
    expect(render).toHaveBeenCalledTimes(2);
    expect(isArcadeEntrySurfaceGateActive()).toBe(false);
    expect(canvas.style.visibility).toBe('visible');
    expect(canvas.style.opacity).toBe('1');
    expect(canvas.style.pointerEvents).toBe('auto');
    raf.mockRestore();
  });
});
