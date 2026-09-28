import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('board.ts', fs.readFileSync('src/modules/app-board.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'sweetPopOut')!;
const code = ts.transpileModule(node.getText(source).replace('export function', 'function'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture() {
  const callbacks: Array<{ onStart: () => void; onComplete: () => void }> = [];
  const stop = jest.fn();
  const play = jest.fn((_duration: number) => stop);
  const trackTimeline = (options: any) => {
    callbacks.push(options);
    const timeline = { to: () => timeline, kill: jest.fn() };
    return timeline;
  };
  const run = new Function('trackTimeline', 'trackDelayedCall', 'playBoardPopInSound', `${code}; return sweetPopOut;`)(trackTimeline, jest.fn(), play);
  return { run, callbacks, play, stop };
}
const tile = () => ({ scale: { x: 1, y: 1 }, alpha: 1, value: 2, parent: {} });
describe('board exit audio contact and retirement', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  test('starts once on first moving tile and stops after the last tile', async () => {
    const f = fixture(); const done = f.run([tile(), tile()]);
    expect(f.play).not.toHaveBeenCalled();
    f.callbacks[0].onStart(); f.callbacks[1].onStart();
    expect(f.play).toHaveBeenCalledTimes(1);
    expect(f.play.mock.calls[0][0]).toBeGreaterThan(0);
    f.callbacks[0].onComplete(); expect(f.stop).not.toHaveBeenCalled();
    f.callbacks[1].onComplete(); await done;
    expect(f.stop).toHaveBeenCalledTimes(1);
  });
  test('watchdog retires the sound and late starts cannot revive it', async () => {
    const f = fixture(); const done = f.run([tile()]); f.callbacks[0].onStart();
    jest.advanceTimersByTime(5000); await done;
    f.callbacks[0].onStart(); expect(f.play).toHaveBeenCalledTimes(1);
    expect(f.stop).toHaveBeenCalledTimes(1);
  });
  test('invalid targets remain silent', async () => {
    const f = fixture(); await f.run([null]); expect(f.play).not.toHaveBeenCalled();
  });
});
