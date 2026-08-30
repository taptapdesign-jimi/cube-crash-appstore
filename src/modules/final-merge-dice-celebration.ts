import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { domElementPool } from './dom-element-pool.js';
import { createTntDiceDebrisPlans } from './tnt-animation.js';

export const FINAL_MERGE_CELEBRATION_MESSAGE = 'Cleared';

// Exact NO MOVES text-motion contract from splash-text-overlay.ts.
const ENTER_BOUNCE_SCALE = 1.2;
const ENTER_DURATION = 0.24;
const SETTLE_DURATION = 0.1;
const FINAL_SETTLE_DURATION = 0.1;
const BOOM_ENTER_STAGGER = 0.05;
const BOOM_EXIT_STAGGER = 0.06;
const BOOM_ENTER_EXTRA = 0.1;
const BOOM_EXIT_EXTRA = 0.3;
const EXIT_BOUNCE_DURATION = 0.13;
const EXIT_FADE_DURATION = 0.17;
const TEXT_ENTER_DELAY = 0.2;
const TEXT_HOLD_SECONDS = 0.6;
const ARCADE_COPY_LINE_HEIGHT = 0.95 * 1.15;
const COPY_VIEWPORT_WIDTH_RATIO = 0.94;
const COPY_MAX_WIDTH_PX = 520;

const PIP_POINTS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[31, 31], [69, 69]],
  3: [[29, 29], [50, 50], [71, 71]],
  4: [[31, 31], [69, 31], [31, 69], [69, 69]],
  5: [[29, 29], [71, 29], [50, 50], [29, 71], [71, 71]],
};

interface CelebrationRun {
  overlay: HTMLDivElement;
  pooledElements: HTMLElement[];
  timelines: gsap.core.Timeline[];
  delayedCalls: gsap.core.Tween[];
  resolve: () => void;
  finished: Promise<void>;
  settled: boolean;
}

let activeRun: CelebrationRun | null = null;

function trackTimeline(run: CelebrationRun, options: gsap.TimelineVars = {}): gsap.core.Timeline {
  const timeline = animationManager.trackExternalTimeline(gsap.timeline(options));
  run.timelines.push(timeline);
  return timeline;
}

function trackDelayedCall(run: CelebrationRun, delay: number, callback: () => void): gsap.core.Tween {
  const call = animationManager.trackExternalTween(gsap.delayedCall(delay, callback));
  run.delayedCalls.push(call);
  return call;
}

function chooseMessage(): string {
  return FINAL_MERGE_CELEBRATION_MESSAGE;
}

function createArcadeStyleLetterSizes(count: number, baseSize: number): number[] {
  return Array.from({ length: count }, () => baseSize * (0.94 + Math.random() * 0.12));
}

export function splitFinalMergeCelebrationMessage(
  message: string,
  maxWidthPx: number,
  baseFontPx: number,
): string[] {
  const words = message.trim().split(/\s+/).filter(Boolean);
  const estimatedWidth = message.length * baseFontPx * 0.58;
  if (words.length < 2 || estimatedWidth <= maxWidthPx) return [message];

  let bestSplit = 1;
  let bestBalance = Number.POSITIVE_INFINITY;
  for (let split = 1; split < words.length; split += 1) {
    const first = words.slice(0, split).join(' ');
    const second = words.slice(split).join(' ');
    const widestLine = Math.max(first.length, second.length);
    const balance = widestLine * 2 + Math.abs(first.length - second.length);
    if (balance < bestBalance) {
      bestBalance = balance;
      bestSplit = split;
    }
  }
  return [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')];
}

function diceBackground(value: number): string {
  const pips = (PIP_POINTS[value] || PIP_POINTS[1]).map(([x, y]) => (
    `radial-gradient(circle at ${x}% ${y}%, #765244 0 5.7%, transparent 6.4%)`
  ));
  return [...pips, 'url("./assets/tile.png")'].join(',');
}

function finishRun(run: CelebrationRun): void {
  if (run.settled) return;
  run.settled = true;
  run.delayedCalls.forEach((call) => animationManager.killExternalTween(call));
  run.timelines.forEach((timeline) => animationManager.killExternalTimeline(timeline));
  [...run.pooledElements].reverse().forEach((element) => {
    element.textContent = '';
    domElementPool.release(element);
  });
  run.overlay.textContent = '';
  domElementPool.release(run.overlay);
  if (activeRun === run) activeRun = null;
  run.resolve();
}

function attachTntBoomDiceBurst(run: CelebrationRun): number {
  const viewportW = Math.max(320, window.innerWidth || 390);
  const viewportH = Math.max(520, window.innerHeight || 844);
  const centerX = viewportW * 0.5;
  const centerY = viewportH * 0.5;
  const radiansToDegrees = 180 / Math.PI;

  // Use the exact authored TNT BOOM plan rather than a look-alike motion.
  const plans = createTntDiceDebrisPlans();
  const upperLeftAngles = [-2.72, -2.38, -2.06] as const;
  upperLeftAngles.forEach((angle, index) => {
    const source = plans[[2, 6, 10][index]];
    const startRadius = 18 + index * 9;
    plans.push({
      ...source,
      value: 1 + Math.floor(Math.random() * 5),
      angle,
      startX: Math.cos(angle) * startRadius,
      startY: Math.sin(angle) * startRadius,
      delay: 0.24 + index * 0.16,
    });
  });
  const currentPlanCount = plans.length;
  const fortyPercentMoreDice = Math.round(currentPlanCount * 0.4);
  for (let index = 0; index < fortyPercentMoreDice; index += 1) {
    const source = plans[(index * 2 + 1) % currentPlanCount];
    const angleOffset = (index % 2 === 0 ? -1 : 1) * (0.045 + (index % 3) * 0.018);
    plans.push({
      ...source,
      value: 1 + Math.floor(Math.random() * 5),
      angle: source.angle + angleOffset,
      startX: source.startX + Math.cos(source.angle) * (8 + (index % 3) * 4),
      startY: source.startY + Math.sin(source.angle) * (8 + (index % 3) * 4),
      delay: source.delay + 0.055 + (index % 3) * 0.025,
    });
  }
  const diceSeparationScale = 1.4;
  plans.forEach((plan) => {
    const randomAngleSeparation = (Math.random() - 0.5) * 0.18;
    const startRadius = Math.hypot(plan.startX, plan.startY) * diceSeparationScale;
    const startAngle = Math.atan2(plan.startY, plan.startX) + randomAngleSeparation;
    plan.startX = Math.cos(startAngle) * startRadius;
    plan.startY = Math.sin(startAngle) * startRadius;
    plan.angle += randomAngleSeparation;
  });

  plans.forEach((plan) => {
    // The celebration's authored copy asks for faces 1-5; motion remains the
    // exact TNT plan even when its generated sixth face is mapped back to 1.
    const value = ((plan.value - 1) % 5) + 1;
    const size = plan.size;

    const die = domElementPool.acquire('div');
    run.pooledElements.push(die);
    die.className = 'final-merge-text-die is-tnt-boom-burst';
    die.dataset.value = String(value);
    die.dataset.size = size.toFixed(2);
    die.style.cssText = [
      'position:absolute', 'z-index:1', 'pointer-events:none', 'will-change:transform,opacity',
      `width:${size.toFixed(1)}px`, `height:${size.toFixed(1)}px`, `left:${centerX}px`, `top:${centerY}px`,
      `background-image:${diceBackground(value)}`, 'background-size:100% 100%', 'background-repeat:no-repeat',
      'transform-origin:center center', 'backface-visibility:hidden',
      'filter:drop-shadow(0 5px 5px rgba(85,49,31,.18))',
    ].join(';');
    run.overlay.appendChild(die);
    gsap.set(die, {
      xPercent: -50,
      yPercent: -50,
      x: plan.startX,
      y: plan.startY,
      scale: plan.startScale,
      opacity: 0,
      rotation: plan.startRotation * radiansToDegrees,
      force3D: true,
    });

    const flight = { progress: 0 };
    const perpendicularX = -Math.sin(plan.angle);
    const perpendicularY = Math.cos(plan.angle);
    const timeline = trackTimeline(run, { delay: plan.delay });
    timeline.to(flight, {
      progress: 1,
      duration: plan.duration,
      ease: 'none',
      onUpdate: () => {
        if (run.settled || !die.isConnected) return;
        const progress = flight.progress;
        const impulse = 1 - Math.pow(1 - progress, 2.35);
        const curveEnvelope = Math.sin(Math.PI * progress) * plan.curve;
        const fadeOut = Math.max(0, (progress - 0.78) / 0.22);
        const popIn = Math.min(1, progress / 0.12);
        const liveScale = plan.startScale + (plan.peakScale - plan.startScale) * popIn;
        const scale = liveScale + (plan.endScale - liveScale) * fadeOut;
        gsap.set(die, {
          x: plan.startX
            + Math.cos(plan.angle) * plan.distance * impulse
            + perpendicularX * curveEnvelope,
          y: plan.startY
            + Math.sin(plan.angle) * plan.distance * impulse
            + perpendicularY * curveEnvelope
            + 28 * progress * progress,
          rotation: (plan.startRotation + plan.rotationTravel * impulse) * radiansToDegrees,
          scale,
          opacity: popIn * (1 - fadeOut),
        });
      },
    });
  });
  return Math.max(...plans.map((plan) => plan.delay + plan.duration));
}

function getTextExitDuration(letterCount: number): number {
  return BOOM_EXIT_STAGGER * Math.max(0, letterCount - 1)
    + EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2
    + EXIT_FADE_DURATION + BOOM_EXIT_EXTRA * 0.8
    + 0.05;
}

function startNoMovesTextMotion(run: CelebrationRun, letterElements: HTMLElement[]): void {
  if (run.settled || activeRun !== run) return;
  const letterScales = letterElements.map(() => 1);
  const letterRotations = letterElements.map(() => 0);
  const bounceTimelines: gsap.core.Timeline[] = [];

  letterElements.forEach((element, index) => {
    const baseScale = letterScales[index];
    const baseRotation = letterRotations[index];
    element.style.willChange = 'transform, opacity';
    element.style.contain = 'layout style paint';
    gsap.set(element, {
      opacity: 0,
      scale: 0,
      x: 0,
      y: 0,
      rotation: baseRotation,
      rotationX: 0,
      rotationY: 0,
      z: 0,
      force3D: true,
    });

    const enterTimeline = trackTimeline(run, { delay: index * BOOM_ENTER_STAGGER });
    enterTimeline.to(element, {
      opacity: 1,
      scale: baseScale * ENTER_BOUNCE_SCALE,
      rotationX: -5,
      z: 20,
      duration: ENTER_DURATION + BOOM_ENTER_EXTRA * 0.6,
      ease: 'back.out(2.0)',
    });
    enterTimeline.to(element, {
      scale: baseScale * 0.95,
      rotationX: 0,
      z: 0,
      duration: SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
      ease: 'power2.out',
    });
    enterTimeline.to(element, {
      opacity: 1,
      scale: baseScale,
      duration: FINAL_SETTLE_DURATION + BOOM_ENTER_EXTRA * 0.2,
      ease: 'back.out(1.5)',
      onComplete: () => bounceTimelines[index]?.play(0),
    });

    const bounceTimeline = trackTimeline(run, { repeat: -1, yoyo: true });
    bounceTimeline.pause(0);
    bounceTimeline.to(element, {
      scale: baseScale * (1.01 + Math.random() * 0.025),
      duration: 0.35,
      ease: 'elastic.inOut(1, 0.2)',
    });
    bounceTimelines[index] = bounceTimeline;
  });

  trackDelayedCall(run, TEXT_HOLD_SECONDS - TEXT_ENTER_DELAY, () => {
    if (run.settled || activeRun !== run) return;
    bounceTimelines.forEach((timeline) => animationManager.killExternalTimeline(timeline));
    letterElements.forEach((element, index) => {
      const baseScale = letterScales[index];
      const baseRotation = letterRotations[index];
      const exitRotation = (baseRotation >= 0 ? 1 : -1) * (12 + Math.random() * 8);
      const exitTimeline = trackTimeline(run, { delay: index * BOOM_EXIT_STAGGER });
      exitTimeline.to(element, {
        scale: baseScale * 1.1,
        z: 30,
        duration: EXIT_BOUNCE_DURATION + BOOM_EXIT_EXTRA * 0.2,
        ease: 'power2.out',
      });
      exitTimeline.to(element, {
        opacity: 0,
        scale: 0,
        rotation: exitRotation,
        rotationX: 45,
        rotationY: 30,
        z: -100,
        duration: EXIT_FADE_DURATION + BOOM_EXIT_EXTRA * 0.8,
        ease: 'power2.in',
      });
    });
  });
}

export function cleanupFinalMergeDiceCelebration(): void {
  if (activeRun) finishRun(activeRun);
}

export function playFinalMergeDiceCelebration(): Promise<void> {
  cleanupFinalMergeDiceCelebration();
  if (typeof document === 'undefined' || document.hidden) return Promise.resolve();

  let resolveFinished!: () => void;
  const finished = new Promise<void>((resolve) => { resolveFinished = resolve; });
  const overlay = domElementPool.acquire('div') as HTMLDivElement;
  const run: CelebrationRun = {
    overlay,
    pooledElements: [],
    timelines: [],
    delayedCalls: [],
    resolve: resolveFinished,
    finished,
    settled: false,
  };
  activeRun = run;

  try {
  overlay.className = 'final-merge-dice-celebration cc-no-moves-motion';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999999', 'pointer-events:none',
    'display:flex', 'align-items:center', 'justify-content:center', 'overflow:hidden',
  ].join(';');

  const container = domElementPool.acquire('div');
  run.pooledElements.push(container);
  container.className = 'final-merge-win-copy cc-no-moves-text-motion';
  container.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)',
    'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
    'gap:4px', 'margin:0', 'padding:0', 'width:min(94vw,520px)', 'min-width:0', 'max-width:94vw',
    'box-sizing:border-box', 'z-index:2', 'pointer-events:none', 'perspective:1000px',
    'transform-style:preserve-3d', 'text-align:center',
  ].join(';');

  const viewportW = Math.max(320, window.innerWidth || 390);
  const maxTextWidth = Math.min(viewportW * COPY_VIEWPORT_WIDTH_RATIO, COPY_MAX_WIDTH_PX);
  const baseFontSize = Math.min(86, Math.max(65, viewportW * 0.14));
  const message = chooseMessage();
  const lines = splitFinalMergeCelebrationMessage(message, maxTextWidth, baseFontSize);
  const widestEstimatedLine = Math.max(...lines.map((line) => line.length * baseFontSize * 0.58));
  const viewportFitScale = Math.min(1, maxTextWidth / Math.max(1, widestEstimatedLine));
  const letterElements: HTMLElement[] = [];

  lines.forEach((line, lineIndex) => {
    const lineElement = domElementPool.acquire('div');
    run.pooledElements.push(lineElement);
    lineElement.className = `final-merge-win-line line-${lineIndex + 1}`;
    lineElement.style.cssText = [
      'display:flex', 'flex-direction:row', 'align-items:baseline', 'justify-content:center',
      'gap:0', 'width:100%', 'white-space:nowrap', `line-height:${ARCADE_COPY_LINE_HEIGHT}`,
    ].join(';');
    container.appendChild(lineElement);

    const lineCharacters = Array.from(line);
    const lineLetterSizes = createArcadeStyleLetterSizes(lineCharacters.length, baseFontSize);
    lineCharacters.forEach((character, index) => {
      const letter = domElementPool.acquire('div');
      run.pooledElements.push(letter);
      letterElements.push(letter);
      letter.textContent = character === ' ' ? '\u00a0' : character;
      const letterFontSize = lineLetterSizes[index] * viewportFitScale;
      letter.style.cssText = [
        'font-family:"Baloo2",system-ui,-apple-system,sans-serif', 'font-weight:900',
        `font-size:${letterFontSize.toFixed(1)}px`, `line-height:${ARCADE_COPY_LINE_HEIGHT}`, 'color:#ef744d',
        'text-align:center', 'opacity:0', 'transform:scale(0) perspective(1000px) translateZ(0)',
        'display:inline-block', 'visibility:visible', 'pointer-events:none', 'margin-right:0',
        index === 0 ? 'margin-left:0' : 'margin-left:-1px', 'padding:0', 'border:0', 'outline:0',
        'vertical-align:top', 'transform-style:preserve-3d', 'backface-visibility:hidden',
        '-webkit-font-smoothing:antialiased', 'text-rendering:optimizeLegibility',
        'transform-origin:center center', 'position:relative', 'z-index:10',
        character === ' ' ? 'min-width:20px' : 'min-width:0',
      ].join(';');
      lineElement.appendChild(letter);
    });
  });

  overlay.appendChild(container);
  document.body.appendChild(overlay);
  const diceBurstDuration = attachTntBoomDiceBurst(run);
  trackDelayedCall(run, TEXT_ENTER_DELAY, () => startNoMovesTextMotion(run, letterElements));
  const textMotionDuration = TEXT_HOLD_SECONDS + getTextExitDuration(letterElements.length);
  trackDelayedCall(run, Math.max(diceBurstDuration, textMotionDuration), () => finishRun(run));
  } catch {
    finishRun(run);
  }
  return finished;
}
