import fs from 'node:fs';
import ts from 'typescript';
import { beginScreenPreparation, isScreenPresented } from '../../utils/screen-presentation';
import { getScreenVisibility } from '../app-core-state-helpers';

jest.mock('../endgame-checker', () => ({ tileIsActive: () => true }));

const managerSource = ts.createSourceFile('journey.ts', fs.readFileSync(
  'src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const methods = new Map<string, ts.MethodDeclaration>();
function visit(node: ts.Node): void {
  if (ts.isMethodDeclaration(node)) methods.set(node.name.getText(managerSource), node);
  ts.forEachChild(node, visit);
}
visit(managerSource);
const endgameSource = fs.readFileSync('src/modules/endgame-flow.ts', 'utf8');
const guardSource = endgameSource.slice(endgameSource.indexOf('  const shouldAbortEndgameFlow ='),
  endgameSource.indexOf('\n  if (shouldAbortEndgameFlow())', endgameSource.indexOf('  const shouldAbortEndgameFlow =')));
const makeGuard = new Function('window', 'document', 'isScreenPresented', 'abortTokenAtStart',
  `${ts.transpileModule(guardSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; return shouldAbortEndgameFlow;`);

function fixture(worldId: number) {
  document.body.innerHTML = '<div id="app"></div><div id="home" hidden></div><section id="journey-screen" hidden class="hidden" style="display:none;opacity:0"><div id="journey-boards-container"><div id="unit"></div></div></section>';
  const screen = document.getElementById('journey-screen')!;
  const container = document.getElementById('journey-boards-container')!;
  const owner: any = {
    renderLifecycleGeneration: 1,
    journeyV700PreparedWorldEnter: { targets: [document.getElementById('unit')], ownerToken: 7 },
    journeyReturnPaintWarmLease: null,
    waitForTrackedFrames: async () => true,
  };
  for (const name of ['startJourneyReturnPaintWarm', 'releaseJourneyReturnPaintWarmLease']) {
    const method = methods.get(name)!;
    const code = ts.transpileModule(`function run(${method.parameters.map(p => p.getText(managerSource)).join(',')}) ${method.body!.getText(managerSource)}`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    owner[name] = new Function('beginScreenPreparation', 'emitIOSNativeDiagnostic', 'waitForImageReady',
      `${code}; return run;`)(beginScreenPreparation, jest.fn(), async () => {}).bind(owner);
  }
  const runtime = window as any;
  runtime.__ccEndgameFlowAbortToken = 0;
  runtime.exitingToMenu = false;
  const guard = makeGuard(window, document, isScreenPresented, 0) as () => boolean;
  return { screen, container, owner, guard, runtime, warm: () => owner.startJourneyReturnPaintWarm(container, worldId, 7, 'terminal-overlay') };
}

afterEach(() => {
  document.body.innerHTML = '';
  delete (window as any).__ccEndgameFlowAbortToken;
  delete (window as any).exitingToMenu;
});

test.each([1, 2, 3])('World %s preparation cannot abort Clean Board or block shared gameplay decisions', async (worldId) => {
  const f = fixture(worldId);
  f.warm();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(f.owner.journeyReturnPaintWarmLease.ready).toBe(true);
  expect(f.screen.hidden).toBe(false);
  expect(getComputedStyle(f.screen).display).toBe('flex');
  expect(f.screen.style.opacity).toBe('0.001');
  expect(f.guard()).toBe(false);
  expect(getScreenVisibility()).toEqual({ appVisible: true, homeVisible: false, journeyVisible: false });
  f.owner.releaseJourneyReturnPaintWarmLease(7, 'visible-enter-promoted', false);
  f.screen.style.opacity = '1';
  expect(f.guard()).toBe(true);
  expect(getScreenVisibility().journeyVisible).toBe(true);
});

test.each(['home', 'token', 'exit'])('real %s navigation still aborts during prepaint', (reason) => {
  const f = fixture(2); f.warm();
  if (reason === 'home') document.getElementById('home')!.hidden = false;
  if (reason === 'token') f.runtime.__ccEndgameFlowAbortToken = 1;
  if (reason === 'exit') f.runtime.exitingToMenu = true;
  expect(f.guard()).toBe(true);
  f.owner.releaseJourneyReturnPaintWarmLease(7, 'cancelled', true);
  expect(f.screen.hidden).toBe(true);
  expect(f.screen.style.display).toBe('none');
  expect(f.screen.style.opacity).toBe('0');
});

test('replacement, wrong-token cleanup and late image completion cannot retire newer preparation', async () => {
  const f = fixture(2); f.warm();
  f.owner.journeyV700PreparedWorldEnter = { targets: [document.getElementById('unit')], ownerToken: 8 };
  f.owner.startJourneyReturnPaintWarm(f.container, 2, 8, 'replacement');
  f.owner.releaseJourneyReturnPaintWarmLease(7, 'stale-cancel', true);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(f.owner.journeyReturnPaintWarmLease.ownerToken).toBe(8);
  expect(f.guard()).toBe(false);
  f.owner.releaseJourneyReturnPaintWarmLease(8, 'manager-cleanup', true);
  expect(f.screen.hidden).toBe(true);
  f.screen.hidden = false; f.screen.style.display = 'flex';
  expect(f.guard()).toBe(true);
});

test.each(['home', 'journey-screen', 'app', 'settings-screen'])('%s preparation has token-safe release and retains normal enter ownership', (id) => {
  const screen = document.createElement('section'); screen.id = id; document.body.append(screen);
  const oldRelease = beginScreenPreparation(screen);
  const release = beginScreenPreparation(screen);
  oldRelease();
  expect(isScreenPresented(screen)).toBe(false);
  release(); release();
  screen.style.opacity = '0';
  expect(isScreenPresented(screen)).toBe(true);
  screen.hidden = true;
  expect(isScreenPresented(screen)).toBe(false);
  screen.remove();
  expect(isScreenPresented(screen)).toBe(false);
});
