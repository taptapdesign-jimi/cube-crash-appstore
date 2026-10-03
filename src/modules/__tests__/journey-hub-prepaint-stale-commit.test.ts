/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { JourneyStageController } from '../journey-stage-controller';

const sourcePath = path.resolve(__dirname, '../journey-boards-manager.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const sourceFile = ts.createSourceFile(
  'journey-boards-manager.ts',
  sourceText,
  ts.ScriptTarget.Latest,
  true,
);
let commitMethod: ts.MethodDeclaration | null = null;
const visit = (node: ts.Node): void => {
  if (ts.isMethodDeclaration(node) && node.name.getText(sourceFile) === 'commitJourneyHubPrepaint') {
    commitMethod = node;
  }
  ts.forEachChild(node, visit);
};
visit(sourceFile);

const method = commitMethod!;
const compiledMethod = ts.transpileModule(
  `async function run(${method.parameters.map((parameter) => parameter.getText(sourceFile)).join(',')}) ${method.body!.getText(sourceFile)}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const runCommit = new Function(
  'scope',
  `with(scope){${compiledMethod};return run;}`,
)({
  getJourneyHubWorkingSet: () => [{ id: 1 }],
  emitIOSNativeDiagnostic: jest.fn(),
  areDetailedRuntimeDiagnosticsEnabled: () => false,
});

test('a replaced transition during the covered frame cannot promote Hub or retain outgoing World', async () => {
  document.body.innerHTML = `
    <div id="journey-boards-container" data-journey-v700-view="world" data-journey-v700-world-id="1">
      <div id="outgoing" style="visibility:visible;pointer-events:auto"></div>
      <div id="stage"><div id="prepared"><div class="journey-v700-hub"></div></div></div>
    </div>
  `;
  const container = document.getElementById('journey-boards-container') as HTMLElement;
  const outgoing = document.getElementById('outgoing') as HTMLElement;
  const host = document.getElementById('stage') as HTMLElement;
  const root = document.getElementById('prepared') as HTMLElement;
  const controller = new JourneyStageController();
  const token = controller.beginTransition({ view: 'world', worldId: 1 }, { view: 'hub' });
  let resolveFrame!: (painted: boolean) => void;
  const owner: any = {
    journeyHubPrepaintStage: {
      ready: true,
      host,
      root,
    },
    journeyStageController: controller,
    journeyV700WorldId: 1,
    journeyV700View: 'world',
    renderLifecycleGeneration: 4,
    renderDisposed: false,
    primeJourneyV700HubForHiddenHandoff: jest.fn(),
    waitForTrackedFrames: jest.fn(() => new Promise<boolean>((resolve) => { resolveFrame = resolve; })),
    beginRenderLifecycle: jest.fn(),
  };

  const pending = runCommit.call(owner, container, token, 1);
  expect(outgoing.style.visibility).toBe('hidden');
  expect(outgoing.style.pointerEvents).toBe('none');

  controller.beginTransition({ view: 'world', worldId: 1 }, { view: 'hub' });
  resolveFrame(true);

  await expect(pending).resolves.toBe(false);
  expect(outgoing.style.visibility).toBe('visible');
  expect(outgoing.style.pointerEvents).toBe('auto');
  expect(outgoing.isConnected).toBe(true);
  expect(host.isConnected).toBe(true);
  expect(controller.getRetainedDescriptors()).toEqual([]);
  expect(owner.beginRenderLifecycle).not.toHaveBeenCalled();
});

test('a stale completion cannot restore styles over a newer render generation', async () => {
  document.body.innerHTML = `
    <div id="journey-boards-container" data-journey-v700-view="world" data-journey-v700-world-id="1">
      <div id="outgoing" style="visibility:visible;pointer-events:auto"></div>
      <div id="stage"><div id="prepared"><div class="journey-v700-hub"></div></div></div>
    </div>
  `;
  const container = document.getElementById('journey-boards-container') as HTMLElement;
  const outgoing = document.getElementById('outgoing') as HTMLElement;
  const host = document.getElementById('stage') as HTMLElement;
  const root = document.getElementById('prepared') as HTMLElement;
  const controller = new JourneyStageController();
  const token = controller.beginTransition({ view: 'world', worldId: 1 }, { view: 'hub' });
  let resolveFrame!: (painted: boolean) => void;
  const owner: any = {
    journeyHubPrepaintStage: { ready: true, host, root },
    journeyStageController: controller,
    journeyV700WorldId: 1,
    journeyV700View: 'world',
    renderLifecycleGeneration: 4,
    renderDisposed: false,
    primeJourneyV700HubForHiddenHandoff: jest.fn(),
    waitForTrackedFrames: jest.fn(() => new Promise<boolean>((resolve) => { resolveFrame = resolve; })),
    beginRenderLifecycle: jest.fn(),
  };

  const pending = runCommit.call(owner, container, token, 1);
  owner.renderLifecycleGeneration = 5;
  outgoing.style.visibility = 'collapse';
  outgoing.style.pointerEvents = 'all';
  resolveFrame(true);

  await expect(pending).resolves.toBe(false);
  expect(outgoing.style.visibility).toBe('collapse');
  expect(outgoing.style.pointerEvents).toBe('all');
  expect(owner.beginRenderLifecycle).not.toHaveBeenCalled();
});
