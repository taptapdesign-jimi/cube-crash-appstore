import { waitForFinalMergeHandoff } from '../final-merge-handoff';

test('final juice handoff waits for dedicated bubbles completion signal in arcade', async () => {
  const wait = jest.fn(async () => {});
  const waitForWildJuiceBubblesExplosionComplete = jest.fn(async () => {});

  await waitForFinalMergeHandoff({
    reason: 'clean_board_from_last_merge_final_juice',
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
    reason: 'clean_board_from_last_merge_final_juice',
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
