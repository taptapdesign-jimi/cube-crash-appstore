import fs from 'node:fs';
import ts from 'typescript';
import { gsap } from 'gsap';
import { getOrganicRadialSmokeLayout, getSmokeCloudParticleAlpha, getWildSpawnLandingSmokeProfile } from '../gameplay-fx-profile';

class Display {
  children: Display[] = [];
  parent: Display | null = null;
  alpha = 1;
  x = 0;
  y = 0;
  zIndex = 0;
  blendMode = 'normal';
  destroyed = false;
  scale = { x: 1, y: 1, set: (n: number) => { this.scale.x = this.scale.y = n; } };
  clear() { return this; }
  circle() { return this; }
  ellipse() { return this; }
  fill() { return this; }
  addChild(child: Display) { child.parent = this; this.children.push(child); return child; }
  addChildAt(child: Display, index: number) { child.parent = this; this.children.splice(index, 0, child); return child; }
  removeChild(child: Display) { this.children = this.children.filter((c) => c !== child); child.parent = null; }
}

const source = ts.createSourceFile('fx.ts', fs.readFileSync('src/modules/fx.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const node = source.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'smokeBubblesAtTile')!;
const code = ts.transpileModule(node.getText(source).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function makeSmoke(options: Record<string, unknown>) {
  const roots: gsap.core.Timeline[] = [];
  const released: Display[] = [];
  const board = new Display();
  const tile = { zIndex: 4 };
  let ttl = 0;
  const deps = {
    Container: Display,
    gsap,
    trackTimeline: (opts = {}) => { const tl = gsap.timeline({ ...opts, paused: true }); roots.push(tl); return tl; },
    trackTween: (target: object, vars: gsap.TweenVars) => { const tl = gsap.timeline({ paused: true }).to(target, vars); roots.push(tl); return tl; },
    centerInBoard: () => ({ x: 100, y: 100 }),
    autoAdd: (parent: Display, child: Display, lifetime: number) => { ttl = lifetime; parent.addChild(child); },
    getFxHotFactor: () => 1,
    graphicsPool: { acquire: () => new Display(), release: (puff: Display) => released.push(puff) },
    getOrganicRadialSmokeLayout,
    getSmokeCloudParticleAlpha,
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
  };
  const smoke = new Function(...Object.keys(deps), `${code}; return smokeBubblesAtTile;`)(...Object.values(deps));
  smoke(board, tile, 100, 1.35, options);
  const layer = board.children[0];
  const puffs = layer.children.slice(1); // Halo is inserted behind all puffs.
  return { layer, puffs, roots, released, ttl, tick: (time: number) => roots.forEach((tl) => tl.totalTime(time, false)) };
}

afterEach(() => { gsap.globalTimeline.clear(); });

test('landing cloud fades in over multiple rendered frames instead of an additive first-frame flash', () => {
  const fx = makeSmoke(getWildSpawnLandingSmokeProfile());
  expect(fx.layer.zIndex).toBeLessThan(4);
  expect(fx.puffs.length).toBeGreaterThan(30);
  expect(fx.puffs.every((p) => p.alpha === 0 && p.blendMode === 'normal')).toBe(true);
  fx.tick(1 / 60);
  const firstFrameAlpha = Math.max(...fx.puffs.map((p) => p.alpha));
  expect(firstFrameAlpha).toBeGreaterThan(0);
  expect(firstFrameAlpha).toBeLessThan(0.15);
  fx.tick(0.18);
  expect(Math.max(...fx.puffs.map((p) => p.alpha))).toBeGreaterThan(firstFrameAlpha * 2);
  expect(fx.roots).toHaveLength(1);
});

test('the complete landing fade finishes and releases all pooled puffs before layer expiry', () => {
  const fx = makeSmoke(getWildSpawnLandingSmokeProfile());
  const count = fx.layer.children.length;
  fx.tick(fx.ttl - 0.01);
  expect(fx.layer.children).toHaveLength(0);
  expect(fx.released).toHaveLength(count);
  expect(new Set(fx.released).size).toBe(count);
});

test('ordinary smoke keeps its existing quick impact timing and additive appearance', () => {
  const fx = makeSmoke({ groupedOwner: true });
  expect(fx.puffs.every((p) => p.blendMode === 'add')).toBe(true);
  fx.tick(1 / 60);
  expect(Math.max(...fx.puffs.map((p) => p.alpha))).toBeGreaterThan(0.4);
});
