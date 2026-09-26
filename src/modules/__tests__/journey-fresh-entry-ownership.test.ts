import fs from 'node:fs';
import ts from 'typescript';
import {
  beginGameplayEntryPreparation,
  cancelGameplayEntryPreparation,
  captureGameplayEntryValidity,
  commitPreparedGameplayEntry,
  hasPreparedGameplayEntry,
  prepareGameplayEntryCommit,
} from '../gameplay-entry-coordinator';

const source = ts.createSourceFile('main.ts', fs.readFileSync('src/main.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let handlerSource = '';
let surfaceSource = '';
function visit(node: ts.Node): void {
  if (ts.isBinaryExpression(node) && node.left.getText(source) === '(window as any).startNewRunFromJourney') {
    handlerSource = node.right.getText(source);
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'assertJourneyGameSurfaceVisible') {
    surfaceSource = node.getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);

function compile<T>(code: string, returned: string, scope: Record<string, unknown>): T {
  const compiled = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(scope), `${compiled}; return ${returned};`)(...Object.values(scope)) as T;
}

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function surfaceFixture() {
  document.body.innerHTML = '<div id="app"><canvas></canvas><div id="authored-pose" style="opacity:0;transform:scale(0)"></div></div>';
  const app = document.getElementById('app')!;
  const canvas = app.querySelector('canvas')!;
  const check = compile<(reason: string) => void>(surfaceSource, 'assertJourneyGameSurfaceVisible', {
    window, document, logger: { info() {} }, getJourneyGameStartSnapshot: () => ({}),
  });
  return { app, canvas, check };
}

function fixture() {
  const surface = surfaceFixture();
  const events: string[] = [];
  const entry = deferred();
  const layout = deferred();
  const win: Record<string, unknown> = {
    CC: { resetTransientRunGuards() {} }, __ccPlayAgainRestartInProgress: true,
  };
  const paint = jest.fn(async () => { events.push('commit-start'); await entry.promise; events.push('commit-end'); });
  const layoutGame = jest.fn(async () => { events.push('layout'); await layout.promise; });
  const recoverJourneyStartFailure = jest.fn();
  const activateFirstPlayTutorialWhenReady = jest.fn();
  const recordJourneyPlayAgainIncident = jest.fn();
  const surfaceCheck = jest.fn(surface.check);
  const scope = {
    window: win, localStorage, console: { log() {}, warn() {}, error() {} },
    memoryManager: { start() {} }, logger: { info() {}, error() {} },
    beginFirstPlayTutorialRun: async () => true,
    appZoneManager: { prepareJourneyRunOrigin() {}, async hideHomepageForGame() {} },
    isJourneyInterimOriginActive: () => false,
    require: () => ({
      journeyProgressionState: { setLastOpenedBoardId() {}, setCurrentRunState() {} },
      cleanupLevelFlowTimeouts() {},
    }),
    getBoardSaveKey: (boardId: number) => `board-${boardId}`,
    isJourneyBoardSaveCompleted: () => false, clearJourneyBoardSaveCompleted() {},
    bootGame: async () => {
      const generation = beginGameplayEntryPreparation('journey-fresh-board-25');
      void prepareGameplayEntryCommit(generation, paint);
      events.push('boot-prepared');
    },
    uiManager: { showApp() { events.push('show'); void commitPreparedGameplayEntry(); } },
    captureGameplayEntryValidity, commitPreparedGameplayEntry, layoutGame,
    assertJourneyGameSurfaceVisible: surfaceCheck,
    activateFirstPlayTutorialWhenReady, recoverJourneyStartFailure, recordJourneyPlayAgainIncident,
  };
  const handler = compile<(boardId: number) => Promise<void>>(`const handler = ${handlerSource};`, 'handler', scope);
  return { handler, entry, layout, paint, events, win, scope, ...surface };
}

afterEach(() => {
  cancelGameplayEntryPreparation();
  localStorage.clear();
  document.body.innerHTML = '';
});

test('actual fresh Journey caller waits for the shared showApp commit before layout, tutorial and flag cleanup', async () => {
  const h = fixture();
  h.canvas.style.opacity = '0';
  const pending = h.handler(25);
  await flush();
  expect(h.events).toEqual(['boot-prepared', 'show', 'commit-start']);
  expect(h.paint).toHaveBeenCalledTimes(1);
  expect(h.scope.layoutGame).not.toHaveBeenCalled();
  expect(h.win.__ccStartAtLevel).toBe(25);
  expect(h.win.__ccTriggerHudDrop).toBe(true);
  expect(h.scope.activateFirstPlayTutorialWhenReady).not.toHaveBeenCalled();

  h.entry.resolve(); await flush();
  expect(h.events).toEqual(['boot-prepared', 'show', 'commit-start', 'commit-end', 'layout']);
  expect(h.win.__ccTriggerHudDrop).toBe(true);
  h.layout.resolve(); await pending;
  expect(h.canvas.style.opacity).toBe('1');
  expect(h.scope.activateFirstPlayTutorialWhenReady).toHaveBeenCalledTimes(1);
  expect(h.win.__ccStartAtLevel).toBeUndefined();
  expect(h.win.__ccTriggerHudDrop).toBeUndefined();
  expect(h.scope.recordJourneyPlayAgainIncident).toHaveBeenCalledWith('journey-run-boot-settled', { boardId: 25 });
  expect(h.scope.recoverJourneyStartFailure).not.toHaveBeenCalled();
});

test.each(['cancel', 'replace'] as const)('a fresh entry retired during commit (%s) cannot reveal or modify the successor', async (retirement) => {
  const h = fixture();
  const pending = h.handler(25); await flush();
  const replacementPaint = jest.fn();
  if (retirement === 'cancel') cancelGameplayEntryPreparation();
  else {
    const next = beginGameplayEntryPreparation('successor');
    void prepareGameplayEntryCommit(next, replacementPaint);
  }
  h.win.__ccStartAtLevel = 26;
  h.win.__ccTriggerHudDrop = true;
  h.app.hidden = true;
  h.canvas.style.opacity = '0';
  await pending;
  h.entry.resolve(); await flush();
  expect(h.scope.layoutGame).not.toHaveBeenCalled();
  expect(h.scope.assertJourneyGameSurfaceVisible).not.toHaveBeenCalled();
  expect(h.scope.activateFirstPlayTutorialWhenReady).not.toHaveBeenCalled();
  expect(h.scope.recoverJourneyStartFailure).not.toHaveBeenCalled();
  expect(h.win.__ccStartAtLevel).toBe(26);
  expect(h.win.__ccTriggerHudDrop).toBe(true);
  expect(h.app.hidden).toBe(true);
  expect(h.canvas.style.opacity).toBe('0');
  expect(replacementPaint).not.toHaveBeenCalled();
  expect(hasPreparedGameplayEntry()).toBe(retirement === 'replace');
});

test.each(['resolve', 'reject'] as const)('a stale layout %s cannot repair a new surface, clear its flags or recover over it', async (outcome) => {
  const h = fixture();
  h.entry.resolve();
  const pending = h.handler(25); await flush();
  expect(h.scope.layoutGame).toHaveBeenCalledTimes(1);
  const next = beginGameplayEntryPreparation('successor');
  const replacementPaint = jest.fn();
  void prepareGameplayEntryCommit(next, replacementPaint);
  h.win.__ccStartAtLevel = 26;
  h.win.__ccTriggerHudDrop = true;
  h.app.hidden = true;
  if (outcome === 'resolve') h.layout.resolve();
  else h.layout.reject(new Error('retired layout failed'));
  await pending;
  expect(h.scope.assertJourneyGameSurfaceVisible).not.toHaveBeenCalled();
  expect(h.scope.recoverJourneyStartFailure).not.toHaveBeenCalled();
  expect(h.win.__ccStartAtLevel).toBe(26);
  expect(h.win.__ccTriggerHudDrop).toBe(true);
  expect(h.app.hidden).toBe(true);
  expect(replacementPaint).not.toHaveBeenCalled();
  expect(hasPreparedGameplayEntry()).toBe(true);
});

test('an owned layout failure retains the existing Journey recovery path', async () => {
  const h = fixture();
  h.entry.resolve();
  const pending = h.handler(25); await flush();
  const failure = new Error('current layout failed');
  h.layout.reject(failure); await pending;
  expect(h.scope.recoverJourneyStartFailure).toHaveBeenCalledWith('startNewRunFromJourney:25', failure);
  expect(h.win.__ccStartAtLevel).toBeUndefined();
  expect(h.win.__ccTriggerHudDrop).toBeUndefined();
});

test.each(['app', 'canvas'] as const)('the actual surface check repairs zero computed opacity on %s without touching authored child poses', (target) => {
  const h = surfaceFixture();
  const style = document.createElement('style');
  style.textContent = target === 'app' ? '#app { opacity: 0; }' : '#app canvas { opacity: 0; }';
  document.body.append(style);
  h.check('journey-test');
  expect(window.getComputedStyle(h[target]).opacity).toBe('1');
  expect(document.getElementById('authored-pose')?.style.opacity).toBe('0');
  expect(document.getElementById('authored-pose')?.style.transform).toBe('scale(0)');
});

test.each(['app', 'canvas'] as const)('the actual surface check removes a stale hidden attribute on %s', (target) => {
  const h = surfaceFixture();
  h[target].hidden = true;
  h.check('journey-test');
  expect(h[target].hidden).toBe(false);
  expect(h[target].style.opacity).toBe('1');
  expect(h[target].style.visibility).toBe('visible');
});

test('the surface check leaves visible partial opacity and authored transforms alone', () => {
  const h = surfaceFixture();
  h.app.style.opacity = '0.8';
  h.canvas.style.opacity = '0.6';
  h.canvas.style.transform = 'translateY(4px)';
  h.check('journey-test');
  expect(h.app.style.opacity).toBe('0.8');
  expect(h.canvas.style.opacity).toBe('0.6');
  expect(h.canvas.style.transform).toBe('translateY(4px)');
});
