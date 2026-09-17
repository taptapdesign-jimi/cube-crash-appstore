/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';
const source = ts.createSourceFile('collectibles-manager.ts', fs.readFileSync('src/collectibles-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const node = source.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'restoreJourneyScrollableInteractivity')!;
const code = ts.transpileModule(node.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(enabled: boolean) {
  document.body.innerHTML = '<div id="journey-screen"><div class="collectibles-scrollable"><div id="journey-boards-container"></div></div></div>';
  const scroll = document.querySelector('.collectibles-scrollable') as HTMLElement;
  scroll.style.transform = 'translateY(10px)'; scroll.style.overflowY = 'hidden';
  const height = jest.fn(() => 1200); const client = jest.fn(() => 844);
  Object.defineProperty(scroll, 'scrollHeight', { get: height });
  Object.defineProperty(scroll, 'clientHeight', { get: client });
  const handlers = { start: jest.fn(), move: jest.fn(), end: jest.fn(), lockX: jest.fn(), releaseTween: { kill: jest.fn() } };
  (scroll as any).__journeyScreenElasticHandlers = handlers;
  const deps = { areDetailedRuntimeDiagnosticsEnabled: () => enabled, areContinuousRuntimeDiagnosticsEnabled: () => false,
    unlockJourneyViewportTransition: jest.fn(), gsap: { killTweensOf: jest.fn() }, logger: { info: jest.fn(), warn: jest.fn() } };
  const restore = new Function('scope', `with(scope){${code}; return restoreJourneyScrollableInteractivity;}`)(deps);
  return { scroll, height, client, handlers, deps, restore };
}
afterEach(() => { jest.restoreAllMocks(); document.body.innerHTML = ''; });

test('ordinary restoration keeps functional cleanup and scrolling without diagnostic layout reads', () => {
  const f = fixture(false); const computed = jest.spyOn(window, 'getComputedStyle');
  f.restore('ordinary', false);
  expect(computed).not.toHaveBeenCalled(); expect(f.height).not.toHaveBeenCalled(); expect(f.client).not.toHaveBeenCalled();
  expect(f.scroll.style.overflowY).toBe('auto'); expect(f.scroll.style.transform).toBe('');
  expect(f.handlers.releaseTween.kill).toHaveBeenCalledTimes(1);
  expect((f.scroll as any).__journeyScreenElasticHandlers).toBeUndefined();
  expect(f.deps.unlockJourneyViewportTransition).not.toHaveBeenCalled();
  expect(f.deps.logger.info).not.toHaveBeenCalled();
});

test('explicit detailed capture retains the diagnostic snapshot after functional restoration', () => {
  const f = fixture(true); const computed = jest.spyOn(window, 'getComputedStyle');
  f.restore('capture');
  expect(computed).toHaveBeenCalledTimes(1); expect(f.height).toHaveBeenCalledTimes(1); expect(f.client).toHaveBeenCalledTimes(1);
  expect(f.deps.logger.info).toHaveBeenCalledWith('🧪 JourneyScrollRestore', expect.objectContaining({ reason: 'capture', scrollHeight: 1200, clientHeight: 844, computedOverflowY: 'auto', removedScreenElastic: true }));
  expect(f.deps.unlockJourneyViewportTransition).toHaveBeenCalledWith('capture');
});
