import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {
  beginGameplayEntryPreparation, cancelGameplayEntryPreparation,
  commitPreparedGameplayEntry, isGameplayEntryGenerationLatest, prepareGameplayEntryCommit,
} from '../gameplay-entry-coordinator';

// Execute the production entry completion and terminal finally against the
// same reused scene, including the real async entry coordinator.
function harness() {
  const source = fs.readFileSync(path.join(__dirname, '../app-core.ts'), 'utf8');
  const from = source.indexOf('  sweetPopPromise.then(() => {');
  const to = source.indexOf('    handleSweetPopInComplete({', from);
  const flow = fs.readFileSync(path.join(__dirname, '../endgame-flow.ts'), 'utf8');
  const finallyBody = flow.slice(flow.lastIndexOf('  } finally {') + '  } finally {'.length, flow.lastIndexOf('\n}') - 3);
  const owner = Symbol('old-terminal');
  const stage = { eventMode: 'none', destroyed: false };
  const scope: any = {
    stage, entryStage: stage, gameplayEntryGeneration: 0, gameplayEntrySignal: null,
    isGameplayEntryGenerationLatest, updateGhostVisibility: jest.fn(),
    window: { __ccEnterAnimationActive: true, CC: { _endgameFlowRunning: true } },
    flowOwner: owner, activeEndgameFlowOwner: owner,
    shouldAbortEndgameFlow: () => false, ctx: { isRunCurrent: () => false },
    cleanupNewCardHandoffCover: null, cleanupTutorialCompleteCover: null,
    continueTutorialIntoArcade: false, continueTutorialIntoJourney: false,
    boardBG: { visible: true }, prevBG: true, prevMode: 'static', showGrid: jest.fn(),
  };
  vm.createContext(scope);
  const run = (code: string) => vm.runInContext(ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, scope);
  run('async function settleOldTerminal(){' + finallyBody + '\n}');
  let finishPopIn = () => {};
  scope.gameplayEntryGeneration = beginGameplayEntryPreparation('Arcade Stage 2');
  scope.sweetPopPromise = prepareGameplayEntryCommit(scope.gameplayEntryGeneration, async (signal) => {
    scope.gameplayEntrySignal = signal;
    await new Promise<void>((resolve) => { finishPopIn = resolve; });
  });
  const done = run(source.slice(from, to) + '\n});');
  const begin = async () => { void commitPreparedGameplayEntry(); await Promise.resolve(); };
  return { scope, stage, done, begin, finish: () => finishPopIn() };
}

afterEach(() => cancelGameplayEntryPreparation());

test('Stage 2 restores reused scene input only when entry completes; old terminal cannot overwrite it', async () => {
  const h = harness();
  await h.begin();
  expect(h.stage.eventMode).toBe('none');
  h.finish();
  await h.done;
  expect(h.stage.eventMode).toBe('static');
  await h.scope.settleOldTerminal();
  expect(h.stage.eventMode).toBe('static');
  expect(h.scope.window.__ccEnterAnimationActive).toBe(false);
});

test.each(['new-generation', 'new-stage', 'abort', 'destroyed'])('retired entry cannot unlock input after %s', async (reason) => {
  const h = harness();
  await h.begin();
  if (reason === 'new-generation') beginGameplayEntryPreparation('replacement');
  if (reason === 'new-stage') h.scope.stage = { eventMode: 'none' };
  if (reason === 'abort') h.scope.gameplayEntrySignal = { aborted: true };
  if (reason === 'destroyed') h.stage.destroyed = true;
  h.finish();
  await h.done;
  expect(h.stage.eventMode).toBe('none');
  expect(h.scope.stage.eventMode).toBe('none');
  expect(h.scope.updateGhostVisibility).not.toHaveBeenCalled();
});
