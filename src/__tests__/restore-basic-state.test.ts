import { restoreBasicState } from '../modules/app-core-load-basics.ts';

describe('restoreBasicState', () => {
  it('restores fields with defaults', () => {
    const captured: Record<string, number> = {};

    const result = restoreBasicState({
      gameState: { score: 10, level: 3, boardNumber: 4, moves: 6, wildMeter: 2, wildSpawnCount: 3, starsCount: 5 },
      MOVES_MAX: 12,
      STATE: {},
      setScore: (v) => { captured.score = v; },
      setLevel: (v) => { captured.level = v; },
      setBoardNumber: (v) => { captured.boardNumber = v; },
      setMoves: (v) => { captured.moves = v; },
      setWildMeter: (v) => { captured.wildMeter = v; },
      setWildSpawnCount: (v) => { captured.wildSpawnCount = v; },
      devLog: () => {},
    });

    expect(captured.score).toBe(10);
    expect(captured.level).toBe(3);
    expect(captured.boardNumber).toBe(4);
    expect(captured.moves).toBe(6);
    expect(captured.wildMeter).toBe(2);
    expect(captured.wildSpawnCount).toBe(3);
    expect(result.savedStarsCount).toBe(5);
  });

  it('falls back to defaults when values are missing', () => {
    const captured: Record<string, number> = {};

    const result = restoreBasicState({
      gameState: {},
      MOVES_MAX: 15,
      STATE: {},
      setScore: (v) => { captured.score = v; },
      setLevel: (v) => { captured.level = v; },
      setBoardNumber: (v) => { captured.boardNumber = v; },
      setMoves: (v) => { captured.moves = v; },
      setWildMeter: (v) => { captured.wildMeter = v; },
      setWildSpawnCount: (v) => { captured.wildSpawnCount = v; },
      devLog: () => {},
    });

    expect(captured.score).toBe(0);
    expect(captured.level).toBe(1);
    expect(captured.boardNumber).toBe(1);
    expect(captured.moves).toBe(15);
    expect(captured.wildMeter).toBe(0);
    expect(captured.wildSpawnCount).toBe(0);
    expect(result.savedStarsCount).toBe(0);
  });
});
