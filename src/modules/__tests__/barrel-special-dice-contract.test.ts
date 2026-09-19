import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SPECIAL_DICE_VARIANTS, getSpecialDiceSplashOptions } from '../special-dice-registry';
import {
  createTntDebrisSpriteSourceOrder,
  createTntDiceDebrisPlans,
  createBarrelDiceDebrisPlans,
  getTntSpriteSequenceProgressTime,
  TNT_SMOKE_FIRST_FRAME_START_SECONDS,
} from '../tnt-animation';
import { getForestWildPool, pickForestWildReward, getForestWildRewardCoreType, getForestWildRewardVariantId } from '../journey-forest-wild-progression';
import { BARREL_SOUND_SOURCES, isBarrelMerge6SoundEvent } from '../barrel-merge6-sound';
import {
  BARREL_BOUNCY_ACTIVE_LOOPS,
  BARREL_BOUNCY_CYCLE_MS,
  BARREL_BOUNCY_FRAME_COUNT,
  BARREL_BOUNCY_REST_MS,
  BARREL_BOUNCY_SEQUENCE_MS,
  BARREL_BOUNCY_SHEET_URL,
  getBarrelBouncyDisplayGeometry,
  isBarrelBouncyTile,
} from '../barrel-bouncy-artwork';
import { acquireAnimatedSpecialArtworkMode, releaseAnimatedSpecialArtworkMode } from '../animated-special-artwork-mode';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');
const sha256 = (relative: string) => createHash('sha256')
  .update(fs.readFileSync(path.resolve(process.cwd(), relative)))
  .digest('hex');

describe('Barrel TNT archetype', () => {
  test('keeps TNT gameplay with its authored art, colors, POOOF, and wood debris', () => {
    const barrel = SPECIAL_DICE_VARIANTS.barell;
    expect(barrel.archetype).toBe('wild-tnt');
    expect(barrel.texture).toBe('./assets/shop/barell/barell-static.png');
    expect(barrel.visualAnchorY).toBeCloseTo(221 / 351);
    expect(barrel.trailColors).toEqual([0xD7C3BC, 0xE2CDC0, 0xF5BD65, 0xEAAD61]);
    expect(barrel.shardColors).toEqual([0xE9D6C6, 0xEBA95B]);
    expect(barrel.splashText).toBe('POOOF');
    expect(barrel.splashColor).toBe('#F48D59');
    expect(barrel.splashColors).toEqual(['#F48D59']);
    expect(getSpecialDiceSplashOptions(barrel)?.debrisSources).toEqual(
      Array.from({ length: 6 }, (_, index) => `./assets/shop/barell/wood${index + 1}.png`),
    );
    expect(fs.existsSync(path.resolve(process.cwd(), barrel.texture))).toBe(true);
    barrel.debrisSpriteSources?.forEach((source) => expect(fs.existsSync(path.resolve(process.cwd(), source))).toBe(true));
  });

  test('restores the original TNT dice beside 30%-smaller Barrel wood and color shards', () => {
    const sources = SPECIAL_DICE_VARIANTS.barell.debrisSpriteSources || [];
    const order = createTntDebrisSpriteSourceOrder(sources, createTntDiceDebrisPlans(() => 0.5).length, () => 0);
    expect(order).toHaveLength(16);
    expect(new Set(order.slice(0, 6))).toEqual(new Set(sources));
    expect(new Set(order.slice(6, 12))).toEqual(new Set(sources));
    const tntSource = read('src/modules/tnt-animation.ts');
    const appSource = read('src/modules/app-core.ts');
    const fxSource = read('src/modules/fx.ts');
    expect(appSource).toContain("diceDebris: tntVariantForMerge == null || tntVariantForMerge?.id === 'barell'");
    expect(appSource).toContain("debrisScale: tntVariantForMerge?.id === 'barell' ? 0.7 : 1");
    expect(appSource).toContain("sizeScale: wildTntVariant?.id === 'barell' ? 0.7 : 1");
    expect(tntSource).toContain('attachDepthLayeredTntDiceDebris(');
    expect(tntSource).toContain('attachDepthLayeredTntImageDebris(');
    expect(tntSource).toContain('const settledScale = plan.size * sizeScale / extent;');
    expect(fxSource).toContain('const baseSize = (6 + Math.random() * 8) * (shardDef.size || 1.0) * 2.4 * sizeScale;');
    expect(tntSource).toContain('const imageDebrisPlans = options.diceAvoidImageDebris === true');
    expect(tntSource).toContain('acquireFrameSprite(texture, plan.depth');
    expect(tntSource).toContain('releaseFrameSprite(sprite)');
    expect(tntSource).toContain('foregroundBurstCleanups.push(dispose)');
  });

  test('randomizes Barrel dice without crossing visible wood shards', () => {
    const flightPoint = (plan: ReturnType<typeof createTntDiceDebrisPlans>[number], progress: number) => {
      const impulse = 1 - Math.pow(1 - progress, 2.35);
      const curve = Math.sin(Math.PI * progress) * plan.curve;
      return {
        x: plan.startX + Math.cos(plan.angle) * plan.distance * impulse - Math.sin(plan.angle) * curve,
        y: plan.startY + Math.sin(plan.angle) * plan.distance * impulse + Math.cos(plan.angle) * curve
          + 28 * progress * progress,
      };
    };
    const visualScale = (plan: ReturnType<typeof createTntDiceDebrisPlans>[number], progress: number) => {
      const popIn = Math.min(1, progress / 0.12);
      const fade = Math.max(0, (progress - 0.78) / 0.22);
      const live = plan.startScale + (plan.peakScale - plan.startScale) * popIn;
      return live + (plan.endScale - live) * fade;
    };
    const firstPositions: string[] = [];
    for (let seed = 1; seed <= 100; seed += 1) {
      let state = seed;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
      };
      const wood = createTntDiceDebrisPlans(random);
      const dice = createBarrelDiceDebrisPlans(wood, 0.7, random);
      expect(dice).toHaveLength(16);
      firstPositions.push(`${dice[0].startX.toFixed(2)},${dice[0].startY.toFixed(2)}`);
      for (let sampleIndex = 0; sampleIndex < 59; sampleIndex += 1) {
        const time = 0.16 + sampleIndex * 0.035;
        dice.forEach((die, dieIndex) => {
          const dieProgress = (time - die.delay) / die.duration;
          if (dieProgress <= 0 || dieProgress >= 1) return;
          const diePoint = flightPoint(die, dieProgress);
          wood.forEach((shard, shardIndex) => {
            const shardProgress = (time - shard.delay) / shard.duration;
            if (shardProgress <= 0 || shardProgress >= 1) return;
            const shardPoint = flightPoint(shard, shardProgress);
            const clearance = Math.hypot(diePoint.x - shardPoint.x, diePoint.y - shardPoint.y)
              - die.size * visualScale(die, dieProgress) * 0.5
              - shard.size * 0.7 * visualScale(shard, shardProgress) * 0.5;
            if (clearance < 0) {
              throw new Error(`seed ${seed} die ${dieIndex} wood ${shardIndex} at ${time.toFixed(2)}s: ${clearance.toFixed(2)}px`);
            }
          });
        });
      }
    }
    expect(new Set(firstPositions).size).toBeGreaterThan(95);
  });

  test('animates every live copy from one shared Pixi sheet and introduces Barrel in Forest 07 and Arcade test order', () => {
    const geometry = getBarrelBouncyDisplayGeometry();
    expect(geometry.restingArtworkWidth).toBeCloseTo(115.2);
    expect(BARREL_BOUNCY_CYCLE_MS).toBeCloseTo(821.428571);
    expect(BARREL_BOUNCY_ACTIVE_LOOPS).toBe(2);
    expect(BARREL_BOUNCY_REST_MS).toBe(1000);
    expect(BARREL_BOUNCY_SEQUENCE_MS).toBeCloseTo(BARREL_BOUNCY_CYCLE_MS * 2 + 1000);
    expect(BARREL_BOUNCY_FRAME_COUNT).toBe(54);
    expect(read('assets/shop/barell/barell.svg')).toContain('dur="0.821428571s"');
    const sheetPath = path.resolve(process.cwd(), BARREL_BOUNCY_SHEET_URL);
    expect(fs.existsSync(sheetPath)).toBe(true);
    expect(fs.statSync(sheetPath).size).toBeLessThan(1_000_000);
    // Locks the reviewed row-major chronological export. The former scrambled
    // sheet also had valid dimensions and size, so those checks alone missed it.
    expect(sha256(BARREL_BOUNCY_SHEET_URL)).toBe(
      '87292511d7f2b985e7d82d5fa814e8441022d0e199948d1cbe1e1d2d2eb20743',
    );
    expect(sha256('./assets/shop/barell/barell-static.png')).toBe(
      'a65af5850d6dd2aee38e0b3286e8ffe0661ab192ae02dda9423ac0f0b5c51933',
    );
    const startupPreloader = read('src/utils/comprehensive-image-preloader.ts');
    const journeySource = read('src/modules/journey-boards-manager.ts');
    expect(startupPreloader.match(/\.\/assets\/shop\/barell\/barell-static\.png/g)).toHaveLength(2);
    expect(startupPreloader).not.toContain("'./assets/shop/barell/barell-pixi-sheet.webp'");
    expect(startupPreloader).not.toContain("'./assets/shop/barell/barell.svg'");
    expect(journeySource).not.toContain('preloadBarrelBouncyArtwork');
    expect(SPECIAL_DICE_VARIANTS.barell.visualWidth).toBeCloseTo(160.2);
    expect(SPECIAL_DICE_VARIANTS.barell.visualHeight).toBeCloseTo(207.9);
    expect(SPECIAL_DICE_VARIANTS.barell.hitAreaSize).toBe('tile');
    expect(geometry.anchorY).toBeCloseTo(221 / 351);
    expect(isBarrelBouncyTile({ special: 'wild-tnt', _ccSpecialDiceVariant: 'barell' })).toBe(true);
    expect(getForestWildPool(6)).not.toContain('barell');
    expect(getForestWildPool(7)).toContain('barell');
    expect(getForestWildPool(8)).toContain('barell');
    expect(pickForestWildReward({ boardNumber: 7, wildSpawnCount: 0, roll: 0 })).toBe('barell');
    expect(getForestWildRewardCoreType('barell')).toBe('wild-tnt');
    expect(getForestWildRewardVariantId('barell')).toBe('barell');
    expect(SPECIAL_DICE_VARIANTS.barell.arcadeTestOrder).toBe(3);
    const first = {};
    const second = {};
    try {
      expect(acquireAnimatedSpecialArtworkMode(first, 'barell', () => 1)).toBe('svg');
      expect(acquireAnimatedSpecialArtworkMode(second, 'barell', () => 1)).toBe('svg');
    } finally {
      releaseAnimatedSpecialArtworkMode(first);
      releaseAnimatedSpecialArtworkMode(second);
    }
  });

  test('routes only Barrel Merge-6 to its eight own-folder sources while retaining TNT impacts', () => {
    expect(isBarrelMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'barell' })).toBe(true);
    expect(isBarrelMerge6SoundEvent({ effectiveSum: 5, srcSpecialDiceVariantId: 'barell' })).toBe(false);
    expect(isBarrelMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'flower' })).toBe(false);
    expect(Object.values(BARREL_SOUND_SOURCES)).toHaveLength(8);
    Object.values(BARREL_SOUND_SOURCES).forEach((source) => expect(fs.existsSync(path.resolve(process.cwd(), source))).toBe(true));
    const appSource = read('src/modules/app-core.ts');
    const warmupSource = read('src/modules/special-sound-warmup.ts');
    const uiSource = read('src/modules/ui-manager.ts');
    const journeySource = read('src/modules/journey-boards-manager.ts');
    expect(appSource).toContain('playBarrelMerge6Sound()');
    expect(appSource).toContain('tiles: [spawnedTile]');
    expect(warmupSource).toContain("if (families.has('barell')) preloadBarrelMerge6Sounds();");
    expect(uiSource).not.toContain('preloadBarrelMerge6Sounds');
    expect(journeySource).not.toContain('preloadBarrelMerge6Sounds');
    expect(appSource).toContain("tntVariantForMerge.id !== 'barell'");
    expect(appSource).toMatch(/initialImpactDelayMs:[\s\S]*?tntVariantForMerge\?\.id === 'barell'\s*\? 200/);
    expect(appSource).toContain('const delayMs = boundedInitialImpactDelayMs + impactStaggerMs;');
    expect(appSource).toContain('try { onImpact?.(i); }');
  });

  test('places poof halfway through visible smoke time, after the first cloud starts', () => {
    expect(TNT_SMOKE_FIRST_FRAME_START_SECONDS).toBe(0.07);
    expect(getTntSpriteSequenceProgressTime(0.07, 1.75, 0.5)).toBeCloseTo(0.91);
    expect(getTntSpriteSequenceProgressTime(0, 1.75, 0.9)).toBeCloseTo(1.575);
    const tntSource = read('src/modules/tnt-animation.ts');
    const appSource = read('src/modules/app-core.ts');
    expect(tntSource).toContain('standardSpriteSequenceEndTime,');
    expect(appSource).toContain("spriteSequenceProgressStartSeconds: tntVariantForMerge?.id === 'barell'");
    expect(appSource).toContain('() => playBarrelSmokePoofSound()');
  });
});
