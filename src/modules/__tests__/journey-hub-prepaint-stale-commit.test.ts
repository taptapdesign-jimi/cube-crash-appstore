/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { JourneyStageController } from '../journey-stage-controller';

const sourcePath = path.resolve(__dirname, '../journey-boards-manager.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const sourceFile = ts.createSourceFile('journey-boards-manager.ts', sourceText, ts.ScriptTarget.Latest, true);
let commitMethod: ts.MethodDeclaration | null = null;
let retainedMethod: ts.MethodDeclaration | null = null;
const visit = (node: ts.Node): void => {
  if (ts.isMethodDeclaration(node) && node.name.getText(sourceFile) === 'commitJourneyHubPrepaint') commitMethod = node;
  if (ts.isMethodDeclaration(node) && node.name.getText(sourceFile) === 'commitRetainedJourneyHub') retainedMethod = node;
  ts.forEachChild(node, visit);
};
visit(sourceFile);
const method = commitMethod!;
const compiledMethod = ts.transpileModule(
  `async function run(${method.parameters.map((parameter) => parameter.getText(sourceFile)).join(',')}) ${method.body!.getText(sourceFile)}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const diagnostic = jest.fn();
const runCommit = new Function('scope', `with(scope){${compiledMethod};return run;}`)({
  getJourneyHubWorkingSet: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
  emitIOSNativeDiagnostic: diagnostic,
  areDetailedRuntimeDiagnosticsEnabled: () => false,
});

function fixture() {
  document.body.innerHTML = '<div id="journey-boards-container" data-journey-v700-view="world" data-journey-v700-world-id="1"><div id="outgoing"></div></div>';
  const container = document.getElementById('journey-boards-container') as HTMLElement;
  const outgoing = document.getElementById('outgoing') as HTMLElement;
  const host = document.createElement('div');
  const root = document.createElement('div');
  root.style.height = '100%';
  root.style.minHeight = '100%';
  root.style.overflow = 'visible';
  const hub = document.createElement('section');
  hub.className = 'journey-v700-hub';
  root.appendChild(hub);
  host.appendChild(root);
  const controller = new JourneyStageController();
  const token = controller.beginTransition({ view: 'world', worldId: 1 }, { view: 'hub' });
  const owner: any = {
    journeyHubPrepaintStage: { ready: true, host, root },
    journeyStageController: controller,
    journeyV700WorldId: 1,
    journeyV700View: 'world',
    journeyV700Phase: 'exiting',
    renderLifecycleGeneration: 4,
    renderDisposed: false,
    primeJourneyV700HubForHiddenHandoff: jest.fn(),
    beginRenderLifecycle: jest.fn(),
    cancelJourneyWorldPrepaint: jest.fn(),
    journeyWorldRuntime: { deactivate: jest.fn() },
    cancelJourneyV700HubEnter: jest.fn(),
    retireJourneyBoardOwnersBeforeDomReplace: jest.fn(),
    releaseJourneyMainCloudComposites: jest.fn(),
    setJourneyV700View: jest.fn((view: string) => { owner.journeyV700View = view; }),
    updateJourneyV700Nav: jest.fn(),
    resetJourneyV700HubScrollToTop: jest.fn(),
    installJourneyScreenElasticOverscroll: jest.fn(),
    playJourneyV700HubEnter: jest.fn(),
  };
  return { container, outgoing, host, hub, controller, token, owner };
}

afterEach(() => {
  diagnostic.mockClear();
  document.body.innerHTML = '';
});

test('pressure-cleared Hub commits the detached prepared Hub atomically without forced geometry', async () => {
  const f = fixture();
  expect(f.controller.hasRetained({ view: 'hub' })).toBe(false);
  expect(f.host.isConnected).toBe(false);

  await expect(runCommit.call(f.owner, f.container, f.token, 1)).resolves.toBe(true);

  expect(f.container.firstElementChild).toBe(f.hub);
  expect(f.outgoing.isConnected).toBe(false);
  expect(f.controller.hasRetained({ view: 'world', worldId: 1 })).toBe(true);
  expect(f.owner.beginRenderLifecycle).toHaveBeenCalledTimes(1);
  expect(f.owner.playJourneyV700HubEnter).toHaveBeenCalledWith('world-return');
  const commitSource = sourceText.slice(
    sourceText.indexOf('private async commitJourneyHubPrepaint('),
    sourceText.indexOf('private cancelJourneyWorldPrepaint('),
  );
  expect(commitSource).not.toMatch(/offsetHeight|getBoundingClientRect|waitForTrackedFrames/);
});

test('a replaced transition cannot promote the detached Hub over the current World', async () => {
  const f = fixture();
  f.controller.beginTransition({ view: 'world', worldId: 1 }, { view: 'hub' });

  await expect(runCommit.call(f.owner, f.container, f.token, 1)).resolves.toBe(false);

  expect(f.container.firstElementChild).toBe(f.outgoing);
  expect(f.outgoing.isConnected).toBe(true);
  expect(f.host.isConnected).toBe(false);
  expect(f.controller.getRetainedDescriptors()).toEqual([]);
  expect(f.owner.beginRenderLifecycle).not.toHaveBeenCalled();
});

test('explicit native presentation preserves the real World stage and hidden Hub but never starts web Hub enter', async () => {
  const f = fixture();
  await expect(runCommit.call(f.owner, f.container, f.token, 1, { nativePresentation: true })).resolves.toBe(true);
  expect(f.container.firstElementChild).toBe(f.hub);
  expect(f.owner.primeJourneyV700HubForHiddenHandoff).toHaveBeenCalledTimes(1);
  expect(f.owner.playJourneyV700HubEnter).not.toHaveBeenCalled();
  expect(f.owner.journeyV700Phase).toBe('hidden');
  expect(f.controller.hasRetained({ view: 'world', worldId: 1 })).toBe(true);
});

test('retained native Hub handoff preserves World nodes and next-enter plan without starting web motion', () => {
  const f = fixture();
  const method = retainedMethod!;
  const compiled = ts.transpileModule(`function run(${method.parameters.map(parameter => parameter.getText(sourceFile)).join(',')}) ${method.body!.getText(sourceFile)}`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = new Function('scope', `with(scope){${compiled};return run;}`)({
    getJourneyHubWorkingSet: () => [{ id: 1 }, { id: 2 }, { id: 3 }], emitIOSNativeDiagnostic: diagnostic,
  });
  const hubOwner = document.createElement('div');
  hubOwner.dataset.journeyV700View = 'hub';
  f.controller.retainNodes({ view: 'hub' }, [f.hub], hubOwner);
  const prepared = { worldId: 1, targets: [f.outgoing], renderGeneration: 4 };
  Object.assign(f.owner, {
    journeyResidentPreparedEnters: new Map(),
    primeJourneyV700WorldEnter: jest.fn(() => { f.owner.journeyV700PreparedWorldEnter = prepared; }),
    cancelJourneyHubPrepaint: jest.fn(), refreshJourneyV700HubProgress: jest.fn(),
  });
  expect(run.call(f.owner, f.container, 1, f.token, { nativePresentation: true })).toBe(true);
  expect(f.container.firstElementChild).toBe(f.hub);
  expect(f.controller.hasRetained({ view: 'world', worldId: 1 })).toBe(true);
  expect(f.owner.journeyResidentPreparedEnters.get(1).targets[0]).toBe(f.outgoing);
  expect(f.owner.primeJourneyV700HubForHiddenHandoff).toHaveBeenCalledWith(f.container, [1, 2, 3]);
  expect(f.owner.playJourneyV700HubEnter).not.toHaveBeenCalled();
});
