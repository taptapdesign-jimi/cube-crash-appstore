import {
  createPostLoadRecoveryTileInfos,
  resolvePostLoadRecoveryDecision,
  schedulePostLoadRecoveryCheck,
} from '../app-core-load-recovery';

describe('app-core-load-recovery', () => {
  const noop = () => {};

  it('creates recovery tile infos without destroyed tiles', () => {
    const result = createPostLoadRecoveryTileInfos([
      { value: 4, locked: false, destroyed: false, special: null, gridX: 1, gridY: 2 },
      { value: 5, locked: true, destroyed: true, gridX: 3, gridY: 4 },
      { value: 0, locked: false, special: 'wild-juice', gridX: 2, gridY: 3 },
    ]);

    expect(result).toEqual([
      { value: 4, locked: false, destroyed: false, special: undefined, gridX: 1, gridY: 2 },
      { value: 0, locked: false, destroyed: false, special: 'wild-juice', gridX: 2, gridY: 3 },
    ]);
  });

  it('does not run endgame check when recovery already handled a stuck board', async () => {
    const checkLevelEnd = jest.fn();
    const checkAndRecoverBoard = jest.fn(async () => ({ wasStuck: true }));

    schedulePostLoadRecoveryCheck({
      tiles: [{ value: 5, locked: false }],
      boardNumber: 2,
      checkAndRecoverBoard,
      triggerCleanBoardFlow: noop,
      checkLevelEnd,
      trackAppTimeout: (fn: () => void) => fn(),
      devLog: noop,
      devWarn: noop,
    });

    await Promise.resolve();

    expect(checkAndRecoverBoard).toHaveBeenCalledTimes(1);
    expect(checkLevelEnd).not.toHaveBeenCalled();
  });

  it('runs central endgame check when recovery leaves the board alone', async () => {
    const checkLevelEnd = jest.fn();

    schedulePostLoadRecoveryCheck({
      tiles: [{ value: 4, locked: false }],
      boardNumber: 2,
      checkAndRecoverBoard: jest.fn(async () => ({ wasStuck: false })),
      triggerCleanBoardFlow: noop,
      checkLevelEnd,
      trackAppTimeout: (fn: () => void) => fn(),
      devLog: noop,
      devWarn: noop,
    });

    await Promise.resolve();

    expect(checkLevelEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps post-load recovery decision explicit', () => {
    expect(resolvePostLoadRecoveryDecision({ wasStuck: true })).toEqual({ type: 'recovered_stuck' });
    expect(resolvePostLoadRecoveryDecision({ wasStuck: false })).toEqual({ type: 'run_endgame_check' });
    expect(resolvePostLoadRecoveryDecision(null)).toEqual({ type: 'run_endgame_check' });
  });
});
