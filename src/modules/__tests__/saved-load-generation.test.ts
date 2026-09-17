import fs from 'node:fs';
import ts from 'typescript';
import { ensureAppReadyForLoad } from '../app-core-load-boot';
import { ensureDragReadyAndRebind } from '../app-core-load-drag';
import { layoutAndRestoreStars } from '../app-core-load-layout';
import { schedulePostLoadRecoveryCheck } from '../app-core-load-recovery';
import { checkAndRecoverBoard, setPendingCleanBoard } from '../board-recovery';
import { captureSavedBoardLoadCaller, isSavedBoardLoadSuperseded } from '../saved-board-load-owner';
import { beginGameplayEntryPreparation, cancelGameplayEntryPreparation } from '../gameplay-entry-coordinator';
import { setRunMode } from '../run-mode';
import { createGameSaveWriter } from '../app-core-save-state';

const source = ts.createSourceFile('app-core.ts', fs.readFileSync('src/modules/app-core.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const loadNode = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'loadGameState')!;
const compiledLoad = ts.transpileModule(loadNode.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function fixture() {
  const scope: any = {
    savedBoardLoadRequest: 0, boardNumber: 1, gameplayRunGeneration: 1, activeGameplayEntryGeneration: 1,
    mode: 'journey', window: {}, app: {}, board: {}, backgroundLayer: {}, tiles: [{}], grid: [[]], STATE: {},
    document, localStorage, Number, gameSaveWriter: createGameSaveWriter(),
    isArcadeHomeRunMode: () => scope.mode === 'arcade_home',
    isGameplayEntryGenerationLatest: () => true,
    loadSavedBoardState: () => ({ gameState: { boardNumber: 1 } }),
    ensureAppReadyForLoad: jest.fn(async () => {}),
    restoreTilesFromSave: jest.fn(() => ({ deferredWildIdleTiles: [] })),
    restoreBasicState: jest.fn(() => ({ boardNumber: 1, savedStarsCount: 0 })),
    ensureDragReadyAndRebind: jest.fn(async () => true),
    layoutAndRestoreStars: jest.fn(async () => {}),
    handleEmptyLoadState: () => ({ handled: false }), tileIsActive: () => true,
    prepareGameplayEntryCommit: jest.fn(() => Promise.resolve()),
    logger: { warn: jest.fn(), error: jest.fn() },
  };
  const proxy = new Proxy(scope, {
    has: () => true,
    get(target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (key in target) return target[key];
      if (key in globalThis) return (globalThis as any)[key];
      return target[key] = jest.fn();
    },
  });
  const load = new Function('scope', `with (scope) { ${compiledLoad}; return loadGameState; }`)(proxy);
  return { scope, load };
}

describe('saved board load generation boundaries', () => {
  afterEach(() => { localStorage.clear(); jest.useRealTimers(); });

  test.each(['ensureAppReadyForLoad', 'ensureDragReadyAndRebind', 'layoutAndRestoreStars'])('retires a load superseded during %s', async (boundary) => {
    const { scope, load } = fixture();
    const barrier = deferred();
    scope[boundary] = jest.fn(() => barrier.promise.then(() => true));
    const pending = load(1);
    await flush();
    scope.gameplayRunGeneration++;
    scope.activeGameplayEntryGeneration++;
    scope.mode = 'arcade_home';
    scope.boardNumber = 7;
    barrier.resolve();
    expect(await pending).toBe('superseded');
    expect(scope.prepareGameplayEntryCommit).not.toHaveBeenCalled();
    if (boundary === 'ensureAppReadyForLoad') expect(scope.restoreTilesFromSave).not.toHaveBeenCalled();
  });

  test('a second same-board load supersedes the first without changing the gameplay generation', async () => {
    const { scope, load } = fixture();
    const barrier = deferred();
    scope.ensureAppReadyForLoad.mockImplementationOnce(() => barrier.promise);
    const first = load(1);
    expect(await load(1)).toBe(true);
    barrier.resolve();
    expect(await first).toBe('superseded');
    expect(scope.restoreTilesFromSave).toHaveBeenCalledTimes(1);
  });

  test('current warm load still prepares exactly one entry', async () => {
    const { scope, load } = fixture();
    expect(await load(1)).toBe(true);
    expect(scope.restoreTilesFromSave).toHaveBeenCalledTimes(1);
    expect(scope.prepareGameplayEntryCommit).toHaveBeenCalledTimes(1);
  });

  test('successful entry executes its prepared commit and only its current completion schedules recovery', async () => {
    const { scope, load } = fixture();
    expect(await load(1)).toBe(true);
    expect(scope.resetTransientEndgameRuntimeState).toHaveBeenCalledTimes(1);
    const commit = scope.prepareGameplayEntryCommit.mock.calls[0][1];
    await commit({ aborted: false });
    expect(scope.revealPreparedGameplaySurface).toHaveBeenCalledTimes(1);
    const popIn = scope.playLoadPopInAnimation.mock.calls[0][0];
    popIn.onComplete();
    expect(scope.schedulePostLoadRecoveryCheck).toHaveBeenCalledTimes(1);
    scope.gameplayRunGeneration++;
    popIn.onComplete();
    expect(scope.schedulePostLoadRecoveryCheck).toHaveBeenCalledTimes(1);
  });

  test('load-owned delayed binding and HUD frame callbacks retire after run replacement', async () => {
    const { scope, load } = fixture();
    const timers: Function[] = []; const frames: Function[] = [];
    scope.trackAppTimeout = (callback: Function) => timers.push(callback);
    scope.trackAppAnimationFrame = (callback: Function) => frames.push(callback);
    const bind = jest.fn(); const hud = jest.fn();
    scope.restoreTilesFromSave.mockImplementation((args: any) => {
      args.trackAppTimeout(bind, 100); return { deferredWildIdleTiles: [] };
    });
    scope.ensureHudAfterLoad = (args: any) => args.trackAppAnimationFrame(hud);
    expect(await load(1)).toBe(true);
    scope.gameplayRunGeneration++;
    timers.forEach((callback) => callback()); frames.forEach((callback) => callback(0));
    expect(bind).not.toHaveBeenCalled(); expect(hud).not.toHaveBeenCalled();
  });

  test.each(['superseded', 'entry', 'mode'])('saved-load callers never rebuild or reveal a retired %s result', async (retired) => {
    setRunMode('journey'); beginGameplayEntryPreparation('saved-caller');
    const current = captureSavedBoardLoadCaller(); const barrier = deferred();
    const rebuild = jest.fn(); const show = jest.fn();
    const continuation = (async () => {
      await barrier.promise;
      const result = retired === 'superseded' ? 'superseded' as const : false;
      if (isSavedBoardLoadSuperseded(result, current)) return;
      if (!result) rebuild(); show();
    })();
    if (retired === 'entry') beginGameplayEntryPreparation('replacement');
    if (retired === 'mode') setRunMode('arcade_home');
    barrier.resolve(); await continuation;
    expect(rebuild).not.toHaveBeenCalled(); expect(show).not.toHaveBeenCalled();
    cancelGameplayEntryPreparation();
  });

  test.each([0, 1, 2])('cold boot permits exactly one owned generation advance (received %i)', async (advances) => {
    const { scope, load } = fixture();
    scope.ensureAppReadyForLoad = async (args: any) => { await args.boot(); };
    scope.boot = async (owner: any) => { scope.gameplayRunGeneration += advances; scope.activeGameplayEntryGeneration += advances; owner.adoptEntry(); };
    expect(await load(1)).toBe(advances === 1 ? true : 'superseded');
    expect(scope.restoreTilesFromSave).toHaveBeenCalledTimes(advances === 1 ? 1 : 0);
  });

  test.each([undefined, 7])('actual cold-boot entry branch restores board 7 with forced flag %s', async (forced) => {
    const { scope, load } = fixture();
    scope.window.__ccStartAtLevel = forced;
    scope.loadSavedBoardState = () => ({ gameState: { boardNumber: 7 } });
    scope.restoreBasicState.mockImplementation(() => { scope.boardNumber = 7; return { boardNumber: 7, savedStarsCount: 0 }; });
    scope.startLevel = jest.fn(async (n: number) => {
      scope.gameplayRunGeneration++; scope.activeGameplayEntryGeneration++; scope.boardNumber = n;
    });
    const bootNode = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'boot') as ts.FunctionDeclaration;
    const statements = bootNode.body!.statements;
    const start = statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText(source) === 'startBootLevel')!;
    const forcedIndex = statements.findIndex((node) => ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText(source) === 'forcedStartLevel');
    const body = `const isCurrentBoot = () => loadOwner.isCurrent(); ${start.getText(source)} ${statements[forcedIndex].getText(source)} ${statements[forcedIndex + 1].getText(source)}`;
    const proxy = new Proxy(scope, { has: () => true, get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : (globalThis as any)[key] ?? (() => {}) });
    scope.boot = new Function('scope', `with(scope) { return async function(loadOwner) { ${ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText} }; }`)(proxy);
    scope.ensureAppReadyForLoad = async (args: any) => { await args.boot(); };
    expect(await load(7)).toBe(true);
    expect(scope.startLevel).toHaveBeenCalledWith(7);
    expect(scope.restoreTilesFromSave).toHaveBeenCalledTimes(1);
  });

  test('superseded Arcade fallback cannot erase replacement carryover flags', async () => {
    const { scope } = fixture(); const barrier = deferred();
    const recoveryNode = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'recoverFreshArcadeEntryAfterFailedLoad')!;
    const recoveryBody = ts.transpileModule(recoveryNode.getText(source).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    scope.mode = 'arcade_home';
    scope.startLevel = () => { scope.activeGameplayEntryGeneration++; return barrier.promise; };
    const proxy = new Proxy(scope, { has: () => true, get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : (() => {}) });
    const recover = new Function('scope', `with(scope) { ${recoveryBody}; return recoverFreshArcadeEntryAfterFailedLoad; }`)(proxy);
    const pending = recover(3, 42);
    scope.activeGameplayEntryGeneration++;
    scope.window.__ccPreserveScore = 999;
    scope.window.__ccArcadeStageWildMeterCarryover = 0.5;
    barrier.resolve(); await pending;
    expect(scope.window.__ccPreserveScore).toBe(999);
    expect(scope.window.__ccArcadeStageWildMeterCarryover).toBe(0.5);
  });

  test('a stale layout cannot initialize a new background or restore its old stars', async () => {
    let current = true;
    const barrier = deferred();
    const initializeBackgroundLayer = jest.fn();
    const setStarsCount = jest.fn();
    const deps = { app: {}, board: { children: [] }, backgroundLayer: null, setBackgroundLayer: jest.fn(), layoutBoard: () => barrier.promise,
      initializeBackgroundLayer, boot: jest.fn(), isCurrent: () => current, devLog: jest.fn() };
    const ready = ensureAppReadyForLoad(deps);
    const layout = layoutAndRestoreStars({ ...deps, StarsCollector: { setStarsCount }, HUD: { setStarsCount }, savedStarsCount: 9, devWarn: jest.fn() });
    current = false; barrier.resolve(); await Promise.all([ready, layout]);
    expect(initializeBackgroundLayer).not.toHaveBeenCalled();
    expect(setStarsCount).not.toHaveBeenCalled();
  });

  test.each([
    ['layoutBoard', false], ['layoutBoard', true], ['fonts', false], ['fonts', true],
    ['layoutBoard-before-hud', false], ['layoutBoard-before-hud', true],
  ])('actual layout boundary %s ignores superseded success/rejection=%s', async (boundary, rejection) => {
    const { scope } = fixture(); const barrier = deferred();
    scope.stage = { visible: true }; scope.board = { visible: true }; scope.hud = { visible: true };
    scope.loadOwnerOrEvent = new Event('resize');
    scope.ensureCoreGameTexturesLoaded = scope.ensureFonts = async () => {
      await barrier.promise; if (rejection) throw new Error('retired layout'); return [];
    };
    const layout = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'layoutBoard') as ts.FunctionDeclaration;
    const vars = ['loadIsCurrent', 'layoutStageOwner', 'layoutBoardOwner', 'layoutHudOwner', 'layoutRunGeneration', 'layoutEntryGeneration', 'layoutMode', 'isCurrentLayout'];
    const prefix = layout.body!.statements.filter((node) => ts.isVariableStatement(node) && vars.includes(node.declarationList.declarations[0].name.getText(source))).map((node) => node.getText(source)).join('\n');
    const matches: ts.TryStatement[] = [];
    const needle = boundary === 'fonts' ? 'await ensureFonts()' : `await ensureCoreGameTexturesLoaded('${boundary}')`;
    const visit = (node: ts.Node) => { if (ts.isTryStatement(node) && node.getText(source).includes(needle)) matches.push(node); ts.forEachChild(node, visit); };
    visit(layout);
    const smallest = matches.sort((a, b) => a.getWidth(source) - b.getWidth(source))[0];
    const afterBoundary = jest.fn(); scope.afterBoundary = afterBoundary;
    const body = `${prefix} ${smallest.getText(source)} afterBoundary();`;
    const proxy = new Proxy(scope, { has: () => true, get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : (globalThis as any)[key] ?? (() => {}) });
    const run = new Function('scope', `with(scope) { return async function() { ${ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText} }; }`)(proxy);
    const pending = run(); scope.gameplayRunGeneration++; barrier.resolve(); await pending;
    expect(afterBoundary).not.toHaveBeenCalled();
    expect(scope.stage.visible).toBe(true); expect(scope.board.visible).toBe(true); expect(scope.hud.visible).toBe(true);
  });

  test('a stale drag wait never binds the replacement drag owner to old tiles', async () => {
    let current = true; const barrier = deferred(); const state: any = {};
    const bindToTile = jest.fn();
    const pending = ensureDragReadyAndRebind({ STATE: state, tiles: [{ eventMode: 'static' }],
      waitTrackedResult: async () => { await barrier.promise; return 'elapsed'; }, isCurrent: () => current,
      devLog: jest.fn(), devWarn: jest.fn(), devError: jest.fn() });
    current = false; state.drag = { bindToTile }; barrier.resolve();
    expect(await pending).toBe(false); expect(bindToTile).not.toHaveBeenCalled();
  });

  test.each([false, true])('recovery retires its delayed clean callback after replacement, pending receipt=%s', async (pendingReceipt) => {
    jest.useFakeTimers(); let current = true; const clean = jest.fn(async () => {});
    if (pendingReceipt) setPendingCleanBoard(1);
    const pending = checkAndRecoverBoard([], 1, clean, () => current);
    current = false; jest.advanceTimersByTime(500); await pending;
    expect(clean).not.toHaveBeenCalled();
    if (pendingReceipt) expect(localStorage.getItem('cc_pending_clean_board')).not.toBeNull();
  });

  test('current recovery still completes and superseded post-load rejection cannot run fallback endgame', async () => {
    jest.useFakeTimers(); const clean = jest.fn(async () => {});
    const recovery = checkAndRecoverBoard([], 1, clean, () => true);
    jest.advanceTimersByTime(500); await recovery; expect(clean).toHaveBeenCalledTimes(1);
    let current = true; let reject!: () => void; const checkLevelEnd = jest.fn();
    schedulePostLoadRecoveryCheck({ tiles: [], boardNumber: 1, isCurrent: () => current,
      checkAndRecoverBoard: () => new Promise((_done, fail) => { reject = () => fail(new Error('retired')); }),
      triggerCleanBoardFlow: clean, checkLevelEnd, trackAppTimeout: (fn) => { void fn(); }, devLog: jest.fn(), devWarn: jest.fn() });
    current = false; reject(); await flush(); expect(checkLevelEnd).not.toHaveBeenCalled();
  });
});
