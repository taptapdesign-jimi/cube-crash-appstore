import { saveArcadeRoundAfterEntry } from '../app-core-startlevel-save';

describe('Arcade next-Round entry checkpoint', () => {
  test('replaces the cleared Round 1 snapshot after Round 2 entrance settles', () => {
    let savedRound = 1;
    const saveGameState = jest.fn(() => { savedRound = 2; });
    const onCommitted = jest.fn();
    const checkpoint = () => saveArcadeRoundAfterEntry({
      boardNumber: 2,
      isArcade: true,
      isCurrentEntry: () => true,
      saveGameState,
      readSavedRound: () => savedRound,
      isSavedStateResumable: () => savedRound === 2,
      onCommitted,
      devLog: jest.fn(),
    });

    expect(savedRound).toBe(1); // the 100ms save may be skipped during pop-in
    expect(checkpoint()).toBe(true);
    expect(savedRound).toBe(2);
    expect(saveGameState).toHaveBeenCalledTimes(1);
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  test('a retired entry or Journey board cannot overwrite Arcade continuation', () => {
    const saveGameState = jest.fn();
    const common = {
      boardNumber: 2,
      saveGameState,
      readSavedRound: () => 1,
      isSavedStateResumable: () => true,
      devLog: jest.fn(),
      onCommitted: jest.fn(),
    };
    expect(saveArcadeRoundAfterEntry({
      ...common,
      isArcade: true,
      isCurrentEntry: () => false,
    })).toBe(false);
    expect(saveArcadeRoundAfterEntry({
      ...common,
      isArcade: false,
      isCurrentEntry: () => true,
    })).toBe(false);
    expect(saveGameState).not.toHaveBeenCalled();
  });

  test('a guarded or invalid first write is retried at the settled entry', () => {
    let savedRound = 1;
    let resumable = false;
    const saveGameState = jest.fn()
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => { savedRound = 2; resumable = true; });
    const checkpoint = () => saveArcadeRoundAfterEntry({
      boardNumber: 2,
      isArcade: true,
      isCurrentEntry: () => true,
      saveGameState,
      readSavedRound: () => savedRound,
      isSavedStateResumable: () => resumable,
      devLog: jest.fn(),
    });
    expect(checkpoint()).toBe(false);
    expect(savedRound).toBe(1);
    expect(checkpoint()).toBe(true);
    expect(savedRound).toBe(2);
  });
});
