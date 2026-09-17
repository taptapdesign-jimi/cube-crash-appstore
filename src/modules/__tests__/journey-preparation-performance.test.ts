/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('collectibles.ts', fs.readFileSync('src/collectibles-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let method!: ts.MethodDeclaration;
function visit(node: ts.Node): void {
  if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'prepareJourneyScreen') method = node;
  ts.forEachChild(node, visit);
}
visit(source);
const code = ts.transpileModule(
  `async function run(options = {}) ${method.body!.getText(source)}`.replace("import('./modules/journey-boards-manager.js')", 'loadModule()'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

function fixture() {
  document.body.innerHTML = '<div id="journey-screen"><div id="journey-boards-container"></div></div>';
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const loading = new Promise((yes, no) => { resolve = yes; reject = no; });
  const trace = { mark: jest.fn(), phase: jest.fn((_name, work) => work()), finish: jest.fn() };
  const manager = { renderBoards: jest.fn(), updateCounter: jest.fn() };
  const scope = {
    beginTransitionPerformance: jest.fn(() => trace), loadModule: jest.fn(() => loading),
    readJourneyPreparationRuntimeState: () => ({}), isJourneyBackgroundPreparationAllowed: () => true,
    isJourneyVisibleEnterPreparationAllowed: () => true, isJourneyViewStructurallyPrepared: jest.fn(() => false),
    areDetailedRuntimeDiagnosticsEnabled: () => false,
    logger: { info: jest.fn(), error: jest.fn() },
  };
  const owner = { journeyPrepareEpoch: 0, journeyPreparePromise: null };
  const run = new Function('scope', `with(scope){${code};return run;}`)(scope).bind(owner);
  return { run, owner, scope, manager, trace, resolve: () => resolve({ journeyBoardsManager: manager }), reject };
}
afterEach(() => { document.body.innerHTML = ''; });

test('actual preparation separates module wait from synchronous work and shares the active capture', async () => {
  const f = fixture(); const first = f.run(); const duplicate = f.run();
  expect(f.trace.mark.mock.calls).toEqual([['module-await-start']]);
  expect(f.manager.renderBoards).not.toHaveBeenCalled();
  expect(f.scope.beginTransitionPerformance).toHaveBeenCalledTimes(1);
  f.resolve(); await Promise.all([first, duplicate]);
  expect(f.trace.mark.mock.calls).toEqual([['module-await-start'], ['module-await-complete']]);
  expect(f.trace.phase.mock.calls.map(([name]) => name)).toEqual(['render-boards', 'update-counter']);
  expect(f.manager.renderBoards).toHaveBeenCalledTimes(1);
  expect(f.manager.updateCounter).toHaveBeenCalledTimes(1);
  expect(f.trace.finish).toHaveBeenCalledWith('complete');
  expect(f.owner.journeyPreparePromise).toBeNull();
});

test('superseded module completion finishes without rendering or clearing replacement work', async () => {
  const f = fixture(); const pending = f.run();
  f.owner.journeyPrepareEpoch++;
  const replacement = Promise.resolve();
  (f.owner as any).journeyPreparePromise = replacement;
  f.resolve(); await pending;
  expect(f.manager.renderBoards).not.toHaveBeenCalled();
  expect(f.trace.finish).toHaveBeenCalledWith('stale');
  expect(f.owner.journeyPreparePromise).toBe(replacement);
});

test.each(['module', 'render'])('%s failure preserves rejection and closes capture', async (failure) => {
  const f = fixture(); const error = new Error(failure);
  if (failure === 'render') f.manager.renderBoards.mockImplementation(() => { throw error; });
  const pending = f.run(); const assertion = expect(pending).rejects.toBe(error);
  if (failure === 'module') f.reject(error); else f.resolve();
  await assertion;
  expect(f.trace.finish).toHaveBeenCalledWith('error');
  expect(f.manager.updateCounter).not.toHaveBeenCalled();
  expect(f.owner.journeyPreparePromise).toBeNull();
});

test('already prepared view closes without importing or rendering', async () => {
  const f = fixture(); f.scope.isJourneyViewStructurallyPrepared.mockReturnValue(true);
  await f.run();
  expect(f.scope.loadModule).not.toHaveBeenCalled();
  expect(f.trace.finish).toHaveBeenCalledWith('already-prepared');
});
