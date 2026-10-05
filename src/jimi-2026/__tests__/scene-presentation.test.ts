import { gsap } from 'gsap';
import { createScenePresentation } from '../scene-presentation';
import { createSceneDirector, type SceneTransitionContext } from '../scene-director';
import { getJourneyV700MotionProfile } from '../../modules/journey-v700-motion';

jest.mock('gsap', () => ({ gsap: { timeline: jest.fn(), set: jest.fn() } }));
type Pose = { scale?: number; y?: number; opacity?: number };
type MockTimeline = { fromTo: jest.Mock; to: jest.Mock; kill: jest.Mock; complete: () => void; lateComplete: () => void };
const timelines: MockTimeline[] = [];
function applyPose(targets: HTMLElement[], pose: Pose) {
  targets.forEach(target => {
    if (pose.scale !== undefined) target.style.transform = `translateY(${pose.y ?? 0}px) scale(${pose.scale})`;
    if (pose.opacity !== undefined) target.style.opacity = String(pose.opacity);
  });
}
function fixture() {
  const host = document.createElement('main');
  const root = document.createElement('section');
  root.innerHTML = '<div data-jimi-unit><img src="unchanged.png"><div class="rotor" style="transform:rotateY(180deg)"></div></div><button data-jimi-unit>Go</button>';
  document.body.append(host);
  const units = Array.from(root.querySelectorAll<HTMLElement>('[data-jimi-unit]'));
  const controller = new AbortController();
  const context: SceneTransitionContext = { signal: controller.signal, isCurrent: () => !controller.signal.aborted };
  return { root, host, units, controller, context };
}
async function flush() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
beforeEach(() => {
  timelines.length = 0;
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(() => ({ matches: false })) });
  (gsap.set as jest.Mock).mockImplementation(() => { throw new Error('GSAP cleanup forbidden'); });
  (gsap.timeline as jest.Mock).mockImplementation((options: { onComplete: () => void }) => {
    const steps: Array<{ targets: HTMLElement[]; pose: Pose }> = [];
    const timeline: MockTimeline = {
      fromTo: jest.fn(), to: jest.fn(), kill: jest.fn(), lateComplete: options.onComplete,
      complete: () => { steps.forEach(step => applyPose(step.targets, step.pose)); options.onComplete(); },
    };
    timeline.fromTo.mockImplementation((targets: HTMLElement[], from: Pose, to: Pose) => {
      applyPose(targets, from); steps.push({ targets, pose: to }); return timeline;
    });
    timeline.to.mockImplementation((targets: HTMLElement[], pose: Pose) => { steps.push({ targets, pose }); return timeline; });
    timelines.push(timeline);
    return timeline;
  });
});
afterEach(() => { expect(gsap.set).not.toHaveBeenCalled(); document.body.replaceChildren(); jest.restoreAllMocks(); });

describe('Jimi finite GSAP scene presentation with direct cleanup', () => {
  it('prepares hidden/inert and leaves mount/input to explicit ownership', () => {
    const f = fixture();
    const art = f.root.querySelector('img');
    const handle = createScenePresentation(f.root, f.host);
    expect(f.root.hidden).toBe(true);
    expect(f.root.inert).toBe(true);
    expect(f.root.isConnected).toBe(false);
    expect(timelines).toHaveLength(0);
    handle.setVisible(true);
    expect(f.root.parentElement).toBe(f.host);
    expect(f.root.getAttribute('aria-hidden')).toBe('false');
    expect(f.root.inert).toBe(true);
    handle.setInputEnabled(true);
    expect(f.root.inert).toBe(false);
    handle.setVisible(false);
    expect(f.root.getAttribute('aria-hidden')).toBe('true');
    expect(f.root.querySelector('img')).toBe(art);
    handle.dispose();
  });

  it.each([false, true])('retains canonical enter/cascade and directly clears pose (reduced=%s)', async reduced => {
    (window.matchMedia as jest.Mock).mockReturnValue({ matches: reduced });
    const f = fixture();
    const handle = createScenePresentation(f.root, f.host);
    const profile = getJourneyV700MotionProfile(reduced);
    const entered = handle.enter(f.context);
    expect(timelines[0].fromTo).toHaveBeenCalledWith(f.units,
      { scale: profile.enter.scale, x: 0, y: profile.enter.y, opacity: 0 },
      { scale: 1, x: 0, y: 0, opacity: 1, duration: profile.enter.duration,
        ease: profile.enter.ease, stagger: { amount: profile.cascadeWindow } });
    timelines[0].complete();
    await entered;
    f.units.forEach(unit => { expect(unit.style.transform).toBe(''); expect(unit.style.opacity).toBe(''); });
    expect(f.root.inert).toBe(true);
    expect(f.root.querySelector<HTMLElement>('.rotor')!.style.transform).toBe('rotateY(180deg)');
    handle.dispose();
  });

  it.each([false, true])('exits from identity and stays collapsed until hide/rollback (reduced=%s)', async reduced => {
    (window.matchMedia as jest.Mock).mockReturnValue({ matches: reduced });
    const f = fixture();
    const handle = createScenePresentation(f.root, f.host);
    handle.setVisible(true);
    f.units[0].style.transform = 'scale(0.37)';
    const exited = handle.exit(f.context);
    const profile = getJourneyV700MotionProfile(reduced);
    expect(timelines[0].fromTo).toHaveBeenCalledWith(f.units,
      { scale: 1, x: 0, y: 0, opacity: 1 },
      { scale: profile.exit.anticipationScale, duration: profile.exit.anticipationDuration, ease: 'power2.in' });
    expect(timelines[0].to).toHaveBeenCalledWith(f.units,
      { scale: 0, duration: profile.exit.duration, ease: profile.exit.ease, stagger: { amount: profile.cascadeWindow } });
    timelines[0].complete();
    await exited;
    expect(f.root.hidden).toBe(false);
    f.units.forEach(unit => expect(unit.style.transform).toBe('translateY(0px) scale(0)'));
    handle.cancelMotion();
    f.units.forEach(unit => expect(unit.style.transform).toBe(''));
    handle.dispose();
  });

  it('abort kills motion, resolves, removes its hook and ignores late completion', async () => {
    const f = fixture();
    const remove = jest.spyOn(f.controller.signal, 'removeEventListener');
    const handle = createScenePresentation(f.root, f.host);
    const entered = handle.enter(f.context);
    f.controller.abort();
    await entered;
    expect(timelines[0].kill).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    f.units[0].style.transform = 'scale(0.8)';
    timelines[0].lateComplete();
    expect(f.units[0].style.transform).toBe('scale(0.8)');
    handle.dispose();
  });

  it('replacement settles former promise and starts a single new timeline', async () => {
    const f = fixture();
    const handle = createScenePresentation(f.root, f.host);
    const entering = handle.enter(f.context);
    const exiting = handle.exit(f.context);
    await entering;
    expect(timelines).toHaveLength(2);
    expect(timelines[0].kill).toHaveBeenCalledTimes(1);
    timelines[0].lateComplete();
    expect(f.units[0].style.transform).toBe('translateY(0px) scale(1)');
    timelines[1].complete();
    await exiting;
    handle.dispose();
  });

  it('restarts exit from explicit identity after an interrupted exit and direct rollback', async () => {
    const f = fixture();
    const handle = createScenePresentation(f.root, f.host);
    const first = handle.exit(f.context);
    f.units[0].style.transform = 'translateY(12px) scale(0.4)';
    handle.cancelMotion();
    await first;
    expect(f.units[0].style.transform).toBe('');
    const second = handle.exit(f.context);
    expect(timelines[1].fromTo.mock.calls[0][1]).toEqual({ scale: 1, x: 0, y: 0, opacity: 1 });
    expect(f.units[0].style.transform).toBe('translateY(0px) scale(1)');
    timelines[0].lateComplete();
    timelines[1].complete();
    await second;
    handle.dispose();
  });

  it.each([false, true])('fresh DOM lease retires old effects and guards stale handles (disposed=%s)', async disposed => {
    const f = fixture();
    const art = f.root.querySelector('img');
    const first = createScenePresentation(f.root, f.host);
    first.setVisible(true);
    const oldEnter = first.enter(f.context);
    if (disposed) first.dispose();
    const fresh = createScenePresentation(f.root, f.host);
    await oldEnter;
    expect(timelines[0].kill).toHaveBeenCalledTimes(1);
    fresh.setVisible(true);
    const entered = fresh.enter(f.context);
    const pose = f.units[0].style.cssText;
    first.cancelMotion(); first.setVisible(false); first.setInputEnabled(true);
    await first.enter(f.context); await first.exit(f.context); first.dispose();
    timelines[0].lateComplete();
    expect(f.units[0].style.cssText).toBe(pose);
    expect(f.root.parentElement).toBe(f.host);
    expect(f.root.hidden).toBe(false);
    expect(f.root.inert).toBe(true);
    expect(f.root.querySelector('img')).toBe(art);
    timelines[1].complete(); await entered; fresh.dispose();
  });

  it.each(['stale', 'aborted'])('skips already %s context', async state => {
    const f = fixture(); const handle = createScenePresentation(f.root, f.host);
    if (state === 'aborted') f.controller.abort();
    const context = { signal: f.controller.signal, isCurrent: () => state !== 'stale' };
    await handle.enter(context); await handle.exit(context);
    expect(timelines).toHaveLength(0); handle.dispose();
  });

  it('excludes hidden panels and performs cleanup without style/geometry parsing', async () => {
    const f = fixture();
    const panel = document.createElement('section'); panel.hidden = true;
    panel.innerHTML = '<div data-jimi-unit></div>'; f.root.append(panel);
    const geometry = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    const computed = jest.spyOn(window, 'getComputedStyle');
    const handle = createScenePresentation(f.root, f.host);
    const entered = handle.enter(f.context);
    expect(timelines[0].fromTo.mock.calls[0][0]).toEqual(f.units);
    handle.setVisible(false); handle.cancelMotion(); await entered;
    expect(geometry).not.toHaveBeenCalled(); expect(computed).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('rejects partial timeline setup and restores pose for director rollback', async () => {
    const f = fixture(); const handle = createScenePresentation(f.root, f.host);
    const implementation = (gsap.timeline as jest.Mock).getMockImplementation()!;
    (gsap.timeline as jest.Mock).mockImplementation(options => {
      const timeline = implementation(options);
      timeline.fromTo.mockImplementation(() => { throw new Error('motion failed'); });
      return timeline;
    });
    await expect(handle.enter(f.context)).rejects.toThrow('motion failed');
    expect(timelines[0].kill).toHaveBeenCalledTimes(1);
    f.units.forEach(unit => expect(unit.style.transform).toBe('')); handle.dispose();
  });

  it('settles no-target scenes without timeline or abort hooks', async () => {
    const f = fixture(); f.root.replaceChildren();
    const add = jest.spyOn(f.controller.signal, 'addEventListener');
    const handle = createScenePresentation(f.root, f.host);
    await handle.enter(f.context); await handle.exit(f.context);
    expect(timelines).toHaveLength(0); expect(add).not.toHaveBeenCalled(); handle.dispose();
  });

  it('director same-route requests cannot create duplicate cached-root leases', async () => {
    const f = fixture(); const prepare = jest.fn(() => createScenePresentation(f.root, f.host));
    const director = createSceneDirector({ prepare });
    const first = director.navigate('home'); expect(director.navigate('home')).toBe(first);
    await flush(); expect(prepare).toHaveBeenCalledTimes(1);
    timelines[0].complete(); await first;
    await expect(director.navigate('home')).resolves.toMatchObject({ status: 'shown' });
    expect(prepare).toHaveBeenCalledTimes(1); expect(f.root.inert).toBe(false); director.dispose();
  });
});
