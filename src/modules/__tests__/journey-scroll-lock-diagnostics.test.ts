import fs from 'node:fs';
import ts from 'typescript';
const source = ts.createSourceFile('collectibles-animations.ts', fs.readFileSync('src/ui/collectibles-animations.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = new Set(['lockJourneyViewportTransition', 'unlockJourneyViewportTransition']);
const code = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text || '')).map(node => node.getText(source).replace(/^export /, '')).join('\n');
const compiled = ts.transpileModule(`let activeJourneyViewportLock = null; ${code}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(detailed: boolean) {
  document.body.innerHTML = '<div id="journey-screen"><div class="collectibles-scrollable"></div></div>';
  const scrollable = document.querySelector('.collectibles-scrollable') as HTMLElement;
  scrollable.scrollTop = 65;
  scrollable.style.touchAction = 'pan-y'; scrollable.style.overscrollBehavior = 'contain';
  scrollable.style.overscrollBehaviorY = 'contain'; scrollable.style.webkitOverflowScrolling = 'touch';
  const scrollHeight = jest.fn(() => 1200), clientHeight = jest.fn(() => 800);
  Object.defineProperty(scrollable, 'scrollHeight', { get: scrollHeight });
  Object.defineProperty(scrollable, 'clientHeight', { get: clientHeight });
  const log = { info: jest.fn() };
  const methods = new Function('areDetailedRuntimeDiagnosticsEnabled', 'console', `${compiled}; return { lock: lockJourneyViewportTransition, unlock: unlockJourneyViewportTransition };`)(() => detailed, log);
  return { ...methods, scrollable, scrollHeight, clientHeight, log };
}
afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); delete (window as any).__ccJourneyViewportTransitionLocked; });

test.each([false, true])('actual lock restores scroll/input ownership with diagnostic reads only when detailed=%s', detailed => {
  const f = fixture(detailed);
  f.lock('exit');
  expect(f.scrollable.style.touchAction).toBe('none');
  expect((window as any).__ccJourneyViewportTransitionLocked).toBe(true);
  const move = new Event('touchmove', { cancelable: true }); f.scrollable.dispatchEvent(move); expect(move.defaultPrevented).toBe(true);
  f.scrollable.scrollTop = 200; f.scrollable.dispatchEvent(new Event('scroll')); expect(f.scrollable.scrollTop).toBe(65);
  f.unlock('complete');
  expect(f.scrollable.style.touchAction).toBe('pan-y');
  expect(f.scrollable.style.overscrollBehavior).toBe('contain');
  expect(f.scrollable.style.webkitOverflowScrolling).toBe('touch');
  expect((window as any).__ccJourneyViewportTransitionLocked).toBeUndefined();
  const freeMove = new Event('touchmove', { cancelable: true }); f.scrollable.dispatchEvent(freeMove); expect(freeMove.defaultPrevented).toBe(false);
  f.scrollable.scrollTop = 200; f.scrollable.dispatchEvent(new Event('scroll')); expect(f.scrollable.scrollTop).toBe(200);
  expect(f.scrollHeight).toHaveBeenCalledTimes(detailed ? 2 : 0);
  expect(f.clientHeight).toHaveBeenCalledTimes(detailed ? 2 : 0);
  if (!detailed) expect(f.log.info).not.toHaveBeenCalled();
});
