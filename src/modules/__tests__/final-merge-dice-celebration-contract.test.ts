import fs from 'node:fs';
import path from 'node:path';

import animationManager from '../animation-manager';
import { domElementPool } from '../dom-element-pool';
import {
  cleanupFinalMergeDiceCelebration,
  FINAL_MERGE_CELEBRATION_MESSAGE,
  playFinalMergeDiceCelebration,
  applyFinalMergeDiceSizeProfile,
  arrangeFinalMergeDiceBurstOrigins,
  separateFinalMergeDiceFlightEnds,
  splitFinalMergeCelebrationMessage,
} from '../final-merge-dice-celebration';
import { createTntDiceDebrisPlans } from '../tnt-animation';
import { ADDITIONAL_CLEAN_BOARD_WIN_MESSAGES } from '../clean-board-win-messages';

const modulesDir = path.resolve(__dirname, '..');
const celebrationSource = fs.readFileSync(
  path.join(modulesDir, 'final-merge-dice-celebration.ts'),
  'utf8',
);
const appCoreSource = fs.readFileSync(path.join(modulesDir, 'app-core.ts'), 'utf8');
const hudSource = fs.readFileSync(path.join(modulesDir, 'hud-helpers.ts'), 'utf8');

describe('final merge dice celebration contract', () => {
  beforeEach(() => {
    cleanupFinalMergeDiceCelebration();
    document.body.innerHTML = '';
    domElementPool.clear();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  afterEach(() => {
    cleanupFinalMergeDiceCelebration();
    document.body.innerHTML = '';
    domElementPool.clear();
  });

  test('shows only Cleared here and moves all sixty authored messages into Clean Board', () => {
    expect(FINAL_MERGE_CELEBRATION_MESSAGE).toBe('Cleared');
    expect(ADDITIONAL_CLEAN_BOARD_WIN_MESSAGES).toHaveLength(60);
    expect(new Set(ADDITIONAL_CLEAN_BOARD_WIN_MESSAGES).size).toBe(60);
    expect(ADDITIONAL_CLEAN_BOARD_WIN_MESSAGES).toEqual(expect.arrayContaining([
      'Nice win!',
      'Perfect clear!',
      'Let’s gooo!',
      'Sixcess!',
      'Dice-lightful!',
    ]));
    const cleanBoardSource = fs.readFileSync(path.join(modulesDir, 'clean-board-modal.ts'), 'utf8');
    expect(cleanBoardSource).toContain("import { ADDITIONAL_CLEAN_BOARD_WIN_MESSAGES } from './clean-board-win-messages.ts';");
    expect(cleanBoardSource).toContain('...ADDITIONAL_CLEAN_BOARD_WIN_MESSAGES');
    expect(cleanBoardSource).toContain('const HEADLINES = Array.from(new Set([');
  });

  test('uses TNT BOOM dice flight with calmer Arcade Round Complete text styling', () => {
    expect(celebrationSource).toContain("import { createTntDiceDebrisPlans, type TntDiceDebrisPlan } from './tnt-animation.js';");
    expect(celebrationSource).toContain('const plans = createTntDiceDebrisPlans();');
    expect(celebrationSource).toContain('const upperLeftAngles = [-2.72, -2.38, -2.06] as const;');
    expect(celebrationSource).toContain('const fortyPercentMoreDice = Math.round(currentPlanCount * 0.4);');
    expect(celebrationSource).toContain('const northernAngles = [-2.82, -2.42, -2.02, -1.62, -1.22, -0.82, -0.42] as const;');
    expect(celebrationSource).toContain('const startRadius = 16 + random() * 34;');
    expect(celebrationSource).toContain('arrangeFinalMergeDiceBurstOrigins(plans, Math.random, copyWidth);');
    expect(celebrationSource).toContain('const DICE_EPICENTER_Y_RATIO = 0.5 * 0.85;');
    expect(celebrationSource).toContain('const DICE_FLIGHT_DISTANCE_SCALE = 1.2;');
    expect(celebrationSource).toContain('const DICE_ROTATION_SCALE = 0.6;');
    expect(celebrationSource).toContain('const BOARD_GAME_RENDERED_DICE_SIZE_PX = 76;');
    expect(celebrationSource).toContain('const SMALL_RENDERED_DICE_SIZE_PX = 50;');
    expect(celebrationSource).toContain('const BOARD_SIZED_DICE_RATIO = 0.5;');
    expect(celebrationSource).toContain('const DICE_PIP_RADIUS_PX = 4;');
    expect(celebrationSource).toContain('const DICE_PIP_EDGE_PX = 4.8;');
    expect(celebrationSource).toContain('#765244 0 ${DICE_PIP_RADIUS_PX}px, transparent ${DICE_PIP_EDGE_PX}px');
    expect(celebrationSource).toContain('const centerY = viewportH * DICE_EPICENTER_Y_RATIO;');
    expect(celebrationSource).toContain('plan.distance *= DICE_FLIGHT_DISTANCE_SCALE;');
    expect(celebrationSource).toContain('applyFinalMergeDiceSizeProfile(plans);');
    expect(celebrationSource).toContain('laneProgress * copyWidth');
    expect(celebrationSource).toContain('attachTntBoomDiceBurst(run, renderedCopyWidth)');
    expect(celebrationSource).toContain('separateFinalMergeDiceFlightEnds(plans);');
    expect(celebrationSource).toContain('plans.push({');
    expect(celebrationSource).toContain('const value = ((plan.value - 1) % 5) + 1;');
    expect(celebrationSource).toContain('const impulse = 1 - Math.pow(1 - progress, 2.35);');
    expect(celebrationSource).toContain('const curveEnvelope = Math.sin(Math.PI * progress) * plan.curve;');
    expect(celebrationSource).toContain('+ 28 * progress * progress');
    expect(celebrationSource).toContain('const startRotationDegrees = plan.startRotation * DICE_ROTATION_SCALE * radiansToDegrees;');
    expect(celebrationSource).toContain('const rotationTravelDegrees = plan.rotationTravel * DICE_ROTATION_SCALE * radiansToDegrees;');
    expect(celebrationSource).toContain('setRotation(startRotationDegrees + rotationTravelDegrees * impulse);');
    expect(celebrationSource).toContain('duration: plan.duration');
    expect(celebrationSource).toContain('delay: plan.delay');
    expect(celebrationSource).toContain('const TEXT_ENTER_DELAY = 0.2;');
    expect(celebrationSource).toContain('const TEXT_HOLD_SECONDS = 0.6;');
    expect(celebrationSource).toContain('return Math.max(...plans.map((plan) => plan.delay + plan.duration));');
    expect(celebrationSource).toContain('Math.max(diceBurstDuration, textMotionDuration)');
    expect(celebrationSource).toContain("ease: 'back.out(2.0)'");
    expect(celebrationSource).toContain("ease: 'elastic.inOut(1, 0.2)'");
    expect(celebrationSource).toContain("ease: 'power2.in'");
    expect(celebrationSource).toContain('baseSize * (0.94 + Math.random() * 0.12)');
    expect(celebrationSource).toContain('baseScale * (1.01 + Math.random() * 0.025)');
    expect(celebrationSource).toContain('const ARCADE_COPY_LINE_HEIGHT = 0.95 * 1.15;');
    expect(celebrationSource).toContain('const COPY_VIEWPORT_WIDTH_RATIO = 0.94;');
    expect(celebrationSource).toContain('const COPY_MAX_WIDTH_PX = 520;');
    expect(celebrationSource).toContain("'width:min(94vw,520px)'");
    expect(celebrationSource).toContain("'max-width:94vw'");
    expect(celebrationSource).toContain("'align-items:baseline'");
    expect(celebrationSource).not.toContain("'align-items:center', 'justify-content:center',\n      'gap:0'");
    expect(celebrationSource).toContain("'font-weight:900'");
    expect(celebrationSource).toContain("'color:#ef744d'");
    expect(celebrationSource).toContain("'display:flex', 'flex-direction:column'");
    expect(celebrationSource).toContain("'margin-left:-1px'");
    expect(celebrationSource).toContain('domElementPool.acquire');
    expect(celebrationSource).toContain('domElementPool.release');
    expect(celebrationSource).toContain('animationManager.trackExternalTimeline');
    expect(celebrationSource).toContain("const setX = gsap.quickSetter(die, 'x', 'px')");
    expect(celebrationSource).toContain("const setY = gsap.quickSetter(die, 'y', 'px')");
    expect(celebrationSource).toContain("const setRotation = gsap.quickSetter(die, 'rotation', 'deg')");
    expect(celebrationSource).toContain("const setOpacity = gsap.quickSetter(die, 'opacity')");
    expect(celebrationSource).toContain('const timeline = trackTimeline(run, { delay: plan.delay });');
    expect(celebrationSource).toContain('scale: 1,');
    expect(celebrationSource).not.toContain("gsap.quickSetter(die, 'scale')");
    expect(celebrationSource).not.toContain('plan.peakScale');
    expect(celebrationSource).not.toContain('plan.endScale');
    expect(celebrationSource).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
  });

  test('splits dice into fixed large and small sizes without frame-scale oscillation', () => {
    const sourcePlans = createTntDiceDebrisPlans(() => 0.5);
    const plans = Array.from({ length: 27 }, (_, index) => ({
      ...sourcePlans[index % sourcePlans.length],
      size: 36 + index % 23,
    }));
    applyFinalMergeDiceSizeProfile(plans);

    const boardSizedIndices = plans
      .map((plan, index) => ({ index, size: plan.size }))
      .filter(({ size }) => size === 76)
      .map(({ index }) => index);
    expect(boardSizedIndices).toHaveLength(14);
    expect(boardSizedIndices).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 26]);
    plans.forEach((plan, index) => {
      if (!boardSizedIndices.includes(index)) expect(plan.size).toBe(50);
    });
  });

  test('launches near the copy with guaranteed randomized northern coverage', () => {
    const plans = createTntDiceDebrisPlans(() => 0.5);
    while (plans.length < 27) plans.push({ ...plans[plans.length % 16] });

    arrangeFinalMergeDiceBurstOrigins(plans, () => 0.5, 300);

    const radii = plans.map((plan) => Math.hypot(plan.startX, plan.startY));
    const guaranteedNorth = plans.slice(-7);
    expect(Math.min(...plans.map((plan) => plan.startX))).toBeLessThan(-100);
    expect(Math.max(...plans.map((plan) => plan.startX))).toBeGreaterThan(100);
    expect(radii.every(Number.isFinite)).toBe(true);
    expect(guaranteedNorth.every((plan) => Math.sin(plan.angle) < 0)).toBe(true);
    expect(guaranteedNorth[0].angle).toBeCloseTo(-2.82);
    expect(guaranteedNorth[6].angle).toBeCloseTo(-0.42);
  });

  test('separates overlapping dice endpoints without changing count or timing', () => {
    const plans = createTntDiceDebrisPlans(() => 0.5);
    const duplicate = { ...plans[0] };
    plans.push(duplicate);
    const timings = plans.map(({ delay, duration }) => ({ delay, duration }));

    separateFinalMergeDiceFlightEnds(plans);

    const endpoints = plans.map((plan) => ({
      x: plan.startX + Math.cos(plan.angle) * plan.distance,
      y: plan.startY + Math.sin(plan.angle) * plan.distance + 28,
    }));
    const lastEndpoint = endpoints[endpoints.length - 1];
    const lastPlan = plans[plans.length - 1];
    const duplicateDistance = Math.hypot(
      lastEndpoint.x - endpoints[0].x,
      lastEndpoint.y - endpoints[0].y,
    );
    expect(duplicateDistance).toBeGreaterThanOrEqual((plans[0].size + lastPlan.size) * 0.62 + 10);
    expect(plans.map(({ delay, duration }) => ({ delay, duration }))).toEqual(timings);
  });

  test('keeps short copy on one line and balances wide copy across exactly two lines', () => {
    expect(splitFinalMergeCelebrationMessage('Yesss!', 367, 65)).toEqual(['Yesss!']);
    expect(splitFinalMergeCelebrationMessage('Got ’em!', 367, 65)).toEqual(['Got ’em!']);
    expect(splitFinalMergeCelebrationMessage('Done & dusted!', 367, 65)).toEqual(['Done &', 'dusted!']);
    expect(splitFinalMergeCelebrationMessage('Perfect clear!', 367, 65)).toHaveLength(2);
  });

  test('exposes a localhost-only Journey HUD book trigger without changing Arcade behavior', () => {
    expect(hudSource).toContain('isHudJourneyCelebrationDevTriggerEnabled');
    expect(hudSource).toContain('return !isArcadeHomeRunMode()');
    expect(hudSource).toContain("await import('./final-merge-dice-celebration.js')");
    expect(hudSource).toContain('await playFinalMergeDiceCelebration();');
    expect(hudSource).toContain('isHudStageClearDevTriggerEnabled');
  });

  test('starts with final residual exit in Journey and never runs in Arcade', () => {
    const journeyStart = appCoreSource.indexOf('async function prepareFinalMergeVisualHandoff(');
    const arcadeStart = appCoreSource.indexOf('async function prepareArcadeStageClearFinalMergeHandoff(');
    const triggerStart = appCoreSource.indexOf('async function triggerCleanBoardFlow(');
    const journeyHandoff = appCoreSource.slice(journeyStart, arcadeStart);
    const arcadeHandoff = appCoreSource.slice(arcadeStart, triggerStart);

    expect(journeyHandoff).toContain('animateFinalResidualArtifactsPopOut(residualReason)');
    expect(journeyHandoff).toContain('playFinalMergeDiceCelebration()');
    expect(journeyHandoff).toContain('!isArcadeHomeRunMode()');
    expect(journeyHandoff).toContain('isArcade: false');
    expect(arcadeHandoff).toContain('animateFinalResidualArtifactsPopOut(`arcade-handoff:${residualReason}`)');
    expect(arcadeHandoff).not.toContain('playFinalMergeDiceCelebration');
    expect(appCoreSource).toContain('cleanupFinalMergeDiceCelebration();');
  });

  test('releases every pooled node and tracked owner after natural completion', async () => {
    const trackedCalls: Array<ReturnType<typeof animationManager.trackExternalTween>> = [];
    const nativeTrackCall = animationManager.trackExternalTween.bind(animationManager);
    jest.spyOn(animationManager, 'trackExternalTween').mockImplementation((call) => {
      trackedCalls.push(call);
      return nativeTrackCall(call);
    });
    const baseline = animationManager.getStats();
    const completion = playFinalMergeDiceCelebration();

    expect(document.querySelectorAll('.final-merge-dice-celebration')).toHaveLength(1);
    expect(animationManager.getStats().activeTimelines - baseline.activeTimelines).toBe(27);
    const dice = Array.from(document.querySelectorAll<HTMLElement>('.final-merge-text-die'));
    expect(dice).toHaveLength(27);
    expect(dice.map(({ dataset }) => Number(dataset.value)).every((value) => value >= 1 && value <= 5)).toBe(true);
    const diceSizes = dice.map(({ dataset }) => Number(dataset.size));
    expect(diceSizes.filter((size) => size === 76)).toHaveLength(14);
    expect(diceSizes.filter((size) => size === 50)).toHaveLength(13);
    expect(dice.every((die) => die.style.backgroundImage.includes('4px'))).toBe(true);
    expect(dice.every((die) => die.classList.contains('is-tnt-boom-burst'))).toBe(true);

    trackedCalls[0].progress(1, false);
    trackedCalls[1].progress(1, false);
    trackedCalls[2].progress(1, false);
    await completion;

    expect(document.querySelector('.final-merge-dice-celebration')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(baseline.activeTimelines);
    expect(animationManager.getStats().activeTweens).toBe(baseline.activeTweens);
    expect(domElementPool.getStats().poolSize).toBeGreaterThan(0);
  });

  test('a replacement run interrupts and resolves the prior run without residue', async () => {
    const firstCompletion = playFinalMergeDiceCelebration();
    const secondCompletion = playFinalMergeDiceCelebration();
    await firstCompletion;

    expect(document.querySelectorAll('.final-merge-dice-celebration')).toHaveLength(1);
    cleanupFinalMergeDiceCelebration();
    await secondCompletion;

    expect(document.querySelector('.final-merge-dice-celebration')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(0);
    expect(animationManager.getStats().activeTweens).toBe(0);
  });

  test('setup failure converges on the same resolved cleanup path', async () => {
    const nativeAcquire = domElementPool.acquire.bind(domElementPool);
    let acquireCount = 0;
    jest.spyOn(domElementPool, 'acquire').mockImplementation((tagName) => {
      acquireCount += 1;
      if (acquireCount === 3) throw new Error('forced setup failure');
      return nativeAcquire(tagName);
    });

    await expect(playFinalMergeDiceCelebration()).resolves.toBeUndefined();
    expect(document.querySelector('.final-merge-dice-celebration')).toBeNull();
    expect(animationManager.getStats().activeTimelines).toBe(0);
    expect(animationManager.getStats().activeTweens).toBe(0);
  });
});
