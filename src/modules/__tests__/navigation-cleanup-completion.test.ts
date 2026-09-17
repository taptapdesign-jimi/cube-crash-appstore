/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';
const file = ts.createSourceFile('app-core.ts', fs.readFileSync('src/modules/app-core.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const node = file.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'softResetBoardView')!;
const code = ts.transpileModule(node.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture() {
  const fallback = jest.fn();
  const stage = { addChild: jest.fn() };
  const container = () => ({ removeChildren: jest.fn(), parent: stage, addChildAt: jest.fn(), sortChildren: jest.fn() });
  const scope: any = {
    devLog: jest.fn(), _hudInitDone: true, gsap: { killTweensOf: jest.fn() },
    stage, board: container(), hud: container(), boardBG: {}, backgroundLayer: {},
    PIXI: { Container: jest.fn(container) }, __ccNavCleanupTimer: window.setTimeout(fallback, 220),
  };
  const reset = new Function('scope', `with(scope){${code};return softResetBoardView;}`)(scope);
  return { scope, reset, fallback };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); delete (window as any)._ghostPlaceholders; });
test.each(['nav:collectibles', 'nav:settings'])('completed explicit reset %s retires the duplicate delayed cleanup', (reason) => {
  const f = fixture(); f.reset(reason);
  expect(f.scope.board.removeChildren).toHaveBeenCalledTimes(1);
  expect(f.scope.hud.removeChildren).toHaveBeenCalledTimes(1);
  expect(f.scope.__ccNavCleanupTimer).toBeNull();
  jest.advanceTimersByTime(220); expect(f.fallback).not.toHaveBeenCalled();
});
test('other reset reasons retain event-only navigation fallback', () => {
  const f = fixture(); f.reset('unrelated');
  jest.advanceTimersByTime(220); expect(f.fallback).toHaveBeenCalledTimes(1);
});
test('failed explicit reset preserves the scheduled fallback', () => {
  const f = fixture(); Object.defineProperty(f.scope.board, 'visible', { set: () => { throw new Error('reset failed'); } });
  expect(() => f.reset('nav:collectibles')).toThrow('reset failed');
  jest.advanceTimersByTime(220); expect(f.fallback).toHaveBeenCalledTimes(1);
});
