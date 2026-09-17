import fs from 'node:fs';
import ts from 'typescript';
import { Container, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import animationManager from '../animation-manager';
import { startSpecialDiceIdleMotion, stopSpecialDiceIdleMotion } from '../special-dice-idle';
import gsap from 'gsap';
import { destroyRuntimeTexture } from '../runtime-texture-lifecycle';
const fx = ts.createSourceFile('fx.ts', fs.readFileSync('src/modules/fx.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['stopWildIdle', 'stopWildJuiceBubbles', 'stopTntIdleParticles', 'stopTntIdleShake'];
const declarations = fx.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || '')).map((node) => node.getText(fx).replace(/^export /, '')).join('\n');
const params = { animationManager, gsap, destroyRuntimeTexture, stopWildStars() {}, releaseJuiceBounceFrontBubbles() {}, releaseBallBouncyFrontBubbles() {}, wildJuiceBubbleSystems: new Map(), stopFlowerPollenIdle() {}, __tntIdleTiles: new Set() };
const { stopWildIdle, stopWildJuiceBubbles, stopTntIdleParticles, stopTntIdleShake } = new Function(...Object.keys(params), ts.transpileModule(declarations, {}).outputText + '\nreturn { ' + names.join(', ') + ' };')(...Object.values(params));

const source = fs.readFileSync('src/modules/app-core.ts', 'utf8');
const body = source.slice(source.indexOf('function stopFinalResidualTargetIdleFx('), source.indexOf('function normalizeFinalMerge6ResidueVisuals('));
const dependencies = {
  stopWildIdle, stopWildJuiceBubbles, stopTntIdleParticles, stopTntIdleShake,
  stopSpecialDiceIdleMotion, TILE_IDLE_BOUNCE: { stopForTile() {} },
  trackAppAnimationFrame() {}, trackAppTimeout() {}, devLog() {},
};
const { stopFinalResidualTargetIdleFx, hideFinalMergeResultTileVisual } = new Function(
  ...Object.keys(dependencies),
  ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    + '\nreturn { stopFinalResidualTargetIdleFx, hideFinalMergeResultTileVisual };',
)(...Object.values(dependencies));

function makeOwner() {
  const callbacks = new Set<Function>();
  STATE.app = { ticker: {
    add(fn: Function) { callbacks.add(fn); }, remove(fn: Function) { callbacks.delete(fn); },
  } } as any;
  const rotG = new Container();
  const base = new Sprite(Texture.WHITE);
  rotG.addChild(base);
  const tile: any = { base, rotG, destroyed: false, visible: true, renderable: true, alpha: 1,
    _ccSpecialDiceVariant: 'kanta' };
  const timelines = animationManager.getStats().activeTimelines;
  startSpecialDiceIdleMotion(tile);
  expect(callbacks.size).toBe(1);
  return { tile, callbacks, timelines, cleanup() {
    stopSpecialDiceIdleMotion(tile);
    STATE.app = null;
    rotG.destroy({ children: true });
  } };
}

describe('terminal residual special-artwork ownership', () => {
  test.each(['visible', 'renderable', 'alpha', 'base'])('retires an owner hidden through %s immediately', (hidden) => {
    const owner = makeOwner();
    try {
      if (hidden === 'base') owner.tile.base.visible = false;
      else owner.tile[hidden] = hidden === 'alpha' ? 0 : false;
      stopFinalResidualTargetIdleFx(owner.tile);
      expect(owner.tile._ccKantaDiceIdle).toBeUndefined();
      expect(owner.callbacks.size).toBe(0);
      expect(animationManager.getStats().activeTimelines).toBe(owner.timelines);
    } finally { owner.cleanup(); }
  });

  test('preserves visible residual artwork through pop-out, including an animation-hidden base', () => {
    const owner = makeOwner();
    try {
      owner.tile.base.renderable = false;
      const controller = owner.tile._ccKantaDiceIdle;
      stopFinalResidualTargetIdleFx(owner.tile);
      expect(owner.tile._ccKantaDiceIdle).toBe(controller);
      expect(owner.callbacks.size).toBe(1);
      expect(owner.tile.base.renderable).toBe(false);
      // The terminal hide boundary now retires the same owner synchronously.
      hideFinalMergeResultTileVisual(owner.tile, 'test');
      expect(owner.tile.base.visible).toBe(false);
      expect(owner.tile._ccKantaDiceIdle).toBeUndefined();
      expect(owner.callbacks.size).toBe(0);
      expect(animationManager.getStats().activeTimelines).toBe(owner.timelines);
      hideFinalMergeResultTileVisual(owner.tile, 'repeat');
      expect(owner.tile.base.visible).toBe(false);
    } finally { owner.cleanup(); }
  });
});
