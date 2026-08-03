import { playLoadPopInAnimation } from '../app-core-load-popin';

test('saved tiles stay hidden until the continuation cue finishes', async () => {
  document.body.innerHTML = '<main id="app"></main>';
  const tile = { visible: true };
  let finishCue!: () => void;
  const beforePopIn = jest.fn(() => new Promise<void>((resolve) => { finishCue = resolve; }));
  const sweetPopIn = jest.fn(() => Promise.resolve());
  const onComplete = jest.fn();
  const originalRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof window.requestAnimationFrame;

  try {
    playLoadPopInAnimation({
      tiles: [tile],
      backgroundLayer: null,
      sweetPopIn,
      beforePopIn,
      onHalf: jest.fn(),
      onComplete,
      devLog: jest.fn(),
    });

    expect(tile.visible).toBe(false);
    expect(beforePopIn).toHaveBeenCalledTimes(1);
    expect(sweetPopIn).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    finishCue();
    await Promise.resolve();
    await Promise.resolve();
    expect(sweetPopIn).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  } finally {
    window.requestAnimationFrame = originalRaf;
    document.body.innerHTML = '';
  }
});
