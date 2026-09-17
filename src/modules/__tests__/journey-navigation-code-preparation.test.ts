/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';
import { JOURNEY_LAYOUT_STATE_VERSION, JOURNEY_MAX_BOARDS } from '../journey-world-definitions';
import { reconcileJourneyWorldInterims } from '../journey-world-stage';

const source = fs.readFileSync('src/modules/journey-navigation-code-preparation.ts', 'utf8');
const code = ts.transpileModule(source.replace(/^import .*;\n/gm, '')
  .replace("import('../collectibles-manager.js')", 'loadCollectibles()')
  .replace("import('./journey-boards-manager.js')", 'loadBoards()'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function deferred() {
  let resolve!: (value?: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const collectors = deferred(), boards = deferred();
  const loadCollectibles = jest.fn(() => collectors.promise);
  const loadBoards = jest.fn(() => boards.promise);
  const module = new Function('loadCollectibles', 'loadBoards', 'exports', 'JOURNEY_LAYOUT_STATE_VERSION', 'JOURNEY_MAX_BOARDS', 'reconcileJourneyWorldInterims', `${code};return exports;`)(loadCollectibles, loadBoards, {}, JOURNEY_LAYOUT_STATE_VERSION, JOURNEY_MAX_BOARDS, reconcileJourneyWorldInterims);
  return { ...module, collectors, boards, loadCollectibles, loadBoards };
}
beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear();
  const boards = Array.from({ length: JOURNEY_MAX_BOARDS }, (_, index) => ({ id: index + 1, unlocked: index < 6, interim: false }));
  reconcileJourneyWorldInterims(boards);
  localStorage.setItem('cc_first_play_tutorial_done', 'true');
  localStorage.setItem('journey_forest_layout_state_version', JOURNEY_LAYOUT_STATE_VERSION);
  localStorage.setItem('journey_boards_state', JSON.stringify(boards));
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test('concurrent startup consumers share both imports without invoking exported render or manager methods', async () => {
  const f = fixture(); const first = f.prepareJourneyNavigationCode();
  expect(f.prepareJourneyNavigationCode()).toBe(first);
  const ensure = jest.fn(), render = jest.fn(), prepare = jest.fn();
  f.collectors.resolve({ ensureCollectiblesManager: ensure, prepareJourneyScreen: prepare });
  f.boards.resolve({ journeyBoardsManager: { renderBoards: render } });
  await expect(first).resolves.toBe(true);
  await expect(f.prepareJourneyNavigationCode()).resolves.toBe(true);
  expect(f.loadCollectibles).toHaveBeenCalledTimes(1);
  expect(f.loadBoards).toHaveBeenCalledTimes(1);
  expect(ensure).not.toHaveBeenCalled(); expect(render).not.toHaveBeenCalled(); expect(prepare).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('failed imports are fail-soft and retry on the next request', async () => {
  const f = fixture(); const first = f.prepareJourneyNavigationCode();
  f.collectors.reject(new Error('chunk')); f.boards.resolve();
  await expect(first).resolves.toBe(false);
  f.loadCollectibles.mockResolvedValue({}); f.loadBoards.mockResolvedValue({});
  await expect(f.prepareJourneyNavigationCode()).resolves.toBe(true);
  expect(f.loadCollectibles).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

test('stalled imports have a bounded wait and late settlement cannot overwrite a newer attempt', async () => {
  const f = fixture(); const first = f.prepareJourneyNavigationCode();
  jest.advanceTimersByTime(1500);
  await expect(first).resolves.toBe(false);
  const secondModules = deferred();
  f.loadCollectibles.mockReturnValue(secondModules.promise); f.loadBoards.mockResolvedValue({});
  const second = f.prepareJourneyNavigationCode();
  f.collectors.resolve(); f.boards.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(f.prepareJourneyNavigationCode()).toBe(second);
  secondModules.resolve(); await expect(second).resolves.toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('launch starts code preparation before critical assets and joins its deadline before Homepage handoff', () => {
  const main = fs.readFileSync('src/main.ts', 'utf8');
  const start = main.slice(main.indexOf('async function startAssetPreloading()'));
  expect(start).toContain('nativeDevServerRuntime\n      ? Promise.resolve(false)\n      : prepareJourneyNavigationCode()');
  expect(start.indexOf('prepareJourneyNavigationCode()')).toBeLessThan(start.indexOf('preloadCriticalAssetsOnly()'));
  expect(start.indexOf('await Promise.all([launchPromise, journeyCodePreparation])')).toBeLessThan(start.indexOf('Launch screen completed - showing homepage'));
});

test.each(['fresh', 'tutorial', 'forced-tutorial', 'migration', 'missing-state', 'malformed', 'needs-reconcile', 'extra-field', 'noncanonical-order'])('%s state stays on the original lazy route without startup imports or storage writes', async (state) => {
  const f = fixture();
  if (state === 'fresh') localStorage.clear();
  if (state === 'tutorial') localStorage.removeItem('cc_first_play_tutorial_done');
  if (state === 'forced-tutorial') localStorage.setItem('cc_first_play_tutorial_force_next', 'true');
  if (state === 'migration') localStorage.setItem('journey_forest_layout_state_version', 'old');
  if (state === 'missing-state') localStorage.removeItem('journey_boards_state');
  if (state === 'malformed') localStorage.setItem('journey_boards_state', '{');
  if (state === 'needs-reconcile') {
    const boards = JSON.parse(localStorage.getItem('journey_boards_state')!);
    boards[6].interim = false;
    localStorage.setItem('journey_boards_state', JSON.stringify(boards));
  }
  if (state === 'extra-field' || state === 'noncanonical-order') {
    const boards = JSON.parse(localStorage.getItem('journey_boards_state')!);
    if (state === 'extra-field') boards[0].futureMetadata = 'preserve';
    else boards[0] = { interim: boards[0].interim, unlocked: boards[0].unlocked, id: boards[0].id };
    localStorage.setItem('journey_boards_state', JSON.stringify(boards));
  }
  const before = JSON.stringify(localStorage);
  await expect(f.prepareJourneyNavigationCode()).resolves.toBe(false);
  expect(f.loadBoards).not.toHaveBeenCalled(); expect(f.loadCollectibles).not.toHaveBeenCalled();
  expect(JSON.stringify(localStorage)).toBe(before);
});

test('actual imported singleton constructor preserves eligible progression bytes and does not render', async () => {
  const managerFile = ts.createSourceFile('manager.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const manager = managerFile.statements.find((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === 'JourneyBoardsManager')!;
  const selected = manager.members.filter(node => ts.isConstructorDeclaration(node) || (ts.isMethodDeclaration(node) && ['initializeBoards', 'loadBoardsState', 'saveBoardsState', 'ensureWorldInterimCards'].includes(node.name.getText(managerFile))));
  const actual = ts.transpileModule(`class Actual { ${selected.map(node => node.getText(managerFile)).join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const render = jest.fn();
  const scope = { JOURNEY_MAX_BOARDS, JOURNEY_LAYOUT_STATE_VERSION, reconcileJourneyWorldInterims,
    logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() } };
  const Type = new Function('scope', `with(scope){${actual};return Actual;}`)(scope);
  Type.prototype.getBoardCardAsset = () => ({ path1x: '', path2x: '', rarity: 'common' });
  Type.prototype.getBoardName = () => '';
  Type.prototype.renderBoards = render;
  const f = fixture();
  localStorage.setItem('cc_saved_game', '{"score":987,"boardNumber":7}');
  const before = JSON.stringify(localStorage);
  const listener = jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
  f.loadBoards.mockImplementation(async () => ({ journeyBoardsManager: new Type() }));
  const pending = f.prepareJourneyNavigationCode(); f.collectors.resolve();
  await expect(pending).resolves.toBe(true);
  expect(JSON.stringify(localStorage)).toBe(before);
  expect(render).not.toHaveBeenCalled();
  listener.mockRestore();
});
