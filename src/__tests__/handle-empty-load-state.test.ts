import { handleEmptyLoadState } from '../modules/app-core-load-empty.ts';

describe('handleEmptyLoadState', () => {
  const noop = () => {};

  beforeEach(() => {
    (global as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  });

  it('returns handled=false when active tiles exist', () => {
    const tiles = [{ locked: false, value: 2 }];

    const result = handleEmptyLoadState({
      tiles,
      boardNumber: 1,
      getPendingCleanBoard: () => ({ pending: false }),
      clearPendingCleanBoard: noop,
      getBoardSaveKey: () => 'cc_saved_game_board_01',
      triggerCleanBoardFlow: noop,
      trackAppTimeout: noop,
      devLog: noop,
      devWarn: noop,
    });

    expect(result.handled).toBe(false);
  });

  it('returns handled=false when value-zero special dice exists', () => {
    const tiles = [{ locked: false, value: 0, special: 'wild-cubero' }];

    const result = handleEmptyLoadState({
      tiles,
      boardNumber: 1,
      getPendingCleanBoard: () => ({ pending: false }),
      clearPendingCleanBoard: noop,
      getBoardSaveKey: () => 'cc_saved_game_board_01',
      triggerCleanBoardFlow: noop,
      trackAppTimeout: noop,
      devLog: noop,
      devWarn: noop,
    });

    expect(result.handled).toBe(false);
  });

  it('returns handled=true when no tiles and no recovery needed', () => {
    const tiles: any[] = [];

    const result = handleEmptyLoadState({
      tiles,
      boardNumber: 1,
      getPendingCleanBoard: () => ({ pending: false }),
      clearPendingCleanBoard: noop,
      getBoardSaveKey: () => 'cc_saved_game_board_01',
      triggerCleanBoardFlow: noop,
      trackAppTimeout: noop,
      devLog: noop,
      devWarn: noop,
    });

    expect(result.handled).toBe(true);
  });

  it('uses injected no-moves fail flow for stuck saved boards', () => {
    const tiles: any[] = [{ locked: true, value: 4 }];
    const runFailFlow = jest.fn();
    const showFinalScreen = jest.fn();

    const result = handleEmptyLoadState({
      tiles,
      boardNumber: 1,
      getPendingCleanBoard: () => ({ pending: false }),
      clearPendingCleanBoard: noop,
      getBoardSaveKey: () => 'cc_saved_game_board_01',
      triggerCleanBoardFlow: noop,
      runFailFlow,
      showFinalScreen,
      trackAppTimeout: (fn: () => void) => fn(),
      devLog: noop,
      devWarn: noop,
    });

    expect(result.handled).toBe(true);
    expect(runFailFlow).toHaveBeenCalledWith({
      reason: 'load_empty_stuck_recovery',
      waitMs: 0,
      resetHint: false,
      exitTimeoutMs: 500,
    });
    expect(showFinalScreen).not.toHaveBeenCalled();
  });

  it('falls back to injected final screen when no fail flow is available', () => {
    const tiles: any[] = [{ locked: true, value: 4 }];
    const showFinalScreen = jest.fn();

    const result = handleEmptyLoadState({
      tiles,
      boardNumber: 1,
      getPendingCleanBoard: () => ({ pending: false }),
      clearPendingCleanBoard: noop,
      getBoardSaveKey: () => 'cc_saved_game_board_01',
      triggerCleanBoardFlow: noop,
      showFinalScreen,
      trackAppTimeout: (fn: () => void) => fn(),
      devLog: noop,
      devWarn: noop,
    });

    expect(result.handled).toBe(true);
    expect(showFinalScreen).toHaveBeenCalledWith({ confirmedFailFlow: true });
  });
});
