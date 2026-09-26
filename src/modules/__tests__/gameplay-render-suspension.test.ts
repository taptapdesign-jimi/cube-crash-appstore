import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { ensureAnimationRunning } from '../app-core-animation-ensure';
import {
  isGameplayRendererTerminalSuspended,
  releaseGameplayRendererForEntry,
  suspendGameplayRendererForTerminal,
} from '../gameplay-render-suspension';

describe('terminal gameplay renderer ownership', () => {
  function renderer() {
    const ticker = { started: true, start: jest.fn(() => { ticker.started = true; }), stop: jest.fn(() => { ticker.started = false; }) };
    return { ticker };
  }
  const animation = () => ({ globalTimeline: { resume: jest.fn() }, ticker: { wake: jest.fn() } });

  test('twenty Play Again cycles stop covered rendering and resume only through the new prepared entry', () => {
    const app = renderer();
    const gsap = animation();
    const retire = jest.fn();
    for (let attempt = 0; attempt < 20; attempt++) {
      expect(suspendGameplayRendererForTerminal(app, () => true, retire)).toBe(true);
      suspendGameplayRendererForTerminal(app, () => true, retire);
      ensureAnimationRunning({ app, gsap });
      expect(app.ticker.started).toBe(false);
      expect(app.ticker.start).toHaveBeenCalledTimes(attempt);
      releaseGameplayRendererForEntry(app);
      expect(app.ticker.started).toBe(false);
      ensureAnimationRunning({ app, gsap });
      expect(app.ticker.started).toBe(true);
    }
    expect(retire).toHaveBeenCalledTimes(20);
    expect(app.ticker.stop).toHaveBeenCalledTimes(20);
    expect(app.ticker.start).toHaveBeenCalledTimes(20);
  });

  test('a stale result cannot stop a replacement board or hold a different app', () => {
    const app = renderer();
    const retire = jest.fn();
    expect(suspendGameplayRendererForTerminal(app, () => false, retire)).toBe(false);
    expect(retire).not.toHaveBeenCalled();
    expect(app.ticker.started).toBe(true);
    suspendGameplayRendererForTerminal(app, () => true, retire);
    expect(isGameplayRendererTerminalSuspended(renderer())).toBe(false);
  });

  test('an idle cleanup failure cannot leave covered rendering running', () => {
    const app = renderer();
    expect(() => suspendGameplayRendererForTerminal(app, () => true, () => { throw new Error('cleanup'); })).toThrow('cleanup');
    expect(app.ticker.started).toBe(false);
  });

  test('the actual terminal owner retires every tile idle family once without touching finale owners', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../app-core.ts'), 'utf8');
    const parsed = ts.createSourceFile('app-core.ts', source, ts.ScriptTarget.Latest, true);
    const owner = parsed.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'suspendTerminalGameplay')!;
    const code = ts.transpileModule(owner.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const stops = Object.fromEntries(['stopSpecialDiceIdleMotion', 'stopWildIdle', 'stopWildShimmer', 'stopWildStars', 'stopWildJuiceBubbles', 'stopMagnetIdleParticles', 'stopTntIdleParticles', 'stopTntIdleShake'].map((name) => [name, jest.fn()]));
    const tile = { special: 'wild-juice' };
    const dead = { destroyed: true };
    const app = { ...renderer(), renderer: { render: jest.fn() } };
    const stage = { visible: true };
    app.renderer.render.mockImplementation(() => {
      // Final hidden pixels must be committed before ticker suspension.
      expect(app.ticker.started).toBe(true);
    });
    const deps = { app, stage, devWarn: jest.fn(), suspendGameplayRendererForTerminal, TILE_IDLE_BOUNCE: { stop: jest.fn() }, tiles: [tile, dead], STATE: { tiles: [tile] }, ...stops };
    const suspend = new Function(...Object.keys(deps), `${code}; return suspendTerminalGameplay;`)(...Object.values(deps));
    suspend(() => true);
    for (const stop of Object.values(stops)) expect(stop).toHaveBeenCalledTimes(1);
    expect(app.renderer.render).toHaveBeenCalledWith(stage);
    expect(app.ticker.started).toBe(false);
  });
});
