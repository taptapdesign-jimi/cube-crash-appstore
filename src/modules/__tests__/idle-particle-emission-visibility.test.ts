import fs from 'node:fs';
import ts from 'typescript';
import { Container } from 'pixi.js';
import { gsap } from 'gsap';
import { STATE } from '../app-state';
import animationManager from '../animation-manager';
import { graphicsPool } from '../object-pool';
import { getSpecialDiceVariantForTile } from '../special-dice-registry';
import { isSpecialDiceIdlePaintable, watchSpecialDiceIdleVisibility, getSpecialDiceIdleVisibilityStats } from '../special-dice-idle-visibility';

const parsed = ts.createSourceFile('fx.ts', fs.readFileSync('src/modules/fx.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['watchIdleParticleEmission', 'startMagnetIdleParticles', 'stopMagnetIdleParticles', 'startTntIdleParticles', 'stopTntIdleParticles', 'startFlowerPollenIdle', 'stopFlowerPollenIdle', 'releaseFlowerPollenParticle'];
const source = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
  .map(node => node.getText(parsed).replace(/^export /, '')).join('\n');

describe('idle particle interval ownership', () => {
  test.each([
    ['magnet', 'wild-magnet', undefined, 'startMagnetIdleParticles', 'stopMagnetIdleParticles', '_magnetIdleParticles', 350],
    ['TNT', 'wild-tnt', undefined, 'startTntIdleParticles', 'stopTntIdleParticles', '_tntIdleParticles', 200],
    ['Flower', 'wild-tnt', 'flower', 'startTntIdleParticles', 'stopTntIdleParticles', '_flowerPollenParticles', 760],
  ] as const)('%s stops timers and pauses owned particles while hidden, then resumes once', (_name, special, variant, start, stop, particleKey, cadence) => {
    let sequence = 0;
    const intervals = new Map<number, { callback: () => void; delay: number }>();
    const ticks = new Set<() => void>();
    const board = new Container(); const tile: any = board.addChild(new Container());
    tile.special = special; tile._ccSpecialDiceVariant = variant;
    STATE.app = { ticker: { add: (callback: () => void) => ticks.add(callback), remove: (callback: () => void) => ticks.delete(callback) } } as any;
    const previousState = (window as any).STATE;
    (window as any).STATE = { board };
    const dependencies = {
      gsap, animationManager, graphicsPool, getSpecialDiceVariantForTile, watchSpecialDiceIdleVisibility, isSpecialDiceIdlePaintable,
      __globalGraphicsObjects: new Set(), __tntIdleTiles: new Set(), __tntIdleParticles: new Set(),
      FLOWER_POLLEN_COLORS: [0xffcc00], FLOWER_POLLEN_SIZE_SCALE: 1.625,
      stopWildJuiceBubbles() {}, startWildJuiceBubbles() {}, centerInBoard: () => ({ x: 0, y: 0 }),
      trackAppInterval(callback: () => void, delay: number) { const id = ++sequence; intervals.set(id, { callback, delay }); return id; },
      clearAppInterval(id: number) { intervals.delete(id); },
      trackTimeline: (vars: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(vars)),
      magicSparklesAtTile(_board: any, currentTile: any, options: any) {
        const particle = graphicsPool.acquire(); board.addChild(particle);
        const key = options.trackKey || '_magnetIdleParticles';
        (currentTile[key] ??= []).push(particle);
        gsap.to(particle, { x: 10, duration: 10 });
      },
    };
    const owner = new Function(...Object.keys(dependencies), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
      + ';return {startMagnetIdleParticles, stopMagnetIdleParticles, startTntIdleParticles, stopTntIdleParticles};')(...Object.values(dependencies));
    const acquire = jest.spyOn(graphicsPool, 'acquire');
    try {
      owner[start](tile);
      expect(intervals.size).toBe(1);
      expect([...intervals.values()][0].delay).toBe(cadence);
      const particles = [...tile[particleKey]];
      const initialAllocations = acquire.mock.calls.length;
      expect(initialAllocations).toBeGreaterThan(0);
      const staleInterval = [...intervals.values()][0].callback;
      tile.alpha = 0; [...ticks].forEach(callback => callback());
      expect(intervals.size).toBe(0);
      expect(particles.every(particle => particle.renderable === false)).toBe(true);
      const ownedTweens = particles.flatMap(particle => gsap.getTweensOf([particle, particle.scale]));
      expect(ownedTweens.length).toBeGreaterThan(0);
      expect(ownedTweens.every(tween => tween.paused())).toBe(true);
      staleInterval();
      expect(acquire).toHaveBeenCalledTimes(initialAllocations);
      tile.alpha = 1; [...ticks].forEach(callback => callback());
      expect(intervals.size).toBe(1);
      expect(particles.every(particle => particle.renderable !== false)).toBe(true);
      owner[stop](tile); owner[stop](tile);
      staleInterval();
      expect(acquire).toHaveBeenCalledTimes(initialAllocations);
      expect(intervals.size).toBe(0);
      expect(ticks.size).toBe(0);
      expect(getSpecialDiceIdleVisibilityStats().owners).toBe(0);
    } finally {
      owner[stop](tile); board.destroy({ children: true }); STATE.app = null;
      (window as any).STATE = previousState; acquire.mockRestore();
    }
  });
});
