/** @jest-environment jsdom */
import fs from 'node:fs';
import ts from 'typescript';
import { gsap } from 'gsap';
import { getHomepageHeroExitMotion } from '../homepage-hero-motion';
import { JOURNEY_WORLD_CARTOON_BOUNCE_ENTER, getJourneyV700HubWorldExitDuration } from '../journey-v700-motion';
const source = ts.createSourceFile('animations.ts', fs.readFileSync('src/utils/animations.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = new Set(['animateJourneySliderExit', 'finalizeJourneySliderExit', 'HOMEPAGE_PART_EXIT_LEAD_MS', 'HOMEPAGE_PART_EXIT_DURATION_MS', 'isHomepageExitCancelled', 'cancelledHomepageExitPromises']);
const declarations: string[] = [];
ts.forEachChild(source, (node) => {
  if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
    if (names.has(declaration.name.getText(source))) declarations.push(`const ${declaration.getText(source)};`);
  }
});
const code = ts.transpileModule(declarations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(withHero = true) {
  const hero = document.createElement('div'); hero.className = 'hero-container';
  const image = document.createElement('img'); const logo = document.createElement('div');
  const button = document.createElement('button'); hero.append(image);
  const created: { element: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions; animation: any }[] = [];
  for (const element of [hero, image, logo]) element.animate = ((frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = { startTime: null, onfinish: null as null | (() => void), oncancel: null as null | (() => void), cancelled: false, cancel() { this.cancelled = true; this.oncancel?.(); } };
    created.push({ element, frames, options, animation }); return animation;
  }) as any;
  const prime = jest.fn();
  const exit = jest.fn(() => new Promise<void>(() => {}));
  const scope: any = {
    cancelPendingJourneySliderExit: null, journeySliderExitPromise: null, journeySliderExitPerformance: null, isAnimatingExit: false, journeySliderExitAnimations: [], journeySliderExitFallback: null,
    sliderState: { setAnimatingExit: jest.fn() }, gameState: { set: jest.fn() }, gsap: { killTweensOf: jest.fn() }, logger: { info: jest.fn() },
    beginTransitionPerformance: () => ({ phase: (_n: string, fn: () => any) => fn(), finish: jest.fn() }),
    getJourneySliderExitTargets: () => [...(withHero ? [{ element: hero, delay: 0 }] : []), { element: logo, delay: 0.06 }, { element: button, delay: 0.03 }],
    getRegisteredCta: () => ({ exit, prime }), getHomepageHeroExitMotion,
  };
  const api = new Function('scope', `with(scope){${code};return {animateJourneySliderExit,finalizeJourneySliderExit,isHomepageExitCancelled};}`)(scope);
  return { ...api, created, hero, image, logo, exit, prime };
}
beforeEach(() => { jest.useFakeTimers(); Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: 100 } }); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); delete (document as any).timeline; });

test('hero matches World duration as one scheduled motion; controls keep their timing', () => {
  const h = fixture(); h.animateJourneySliderExit();
  const hero = h.created.find((x: any) => x.element === h.hero)!;
  const logo = h.created.find((x: any) => x.element === h.logo)!;
  expect(hero.options).toMatchObject({ duration: 516, delay: 0, fill: 'forwards' });
  expect(logo.options).toMatchObject({ duration: 460, delay: 210 });
  expect(h.exit).toHaveBeenCalledWith({ delay: .18 });
  expect(h.created.every((x: any) => x.animation.startTime === 100)).toBe(true);
  expect(h.created.some((x: any) => x.element === h.image)).toBe(false);
  expect(hero.frames).toEqual(getHomepageHeroExitMotion().keyframes);
  expect(h.hero.style.transformOrigin).toBe('50% 54%');
  jest.advanceTimersByTime(500);
  expect(h.created).toHaveLength(2);
});

test('finalization cannot create late animation or leave fallback timers', () => {
  const h = fixture(); h.animateJourneySliderExit(); h.finalizeJourneySliderExit();
  expect(jest.getTimerCount()).toBe(0);
  h.created.forEach((x: any) => x.animation.oncancel?.());
  expect(h.created).toHaveLength(2);
});

test('without a hero, controls retain their original delays', () => {
  const h = fixture(false); h.animateJourneySliderExit();
  expect(h.created[0].options.delay).toBe(60);
  expect(h.exit).toHaveBeenCalledWith({ delay: .03 });
});

// Evaluate the actual easing selected by the production owner, rather than
// assuming two individually valid animations compose into one clean pulse.
function curveY(easing: string, elapsed: number): number {
  const [x1, y1, x2, y2] = easing.slice(easing.indexOf('(') + 1).match(/[-\d.]+/g)!.map(Number);
  const at = (t: number, a: number, b: number) => 3*(1-t)*(1-t)*t*a + 3*(1-t)*t*t*b + t*t*t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const t = (lo+hi)/2; if (at(t,x1,x2) < elapsed) lo=t; else hi=t; }
  return at((lo+hi)/2,y1,y2);
}
test.each([false, true])('every hero scale sample matches the selected World timeline, reducedMotion=%s', (reducedMotion) => {
  const reference = JOURNEY_WORLD_CARTOON_BOUNCE_ENTER;
  const inflate = getJourneyV700HubWorldExitDuration(reference.bounceDurationSeconds, reducedMotion) * 1000;
  const collapse = getJourneyV700HubWorldExitDuration(reference.exitDurationSeconds, reducedMotion) * 1000;
  const motion = getHomepageHeroExitMotion(reducedMotion);
  expect(motion.duration).toBeCloseTo(inflate + collapse, 8);
  expect(motion.transformOrigin).toBe(reference.transformOrigin);
  expect(motion.keyframes[1].offset).toBeCloseTo(inflate / motion.duration, 8);
  const peak = String(motion.keyframes[1].scale).split(' ').map(Number);
  expect(peak).toEqual([reference.scaleX, reference.scaleY]);
  const bounceEase = gsap.parseEase(reference.bounceEase);
  const collapseEase = gsap.parseEase(reference.exitEase);
  for (let i = 0; i <= 1000; i++) {
    const progress = i/1000;
    expect(curveY(motion.keyframes[0].easing!, progress)).toBeCloseTo(bounceEase(progress), 8);
    expect(curveY(motion.keyframes[1].easing!, progress)).toBeCloseTo(collapseEase(progress), 8);
    for (const axisPeak of peak) {
      expect(1 + (axisPeak-1)*curveY(motion.keyframes[0].easing!, progress))
        .toBeCloseTo(1 + (axisPeak-1)*bounceEase(progress), 8);
      expect(axisPeak*(1-curveY(motion.keyframes[1].easing!, progress)))
        .toBeCloseTo(axisPeak*(1-collapseEase(progress)), 8);
    }
  }
});


test('reads all painted exit poses before writing any part and preserves both poses', () => {
  const h = fixture();
  const order: string[] = [];
  const original = window.getComputedStyle.bind(window);
  jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    if (element === h.hero || element === h.logo) {
      order.push('read');
      return { transform: element === h.hero ? 'matrix(1.1, 0, 0, 1.1, 0, 0)' : 'matrix(1, 0, 0, 1, 0, 8)' } as CSSStyleDeclaration;
    }
    return original(element);
  });
  for (const element of [h.hero, h.logo]) {
    const set = element.style.setProperty.bind(element.style);
    jest.spyOn(element.style, 'setProperty').mockImplementation((...args) => { order.push('write'); return set(...args); });
  }
  h.animateJourneySliderExit();
  expect(order.slice(0, 2)).toEqual(['read', 'read']);
  expect(order.slice(2)).not.toContain('read');
  expect(h.hero.style.transform).toBe('matrix(1.1, 0, 0, 1.1, 0, 0)');
  expect(h.logo.style.transform).toBe('matrix(1, 0, 0, 1, 0, 8)');
});


test('early finalization settles as cancelled and late target callbacks cannot finish the next exit', async () => {
  const h = fixture();
  const first = h.animateJourneySliderExit();
  expect(h.animateJourneySliderExit()).toBe(first);
  const late = h.created.map((entry: any) => entry.animation.onfinish);
  h.finalizeJourneySliderExit();
  await first;
  expect(h.prime).toHaveBeenCalledWith('idle');
  expect(h.isHomepageExitCancelled(first)).toBe(true);
  let secondSettled = false;
  const second = h.animateJourneySliderExit(); second.then(() => { secondSettled = true; });
  late.forEach((finish: () => void) => finish());
  await Promise.resolve();
  expect(secondSettled).toBe(false);
  expect(h.isHomepageExitCancelled(second)).toBe(false);
  jest.advanceTimersByTime(850); await second;
  expect(h.isHomepageExitCancelled(second)).toBe(false);
  h.finalizeJourneySliderExit();
});

test('partial startup failure cancels created animations and a subsequent request retries', async () => {
  const h = fixture();
  const animateLogo = h.logo.animate;
  h.logo.animate = () => { throw new Error('startup'); };
  const first = h.animateJourneySliderExit();
  await expect(first).rejects.toThrow('startup');
  expect(h.created[0].animation.cancelled).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
  h.logo.animate = animateLogo;
  const retry = h.animateJourneySliderExit();
  expect(retry).not.toBe(first);
  expect(h.created).toHaveLength(3);
  jest.advanceTimersByTime(850); await retry;
  h.finalizeJourneySliderExit();
});
