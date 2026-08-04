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
