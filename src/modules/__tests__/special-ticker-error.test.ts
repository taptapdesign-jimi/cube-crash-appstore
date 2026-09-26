import { retireFailedSpecialTickerOwner } from '../special-ticker-error';

test('reports one bounded native diagnostic even when failed-owner cleanup also throws', () => {
  const previous = (window as any).webkit;
  const postMessage = jest.fn();
  (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
  try {
    const cleanup = jest.fn(() => { throw new Error('cleanup failure'); });
    expect(() => retireFailedSpecialTickerOwner('test', new Error('x'.repeat(8000)), cleanup)).not.toThrow();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postMessage.mock.calls[0][0].message.split('owner-retired ')[1]);
    expect(payload.family).toBe('test');
    expect(payload.error.length).toBeLessThanOrEqual(1200);
    expect(payload.cleanupError.length).toBeLessThanOrEqual(1200);
  } finally { (window as any).webkit = previous; }
});
