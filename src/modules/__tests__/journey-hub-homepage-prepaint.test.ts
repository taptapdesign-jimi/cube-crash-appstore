/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile(
  'journey-boards-manager.ts',
  fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
let method!: ts.MethodDeclaration;
function visit(node: ts.Node): void {
  if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'warmJourneyV700HubForHomepageReveal') method = node;
  ts.forEachChild(node, visit);
}
visit(source);
const code = ts.transpileModule(
  `async function run(root) ${method.body!.getText(source)}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

function fixture() {
  document.body.innerHTML = `
    <section id="journey-screen" hidden class="hidden" style="display:none;visibility:hidden;opacity:0">
      <div id="journey-boards-container" data-journey-v700-view="hub">
        <div class="journey-v700-hub">
          <div class="journey-v700-hub-cloud-layer"></div>
          <div class="journey-v700-world-card" data-world-id="1"></div>
          <div class="journey-v700-world-card" data-world-id="2"></div>
          <div class="journey-v700-world-card" data-world-id="3"></div>
        </div>
      </div>
    </section>`;
  const root = document.getElementById('journey-boards-container')!;
  const waits: Array<() => Promise<boolean>> = [];
  const diagnostics = jest.fn();
  const owner: any = {
    renderLifecycleGeneration: 4,
    renderDisposed: false,
    primeJourneyV700HubForHiddenHandoff: jest.fn(),
    waitForTrackedFrames: jest.fn(() => waits.shift()?.() ?? Promise.resolve(true)),
  };
  const run = new Function(
    'scope',
    `with(scope){${code};return run;}`,
  )({
    getJourneyHubWorkingSet: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    emitIOSNativeDiagnostic: diagnostics,
  }).bind(owner);
  return { root, owner, run, diagnostics, waits };
}

afterEach(() => { document.body.innerHTML = ''; });

test('cold Homepage preparation paints the exact Hub for three frames and restores the covered screen', async () => {
  const f = fixture();
  const screen = document.getElementById('journey-screen')!;
  const painted = await f.run(f.root);
  expect(painted).toBe(true);
  expect(f.owner.waitForTrackedFrames).toHaveBeenCalledTimes(3);
  expect(f.owner.primeJourneyV700HubForHiddenHandoff).toHaveBeenCalledWith(
    document.querySelector('.journey-v700-hub'),
    [1, 2, 3],
  );
  document.querySelectorAll<HTMLElement>('.journey-v700-world-card, .journey-v700-hub-cloud-layer')
    .forEach(target => expect(target.style.opacity).toBe('0.001'));
  expect(screen.hidden).toBe(true);
  expect(screen.classList.contains('hidden')).toBe(true);
  expect(screen.style.display).toBe('none');
  expect(f.diagnostics).toHaveBeenCalledWith('hub-homepage-prepaint-painted', {
    worldCount: 3,
    targetCount: 4,
  });
});

test('replacement invalidates the paint lease before later frames can claim readiness', async () => {
  const f = fixture();
  f.waits.push(async () => {
    f.owner.renderLifecycleGeneration += 1;
    return true;
  });
  expect(await f.run(f.root)).toBe(false);
  expect(f.owner.waitForTrackedFrames).toHaveBeenCalledTimes(1);
  expect(f.diagnostics).not.toHaveBeenCalled();
  expect(document.getElementById('journey-screen')!.hidden).toBe(true);
  document.querySelectorAll<HTMLElement>('.journey-v700-world-card, .journey-v700-hub-cloud-layer')
    .forEach(target => expect(target.style.opacity).toBe(''));
});
