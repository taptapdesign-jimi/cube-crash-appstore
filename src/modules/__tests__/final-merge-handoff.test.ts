import { waitForFinalMergeHandoff } from '../final-merge-handoff';
import { FINAL_MERGE_REASONS } from '../final-merge-reasons';

beforeEach(() => {
  try {
    (window as any).__ccFinalSpecialFxGuards = {};
  } catch {}
});

test('final juice handoff waits for dedicated bubbles completion signal in arcade', async () => {
  const wait = jest.fn(async () => {});
  const waitForWildJuiceBubblesExplosionComplete = jest.fn(async () => {});

  await waitForFinalMergeHandoff({
    reason: FINAL_MERGE_REASONS.juice,
    isArcade: true,
    wait,
    isWildJuiceBubblesExplosionActive: () => true,
    waitForWildJuiceBubblesExplosionComplete,
  });

  expect(waitForWildJuiceBubblesExplosionComplete).toHaveBeenCalledTimes(1);
  expect(waitForWildJuiceBubblesExplosionComplete).toHaveBeenCalledWith(5200);
});

test('final juice handoff gives animation a short startup window before deciding it is inactive', async () => {
  let activeChecks = 0;
  const wait = jest.fn(async () => {});
  const waitForWildJuiceBubblesExplosionComplete = jest.fn(async () => {});

  await waitForFinalMergeHandoff({
    reason: FINAL_MERGE_REASONS.juice,
    isArcade: true,
    wait,
    isWildJuiceBubblesExplosionActive: () => {
      activeChecks += 1;
      return activeChecks >= 4;
    },
    waitForWildJuiceBubblesExplosionComplete,
  });

  expect(waitForWildJuiceBubblesExplosionComplete).toHaveBeenCalledWith(5200);
  expect(wait).toHaveBeenCalledWith(180);
  expect(wait).toHaveBeenCalledWith(80);
});

test('recent juice animation is waited even when clean-board reason is generic', async () => {
  let activeChecks = 0;
  const wait = jest.fn(async () => {});
  const waitForWildJuiceBubblesExplosionComplete = jest.fn(async () => {});

  await waitForFinalMergeHandoff({
    reason: 'clean_board_from_checkLevelEnd',
    isArcade: false,
    wait,
    isWildJuiceBubblesExplosionRecentlyStarted: () => true,
    isWildJuiceBubblesExplosionActive: () => {
      activeChecks += 1;
      return activeChecks >= 3;
    },
    waitForWildJuiceBubblesExplosionComplete,
  });

  expect(waitForWildJuiceBubblesExplosionComplete).toHaveBeenCalledTimes(1);
  expect(waitForWildJuiceBubblesExplosionComplete).toHaveBeenCalledWith(6500);
  expect(wait).toHaveBeenCalledWith(80);
});

test('final magnet handoff waits for magnetic text completion signal', async () => {
  const wait = jest.fn(async () => {});
  const waitForMagneticTextComplete = jest.fn(async () => {});

  await waitForFinalMergeHandoff({
    reason: FINAL_MERGE_REASONS.magnet,
    isArcade: false,
    wait,
    isMagneticTextActive: () => true,
    waitForMagneticTextComplete,
  });

  expect(waitForMagneticTextComplete).toHaveBeenCalledTimes(1);
  expect(waitForMagneticTextComplete).toHaveBeenCalledWith(4000);
});

test('final sparkle handoff waits for sparkle completion signal', async () => {
  const wait = jest.fn(async () => {});
  const waitForSparkleTextComplete = jest.fn(async () => {});

  await waitForFinalMergeHandoff({
    reason: FINAL_MERGE_REASONS.star,
    isArcade: false,
    wait,
    isSparkleTextActive: () => true,
    waitForSparkleTextComplete,
  });

  expect(waitForSparkleTextComplete).toHaveBeenCalledTimes(1);
  expect(waitForSparkleTextComplete).toHaveBeenCalledWith(2200);
});

test('final juice handoff starts missing finale through central callback', async () => {
  const wait = jest.fn(async () => {});
  let active = false;
  const showWildJuiceFinale = jest.fn(() => {
    active = true;
  });
  const waitForWildJuiceBubblesExplosionComplete = jest.fn(async () => {});

  await waitForFinalMergeHandoff({
    reason: FINAL_MERGE_REASONS.juice,
    isArcade: false,
    wait,
    isWildJuiceBubblesExplosionActive: () => active,
    showWildJuiceFinale,
    waitForWildJuiceBubblesExplosionComplete,
  });

  expect(showWildJuiceFinale).toHaveBeenCalledTimes(1);
  expect(waitForWildJuiceBubblesExplosionComplete).toHaveBeenCalledWith(6500);
});

test('final sparkle handoff starts missing finale through central callback', async () => {
  const wait = jest.fn(async () => {});
  let active = false;
  const showSparkleFinale = jest.fn(() => {
    active = true;
  });
  const waitForSparkleTextComplete = jest.fn(async () => {});

  await waitForFinalMergeHandoff({
    reason: FINAL_MERGE_REASONS.star,
    isArcade: false,
    wait,
    isSparkleTextActive: () => active,
    showSparkleFinale,
    waitForSparkleTextComplete,
  });

  expect(showSparkleFinale).toHaveBeenCalledTimes(1);
  expect(waitForSparkleTextComplete).toHaveBeenCalledWith(2200);
});

test('generic handoff waits for any active finale runtime', async () => {
  const wait = jest.fn(async () => {});
  let active = true;
  const onTntAnimationComplete = jest.fn((cb: () => void) => {
    active = false;
    cb();
  });

  await waitForFinalMergeHandoff({
    reason: 'clean_board_from_checkLevelEnd',
    isArcade: false,
    wait,
    isTntAnimationActive: () => active,
    onTntAnimationComplete,
  });

  expect(onTntAnimationComplete).toHaveBeenCalledTimes(1);
});

test('generic handoff waits for a finale runtime that appears shortly after initial checks', async () => {
  let waitCalls = 0;
  let active = false;
  const wait = jest.fn(async () => {
    waitCalls += 1;
    if (waitCalls === 3) active = true;
  });
  const waitForWildJuiceBubblesExplosionComplete = jest.fn(async () => {
    active = false;
  });

  await waitForFinalMergeHandoff({
    reason: 'clean_board_from_checkLevelEnd',
    isArcade: false,
    wait,
    isWildJuiceBubblesExplosionActive: () => active,
    waitForWildJuiceBubblesExplosionComplete,
  });

  expect(waitForWildJuiceBubblesExplosionComplete).toHaveBeenCalledTimes(1);
  expect(waitForWildJuiceBubblesExplosionComplete).toHaveBeenCalledWith(6500);
});
