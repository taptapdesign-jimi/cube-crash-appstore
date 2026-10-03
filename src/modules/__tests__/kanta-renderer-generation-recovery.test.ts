import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';
import animationManager from '../animation-manager';
import { STATE } from '../app-state';
import {
  KANTA_IDLE_BACK_LEFT_SOURCE,
  KANTA_IDLE_FRAME_SOURCE,
  startKantaDiceIdle,
} from '../kanta-dice-idle';
import {
  invalidateVisualAssetRendererGeneration,
  visualAssetBroker,
} from '../../utils/visual-asset-broker';

function texture(label: string): Texture {
  const value = new Texture({
    source: new TextureSource({
      resource: { width: 128, height: 171 },
      width: 128,
      height: 171,
    }),
  });
  value.label = label;
  return value;
}

function kantaFixture(baseTexture: Texture) {
  const parent = new Container();
  parent.sortableChildren = true;
  const base = new Sprite(baseTexture);
  base.anchor.set(0.5);
  base.width = 96;
  base.height = 128;
  parent.addChild(base);
  const tile: any = {
    base,
    rotG: parent,
    special: 'wild',
    _ccSpecialDiceVariant: 'kanta',
    destroyed: false,
    visible: true,
    renderable: true,
    alpha: 1,
  };
  const controller = startKantaDiceIdle(tile, [
    KANTA_IDLE_FRAME_SOURCE,
    KANTA_IDLE_BACK_LEFT_SOURCE,
  ], { width: 96, height: 128 });
  tile._ccKantaDiceIdle = controller;
  return { tile, parent, base, controller: controller! };
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

beforeEach(() => {
  STATE.app = null;
  visualAssetBroker.resetForTests();
});

afterEach(() => {
  animationManager.killAll();
  STATE.app = null;
  visualAssetBroker.resetForTests();
  jest.restoreAllMocks();
});

test('Kanta front and rear idle artwork reload after a renderer generation change', async () => {
  const holder = texture('holder');
  const staleFront = texture('stale-front');
  const staleRear = texture('stale-rear');
  const freshFront = texture('fresh-front');
  const freshRear = texture('fresh-rear');
  const loadsByPath = new Map<string, number>();
  const load = jest.spyOn(Assets, 'load').mockImplementation(((source: string) => {
    const count = (loadsByPath.get(source) || 0) + 1;
    loadsByPath.set(source, count);
    if (source === KANTA_IDLE_FRAME_SOURCE) {
      return Promise.resolve(count === 1 ? staleFront : freshFront);
    }
    if (source === KANTA_IDLE_BACK_LEFT_SOURCE) {
      return Promise.resolve(count === 1 ? staleRear : freshRear);
    }
    return Promise.reject(new Error(`unexpected asset ${source}`));
  }) as any);
  const unload = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);

  const beforeLoss = kantaFixture(holder);
  await flushPromises();
  expect(beforeLoss.base.texture).toBe(staleFront);
  expect(beforeLoss.parent.children.find((child) => child.label === 'kanta-idle-back'))
    .toMatchObject({ texture: staleRear });
  beforeLoss.controller.dispose();

  invalidateVisualAssetRendererGeneration('webglcontextlost');
  const afterRestore = kantaFixture(holder);
  await flushPromises();

  expect(unload).toHaveBeenCalledTimes(2);
  expect(unload).toHaveBeenCalledWith(KANTA_IDLE_FRAME_SOURCE);
  expect(unload).toHaveBeenCalledWith(KANTA_IDLE_BACK_LEFT_SOURCE);
  expect(load).toHaveBeenCalledTimes(4);
  expect(afterRestore.base.texture).toBe(freshFront);
  expect(afterRestore.parent.children.find((child) => child.label === 'kanta-idle-back'))
    .toMatchObject({ texture: freshRear });

  afterRestore.controller.dispose();
});
