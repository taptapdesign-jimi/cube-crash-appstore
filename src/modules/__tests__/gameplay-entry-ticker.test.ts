import { Ticker } from 'pixi.js';
import { ensureGameplayEntryTicker } from '../gameplay-entry-ticker';
import { suspendGameplayRendererForTerminal } from '../gameplay-render-suspension';

describe('entry-owned Pixi ticker liveness', () => {
  let frames: Map<number, FrameRequestCallback>;
  let clock: number;
  const cancels: Array<() => void> = [];
  const tickers: Ticker[] = [];
  const step = () => {
    clock += 20;
    const batch = [...frames.entries()];
    batch.forEach(([id]) => frames.delete(id));
    batch.forEach(([, callback]) => callback(clock));
  };
  const stalled = () => {
    const ticker = {
      started: true, lastTime: 0, _requestId: null as number | null,
      stop: jest.fn(() => { ticker.started = false; }),
      start: jest.fn(() => { ticker.started = true; ticker._requestId = 900; }),
    };
    return { ticker };
  };

  beforeEach(() => {
    frames = new Map();
    clock = 0;
    let nextId = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextId, callback);
      return nextId;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  });
  afterEach(() => {
    cancels.splice(0).forEach(cancel => cancel());
    tickers.splice(0).forEach(ticker => ticker.destroy());
    jest.restoreAllMocks();
  });

  test('a real Pixi listener exception strands started=true; the current entry restores delivered ticks once', () => {
    const ticker = new Ticker();
    tickers.push(ticker);
    let delivered = 0;
    ticker.add(() => { if (++delivered === 1) throw new Error('retired effect'); });
    ticker.start();
    expect(step).toThrow('retired effect');
    expect(ticker.started).toBe(true);
    expect(frames.size).toBe(0);
    ticker.start();
    expect(frames.size).toBe(0);
    const stop = jest.spyOn(ticker, 'stop');
    cancels.push(ensureGameplayEntryTicker({ app: { ticker }, isCurrent: () => true }));
    expect(stop).not.toHaveBeenCalled();
    step();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    step();
    expect(delivered).toBe(2);
    expect(ticker.lastTime).toBe(clock);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('a check requested inside a healthy Pixi update never restarts that ticker', () => {
    const ticker = new Ticker();
    tickers.push(ticker);
    const app = { ticker };
    let first = true;
    ticker.add(() => {
      if (!first) return;
      first = false;
      cancels.push(ensureGameplayEntryTicker({ app, isCurrent: () => true }));
    });
    const stop = jest.spyOn(ticker, 'stop');
    ticker.start();
    step();
    step();
    expect(stop).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
  });

  test('healthy scheduled and unknown ticker implementations allocate no check', () => {
    const app = stalled();
    app.ticker._requestId = 7;
    ensureGameplayEntryTicker({ app, isCurrent: () => true });
    const { _requestId: _ignored, ...unknownTicker } = app.ticker;
    ensureGameplayEntryTicker({ app: { ticker: unknownTicker }, isCurrent: () => true });
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(app.ticker.stop).not.toHaveBeenCalled();
  });

  test('a normally stopped entry starts without a deferred check', () => {
    const app = stalled();
    app.ticker.started = false;
    ensureGameplayEntryTicker({ app, isCurrent: () => true });
    expect(app.ticker.start).toHaveBeenCalledTimes(1);
    expect(app.ticker.stop).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  test.each(['stale', 'abort', 'hidden', 'terminal', 'replacement', 'delivered'])(
    '%s ownership/liveness change cancels the pending repair', (change) => {
      const app = stalled();
      const original = app.ticker;
      let current = true;
      const controller = new AbortController();
      const remove = jest.spyOn(controller.signal, 'removeEventListener');
      cancels.push(ensureGameplayEntryTicker({ app, isCurrent: () => current, signal: controller.signal }));
      if (change === 'stale') current = false;
      if (change === 'abort') controller.abort();
      if (change === 'hidden') jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      if (change === 'terminal') {
        suspendGameplayRendererForTerminal(app, () => true, () => {});
        original.stop.mockClear();
      }
      if (change === 'replacement') app.ticker = stalled().ticker;
      if (change === 'delivered') original.lastTime = 1;
      step();
      expect(original.stop).not.toHaveBeenCalled();
      expect(original.start).not.toHaveBeenCalled();
      expect(frames.size).toBe(0);
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    },
  );

  test('repeated current entry checks replace their one pending frame', () => {
    const app = stalled();
    cancels.push(ensureGameplayEntryTicker({ app, isCurrent: () => true }));
    cancels.push(ensureGameplayEntryTicker({ app, isCurrent: () => true }));
    expect(frames.size).toBe(1);
    step();
    expect(app.ticker.stop).toHaveBeenCalledTimes(1);
    expect(app.ticker.start).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });

  test('an existing terminal hold never schedules or resumes an entry check', () => {
    const app = stalled();
    suspendGameplayRendererForTerminal(app, () => true, () => {});
    ensureGameplayEntryTicker({ app, isCurrent: () => true });
    expect(app.ticker.start).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
});
