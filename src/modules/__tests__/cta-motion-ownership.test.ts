/** @jest-environment jsdom */
import { gsap } from 'gsap';
import { registerCta } from '../cta-system';

jest.mock('../animation-manager', () => ({ __esModule: true, default: { trackExternalTween: (tween: unknown) => tween } }));
jest.mock('../cta-activation-sound', () => ({ playCtaActivationSounds: jest.fn(), preloadCtaActivationSounds: jest.fn() }));

function fixture() {
  const element = document.createElement('button'); element.textContent = 'Play'; document.body.append(element);
  const controller = registerCta(element, { variant: 'primary' });
  return { element, controller, visual: element.querySelector('.cc-cta__visual') as HTMLElement };
}
function complete(visual: HTMLElement) { gsap.getTweensOf(visual).forEach((tween) => tween.totalProgress(1)); }
afterEach(() => { gsap.globalTimeline.clear(); gsap.ticker.sleep(); document.body.innerHTML = ''; });

test('real delayed GSAP exit preserves current pose and cannot hide a subsequently primed CTA', async () => {
  const { element, controller, visual } = fixture();
  gsap.set(visual, { scale: 0.93, y: 2 });
  const pose = visual.style.transform;
  const pending = controller.exit({ delay: 0.12 });
  expect(visual.style.transform).toBe(pose);
  controller.prime('idle');
  await pending;
  expect(element.dataset.ctaState).toBe('idle');
  expect(element.style.visibility).toBe('visible');
  expect(element.disabled).toBe(false);
  controller.dispose();
});

test('replacement exit keeps its own delay and hides only at its real completion', async () => {
  const { element, controller, visual } = fixture();
  const first = controller.exit({ delay: 0.12 });
  const second = controller.exit({ delay: 0.2 });
  await first;
  expect(element.dataset.ctaState).toBe('exiting');
  expect(element.style.visibility).not.toBe('hidden');
  expect(gsap.getTweensOf(visual)).toHaveLength(1);
  expect(gsap.getTweensOf(visual)[0].delay()).toBe(0.2);
  complete(visual); await second;
  expect(element.dataset.ctaState).toBe('hidden');
  expect(element.style.visibility).toBe('hidden');
  controller.dispose();
});

test('replacement enter stays visible after the old exit resolves and settles normally', async () => {
  const { element, controller, visual } = fixture();
  const exit = controller.exit({ delay: 0.12 });
  const enter = controller.enter({ delay: 0.1 });
  await exit;
  expect(element.dataset.ctaState).toBe('entering');
  expect(element.style.visibility).toBe('visible');
  complete(visual); await enter;
  expect(element.dataset.ctaState).toBe('idle');
  controller.dispose();
});

test('prime invalidates a pending enter completion too', async () => {
  const { element, controller } = fixture();
  const enter = controller.enter({ delay: 0.12 });
  controller.prime('hidden'); await enter;
  expect(element.dataset.ctaState).toBe('hidden');
  expect(element.style.visibility).toBe('hidden');
  controller.dispose();
});

test('dispose and direct tween interruption still settle returned exit promises', async () => {
  const first = fixture(); const disposedExit = first.controller.exit({ delay: 0.12 });
  first.controller.dispose(); await disposedExit;
  expect(first.element.dataset.ctaState).toBeUndefined();
  const second = fixture(); const interruptedExit = second.controller.exit({ delay: 0.12 });
  gsap.killTweensOf(second.visual); await interruptedExit;
  expect(second.element.dataset.ctaState).toBe('hidden');
  second.controller.dispose();
});
