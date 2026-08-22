import { JourneyCardInteractionProfiler } from '../journey-card-interaction-profiler';

describe('Journey Card interaction profiler', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const originalPerformanceNow = performance.now;

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    Object.defineProperty(performance, 'now', { configurable: true, value: originalPerformanceNow });
    delete (window as any).webkit;
  });

  it('buffers one bounded open-dismiss-scroll-reopen chain and retains the worst phases', () => {
    let now = 0;
    let nextFrameId = 0;
    const frames = new Map<number, FrameRequestCallback>();
    const messages: Array<{ level: string; message: string }> = [];
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      nextFrameId += 1;
      frames.set(nextFrameId, callback);
      return nextFrameId;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((frameId: number) => {
      frames.delete(frameId);
    }) as typeof window.cancelAnimationFrame;
    (window as any).webkit = {
      messageHandlers: {
        consoleLog: { postMessage: (message: { level: string; message: string }) => messages.push(message) },
      },
    };

    const runFrame = (at: number) => {
      now = at;
      const [frameId, callback] = Array.from(frames.entries())[0] ?? [];
      expect(callback).toBeDefined();
      frames.delete(frameId!);
      callback!(at);
    };

    const profiler = new JourneyCardInteractionProfiler();
    profiler.begin(2);
    runFrame(16);
    profiler.mark('dismiss-return-flight-start', 2);
    runFrame(46);
    profiler.mark('runtime-scrolling');
    runFrame(166);
    profiler.begin(4);
    profiler.mark('modal-entry-settled', 4);
    runFrame(8010);

    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('[CC_JOURNEY_CARD_CHAIN] summary');
    const payload = JSON.parse(messages[0].message.slice(messages[0].message.indexOf('{')));
    expect(payload).toMatchObject({
      result: 'window-complete',
      startBoardId: 2,
      openCount: 2,
      worstFrameMs: 7844,
      over50: 2,
    });
    expect(payload.marks).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'dismiss-return-flight-start', boardId: 2 }),
      expect.objectContaining({ phase: 'runtime-scrolling' }),
      expect.objectContaining({ phase: 'card-reopen-handler', boardId: 4 }),
      expect.objectContaining({ phase: 'modal-entry-settled', boardId: 4 }),
    ]));
    expect(payload.longFrames[0]).toMatchObject({ phase: 'modal-entry-settled', frameMs: 7844 });
    expect(frames.size).toBe(0);
  });

  it('emits once and cancels its RAF when the manager disposes it', () => {
    let callback: FrameRequestCallback | null = null;
    const cancel = jest.fn();
    const postMessage = jest.fn();
    window.requestAnimationFrame = ((next: FrameRequestCallback) => {
      callback = next;
      return 17;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = cancel as typeof window.cancelAnimationFrame;
    (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };

    const profiler = new JourneyCardInteractionProfiler();
    profiler.begin(1);
    expect(callback).not.toBeNull();
    profiler.mark('dismiss-requested', 1);
    profiler.dispose('manager-cleanup');
    profiler.dispose('manager-cleanup');

    expect(cancel).toHaveBeenCalledWith(17);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0].message).toContain('"result":"manager-cleanup"');
  });
});
