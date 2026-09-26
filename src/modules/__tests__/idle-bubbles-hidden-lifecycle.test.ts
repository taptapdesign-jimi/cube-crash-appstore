import fs from 'node:fs';
import ts from 'typescript';
import { Container } from 'pixi.js';
import { gsap } from 'gsap';
import animationManager from '../animation-manager';
import { STATE } from '../app-state';
import { graphicsPool } from '../object-pool';
import { getSpecialDiceIdleBubbleColors, getSpecialDiceVariantForTile } from '../special-dice-registry';
import { createSpecialIdleAnimationVisibility, getSpecialDiceIdleVisibilityStats, isSpecialDiceIdlePaintable } from '../special-dice-idle-visibility';

const source = ts.createSourceFile('fx.ts', fs.readFileSync('src/modules/fx.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['startWildJuiceBubbles', 'stopWildJuiceBubbles'];
const declarations = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
  .map(node => node.getText(source).replace(/^export /, '')).join('\n');
const systems = new Map();
const dependencies = {
  Container, gsap, animationManager, graphicsPool, getSpecialDiceIdleBubbleColors, getSpecialDiceVariantForTile,
  createSpecialIdleAnimationVisibility, isSpecialDiceIdlePaintable, wildJuiceBubbleSystems: systems,
  releaseJuiceBounceFrontBubbles() {}, releaseBallBouncyFrontBubbles() {},
  trackTween: (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars)),
  trackDelayedCall: (delay: number, callback: () => void) => animationManager.trackExternalTween(gsap.delayedCall(delay, callback)),
};
const owner = new Function(...Object.keys(dependencies), ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  + ';return {startWildJuiceBubbles, stopWildJuiceBubbles};')(...Object.values(dependencies));

describe('real Beach/Honey idle bubble owner hidden lifecycle', () => {
  let ticks: Set<() => void>;
  beforeEach(() => {
    ticks = new Set();
    STATE.app = { ticker: { add: (fn: () => void) => ticks.add(fn), remove: (fn: () => void) => ticks.delete(fn) } } as any;
  });
  afterEach(() => {
    [...systems.keys()].forEach(owner.stopWildJuiceBubbles);
    STATE.app = null;
    expect(ticks.size).toBe(0);
    expect(getSpecialDiceIdleVisibilityStats().owners).toBe(0);
  });
  test.each([
    [undefined, 'wild-juice'], ['fish', 'wild'], ['beach-ball', 'wild-tnt'], ['bottle', 'wild-magnet'], ['honey', 'wild-magnet'],
  ])('%s pauses its spawn/paint work, resumes once and cancels stale completion', (variant, special) => {
    const stage = new Container();
    const tile: any = stage.addChild(new Container());
    tile.rotG = tile.addChild(new Container()); tile.special = special; tile._ccSpecialDiceVariant = variant;
    const acquire = jest.spyOn(graphicsPool, 'acquire');
    try {
      owner.startWildJuiceBubbles(tile);
      const system = tile._wildJuiceBubbleSystem;
      expect(acquire).toHaveBeenCalledTimes(1);
      tile.alpha = 0;
      [...ticks].forEach(fn => fn());
      expect(system.spawnInterval.paused()).toBe(true);
      expect([...system.activeTweens].every((tween: any) => tween.paused())).toBe(true);
      // A delivered stale callback cannot allocate even before cleanup reaches it.
      system.spawnInterval.eventCallback('onComplete')();
      expect(acquire).toHaveBeenCalledTimes(1);
      expect(system.spawnInterval.paused()).toBe(true);
      tile.alpha = 1;
      [...ticks].forEach(fn => fn());
      expect(system.spawnInterval.paused()).toBe(false);
      const staleSpawn = system.spawnInterval.eventCallback('onComplete');
      staleSpawn();
      expect(acquire).toHaveBeenCalledTimes(2);
      owner.stopWildJuiceBubbles(tile);
      staleSpawn();
      owner.stopWildJuiceBubbles(tile);
      expect(acquire).toHaveBeenCalledTimes(2);
      expect(systems.size).toBe(0);
      expect(ticks.size).toBe(0);
    } finally { owner.stopWildJuiceBubbles(tile); stage.destroy({ children: true }); acquire.mockRestore(); }
  });
});
