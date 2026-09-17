import fs from 'node:fs';
import ts from 'typescript';
import { beginGameplayEntryPreparation, cancelGameplayEntryPreparation, captureGameplayEntryValidity, commitPreparedGameplayEntry, hasPreparedGameplayEntry, prepareGameplayEntryCommit } from '../gameplay-entry-coordinator';
import { isSavedBoardLoadSuperseded } from '../saved-board-load-owner';

const source = ts.createSourceFile('main.ts', fs.readFileSync('src/main.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let handlerSource = '';
function visit(node: ts.Node) {
  if (ts.isBinaryExpression(node) && node.left.getText(source) === '(window as any).continueGameWithSavedState') handlerSource = node.right.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
const compiled = ts.transpileModule(`const handler = ${handlerSource};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

afterEach(() => { cancelGameplayEntryPreparation(); localStorage.clear(); });

function fixture(journey: boolean, missingFunction = false) {
  const paints: string[] = [];
  const canvas = { style: { opacity: '0', transition: 'none' } };
  const win: any = { __ccCameFromJourney: journey, CC: { app: { canvas } }, setTimeout: () => 0 };
  const progress = { getCurrentRunState: () => ({ boardId: 8, inProgress: true }), setCurrentRunState: jest.fn() };
  const barriers: { load?: Promise<void>; entry?: Promise<void>; layout?: Promise<void> } = {};
  let generation = 0;
  const prepare = (label: string) => prepareGameplayEntryCommit(generation, () => { paints.push(label); canvas.style.opacity = '1'; });
  const boot = jest.fn(async () => { generation = beginGameplayEntryPreparation('resume-skip-rebuild'); });
  const startLevel = jest.fn(async () => {
    generation = beginGameplayEntryPreparation('failed-save-fresh-entry');
    const owns = captureGameplayEntryValidity();
    await barriers.entry;
    if (!owns()) return;
    prepare('fresh');
    await commitPreparedGameplayEntry();
  });
  win.startLevel = startLevel;
  win.rebuildBoard = jest.fn(() => prepare('raw-rebuild'));
  if (!missingFunction) win.loadGameState = jest.fn(async () => {
    await barriers.load;
    localStorage.removeItem('board-8');
    return false;
  });
  localStorage.setItem('board-8', JSON.stringify({ boardNumber: 8, tiles: [{}] }));
  const scope: any = {
    window: win, document, localStorage, console: { log() {}, warn() {} },
    memoryManager: { start() {} }, logger: { info() {}, warn() {}, error: jest.fn() },
    beginFirstPlayTutorialRun: async () => false,
    appZoneManager: { prepareJourneyRunOrigin() {} },
    require: () => ({ journeyProgressionState: progress }),
    getBoardSaveKey: () => 'board-8', hasResumableSavedStateForBoard: () => true,
    captureSavedBoardLoadCaller: captureGameplayEntryValidity, isSavedBoardLoadSuperseded,
    commitPreparedGameplayEntry, bootGame: boot,
    layoutGame: jest.fn(async () => { await barriers.layout; }),
    uiManager: { hideHomepage() {}, showApp() { canvas.style.opacity = '1'; void commitPreparedGameplayEntry(); } },
    animateSliderExit: async () => {}, requestAnimationFrame: (fn: () => void) => { fn(); return 0; },
    recoverJourneyStartFailure: jest.fn(),
  };
  const proxy = new Proxy(scope, { has: () => true, get: (obj, key) => {
    if (key === Symbol.unscopables) return undefined;
    if (key in obj) return obj[key];
    if (key in globalThis) return (globalThis as any)[key];
    return obj[key] = jest.fn();
  } });
  const handler = new Function('scope', `with(scope){${compiled}; return handler;}`)(proxy);
  return { handler, win, paints, canvas, startLevel, barriers, scope, prepare };
}

test('the old raw-rebuild order leaves a prepared entry with no paint after showApp already ran', async () => {
  const generation = beginGameplayEntryPreparation('boot-with-skip');
  await commitPreparedGameplayEntry();
  const paint = jest.fn();
  void prepareGameplayEntryCommit(generation, paint);
  await flush();
  expect(hasPreparedGameplayEntry()).toBe(true);
  expect(paint).not.toHaveBeenCalled();
});

test.each([true, false])('actual continuation recovers a vanished save through a complete fresh entry (Journey=%s)', async (journey) => {
  const h = fixture(journey);
  await h.handler(); await flush();
  expect(h.startLevel).toHaveBeenCalledWith(8);
  expect(h.win.rebuildBoard).not.toHaveBeenCalled();
  expect(h.paints).toEqual(['fresh']);
  expect(h.canvas.style.opacity).toBe('1');
  expect(hasPreparedGameplayEntry()).toBe(false);
  expect(h.scope.recoverJourneyStartFailure).not.toHaveBeenCalled();
});

test.each([true, false])('missing load function follows the same full entry recovery (Journey=%s)', async (journey) => {
  const h = fixture(journey, true);
  await h.handler(); await flush();
  expect(h.paints).toEqual(['fresh']);
  expect(h.startLevel).toHaveBeenCalledTimes(1);
});

test.each(['load', 'entry', 'layout'] as const)('a continuation superseded during %s cannot start or commit a replacement entry', async (boundary) => {
  const h = fixture(true);
  const wait = deferred(); h.barriers[boundary] = wait.promise;
  const pending = h.handler(); await flush();
  const next = beginGameplayEntryPreparation('unrelated-entry');
  h.win.__ccSkipRebuildBoard = true;
  const replacementPaint = jest.fn(); void prepareGameplayEntryCommit(next, replacementPaint);
  wait.resolve(); await pending; await flush();
  expect(replacementPaint).not.toHaveBeenCalled();
  expect(h.win.__ccSkipRebuildBoard).toBe(true);
  expect(hasPreparedGameplayEntry()).toBe(true);
  if (boundary === 'load') expect(h.startLevel).not.toHaveBeenCalled();
  await commitPreparedGameplayEntry();
  expect(replacementPaint).toHaveBeenCalledTimes(1);
});


test.each([true, false])('valid saved state retains its existing load entry without rebuilding (Journey=%s)', async (journey) => {
  const h = fixture(journey);
  h.win.loadGameState = jest.fn(async () => {
    h.prepare('saved');
    void commitPreparedGameplayEntry();
    return true;
  });
  await h.handler(); await flush();
  expect(h.startLevel).not.toHaveBeenCalled();
  expect(h.paints).toEqual(['saved']);
  expect(h.canvas.style.opacity).toBe('1');
  expect(h.win.__ccSkipRebuildBoard).toBeUndefined();
});
