import { canSaveGameState } from '../app-core-save-guards';

describe('app-core save guards', () => {
  const base = {
    boardNumber: 3,
    userMadeMove: true,
    gameHasEnded: false,
    gridReady: true,
    devLog: jest.fn(),
  };

  beforeEach(() => {
    base.devLog.mockClear();
  });

  test('allows normal playable board saves', () => {
    expect(canSaveGameState(base)).toBe(true);
  });

  test('skips saves during transient wild drop handoff states', () => {
    expect(canSaveGameState({
      ...base,
      gameplayTransientBusy: true,
    })).toBe(false);
  });
});
