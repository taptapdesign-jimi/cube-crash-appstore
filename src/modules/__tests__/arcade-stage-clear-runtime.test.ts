const soundtrackMocks = {
  completeGameplayTransitionFade: jest.fn(),
  enterArcadeGameplaySoundtrack: jest.fn(),
  fadeOutSoundtrackForGameplay: jest.fn(() => 1),
  setSoundtrackResultMix: jest.fn(),
};

const digitSoundMocks = {
  playArcadeRoundDigitSound: jest.fn(),
  playArcadeRoundExitSound: jest.fn(),
  preloadArcadeRoundDigitSounds: jest.fn(),
  stopArcadeRoundDigitSounds: jest.fn(),
};

const stageClearSoundMocks = {
  fadeOutArcadeStageClearCelebrationSounds: jest.fn(),
  playArcadeStageClearCelebrationSounds: jest.fn(),
  playArcadeStageClearThumbWhooshSound: jest.fn(),
  preloadArcadeStageClearSounds: jest.fn(),
  stopArcadeStageClearSounds: jest.fn(),
};

jest.mock('../soundtrack-manager.ts', () => soundtrackMocks);
jest.mock('../arcade-round-digit-sound.ts', () => digitSoundMocks);
jest.mock('../arcade-stage-clear-sound.ts', () => stageClearSoundMocks);
jest.mock('../../utils/ios-native-diagnostic.js', () => ({
  emitNativeConsoleDiagnostic: jest.fn(),
}));

jest.mock('gsap', () => {
  type TimelineVars = {
    delay?: number;
    onStart?: () => void;
    onComplete?: () => void;
  };
  type TweenVars = {
    duration?: number;
    repeat?: number;
    onStart?: () => void;
    onComplete?: () => void;
  };

  const trace: Array<{ event: string; target: string; at: number }> = [];

  const targetName = (target: unknown): string => {
    if (target instanceof HTMLElement) {
      return target.className || target.id || target.tagName.toLowerCase();
    }
    return 'unknown';
  };

  class FakeTimeline {
    private readonly createdAt = Date.now();
    private readonly delayMs: number;
    private cursorMs = 0;
    private completeTimer: ReturnType<typeof setTimeout> | null = null;
    private markerTimer: ReturnType<typeof setTimeout> | null = null;
    private startTimer: ReturnType<typeof setTimeout> | null = null;
    private completed = false;
    private killed = false;
    private onComplete?: () => void;

    constructor(private readonly vars: TimelineVars = {}) {
      this.delayMs = Math.max(0, Number(vars.delay ?? 0) * 1000);
      this.onComplete = vars.onComplete;
    }

    to(target: unknown, vars: TweenVars = {}, position?: number | string): this {
      const startMs = typeof position === 'number'
        ? Math.max(0, position * 1000)
        : this.cursorMs;
      const endMs = startMs + Math.max(0, Number(vars.duration ?? 0) * 1000);
      this.cursorMs = Math.max(this.cursorMs, endMs);

      if (!this.startTimer && this.vars.onStart) {
        this.startTimer = setTimeout(() => {
          if (!this.killed) this.vars.onStart?.();
        }, this.delayMs);
      }
      if (vars.onStart) {
        setTimeout(() => {
          if (!this.killed) vars.onStart?.();
        }, this.delayMs + startMs);
      }
      if (vars.onComplete) {
        setTimeout(() => {
          if (this.killed) return;
          trace.push({ event: 'tween-complete', target: targetName(target), at: Date.now() });
          vars.onComplete?.();
        }, this.delayMs + endMs);
      }

      if (this.onComplete) this.scheduleTimelineCompletion();
      else this.scheduleCompletionMarker();
      return this;
    }

    eventCallback(name: string, callback: () => void): this {
      if (name !== 'onComplete') return this;
      this.onComplete = callback;
      // GSAP does not replay an onComplete callback attached after completion.
      // This behavior is the race this regression test must preserve.
      if (!this.completed) {
        if (this.markerTimer) clearTimeout(this.markerTimer);
        this.scheduleTimelineCompletion();
      }
      return this;
    }

    kill(): void {
      this.killed = true;
      if (this.startTimer) clearTimeout(this.startTimer);
      if (this.markerTimer) clearTimeout(this.markerTimer);
      if (this.completeTimer) clearTimeout(this.completeTimer);
    }

    private remainingMs(): number {
      return Math.max(0, this.delayMs + this.cursorMs - (Date.now() - this.createdAt));
    }

    private scheduleCompletionMarker(): void {
      if (this.markerTimer) clearTimeout(this.markerTimer);
      this.markerTimer = setTimeout(() => {
        if (!this.killed) this.completed = true;
      }, this.remainingMs());
    }

    private scheduleTimelineCompletion(): void {
      if (!this.onComplete || this.completed) return;
      if (this.completeTimer) clearTimeout(this.completeTimer);
      this.completeTimer = setTimeout(() => {
        if (this.killed || this.completed) return;
        this.completed = true;
        trace.push({ event: 'timeline-complete', target: 'timeline', at: Date.now() });
        this.onComplete?.();
      }, this.remainingMs());
    }
  }

  const makeTween = (callback?: () => void, delayMs = 0) => {
    let killed = false;
    const timer = callback
      ? setTimeout(() => {
          if (!killed) callback();
        }, delayMs)
      : null;
    return {
      kill: () => {
        killed = true;
        if (timer) clearTimeout(timer);
      },
    };
  };

  return {
    __gsapRuntimeTrace: trace,
    gsap: {
      timeline: (vars?: TimelineVars) => new FakeTimeline(vars),
      delayedCall: (delaySeconds: number, callback: () => void) =>
        makeTween(callback, Math.max(0, delaySeconds * 1000)),
      to: (_target: unknown, vars: TweenVars = {}) => {
        if (vars.repeat === -1) return makeTween();
        return makeTween(vars.onComplete, Math.max(0, Number(vars.duration ?? 0) * 1000));
      },
      set: jest.fn(),
      getProperty: jest.fn(() => 0),
      killTweensOf: jest.fn(),
    },
  };
});

import {
  cleanupArcadeStageClearModal,
  showArcadeStageClearModal,
} from '../arcade-stage-clear-modal.js';

async function flushUntilSettled<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  let result: T | undefined;
  let failure: unknown;
  promise.then(
    (value) => {
      settled = true;
      result = value;
    },
    (error) => {
      settled = true;
      failure = error;
    },
  );

  for (let step = 0; step < 30 && !settled; step += 1) {
    await Promise.resolve();
    await Promise.resolve();
    if (jest.getTimerCount() > 0) jest.runOnlyPendingTimers();
  }
  await Promise.resolve();

  if (!settled) throw new Error('Arcade stage-clear lifecycle did not settle');
  if (failure) throw failure;
  return result as T;
}

describe('Arcade stage-clear runtime ownership', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';
    jest.spyOn(Math, 'random').mockReturnValue(0.82); // Selects the 8-letter "Congrats" title.
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
    const { __gsapRuntimeTrace } = jest.requireMock('gsap') as {
      __gsapRuntimeTrace: Array<unknown>;
    };
    __gsapRuntimeTrace.length = 0;
  });

  afterEach(() => {
    cleanupArcadeStageClearModal(false);
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  test('a thumb that completes before the title still advances exactly once through Round 02', async () => {
    const onRoundPresented = jest.fn();
    let resultSettled = false;
    const resultPromise = showArcadeStageClearModal(1, 2, onRoundPresented);
    resultPromise.then(() => {
      resultSettled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(480);
    await Promise.resolve();

    const { __gsapRuntimeTrace } = jest.requireMock('gsap') as {
      __gsapRuntimeTrace: Array<{ event: string; target: string; at: number }>;
    };
    expect(document.querySelector('.cc-arcade-stage-title')?.textContent).toBe('Congrats');
    expect(__gsapRuntimeTrace.some((entry) =>
      entry.event === 'timeline-complete')).toBe(true);
    expect(__gsapRuntimeTrace.filter((entry) =>
      entry.target.includes('cc-arcade-stage-title-letter'))).toHaveLength(3);
    expect(resultSettled).toBe(false);
    expect(onRoundPresented).not.toHaveBeenCalled();

    const result = await flushUntilSettled(resultPromise);

    expect(result).toEqual({ action: 'continue' });
    expect(onRoundPresented).toHaveBeenCalledTimes(1);
    expect(digitSoundMocks.playArcadeRoundDigitSound).toHaveBeenCalledTimes(2);
    expect(digitSoundMocks.playArcadeRoundDigitSound).toHaveBeenNthCalledWith(1, 0);
    expect(digitSoundMocks.playArcadeRoundDigitSound).toHaveBeenNthCalledWith(2, 1);
    expect(digitSoundMocks.playArcadeRoundExitSound).toHaveBeenCalledTimes(1);
    expect(stageClearSoundMocks.fadeOutArcadeStageClearCelebrationSounds).toHaveBeenCalledTimes(1);
    expect(soundtrackMocks.enterArcadeGameplaySoundtrack).toHaveBeenCalledTimes(1);
    expect(document.getElementById('cc-arcade-stage-clear-overlay')).toBeNull();
  });
});
