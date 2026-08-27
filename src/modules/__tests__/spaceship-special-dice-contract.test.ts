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
  getSpaceshipMagneticPullProgress,
  getSpaceshipDebrisMotion,
  SPACESHIP_BEAM_EXIT_FADE_DURATION,
  SPACESHIP_BEAM_EXIT_FLASH_DURATION,
  SPACESHIP_BEAM_EXIT_FLASH_LEVELS,
  SPACESHIP_BEAM_EXIT_FLASH_STARTS,
  SPACESHIP_DEBRIS_FINAL_VISIBLE_SCALE,
  SPACESHIP_DEBRIS_INITIAL_SCALE,
  SPACESHIP_DEBRIS_PLAN,
  SPACESHIP_FAKE_DICE_PLAN,
  SPACESHIP_LAYER_Z,
  SPACESHIP_PULL_ARRIVAL_GAP_SECONDS,
  SPACESHIP_PULL_BASE_SECONDS,
  SPACESHIP_PULL_LINEAR_WEIGHT,
  SPACESHIP_RIGHT_BEAM_LEAD_LEVELS,
  SPACESHIP_SCENE_SECONDS,
} from '../spaceship-finale-scene';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Spaceship special die', () => {
  test('keeps Magnet gameplay with the exact requested art, copy, and palettes', () => {
    const spaceship = getSpecialDiceVariant('spaceship');
    expect(spaceship).toMatchObject({
      id: 'spaceship',
      archetype: 'wild-magnet',
      splashText: 'WOOMBUU',
      splashColor: '#F1A151',
      splashColors: ['#F1A151', '#56D7EC'],
      splashSplitIndex: 3,
      finaleScene: 'spaceship-abduction',
      idleMotion: 'spaceship-hover',
    });
    expect(spaceship?.texture).toMatch(/assets\/shop\/spaceship\/spaceship(?:@2x)?\.png$/);
    expect(getCoreWildTypeForSpecialDiceVariant(spaceship)).toBe('wild-magnet');
    expect(getSpecialDiceTrailColors(spaceship)).toEqual([0xF8DCBF, 0xEFBE8F, 0x7CFBFD, 0x8AEEFE]);
    expect(getSpecialDiceShardColors(spaceship)).toEqual([0xF2CDA8, 0x8AEEFE]);
    expect(getSpecialDiceSplashOptions(spaceship)).toMatchObject({
      text: 'WOOMBUU',
      colors: ['#F1A151', '#56D7EC'],
      splitIndex: 3,
      finaleScene: 'spaceship-abduction',
    });
  });

  test('is the first Area 55 Stage 1 wild and never leaks into other worlds or Arcade', () => {
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: false,
      journeyBoard: 21,
      wildSpawnCount: 0,
    })?.id).toBe('spaceship');

    for (const journeyBoard of [1, 2, 10, 11, 20, 22, 30, 31]) {
      for (const wildSpawnCount of [0, 1, 2]) {
        expect(pickSpecialDiceVariantForWildSpawn({
          isArcade: false,
          journeyBoard,
          wildSpawnCount,
          beachWildSlot: 3,
          roboWildRoll: 0,
        })?.id).not.toBe('spaceship');
      }
    }
    expect(pickSpecialDiceVariantForWildSpawn({
      isArcade: true,
      arcadeStage: 1,
      wildSpawnCount: 99,
    })?.id).not.toBe('spaceship');
  });

  test('uses every supplied scene asset in one bounded four-second lifecycle owner', () => {
    const scene = read('src/modules/spaceship-finale-scene.ts');
    const splash = read('src/modules/splash-text-overlay.ts');
    const idle = read('src/modules/special-dice-idle.ts');
    expect(SPACESHIP_SCENE_SECONDS).toBe(4);
    expect(scene).toContain('master.call(() => {}, undefined, SCENE_SECONDS)');
    expect(scene).toContain('cleanup.completionDelaySeconds = SCENE_SECONDS');
    expect(scene).toContain('animationManager.killExternalTimeline(timeline)');
    expect(scene).not.toContain('repeat: -1');
    expect(splash).toContain("options?.finaleScene === 'spaceship-abduction'");
    expect(splash).toContain('attachSpaceshipFinaleScene(overlay)');
    expect(idle).toContain("variant.idleMotion === 'spaceship-hover'");
    expect(idle).toContain('const hoverTiltRadians = 15 * Math.PI / 180');
    expect(idle).toContain('preloadSpaceshipFinaleAssets()');

    const assetRoot = path.resolve(process.cwd(), 'assets/shop/spaceship');
    const names = [
      'spaceship',
      ...Array.from({ length: 4 }, (_, index) => `saucer${index + 1}`),
      'leftbeam',
      'rightbeam',
      ...Array.from({ length: 7 }, (_, index) => `rock${index + 1}`),
      ...Array.from({ length: 5 }, (_, index) => `kanta${index + 1}`),
    ];
    names.forEach((name) => {
      expect(fs.existsSync(path.join(assetRoot, `${name}.png`))).toBe(true);
      expect(fs.existsSync(path.join(assetRoot, `${name}@2x.png`))).toBe(true);
    });
    expect(scene).toContain('Array.from({ length: 4 }');
    expect(scene).toContain('Array.from({ length: 7 }');
    expect(scene).toContain('Array.from({ length: 5 }');
  });

  test('runs one continuous accelerating suction curve through selective beam depth', () => {
    const scene = read('src/modules/spaceship-finale-scene.ts');
    expect(SPACESHIP_RIGHT_BEAM_LEAD_LEVELS).toEqual([0.5, 0.6, 0.4, 1]);
    expect(SPACESHIP_BEAM_EXIT_FLASH_LEVELS).toEqual([1, 0, 1, 0, 0.7, 0, 0.4, 0]);
    expect(SPACESHIP_BEAM_EXIT_FLASH_STARTS[0]).toBeLessThan(3.52);
    expect(
      SPACESHIP_BEAM_EXIT_FLASH_STARTS[SPACESHIP_BEAM_EXIT_FLASH_STARTS.length - 1]
        + SPACESHIP_BEAM_EXIT_FADE_DURATION,
    ).toBeLessThan(4);
    expect(SPACESHIP_BEAM_EXIT_FLASH_DURATION).toBe(0.055);
    expect(SPACESHIP_BEAM_EXIT_FADE_DURATION).toBe(0.17);
    expect(scene).toContain('gsap.utils.shuffle([...SPACESHIP_BEAM_SHIMMER_LEVELS])');
    expect(scene).toContain('scheduleBeamShimmer(rightBeam, 0.52, SPACESHIP_RIGHT_BEAM_LEAD_LEVELS)');
    expect(scene).toContain('scheduleBeamShimmer(leftBeam, 0.80)');
    expect(scene).toContain("ease: isFinalFade ? 'power2.out' : 'power1.inOut'");
    expect(scene).not.toContain("beams.to([leftBeam, rightBeam], { opacity: 0, duration: 0.26, ease: 'power2.in' }, 3.46)");
    expect(scene).toContain('left:-40%;top:calc(66% - 40px);width:132%');
    expect(scene).toContain('right:-43.25%;top:calc(66% - 40px);width:145.5%');
    expect(SPACESHIP_LAYER_Z).toEqual({
      backgroundDice: 0,
      belowBeam: 1,
      beam: 2,
      aboveBeam: 3,
      foregroundDice: 4,
      saucer: 5,
    });
    expect(scene).toContain('const rigTargets = [beamRig, saucerRig]');
    expect(scene).toContain('? SPACESHIP_LAYER_Z.foregroundDice');
    expect(scene).toContain('? SPACESHIP_LAYER_Z.backgroundDice');
    expect(scene).toContain('? SPACESHIP_LAYER_Z.belowBeam');
    expect(scene).not.toContain('xPercent: -7');
    expect(scene).not.toContain('xPercent: 7');
    expect(scene).not.toContain('brightness(');
    expect(scene).toContain('void preloadSpaceshipFinaleAssets();');
    expect(scene).toContain('start();');
    expect(scene).not.toContain('.then(start)');
    const rocksTopDown = SPACESHIP_DEBRIS_PLAN
      .filter(({ id }) => id.startsWith('rock'))
      .sort((left, right) => left.y - right.y)
      .map(({ id }) => id);
    const cansTopDown = SPACESHIP_DEBRIS_PLAN
      .filter(({ id }) => id.startsWith('can'))
      .sort((left, right) => left.y - right.y)
      .map(({ id }) => id);
    expect(rocksTopDown).toEqual(['rock1', 'rock2', 'rock3', 'rock4', 'rock5', 'rock6', 'rock7']);
    expect(cansTopDown).toEqual(['can1', 'can2', 'can3', 'can4', 'can5']);
    const referenceLayout = [...SPACESHIP_DEBRIS_PLAN].sort((left, right) => left.y - right.y);
    expect(referenceLayout.map(({ y }) => y)).toEqual([112, 116, 120, 124, 128, 132, 136, 140, 144, 148, 152, 156]);
    expect(referenceLayout.slice(1).every(({ y }, index) => y - referenceLayout[index].y === 4)).toBe(true);
    expect(referenceLayout.every(({ y, size }) => y / 100 * 844 - size / 2 > 844)).toBe(true);
    const pullPlan = [...SPACESHIP_DEBRIS_PLAN].sort((left, right) => left.pullOrder - right.pullOrder);
    expect(pullPlan.map(({ id }) => id)).toEqual([
      'rock1', 'rock2', 'can1', 'rock3', 'can2', 'rock4',
      'can3', 'rock5', 'can4', 'rock6', 'can5', 'rock7',
    ]);
    expect(pullPlan.map(({ pullOrder }) => pullOrder)).toEqual([...Array(12).keys()]);
    expect(SPACESHIP_DEBRIS_PLAN.filter(({ belowBeams }) => belowBeams).map(({ id }) => id).sort())
      .toEqual(['can1', 'can2', 'can4', 'rock3', 'rock6', 'rock7']);
    expect(SPACESHIP_FAKE_DICE_PLAN.map(({ value }) => value)).toEqual([3, 2, 4, 1, 2, 5, 4, 3]);
    expect(SPACESHIP_FAKE_DICE_PLAN).toHaveLength(8);
    expect(SPACESHIP_FAKE_DICE_PLAN.map(({ sizeReduction }) => sizeReduction))
      .toEqual([0.60, 0.80, 0.70, 0.75, 0.65, 0.60, 0.80, 0.70]);
    expect(SPACESHIP_FAKE_DICE_PLAN.every(({ size }) => size >= 19 && size <= 33)).toBe(true);
    expect(SPACESHIP_FAKE_DICE_PLAN.every(({ x }) => x <= 20 || x >= 80)).toBe(true);
    expect(SPACESHIP_FAKE_DICE_PLAN.every(({ y, size }) => y / 100 * 844 - size * 1.4 / 2 > 844)).toBe(true);
    expect(new Set(SPACESHIP_FAKE_DICE_PLAN.map(({ size }) => size)).size).toBe(8);
    expect(SPACESHIP_FAKE_DICE_PLAN.some(({ foregroundDice }) => foregroundDice)).toBe(true);
    expect(SPACESHIP_FAKE_DICE_PLAN.some(({ foregroundDice }) => !foregroundDice)).toBe(true);
    expect(scene).toContain("const BOARD_TILE_SOURCE = `./assets/tile${useHighResolutionAssets ? '@2x' : ''}.png`");
    expect(scene).toContain('createFakeBoardDie(layout.value)');
    const motions = pullPlan.map(getSpaceshipDebrisMotion);
    expect(motions.every(({ travelStartAt }) => travelStartAt === 0)).toBe(true);
    expect(SPACESHIP_PULL_BASE_SECONDS).toBe(2);
    expect(SPACESHIP_PULL_ARRIVAL_GAP_SECONDS).toBe(0.045);
    motions.slice(1).forEach(({ arrivalAt }, index) => {
      expect(arrivalAt - motions[index].arrivalAt).toBeCloseTo(0.045, 10);
    });
    expect(Math.max(...motions.map(({ arrivalAt }) => arrivalAt))).toBeCloseTo(2.495, 10);
    expect(new Set(motions.map(({ travelSeconds }) => travelSeconds.toFixed(3))).size).toBeGreaterThanOrEqual(3);
    expect(new Set(SPACESHIP_DEBRIS_PLAN.map(({ curveX }) => curveX.join(','))).size).toBe(12);
    expect(SPACESHIP_DEBRIS_PLAN.every(({ x, curveX }) => curveX.some((control) => control !== x))).toBe(true);
    expect(Math.max(...SPACESHIP_DEBRIS_PLAN.flatMap(({ startRotation, wobbleRotation }) => [Math.abs(startRotation), Math.abs(wobbleRotation)]))).toBeLessThanOrEqual(12);
    expect(SPACESHIP_DEBRIS_INITIAL_SCALE).toBe(1.4);
    const rockSizes = SPACESHIP_DEBRIS_PLAN.filter(({ id }) => id.startsWith('rock')).map(({ size }) => size);
    const canSizes = SPACESHIP_DEBRIS_PLAN.filter(({ id }) => id.startsWith('can')).map(({ size }) => size);
    expect(rockSizes.every((size) => size >= 100 && size <= 120)).toBe(true);
    expect(canSizes.every((size) => size >= 120 && size <= 140)).toBe(true);
    expect(SPACESHIP_PULL_LINEAR_WEIGHT).toBeGreaterThan(0);
    expect(getSpaceshipMagneticPullProgress(0)).toBe(0);
    expect(getSpaceshipMagneticPullProgress(1)).toBe(1);
    expect(getSpaceshipMagneticPullProgress(0.01)).toBeGreaterThan(0);
    const pullSamples = Array.from({ length: 11 }, (_, index) => getSpaceshipMagneticPullProgress(index / 10));
    const pullSpeeds = pullSamples.slice(1).map((progress, index) => progress - pullSamples[index]);
    expect(pullSpeeds.slice(1).every((speed, index) => speed > pullSpeeds[index])).toBe(true);
    expect(SPACESHIP_DEBRIS_FINAL_VISIBLE_SCALE).toBe(0.6);
    expect(scene).toContain('scale: SPACESHIP_DEBRIS_INITIAL_SCALE');
    expect(scene).toContain('opacity: 1');
    expect(scene).not.toContain('scale: 1.7');
    expect(scene).not.toContain('motionProfile');
    expect(scene).not.toContain('wobbleProfile');
    expect(scene).toContain('getSpaceshipMagneticPullProgress(linearProgress)');
    expect(scene).toContain('cubicBezier(startLeft, control1, control2, targetLeft, magneticProgress)');
    expect(scene).toContain("ease: 'none'");
    expect(scene).toContain('const intakeMarkers = [46, 50, 54]');
    expect(scene).toContain('resolveIntakePoint(intakeMarker).top');
    expect(scene).toContain('resolveIntakePoint(intakeMarker).left');
    expect(scene).toContain("gsap.quickSetter(mover, 'left', 'px')");
    expect(scene).toContain("gsap.quickSetter(mover, 'top', 'px')");
    expect(scene).toContain("gsap.quickSetter(mover, 'scale')");
    expect(scene).toContain("gsap.quickSetter(image, 'rotation', 'deg')");
    expect(scene).toContain("left: () => `${resolveIntakePoint(intakeMarker).left}px`");
    expect(scene).toContain("top: () => `${resolveIntakePoint(intakeMarker).top}px`");
    expect(scene).toContain('item.set(mover, { opacity: 0, scale: 0.06 }, arrivalAt + 0.025)');
    expect(scene).toContain("traceSuction('item-arrival'");
    expect(scene).not.toContain("left: `${targetX}%`");
    expect(scene).not.toContain('stageY');
    expect(scene).not.toContain('yoyo: true');
    expect(scene.match(/onUpdate:/g)).toHaveLength(1);
    expect(scene).not.toContain('requestAnimationFrame');
    expect(scene).not.toMatch(/rotation:\s*(?:-?(?:3[1-9]|[4-9]\d|\d{3,}))/);
    expect(scene).toContain('for (let index = 0; index < 22; index += 1)');
    expect(scene).toContain("}, 3.52);");
    expect(scene).not.toContain('backgroundColor');
    expect(scene).not.toContain('new Graphics');
  });

  test('adds a visible cyan idle layer below and behind the existing shard trail', () => {
    const fx = read('src/modules/fx.ts');
    expect(fx).toContain("const isSpaceship = getSpecialDiceVariantForTile(tile)?.id === 'spaceship'");
    expect(fx).toContain('colors: [0x7CFBFD, 0x8AEEFE]');
    expect(fx).toContain('particleCount: 4');
    expect(fx).toContain('fillAlpha: 0.78');
    expect(fx).toContain('angleMin: Math.PI / 3');
    expect(fx).toContain('angleMax: Math.PI * 2 / 3');
    expect(fx).toContain('zIndex: (tile.zIndex ?? 0) - 0.001');
    expect(fx).toContain('trackForIdle: true');
  });
});
