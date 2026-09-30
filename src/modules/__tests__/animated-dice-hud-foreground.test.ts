import { Container, Matrix, Point, Sprite, Texture, TextureSource } from 'pixi.js';
import { STATE } from '../app-state';
import {
  getAnimatedDiceHudForegroundStats,
  mountAnimatedDiceAboveHud,
  releaseAnimatedDiceAboveHud,
  resetAnimatedDiceHudForegroundForTests,
  syncAnimatedDiceAboveHud,
} from '../animated-dice-hud-foreground';

const samplePoints = [new Point(0, 0), new Point(100, 0), new Point(0, 100)];

function expectSameGeometry(actual: Container, reference: Container): void {
  for (const point of samplePoints) {
    const expected = reference.toGlobal(point);
    const received = actual.toGlobal(point);
    expect(received.x).toBeCloseTo(expected.x, 5);
    expect(received.y).toBeCloseTo(expected.y, 5);
  }
}

afterEach(() => {
  resetAnimatedDiceHudForegroundForTests();
  STATE.app = null;
});

test.each(['scaled-sheet', 'anchored-sheet', 'offset-container'])('%s preserves native Pixi geometry through board motion and drag reparenting', (shape) => {
  const stage = new Container();
  stage.position.set(11, 18);
  stage.scale.set(0.9);
  STATE.app = { stage } as any;
  const board = stage.addChild(new Container());
  board.position.set(30, 140);
  board.scale.set(0.46);
  const tile = board.addChild(new Container());
  tile.position.set(530, 240);
  tile.rotation = 0.15;
  tile.scale.set(0.8, 1.1);
  const host = tile.addChild(new Container());
  host.position.set(4, -6);
  host.rotation = -0.3;
  const actual = host.addChild(new Sprite(Texture.WHITE));
  const reference = host.addChild(new Sprite(Texture.WHITE));
  for (const sprite of [actual, reference]) {
    sprite.position.set(shape === 'offset-container' ? -94 : 0, shape === 'offset-container' ? -88 : 0);
    sprite.scale.set(shape === 'scaled-sheet' ? 0.59 : 1.18);
    if (shape === 'anchored-sheet') sprite.anchor.set(0.4, 0.8);
  }
  const owner = {};
  expect(mountAnimatedDiceAboveHud(owner, actual, host)).toBe(true);
  expectSameGeometry(actual, reference);
  board.scale.set(0.7);
  tile.position.set(280, 900);
  host.rotation = 0.6;
  syncAnimatedDiceAboveHud(owner);
  expectSameGeometry(actual, reference);

  const dragLayer = stage.addChild(new Container());
  dragLayer.position.set(20, -40);
  dragLayer.scale.set(0.6, 0.8);
  dragLayer.rotation = -0.2;
  dragLayer.reparentChild(tile);
  tile.position.set(150, 250);
  syncAnimatedDiceAboveHud(owner);
  expectSameGeometry(actual, reference);
  // Repeated mount must retain the original local geometry, not capture the portal transform.
  mountAnimatedDiceAboveHud(owner, actual, host);
  expectSameGeometry(actual, reference);
  releaseAnimatedDiceAboveHud(owner);
  expect(getAnimatedDiceHudForegroundStats()).toEqual({ owners: 0, attached: false });
});

test('iPhone 390px board keeps top-row artwork onscreen and above the HUD', () => {
  const stage = new Container();
  STATE.app = { stage } as any;
  const board = stage.addChild(new Container());
  board.position.set(24, 136);
  board.scale.set(0.475);
  const hud = stage.addChild(new Container());
  hud.zIndex = 10000;
  const host = board.addChild(new Container());
  host.position.set(648, 72);
  const actual = host.addChild(new Sprite(Texture.WHITE));
  const reference = host.addChild(new Sprite(Texture.WHITE));
  for (const sprite of [actual, reference]) {
    sprite.width = 160;
    sprite.height = 180;
    sprite.anchor.set(0.5, 0.8);
  }
  mountAnimatedDiceAboveHud({}, actual, host);
  expectSameGeometry(actual, reference);
  expect(actual.getBounds().minX).toBeGreaterThan(0);
  expect(actual.getBounds().maxX).toBeLessThan(390);
  expect(stage.getChildIndex(actual.parent!)).toBeGreaterThan(stage.getChildIndex(hud));
});

test('releasing one owner preserves the other and the last release retains shared textures', () => {
  const stage = new Container();
  STATE.app = { stage } as any;
  const host = stage.addChild(new Container());
  const owners = [{}, {}];
  const sprites = owners.map((owner) => {
    const sprite = host.addChild(new Sprite(Texture.WHITE));
    mountAnimatedDiceAboveHud(owner, sprite, host);
    return sprite;
  });
  releaseAnimatedDiceAboveHud(owners[0]);
  sprites[0].destroy();
  expect(getAnimatedDiceHudForegroundStats()).toEqual({ owners: 1, attached: true });
  expect(sprites[1].parent?.destroyed).toBe(false);
  releaseAnimatedDiceAboveHud(owners[1]);
  expect(sprites[1].destroyed).toBe(false);
  expect(Texture.WHITE.destroyed).toBe(false);
  expect(getAnimatedDiceHudForegroundStats()).toEqual({ owners: 0, attached: false });
});

test('refuses to draw a source host detached from the live stage', () => {
  const stage = new Container();
  STATE.app = { stage } as any;
  const board = stage.addChild(new Container());
  const host = board.addChild(new Container());
  const sprite = host.addChild(new Sprite(Texture.WHITE));
  const owner = {};

  expect(mountAnimatedDiceAboveHud(owner, sprite, host)).toBe(true);
  stage.removeChild(board);
  expect(syncAnimatedDiceAboveHud(owner)).toBe(false);
  expect(sprite.visible).toBe(false);
  expect(sprite.renderable).toBe(false);
});

test('does not portal a pre-stage special die at raw size before board scale exists', () => {
  const stage = new Container();
  STATE.app = { stage } as any;
  const board = new Container();
  board.scale.set(0.475);
  const host = board.addChild(new Container());
  const sprite = host.addChild(new Sprite(Texture.WHITE));
  sprite.width = 160;
  sprite.height = 180;
  const owner = {};

  expect(mountAnimatedDiceAboveHud(owner, sprite, host)).toBe(false);
  expect(sprite.parent).toBe(host);
  expect(getAnimatedDiceHudForegroundStats()).toEqual({ owners: 0, attached: false });

  stage.addChild(board);
  expect(mountAnimatedDiceAboveHud(owner, sprite, host)).toBe(true);
  expect(sprite.getBounds().width).toBeCloseTo(76, 5);
});

test('repairs the board scale when a sheet frame swap resets the foreground sprite scale', () => {
  const stage = new Container();
  STATE.app = { stage } as any;
  const board = stage.addChild(new Container());
  board.scale.set(0.475);
  const host = board.addChild(new Container());
  const first = new Texture({
    source: new TextureSource({ resource: { width: 160, height: 180 } as any, width: 160, height: 180 }),
  });
  const next = new Texture({
    source: new TextureSource({ resource: { width: 160, height: 180 } as any, width: 160, height: 180 }),
  });
  const sprite = host.addChild(new Sprite(first));
  sprite.width = 160;
  sprite.height = 180;
  const owner = {};

  expect(mountAnimatedDiceAboveHud(owner, sprite, host)).toBe(true);
  expect(sprite.getBounds().width).toBeCloseTo(76, 5);

  sprite.texture = next;
  expect(sprite.getBounds().width).toBeCloseTo(160, 5);
  expect(syncAnimatedDiceAboveHud(owner)).toBe(true);
  expect(sprite.getBounds().width).toBeCloseTo(76, 5);

  releaseAnimatedDiceAboveHud(owner);
  first.destroy(true);
  next.destroy(true);
});

test('reuses clean source and shared-layer transforms without recomposing or rewriting the sprite', () => {
  const stage = new Container();
  STATE.app = { stage } as any;
  const board = stage.addChild(new Container());
  board.position.set(24, 136);
  board.scale.set(0.475);
  const host = board.addChild(new Container());
  host.position.set(200, 320);
  const sprite = host.addChild(new Sprite(Texture.WHITE));
  const owner = {};

  expect(mountAnimatedDiceAboveHud(owner, sprite, host)).toBe(true);
  const prepend = jest.spyOn(Matrix.prototype, 'prepend');
  const invert = jest.spyOn(Matrix.prototype, 'invert');
  const setFromMatrix = jest.spyOn(sprite, 'setFromMatrix');

  for (let tick = 0; tick < 100; tick += 1) {
    expect(syncAnimatedDiceAboveHud(owner)).toBe(true);
  }
  expect(prepend).not.toHaveBeenCalled();
  expect(invert).not.toHaveBeenCalled();
  expect(setFromMatrix).not.toHaveBeenCalled();

  board.x += 12;
  expect(syncAnimatedDiceAboveHud(owner)).toBe(true);
  expect(prepend).toHaveBeenCalled();
  expect(setFromMatrix).toHaveBeenCalledTimes(1);
});

test('reuses Pixi actual matrix after rotated non-uniform decompose round-trip', () => {
  const stage = new Container();
  STATE.app = { stage } as any;
  const board = stage.addChild(new Container());
  board.setFromMatrix(new Matrix(0.62, 0.17, -0.23, 0.71, 24, 136));
  const host = board.addChild(new Container());
  host.position.set(200, 320);
  const sprite = host.addChild(new Sprite(Texture.WHITE));
  const owner = {};

  expect(mountAnimatedDiceAboveHud(owner, sprite, host)).toBe(true);
  const setFromMatrix = jest.spyOn(sprite, 'setFromMatrix');
  for (let tick = 0; tick < 100; tick += 1) {
    expect(syncAnimatedDiceAboveHud(owner)).toBe(true);
  }
  expect(setFromMatrix).not.toHaveBeenCalled();
});
