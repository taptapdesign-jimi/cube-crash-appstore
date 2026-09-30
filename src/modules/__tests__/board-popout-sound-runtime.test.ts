import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('board.ts', fs.readFileSync('src/modules/app-board.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'sweetPopOut')!;
const code = ts.transpileModule(node.getText(source).replace('export function', 'function'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture() {
  const callbacks: Array<{ onComplete: () => void }> = [];
  const delayed: Array<{ delay: number; run: () => void; kill: jest.Mock }> = [];
  const stop = jest.fn();
  const play = jest.fn((_duration: number, _phase?: 'enter' | 'exit') => stop);
  const trackTimeline = (options: any) => {
    callbacks.push(options);
    const timeline = { to: () => timeline, kill: jest.fn() };
    return timeline;
  };
  const trackDelayedCall = (delay: number, run: () => void) => {
    const call = { delay, run, kill: jest.fn() };
    delayed.push(call);
    return call;
  };
  const run = new Function('trackTimeline', 'trackDelayedCall', 'playBoardPopInSound', `${code}; return sweetPopOut;`)(trackTimeline, trackDelayedCall, play);
  return { run, callbacks, delayed, play, stop };
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
});
