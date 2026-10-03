/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('manager.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let method!: ts.MethodDeclaration;
function visit(node: ts.Node): void {
  if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'prepareJourneyHubImagesForReveal') method = node;
  ts.forEachChild(node, visit);
}
visit(source);
const code = ts.transpileModule(`function run(root = document, worldId) ${method.body!.getText(source)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture() {
  document.body.innerHTML = '<div class="journey-v700-hub"><div class="journey-v700-world-card" data-world-id="1"><img src="/a.png"></div><div data-world-id="4"><img src="/offscreen.png"></div></div>';
  const image = document.querySelector('img')!;
  Object.defineProperties(image, { complete: { configurable: true, value: true }, naturalWidth: { configurable: true, value: 100 } });
  const jobs: (() => void)[] = [];
  const wait = jest.fn(() => new Promise<void>(resolve => jobs.push(resolve)));
  const scope = { MOBILE_RUNTIME_PROFILE: { isMobileDevice: true }, getJourneyHubWorkingSet: () => [{ id: 1 }], waitForImageReady: wait };
  const owner = { journeyHubImageReadiness: new WeakMap() };
  const run = new Function('scope', `with(scope){${code};return run;}`)(scope).bind(owner);
  return { image, jobs, wait, run };
}
afterEach(() => { document.body.innerHTML = ''; });

test('covered preparation and visible enter share one decode per displayed node; offscreen work stays deferred', async () => {
  const f = fixture(); const preparation = f.run(); const enter = f.run();
  expect(f.wait).toHaveBeenCalledTimes(1);
  f.jobs.shift()!(); await Promise.all([preparation, enter]);
  await f.run(); expect(f.wait).toHaveBeenCalledTimes(1);
});

test('new source gets new readiness and old failure cannot remove replacement', async () => {
  const f = fixture(); const old = f.run();
  f.image.src = '/b.png'; const next = f.run();
  Object.defineProperty(f.image, 'naturalWidth', { configurable: true, value: 0 });
  f.jobs.shift()!(); await old;
  const duplicate = f.run(); expect(f.wait).toHaveBeenCalledTimes(2);
  Object.defineProperty(f.image, 'naturalWidth', { configurable: true, value: 100 });
  f.jobs.shift()!(); await Promise.all([next, duplicate]);
});

test('failed/timed-out image remains retryable and a new Hub never inherits retired node readiness', async () => {
  const f = fixture(); Object.defineProperty(f.image, 'naturalWidth', { configurable: true, value: 0 });
  const first = f.run(); f.jobs.shift()!(); await first;
  const retry = f.run(); expect(f.wait).toHaveBeenCalledTimes(2); f.jobs.shift()!(); await retry;
  f.image.replaceWith(f.image.cloneNode());
  const replacement = f.run(); expect(f.wait).toHaveBeenCalledTimes(3); f.jobs.shift()!(); await replacement;
});
