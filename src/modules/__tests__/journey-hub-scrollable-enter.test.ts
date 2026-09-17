import fs from 'node:fs';
import ts from 'typescript';
import gsap from 'gsap';
import { cancelJourneyHubScrollableEnter, startJourneyHubScrollableEnter, HUB_SCROLLABLE_ENTER_EASING, HUB_SCROLLABLE_ENTER_KEYFRAMES } from '../../ui/journey-hub-scrollable-enter';

function fixture() {
  const element = document.createElement('div'); document.body.appendChild(element);
  gsap.set(element, { scale: 0.78, y: 18, opacity: 0, transformOrigin: '50% 50%', force3D: true });
  const animation: any = { onfinish: null, oncancel: null, cancel: jest.fn() };
  element.animate = jest.fn(() => animation);
  return { element, animation };
}
afterEach(() => { cancelJourneyHubScrollableEnter(); document.body.innerHTML = ''; jest.restoreAllMocks(); });

test('Bezier and transform values match actual GSAP authored bounce throughout delay, overshoot and finish', () => {
  const f = fixture(); expect(startJourneyHubScrollableEnter(f.element)).toBe(true);
  expect(f.element.animate).toHaveBeenCalledWith(HUB_SCROLLABLE_ENTER_KEYFRAMES, { duration: 540, delay: 100, easing: HUB_SCROLLABLE_ENTER_EASING, fill: 'both' });
  const control = HUB_SCROLLABLE_ENTER_EASING.slice(HUB_SCROLLABLE_ENTER_EASING.indexOf('(') + 1, -1).split(',').map(Number);
  expect(control[0]).toBeCloseTo(1 / 3, 14); expect(control[2]).toBeCloseTo(2 / 3, 14);
  const reference = { scale: 0.78, y: 18, opacity: 0 };
  const tween = gsap.to(reference, { scale: 1, y: 0, opacity: 1, duration: 0.54, ease: 'back.out(1.75)', paused: true });
  for (let ms = 0; ms <= 640; ms++) {
    const t = Math.max(0, Math.min(1, (ms - 100) / 540));
    const progress = 3 * (1 - t) ** 2 * t * control[1] + 3 * (1 - t) * t ** 2 * control[3] + t ** 3;
    tween.time(t * 0.54);
    expect(0.78 + 0.22 * progress).toBeCloseTo(reference.scale, 4);
    expect(18 * (1 - progress)).toBeCloseTo(reference.y, 4);
    expect(progress).toBeCloseTo(reference.opacity, 4);
  }
  tween.kill();
});

test('completion retires fill and transform, and obsolete completion cannot clear replacement', () => {
  const f = fixture(); startJourneyHubScrollableEnter(f.element); const staleFinish = f.animation.onfinish;
  const replacement: any = { cancel: jest.fn(), onfinish: null, oncancel: null };
  f.element.animate = jest.fn(() => replacement); startJourneyHubScrollableEnter(f.element);
  gsap.set(f.element, { y: 18, scale: 0.78 }); const before = f.element.style.transform;
  staleFinish(); expect(f.element.style.transform).toBe(before); expect(replacement.cancel).not.toHaveBeenCalled();
  replacement.onfinish(); expect(replacement.cancel).toHaveBeenCalledTimes(1); expect(f.element.style.transform).toBe('');
  expect(f.animation.cancel).toHaveBeenCalledTimes(1);
});

test('exit interruption freezes the painted matrix before retiring fill, with synchronized GSAP state', () => {
  const f = fixture(); startJourneyHubScrollableEnter(f.element);
  jest.spyOn(window, 'getComputedStyle').mockReturnValueOnce({ transform: 'matrix(0.91, 0, 0, 0.91, 0, 7)', opacity: '0.6' } as CSSStyleDeclaration);
  cancelJourneyHubScrollableEnter({ preservePose: true });
  expect(f.animation.cancel).toHaveBeenCalledTimes(1);
  expect(Number(gsap.getProperty(f.element, 'scaleX'))).toBeCloseTo(0.91);
  expect(Number(gsap.getProperty(f.element, 'y'))).toBeCloseTo(7);
  expect(f.element.style.opacity).toBe('0.6');
  expect(f.animation.onfinish).toBeNull();
  // Hidden Hub→World handoff releases the frozen outgoing ancestor pose.
  cancelJourneyHubScrollableEnter();
  expect(f.element.style.transform).toBe('');
  expect(f.element.style.opacity).toBe('1');
});

test('cleanup retires animation and leaves no transform; unavailable or throwing WAAPI selects GSAP fallback', () => {
  const f = fixture(); startJourneyHubScrollableEnter(f.element); cancelJourneyHubScrollableEnter();
  expect(f.animation.cancel).toHaveBeenCalledTimes(1); expect(f.element.style.transform).toBe('');
  (f.element as any).animate = undefined; expect(startJourneyHubScrollableEnter(f.element)).toBe(false);
  f.element.animate = jest.fn(() => { throw new Error('unsupported'); });
  expect(startJourneyHubScrollableEnter(f.element)).toBe(false);
});


test('actual Hub entry starts at zero opacity and its compositor owner settles visible', () => {
  const source = ts.createSourceFile('animations.ts', fs.readFileSync('src/ui/collectibles-animations.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const method = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'animateCollectiblesScreenEnter')!;
  const code = ts.transpileModule(method.getText(source).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  document.body.innerHTML = '<div id="journey-screen"><div class="collectibles-header"></div><div class="collectibles-scrollable"><div class="journey-v700-hub"></div></div></div>';
  const element = document.querySelector('.collectibles-scrollable') as HTMLElement;
  const animation: any = { cancel: jest.fn(), onfinish: null, oncancel: null };
  element.animate = jest.fn(() => animation);
  const trackTween = jest.fn();
  const scope = { gsap, trackTween, startJourneyHubScrollableEnter, cancelJourneyHubScrollableEnter };
  const run = new Function('scope', `with(scope){${code};return animateCollectiblesScreenEnter;}`)(scope);
  run();
  expect(element.style.opacity).toBe('0');
  expect(element.animate).toHaveBeenCalledWith([
    { transform: 'translate3d(0, 18px, 0) scale(0.78)', opacity: 0 },
    { transform: 'translate3d(0, 0px, 0) scale(1)', opacity: 1 },
  ], expect.objectContaining({ duration: 540, delay: 100 }));
  expect(trackTween.mock.calls.some(([target]) => target === element)).toBe(false);
  animation.onfinish();
  expect(element.style.opacity).toBe('1'); expect(element.style.transform).toBe('');
});
