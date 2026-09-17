import { buildSaveState, createGameSaveWriter } from '../app-core-save-state.ts';

const state = () => buildSaveState({ gridSnapshot: [[{ value: 1 }]], score: 0, level: 1,
  boardNumber: 1, moves: 10, wildMeter: 0, wildSpawnCount: 0, bestScore: 0,
  starsCount: 0, MOVES_MAX: 10, devLog: jest.fn() });

beforeEach(() => localStorage.clear());

test('unchanged lifecycle saves ignore time, preserve durable timestamp, and retain gameplay changes', () => {
  const writer = createGameSaveWriter();
  const original = { ...state(), timestamp: 100 };
  expect(writer.write('journey-1', original, localStorage)).toBe(true);
  expect(writer.write('journey-1', { ...original, timestamp: 200 }, localStorage)).toBe(false);
  expect(JSON.parse(localStorage.getItem('journey-1')!).timestamp).toBe(100);
  expect(writer.write('journey-1', { ...original, score: 6, timestamp: 300 }, localStorage)).toBe(true);
  expect(JSON.parse(localStorage.getItem('journey-1')!).score).toBe(6);
});

test('key identity protects Journey/Arcade and different board copies', () => {
  const writer = createGameSaveWriter();
  for (const key of ['journey-1', 'arcade', 'journey-2', 'journey-1']) {
    expect(writer.write(key, state(), localStorage)).toBe(true);
    expect(localStorage.getItem(key)).not.toBeNull();
  }
});

test('failed writes do not advance cache; retry and external deletion repair remain immediate', () => {
  const writer = createGameSaveWriter();
  const snapshot = state();
  const storage = { getItem: jest.fn(), setItem: jest.fn().mockImplementationOnce(() => { throw Error('quota'); }) };
  expect(() => writer.write('board', snapshot, storage)).toThrow('quota');
  expect(writer.write('board', snapshot, storage)).toBe(true);
  expect(storage.setItem).toHaveBeenCalledTimes(2);
  writer.write('board', snapshot, localStorage);
  localStorage.removeItem('board');
  expect(writer.write('board', snapshot, localStorage)).toBe(true);
});

test('restore primes keyed content without suppressing corrupt, removed, or reset records', () => {
  const writer = createGameSaveWriter();
  const snapshot = state();
  const serialized = JSON.stringify(snapshot);
  localStorage.setItem('board', serialized);
  writer.remember('board', serialized);
  expect(writer.write('board', { ...snapshot, timestamp: snapshot.timestamp + 10 }, localStorage)).toBe(false);
  writer.reset();
  expect(writer.write('board', snapshot, localStorage)).toBe(true);
  writer.remember('board', '{invalid');
  expect(writer.write('board', snapshot, localStorage)).toBe(true);
});
