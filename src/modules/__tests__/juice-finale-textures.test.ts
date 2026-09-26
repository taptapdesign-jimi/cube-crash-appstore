import {
  BUBBLE_SPRITE_PATHS,
  createFinaleTextureLoader,
  getLiveJuiceFinaleTextureSources,
} from '../juice-finale-textures';
import {
  SPECIAL_DICE_VARIANTS,
  getSpecialDiceExplosionSpriteSources,
  getSpecialDiceFinaleAccentSpriteSources,
  getSpecialDiceFinaleFxForTile,
} from '../special-dice-registry';

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

describe('shared finale texture preparation', () => {
  test('eight cold textures start in bounded parallel batches, preserve order, and coalesce a concurrent merge', async () => {
    const resolvers = new Map<string, (value: string) => void>();
    const starts: string[] = [];
    let active = 0;
    let peak = 0;
    const load = createFinaleTextureLoader((path) => {
      starts.push(path);
      peak = Math.max(peak, ++active);
      return new Promise<string>((resolve) => resolvers.set(path, (value) => { active--; resolve(value); }));
    });
    const paths = Array.from({ length: 8 }, (_, index) => `bubble-${index}`);
    const warmup = load(paths);
    const merge = load(paths);
    await flush();
    expect(starts).toEqual(paths.slice(0, 4));
    for (const path of paths.slice(0, 4).reverse()) resolvers.get(path)!(path);
    await flush();
    expect(starts).toEqual(paths);
    for (const path of paths.slice(4).reverse()) resolvers.get(path)!(path);
    expect(await warmup).toEqual(paths);
    expect(await merge).toEqual(paths);
    expect(peak).toBe(4);
  });

  test('navigation cancels queued work and discards started results; a later live entry can retry', async () => {
    let current = true;
    let finish!: (value: string) => void;
    const starts: string[] = [];
    const load = createFinaleTextureLoader((path) => {
      starts.push(path);
      return new Promise<string>((resolve) => { finish = resolve; });
    }, 1);
    const old = load(['a', 'b', 'c'], () => current);
    await flush();
    current = false;
    finish('a');
    expect(await old).toEqual([]);
    expect(starts).toEqual(['a']);
    const next = load(['b']);
    await flush();
    finish('b');
    expect(await next).toEqual(['b']);
    expect(starts).toEqual(['a', 'b']);
  });

  test('a cancelled warmup cannot cancel an overlapping current finale', async () => {
    let warmupCurrent = true;
    const load = createFinaleTextureLoader(async (path) => path, 1);
    const warmup = load(['a', 'b'], () => warmupCurrent);
    const finale = load(['a', 'b']);
    warmupCurrent = false;
    expect(await warmup).toEqual([]);
    expect(await finale).toEqual(['a', 'b']);
  });

  test('failed sprites are skipped without poisoning the next preparation', async () => {
    const attempts = new Map<string, number>();
    const load = createFinaleTextureLoader(async (path) => {
      const attempt = (attempts.get(path) || 0) + 1;
      attempts.set(path, attempt);
      if (path === 'b' && attempt === 1) throw new Error('temporary decode failure');
      return path;
    });
    expect(await load(['a', 'b'])).toEqual(['a']);
    expect(await load(['b'])).toEqual(['b']);
  });

  test.each(Object.keys(SPECIAL_DICE_VARIANTS))('%s prepares only its actual finale family, including accents', (id) => {
    const tile = { _ccSpecialDiceVariant: id };
    const expected = getSpecialDiceFinaleFxForTile(tile) === 'juice'
      ? [...new Set([...(getSpecialDiceExplosionSpriteSources(tile) || BUBBLE_SPRITE_PATHS), ...(getSpecialDiceFinaleAccentSpriteSources(tile) || [])])]
      : [];
    expect(getLiveJuiceFinaleTextureSources([tile, tile])).toEqual(expected);
    expect(getLiveJuiceFinaleTextureSources([{ ...tile, destroyed: true }])).toEqual([]);
  });

  test('core Juice warms all eight base sprites; other unskinned Wild families do not', () => {
    expect(getLiveJuiceFinaleTextureSources([{ special: 'wild-juice' }])).toEqual(BUBBLE_SPRITE_PATHS);
    expect(getLiveJuiceFinaleTextureSources(['wild', 'wild-tnt', 'wild-magnet'].map((special) => ({ special })))).toEqual([]);
  });
});
