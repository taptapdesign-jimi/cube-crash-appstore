import { boardTransitionPresentationHandoff } from '../board-transition-presentation-handoff';

describe('board transition presentation handoff', () => {
  afterEach(() => boardTransitionPresentationHandoff.cancel());

  test('keeps the cover until two prepared presentation frames complete', async () => {
    const frames: FrameRequestCallback[] = [];
    const scheduleFrame = jest.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const renderPreparedFrame = jest.fn();
    const release = jest.fn();

    boardTransitionPresentationHandoff.retain(release);
    const result = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      renderPreparedFrame,
      scheduleFrame,
    });

    expect(renderPreparedFrame).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    frames.shift()?.(0);
    await Promise.resolve();
    expect(renderPreparedFrame).toHaveBeenCalledTimes(2);
    expect(release).not.toHaveBeenCalled();
    frames.shift()?.(16);
    await expect(result).resolves.toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('coalesces repeated release requests', () => {
    const frames: FrameRequestCallback[] = [];
    const scheduleFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };
    boardTransitionPresentationHandoff.retain(jest.fn());

    const first = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      renderPreparedFrame: jest.fn(),
      scheduleFrame,
    });
    const second = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      renderPreparedFrame: jest.fn(),
      scheduleFrame,
    });

    expect(second).toBe(first);
    expect(frames).toHaveLength(1);
  });

  test('a cancelled generation cannot release a stale cover', async () => {
    const frames: FrameRequestCallback[] = [];
    const release = jest.fn();
    boardTransitionPresentationHandoff.retain(release);
    const result = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      renderPreparedFrame: jest.fn(),
      scheduleFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
    });

    boardTransitionPresentationHandoff.cancel();
    frames.shift()?.(0);
    await expect(result).resolves.toBe(false);
    expect(release).not.toHaveBeenCalled();
  });

  test('replacement between prepared frames cannot release the newer cover', async () => {
    const oldFrames: FrameRequestCallback[] = [];
    const newFrames: FrameRequestCallback[] = [];
    const oldRelease = jest.fn();
    const newRelease = jest.fn();
    boardTransitionPresentationHandoff.retain(oldRelease);
    const oldResult = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      renderPreparedFrame: jest.fn(),
      scheduleFrame: (callback) => { oldFrames.push(callback); return oldFrames.length; },
    });
    oldFrames.shift()?.(0);
    await Promise.resolve();

    boardTransitionPresentationHandoff.retain(newRelease);
    const newResult = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      renderPreparedFrame: jest.fn(),
      scheduleFrame: (callback) => { newFrames.push(callback); return newFrames.length; },
    });
    oldFrames.shift()?.(16);
    await expect(oldResult).resolves.toBe(false);
    expect(newRelease).not.toHaveBeenCalled();

    newFrames.shift()?.(32);
    await Promise.resolve();
    newFrames.shift()?.(48);
    await expect(newResult).resolves.toBe(true);
    expect(oldRelease).toHaveBeenCalledTimes(1);
    expect(newRelease).toHaveBeenCalledTimes(1);
  });

  test('falls back when the frame scheduler throws instead of stranding the cover', async () => {
    jest.useFakeTimers();
    const release = jest.fn();
    boardTransitionPresentationHandoff.retain(release);
    const result = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      renderPreparedFrame: jest.fn(),
      scheduleFrame: () => { throw new Error('RAF unavailable'); },
    });
    await jest.advanceTimersByTimeAsync(40);
    await expect(result).resolves.toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('a stale gameplay lease cannot release a cover claimed by its replacement', async () => {
    const frames: FrameRequestCallback[] = [];
    const release = jest.fn();
    boardTransitionPresentationHandoff.retain(release);
    const staleLease = boardTransitionPresentationHandoff.claimForGameplayEntry(10)!;
    const staleResult = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      lease: staleLease,
      renderPreparedFrame: jest.fn(),
      scheduleFrame: (callback) => { frames.push(callback); return frames.length; },
    });
    const currentLease = boardTransitionPresentationHandoff.claimForGameplayEntry(11)!;
    frames.shift()?.(0);
    await expect(staleResult).resolves.toBe(false);

    const currentResult = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      lease: currentLease,
      renderPreparedFrame: jest.fn(),
      scheduleFrame: (callback) => { frames.push(callback); return frames.length; },
    });
    frames.shift()?.(16);
    await Promise.resolve();
    frames.shift()?.(32);
    await expect(currentResult).resolves.toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('a throwing release callback still terminates cover ownership', async () => {
    const frames: FrameRequestCallback[] = [];
    boardTransitionPresentationHandoff.retain(() => { throw new Error('DOM cleanup failed'); });
    const result = boardTransitionPresentationHandoff.releaseAfterPreparedFrames({
      renderPreparedFrame: jest.fn(),
      scheduleFrame: (callback) => { frames.push(callback); return frames.length; },
    });

    frames.shift()?.(0);
    await Promise.resolve();
    frames.shift()?.(16);
    await expect(result).resolves.toBe(true);
    expect(boardTransitionPresentationHandoff.hasPendingCover()).toBe(false);
  });
});
