import { Container, Point, Sprite, Texture } from 'pixi.js';
import { STATE } from '../app-state';
import { createWildStarOrbitForeground } from '../wild-star-orbit-foreground';
import { getAnimatedDiceHudForegroundStats, mountAnimatedDiceAboveHud, releaseAnimatedDiceAboveHud, resetAnimatedDiceHudForegroundForTests } from '../animated-dice-hud-foreground';

afterEach(() => { resetAnimatedDiceHudForegroundForTests(); STATE.app = null; });

test('renders original orbit ahead of foreground Wild Star while retaining drag geometry and intro scale', () => {
  const stage = new Container();
  STATE.app = { stage } as any;
  const board = stage.addChild(new Container());
  board.position.set(24, 136);
  board.scale.set(0.475);
  const host = board.addChild(new Container());
  host.position.set(120, 200);
  host.rotation = 0.2;
  const artwork = host.addChild(new Sprite(Texture.WHITE));
  artwork.zIndex = 1000;
  const artOwner = {};
  mountAnimatedDiceAboveHud(artOwner, artwork, host);
  const orbit = host.addChild(new Container());
  const reference = host.addChild(new Container());
  for (const container of [orbit, reference]) {
    container.position.set(3, -4);
    container.scale.set(0.7, 1.1);
  }
  const star = orbit.addChild(new Sprite(Texture.WHITE));
  const owner = createWildStarOrbitForeground(orbit, host, artwork.zIndex)!;
  const wrapper = orbit.parent!;
  const layer = artwork.parent!;
  layer.sortChildren();
  expect(wrapper.parent).toBe(layer);
  expect(layer.getChildIndex(wrapper)).toBeGreaterThan(layer.getChildIndex(artwork));
  expect(orbit.children[0]).toBe(star);
  const compare = () => {
    for (const point of [new Point(), new Point(30, 10)]) {
      const actual = orbit.toGlobal(point);
      const expected = reference.toGlobal(point);
      expect(actual.x).toBeCloseTo(expected.x, 5);
      expect(actual.y).toBeCloseTo(expected.y, 5);
    }
  };
  compare();
  const drag = stage.addChild(new Container());
  drag.rotation = -0.3;
  drag.scale.set(0.8);
  drag.reparentChild(host);
  host.position.set(160, 360);
  orbit.scale.set(1.2, 0.9);
  reference.scale.set(1.2, 0.9);
  owner.sync();
  compare();
  host.alpha = 0.4;
  drag.alpha = 0.5;
  owner.sync();
  expect(wrapper.alpha).toBeCloseTo(0.2);
  host.visible = false;
  owner.sync();
  expect(wrapper.visible).toBe(false);
  host.visible = true;
  owner.sync();
  expect(wrapper.visible).toBe(true);
  host.removeFromParent();
  owner.sync();
  expect(wrapper.visible).toBe(false);
  drag.addChild(host);
  owner.sync();
  expect(wrapper.visible).toBe(true);
  compare();
  owner.release();
  owner.release();
  expect(orbit.parent).toBe(host);
  compare();
  expect(getAnimatedDiceHudForegroundStats().owners).toBe(1);
  expect(star.destroyed).toBe(false);
  releaseAnimatedDiceAboveHud(artOwner);
  expect(getAnimatedDiceHudForegroundStats().owners).toBe(0);
  stage.destroy({ children: true });
});

test('without a live stage, leaves the existing orbit under its host', () => {
  const host = new Container();
  const orbit = host.addChild(new Container());
  expect(createWildStarOrbitForeground(orbit, host, 0)).toBeNull();
  expect(host.children).toEqual([orbit]);
  host.destroy({ children: true });
});
