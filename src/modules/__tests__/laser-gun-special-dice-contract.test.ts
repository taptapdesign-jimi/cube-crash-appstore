import fs from 'node:fs';
import path from 'node:path';
import {
  getCoreWildTypeForSpecialDiceVariant,
  getSpecialDiceShardColors,
  getSpecialDiceSplashOptions,
  getSpecialDiceTrailColors,
  getSpecialDiceVariant,
  pickSpecialDiceVariantForWildSpawn,
} from '../special-dice-registry';
import {
  getLaserBeamPlacement,
  getLaserGunAimRotation,
  getLaserGunRandomScales,
  getLaserGunSideYPositions,
  LASERGUN_BEAM_COUNT,
  LASERGUN_FRAME_SEQUENCE,
  LASERGUN_FRAME_SOURCES,
  LASERGUN_IMPACT_DELAYS_MS,
  LASERGUN_MAX_TARGETS,
  LASERGUN_LEFT_BEAM_GEOMETRY,
  LASERGUN_UPPER_GUN_TRANSFORM,
  LASERGUN_RIGHT_BEAM_GEOMETRY,
  LASERGUN_TARGET_REACH_SCALE,
  LASERGUN_SHOT_PATTERN,
} from '../lasergun-finale-scene';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('LaserGun special die contract', () => {
  test('maps the requested presentation to canonical TNT gameplay', () => {
    const laserGun = getSpecialDiceVariant('laser-gun');
    expect(laserGun).toMatchObject({
      id: 'laser-gun',
      archetype: 'wild-tnt',
      splashText: 'ZAP - ZAP',
      splashColor: '#F3A654',
      splashColors: ['#F3A654', '#EE9343'],
      splashSplitIndex: 6,
      shardColors: [0xFED49A, 0xBEAA85],
      trailColors: [0xFEDFAD, 0xFDC37E, 0xE5CCA4, 0x97E9FD],
      finaleScene: 'lasergun-crossfire',
      hitAreaSize: 'tile',
    });
    expect(laserGun?.texture).toMatch(/assets\/shop\/gun\/right gun(?:@2x)?\.png$/);
    expect(getCoreWildTypeForSpecialDiceVariant(laserGun)).toBe('wild-tnt');
    expect(getSpecialDiceTrailColors(laserGun)).toEqual([0xFEDFAD, 0xFDC37E, 0xE5CCA4, 0x97E9FD]);
    expect(getSpecialDiceShardColors(laserGun)).toEqual([0xFED49A, 0xBEAA85]);
    expect(getSpecialDiceSplashOptions(laserGun)).toMatchObject({
      text: 'ZAP - ZAP',
      colors: ['#F3A654', '#EE9343'],
      splitIndex: 6,
      finaleScene: 'lasergun-crossfire',
    });
  });

  test('owns the exact first-second-third Area 55 Stage 1 order without leaking', () => {
    const sequence = [0, 1, 2, 3].map((wildSpawnCount) => pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 21,
      wildSpawnCount,
      roboWildRoll: 0,
    })?.id ?? null);
    expect(sequence).toEqual(['laser-gun', 'spaceship', 'robo-cube', null]);

    for (const journeyBoard of [1, 2, 10, 11, 20, 22, 30, 31]) {
      for (const wildSpawnCount of [0, 1, 2, 3]) {
        expect(pickSpecialDiceVariantForWildSpawn({
          isArcade: false,
          journeyBoard,
          wildSpawnCount,
          beachWildSlot: 3,
          roboWildRoll: 0,
        })?.id).not.toBe('laser-gun');
      }
    }
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: true,
      arcadeStage: 1,
      wildSpawnCount: 0,
    })?.id).not.toBe('laser-gun');
  });

  test('uses every supplied gun pair while keeping the scene bounded', () => {
    const assetRoot = path.resolve(process.cwd(), 'assets/shop/gun');
    const names = [
      'left gun',
      'right gun',
      'left laser',
      'right laser',
      ...Array.from({ length: 6 }, (_, index) => `lasergun${index + 1}`),
      ...Array.from({ length: 7 }, (_, index) => `rock${index + 1}`),
    ];
    names.forEach((name) => {
      expect(fs.existsSync(path.join(assetRoot, `${name}.png`))).toBe(true);
      expect(fs.existsSync(path.join(assetRoot, `${name}@2x.png`))).toBe(true);
    });
    expect(LASERGUN_FRAME_SOURCES).toHaveLength(6);
    expect(LASERGUN_FRAME_SEQUENCE).toEqual([
      LASERGUN_FRAME_SOURCES[0],
      LASERGUN_FRAME_SOURCES[1],
      LASERGUN_FRAME_SOURCES[2],
      LASERGUN_FRAME_SOURCES[3],
      LASERGUN_FRAME_SOURCES[4],
      LASERGUN_FRAME_SOURCES[3],
      LASERGUN_FRAME_SOURCES[2],
      LASERGUN_FRAME_SOURCES[1],
      LASERGUN_FRAME_SOURCES[0],
    ]);
    expect(LASERGUN_MAX_TARGETS).toBe(4);
    expect(LASERGUN_BEAM_COUNT).toBe(4);
    expect(LASERGUN_SHOT_PATTERN).toEqual(['right', 'left', 'right', 'left']);
    expect(LASERGUN_UPPER_GUN_TRANSFORM).toBe('rotate(45deg) scaleX(-1)');
    expect(LASERGUN_IMPACT_DELAYS_MS).toEqual([1100, 1340, 1580, 1820]);
  });

  test('aims the supplied beam from its barrel endpoint to the real target', () => {
    expect(LASERGUN_LEFT_BEAM_GEOMETRY).toMatchObject({ impactX: 330, impactY: 342 });
    expect(LASERGUN_RIGHT_BEAM_GEOMETRY).toMatchObject({ impactX: 80, impactY: 148 });

    const cases = [
      {
        geometry: LASERGUN_RIGHT_BEAM_GEOMETRY,
        barrel: { x: 340, y: 700 },
        target: { x: 120, y: 360 },
      },
      {
        geometry: LASERGUN_LEFT_BEAM_GEOMETRY,
        barrel: { x: 72, y: 180 },
        target: { x: 310, y: 520 },
      },
    ];
    cases.forEach(({ geometry, barrel, target }) => {
      const placement = getLaserBeamPlacement(barrel, target, geometry);
      const baselineX = geometry.impactX - geometry.sourceX;
      const baselineY = geometry.impactY - geometry.sourceY;
      const angle = placement.rotation * Math.PI / 180;
      const rotatedImpactX = barrel.x + placement.scale * (baselineX * Math.cos(angle) - baselineY * Math.sin(angle));
      const rotatedImpactY = barrel.y + placement.scale * (baselineX * Math.sin(angle) + baselineY * Math.cos(angle));
      expect(rotatedImpactX).toBeCloseTo(barrel.x + (target.x - barrel.x) * LASERGUN_TARGET_REACH_SCALE, 6);
      expect(rotatedImpactY).toBeCloseTo(barrel.y + (target.y - barrel.y) * LASERGUN_TARGET_REACH_SCALE, 6);
    });
  });

  test('never paints a shortened pre-impact beam before exact target alignment', () => {
    const sceneSource = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/lasergun-finale-scene.ts'),
      'utf8',
    );
    expect(sceneSource).not.toContain('placement.scale * 0.82');
    expect(sceneSource).toContain('positionBeam(shot, 1)');
    expect(sceneSource).toContain('Two RAF boundaries guarantee one gun-only paint');
  });

  test('rotates normal and mirrored gun bodies so their live barrel axis faces the target', () => {
    const axis = { x: 100, y: 100 };
    const barrel = { x: 150, y: 100 };
    const target = { x: 150, y: 200 };

    expect(getLaserGunAimRotation(axis, barrel, target, 0, 1)).toBeCloseTo(90, 6);
    expect(getLaserGunAimRotation(axis, barrel, target, 0, -1)).toBeCloseTo(-90, 6);
    expect(getLaserGunAimRotation(axis, barrel, { x: 200, y: 100 }, 22, 1)).toBeCloseTo(22, 6);
  });

  test('randomizes gun size across the requested 20, 30 and 40 percent reductions', () => {
    const scales = getLaserGunRandomScales(4, () => 0.5);
    expect(scales).toHaveLength(4);
    expect(new Set(scales.slice(0, 3))).toEqual(new Set([0.8, 0.7, 0.6]));
    expect(scales.every((scale) => [0.8, 0.7, 0.6].includes(scale))).toBe(true);
    expect(getLaserGunRandomScales(0, () => 0.5)).toEqual([]);
  });

  test('keeps same-side guns about 200px apart and inside the viewport', () => {
    for (const side of ['left', 'right'] as const) {
      const positions = getLaserGunSideYPositions(2, 844, side);
      expect(positions).toHaveLength(2);
      expect(positions[1] - positions[0]).toBe(200);
      expect(positions[0]).toBeGreaterThanOrEqual(132);
      expect(positions[1]).toBeLessThanOrEqual(712);
    }
    expect(getLaserGunSideYPositions(1, 844, 'left')).toHaveLength(1);
    expect(getLaserGunSideYPositions(0, 844, 'right')).toEqual([]);
  });

  test('couples visual impacts to canonical reserved TNT targets and one existing idle owner', () => {
    const appCore = read('src/modules/app-core.ts');
    const tnt = read('src/modules/tnt-animation.ts');
    const scene = read('src/modules/lasergun-finale-scene.ts');
    const idle = read('src/modules/fx.ts');

    expect(appCore).toContain("impactProfile?: 'standard' | 'beach-ball' | 'laser-gun'");
    expect(appCore).toContain('planLaserGunCrossfireTargets(');
    expect(appCore).toContain('onTargetsSelected?.(laserVisualTargets)');
    expect(appCore).toContain('triggerActiveLaserGunFinaleImpact(i)');
    expect(appCore).toContain('DOM beam/debris cannot drift away from the Pixi explosion on iOS');
    expect(appCore).toContain('(pos.x / screenW) * rect.width');
    expect(appCore).toContain("? (targets) => setActiveLaserGunFinaleTargets(targets)");
    expect(appCore).toContain("if (tntVariantForMerge?.id === 'laser-gun') return;");
    expect(tnt).toContain("options.finaleScene === 'lasergun-crossfire'");
    expect(tnt).toContain("const frameCacheSources = usesLaserGunScene ? ['lasergun-dom'] : preferred");
    expect(tnt).toContain('attachLaserGunFinaleScene(overlay');
    expect(scene).toContain("ease: 'back.out(2.1)'");
    expect(scene).toContain("ease: 'back.in(1.4)'");
    expect(scene).toContain('const beamPlan = beamPools[shooter][sideIndex]');
    expect(scene).toContain('const { gun, beamPlan } = assignedShots[index]');
    expect(scene).toContain('activeGuns = assignedShots.map(({ gun }) => gun)');
    expect(scene).toContain('getLaserGunRandomScales(boundedTargets.length, random)');
    expect(scene).toContain('LASERGUN_FRAME_SEQUENCE.slice(1)');
    expect(scene).not.toContain('LASERGUN_FRAME_SOURCES[5]');
    expect(scene).not.toContain('scale: placement.scale * 0.82');
    expect(scene).toContain('scale: placement.scale,');
    expect(scene).not.toContain('cc-lasergun-rendered-die');
    expect(scene).not.toContain('cc-lasergun-impact-rock');
    expect(scene).not.toContain('cc-lasergun-debris-field');
    expect(scene).toContain("rotation: 0,\n      duration: 0.10");
    expect(idle).toContain("const isLaserGun = getSpecialDiceVariantForTile(tile)?.id === 'laser-gun'");
    expect(idle).toContain("ease: 'back.out(2.2)'");
    expect(idle).toContain("ease: 'elastic.out(1, 0.45)'");
    expect(idle).toContain('const delay = 3 + Math.random() * 0.4');
    expect(idle).toContain('stopTntIdleShake(tile)');
    expect(idle).toContain('g.y = resetY');
    expect(appCore).toContain('wildSpawnCount,');
    expect(appCore).toContain('firstWildSpawned = v > 0');
  });
});
