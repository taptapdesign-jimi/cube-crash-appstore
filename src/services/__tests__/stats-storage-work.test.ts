import { statsService } from '../stats-service.js';

beforeEach(() => { statsService.resetStats(); });

test('new high score writes once and verifies once', () => {
  const read = jest.spyOn(Storage.prototype, 'getItem');
  const write = jest.spyOn(Storage.prototype, 'setItem');
  statsService.updateHighScore(123);
  expect(write).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(1);
  expect(statsService.getStats().highScore).toBe(123);
  statsService.updateHighScore(123);
  expect(write).toHaveBeenCalledTimes(1);
});

test('mismatch still retries and quota still attempts minimal stats fallback', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const read = jest.spyOn(Storage.prototype, 'getItem').mockReturnValueOnce('{"highScore":0}');
  const write = jest.spyOn(Storage.prototype, 'setItem');
  statsService.updateHighScore(123);
  expect(read).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenCalledTimes(2);
  write.mockClear().mockImplementationOnce(() => { throw Error('quota'); });
  statsService.updateHighScore(124);
  expect(write).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem('cube_crash_stats_v1')!).highScore).toBe(124);
});

test('failed verification read retains fallback and persistent mismatch stays bounded', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => { throw Error('read unavailable'); });
  const write = jest.spyOn(Storage.prototype, 'setItem');
  statsService.updateHighScore(100);
  expect(write).toHaveBeenCalledTimes(2);
  expect(read).toHaveBeenCalledTimes(2);
  read.mockReturnValue('{"highScore":0}');
  write.mockClear();
  statsService.updateHighScore(101);
  expect(write).toHaveBeenCalledTimes(4);
});
