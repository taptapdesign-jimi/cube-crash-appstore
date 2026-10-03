import { Assets } from 'pixi.js';
import { SPECIAL_DICE_VARIANTS, type SpecialDiceVariantDefinition } from '../../modules/special-dice-registry';
import { VisualAssetBroker } from '../visual-asset-broker';

function makeTexture(label: string): any {
  return {
    label,
    destroyed: false,
    width: 128,
    height: 128,
    source: {
      destroyed: false,
      valid: true,
      width: 128,
      height: 128,
      resource: { width: 128, height: 128 },
      autoGarbageCollect: true,
    },
  };
}

function getVariantVisualSources(variant: SpecialDiceVariantDefinition): string[] {
  const lists = [
    variant.idleSpriteSources,
    variant.explosionSpriteSources,
    variant.finaleAccentSpriteSources,
    variant.orbitParticleSources,
    variant.burstParticleSources,
    variant.debrisSpriteSources,
  ];
  return [...new Set([variant.texture, ...lists.flatMap((sources) => sources ?? [])])];
}

afterEach(() => jest.restoreAllMocks());

test.each(Object.values(SPECIAL_DICE_VARIANTS).map((variant) => [variant.id, variant] as const))(
  '%s base/idle/finale carriers loaded before loss are reloaded on first later activation',
  async (_variantId, variant) => {
    const broker = new VisualAssetBroker();
    const sources = getVariantVisualSources(variant);
    const load = jest.spyOn(Assets, 'load').mockImplementation(async (path: any) => makeTexture(String(path)));
    const unload = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);

    const cachedBeforeLoss = await Promise.all(sources.map((source) => broker.acquireTexture(source)));
    expect(cachedBeforeLoss.every((handle) => broker.isHandleCurrent(handle))).toBe(true);
    broker.invalidateRendererGeneration('webglcontextlost');

    // This variant is absent during restore and activates only later. Every
    // source must cross the broker's new-generation unload/reload boundary.
    const laterActivation = await Promise.all(sources.map((source) => broker.acquireTexture(source)));

    expect(laterActivation.every((handle) => handle.rendererGeneration === 1)).toBe(true);
    expect(laterActivation.every((handle) => broker.isHandleCurrent(handle))).toBe(true);
    expect(unload).toHaveBeenCalledTimes(sources.length);
    sources.forEach((source) => expect(unload).toHaveBeenCalledWith(source));
    expect(load).toHaveBeenCalledTimes(sources.length * 2);
  },
);

test('core tile and Kanta spawned only after loss both receive current-generation handles', async () => {
  const broker = new VisualAssetBroker();
  const load = jest.spyOn(Assets, 'load').mockImplementation(async (path: any) => makeTexture(String(path)));
  const unload = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);

  broker.invalidateRendererGeneration('webglcontextlost');
  const core = await broker.acquireTexture('./assets/tile.png');
  const kanta = await broker.acquireTexture(SPECIAL_DICE_VARIANTS.kanta.texture);

  expect(core.rendererGeneration).toBe(1);
  expect(kanta.rendererGeneration).toBe(1);
  expect(broker.isHandleCurrent(core)).toBe(true);
  expect(broker.isHandleCurrent(kanta)).toBe(true);
  expect(unload).toHaveBeenCalledWith('./assets/tile.png');
  expect(unload).toHaveBeenCalledWith(SPECIAL_DICE_VARIANTS.kanta.texture);
  expect(load).toHaveBeenCalledTimes(2);
});

test('repeated context loss invalidates every earlier handle and reloads once per generation', async () => {
  const broker = new VisualAssetBroker();
  const load = jest.spyOn(Assets, 'load').mockImplementation(async (path: any) => makeTexture(String(path)));
  const unload = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined as any);
  const source = SPECIAL_DICE_VARIANTS.kanta.texture;

  const generationZero = await broker.acquireTexture(source);
  broker.invalidateRendererGeneration('first-loss');
  const generationOne = await broker.acquireTexture(source);
  broker.invalidateRendererGeneration('second-loss');
  const generationTwo = await broker.acquireTexture(source);

  expect(broker.isHandleCurrent(generationZero)).toBe(false);
  expect(broker.isHandleCurrent(generationOne)).toBe(false);
  expect(broker.isHandleCurrent(generationTwo)).toBe(true);
  expect(generationTwo.rendererGeneration).toBe(2);
  expect(unload).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenCalledTimes(3);
});
