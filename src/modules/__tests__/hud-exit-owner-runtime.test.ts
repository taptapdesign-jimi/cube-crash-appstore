/** @jest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { acquirePixiMobileActivityLease, startPixiMobileFrameController, stopPixiMobileFrameController, getPixiMobileFrameControllerSnapshot } from '../pixi-mobile-frame-controller';

jest.mock('../mobile-runtime-profile', () => ({
  MOBILE_RUNTIME_PROFILE: { isMobileDevice: true, settledIdleMaxFramesPerSecond: 30 },
}));

function fixture() {
  const source = ts.createSourceFile('hud.ts', fs.readFileSync(path.join(__dirname, '../hud-helpers.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  const functions = ['playHudRise', 'animateBoardIndicatorExit'];
  const code = source.statements.filter((node) => ts.isFunctionDeclaration(node) && functions.includes(node.name?.text || '')).map((node) => node.getText(source).replace(/^export /, '')).join('\n');
  const tweens: { target: any; vars: any }[] = [];
  const timers: (() => void)[] = [];
  const indicator = document.createElement('div');
  indicator.setAttribute('data-state', 'visible'); document.body.append(indicator);
  const root = { parent: {}, y: 44, alpha: 1, visible: true, _dropTop: 44, _dropped: true };
  const scope: Record<string, any> = {
    acquirePixiMobileActivityLease: jest.fn(() => jest.fn()),
    HUD_ROOT: root, boardIndicator: indicator, BOARD_INDICATOR_ANIM_OFFSET: 80,
    cleanupSmokeBubbles: jest.fn(), cleanupComboAnimations: jest.fn(),
    gsap: { killTweensOf: jest.fn() },
    trackTween: (target: any, vars: any) => { tweens.push({ target, vars }); return { kill: jest.fn() }; },
    trackHudTimeout: (fn: () => void) => timers.push(fn),
    arePerformanceDiagnosticsEnabled: () => true,
    emitNativeConsoleDiagnostic: jest.fn(), console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const api = new Function('scope', `with(scope) { ${compiled}; return { playHudRise, animateBoardIndicatorExit }; }`)(scope) as {
    playHudRise: () => void; animateBoardIndicatorExit: (duration?: number) => void;
  };
  return { scope, root, indicator, tweens, timers, ...api };
}

afterEach(() => { document.body.innerHTML = ''; });

test('duplicate HUD exits preserve the in-flight authored curve instead of restarting it', () => {
  const f = fixture();
  f.playHudRise(); f.root.y = 30; f.playHudRise();
  expect(f.tweens).toHaveLength(1);
  expect(f.tweens[0].vars.duration).toBe(0.3);
  expect(f.scope.cleanupSmokeBubbles).toHaveBeenCalledTimes(1);
});

test('board-exit indicator plus delayed HUD indicator is one exit, not two restarted curves', () => {
  const f = fixture();
  f.animateBoardIndicatorExit(0.3); f.playHudRise(); f.timers.forEach((fn) => fn());
  expect(f.tweens.filter((tween) => tween.target === f.indicator)).toHaveLength(1);
});

test('completion of retired HUD and indicator cannot hide their replacement owners', () => {
  const f = fixture(); f.playHudRise(); f.animateBoardIndicatorExit();
  const replacement = { parent: {}, y: 44, alpha: 1, visible: true, _dropped: true };
  const replacementIndicator = document.createElement('div');
  replacementIndicator.setAttribute('data-state', 'visible');
  f.scope.HUD_ROOT = replacement; f.scope.boardIndicator = replacementIndicator;
  for (const tween of f.tweens) tween.vars.onComplete();
  expect(replacement).toEqual({ parent: {}, y: 44, alpha: 1, visible: true, _dropped: true });
  expect(replacementIndicator.getAttribute('data-state')).toBe('visible');
});


test('interrupted exit releases only its own owner and emits one bounded diagnostic', () => {
  const f = fixture(); f.playHudRise();
  const tween = f.tweens[0];
  tween.vars.onUpdate.call({ kill: jest.fn() });
  tween.vars.onInterrupt(); tween.vars.onInterrupt();
  expect(f.scope.emitNativeConsoleDiagnostic).toHaveBeenCalledTimes(1);
  expect(f.scope.emitNativeConsoleDiagnostic.mock.calls[0][2]).toMatchObject({ reason: 'interrupted', updates: 1 });
  expect((f.root as any)._ccHudExitOwner).toBeUndefined();
  f.playHudRise(); expect(f.tweens).toHaveLength(2);
});

test('retired delayed indicator request cannot affect a new HUD drop', () => {
  const f = fixture(); f.playHudRise();
  delete (f.root as any)._ccHudExitOwner;
  f.root._dropped = true;
  f.timers.forEach((fn) => fn());
  expect(f.tweens.filter((tween) => tween.target === f.indicator)).toHaveLength(0);
});


test('ordinary play does not sample or emit HUD performance diagnostics', () => {
  const f = fixture(); f.scope.arePerformanceDiagnosticsEnabled = () => false;
  const now = jest.spyOn(performance, 'now'); now.mockClear();
  f.playHudRise();
  f.tweens[0].vars.onUpdate.call({ kill: jest.fn() });
  f.tweens[0].vars.onComplete();
  expect(now).not.toHaveBeenCalled();
  expect(f.scope.emitNativeConsoleDiagnostic).not.toHaveBeenCalled();
  now.mockRestore();
});

test('no-HUD fallback cannot animate an indicator created for a replacement HUD', () => {
  const f = fixture(); f.scope.HUD_ROOT = null; (window as any).HUD_ROOT = null;
  f.playHudRise();
  f.scope.HUD_ROOT = f.root;
  f.scope.boardIndicator = document.createElement('div');
  f.timers.forEach((fn) => fn());
  expect(f.tweens).toHaveLength(0);
  delete (window as any).HUD_ROOT;
});


test.each(['complete', 'interrupt', 'setup-error'])('HUD exit holds real Pixi cadence until %s, including without diagnostics', (ending) => {
  let clock = 100;
  const now = jest.spyOn(performance, 'now').mockImplementation(() => clock);
  const callbacks = new Set<() => void>();
  const ticker = {
    maxFPS: 0,
    add: (cb: () => void) => callbacks.add(cb),
    remove: (cb: () => void) => callbacks.delete(cb),
  };
  try {
    startPixiMobileFrameController(ticker);
    clock += 6000;
    callbacks.forEach((cb) => cb());
    expect(ticker.maxFPS).toBe(30);
    const f = fixture();
    f.scope.acquirePixiMobileActivityLease = acquirePixiMobileActivityLease;
    f.scope.arePerformanceDiagnosticsEnabled = () => false;
    if (ending === 'setup-error') f.scope.trackTween = () => { throw new Error('setup failed'); };
    f.playHudRise();
    if (ending !== 'setup-error') {
      f.playHudRise();
      expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(1);
      clock += 6000;
      callbacks.forEach((cb) => cb());
      expect(ticker.maxFPS).toBe(60);
      const finish = ending === 'complete' ? f.tweens[0].vars.onComplete : f.tweens[0].vars.onInterrupt;
      finish(); finish();
    }
    expect(getPixiMobileFrameControllerSnapshot().activityLeaseCount).toBe(0);
    clock += 181;
    callbacks.forEach((cb) => cb());
    expect(ticker.maxFPS).toBe(30);
  } finally {
    stopPixiMobileFrameController();
    now.mockRestore();
  }
});
