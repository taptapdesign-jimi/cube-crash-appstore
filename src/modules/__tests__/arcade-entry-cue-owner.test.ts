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
  shouldOverlapArcadeEntryCueWithColdBoot,
} from '../arcade-entry-cue-owner';

afterEach(() => {
  resetArcadeEntryCueOwner();
  jest.clearAllMocks();
});

test('failed boot cancellation removes the active visual owner', async () => {
  void beginArcadeEntryCue(1);
  cancelArcadeEntryCueOwner();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(cancelArcadeStageClearModal).toHaveBeenCalledTimes(1);
});

test('cold renderer overlap is native-only so web GSAP cannot freeze during WebGL init', () => {
  expect(shouldOverlapArcadeEntryCueWithColdBoot('app:')).toBe(true);
  expect(shouldOverlapArcadeEntryCueWithColdBoot('http:')).toBe(false);
  expect(shouldOverlapArcadeEntryCueWithColdBoot('https:')).toBe(false);
});

test('begin and consume share one visual cue instead of replaying it after load', async () => {
  const started = beginArcadeEntryCue(1);
  await consumeArcadeEntryCue(1);
  await started;

  expect(showArcadeContinuationRoundCue).toHaveBeenCalledTimes(1);
  expect(showArcadeContinuationRoundCue).toHaveBeenCalledWith(1);
});
