import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('board.ts', fs.readFileSync('src/modules/app-board.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'sweetPopOut')!;
const code = ts.transpileModule(node.getText(source).replace('export function', 'function'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture() {
  const callbacks: Array<{ onComplete: () => void }> = [];
  const tweens: Array<{ target: any; vars: any; position: number }> = [];
  const delayed: Array<{ delay: number; run: () => void; kill: jest.Mock }> = [];
  let trackedTimelineCount = 0;
  const stop = jest.fn();
  const play = jest.fn((_duration: number, _phase?: 'enter' | 'exit') => stop);
  const makeChildTimeline = (options: any = {}) => {
    const localTweens: Array<{ target: any; vars: any; position: number }> = [];
    const child = {
      to: (target: any, vars: any, position: number) => {
        localTweens.push({ target, vars, position });
        if (child._masterOffset !== null) {
          tweens.push({ target, vars, position: child._masterOffset + position });
        }
        return child;
      },
      kill: jest.fn(),
      _options: options,
      _tweens: localTweens,
      _masterOffset: null as number | null,
    };
    return child;
  };
  const trackTimeline = (_options: any) => {
    trackedTimelineCount++;
    const timeline = {
      add: (child: ReturnType<typeof makeChildTimeline>, offset: number) => {
        child._masterOffset = offset;
        child._tweens.forEach(({ target, vars, position }) => {
          tweens.push({ target, vars, position: offset + position });
        });
        callbacks.push({ onComplete: child._options.onComplete });
        return timeline;
      },
      play: jest.fn(() => timeline),
      kill: jest.fn(),
    };
    return timeline;
  };
  const trackDelayedCall = (delay: number, run: () => void) => {
    const call = { delay, run, kill: jest.fn() };
    delayed.push(call);
    return call;
  };
  const fakeGsap = { timeline: makeChildTimeline };
  const run = new Function('gsap', 'trackTimeline', 'trackDelayedCall', 'playBoardPopInSound', `${code}; return sweetPopOut;`)(fakeGsap, trackTimeline, trackDelayedCall, play);
  return { run, callbacks, tweens, delayed, play, stop, get trackedTimelineCount() { return trackedTimelineCount; } };
}
const tile = () => ({ scale: { x: 1, y: 1 }, alpha: 1, value: 2, parent: {} });
describe('board exit audio contact and retirement', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  test('starts once at 40 percent of the computed exit and stops after the last tile', async () => {
    const f = fixture(); const done = f.run([tile(), tile()]);
    expect(f.play).not.toHaveBeenCalled();
    const soundCall = f.delayed.find(call => call.delay > 0)!;
    expect(soundCall.delay).toBeGreaterThan(0);
    soundCall.run();
    expect(f.play).toHaveBeenCalledTimes(1);
    expect(f.play.mock.calls[0][0]).toBeCloseTo(soundCall.delay * 1.5, 6);
    expect(f.play.mock.calls[0][1]).toBe('exit');
    f.callbacks[0].onComplete(); expect(f.stop).not.toHaveBeenCalled();
    f.callbacks[1].onComplete(); await done;
    expect(f.stop).toHaveBeenCalledTimes(1);
  });
  test('watchdog retires the sound and late starts cannot revive it', async () => {
    const f = fixture(); const done = f.run([tile()]); const soundCall = f.delayed[0]; soundCall.run();
    jest.advanceTimersByTime(5000); await done;
    soundCall.run(); expect(f.play).toHaveBeenCalledTimes(1);
    expect(f.stop).toHaveBeenCalledTimes(1);
  });
  test('completion before the 40-percent cue cancels it without playback', async () => {
    const f = fixture(); const done = f.run([tile()]); const soundCall = f.delayed[0];
    f.callbacks[0].onComplete(); await done;
    expect(soundCall.kill).toHaveBeenCalledTimes(1);
    soundCall.run();
    expect(f.play).not.toHaveBeenCalled();
  });
  test('invalid targets remain silent', async () => {
    const f = fixture(); await f.run([null]); expect(f.play).not.toHaveBeenCalled();
  });
  test('uses one master timeline while preserving each tile phase order', async () => {
    const f = fixture();
    const done = f.run([tile(), tile(), tile()]);
    expect(f.trackedTimelineCount).toBe(1);
    expect(f.tweens).toHaveLength(12);
    for (let index = 0; index < 3; index += 1) {
      const phase = f.tweens.slice(index * 4, index * 4 + 4);
      expect(phase[0].position).toBeGreaterThanOrEqual(0);
      expect(phase[1].position).toBeGreaterThan(phase[0].position);
      expect(phase[2].position).toBe(phase[1].position);
      expect(phase[3].position).toBeGreaterThan(phase[2].position);
      expect(phase.map(({ vars }) => vars.ease)).toEqual([
        'back.in(1.5)', 'power2.in', 'power2.in', 'back.in(2)',
      ]);
    }
    f.callbacks.forEach(callback => callback.onComplete());
    await done;
  });
});
