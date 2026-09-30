/** @jest-environment jsdom */

import fs from 'node:fs';

jest.mock('../fx', () => ({ smokeBubblesAtTile: jest.fn() }));

import {
  notifyBoardInteraction,
  startTileIdleBounce,
  stopTileIdleBounce,
} from '../tile-idle-bounce';

describe('regular tile idle scheduling visibility ownership', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    stopTileIdleBounce();
  });

  afterEach(() => {
    stopTileIdleBounce();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('parks every idle wakeup while hidden and resumes the exact remaining delay', () => {
    startTileIdleBounce([], {});
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(1_250);

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(jest.getTimerCount()).toBe(0);

    jest.advanceTimersByTime(60_000);
    expect(jest.getTimerCount()).toBe(0);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(2_749);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);
    expect(jest.getTimerCount()).toBe(1);

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a hidden interaction remains parked and restarts one full visible idle delay', () => {
    startTileIdleBounce([], {});
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));

    jest.advanceTimersByTime(500);
    notifyBoardInteraction();
    jest.advanceTimersByTime(60_000);
    expect(jest.getTimerCount()).toBe(0);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(3_999);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);
    expect(jest.getTimerCount()).toBe(1);
  });

  test('pagehide without visibilitychange parks the timer and pageshow resumes its phase', () => {
    startTileIdleBounce([], {});
    jest.advanceTimersByTime(900);

    window.dispatchEvent(new Event('pagehide'));
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(60_000);
    expect(jest.getTimerCount()).toBe(0);

    window.dispatchEvent(new Event('pageshow'));
    jest.advanceTimersByTime(3_099);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);
    expect(jest.getTimerCount()).toBe(1);
  });

  test('a due callback racing ahead of visibilitychange resumes immediately without cadence reset', () => {
    startTileIdleBounce([], {});
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    jest.advanceTimersByTime(4_000);
    expect(jest.getTimerCount()).toBe(0);

    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(60_000);
    expect(jest.getTimerCount()).toBe(0);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(0);
    expect(jest.getTimerCount()).toBe(1);
  });

  test('stop removes the visibility owner and cannot restart scheduling', () => {
    const remove = jest.spyOn(document, 'removeEventListener');
    startTileIdleBounce([], {});
    stopTileIdleBounce();
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(jest.getTimerCount()).toBe(0);
  });

  test('idle smoke uses one grouped GSAP root without changing its authored profile', () => {
    const source = fs.readFileSync('src/modules/tile-idle-bounce.ts', 'utf8');
    const call = source.split('smokeBubblesAtTile(state.board, tile, TILE, 1.10, {')[1]
      ?.split('});', 1)[0] ?? '';
    expect(call).toContain('baseAlpha: 0.58');
    expect(call).toContain('countScale: 1.04');
    expect(call).toContain('durationScale: 0.84');
    expect(call).toContain("fxTag: 'tile-idle-smoke'");
    expect(call).toContain('groupedOwner: true');
  });
});
