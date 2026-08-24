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
      'robo-fence-static-left',
      'robo-fence-static-right',
      'robo-fighter-left',
      'robo-fighter-right',
      'robo-beam-right',
      'robo-beam-hit',
      'robo-beam-after',
    ]);
    expect(AREA55_BOARD_TRANSITION_PROFILE.enterOrder).toEqual([
      'robo-ground-front',
      'robo-ground-rear',
      'robo-walker',
      'robo-fence',
      'robo-fence-static-left',
      'robo-fence-static-right',
      'robo-front',
      'robo-fighter-left',
      'robo-fighter-right',
      'robo-beam-right',
      'robo-beam-hit',
      'robo-beam-after',
    ]);
    const zIndexes = AREA55_BOARD_TRANSITION_PROFILE.layers.map((layer) => Number(
      layer.style.find((rule) => rule.startsWith('z-index:'))?.split(':')[1]?.trim(),
    ));
    expect(zIndexes).toEqual([70, 60, 50, 40, 30, 20, 20, 73, 76, 29, 59, 59]);
    expect(AREA55_BOARD_TRANSITION_PROFILE.layers.map((layer) => layer.src)).toEqual([
      './assets/journey assets/robo/robo frontalni.png',
      './assets/journey assets/robo/zemlja1.png',
      './assets/journey assets/robo/ograda.png',
      './assets/journey assets/robo/robo1.png',
      './assets/journey assets/robo/zemlja2.png',
      './assets/journey assets/robo/ograda.png',
      './assets/journey assets/robo/ograda.png',
      './assets/journey assets/robo/ship1.png',
      './assets/journey assets/robo/ship1.png',
      './assets/journey assets/robo/beam2.png',
      './assets/journey assets/robo/beam3.png',
      './assets/journey assets/robo/beam1.png',
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
    expect(styleByLayer['robo-fence-static-left']).toEqual(expect.arrayContaining([
      'left: calc(30% - 31px)', 'bottom: 323px', 'width: 150px',
    ]));
    expect(styleByLayer['robo-fence-static-right']).toEqual(expect.arrayContaining([
      'left: calc(70% + 31px)', 'bottom: 323px', 'width: 150px',
    ]));
    expect(styleByLayer['robo-fighter-left']).toEqual(expect.arrayContaining([
      'left: calc(50% - 55px)', 'bottom: 470px', 'width: 90px', 'z-index: 73', 'opacity: 0',
    ]));
    expect(styleByLayer['robo-fighter-right']).toEqual(expect.arrayContaining([
      'left: calc(50% + 55px)', 'bottom: 450px', 'width: 108px', 'z-index: 76', 'opacity: 0',
    ]));
    expect(styleByLayer['robo-beam-left']).toBeUndefined();
    expect(styleByLayer['robo-beam-right']).toEqual(expect.arrayContaining(['width: 264.5px']));
    expect(styleByLayer['robo-beam-right']).toEqual(expect.arrayContaining(['left: calc(50% + 76px)', 'bottom: 430px', 'z-index: 29']));
    expect(styleByLayer['robo-beam-hit']).toEqual(expect.arrayContaining(['bottom: 450px', 'z-index: 59']));
    expect(styleByLayer['robo-beam-after']).toEqual(expect.arrayContaining(['left: calc(50% + 78px)', 'width: 264.5px', 'z-index: 59']));

    const source = fs.readFileSync(path.resolve(__dirname, '../board-transition-screen.ts'), 'utf8');
    expect(source).toContain('const proceduralSceneEnterStart = 0.05 + index * (0.045 * sceneEnterSpeedFactor)');
    expect(source).toContain('const roboGroundBounceCompleteSeconds = 0.62');
    expect(source).toContain("resolvedTheme === 'area55'");
    expect(source).toContain(': !isRoboGroundLayer');
    expect(source).toContain('? roboGroundBounceCompleteSeconds + Math.max(0, index - 2)');
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
    expect(source).toContain("sceneImg.dataset.travelDirection = roboVariation.walkerTravelDirection === 1");
    expect(source).toContain('const roboFrontTravelDirection = roboVariation?.frontTravelDirection ?? 1');
    expect(source).toContain('const roboWalkerTravelDurationScale = 1 / 0.60');
    expect(source).toContain('const roboFrontTravelDurationScale = 1 / 0.70');
    expect(source).not.toContain('characterMotionDurationSeconds');
    expect(source).toContain('const roboCharacterScaleXSign = isRoboFront');
    expect(source).toContain('roboFrontTravelDirection === -1 ? -1 : 1');
    expect(source).toContain('const roboWalkerTravelDirection = roboVariation?.walkerTravelDirection ?? -roboFrontTravelDirection');
    expect(source).toContain('isRoboWalker && roboWalkerTravelDirection === 1 ? -1 : 1');
    expect(source).toContain('roboInitialScale * roboCharacterScaleXSign');
    expect(source).toContain('scaleX: 1.04 * roboCharacterScaleXSign');
    expect(source).toContain('scaleX: roboCharacterScaleXSign, scaleY: 1');
    expect(source).not.toContain('roboCharacterMirrorY');
    expect(source).toContain('const roboWalkerEndX = roboWalkerTravelDirection * Math.max(');
    expect(source).toContain('(window.innerWidth || 390) + sceneImg.offsetWidth * 1.5');
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
    expect(source).toContain("const roboInitialScale = isRoboFront ? 1 : 0");
    expect(source).toContain("layerKey === 'robo-fence-static-left' || layerKey === 'robo-fence-static-right'");
    expect(source).toContain("const roboStaticFenceScaleXSign = layerKey === 'robo-fence-static-right' ? -1 : 1");
    expect(source).not.toContain("layerKey === 'robo-ship'");
    expect(source).toContain('function startRoboAirCombatMotion');
    expect(source).toContain("const digitEnterBaseDelay = resolvedTheme === 'area55' ? 1.3 : 0.3");
    expect(source).toContain('const delay = digitEnterBaseDelay + (index * 0.3)');
    expect(source).toContain('scale: 1.15');
    expect(source).toContain('const fighterOnScreenX = Math.min(118, (window.innerWidth || 390) * 0.30)');
    expect(source).toContain('const leftShip = sceneImagesByKey.get(\'robo-fighter-left\')');
    expect(source).toContain('const rightShip = sceneImagesByKey.get(\'robo-fighter-right\')');
    expect(source).toContain('const rightShipBaseScale = leftShipBaseScale * 1.40');
    expect(source).toContain('const rightShipEnterScale = rightShipBaseScale * 0.80');
    expect(source).toContain('gsap.set(leftShip, { x: -fighterOnScreenX, y: -104, scale: leftShipBaseScale })');
    expect(source).toContain('gsap.set(rightShipMotion, { x: fighterOnScreenX, y: -42, scale: rightShipEnterScale })');
    expect(source).toContain('const LEFT_SHIP_START_DELAY_SECONDS = 0');
    expect(source).toContain("const timeline = trackTimeline({ paused: true })");
    expect(source).toContain('trackTimeline({ repeat: -1, delay: startDelay, paused: true })');
    expect(source).toContain('trackTimeline({ delay, paused: true })');
    expect(source).toContain('rightShipMotion.dataset.sceneLayer = \'robo-fighter-right\'');
    expect(source).toContain("rightShip.removeAttribute('data-scene-layer')");
    expect(source).toContain('roboAirCombatTimelines.forEach((ownedTimeline) => ownedTimeline.play(0))');
    expect(source).toContain('enterTimeline.call(() => {');
    expect(source).toContain('}, undefined, 0)');
    expect(source).toContain('], LEFT_SHIP_START_DELAY_SECONDS, crossingVariation.leftBankPhase);');
    expect(source).toContain('const fighterFlightDurationSeconds = 3.00');
    expect(source).not.toContain('leftShipEscapeTimeline');
    expect(source).not.toContain('rightShipEscapeTimeline');
    expect(source).toContain('], 0, crossingVariation.rightBankPhase);');
    expect(source).toContain('x: gsap.utils.random(-18, 18)');
    expect(source).toContain('y: gsap.utils.random(-14, 14)');
    expect(source).toContain('scale: leftShipBaseScale * 1.50');
    expect(source).toContain('scale: rightShipBaseScale * 1.60');
    expect(source).toContain('const nnAppearSeconds = 1.30');
    expect(source).toContain('x: leftShipBeforeNn.x + 50');
    expect(source).toContain('y: leftShipBeforeNn.y - 68');
    expect(source).toContain('y: rightShipBeforeNn.y + 49');
    expect(source).toContain('scale: leftShipBaseScale * 1.50 * 0.90');
    expect(source).toContain('const fighterExitDistance = (window.innerWidth || 390) * 2');
    expect(source).toContain("console.info('[CC_ROBO_SHIP_EXIT]', payload)");
    expect(source).toContain("fighter.style.opacity = '0'");
    expect(source).toContain("fighter.style.visibility = 'hidden'");
    expect(source).toContain("fighter.style.display = 'none'");
    expect(source).not.toContain('time: 2.22, x: -104 + flightJitter[8].x');
    expect(source).not.toContain('time: 2.22, x: 108 + flightJitter[9].x');
    expect(source).toContain('firstTime: gsap.utils.random(1.52, 1.66)');
    expect(source).toContain('firstX: gsap.utils.random(86, 134)');
    expect(source).toContain('verticalSeparation: gsap.utils.random(192, 242)');
    expect(source).toContain('const verticalDepthScaleRatio = 0.60');
    expect(source).toContain('scale: leftShipBaseScale * 1.48 / verticalDepthScaleRatio');
    expect(source).toContain('scale: rightShipBaseScale * 1.46 * verticalDepthScaleRatio');
    expect(source).toContain('const fighterExitVerticalDistance = (window.innerHeight || 760) * 0.85 + 100');
    expect(source).toContain("addFighterExit(leftFighterExit, 'left', fighterExitDistance, fighterExitVerticalDistance)");
    expect(source).toContain("addFighterExit(rightFighterExit, 'right', -fighterExitDistance, -fighterExitVerticalDistance)");
    expect(source).toContain('exitTimeline?.add(fighterExitTimeline, sceneParallaxLead)');
    expect(source).toContain('const wobbleStrength = gsap.utils.random(1.8, 2.8)');
    expect(source).toContain('const circleRadius = gsap.utils.random(16, 26)');
    expect(source).toContain('exitTimeline.call(stopRoboAirCombatMotion, undefined, sceneParallaxLead)');
    expect(source).toContain('const acceleratedProgress = 0.12 * progress + 0.88 * progress * progress');
    expect(source).toContain('const wobbleEnvelope = 0.65 + Math.sin(Math.PI * progress) * 0.35');
    expect(source).toContain('Math.sin(wobblePhaseNow) - Math.sin(wobblePhase)');
    expect(source).toContain('progress * Math.PI * 2 + wobblePhase');
    expect(source).toContain('progress * Math.PI * 10 + wobblePhase');
    expect(source).toContain('stopRoboAirCombatMotion();');
    expect(source).toContain('const roboGroundBounceCompleteSeconds = 0.62');
    expect(source).toContain('const roboFrontLeadSeconds = 0.30');
    expect(source).toContain("layerKey === 'robo-front'");
    expect(source).toContain('? roboGroundBounceCompleteSeconds - roboFrontLeadSeconds');
    expect(source).toContain("const isRoboGroundLayer = layerKey === 'robo-ground-front' || layerKey === 'robo-ground-rear'");
    expect(source).toContain(': !isRoboGroundLayer');
    expect(source).not.toContain("(layerKey === 'robo-front' || layerKey === 'robo-walker')\n          ? 0");
    const uninterruptedFlightBranch = source.slice(
      source.indexOf('type FlightPoint ='),
      source.indexOf('const addBeamShot = ('),
    );
    expect(uninterruptedFlightBranch).toContain('const sampleSmoothFlightValue = (');
    expect(uninterruptedFlightBranch).toContain('const currentTangent =');
    expect(uninterruptedFlightBranch).toContain('const nextTangent =');
    expect(uninterruptedFlightBranch).toContain('const startContinuousFlight = (');
    expect(uninterruptedFlightBranch).toContain("ease: 'none'");
    expect(uninterruptedFlightBranch).toContain('Math.sin(elapsed * 5.2 + bankPhase) * 8');
    expect(uninterruptedFlightBranch).toContain('Math.sin(elapsed * 8.7 + bankPhase * 0.7) * 2');
    expect(uninterruptedFlightBranch).toContain('Math.max(-10, Math.min(10');
    expect(uninterruptedFlightBranch).not.toContain("ease: 'sine.inOut'");
    expect(source).toContain('const addBeamShot = (');
    expect(source).toContain('const numberRect = numberContainer.getBoundingClientRect()');
    expect(source).toContain('const forestRect = forestContainer.getBoundingClientRect()');
    expect(source).toContain('const numberCenterX = numberRect.left + numberRect.width * 0.5 - forestRect.left');
    expect(source).toContain('const numberCenterY = numberRect.top + numberRect.height * 0.5 - forestRect.top');
    expect(source).not.toContain('{ beam: beamLeft, x: numberCenterX - 60 }');
    expect(source).toContain('{ beam: beamRight, x: numberCenterX + 100 }');
    expect(source).toContain("beam.style.top = `${numberCenterY + 150}px`");
    expect(source).toContain("beam.style.bottom = 'auto'");
    expect(source).toContain('gsap.set([beamRight, beamHit, beamAfter], {');
    expect(source).toContain('opacity: 0');
    expect(source).toContain('rotation: -90');
    expect(source).toContain('scaleX: 1');
    expect(source).toContain('scaleY: 1');
    expect(source).toContain("filter: 'drop-shadow(0 0 9px rgba(104, 239, 255, 1))'");
    expect(source).toContain('xPercent: -88');
    expect(source).toContain('yPercent: -75');
    expect(source).toContain("transformOrigin: '88% 75%'");
    expect(source).toContain('const resolveImpactX = (): number => targetShip.offsetLeft + impact.x - beam.offsetLeft');
    expect(source).toContain('const targetCenterY = forestContainer.clientHeight');
    expect(source).toContain('return targetCenterY - beam.offsetTop');
    expect(source).toContain('const launchJitterX = gsap.utils.random(-22, 22)');
    expect(source).toContain('launchZIndex = 59');
    expect(source).toContain('zIndex: launchZIndex');
    expect(source).toContain('x: () => resolveImpactX() + horizontalTravel + launchJitterX');
    expect(source).toContain('y: () => resolveImpactY() + 480');
    expect(source).toContain('y: resolveImpactY');
    expect(source).not.toContain('addBeamShot(beamLeft');
    expect(source).toContain('const firstBeamStartSeconds = 0.00');
    expect(source).toContain('const beamShotStaggerSeconds = 0.12');
    expect(source).toContain('addBeamShot(beamHit, firstBeamStartSeconds, -96');
    expect(source).toContain('addBeamShot(beamRight, firstBeamStartSeconds + beamShotStaggerSeconds, -108, rightHitPoint, rightShipMotion, 168, 29)');
    expect(source).toContain('addBeamShot(beamAfter, firstBeamStartSeconds + beamShotStaggerSeconds * 2, -100');
    expect(source).toContain("filter: 'drop-shadow(0 0 12px rgba(104, 239, 255, 1))'");
    expect(source).toContain('const flightScale = gsap.utils.random(2.10, 2.35)');
    expect(source).not.toContain('timeline.set(beam, { zIndex: 75 }, start + 0.28)');
    expect(source).toContain("console.info('[CC_ROBO_BEAM_DEPTH]', payload)");
    expect(source).toContain('frontGroundZIndex: window.getComputedStyle(frontGround).zIndex');
    expect(source).toContain('rearGroundZIndex: window.getComputedStyle(rearGround).zIndex');
    expect(source).toContain('scaleX: flightScale');
    expect(source).toContain('scaleY: flightScale');
    expect(source).toContain('duration: 0.6');
    expect(source).toContain('}, start + 0.7)');
    expect(source).toContain('scaleX: 1.55');
    expect(source).toContain('scaleY: 1.55');
    expect(source).toContain('const addContinuousFlightWobble = (');
    expect(source).toContain('gsap.utils.random(1.55, 2.15)');
    expect(source).toContain('gsap.utils.random(1.35, 1.95)');
    expect(source).toContain('const hoverXPercent = 500 / shipWidth');
    expect(source).toContain('const hoverYPercent = 500 / shipHeight');
    expect(source).toContain('ship.naturalHeight / ship.naturalWidth');
    expect(source).toContain(': 188 / 194');
    expect(source).toContain('repeat: -1');
    expect(source).toContain('const wobbleClock = { phase: phaseOffset }');
    expect(source).toContain('phase: phaseOffset + Math.PI * 40');
    expect(source).toContain('const xWave = Math.sin(phase * 1.37)');
    expect(source).toContain('const yWave = Math.sin(phase * 1.73 + 1.2)');
    expect(source).toContain('roboAirCombatTimelines.forEach((timeline) => {');
    expect(source).not.toContain('ROBO_AIR_COMBAT_DAMAGE_FRAMES');
    expect(source).not.toContain('buildRoboDamageFrameSchedule');
    expect(source).not.toContain('const flightFinaleStart = 2.12');
    expect(source).toContain("rightShipMotion.className = 'cc-robo-fighter-motion'");
    expect(source).toContain('rightShipMotion.appendChild(rightShip)');
    expect(source).toContain('startContinuousFlight(rightShipMotion, [');
    expect(source).not.toContain("filter: 'blur(1.15px)'");
    expect(source).not.toContain('renderDamageFrame');
    expect(source).not.toContain("event: '[CC_ROBO_DAMAGE]'");
    expect(source).toContain('y: leftShipUpperY');
    expect(source).toContain('x: -45 + flightJitter[11].x * 0.25');
    expect(source).toContain('y: -135 + flightJitter[11].y');
    expect(source).toContain('const leftShipUpperY = Math.min(20 - leftShipRestTop, rightHitPoint.y - 80)');
    expect(source).not.toContain('rightEdgeApproachX');
    expect(source).not.toContain('damageState');
    expect(source).not.toContain('damageSequenceStart');
    expect(source).not.toContain('damageSequenceEnd');
    expect(source).toContain("ease: 'none'");
    expect(source).toContain("timeline.to({}, { duration: 0.001, ease: 'none' }, fighterFlightDurationSeconds)");
    expect(source).toContain('ROBO_AIR_COMBAT_HOLD_DURATION_SECONDS = 0');
    expect(source).toContain('let roboAirCombatMasterTimeline: gsap.core.Timeline | null = null');
    expect(source).toContain('function getRoboAirCombatHoldSeconds(): number');
    expect(source).toContain('resolveRoboAirCombatHoldSeconds({');
    expect(source).toContain('roboAirCombatMasterTimeline = timeline');
    expect(source).toContain('getRoboAirCombatHoldSeconds()');
    expect(source).toContain('stopRoboAirCombatMotion();');
    expect(source).toContain("['robo-beam-right', 'robo-beam-hit', 'robo-beam-after']");
    expect(source).toContain("!(transitionTheme === 'area55' && ROBO_AIR_COMBAT_LAYER_KEYS.has(key))");
    expect(source).toContain("'robo-front', 'robo-walker', 'robo-fence'");
    expect(source).not.toContain("'robo-fighter-left', 'robo-fighter-right', 'robo-front', 'robo-walker', 'robo-fence'");
    expect(source).not.toContain('robo-hit-smoke');
    expect(source).not.toContain('hitSmoke');
    expect(source).toContain("const roboRestRotation = layerKey === 'robo-fence' ? 6 : 0");
    expect(source).toContain("'robo-front', 'robo-walker', 'robo-fence'");
    expect(source).toContain("'robo-fence-static-left', 'robo-fence-static-right'");
    expect(source).not.toContain("'robo-fighter-left', 'robo-fighter-right', 'robo-ship', 'robo-front'");
    expect(source).toContain("const isRoboSceneExit = transitionTheme === 'area55'");
    expect(source).toContain("if (sceneImg.dataset.motionRole === 'float') stopBeachAmbientMotion(sceneImg)");
  });

  test('keeps both fighters on screen while their opening flight is already active', () => {
    const viewportWidth = 390;
    const onScreenX = Math.min(118, viewportWidth * 0.30);
    expect(onScreenX).toBeLessThan(viewportWidth * 0.5);
    expect(-onScreenX).toBeGreaterThan(-viewportWidth * 0.5);

    const source = fs.readFileSync(path.resolve(__dirname, '../board-transition-screen.ts'), 'utf8');
    expect(source).toContain('{ time: 0, x: -fighterOnScreenX, y: -104, scale: leftShipBaseScale }');
    expect(source).toContain('{ time: 0, x: fighterOnScreenX, y: -42, scale: rightShipEnterScale }');
    expect(source).toContain('gsap.utils.random(-Math.PI, Math.PI)');
    expect(source).toContain('crossingVariation.leftBankPhase');
    expect(source).toContain('crossingVariation.rightBankPhase');
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
    expect(source).toContain("const isRoboStaticFence = isRoboScene && (");
    expect(source).toContain('isRoboStaticFence ? roboStaticFenceScaleXSign : 1');
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
