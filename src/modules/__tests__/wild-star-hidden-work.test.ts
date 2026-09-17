import * as foreground from '../wild-star-orbit-foreground';
import { STATE } from '../app-state';
import { getAnimatedDiceHudForegroundStats, resetAnimatedDiceHudForegroundForTests } from '../animated-dice-hud-foreground';
import { Assets, Container, Texture, TextureSource } from 'pixi.js';
import { gsap } from 'gsap';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as pixi from 'pixi.js';
import * as registry from '../special-dice-registry';
import * as runMode from '../run-mode';

// Execute the complete runtime owner, substituting only Vite's import.meta flag.
const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/wild-stars.ts'), 'utf8')
  .replace('(import.meta as any)?.env?.DEV', 'false');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject: any = {};
new Function('require', 'exports', compiled)((id: string) => {
  if (id === 'pixi.js') return pixi;
  if (id === 'gsap') return { gsap };
  if (id.includes('special-dice-registry')) return registry;
  if (id.includes('run-mode')) return runMode;
  if (id.includes('wild-star-orbit-foreground')) return foreground;
  throw new Error(`Unexpected dependency: ${id}`);
}, exportsObject);
const { attachWildStarHalo, detachWildStarHalo } = exportsObject;

it('preserves halo ownership while hidden, resumes motion and removes the last ticker on cleanup', () => {
  let now = 1000;
  let hidden = false;
  let tick: (() => void) | undefined;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  jest.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  const texture = new Texture({ source: new TextureSource({ width: 64, height: 64 }) });
  Object.defineProperty(texture.source, 'valid', { value: true });
  jest.spyOn(Assets, 'get').mockReturnValue(texture);
  jest.spyOn(Assets.resolver, 'hasKey').mockReturnValue(true);
  jest.spyOn(gsap.ticker, 'add').mockImplementation((callback) => { tick = callback as () => void; return callback; });
  const remove = jest.spyOn(gsap.ticker, 'remove').mockImplementation(() => {});
  const stage = new Container();
  STATE.app = { stage } as any;
  const board = stage.addChild(new Container());
  const tile = new Container() as Container & { isWild: boolean; _wildStarSystem?: any };
  tile.isWild = true;
  board.addChild(tile);
  attachWildStarHalo(tile);
  try {
    expect(tick).toBeDefined();
    tick!();
    const system = tile._wildStarSystem;
    expect(system.container.parent.label).toBe('wild-star-orbit-foreground');
    const pose = () => system.stars.map(({ sprite, angle }: any) => [sprite.x, sprite.y, sprite.scale.x, sprite.alpha, angle]);
    const initial = pose();
    hidden = true;
    now += 10000;
    tick!();
    expect(pose()).toEqual(initial);
    expect(tile._wildStarSystem).toBe(system);
    expect(system.lastUpdateTime).toBe(now);
    hidden = false;
    now += 40;
    tick!();
    expect(pose()).not.toEqual(initial);
    hidden = true;
    detachWildStarHalo(tile);
    expect(remove).toHaveBeenCalledWith(tick);
    expect(tile._wildStarSystem).toBeNull();
    expect(getAnimatedDiceHudForegroundStats().owners).toBe(0);
  } finally { detachWildStarHalo(tile); stage.destroy({ children: true }); resetAnimatedDiceHudForegroundForTests(); STATE.app = null; jest.restoreAllMocks(); }
});
