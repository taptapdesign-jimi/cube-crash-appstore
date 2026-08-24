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
});
