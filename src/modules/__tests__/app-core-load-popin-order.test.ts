import { playLoadPopInAnimation } from '../app-core-load-popin';
import { resumeDeferredTntIdleEffects } from '../app-core-load-tiles';

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

test('restored TNT idle starts only after the board pop-in owner completes', () => {
  const liveTnt = { special: 'wild-tnt', _ccDeferTntIdleFx: true };
  const destroyedTnt = { special: 'wild-tnt', destroyed: true, _ccDeferTntIdleFx: true };
  const changedTile = { special: 'wild-juice', _ccDeferTntIdleFx: true };
  const startParticles = jest.fn();
  const startShake = jest.fn();

  resumeDeferredTntIdleEffects(
    [liveTnt, destroyedTnt, changedTile],
    startParticles,
    startShake,
  );

  expect(startParticles).toHaveBeenCalledTimes(1);
  expect(startParticles).toHaveBeenCalledWith(liveTnt);
  expect(startShake).toHaveBeenCalledTimes(1);
  expect(startShake).toHaveBeenCalledWith(liveTnt);
  expect(liveTnt).not.toHaveProperty('_ccDeferTntIdleFx');
  expect(destroyedTnt).not.toHaveProperty('_ccDeferTntIdleFx');
  expect(changedTile).not.toHaveProperty('_ccDeferTntIdleFx');
});
