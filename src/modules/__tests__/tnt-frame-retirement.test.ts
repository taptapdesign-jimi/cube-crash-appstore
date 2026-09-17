import fs from 'node:fs';
import path from 'node:path';
import { Assets, type Texture } from 'pixi.js';
import { preloadTntFrames, retireTntFrameCache } from '../tnt-animation';

const flower = './assets/shop/bush/bush1@2x.png';
const burst = './assets/shop/bush/flowr1@2x.png';
const texture = { source: { style: {} } } as Texture;

describe('actual TNT preload and retirement owner', () => {
  test('retires finale frames and burst, protects shared dice, then really reloads on reentry', async () => {
    const resident = new Map<string, Texture>();
    jest.spyOn(Assets, 'get').mockImplementation((source) => resident.get(String(source)));
    const load = jest.spyOn(Assets, 'load').mockImplementation(async (source) => {
      resident.set(String(source), texture);
      return texture;
    });
    const unload = jest.spyOn(Assets, 'unload').mockImplementation(async (source) => {
      resident.delete(String(source));
    });
    const options = { frameSources: [flower], burstSources: [burst], diceDebris: true };
    await preloadTntFrames(options);
    expect(resident.has(flower)).toBe(true);
    await retireTntFrameCache();
    expect(unload.mock.calls.map(([source]) => source).sort()).toEqual([flower, burst].sort());
    expect(resident.size).toBe(1);
    await preloadTntFrames(options);
    expect(load.mock.calls.filter(([source]) => String(source) === flower)).toHaveLength(2);
    expect(load.mock.calls.filter(([source]) => String(source) === burst)).toHaveLength(2);
    await retireTntFrameCache();
  });

  test('a failed frame cannot let exit miss another frame still decoding', async () => {
    let finish!: (value: Texture) => void;
    const late = new Promise<Texture>((resolve) => { finish = resolve; });
    jest.spyOn(Assets, 'get').mockReturnValue(undefined);
    jest.spyOn(Assets, 'load').mockImplementation(async (source) => {
      if (String(source) === flower) return late;
      throw new Error('missing');
    });
    const unload = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined);
    const load = preloadTntFrames({ frameSources: ['./assets/shop/bush/bush2@2x.png', flower] });
    const failure = expect(load).rejects.toThrow('could not be loaded');
    let retired = false;
    const exit = retireTntFrameCache().then(() => { retired = true; });
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
    expect(retired).toBe(false);
    expect(unload).not.toHaveBeenCalled();
    finish(texture);
    await Promise.all([failure, exit]);
    expect(unload).toHaveBeenCalledWith(flower);
  });

  test('exit owns retirement after FX cleanup, pooled sprites detach textures, merge revalidates after await', () => {
    const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), 'src/modules', file), 'utf8');
    const core = read('app-core.ts');
    const exit = core.slice(core.indexOf('export function cleanupGame('));
    expect(exit.indexOf('stopTntAnimation?.()')).toBeLessThan(exit.indexOf('retireTntFrameCache()'));
    expect(exit.indexOf("cleanupFxForBoardReset('cleanupGame')")).toBeLessThan(exit.indexOf('retireTntFrameCache()'));
    const animation = read('tnt-animation.ts');
    const pool = animation.slice(animation.indexOf('function releaseFrameSprite('), animation.indexOf('function attachDepthLayeredFlowerBurst('));
    expect(pool.indexOf('sprite.texture = Texture.EMPTY')).toBeLessThan(pool.indexOf('pooledFrameSprites.push'));
    const readiness = core.slice(core.indexOf('const tntFramesReady = await tntFramesReadyForMerge;'));
    expect(readiness.slice(0, 500)).toContain('mergeRunGenerationAtEntry !== gameplayRunGeneration');
    expect(readiness.slice(0, 500)).toContain('mergeGameplayGenerationAtEntry !== activeGameplayEntryGeneration');
  });
});
