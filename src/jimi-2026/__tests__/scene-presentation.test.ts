import { gsap } from 'gsap';
import { createScenePresentation } from '../scene-presentation';
import { createSceneDirector, type SceneTransitionContext } from '../scene-director';
import { getJourneyV700MotionProfile } from '../../modules/journey-v700-motion';

jest.mock('gsap', () => ({ gsap: { timeline: jest.fn(), set: jest.fn() } }));
type Pose = { scale?: number; x?: number; y?: number; opacity?: number };
type MockTimeline = { fromTo: jest.Mock; to: jest.Mock; kill: jest.Mock; complete: () => void; lateComplete: () => void; update: () => void };
const timelines: MockTimeline[] = [];
function applyPose(targets: Pose[], pose: Pose) {
  targets.forEach(target => {
    for (const key of ['scale', 'x', 'y', 'opacity'] as const) {
      if (pose[key] !== undefined) target[key] = pose[key];
    }
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
  (gsap.timeline as jest.Mock).mockImplementation((options: { onComplete: () => void; onUpdate: () => void }) => {
    const steps: Array<{ targets: Pose[]; pose: Pose }> = [];
    const timeline: MockTimeline = {
      fromTo: jest.fn(), to: jest.fn(), kill: jest.fn(), lateComplete: options.onComplete, update: options.onUpdate,
      complete: () => { steps.forEach(step => applyPose(step.targets, step.pose)); options.onUpdate(); options.onComplete(); },
    };
    timeline.fromTo.mockImplementation((targets: Pose[], from: Pose, to: Pose) => {
      applyPose(targets, from); steps.push({ targets, pose: to }); options.onUpdate(); return timeline;
    });
    timeline.to.mockImplementation((targets: Pose[], pose: Pose) => { steps.push({ targets, pose }); return timeline; });
    timelines.push(timeline);
    return timeline;
  });
});
afterEach(() => { expect(gsap.set).not.toHaveBeenCalled(); document.body.replaceChildren(); jest.restoreAllMocks(); });

describe('Jimi finite numeric GSAP poses with owned style writes', () => {
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
    const poses = timelines[0].fromTo.mock.calls[0][0];
    expect(poses).toHaveLength(f.units.length);
    expect(poses.every((pose: object) => !(pose instanceof HTMLElement))).toBe(true);
    expect(timelines[0].fromTo).toHaveBeenCalledWith(poses,
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
    const poses = timelines[0].fromTo.mock.calls[0][0];
    expect(timelines[0].fromTo).toHaveBeenCalledWith(poses,
      { scale: 1, x: 0, y: 0, opacity: 1 },
      { scale: profile.exit.anticipationScale, duration: profile.exit.anticipationDuration, ease: 'power2.in' });
    expect(timelines[0].to).toHaveBeenCalledWith(poses,
      { scale: 0, duration: profile.exit.duration, ease: profile.exit.ease, stagger: { amount: profile.cascadeWindow } });
    timelines[0].complete();
    await exited;
    expect(f.root.hidden).toBe(false);
    f.units.forEach(unit => expect(unit.style.transform).toBe('translate3d(0px, 0px, 0px) scale(0)'));
    handle.cancelMotion();
    f.units.forEach(unit => expect(unit.style.transform).toBe(''));
    handle.dispose();
  });

  it('tweens only numeric proxies and writes changed poses without reading or altering DOM transform caches', async () => {
    const f = fixture();
    const cssCache = { scaleX: 0.17, y: 81 };
    (f.units[0] as any)._gsap = cssCache;
    const computed = jest.spyOn(window, 'getComputedStyle').mockImplementation(() => { throw new Error('computed style forbidden'); });
    const geometry = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => { throw new Error('geometry forbidden'); });
    const transformWrites = f.units.map(unit => jest.spyOn(unit.style, 'transform', 'set'));
    const opacityWrites = f.units.map(unit => jest.spyOn(unit.style, 'opacity', 'set'));
    const handle = createScenePresentation(f.root, f.host);
    const entered = handle.enter(f.context);
    const poses: Pose[] = timelines[0].fromTo.mock.calls[0][0];
    for (const pose of poses) {
      expect(Object.keys(pose).sort()).toEqual(['opacity', 'scale', 'x', 'y']);
      expect(Object.values(pose).every(value => typeof value === 'number')).toBe(true);
    }
    transformWrites.forEach(write => expect(write).toHaveBeenCalledTimes(1));
    opacityWrites.forEach(write => expect(write).toHaveBeenCalledTimes(1));
    Object.assign(poses[0], { scale: 1.125, x: 0, y: 12.5, opacity: 1.25 });
    timelines[0].update();
    expect(f.units[0].style.transform).toBe('translate3d(0px, 12.5px, 0px) scale(1.125)');
    expect(f.units[0].style.opacity).toBe('1');
    expect(transformWrites[0]).toHaveBeenCalledTimes(2);
    expect(opacityWrites[0]).toHaveBeenCalledTimes(2);
    expect(transformWrites[1]).toHaveBeenCalledTimes(1);
    expect(opacityWrites[1]).toHaveBeenCalledTimes(1);
    timelines[0].update();
    expect(transformWrites[0]).toHaveBeenCalledTimes(2);
    expect(opacityWrites[0]).toHaveBeenCalledTimes(2);
    expect((f.units[0] as any)._gsap).toBe(cssCache);
    expect(cssCache).toEqual({ scaleX: 0.17, y: 81 });
    expect(computed).not.toHaveBeenCalled();
    expect(geometry).not.toHaveBeenCalled();
    timelines[0].complete();
    await entered;
    poses[0].scale = 0.3;
    timelines[0].update();
    timelines[0].lateComplete();
    expect(f.units[0].style.transform).toBe('');
    expect(f.units[0].style.opacity).toBe('');
    expect(f.root.querySelector<HTMLElement>('.rotor')!.style.transform).toBe('rotateY(180deg)');
    handle.dispose();
  });

  it('runs real GSAP numeric interpolation with the canonical timing/ease and no CSS hydration', async () => {
    const real = jest.requireActual('gsap').gsap as typeof gsap;
    const actualTimelines: gsap.core.Timeline[] = [];
    (gsap.timeline as jest.Mock).mockImplementation(options => {
      const timeline = real.timeline({ ...options, paused: true });
      actualTimelines.push(timeline);
      return timeline;
    });
    const f = fixture();
    const computed = jest.spyOn(window, 'getComputedStyle').mockImplementation(() => { throw new Error('computed style forbidden'); });
    const geometry = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => { throw new Error('geometry forbidden'); });
    const handle = createScenePresentation(f.root, f.host);
    const profile = getJourneyV700MotionProfile(false);
    try {
      const entered = handle.enter(f.context);
      const entry = actualTimelines[0];
      expect(entry.duration()).toBeCloseTo(profile.enter.duration + profile.cascadeWindow);
      entry.time(profile.enter.duration / 2, false);
      const tween = entry.getChildren(false, true, false)[0] as gsap.core.Tween;
      const poses = tween.targets() as Pose[];
      const progress = real.parseEase(profile.enter.ease)(0.5);
      expect(poses[0].scale).toBeCloseTo(profile.enter.scale + (1 - profile.enter.scale) * progress, 5);
      expect(poses[0].y).toBeCloseTo(profile.enter.y * (1 - progress), 5);
      expect(poses.every(pose => !(pose instanceof HTMLElement))).toBe(true);
      expect(f.units.every(unit => !(unit as any)._gsap)).toBe(true);
      entry.progress(1, false);
      await entered;
      f.units.forEach(unit => expect(unit.style.transform).toBe(''));
      const exited = handle.exit(f.context);
      const exit = actualTimelines[1];
      expect(exit.duration()).toBeCloseTo(profile.exit.anticipationDuration + profile.exit.duration + profile.cascadeWindow);
      exit.time(profile.exit.anticipationDuration, false);
      f.units.forEach(unit => expect(unit.style.transform).toContain(`scale(${profile.exit.anticipationScale})`));
      exit.progress(1, false);
      await exited;
      f.units.forEach(unit => expect(unit.style.transform).toBe('translate3d(0px, 0px, 0px) scale(0)'));
      expect(computed).not.toHaveBeenCalled();
      expect(geometry).not.toHaveBeenCalled();
    } finally {
      handle.dispose();
      actualTimelines.forEach(timeline => timeline.kill());
      real.ticker.sleep();
    }
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
    timelines[0].update();
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
    expect(f.units[0].style.transform).toBe('translate3d(0px, 0px, 0px) scale(1)');
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
    expect(f.units[0].style.transform).toBe('translate3d(0px, 0px, 0px) scale(1)');
    timelines[0].lateComplete();
    timelines[0].update();
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
    timelines[0].update();
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
    const poses = timelines[0].fromTo.mock.calls[0][0];
    expect(poses).toHaveLength(f.units.length);
    expect(poses.every((pose: object) => !(pose instanceof HTMLElement))).toBe(true);
    handle.setVisible(false); handle.cancelMotion(); await entered;
    expect(geometry).not.toHaveBeenCalled(); expect(computed).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('samples admission once per enter/exit, always includes the header and leaves other Units static', async () => {
    const f = fixture();
    f.units[0].dataset.jimiUnit = 'header';
    f.units[1].dataset.jimiUnit = 'board-11';
    const offscreen = document.createElement('div');
    offscreen.dataset.jimiUnit = 'board-12';
    offscreen.innerHTML = '<img src="preserved.png" style="transform:rotate(7deg)">';
    f.root.append(offscreen);
    const originalArt = offscreen.innerHTML;
    const admit = jest.fn()
      .mockReturnValueOnce(new Set(['board-11']))
      .mockReturnValueOnce(new Set(['board-12']));
    const handle = createScenePresentation(f.root, f.host, { getAdmittedUnitIds: admit });
    handle.setVisible(true);
    const entered = handle.enter(f.context);
    expect(admit.mock.calls).toEqual([['enter']]);
    expect(timelines[0].fromTo.mock.calls[0][0]).toHaveLength(2);
    expect(f.units[0].style.opacity).toBe('0'); // Header survives omission from the returned set.
    expect(f.units[1].style.opacity).toBe('0');
    expect(offscreen.style.transform).toBe('');
    expect(offscreen.style.opacity).toBe('');
    expect(offscreen.hidden).toBe(false);
    expect(offscreen.parentElement).toBe(f.root);
    timelines[0].update(); timelines[0].update();
    expect(admit).toHaveBeenCalledTimes(1);
    timelines[0].complete(); await entered;
    const exited = handle.exit(f.context);
    expect(admit.mock.calls).toEqual([['enter'], ['exit']]);
    expect(timelines[1].fromTo.mock.calls[0][0]).toHaveLength(2);
    expect(f.units[1].style.transform).toBe('');
    expect(f.units[1].style.opacity).toBe('');
    expect(offscreen.style.transform).toBe('translate3d(0px, 0px, 0px) scale(1)');
    timelines[1].complete(); await exited;
    expect(f.units[0].style.transform).toBe('translate3d(0px, 0px, 0px) scale(0)');
    expect(offscreen.style.transform).toBe('translate3d(0px, 0px, 0px) scale(0)');
    expect(f.units[1].style.transform).toBe('');
    expect(f.units[1].hidden).toBe(false);
    expect(offscreen.innerHTML).toBe(originalArt);
    expect(admit).toHaveBeenCalledTimes(2);
    handle.dispose();
  });

  it.each(['abort', 'dispose'])('cleans every Unit, including nonadmitted residue, on %s without mutating nested art', async action => {
    const f = fixture();
    f.units[0].dataset.jimiUnit = 'header';
    f.units[1].dataset.jimiUnit = 'board-11';
    const handle = createScenePresentation(f.root, f.host, { getAdmittedUnitIds: () => new Set() });
    handle.setVisible(true);
    f.units[1].style.transform = 'scale(0)';
    f.units[1].style.opacity = '0';
    const entered = handle.enter(f.context);
    expect(timelines[0].fromTo.mock.calls[0][0]).toHaveLength(1);
    expect(f.units[1].style.transform).toBe('');
    expect(f.units[1].style.opacity).toBe('');
    f.units[1].style.transform = 'scale(0.4)';
    f.units[1].style.visibility = 'hidden';
    if (action === 'abort') f.controller.abort();
    else handle.dispose();
    await entered;
    for (const unit of f.units) {
      expect(unit.style.transform).toBe('');
      expect(unit.style.opacity).toBe('');
      expect(unit.style.visibility).toBe('');
    }
    expect(f.root.querySelector<HTMLElement>('.rotor')!.style.transform).toBe('rotateY(180deg)');
    timelines[0].update();
    expect(f.units[1].style.transform).toBe('');
    handle.dispose();
  });

  it('does not consult admission for stale or already aborted contexts', async () => {
    const f = fixture();
    const admit = jest.fn(() => new Set<string>());
    const handle = createScenePresentation(f.root, f.host, { getAdmittedUnitIds: admit });
    await handle.enter({ signal: f.controller.signal, isCurrent: () => false });
    f.controller.abort();
    await handle.exit(f.context);
    expect(admit).not.toHaveBeenCalled();
    expect(timelines).toHaveLength(0);
    handle.dispose();
  });

  it('lets the actual director roll back an admission failure without stranding the current route', async () => {
    const f = fixture();
    const incoming = document.createElement('section');
    incoming.innerHTML = '<div data-jimi-unit="header">Hub</div>';
    const failure = new Error('viewport unavailable');
    const director = createSceneDirector({
      prepare: (id: string) => createScenePresentation(id === 'home' ? f.root : incoming, f.host,
        id === 'home' ? {} : { getAdmittedUnitIds: () => { throw failure; } }),
    });
    const initial = director.navigate('home');
    await flush(); timelines[0].complete(); await initial;
    const next = director.navigate('hub');
    await flush(); timelines[1].complete();
    await expect(next).resolves.toMatchObject({ status: 'failed', error: failure });
    expect(director.getState().currentId).toBe('home');
    expect(f.root.parentElement).toBe(f.host);
    expect(f.root.hidden).toBe(false);
    expect(f.root.inert).toBe(false);
    f.units.forEach(unit => expect(unit.style.transform).toBe(''));
    expect(incoming.isConnected).toBe(false);
    director.dispose();
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

  it('retires its timeline and rejects a direct-style update failure so the director can roll back', async () => {
    const f = fixture();
    const handle = createScenePresentation(f.root, f.host);
    const entered = handle.enter(f.context);
    const poses: Pose[] = timelines[0].fromTo.mock.calls[0][0];
    poses[0].scale = 0.9;
    const write = jest.spyOn(f.units[0].style, 'transform', 'set').mockImplementationOnce(() => { throw new Error('style failed'); });
    timelines[0].update();
    await expect(entered).rejects.toThrow('style failed');
    expect(timelines[0].kill).toHaveBeenCalledTimes(1);
    f.units.forEach(unit => expect(unit.style.transform).toBe(''));
    write.mockRestore();
    timelines[0].update();
    expect(f.units[0].style.transform).toBe('');
    handle.dispose();
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
