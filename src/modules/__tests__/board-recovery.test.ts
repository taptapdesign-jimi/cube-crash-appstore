import { checkAndRecoverBoard } from '../board-recovery';

const makeTile = (value: number, overrides: Partial<any> = {}) => ({
  value,
  locked: false,
  destroyed: false,
  special: undefined,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

test('stale pending clean-board flag is ignored when restored board is playable', async () => {
  localStorage.setItem('cc_pending_clean_board', JSON.stringify({
    boardNumber: 2,
    timestamp: Date.now(),
    reason: 'last_merge_detected',
  }));

  const triggerCleanBoard = jest.fn();
  const result = await checkAndRecoverBoard(
    [makeTile(1), makeTile(5), makeTile(2)],
    2,
    triggerCleanBoard,
  );

  expect(triggerCleanBoard).not.toHaveBeenCalled();
  expect(result.wasStuck).toBe(false);
  expect(localStorage.getItem('cc_pending_clean_board')).toBeNull();
});

test('pending clean-board flag still recovers true clean-board state', async () => {
  localStorage.setItem('cc_pending_clean_board', JSON.stringify({
    boardNumber: 2,
    timestamp: Date.now(),
    reason: 'last_merge_detected',
  }));

  const triggerCleanBoard = jest.fn().mockResolvedValue(undefined);
  const result = await checkAndRecoverBoard(
    [makeTile(6)],
    2,
    triggerCleanBoard,
  );

  expect(triggerCleanBoard).toHaveBeenCalledWith('board_recovery_pending_flag');
  expect(result.wasStuck).toBe(true);
  expect(result.recovered).toBe(true);
});
