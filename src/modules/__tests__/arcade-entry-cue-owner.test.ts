jest.mock('../arcade-stage-clear-modal', () => ({
  showArcadeContinuationRoundCue: jest.fn(() => Promise.resolve()),
  cancelArcadeStageClearModal: jest.fn(),
}));

import { cancelArcadeStageClearModal, showArcadeContinuationRoundCue } from '../arcade-stage-clear-modal';
import {
  beginArcadeEntryCue,
  cancelArcadeEntryCueOwner,
  consumeArcadeEntryCue,
  resetArcadeEntryCueOwner,
  waitForArcadeEntryCuePresentation,
} from '../arcade-entry-cue-owner';
import {
  engageArcadeEntrySurfaceGate,
  isArcadeEntrySurfaceGateActive,
  cancelArcadeEntrySurfaceGate,
} from '../arcade-entry-surface-gate';

afterEach(() => {
  resetArcadeEntryCueOwner();
  cancelArcadeEntrySurfaceGate();
  jest.clearAllMocks();
});

test('resetting cue bookkeeping cannot reveal an entry surface owned by the current run', () => {
  engageArcadeEntrySurfaceGate();
  resetArcadeEntryCueOwner();
  expect(isArcadeEntrySurfaceGateActive()).toBe(true);
});

test('failed boot cancellation removes the active visual owner', async () => {
  void beginArcadeEntryCue(1);
  cancelArcadeEntryCueOwner();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(cancelArcadeStageClearModal).toHaveBeenCalledTimes(1);
});

test('begin and consume share one visual cue instead of replaying it after load', async () => {
  const started = beginArcadeEntryCue(1);
  await consumeArcadeEntryCue(1);
  await started;

  expect(showArcadeContinuationRoundCue).toHaveBeenCalledTimes(1);
  expect(showArcadeContinuationRoundCue).toHaveBeenCalledWith(1, expect.any(Function));
});

test('presentation waiter resolves at overlay ownership without waiting for the full cue', async () => {
  let finishCue!: () => void;
  (showArcadeContinuationRoundCue as jest.Mock).mockImplementationOnce((_round, onPresented) => {
    onPresented();
    return new Promise<void>((resolve) => { finishCue = resolve; });
  });

  const presented = waitForArcadeEntryCuePresentation(1);
  const cue = beginArcadeEntryCue(1);
  await expect(presented).resolves.toBeUndefined();
  expect(finishCue).toBeDefined();

  finishCue();
  await cue;
});

test('cancelling an abandoned cue releases presentation waiters', async () => {
  const presented = waitForArcadeEntryCuePresentation(1);
  cancelArcadeEntryCueOwner();
  await expect(presented).resolves.toBeUndefined();
});

test('a lazy cancellation from a retired route cannot cut off a newer Play cue', async () => {
  cancelArcadeEntryCueOwner();
  const currentCue = beginArcadeEntryCue(4);
  await currentCue;
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(showArcadeContinuationRoundCue).toHaveBeenCalledTimes(1);
  expect(showArcadeContinuationRoundCue).toHaveBeenCalledWith(4, expect.any(Function));
  expect(cancelArcadeStageClearModal).not.toHaveBeenCalled();
});

test('a retired lazy cue starter cannot mount over the cue owned by the latest Play', async () => {
  const staleCue = beginArcadeEntryCue(2);
  resetArcadeEntryCueOwner();
  const currentCue = beginArcadeEntryCue(3);

  await Promise.all([staleCue, currentCue]);

  expect(showArcadeContinuationRoundCue).toHaveBeenCalledTimes(1);
  expect(showArcadeContinuationRoundCue).toHaveBeenCalledWith(3, expect.any(Function));
});
