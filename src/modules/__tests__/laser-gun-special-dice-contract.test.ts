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
  getLaserGunAxisMissDistance,
  getLaserGunConstrainedTop,
  getLaserGunMuzzleX,
  getLaserGunOffscreenTravel,
  getLaserGunRandomScales,
  getLaserGunSideYPositions,
  getLaserGunStageCenterX,
  LASERGUN_BEAM_COUNT,
  LASERGUN_BEAM_BRIGHTNESS_SCALE,
  LASERGUN_BEAM_FADE_DELAY_SECONDS,
  LASERGUN_BEAM_FADE_SECONDS,
  LASERGUN_BEAM_GLOW_ALPHA,
  LASERGUN_BEAM_GLOW_BLUR_PX,
  LASERGUN_BEAM_LAUNCH_SCALE,
  LASERGUN_BEAM_SATURATION_SCALE,
  LASERGUN_BEAM_THICKNESS_SCALE,
  LASERGUN_BEAM_TRAVEL_SECONDS,
  LASERGUN_BUILDUP_START_SECONDS,
  LASERGUN_FRAME_SEQUENCE,
  LASERGUN_FRAME_SOURCES,
  LASERGUN_EXIT_DELAY_SECONDS,
  LASERGUN_GUN_ANIMATION_SPEED,
  LASERGUN_GUN_SIZE_MULTIPLIER,
  LASERGUN_GUN_TIME_SCALE,
  LASERGUN_EDGE_CLEARANCE_PX,
  LASERGUN_MAX_TARGETS,
  LASERGUN_MAX_BEAM_ANGLE_DEGREES,
  LASERGUN_MIN_BEAM_TRAVEL_PX,
  LASERGUN_LAYOUT_TRAVEL_MARGIN_PX,
  LASERGUN_MUZZLE_EDGE_INSET_RATIO,
  LASERGUN_RIG_MAX_WIDTH_PX,
  LASERGUN_LEFT_BEAM_GEOMETRY,
  LASERGUN_UPPER_GUN_TRANSFORM,
  LASERGUN_RIGHT_BEAM_GEOMETRY,
  LASERGUN_TARGET_REACH_SCALE,
} from '../lasergun-finale-scene';
import {
  LASERGUN_ARRIVAL_TIMEOUT_MS,
  LASERGUN_FIRST_SHOT_LEAD_MS,
  LASERGUN_PREFLIGHT_LEAD_MS,
  LASERGUN_SHOT_INTERVAL_MS,
  LASERGUN_TIMING_SCALE,
} from '../laser-gun-impact-scheduler';

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
      visualWidth: 184.32,
      visualHeight: 184.32,
      hitAreaSize: 'tile',
    });
    expect(laserGun?.visualWidth).toBeCloseTo(147.456 * 1.25, 6);
    expect(laserGun?.visualHeight).toBeCloseTo(147.456 * 1.25, 6);
    expect(laserGun?.texture).toMatch(/assets\/shop\/gun\/right gun(?:@2x)?\.png$/);
    expect(getCoreWildTypeForSpecialDiceVariant(laserGun)).toBe('wild-tnt');
    expect(getSpecialDiceTrailColors(laserGun)).toEqual([0xFEDFAD, 0xFDC37E, 0xE5CCA4, 0x97E9FD]);
    expect(getSpecialDiceShardColors(laserGun)).toEqual([0xFED49A, 0xBEAA85]);
    expect(getSpecialDiceSplashOptions(laserGun)).toMatchObject({
      text: 'ZAP - ZAP',
      color: '#F3A654',
      colors: ['#F3A654', '#EE9343'],
      splitIndex: 6,
      finaleScene: 'lasergun-crossfire',
    });
    expect(laserGun).not.toHaveProperty('splashFollowupTexts');
    expect(getSpecialDiceSplashOptions(laserGun)).not.toHaveProperty('followupTexts');
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
      LASERGUN_FRAME_SOURCES[5],
      LASERGUN_FRAME_SOURCES[4],
      LASERGUN_FRAME_SOURCES[3],
      LASERGUN_FRAME_SOURCES[2],
      LASERGUN_FRAME_SOURCES[1],
      LASERGUN_FRAME_SOURCES[0],
    ]);
    expect(LASERGUN_MAX_TARGETS).toBe(4);
    expect(LASERGUN_BEAM_COUNT).toBe(4);
    expect(LASERGUN_BEAM_TRAVEL_SECONDS).toBe(0.095);
    expect(LASERGUN_BEAM_FADE_DELAY_SECONDS).toBe(0.24);
    expect(LASERGUN_BEAM_LAUNCH_SCALE).toBe(0.06);
    expect(LASERGUN_TARGET_REACH_SCALE).toBe(1);
    expect(LASERGUN_BUILDUP_START_SECONDS).toBeGreaterThan(0);
    expect(LASERGUN_BEAM_THICKNESS_SCALE).toBeCloseTo(1.50 * 1.30 * 1.20, 6);
    expect(LASERGUN_BEAM_BRIGHTNESS_SCALE).toBeCloseTo(1.18 * 1.20, 6);
    expect(LASERGUN_BEAM_SATURATION_SCALE).toBeCloseTo(1.12 * 1.20, 6);
    expect(LASERGUN_BEAM_GLOW_BLUR_PX).toBeCloseTo(7 * 1.20, 6);
    expect(LASERGUN_BEAM_GLOW_ALPHA).toBeCloseTo(0.82 * 1.20, 6);
    expect(LASERGUN_UPPER_GUN_TRANSFORM).toBe('rotate(45deg) scaleX(-1)');
    expect(LASERGUN_TIMING_SCALE).toBe(0.455);
    expect(LASERGUN_GUN_ANIMATION_SPEED).toBe(0.70);
    expect(LASERGUN_GUN_TIME_SCALE).toBeCloseTo(LASERGUN_TIMING_SCALE / 0.70, 6);
    expect(LASERGUN_EXIT_DELAY_SECONDS).toBe(
      LASERGUN_BEAM_TRAVEL_SECONDS
        + LASERGUN_BEAM_FADE_DELAY_SECONDS
        + LASERGUN_BEAM_FADE_SECONDS,
    );
    expect(LASERGUN_EXIT_DELAY_SECONDS).toBeGreaterThan(2 / 60);
    expect(LASERGUN_FIRST_SHOT_LEAD_MS).toBe(621);
    expect(LASERGUN_PREFLIGHT_LEAD_MS).toBe(154);
    expect(LASERGUN_SHOT_INTERVAL_MS).toBe(500);
    expect(LASERGUN_ARRIVAL_TIMEOUT_MS).toBe(900);
  });

  test('aims the supplied beam from its barrel endpoint to the real target', () => {
    expect(LASERGUN_LEFT_BEAM_GEOMETRY).toMatchObject({ impactX: 340.5, impactY: 345.5 });
    expect(LASERGUN_RIGHT_BEAM_GEOMETRY).toMatchObject({ impactX: 65.5, impactY: 143 });

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
      const baselineLength = Math.hypot(baselineX, baselineY);
      const rotatedImpactX = barrel.x + placement.scaleX * baselineLength * Math.cos(angle);
      const rotatedImpactY = barrel.y + placement.scaleX * baselineLength * Math.sin(angle);
      expect(placement.x).toBeCloseTo(barrel.x, 6);
      expect(placement.y).toBeCloseTo(barrel.y, 6);
      expect(rotatedImpactX).toBeCloseTo(barrel.x + (target.x - barrel.x) * LASERGUN_TARGET_REACH_SCALE, 6);
      expect(rotatedImpactY).toBeCloseTo(barrel.y + (target.y - barrel.y) * LASERGUN_TARGET_REACH_SCALE, 6);
      expect(rotatedImpactX).toBeCloseTo(target.x, 6);
      expect(rotatedImpactY).toBeCloseTo(target.y, 6);
      expect(placement.scaleY / placement.scaleX).toBeCloseTo(LASERGUN_BEAM_THICKNESS_SCALE, 6);
    });
  });

  test('can lock beam rotation to the already-solved barrel axis', () => {
    const barrel = { x: 80, y: 120 };
    const target = { x: 300, y: 500 };
    const lockedRotation = 31.25;
    const placement = getLaserBeamPlacement(
      barrel,
      target,
      LASERGUN_LEFT_BEAM_GEOMETRY,
      lockedRotation,
    );

    expect(placement.rotation).toBe(lockedRotation);
    expect(placement.x).toBe(barrel.x);
    expect(placement.y).toBe(barrel.y);
  });

  test('aligns hidden final geometry before revealing longitudinal beam travel', () => {
    const sceneSource = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/lasergun-finale-scene.ts'),
      'utf8',
    );
    expect(sceneSource).toContain('positionBeam(shot, 0)');
    expect(sceneSource).toContain('shot.beamFinalScaleX * LASERGUN_BEAM_LAUNCH_SCALE');
    expect(sceneSource).toContain('duration: LASERGUN_BEAM_TRAVEL_SECONDS');
    expect(sceneSource).toContain('Two RAF boundaries guarantee one gun-only paint');
  });

  test('keeps the intentional cube inflation under one owner until impact', () => {
    const coreSource = read('src/modules/app-core.ts');

    expect(coreSource).toContain('!(t.rotG as any)._ccLaserGunImpactTl');
    expect(coreSource).toContain("'laser-gun-cube-impact',");
    expect(coreSource).toContain('Math.ceil(laserGunImpactTimelineSeconds * 1000) + 100');
    expect(coreSource).toContain('const impactScale = tile.scale');
    expect(coreSource).toContain('(impactVisual as any)._ccLaserGunImpactTl = anticipation');
    expect(coreSource).toContain('(tile as any)._ccLaserGunImpactTl = anticipation');
    expect(coreSource).toContain('impactScale.set?.(1, 1)');
    expect(coreSource).toContain('x: LASERGUN_CUBE_ANTICIPATION_SCALE');
    expect(coreSource).toContain('y: LASERGUN_CUBE_ANTICIPATION_SCALE');
    expect(coreSource).toContain('x: LASERGUN_CUBE_CONTRACT_SCALE');
    expect(coreSource).toContain('y: LASERGUN_CUBE_CONTRACT_SCALE');
    expect(coreSource).toContain('x: LASERGUN_CUBE_REBOUND_SCALE');
    expect(coreSource).not.toContain('LASERGUN_CUBE_SECOND_CONTRACT_SCALE');
    expect(coreSource).not.toContain('LASERGUN_CUBE_SECOND_REBOUND_SCALE');
    expect(coreSource).toContain('duration: LASERGUN_CUBE_SETTLE_SECONDS');
    expect(coreSource).not.toContain('baseScaleX * LASERGUN_CUBE_ANTICIPATION_SCALE');
    expect(coreSource).toContain('trackAppAnimationFrame(commitImpactBreak)');
    expect(coreSource).toContain('trackAppTimeout(commitImpactBreak, 900)');
    expect(coreSource).toContain('// one canonical pose. A stalled fourth shot can never remain large.');
    expect(coreSource).toContain('restoreImpactPose();');
    expect(coreSource).toContain('impactScale.set?.(1, 1)');
    expect(coreSource).toContain('impactVisual.rotation = baseRotation');
    expect(coreSource).toContain('laserGunPoseRestorers.add(restoreImpactPose)');
    expect(coreSource).toContain('// its same-tile rebound pose on the playable board.');
    expect(coreSource).toContain('// scene/scheduler cleanup can cross the final paint boundary.');
    expect(coreSource).toContain('const swapLaserValueInPlace = () => {');
    expect(coreSource).toContain('makeBoard.setValueImmediate(tile, replacementValue, 0)');
    expect(coreSource).not.toContain('makeBoard.refreshValueVisual?.(tile, 0)');
    expect(coreSource).toContain('anticipation.call(swapLaserValueInPlace, [], settleStart)');
    expect(coreSource).toContain('// only the cube\'s scale lead begins 300ms earlier.');
    expect(coreSource).toContain('emitBonusStar();\n\t            }, [], LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS);');
    expect(coreSource).toContain('rotation: baseRotation');
    expect(coreSource).not.toContain(
      'Math.round(LASERGUN_CUBE_ANTICIPATION_SECONDS * 1000)',
    );
  });

  test('rotates normal and mirrored gun bodies so their live barrel axis faces the target', () => {
    const axis = { x: 100, y: 100 };
    const barrel = { x: 150, y: 100 };
    const target = { x: 150, y: 200 };

    expect(getLaserGunAimRotation(axis, barrel, target, 0, 1)).toBeCloseTo(90, 6);
    expect(getLaserGunAimRotation(axis, barrel, target, 0, -1)).toBeCloseTo(-90, 6);
    expect(getLaserGunAimRotation(axis, barrel, { x: 200, y: 100 }, 22, 1)).toBeCloseTo(22, 6);
    expect(getLaserGunAxisMissDistance(axis, barrel, { x: 200, y: 100 })).toBe(0);
    expect(getLaserGunAxisMissDistance(axis, barrel, { x: 200, y: 125 })).toBe(25);
  });

  test('prepositions the gun before entry so the layout never needs a 90-degree incline', () => {
    const nominalTop = 100;
    const target = { x: 200, y: 900 };
    const gunX = 100;
    const constrainedTop = getLaserGunConstrainedTop(nominalTop, target, gunX);
    const angle = Math.abs(Math.atan2(
      target.y - constrainedTop,
      target.x - gunX,
    ) * 180 / Math.PI);

    expect(LASERGUN_MAX_BEAM_ANGLE_DEGREES).toBe(55);
    expect(LASERGUN_MIN_BEAM_TRAVEL_PX).toBe(150);
    expect(LASERGUN_LAYOUT_TRAVEL_MARGIN_PX).toBe(0.5);
    expect(constrainedTop).toBeGreaterThan(nominalTop);
    expect(angle).toBeCloseTo(LASERGUN_MAX_BEAM_ANGLE_DEGREES, 6);
    expect(getLaserGunConstrainedTop(100, { x: 100, y: 900 }, 100)).toBe(900);
    expect(getLaserGunConstrainedTop(150, { x: 300, y: 200 }, 100)).toBe(150);

    const readableTop = getLaserGunConstrainedTop(200, { x: 200, y: 200 }, 100);
    expect(Math.hypot(200 - 100, 200 - readableTop)).toBeCloseTo(
      LASERGUN_MIN_BEAM_TRAVEL_PX,
      6,
    );
    const longestLegalTop = getLaserGunConstrainedTop(200, { x: 150, y: 200 }, 100);
    expect(Math.abs(Math.atan2(
      200 - longestLegalTop,
      150 - 100,
    ) * 180 / Math.PI)).toBeCloseTo(LASERGUN_MAX_BEAM_ANGLE_DEGREES, 6);

    const narrowCenterTop = getLaserGunConstrainedTop(200, { x: 160, y: 200 }, 72);
    expect(Math.hypot(160 - 72, 200 - narrowCenterTop)).toBeCloseTo(
      LASERGUN_MIN_BEAM_TRAVEL_PX,
      6,
    );
  });

  test('keeps all randomized gun sizes exactly 25 percent larger', () => {
    const scales = getLaserGunRandomScales(4, () => 0.5);
    expect(scales).toHaveLength(4);
    expect(LASERGUN_GUN_SIZE_MULTIPLIER).toBe(1.25);
    expect(new Set(scales.slice(0, 3))).toEqual(new Set([1, 0.875, 0.75]));
    expect(scales.every((scale) => [1, 0.875, 0.75].includes(scale))).toBe(true);
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
    const leftPair = getLaserGunSideYPositions(2, 844, 'left');
    const rightPair = getLaserGunSideYPositions(2, 844, 'right');
    expect(leftPair[0]).toBeCloseTo(212.28, 6);
    expect(leftPair[1]).toBeCloseTo(412.28, 6);
    expect(rightPair[0]).toBeCloseTo(431.72, 6);
    expect(rightPair[1]).toBeCloseTo(631.72, 6);
    expect(getLaserGunSideYPositions(1, 844, 'left')).toHaveLength(1);
    const fourOnOneSide = getLaserGunSideYPositions(4, 844, 'left');
    expect(fourOnOneSide).toHaveLength(4);
    expect(fourOnOneSide[3] - fourOnOneSide[0]).toBeLessThanOrEqual(580);
    expect(getLaserGunSideYPositions(0, 844, 'right')).toEqual([]);
    const leftMuzzleX = getLaserGunMuzzleX('left', 390);
    const rightMuzzleX = getLaserGunMuzzleX('right', 390);
    expect(LASERGUN_MUZZLE_EDGE_INSET_RATIO).toBe(0.21);
    expect(leftMuzzleX).toBeCloseTo(81.9, 6);
    expect(rightMuzzleX).toBeCloseTo(308.1, 6);
    expect(getLaserGunStageCenterX('left', 1, 390)).toBeCloseTo(0, 0);
    expect(getLaserGunStageCenterX('right', 1, 390)).toBeGreaterThan(380);
    const rigHalfWidth = Math.min(390 * 0.70, LASERGUN_RIG_MAX_WIDTH_PX) * 0.5;
    expect(
      getLaserGunStageCenterX('left', 1, 390)
        + getLaserGunOffscreenTravel('left', 1, 390)
        + rigHalfWidth,
    ).toBeCloseTo(-LASERGUN_EDGE_CLEARANCE_PX, 6);
    expect(
      getLaserGunStageCenterX('right', 1, 390)
        + getLaserGunOffscreenTravel('right', 1, 390)
        - rigHalfWidth,
    ).toBeCloseTo(390 + LASERGUN_EDGE_CLEARANCE_PX, 6);
  });

  test('couples visual impacts, late-hit shake and immediate exits to canonical TNT targets', () => {
    const appCore = read('src/modules/app-core.ts');
    const tnt = read('src/modules/tnt-animation.ts');
    const scene = read('src/modules/lasergun-finale-scene.ts');
    const idle = read('src/modules/fx.ts');

    expect(appCore).toContain("impactProfile?: 'standard' | 'beach-ball' | 'laser-gun'");
    expect(appCore).toContain('planLaserGunCrossfireTargets(');
    expect(appCore).toContain('onTargetsSelected?.(laserVisualTargets)');
    expect(appCore).toContain('prepareActiveLaserGunFinaleImpact(i, getDomScreenPos(tile))');
    expect(appCore).toContain('const visualFired = triggerActiveLaserGunFinaleImpact(');
    expect(appCore).toContain('() => commitCubeImpact(true)');
    expect(appCore).toContain('// GSAP tick. This remains only the no-visual/timeout fallback.');
    expect(appCore).toContain('commitCubeImpact(visualArrived)');
    expect(appCore).toContain('waitForActiveLaserGunFinaleImpactArrival(i)');
    expect(appCore).toContain('waitTrackedResult(LASERGUN_ARRIVAL_TIMEOUT_MS)');
    expect(appCore).toContain("if (arrivalResult === 'cancelled') return false;");
    expect(appCore).toContain('if (laserGunRunGeneration !== gameplayRunGeneration) return false;');
    expect(appCore).toContain("if (arrivalResult === 'unavailable') return false;");
    expect(appCore).toContain("arrivalResult === 'arrived'");
    expect(appCore).toContain('cancelActiveLaserGunFinaleImpact(i);');
    expect(appCore).toContain('laserGunVisualsEnabled = false;');
    expect(appCore).toContain('commitCubeImpact(visualArrived)');
    expect(appCore).toContain('getLaserGunCubeAnticipationFrames().forEach((frame) => {');
    expect(appCore).toContain('x: LASERGUN_CUBE_ANTICIPATION_SCALE');
    expect(appCore).toContain("ease: 'back.out(2.1)'");
    expect(appCore).toContain('trackAppTimeout(commitImpactBreak, 900)');
    expect(appCore).toContain('if (impactProfile !== \'laser-gun\') emitImpactFx();');
    expect(appCore).toContain('const replacementValue = selectReplacementValue();');
    expect(appCore).toContain('// rebound. There is no neutral pose or second bounce sequence.');
    expect(appCore).toContain('regularMerge6ShardsTemplated(board, tile, {');
    expect(appCore).not.toContain("if (impactProfile !== 'laser-gun') {\n\t            try {\n\t              regularMerge6ShardsTemplated");
    expect(appCore).toContain('strength: i === 2 ? 9 : 12');
    expect(appCore).toContain("'.cc-lasergun-finale-scene, .cc-lasergun-right-gun-layer'");
    expect(appCore).toContain('runLaserGunSequentialImpactScheduler(');
    expect(appCore).toContain("laserGunVisualsEnabled = entryGate === 'painted'");
    expect(appCore).toContain('waitTrackedResult(1500)');
    expect(appCore).toContain('waitTrackedResult(900)');
    expect(appCore).toContain("ready ? 'prepared' as const : 'visual-unavailable' as const");
    expect(appCore).toContain("if (preparation === 'visual-unavailable')");
    expect(appCore).toContain('if (schedulerFinished) completeActiveLaserGunFinaleImpacts()');
    expect(appCore).toContain('await waitForActiveLaserGunFinaleBeamLaunch(');
    expect(tnt).toContain('if (!usesLaserGunScene) finishTntAnimation();');
    expect(tnt).toContain('finishTntAnimation();\n      },');
    expect(tnt).toContain('// finalized only by its real scene completion after beam four and exit.');
    expect(appCore).not.toContain('LASERGUN_IMPACT_DELAYS_MS');
    expect(appCore).toContain('(pos.x / screenW) * rect.width');
    expect(appCore).toContain("? (targets) => setActiveLaserGunFinaleTargets(targets)");
    expect(appCore).toContain("if (tntVariantForMerge?.id === 'laser-gun') return;");
    expect(tnt).toContain("options.finaleScene === 'lasergun-crossfire'");
    expect(tnt).toContain("const frameCacheSources = usesLaserGunScene ? ['lasergun-dom'] : preferred");
    expect(tnt).toContain('attachLaserGunFinaleScene(overlay');
    expect(scene).toContain("ease: 'back.out(2.35)'");
    expect(scene).toContain("ease: 'power2.in'");
    expect(scene).toContain("ease: 'power2.out'");
    expect(scene).not.toContain("ease: 'back.in(1.55)'");
    expect(scene).toContain('overflow:visible');
    expect(scene).toContain('const nominalOnstageX = getLaserGunStageCenterX(');
    expect(scene).toContain('const muzzleX = getLaserGunMuzzleX(');
    expect(scene).toContain('getLaserGunOffscreenTravel(');
    expect(scene).toContain('getLaserGunConstrainedTop(');
    expect(scene).not.toContain('preflight.to(shot.gun.rig');
    expect(scene).toContain('const { gun, beamPlan } = ensureGunBeamPair(shooter, sideIndex)');
    expect(scene).toContain('} = assignedShots[index]');
    expect(scene).not.toContain('startShotEntry(shotStates[0])');
    expect(scene).toContain('if (shot.entryStarted) return Promise.resolve(false);');
    expect(scene).toContain('shot.localTarget = liveLocalTarget;');
    expect(scene).toContain('}, LASERGUN_EXIT_DELAY_SECONDS);');
    expect(scene).toContain('getLaserGunRandomScales(boundedTargets.length, random)');
    expect(scene).toContain('const playGunFiringFlow = (shot: ShotState): gsap.core.Timeline =>');
    expect(scene).toContain('LASERGUN_FRAME_SOURCES.slice(1).forEach');
    expect(scene).toContain('revealRequestedBeam(shot);\n      settleBeamLaunch(shot, shot.beamVisible);');
    expect(scene).toContain('LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS\n        + (frameIndex + 1) * LASERGUN_FIRE_FRAME_STEP_SECONDS');
    expect(scene).toContain('shot.beamLaunchDelay = playGunFiringFlow(shot);');
    expect(scene).toContain('LASERGUN_FRAME_SOURCES.slice(0, 5).reverse()');
    expect(scene).not.toContain('preflight.to(shot.gun.aim');
    expect(scene).not.toContain('rotation: entryRotation');
    expect(scene).not.toContain('scale: placement.scale * 0.82');
    expect(scene).toContain('scaleX: placement.scaleX,');
    expect(scene).toContain('scaleY: placement.scaleY,');
    expect(scene).toContain('const liveFieldRect = field.getBoundingClientRect()');
    expect(scene).toContain('LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS = 0.3');
    expect(scene).toContain('if (LASERGUN_CUBE_REACTION_PRECEDES_BEAM_SECONDS > 0)');
    expect(scene).toContain('revealRequestedBeam(shot);');
    expect(scene).toContain('settleImpactArrival(shot, true);');
    expect(scene).toContain('undefined, LASERGUN_BEAM_TRAVEL_SECONDS');
    expect(scene).not.toContain('shot.arrivalFrameA = window.requestAnimationFrame');
    expect(scene).not.toContain('shot.arrivalFrameB = window.requestAnimationFrame');
    expect(scene).not.toContain('cc-lasergun-rendered-die');
    expect(scene).not.toContain('cc-lasergun-impact-rock');
    expect(scene).not.toContain('cc-lasergun-debris-field');
    expect(idle).toContain("const isLaserGun = getSpecialDiceVariantForTile(tile)?.id === 'laser-gun'");
    expect(idle).toContain("ease: 'back.out(2.2)'");
    expect(idle).toContain("ease: 'elastic.out(1, 0.45)'");
    expect(idle).toContain('const returnAt = steps * dt;');
    expect(idle).toContain('ease: returnEase }, returnAt);');
    expect(idle).toContain('const delay = 3 + Math.random() * 0.4');
    expect(idle).toContain('stopTntIdleShake(tile)');
    expect(idle).toContain('g.y = resetY');
    expect(appCore).toContain('wildSpawnCount,');
    expect(appCore).toContain('firstWildSpawned = v > 0');
  });
});
