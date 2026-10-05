/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';

const rawSource = fs.readFileSync('src/collectibles-manager.ts', 'utf8');
const source = ts.createSourceFile('collectibles.ts', rawSource, ts.ScriptTarget.Latest, true);
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

afterEach(() => { document.body.innerHTML = ''; });

test.each([[false, false], [true, false], [true, true], [false, true]])('Hub readiness stays paint-proof (required=%s, stale=%s)', async (required, stale) => {
  document.body.innerHTML = '<section id="journey-screen" hidden class="hidden" style="display:none;opacity:0"><div id="journey-boards-container" data-journey-v700-view="hub"></div></section>';
  const screen = document.getElementById('journey-screen')!;
  const before = screen.outerHTML;
  let finish!: () => void;
  const manager = {
    renderBoards: jest.fn(), updateCounter: jest.fn(),
    prepareJourneyHubImagesForReveal: jest.fn(() => new Promise<void>(resolve => { finish = resolve; })),
    prepareJourneyResidentWorldsForHubReveal: jest.fn(),
    warmJourneyV700HubForHomepageReveal: jest.fn(),
    suspendForHomepage: jest.fn(),
  };
  const capture = { mark: jest.fn(), phase: (_name: string, work: () => unknown) => work(), finish: jest.fn() };
  const scope = {
    loadModule: async () => ({ journeyBoardsManager: manager }),
    beginTransitionPerformance: () => capture,
    readJourneyPreparationRuntimeState: () => ({}),
    isJourneyBackgroundPreparationAllowed: () => true,
    isJourneyVisibleEnterPreparationAllowed: () => true,
    isJourneyViewStructurallyPrepared: () => true,
    areDetailedRuntimeDiagnosticsEnabled: () => false,
    logger: { info: jest.fn(), error: jest.fn() },
  };
  const owner = { journeyPrepareEpoch: 0, journeyPreparePromise: null };
  const run = new Function('scope', `with(scope){${code};return run;}`)(scope).bind(owner);
  const pending = run({ requiredForVisibleEnter: required });
  await Promise.resolve(); await Promise.resolve();
  expect(screen.outerHTML).toBe(before);
  const prepared = screen.outerHTML;
  if (stale) owner.journeyPrepareEpoch++;
  finish(); await pending;
  expect(screen.outerHTML).toBe(prepared);
  expect(manager.renderBoards).not.toHaveBeenCalled();
  expect(manager.prepareJourneyResidentWorldsForHubReveal).not.toHaveBeenCalled();
  expect(manager.warmJourneyV700HubForHomepageReveal).not.toHaveBeenCalled();
  expect(manager.suspendForHomepage).not.toHaveBeenCalled();
  expect(document.querySelector('.journey-viewport-parking-cover')).toBeNull();
  expect(capture.finish).toHaveBeenCalledWith(stale ? 'stale' : 'complete');
});

test('accepted Homepage CTA has no cold paint-parking admission path', () => {
  const ui = fs.readFileSync('src/modules/ui-manager.ts', 'utf8');
  expect(rawSource).not.toContain('canParkHubBehindHomepage');
  expect(ui).not.toContain('canParkHubBehindHomepage');
  expect(method.body!.getText(source)).not.toContain('suspendForHomepage');
});
