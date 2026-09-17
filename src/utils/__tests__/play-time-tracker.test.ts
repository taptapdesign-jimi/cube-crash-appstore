import { createPlayTimeTracker } from '../play-time-tracker';

test('repeated starts and overlapping stops consume a foreground interval exactly once', async () => {
  let time = 0;
  const finishes: Array<() => void> = [];
  const save = jest.fn(() => new Promise<void>((resolve) => { finishes.push(resolve); }));
  const clock = createPlayTimeTracker({ now: () => time, saveSeconds: save });
  clock.start(); time = 4000; clock.start(); time = 6500;
  const pending = clock.stop();
  await clock.stop();
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(6);
  time = 100000; clock.start(); time += 500;
  const next = clock.stop();
  expect(save.mock.calls).toEqual([[6], [1]]);
  finishes.forEach((finish) => finish());
  await Promise.all([pending, next]);
});

test('inactive background time is excluded and partial seconds survive visibility cycles', async () => {
  let time = 0;
  const save = jest.fn();
  const clock = createPlayTimeTracker({ now: () => time, saveSeconds: save });
  clock.start(); time = 400; await clock.stop();
  time = 90000; clock.start(); time += 600; await clock.stop();
  expect(save.mock.calls).toEqual([[1]]);
  await clock.stop(); expect(save).toHaveBeenCalledTimes(1);
});

test('an old hidden handler cannot stop a newly resumed foreground interval after its import resolves', async () => {
  const fs = await import('node:fs');
  const ts = await import('typescript');
  const source = fs.readFileSync('src/main.ts', 'utf8');
  const handlerSource = source.slice(source.indexOf('const iosHardCloseHandler = async () => {'),
    source.indexOf('// 🍎 Store handler reference for cleanup'))
    .replace("import('./modules/app-state.js')", 'loadState()');
  const js = ts.transpileModule(handlerSource, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  let time = 0;
  const save = jest.fn();
  const tracker = createPlayTimeTracker({ now: () => time, saveSeconds: save });
  const documentState = { hidden: true };
  let resolveState!: (value: { STATE: { score: number } }) => void;
  const pendingState = new Promise<{ STATE: { score: number } }>((resolve) => { resolveState = resolve; });
  const handler = new Function('window', 'document', 'gameState', 'loadState', 'console',
    `${js}; return iosHardCloseHandler;`)(
    { startTimeTracking: tracker.start, stopTimeTracking: tracker.stop },
    documentState, { get: () => true }, () => pendingState, { log: jest.fn(), error: jest.fn() },
  );
  tracker.start(); time = 2000;
  const background = handler();
  expect(save.mock.calls).toEqual([[2]]);
  documentState.hidden = false; time = 100000; await handler();
  resolveState({ STATE: { score: 0 } }); await background;
  time = 103000; await tracker.stop();
  expect(save.mock.calls).toEqual([[2], [3]]);
});
