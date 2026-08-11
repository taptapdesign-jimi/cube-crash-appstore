import { createSweetPopInRunner } from '../app-core-popin-runner';

test('fresh board cubes wait for the current-Round cue before sweetPopIn', async () => {
  let finishCue!: () => void;
  const beforePopIn = jest.fn(() => new Promise<void>((resolve) => { finishCue = resolve; }));
  const sweetPopIn = jest.fn(() => Promise.resolve());
  const runner = createSweetPopInRunner({
    tiles: [{ visible: false }],
    sweetPopIn,
    beforePopIn,
    onHalf: jest.fn(),
    devLog: jest.fn(),
  });

  const result = runner();
  expect(beforePopIn).toHaveBeenCalledTimes(1);
  expect(sweetPopIn).not.toHaveBeenCalled();

  finishCue();
  await result;
  expect(sweetPopIn).toHaveBeenCalledTimes(1);
});

test('an aborted in-flight pop-in cannot finalize a newer entry', async () => {
  let finishPopIn!: () => void;
  const controller = new AbortController();
  const updateGhostVisibility = jest.fn();
  (window as any).__ccEnterAnimationActive = true;
  (window as any).updateGhostVisibility = updateGhostVisibility;
  const sweetPopIn = jest.fn((_tiles, options) => {
    expect(options.signal).toBe(controller.signal);
    return new Promise<void>((resolve) => { finishPopIn = resolve; });
  });
  const runner = createSweetPopInRunner({
    tiles: [{}],
    sweetPopIn,
    onHalf: jest.fn(),
    shouldAbort: () => controller.signal.aborted,
    getAbortSignal: () => controller.signal,
    devLog: jest.fn(),
  });

  const result = runner();
  controller.abort();
  finishPopIn();
  await result;

  expect((window as any).__ccEnterAnimationActive).toBe(true);
  expect(updateGhostVisibility).not.toHaveBeenCalled();
});
