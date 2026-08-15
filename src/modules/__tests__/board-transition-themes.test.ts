import {
  AREA55_BOARD_TRANSITION_PROFILE,
  BEACH_BOARD_TRANSITION_PROFILE,
  getJourneyBoardTransitionTheme,
  resolveBoardTransitionTheme,
} from '../board-transition-themes';
import {
  BEACH_CURTAIN_LAYER_KEYS,
  createBeachTransitionVariation,
  createBeachTransitionVariationSequence,
} from '../board-transition-beach-variation';
import { RUN_MODE_ARCADE_HOME, RUN_MODE_JOURNEY } from '../run-mode';
import fs from 'node:fs';
import path from 'node:path';

describe('Board Transition World themes', () => {
  test.each([[1, 'forest'], [10, 'forest'], [11, 'beach'], [20, 'beach'], [21, 'area55'], [30, 'area55']])(
    'maps Journey board %i to %s',
    (board, theme) => expect(getJourneyBoardTransitionTheme(board)).toBe(theme),
  );

  test('never maps overlapping Arcade board numbers into Journey themes', () => {
    expect(resolveBoardTransitionTheme({ boardNumber: 19, runMode: RUN_MODE_ARCADE_HOME })).toBe('forest');
    expect(resolveBoardTransitionTheme({ boardNumber: 29, runMode: null })).toBe('forest');
    expect(resolveBoardTransitionTheme({ boardNumber: 19, runMode: RUN_MODE_JOURNEY })).toBe('beach');
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
    expect(source).toContain('? [...baseCloudSpawnTops, 8, 18, 29, 38]');
    expect(source).toContain('const beachSpawnSlot = BEACH_CLOUD_SPAWN_SLOTS[i % BEACH_CLOUD_SPAWN_SLOTS.length]');
    expect(source).toContain('Math.max(0, Math.min(40, beachSpawnTop))');
    expect(source).toContain("if (resolvedTheme === 'beach' && i === 2) continue");
    expect(source).toContain("const cloudLayerOwner = resolvedTheme === 'beach'");
    expect(source).toContain('? cloudContainer');
    expect(source).toContain("1: Object.freeze({ restScale: 1, restRotation: 12, enterStartYRatio: 0.54 })");
    expect(source).toContain('window.innerWidth * 0.9 + sceneImg.offsetWidth * 0.55');
    expect(source).toContain('const curtainExitDownDistance = Math.max(180, window.innerHeight * 0.3)');
    expect(source).toContain('x: exitDirection * curtainExitDistance');
    expect(source).toContain('y: curtainExitDownDistance');
    expect(source).toContain('opacity: 1');
    expect(source).toContain('rotation: isHill ? 0 : isBeachCurtain ? beachPalmRestRotation : direction * 8');
    expect(source).toContain('scale: isHill ? hillBaseScale * 0.68 : isBeachCurtain ? beachPalmRestScale : isBeachFrontShore ? 0.7 : 0');
    expect(source).toContain('duration: 0.42');
    expect(source).toContain("ease: 'power3.out'");
    expect(source).toContain('duration: BOARD_TRANSITION_REGULAR_SCENE_EXIT_SECONDS * 1.5');
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
    expect(source).toContain('sceneImg.style.left = `${palmPlacement.leftPercent}%`');
    expect(source).toContain("sceneImg.style.top = 'auto'");
    expect(source).toContain('sceneImg.style.bottom = `${palmPlacement.bottomPx}px`');
    expect(source).toContain("sceneImg.dataset.floatDirection = startsRight ? 'left' : 'right'");
    expect(source).toContain("sceneImg.style.left = beachVariation.castleStartsLeft");
    expect(source).toContain("? 'calc(32% - 30px)'");
    expect(source).toContain(": 'calc(68% + 30px)'");
    expect(source).toContain('const exitDirection = palmPlacement?.exitDirection');
    expect(source).toContain('const beachPalmRestRotation = palmPlacement?.restRotationDeg ?? beachPalmMotion.restRotation');
    expect(source).toContain("const horizontalDirection = sceneImg.dataset.floatDirection === 'left' ? -1 : 1");
    expect(source).toContain("2: Object.freeze({ restScale: 0.8, restRotation: -12, enterStartYRatio: 0.43");
    expect(source).toContain("4: Object.freeze({ restScale: 0.8, restRotation: -12, enterStartYRatio: 0.39");
    expect(source).toContain("5: Object.freeze({ restScale: 0.8, restRotation: 12, enterStartYRatio: 0.47");
    expect(source).toContain("const isBeachFrontShore = resolvedTheme === 'beach' && layerKey === 'beach-shore-2'");
    expect(source).toContain('opacity: isBeachFrontShore ? 1 : 0');
    expect(source).toContain('isBeachFrontShore ? 0.7 : 0');
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
    expect(source).toContain('isBottle ? gsap.utils.random(-18, -9) : gsap.utils.random(-22, -10)');
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
    expect(source).toContain('duration: 4.8');
    expect(source).toContain("gsap.set(sceneImg, { transformOrigin: '50% 50%' })");
    expect(source).toContain("const cloudThemeScale = resolvedTheme === 'beach' ? 0.6 * 1.4 : 1");
    expect(source).toContain('const BEACH_CLOUD_SPAWN_SLOTS = Object.freeze([');
    expect(source).toContain("const beachSpawnTop = beachSpawnSlot.top + ((Math.random() * 2 - 1) * 1.25)");
    expect(source).toContain("const beachSpawnLeft = beachSpawnSlot.left + ((Math.random() * 2 - 1) * 1.5)");
    expect(source).toContain("resolvedTheme === 'beach'\n        ? Math.max(2, Math.min(98, beachSpawnLeft))");
    expect(source).toContain("if (resolvedTheme === 'beach' && i === 2) continue");
    expect(source).toContain("const isCastle = layerKey === 'beach-castle'");
    expect(source).toContain("const isBeach = layerKey === 'beach-shore-1' || layerKey === 'beach-shore-2'");
    expect(source).toContain('const shoreTravelX = isCastle ? 7 : 10');
    expect(source).toContain('scale: isCastle ? 1.24 : isBeach ? 1.15 : 1');
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
    expect(source).toContain('domElementPool.release(cloudImg)');
    expect(source).toContain('domElementPool.release(sceneImg)');
    expect(source).toContain('const latestSceneExitEnd = orderedExitEntries.reduce');
    expect(source).toContain('latestSceneExitEnd + 0.02');
    expect(source).toContain('latestCloudExitEnd + 0.02');
    expect(source).toContain("logger.info('[BOARD_EXIT_TIMELINE] Beach exit ownership'");
  });
});
