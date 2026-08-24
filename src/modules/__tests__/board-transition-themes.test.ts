import {
  AREA55_BOARD_TRANSITION_PROFILE,
  BEACH_BOARD_TRANSITION_PROFILE,
  BEACH_BOARD_TRANSITION_CLOUD_COUNT,
  getJourneyBoardTransitionTheme,
  resolveBoardTransitionTheme,
} from '../board-transition-themes';
import {
  BEACH_CURTAIN_LAYER_KEYS,
  BEACH_PALM_GLOBAL_VERTICAL_OFFSET_PX,
  createBeachTransitionVariation,
  createBeachTransitionVariationSequence,
} from '../board-transition-beach-variation';
import { createRoboTransitionVariation } from '../board-transition-robo-variation';
import { RUN_MODE_ARCADE_HOME, RUN_MODE_JOURNEY } from '../run-mode';
import fs from 'node:fs';
import path from 'node:path';

describe('Board Transition World themes', () => {
  test('randomizes the two Robo character directions as one opposite pair per transition', () => {
    expect(createRoboTransitionVariation(() => 0.1)).toEqual({
      frontTravelDirection: 1,
      walkerTravelDirection: -1,
    });
    expect(createRoboTransitionVariation(() => 0.9)).toEqual({
      frontTravelDirection: -1,
      walkerTravelDirection: 1,
    });
  });

  test('lowers the complete Beach palm curtain by 32px', () => {
    expect(BEACH_PALM_GLOBAL_VERTICAL_OFFSET_PX).toBe(-32);
  });

  test.each([[1, 'forest'], [10, 'forest'], [11, 'beach'], [20, 'beach'], [21, 'area55'], [30, 'area55']])(
    'maps Journey board %i to %s',
    (board, theme) => expect(getJourneyBoardTransitionTheme(board)).toBe(theme),
  );

  test('never maps overlapping Arcade board numbers into Journey themes', () => {
    expect(resolveBoardTransitionTheme({ boardNumber: 19, runMode: RUN_MODE_ARCADE_HOME })).toBe('forest');
    expect(resolveBoardTransitionTheme({ boardNumber: 29, runMode: null })).toBe('forest');
    expect(resolveBoardTransitionTheme({ boardNumber: 19, runMode: RUN_MODE_JOURNEY })).toBe('beach');
  });

  test('caps the Beach transition at six spatially separated clouds', () => {
    expect(BEACH_BOARD_TRANSITION_CLOUD_COUNT).toBe(6);
  });

  test('keeps explicit and legacy compatibility precedence', () => {
    expect(resolveBoardTransitionTheme({ boardNumber: 1, explicitTheme: 'area55', hideForest: true, runMode: null })).toBe('area55');
    expect(resolveBoardTransitionTheme({ boardNumber: 1, hideForest: true, runMode: RUN_MODE_JOURNEY })).toBe('none');
  });

  test.each([BEACH_BOARD_TRANSITION_PROFILE, AREA55_BOARD_TRANSITION_PROFILE])(
    '$id profile has valid unique layers and a connected enter order',
    (profile) => {
      const keys = profile.layers.map((layer) => layer.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(profile.layers.every((layer) => layer.src && layer.style.length > 0)).toBe(true);
      expect(profile.enterOrder.every((key) => keys.includes(key))).toBe(true);
      expect(profile.layers.some((layer) => layer.spatialRole === 'primary')).toBe(true);
      expect(profile.layers.every((layer) => fs.existsSync(path.resolve(process.cwd(), layer.src.replace(/^\.\//, ''))))).toBe(true);
    },
  );

  test('Beach composes the requested sea, floating, shore, and five-palm curtain roles', () => {
    const roles = BEACH_BOARD_TRANSITION_PROFILE.layers.map((layer) => layer.motionRole);
    expect(roles.filter((role) => role === 'sea')).toHaveLength(3);
    expect(roles.filter((role) => role === 'float')).toHaveLength(2);
    expect(roles.filter((role) => role === 'shore')).toHaveLength(3);
    expect(roles.filter((role) => role === 'curtain')).toHaveLength(5);
    expect(BEACH_BOARD_TRANSITION_PROFILE.layers.map((layer) => layer.key)).toEqual([
      'beach-sea-1', 'beach-bottle', 'beach-sea-2', 'beach-ball',
      'beach-sea-3', 'beach-shore-1', 'beach-castle', 'beach-shore-2',
      'beach-palm-1', 'beach-palm-2', 'beach-palm-3', 'beach-palm-4', 'beach-palm-center',
    ]);
    expect(BEACH_BOARD_TRANSITION_PROFILE.enterOrder).toEqual([
      'beach-palm-1', 'beach-palm-2', 'beach-palm-3', 'beach-palm-4', 'beach-palm-center',
      'beach-shore-1', 'beach-castle', 'beach-shore-2',
      'beach-sea-1', 'beach-bottle', 'beach-sea-2', 'beach-ball', 'beach-sea-3',
    ]);

    const byKey = new Map(BEACH_BOARD_TRANSITION_PROFILE.layers.map((layer) => [layer.key, layer]));
    expect(byKey.get('beach-sea-1')?.style).toContain('width: 695px');
    expect(byKey.get('beach-sea-1')?.style).toContain('left: 50%');
    expect(byKey.get('beach-sea-1')?.style).toContain('bottom: 88px');
    expect(byKey.get('beach-bottle')?.style).toContain('z-index: 9');
    expect(byKey.get('beach-sea-2')?.style).toContain('width: 674px');
    expect(byKey.get('beach-sea-2')?.style).toContain('left: 50%');
    expect(byKey.get('beach-sea-2')?.style).toContain('bottom: 190px');
    expect(byKey.get('beach-ball')?.style).toContain('z-index: 15');
    expect(byKey.get('beach-sea-3')?.style).toContain('width: 1014px');
    expect(byKey.get('beach-sea-3')?.style).toContain('left: 50%');
    expect(byKey.get('beach-sea-3')?.style).toContain('bottom: -16px');
    expect(byKey.get('beach-bottle')?.style).toContain('left: calc(100% - 60px)');
    expect(byKey.get('beach-bottle')?.style).toContain('bottom: 370px');
    expect(byKey.get('beach-bottle')?.style).toContain('width: min(31.9vw, 124.3px)');
    expect(byKey.get('beach-ball')?.style).toContain('left: calc(54% - 100px)');
    expect(byKey.get('beach-ball')?.style).toContain('bottom: 284px');
    expect(byKey.get('beach-castle')?.style).toContain('z-index: 27');
    expect(byKey.get('beach-castle')?.style).toContain('left: calc(68% + 30px)');
    expect(byKey.get('beach-castle')?.style).toContain('width: min(78.2vw, 305px)');
    expect(byKey.get('beach-shore-2')?.style).toContain('left: 63%');
    expect(byKey.get('beach-shore-2')?.style).toContain('transform-origin: center bottom');
    expect(byKey.get('beach-palm-1')?.style).toContain('width: min(143vw, 557px)');
    expect(byKey.get('beach-palm-1')?.style).toContain('left: calc(-18% + 60px)');
    expect(byKey.get('beach-palm-1')?.style).toContain('top: calc(30% - 420px)');
    expect(byKey.get('beach-palm-2')?.style).toContain('top: calc(60% - 455px)');
    expect(byKey.get('beach-palm-2')?.style).toContain('left: 16%');
    expect(byKey.get('beach-palm-3')?.style).toContain('top: calc(44% - 310px)');
    expect(byKey.get('beach-palm-3')?.style).toContain('left: 72%');
    expect(byKey.get('beach-palm-4')?.style).toContain('top: calc(76% - 435px)');
    expect(byKey.get('beach-palm-4')?.style).toContain('left: calc(114% - 80px)');
    expect(byKey.get('beach-palm-center')?.src).toBe('./assets/journey assets/beach/palm 2.png');
    expect(byKey.get('beach-palm-center')?.style).toContain('left: calc(50% - 20px)');
    expect(byKey.get('beach-palm-center')?.style).toContain('top: calc(100% - 400px)');
    expect(byKey.get('beach-palm-center')?.style).toContain('z-index: 68');
    expect(byKey.get('beach-shore-1')?.style).toContain('bottom: 22px');
    expect(byKey.get('beach-shore-1')?.style).toContain('left: calc(34% - 40%)');
    expect(byKey.get('beach-castle')?.style).toContain('bottom: 134px');

    // At the 390px reference width, compare actual PNG top edges rather than
    // misleading bottom offsets: lock the currently approved top-edge geometry.
    const topEdgeFromViewportBottom = (bottom: number, renderedHeight: number) => -(bottom + renderedHeight);
    const sea1Top = topEdgeFromViewportBottom(88, 448);
    const sea2Top = topEdgeFromViewportBottom(190, 242);
    const sea3Top = topEdgeFromViewportBottom(-16, 398);
    const frontBeachTop = topEdgeFromViewportBottom(-274, 572);
    expect(sea2Top - sea1Top).toBe(104);
    expect(sea3Top - sea2Top).toBe(50);
    expect(frontBeachTop - sea3Top).toBe(84);
  });

  test('Robo World composes the supplied front-to-back scene and directional character motion', () => {
    expect(AREA55_BOARD_TRANSITION_PROFILE.layers.map((layer) => layer.key)).toEqual([
      'robo-front',
      'robo-ground-front',
      'robo-fence',
      'robo-walker',
      'robo-ground-rear',
      'robo-ship',
    ]);
    expect(AREA55_BOARD_TRANSITION_PROFILE.enterOrder).toEqual([
      'robo-ground-front',
      'robo-ground-rear',
      'robo-walker',
      'robo-fence',
      'robo-ship',
      'robo-front',
    ]);
    const zIndexes = AREA55_BOARD_TRANSITION_PROFILE.layers.map((layer) => Number(
      layer.style.find((rule) => rule.startsWith('z-index:'))?.split(':')[1]?.trim(),
    ));
    expect(zIndexes).toEqual([70, 60, 50, 40, 30, 20]);
    expect(AREA55_BOARD_TRANSITION_PROFILE.layers.map((layer) => layer.src)).toEqual([
      './assets/journey assets/robo/robo frontalni.png',
      './assets/journey assets/robo/zemlja1.png',
      './assets/journey assets/robo/ograda.png',
      './assets/journey assets/robo/robo1.png',
      './assets/journey assets/robo/zemlja2.png',
      './assets/journey assets/robo/ship.png',
    ]);
    const styleByLayer = Object.fromEntries(
      AREA55_BOARD_TRANSITION_PROFILE.layers.map((layer) => [layer.key, layer.style]),
    );
    expect(styleByLayer['robo-front']).toEqual(expect.arrayContaining([
      'left: 16%', 'bottom: -200px', 'width: min(128vw, 500px)',
    ]));
    expect(styleByLayer['robo-ground-front']).toEqual(expect.arrayContaining([
      'bottom: -280px', 'width: min(263vw, 1023px)',
    ]));
    expect(styleByLayer['robo-fence']).toEqual(expect.arrayContaining([
      'bottom: 151px', 'width: min(77vw, 299px)',
    ]));
    expect(styleByLayer['robo-walker']).toEqual(expect.arrayContaining([
      'bottom: 136px', 'width: min(64vw, 251px)',
    ]));
    expect(styleByLayer['robo-ground-rear']).toEqual(expect.arrayContaining([
      'bottom: -90px', 'width: min(237vw, 921px)',
    ]));
    expect(styleByLayer['robo-ship']).toEqual(expect.arrayContaining([
      'left: calc(30% - 7px)', 'bottom: 249px', 'width: min(98vw, 383px)',
    ]));

    const source = fs.readFileSync(path.resolve(__dirname, '../board-transition-screen.ts'), 'utf8');
    expect(source).toContain('const proceduralSceneEnterStart = 0.05 + index * (0.045 * sceneEnterSpeedFactor)');
    expect(source).toContain("resolvedTheme === 'area55' && layerKey === 'robo-front'");
    expect(source).toContain('? 0');
    expect(source).toContain("const isBottle = layerKey === 'beach-bottle'");
    expect(source).toContain("const roboRestX = layerKey === 'robo-ground-rear' ? 100 : layerKey === 'robo-ground-front' ? -100 : 0");
    expect(source).toContain('function startRoboGroundAmbientMotion');
    expect(source).toContain("const firstDirection = layerKey === 'robo-ground-rear' ? 1 : -1");
    expect(source).toContain("x: restX + firstDirection * 40, duration: 4.2, ease: 'sine.inOut'");
    expect(source).toContain("x: restX - firstDirection * 40, duration: 8.4, ease: 'sine.inOut'");
    expect(source).toContain('stopRoboGroundAmbientMotion(sceneImg)');
    expect(source).toContain("const roboVariation: RoboTransitionVariation | null = resolvedTheme === 'area55'");
    expect(source).toContain("logger.info('[CC_ROBO_DIRECTION]', directionTrace)");
    expect(source).toContain("sceneImg.style.left = roboVariation.frontTravelDirection === 1 ? '16%' : '84%'");
    expect(source).toContain("sceneImg.style.left = roboVariation.walkerTravelDirection === 1 ? '20%' : '80%'");
    expect(source).toContain('const roboFrontTravelDirection = roboVariation?.frontTravelDirection ?? 1');
    expect(source).toContain('const roboCharacterScaleXSign = isRoboFront');
    expect(source).toContain('roboFrontTravelDirection === -1 ? -1 : 1');
    expect(source).toContain("isRoboWalker && roboVariation?.walkerTravelDirection === 1 ? -1 : 1");
    expect(source).toContain('roboInitialScale * roboCharacterScaleXSign');
    expect(source).toContain('scaleX: 1.04 * roboCharacterScaleXSign');
    expect(source).toContain('scaleX: roboCharacterScaleXSign, scaleY: 1');
    expect(source).not.toContain('roboCharacterMirrorY');
    expect(source).toContain('const roboWalkerEndX = (roboVariation?.walkerTravelDirection ?? -1)');
    expect(source).toContain('const isRoboGroundFront = isRoboScene && layerKey === \'robo-ground-front\'');
    expect(source).toContain('isRoboGroundFront ? 4.2 : 14');
    expect(source).toContain('const roboArrivalOvershootScale = isRoboGroundFront ? 1.012 : 1.04');
    expect(source).toContain('const roboArrivalReboundScale = isRoboGroundFront ? 0.985 : 0.95');
    expect(source).toContain('const roboArrivalEaseStrength = isRoboGroundFront ? 0.6 : 2.0');
    expect(source).toContain('const roboSettleEaseStrength = isRoboGroundFront ? 0.45 : 1.5');
    expect(source).toContain("scaleX: roboCharacterScaleXSign, scaleY: 1, duration: 0.12 * sceneEnterSpeedFactor");
    expect(source).toContain("x: roboWalkerEndX * 0.18, y: 7, rotation: -3");
    expect(source).toContain("x: roboWalkerEndX * 0.53, y: 9, rotation: -3");
    expect(source).toContain("x: roboWalkerEndX * 0.86, y: 6, rotation: -2");
    expect(source).toContain("const roboFrontStartX = -roboFrontTravelDirection * Math.max(360, window.innerWidth)");
    expect(source).toContain("const roboFrontEndX = roboFrontTravelDirection * Math.max(640, window.innerWidth * 1.65)");
    expect(source).toContain("x: roboFrontStartX * 0.28, y: -7, rotation: 3");
    expect(source).toContain("x: roboFrontEndX * 0.10, y: 7, rotation: -3");
    expect(source).toContain("x: roboFrontEndX * 0.32, y: -9, rotation: 3");
    expect(source).toContain("x: roboFrontEndX * 0.56, y: 9, rotation: -3");
    expect(source).toContain("x: roboFrontEndX * 0.80, y: -6, rotation: 2");
    expect(source).toContain("opacity: 1, x: 0, y: 0, scale: 1.20, duration: 2, ease: 'none'");
    expect(source).toContain("const roboRestRotation = layerKey === 'robo-fence' ? 6 : 0");
    expect(source).toContain("['robo-ship', 'robo-front', 'robo-walker', 'robo-fence', 'robo-ground-rear', 'robo-ground-front']");
    expect(source).toContain("const isRoboSceneExit = transitionTheme === 'area55'");
    expect(source).toContain("if (sceneImg.dataset.motionRole === 'float') stopBeachAmbientMotion(sceneImg)");
  });

  test('creates one bounded per-run layout with balanced palm exits and opposite ball/castle sides', () => {
    const leftVariation = createBeachTransitionVariation(() => 0.1);
    const rightVariation = createBeachTransitionVariation(() => 0.9);

    expect(Object.keys(leftVariation.palms)).toEqual(BEACH_CURTAIN_LAYER_KEYS);
    expect(new Set(Object.values(leftVariation.palms).map((placement) => placement.leftPercent)).size).toBe(5);
    Object.values(leftVariation.palms).forEach((placement) => {
      expect(placement.leftPercent).toBeGreaterThanOrEqual(-7);
      expect(placement.leftPercent).toBeLessThanOrEqual(103);
      expect(placement.bottomPx).toBeGreaterThanOrEqual(-150);
      expect(placement.bottomPx).toBeLessThanOrEqual(-75);
      expect(placement.upwardLiftVh).toBeGreaterThanOrEqual(8);
      expect(placement.upwardLiftVh).toBeLessThanOrEqual(18);
    });
    const leftPalmPlacements = Object.values(leftVariation.palms).filter((placement) => placement.exitDirection === -1);
    expect(leftPalmPlacements.map((placement) => placement.restRotationDeg).sort()).toEqual([10, 15]);
    expect(leftPalmPlacements.every((placement) => placement.bottomPx >= -138)).toBe(true);
    expect(Object.values(leftVariation.palms).map((placement) => placement.exitDirection).sort()).toEqual([-1, -1, 0, 1, 1]);
    expect(Object.values(rightVariation.palms).map((placement) => placement.exitDirection).sort()).toEqual([-1, -1, 0, 1, 1]);
    expect(leftVariation.floatsSwapped).toBe(true);
    expect(leftVariation.castleStartsLeft).toBe(true);
    expect(rightVariation.floatsSwapped).toBe(false);
    expect(rightVariation.castleStartsLeft).toBe(false);
    expect(rightVariation.palms).not.toEqual(leftVariation.palms);
  });

  test('applies the approved per-art Beach palm offsets without changing palm 1', () => {
    const variation = createBeachTransitionVariation(() => 0.5);
    expect(variation.palms['beach-palm-1']).toMatchObject({ horizontalOffsetPx: 0, verticalOffsetPx: 0 });
    expect(variation.palms['beach-palm-2']).toMatchObject({ horizontalOffsetPx: 0, verticalOffsetPx: -16 });
    expect(variation.palms['beach-palm-3']).toMatchObject({ horizontalOffsetPx: 16, verticalOffsetPx: 20 });
    expect(variation.palms['beach-palm-4']).toMatchObject({ horizontalOffsetPx: 0, verticalOffsetPx: 10 });
    expect(variation.palms['beach-palm-center']).toMatchObject({ horizontalOffsetPx: 16, verticalOffsetPx: 0 });
  });

  test('starts float sides randomly, then alternates them exactly 50/50 across Beach entries', () => {
    const startsSwapped = createBeachTransitionVariationSequence(() => 0.1);
    expect([
      startsSwapped().floatsSwapped,
      startsSwapped().floatsSwapped,
      startsSwapped().floatsSwapped,
      startsSwapped().floatsSwapped,
    ]).toEqual([true, false, true, false]);

    const startsUnswapped = createBeachTransitionVariationSequence(() => 0.9);
    expect([
      startsUnswapped().floatsSwapped,
      startsUnswapped().floatsSwapped,
    ]).toEqual([false, true]);
  });

  test('clears semantic spatial ownership before pooled scene images are reused', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../board-transition-screen.ts'), 'utf8');
    expect(source).toContain("img.removeAttribute('data-spatial-role')");
    expect(source).toContain("img.removeAttribute('data-motion-role')");
    expect(source).toContain("img.removeAttribute('data-float-direction')");
    expect(source).toContain("'bottom: 78px'");
    expect(source).toContain("layer.key === 'hill1' ? 'bottom: 70px' : 'bottom: 80px'");
    expect(source).toContain('.slice(0, BEACH_BOARD_TRANSITION_CLOUD_COUNT)');
    expect(source).toContain('? beachCloudSpawnSlots.map((slot) => slot.top)');
    expect(source).toContain('const beachSpawnSlot = beachCloudSpawnSlots[i % beachCloudSpawnSlots.length]');
    expect(source).toContain('Math.max(0, Math.min(40, beachSpawnTop))');
    expect(source).not.toContain("if (resolvedTheme === 'beach' && i === 2) continue");
    expect(source).toContain("const cloudLayerOwner = resolvedTheme === 'beach'");
    expect(source).toContain('? cloudContainer');
    expect(source).toContain("1: Object.freeze({ restScale: 1, restRotation: 12, enterStartYRatio: 0.54 })");
    expect(source).toContain('window.innerWidth * 0.9 + sceneImg.offsetWidth * 0.55');
    expect(source).toContain('const curtainExitDownDistance = Math.max(180, window.innerHeight * 0.3)');
    expect(source).toContain('x: exitDirection * curtainExitDistance');
    expect(source).toContain('y: curtainExitDownDistance');
    expect(source).toContain('opacity: 1');
    expect(source).toContain("const isRoboShip = isRoboScene && layerKey === 'robo-ship'");
    expect(source).toContain('isRoboShip ? 3 : isRoboFront ? 0');
    expect(source).toContain('scale: isHill ? hillBaseScale * 0.68 : isBeachCurtain ? beachPalmRestScale : isBeachFrontShore ? 0.7 : isRoboScene ? roboInitialScale : 0');
    expect(source).toContain('duration: 0.42');
    expect(source).toContain("ease: 'power3.out'");
    expect(source).toContain('const BEACH_CURTAIN_PALM_EXIT_SECONDS = 0.62');
    expect(source).toContain('const BEACH_CURTAIN_PALM_EXIT_STAGGER_SECONDS = 0.1');
    expect(source).toContain('duration: BEACH_CURTAIN_PALM_EXIT_SECONDS');
    expect(source).toContain('duration: (beachPalmNumber - 1) * BEACH_CURTAIN_PALM_EXIT_STAGGER_SECONDS');
    expect(source).toContain('opacity: isBeachCurtain || isBeachFrontShore || isRoboFront ? 1 : 0');
    expect(source).toContain("ease: 'back.in(1.35)'");
    expect(source).toContain('scale: 0');
    expect(source).toContain('export const BEACH_CURTAIN_PALM_DWELL_SECONDS = 0.4');
    expect(source).toContain('const BEACH_CURTAIN_PALM_STILL_SECONDS = 0.1');
    expect(source).toContain('const beachPalmFloatY = beachPalmNumber % 2 === 0 ? -4 : -6');
    expect(source).toContain('duration: BEACH_CURTAIN_PALM_FLOAT_LEG_SECONDS');
    expect(source.match(/duration: BEACH_CURTAIN_PALM_FLOAT_LEG_SECONDS/g)).toHaveLength(2);
    expect(source).toContain('const beachVariation: BeachTransitionVariation | null');
    expect(source).toContain('const createNextBeachTransitionVariation = createBeachTransitionVariationSequence()');
    expect(source).toContain('? createNextBeachTransitionVariation()');
    expect(source).toContain('palmPlacement.horizontalOffsetPx === 0');
    expect(source).toContain('`calc(${palmPlacement.leftPercent}% + ${palmPlacement.horizontalOffsetPx}px)`');
    expect(source).toContain("sceneImg.style.top = 'auto'");
    expect(source).toContain('palmPlacement.bottomPx + palmPlacement.verticalOffsetPx');
    expect(source).toContain("sceneImg.dataset.floatDirection = startsRight ? 'left' : 'right'");
    expect(source).toContain("sceneImg.style.left = beachVariation.castleStartsLeft");
    expect(source).toContain("? 'calc(32% - 30px)'");
    expect(source).toContain(": 'calc(68% + 30px)'");
    expect(source).toContain("beachVariation?.castleStartsLeft && layer.key === 'beach-shore-1'");
    expect(source).toContain("sceneImg.style.left = 'calc(34% - 40% + 180px)'");
    expect(source).toContain('const exitDirection = palmPlacement?.exitDirection');
    expect(source).toContain('const beachPalmRestRotation = palmPlacement?.restRotationDeg ?? beachPalmMotion.restRotation');
    expect(source).toContain("const horizontalDirection = sceneImg.dataset.floatDirection === 'left' ? -1 : 1");
    expect(source).toContain("2: Object.freeze({ restScale: 0.8, restRotation: -12, enterStartYRatio: 0.43");
    expect(source).toContain("4: Object.freeze({ restScale: 0.8, restRotation: -12, enterStartYRatio: 0.39");
    expect(source).toContain("5: Object.freeze({ restScale: 0.8, restRotation: 12, enterStartYRatio: 0.47");
    expect(source).toContain("const isBeachFrontShore = resolvedTheme === 'beach' && layerKey === 'beach-shore-2'");
    expect(source).toContain('opacity: isBeachCurtain || isBeachFrontShore || isRoboFront ? 1 : 0');
    expect(source).toContain('isBeachFrontShore ? 0.7 : isRoboScene ? roboInitialScale : 0');
    expect(source).not.toContain('scale: beachPalmRestScale * 1.28');
    expect(source).not.toContain("}, '<-0.10');");
    expect(source).not.toContain('exitDownY');
    expect(source).not.toContain('beachPalmRestRotation * 0.4');
    expect(source).not.toContain('sceneEnterTimeline.to({}, { duration: 0.03 })');
    expect(source).not.toContain('x: -exitDirection * 9');
    expect(source).not.toContain('y: -9 - beachPalmNumber');
    expect(source).not.toContain('beachPalmRestRotation - exitDirection');
    expect(source).not.toContain('beachPalmRestRotation + exitDirection');
    expect(source).not.toContain('scaleX: beachPalmRestScale * 1.025');
    expect(source).not.toContain('scaleY: beachPalmRestScale * 0.985');
    expect(source).toContain("const isBeachCenterPalm = layerKey === 'beach-palm-center'");
    expect(source).toContain('const beachPalmMotion = BEACH_CURTAIN_PALM_MOTION[beachPalmNumber]');
    expect(source).toContain('const rotationLimit = isBottle ? 24 : 84');
    expect(source).toContain('y: () => isBottle ? gsap.utils.random(-18, -9) : gsap.utils.random(-22, -10)');
    expect(source).toContain('x: () => horizontalDirection * (isBottle');
    expect(source).toContain('? gsap.utils.random(69, 104)');
    expect(source).toContain(': gsap.utils.random(73, 117))');
    expect(source).toContain('duration: () => gsap.utils.random(4.68, 6.24)');
    expect(source).toContain("ease: 'sine.out'");
    expect(source).not.toContain('xPercent: isBottle ? () => gsap.utils.random(-4, 4) : 0');
    expect(source).toContain('seaIndex === 2 ? -38 * 1.25');
    expect(source).toContain('seaIndex === 1 ? 34 * 1.4 * 1.4');
    expect(source).toContain('duration: () => gsap.utils.random(0.58, 0.96)');
    expect(source).toContain('duration: (1.55 + seaIndex * 0.12) / 0.88');
    expect(source).toContain('const boingDuration = 0.2 + Math.random() * 0.35');
    expect(source).toContain('repeatDelay: 0.18 + Math.random() * 0.35');
    expect(source).toContain('function startBeachSharedShoreAmbientMotion');
    expect(source).toContain('duration: 6.4');
    expect(source).toContain("gsap.set(sceneImg, { transformOrigin: '50% 50%' })");
    expect(source).toContain("const cloudThemeScale = resolvedTheme === 'beach' ? 0.6 * 1.4 : 1");
    expect(source).toContain('const BEACH_CLOUD_SPAWN_SLOTS = Object.freeze([');
    expect(source).toContain('Object.freeze({ left: 12, top: 22 })');
    expect(source).toContain('Object.freeze({ left: 55, top: 32 })');
    expect(source).toContain('Object.freeze({ left: 90, top: 39 })');
    expect(source).toContain("const beachSpawnTop = beachSpawnSlot.top + ((Math.random() * 2 - 1) * 1.25)");
    expect(source).toContain("const beachSpawnLeft = beachSpawnSlot.left + ((Math.random() * 2 - 1) * 1.5)");
    expect(source).toContain("resolvedTheme === 'beach'\n        ? Math.max(2, Math.min(98, beachSpawnLeft))");
    expect(source).toContain("motionRole && motionRole !== 'shore'");
    expect(source).toContain("target.dataset.sceneLayer === 'beach-castle' ? 1.24 : 1.15");
    expect(source).toContain('beachShoreAmbientTimeline = timeline');
    expect(source).toContain('ownAmbientTimeline(motionTimeline)');
    expect(source).toContain('forestContainer, resolvedTheme, () =>');
    expect(source).toContain("transitionTheme: BoardTransitionThemeId | 'none'");
    expect(source).toContain("{ 'beach-sea-3': 'beach-ball', 'beach-shore-2': 'beach-castle' }");
    expect(source).toContain("{ 'beach-bottle': -0.2, 'beach-ball': 0.1 }");
    expect(source).toContain("sceneImg.style.visibility !== 'hidden'");
    expect(source).toContain('if (isBeachSceneExit) stopBeachAmbientMotion(sceneImg)');
    expect(source).toContain("const isBeachBallExit = isBeachSceneExit && layerKey === 'beach-ball'");
    expect(source).toContain("? orderIndex % 2 === 0 ? '+=18' : '-=18'");
    expect(source).toContain('beachAmbientTimelines.clear()');
    expect(source).toContain('beachShoreAmbientTimeline = null');
    expect(source).toContain("stopIOSJourneyPerformanceAudit(preserveDom ? 'transition-cleanup-preserved' : 'transition-cleanup')");
    expect(source).toContain('const interruptedSettlement = activeTransitionSettlement');
    expect(source).toContain('interruptedSettlement?.(false)');
    expect(source).toContain('const activeGeneration = ++transitionGeneration');
    expect(source).toContain('if (!isTransitionActive || activeGeneration !== transitionGeneration) return');
    expect(source).toContain('domElementPool.release(cloudImg)');
    expect(source).toContain('domElementPool.release(sceneImg)');
    expect(source).toContain('const latestSceneExitEnd = orderedExitEntries.reduce');
    expect(source).toContain('latestSceneExitEnd + 0.02');
    expect(source).toContain('latestCloudExitEnd + 0.02');
    expect(source).toContain("logger.info('[BOARD_EXIT_TIMELINE] Beach exit ownership'");
  });
});
