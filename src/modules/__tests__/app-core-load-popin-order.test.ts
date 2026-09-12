import { playLoadPopInAnimation } from '../app-core-load-popin';
import { resumeDeferredWildIdleEffects } from '../app-core-load-tiles';

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

test('a failed continuation cue keeps saved tiles and board entrance gated', async () => {
  const tile = { visible: true };
  const sweetPopIn = jest.fn(() => Promise.resolve());
  const onComplete = jest.fn();

  await playLoadPopInAnimation({
    tiles: [tile],
    backgroundLayer: null,
    sweetPopIn,
    beforePopIn: jest.fn(() => Promise.reject(new Error('cue interrupted'))),
    onHalf: jest.fn(),
    onComplete,
    devLog: jest.fn(),
  });

  expect(tile.visible).toBe(false);
  expect(sweetPopIn).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

test('all restored Special idle owners start only after the board pop-in completes', () => {
  const liveKanta = { special: 'wild', _ccDeferWildIdleFx: true };
  const liveBee = { special: 'wild', _ccDeferWildIdleFx: true };
  const liveTnt = {
    special: 'wild-tnt',
    _ccDeferWildIdleFx: true,
    _ccDeferTntIdleFx: true,
  };
  const destroyedTnt = {
    special: 'wild-tnt',
    destroyed: true,
    _ccDeferWildIdleFx: true,
    _ccDeferTntIdleFx: true,
  };
  const changedTile = { special: null, _ccDeferWildIdleFx: true };
  const applyWildSkin = jest.fn();

  resumeDeferredWildIdleEffects(
    [liveKanta, liveBee, liveTnt, destroyedTnt, changedTile],
    applyWildSkin,
  );

  expect(applyWildSkin.mock.calls.map(([tile]) => tile)).toEqual([liveKanta, liveBee, liveTnt]);
  expect(liveKanta).not.toHaveProperty('_ccDeferWildIdleFx');
  expect(liveBee).not.toHaveProperty('_ccDeferWildIdleFx');
  expect(liveTnt).not.toHaveProperty('_ccDeferTntIdleFx');
  expect(liveTnt).not.toHaveProperty('_ccDeferWildIdleFx');
  expect(destroyedTnt).not.toHaveProperty('_ccDeferTntIdleFx');
  expect(destroyedTnt).not.toHaveProperty('_ccDeferWildIdleFx');
  expect(changedTile).not.toHaveProperty('_ccDeferWildIdleFx');
});
