import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Honey special-die visual contract', () => {
  const registrySource = read('src/modules/special-dice-registry.ts');
  const splashSource = read('src/modules/splash-text-overlay.ts');
  const boltsSource = read('src/modules/text-bolts.ts');
  const fxSource = read('src/modules/fx.ts');

  test('reuses Magnet gameplay with Honey-owned bee finale and bubbles', () => {
    const honeyDefinition = registrySource.slice(
      registrySource.indexOf('  honey: {'),
      registrySource.indexOf('  flower: {'),
    );
    expect(honeyDefinition).toContain("archetype: 'wild-magnet'");
    expect(honeyDefinition).toContain("splashText: 'BUZZING!'");
    expect(honeyDefinition).toContain("splashColors: ['#FFC14F', '#D0784D']");
    expect(honeyDefinition).toContain('idleBubbleColors: [0xF7D58A, 0xF2BB4F]');
    expect(honeyDefinition).toContain('beeFlight: true');
    expect(splashSource).toContain('sources: options?.burstSources');
    expect(splashSource).toContain("Array.from(String(options?.text || 'SWOOP'))");
    expect(boltsSource).toContain('const beeFlight = opts.motion?.beeFlight === true');
    expect(boltsSource).toContain("ease: 'back.out(2.8)'");
    expect(boltsSource).toContain('const BEE_DIRECTION_ANGLES: Record<number, number>');
    expect(boltsSource).toContain('function buildBalancedBeeSourceOrder');
    expect(boltsSource).toContain('sources[index % sources.length]');
    expect(boltsSource).toContain('const balancedBeeSources = beeFlight ? buildBalancedBeeSourceOrder(count, opts.sources) : []');
    expect(boltsSource).toContain('7: Math.PI * 0.75');
    expect(boltsSource).toContain('/bee([1-7])(?:@2x)?\\.png$/');
    expect(boltsSource).toContain('const BEE_PAIR_GAP_WEIGHTS = [0.2, 0.2, 0.1, 0.05, 0.1, 0.2, 0.15]');
    expect(boltsSource).toContain('const delay = getBeePairDelay(i)');
    expect(boltsSource).toContain('const jitterBoost = beeFlight ? 1.05 : 1.3');
    expect(boltsSource).toContain('const buzzRotationA = flightSide * (6 + Math.random() * 2.5)');
    expect(boltsSource).toContain('const buzzRotationB = -flightSide * (6 + Math.random() * 2.5)');
    expect(boltsSource).toContain('scale: beeScale');
    expect(boltsSource).toContain('cleanup.startExit = startExit');
    expect(boltsSource).toContain("ease: 'back.in(2.4)'");
    expect(boltsSource).toContain('const size = beeFlight ? 58 + Math.random() * 17');
    expect(boltsSource).toContain('const beeStartForward = 18 + Math.random() * 88');
    expect(boltsSource).toContain('const beeStartLateral = (Math.random() - 0.5) * 190');
    expect(boltsSource).toContain('Math.cos(theta) * beeStartForward - Math.sin(theta) * beeStartLateral');
    expect(boltsSource).not.toContain('theta + Math.PI');
    expect(boltsSource).toContain('const outwardX = beeFlight ? Math.cos(theta)');
    expect(boltsSource).toContain('const horizontalEdgeDistance = outwardX > 0.001');
    expect(boltsSource).toContain('const verticalEdgeDistance = outwardY > 0.001');
    expect(boltsSource).toContain('Math.min(horizontalEdgeDistance, verticalEdgeDistance)');
    expect(boltsSource).toContain('x: edgeX * 0.2');
    expect(boltsSource).toContain('x: edgeX * 0.72');
    expect(boltsSource).toContain('duration: 1.2 + Math.random() * 0.12');
    expect(boltsSource).toContain('Bee timelines own their exit at the edge');
    expect(boltsSource).toContain('const beeCollisionTick = () =>');
    expect(boltsSource).toContain('minimumDistance = ((first.size * firstScale + second.size * secondScale) * 0.5) * 1.6');
    expect(splashSource).toContain("const beeFlightTail = options?.burstMotion?.beeFlight === true ? 0.9 : 0");
    expect(boltsSource).toContain('const lateralWaypoints = [70, 105, 120, 105, 72].map');
    expect(boltsSource).toContain('const waypointRotations = Array.from({ length: 5 }');
    expect(boltsSource).toContain('perpendicularX * lateralWaypoints[2]');
    expect(boltsSource).toContain('for (let pass = 0; pass < 8; pass += 1)');
    expect(boltsSource).not.toContain('const curveA =');
    expect(boltsSource).not.toContain('const curveB =');
    expect(boltsSource).toContain('gsap.ticker.add(beeCollisionTick)');
    expect(boltsSource).toContain('gsap.ticker.remove(beeCollisionTick)');
    expect(boltsSource).toContain("img.style.translate = ''");
    expect(boltsSource).not.toContain('beePulse');
    expect(fxSource).toContain("getSpecialDiceVariantForTile(tile)?.id === 'honey'");
    expect(fxSource).toContain('const usesArtworkAlphaMask = Boolean(tile.base?.texture && tile.base.texture !== Texture.EMPTY)');
    expect(fxSource).toContain('mask = new Sprite(tile.base.texture)');
    expect(fxSource).toContain('const bubbleMotionScale = isHoney ? 1.3 : 1');
    expect(fxSource).toContain('const customShardColors = Array.isArray(opts.colors)');
  });

  test('snapshots the Honey palette before source cleanup for both Magnet shard breaks', () => {
    const appCoreSource = read('src/modules/app-core.ts');
    const mergeSource = read('src/modules/app-merge.ts');
    expect(appCoreSource).toContain('const srcSpecialVariantAtMergeEntry = getSpecialDiceVariantForTile(src)');
    expect(appCoreSource).toContain('const dstSpecialVariantAtMergeEntry = getSpecialDiceVariantForTile(dst)');
    expect(appCoreSource).toContain('? srcSpecialVariantAtMergeEntry || dstSpecialVariantAtMergeEntry');
    expect(appCoreSource.indexOf('const srcSpecialVariantAtMergeEntry')).toBeLessThan(
      appCoreSource.indexOf('removeTile(src)'),
    );
    expect(appCoreSource.match(/magnetShardColors: magnetShardColorsAtMergeEntry/g)).toHaveLength(2);
    expect(mergeSource).toContain('const pullShardColors = Array.isArray(helpers?.magnetShardColors)');
    expect(mergeSource).toContain('colors: pullShardColors');
  });

  test('ships every Honey and bee resolution used by web and native displays', () => {
    ['honey.png', 'honey@2x.png'].forEach((asset) => {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/honey/${asset}`))).toBe(true);
    });
    for (let bee = 1; bee <= 7; bee += 1) {
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/honey/bee${bee}.png`))).toBe(true);
      expect(fs.existsSync(path.resolve(process.cwd(), `assets/shop/honey/bee${bee}@2x.png`))).toBe(true);
    }
  });
});
