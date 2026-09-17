/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('animations.ts', fs.readFileSync('src/utils/animations.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = new Set(['HOME_ENTER_DIAG_PREFIX', 'isHomeEnterDiagnosticsEnabled', 'homeEnterProbeDisposers', 'clearHomeEnterProbes', 'getHomeEnterElementLabel', 'logHomeEnterElementState', 'probeHomeEnterMotion']);
const declarations: string[] = [];
function visit(node: ts.Node): void {
  if (ts.isVariableDeclaration(node) && names.has(node.name.getText(source))) declarations.push(`const ${node.getText(source)};`);
  ts.forEachChild(node, visit);
}
visit(source);
const code = ts.transpileModule(declarations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture() {
  const activeTimeouts = new Set<ReturnType<typeof setTimeout>>();
  return new Function('activeTimeouts', `${code}; return { probeHomeEnterMotion, logHomeEnterElementState, clearHomeEnterProbes, homeEnterProbeDisposers };`)(activeTimeouts);
}
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); delete (window as any).__ccHomeEnterDiagnostics; });

test('normal Homepage enter diagnostics do no geometry reads, timers or listener work', () => {
  const h = fixture(); const element = document.createElement('div');
  const style = jest.spyOn(window, 'getComputedStyle');
  const rect = jest.spyOn(element, 'getBoundingClientRect');
  const listener = jest.spyOn(element, 'addEventListener');
  h.logHomeEnterElementState('enter', element); h.probeHomeEnterMotion('hero', element);
  expect(style).not.toHaveBeenCalled(); expect(rect).not.toHaveBeenCalled();
  expect(listener).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});

test('explicit motion probes release listeners and samples immediately on route cancellation', () => {
  (window as any).__ccHomeEnterDiagnostics = true;
  const h = fixture(); const element = document.createElement('div');
  const remove = jest.spyOn(element, 'removeEventListener');
  h.probeHomeEnterMotion('hero', element);
  expect(jest.getTimerCount()).toBe(12);
  h.clearHomeEnterProbes();
  expect(remove).toHaveBeenCalledTimes(2); expect(jest.getTimerCount()).toBe(0);
  expect(h.homeEnterProbeDisposers.size).toBe(0);
  const logs = (console.log as jest.Mock).mock.calls.length;
  element.dispatchEvent(new Event('transitionstart')); jest.runAllTimers();
  expect(console.log).toHaveBeenCalledTimes(logs);
});

test('completed opt-in probes also release their owner without a later cancellation', () => {
  (window as any).__ccHomeEnterDiagnostics = true;
  const h = fixture(); const element = document.createElement('div');
  const remove = jest.spyOn(element, 'removeEventListener');
  h.probeHomeEnterMotion('hero', element); jest.advanceTimersByTime(1280);
  expect(remove).toHaveBeenCalledTimes(2); expect(jest.getTimerCount()).toBe(0);
  expect(h.homeEnterProbeDisposers.size).toBe(0);
});
