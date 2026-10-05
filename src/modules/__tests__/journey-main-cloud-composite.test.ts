/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('manager.ts', fs.readFileSync('src/modules/journey-boards-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
function method(name: string, scope: Record<string, unknown>): (this: any, ...args: any[]) => any {
  let declaration: ts.MethodDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!declaration?.body) throw new Error(`Missing ${name}`);
  const code = ts.transpileModule(`async function run(${declaration.parameters.map(p => p.getText(source)).join(',')}) ${declaration.body.getText(source)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function('scope', `with(scope){${code};return run;}`)(scope);
}

function fixture() {
  const root = document.createElement('div');
  root.innerHTML = '<div class="journey-main-cloud-unit" data-journey-area-id="beach-main" style="height:100%;width:100%"></div>';
  const unit = root.firstElementChild as HTMLElement;
  const canvas = document.createElement('canvas'); canvas.width = 225; canvas.height = 75;
  Object.assign(canvas.dataset, {
    journeyCompositeLeft: '-5%', journeyCompositeTop: '-1%',
    journeyCompositeWidth: '46%', journeyCompositeHeight: '6%',
  });
  let finish!: (value: HTMLCanvasElement | null) => void;
  const ready = new Promise<HTMLCanvasElement | null>(resolve => { finish = resolve; });
  const owner = {
    renderDisposed: false, renderLifecycleGeneration: 5,
    journeyV700View: 'hub', journeyV700WorldId: null as number | null,
    buildJourneyMainCloudComposite: jest.fn(() => ready),
  };
  const scope = { gsap: { killTweensOf: jest.fn(), set: jest.fn() }, emitIOSNativeDiagnostic: jest.fn() };
  const prepare = method('prepareJourneyMainCloudComposite', scope).bind(owner);
  return { root, unit, canvas, owner, scope, prepare, finish };
}
afterEach(() => { jest.restoreAllMocks(); document.body.innerHTML = ''; });

test('current detached prepaint mounts the exact cached composite without revealing its root', async () => {
  const f = fixture();
  const pending = f.prepare(f.root, 2, { allowPrepaint: true, isCurrent: () => true });
  f.finish(f.canvas); await pending;
  expect(f.unit.firstElementChild).toBe(f.canvas);
  expect(f.root.isConnected).toBe(false); expect(f.root.style.cssText).toBe('');
  expect(f.canvas.width).toBe(225); expect(f.canvas.height).toBe(75);
  expect([f.canvas.style.left, f.canvas.style.top, f.canvas.style.width, f.canvas.style.height]).toEqual(['-5%', '-1%', '46%', '6%']);
  expect(f.unit.style.height).toBe('100%');
  expect(f.unit.dataset.journeyCloudCompositeReady).toBe('cached');
});

test.each(['token', 'generation', 'disposal', 'unit-replacement'])('pending composite cannot commit after %s retirement', async retirement => {
  const f = fixture(); let current = true;
  const pending = f.prepare(f.root, 2, { allowPrepaint: true, isCurrent: () => current });
  if (retirement === 'token') current = false;
  if (retirement === 'generation') f.owner.renderLifecycleGeneration += 1;
  if (retirement === 'disposal') f.owner.renderDisposed = true;
  if (retirement === 'unit-replacement') f.unit.replaceWith(f.unit.cloneNode());
  f.finish(f.canvas); await pending;
  expect(f.canvas.parentElement).toBeNull();
  expect(f.scope.gsap.killTweensOf).not.toHaveBeenCalled();
  expect(f.root.querySelector('canvas')).toBeNull();
});

test('detached permission requires a live explicit ownership callback', async () => {
  const f = fixture();
  await f.prepare(f.root, 2, { allowPrepaint: true });
  await f.prepare(f.root, 2, { allowPrepaint: true, isCurrent: () => false });
  expect(f.owner.buildJourneyMainCloudComposite).not.toHaveBeenCalled();
});

test('current detached prepaint never steals a canvas painted by another surface', async () => {
  const f = fixture(); const live = document.createElement('div');
  live.appendChild(f.canvas); document.body.appendChild(live);
  const pending = f.prepare(f.root, 2, { allowPrepaint: true, isCurrent: () => true });
  f.finish(f.canvas); await pending;
  expect(f.canvas.parentElement).toBe(live); expect(f.unit.childElementCount).toBe(0);
  expect(f.scope.gsap.killTweensOf).not.toHaveBeenCalled();
});

test('ordinary visible attachment still requires the exact visible World', async () => {
  const f = fixture(); document.body.appendChild(f.root);
  await f.prepare(f.root, 2);
  expect(f.owner.buildJourneyMainCloudComposite).not.toHaveBeenCalled();
  f.owner.journeyV700View = 'world'; f.owner.journeyV700WorldId = 2;
  const pending = f.prepare(f.root, 2); f.finish(f.canvas); await pending;
  expect(f.canvas.parentElement).toBe(f.unit);
});

test('existing builder rasterizes only cloud bounds, not the full-height Unit/map', async () => {
  const context = { setTransform: jest.fn(), drawImage: jest.fn(), globalAlpha: 1 };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any);
  const specs = [{ src: 'cloud-a', x: -20, y: -10, width: 100, opacity: 0.8 },
    { src: 'cloud-b', x: 120, y: 30, width: 40, opacity: 0.7 }];
  const images: HTMLImageElement[] = [];
  function TestImage() {
    const image = document.createElement('img');
    Object.defineProperties(image, { naturalWidth: { value: 100 }, naturalHeight: { value: 50 } });
    images.push(image); return image;
  }
  const owner = { journeyMainCloudCompositeCache: new Map(), journeyMainCloudCompositeBuilds: new Map(),
    renderLifecycleGeneration: 3, renderDisposed: false };
  const build = method('buildJourneyMainCloudComposite', {
    getJourneyMainCloudRenderSpecs: () => specs, Image: TestImage, waitForImageReady: async () => {},
    MOBILE_RUNTIME_PROFILE: { isMobileDevice: true }, FOREST_MAP_DESIGN_WIDTH: 390, FOREST_MAP_DESIGN_HEIGHT: 1000,
    emitIOSNativeDiagnostic: jest.fn(), window: { devicePixelRatio: 3 },
  }).bind(owner);
  const canvas = await build(2);
  expect([canvas.width, canvas.height]).toEqual([225, 75]);
  expect(canvas.dataset.journeyCompositeDesignWidth).toBe('180');
  expect(canvas.dataset.journeyCompositeDesignHeight).toBe('60');
  expect(context.drawImage.mock.calls).toEqual([[images[0], 0, 0, 100, 50], [images[1], 140, 40, 40, 20]]);
  expect(await build(2)).toBe(canvas); expect(images).toHaveLength(2);
});
