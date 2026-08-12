import fs from 'node:fs';
import path from 'node:path';
import { handleSweetPopInComplete } from '../app-core-popin-final.ts';
import { handleHudDropOnHalf } from '../app-core-hud-drop.ts';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Play Again HUD drop contract', () => {
  it('arms the one-shot HUD drop before both fail-modal restart paths', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'src/modules/board-fail-modal.ts'),
      'utf8',
    );
    const retryStart = source.indexOf("if (action === 'retry')");
    const retryEnd = source.indexOf("} else if (action === 'menu')", retryStart);
    const retryOwner = source.slice(retryStart, retryEnd);

    expect(retryOwner.match(/restart!\(\{ animateHudDrop: true \}\)/g)).toHaveLength(2);
  });

  it('does not snap a pending fallback drop to its final pose before deferred paint', () => {
    const hudRoot: Record<string, any> = {
      _dropTop: 44,
      y: -96,
      alpha: 0,
      visible: true,
      _dropped: false,
    };
    const frames: Array<() => void> = [];
    const playHudDrop = jest.fn();
    const setHudDropPending = jest.fn();

    handleSweetPopInComplete({
      app: null,
      board: null,
      tiles: [],
      HUD: { HUD_ROOT: hudRoot, playHudDrop },
      hudRootFromWindow: hudRoot,
      trackAppAnimationFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      devLog: jest.fn(),
      devWarn: jest.fn(),
      devError: jest.fn(),
      hudDropPending: true,
      setHudDropPending,
    });

    expect(hudRoot).toMatchObject({
      _dropTop: 44,
      y: -96,
      alpha: 0,
      visible: true,
      _dropped: false,
      _ccHudDropScheduled: true,
    });
    expect(playHudDrop).not.toHaveBeenCalled();
    expect(setHudDropPending).toHaveBeenCalledWith(false);

    frames.shift()?.();
    frames.shift()?.();
    expect(playHudDrop).toHaveBeenCalledTimes(1);
    expect(playHudDrop).toHaveBeenCalledWith({ forceRestart: true });
  });

  it('repairs the final HUD pose when no drop belongs to this entry', () => {
    const hudRoot = { _dropTop: 44, y: -96, alpha: 0, visible: false, _dropped: false };

    handleSweetPopInComplete({
      app: null,
      board: null,
      tiles: [],
      HUD: { HUD_ROOT: hudRoot, playHudDrop: jest.fn() },
      hudRootFromWindow: hudRoot,
      trackAppAnimationFrame: jest.fn(),
      devLog: jest.fn(),
      devWarn: jest.fn(),
      devError: jest.fn(),
      hudDropPending: false,
      setHudDropPending: jest.fn(),
    });

    expect(hudRoot).toEqual({ _dropTop: 44, y: 44, alpha: 1, visible: true, _dropped: true });
  });

  it('does not let pop-in completion snap a midpoint drop before its tween completes', () => {
    const hudRoot: Record<string, any> = {
      _dropTop: 44,
      y: -96,
      alpha: 0,
      visible: true,
      _dropped: false,
    };
    const frames: Array<() => void> = [];
    const playHudDrop = jest.fn(() => {
      hudRoot._ccHudDropActive = true;
    });
    const trackAppAnimationFrame = (callback: () => void) => {
      frames.push(callback);
      return frames.length;
    };

    handleHudDropOnHalf({
      app: null,
      HUD: { HUD_ROOT: hudRoot, playHudDrop },
      hudRootFromWindow: hudRoot,
      trackAppAnimationFrame,
      devLog: jest.fn(),
      devWarn: jest.fn(),
      devError: jest.fn(),
      hudDropPending: true,
      setHudDropPending: jest.fn(),
    });
    expect(hudRoot._ccHudDropScheduled).toBe(true);

    frames.shift()?.();
    frames.shift()?.();
    expect(playHudDrop).toHaveBeenCalledTimes(1);
    expect(hudRoot._ccHudDropActive).toBe(true);

    handleSweetPopInComplete({
      app: null,
      board: null,
      tiles: [],
      HUD: { HUD_ROOT: hudRoot, playHudDrop },
      hudRootFromWindow: hudRoot,
      trackAppAnimationFrame,
      devLog: jest.fn(),
      devWarn: jest.fn(),
      devError: jest.fn(),
      hudDropPending: false,
      setHudDropPending: jest.fn(),
    });

    expect(hudRoot).toMatchObject({ y: -96, alpha: 0, visible: true, _dropped: false });
    expect(playHudDrop).toHaveBeenCalledTimes(1);
  });
});
