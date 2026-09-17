import { Assets, Container, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { applyWildSkinLocalCore } from '../app-core-wild-skin';
import { getSpecialDiceFaceAnchorY } from '../special-dice-registry';
import { KANTA_IDLE_FRAME_SOURCE } from '../kanta-dice-idle';
import { stopSpecialDiceIdleMotion } from '../special-dice-idle';
import animationManager from '../animation-manager';
import { STATE } from '../app-state';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function fixture() {
  const texture = new Texture({ source: new TextureSource({ resource: { width: 128, height: 171 }, width: 128, height: 171 }) });
  const idleLoad = deferred<Texture>();
  const skinLoad = deferred<Texture>();
  jest.spyOn(Assets, 'load').mockImplementation(((source: string) => source === KANTA_IDLE_FRAME_SOURCE ? idleLoad.promise : Promise.resolve(texture)) as any);
  const base = new Sprite(texture);
  base.anchor.set(0.5);
  const rotG = new Container(); rotG.addChild(base);
  const tile: any = { base, rotG, special: 'wild', _ccSpecialDiceVariant: 'kanta', destroyed: false };
  const noOp = () => {};
  const deps = {
    Assets: { get: () => texture, load: () => skinLoad.promise }, Texture, Rectangle,
    ASSET_WILD: 'wild', ASSET_WILD_MAGNET: 'magnet', ASSET_WILD_JUICE: 'juice', ASSET_WILD_TNT: 'tnt', TILE: 128,
    startWildShimmer: noOp, startWildJuiceBubbles: noOp, startWildStars: noOp, startMagnetIdleParticles: noOp,
    startTntIdleParticles: noOp, startTntIdleShake: noOp, stopTntIdleParticles: noOp, stopTntIdleShake: noOp,
    trackAppAnimationFrame: noOp, devWarn: noOp,
  };
  return { tile, base, texture, idleLoad, skinLoad, deps };
}

beforeEach(() => { STATE.app = null; });
afterEach(() => { animationManager.killAll(); STATE.app = null; });

test.each(['skin-first', 'idle-first'])('real deferred skin assignment preserves the live Kanta pivot (%s)', async (order) => {
  const h = fixture();
  applyWildSkinLocalCore(h.tile, h.deps);
  const controller = h.tile._ccKantaDiceIdle;
  expect(controller).toBeTruthy();
  const assertCentered = () => {
    expect(h.base.anchor.y).toBe(1);
    expect(h.base.y).toBe(64);
    expect(h.base.y + (0.5 - h.base.anchor.y) * h.base.height).toBeCloseTo(0);
    expect(h.tile.hitArea).toMatchObject({ x: -64, y: -64, width: 128, height: 128 });
  };
  assertCentered();
  const first = order === 'skin-first' ? h.skinLoad : h.idleLoad;
  const second = order === 'skin-first' ? h.idleLoad : h.skinLoad;
  first.resolve(h.texture); await flush(); assertCentered();
  second.resolve(h.texture); await flush(); assertCentered();
  // A later repair/repaint uses the same helper and cannot steal the live pivot.
  applyWildSkinLocalCore(h.tile, h.deps); await flush(); assertCentered();
  expect(h.tile._ccKantaDiceIdle).toBe(controller);
  stopSpecialDiceIdleMotion(h.tile);
  expect(h.base.anchor.y).toBe(0.5);
  expect(h.base.y).toBe(0);
  expect(getSpecialDiceFaceAnchorY(h.tile, h.base)).toBe(0.5);
});

test('disposed or different-base owners cannot impose the Kanta pivot on a repaired sprite', async () => {
  const h = fixture();
  expect(getSpecialDiceFaceAnchorY(h.tile, h.base)).toBe(0.5);
  applyWildSkinLocalCore(h.tile, h.deps);
  const controller = h.tile._ccKantaDiceIdle;
  const replacement = new Sprite(h.texture);
  expect(getSpecialDiceFaceAnchorY(h.tile, replacement)).toBe(0.5);
  controller.dispose(); // Deliberately retain stale tile reference to the disposed owner.
  expect(getSpecialDiceFaceAnchorY(h.tile, h.base)).toBe(0.5);
  h.skinLoad.resolve(h.texture); h.idleLoad.resolve(h.texture); await flush();
  expect(h.base.anchor.y).toBe(0.5);
  expect(h.base.y).toBe(0);
  stopSpecialDiceIdleMotion(h.tile);
});

test('shared helper preserves Bottle live ownership and unrelated authored/default anchors', () => {
  const base = {};
  const bottle: any = { _ccSpecialDiceVariant: 'bottle', _ccSpecialDiceIdleHost: base, _ccSpecialDiceIdleTl: {} };
  expect(getSpecialDiceFaceAnchorY(bottle, base)).toBe(1);
  expect(getSpecialDiceFaceAnchorY(bottle, {})).toBe(0.5);
  bottle._ccSpecialDiceIdleTl = null;
  expect(getSpecialDiceFaceAnchorY(bottle, base)).toBe(0.5);
  expect(getSpecialDiceFaceAnchorY({ _ccSpecialDiceVariant: 'barell' }, base)).toBe(221 / 351);
  expect(getSpecialDiceFaceAnchorY({ _ccSpecialDiceVariant: 'kanta' }, base, 0.4)).toBe(0.4);
  expect(getSpecialDiceFaceAnchorY({}, base, 0.4)).toBe(0.4);
});
