import { prepareSettingsSourcePaint } from '../settings-source-paint.js';

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

test('requires two frames and releases every finite resource on success', async () => {
  const gate = prepareSettingsSourcePaint(() => true);
  let done = false;
  void gate.ready.then(() => { done = true; });
  jest.advanceTimersByTime(16);
  await Promise.resolve();
  expect(done).toBe(false);
  jest.advanceTimersByTime(16);
  expect(await gate.ready).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test.each(['cancel', 'replacement', 'background', 'timeout'])('%s cannot authorize cover release or leak work', async reason => {
  let current = true;
  const gate = prepareSettingsSourcePaint(() => current);
  if (reason === 'cancel') gate.cancel();
  if (reason === 'replacement') { current = false; jest.advanceTimersByTime(16); }
  if (reason === 'background') {
    jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
  }
  if (reason === 'timeout') {
    // Backgrounded WebKit may stop RAF delivery without a visibility event.
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    gate.cancel();
    const stalled = prepareSettingsSourcePaint(() => true);
    jest.advanceTimersByTime(500);
    expect(await stalled.ready).toBe(false);
  }
  expect(await gate.ready).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});
