import { getJourneyScreenOwnerDiagnostics } from '../journey-screen-owner-diagnostics';

describe('diagnostic-only Journey screen owner snapshot', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as any).gsap;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as any).gsap;
    jest.restoreAllMocks();
  });

  const animation = (options: { css?: boolean; paused?: boolean; finite?: boolean; frozen?: boolean } = {}) => ({
    ...(options.css ? { animationName: 'idle' } : {}),
    playState: options.paused ? 'paused' : 'running',
    playbackRate: options.frozen ? 0 : 1,
    effect: { getTiming: () => ({ iterations: options.finite ? 1 : Infinity }) },
  });

  test('separates running infinite CSS and WAAPI across screen and portaled cards without layout reads', () => {
    document.body.innerHTML = `<section id="journey-screen"><div id="journey-boards-container"
      class="journey-world-runtime-active" data-journey-v700-view="world" data-journey-v700-world-id="1"
      data-journey-world-runtime-state="idle"><div class="journey-world-idle-active"></div></div></section>
      <div id="journey-card-overlay-modal" class="is-settled is-idle-coach"></div>
      <div class="journey-card-return-reminder is-prepainting" hidden></div>`;
    const screen = document.getElementById('journey-screen')!;
    const container = document.getElementById('journey-boards-container')!;
    const overlay = document.getElementById('journey-card-overlay-modal')!;
    const css = animation({ css: true });
    const readScreen = jest.fn(() => [css, animation({ css: true, paused: true }), animation({ finite: true }), animation({ css: true, frozen: true })]);
    const nestedRead = jest.fn();
    Object.assign(screen, { getAnimations: readScreen });
    Object.assign(container, { getAnimations: nestedRead });
    Object.assign(overlay, { getAnimations: () => [css, animation()] });
    const rect = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => { throw new Error('layout'); });
    const computedStyle = jest.spyOn(window, 'getComputedStyle').mockImplementation(() => { throw new Error('style'); });
    Object.defineProperty(container, 'clientWidth', { get: () => { throw new Error('layout'); } });

    const snapshot = getJourneyScreenOwnerDiagnostics();

    expect(snapshot.webAnimations).toEqual({ scopeRoots: 3, availableRoots: 2, examined: 5, runningInfiniteCss: 1, runningInfiniteOther: 1 });
    expect(snapshot.runtime).toEqual({ view: 'world', worldId: '1', state: 'idle', idleAdmittedElements: 1 });
    expect(snapshot.roots.find(root => root.owner === 'journey-card-overlay-modal')?.classes).toBe('is-settled is-idle-coach');
    expect(snapshot.roots.find(root => root.owner === 'journey-card-return-reminder')?.hidden).toBe(true);
    expect(readScreen).toHaveBeenCalledWith({ subtree: true });
    expect(nestedRead).not.toHaveBeenCalled();
    expect(rect).not.toHaveBeenCalled();
    expect(computedStyle).not.toHaveBeenCalled();
  });

  test('counts infinite GSAP timelines with finite children separately from tweens and excludes unrelated owners', () => {
    document.body.innerHTML = '<div id="journey-screen"><span></span></div><div id="unrelated"></div>';
    const target = document.querySelector('#journey-screen span');
    const unrelated = document.getElementById('unrelated');
    const tween = (element: unknown, repeat = -1, paused = false) => ({
      repeat: () => repeat, paused: () => paused, isActive: () => true, targets: () => [element],
    });
    const finiteChild = tween(target, 0);
    const timeline = { repeat: () => -1, paused: () => false, isActive: () => true, getChildren: jest.fn(() => [finiteChild]) };
    const broken = { repeat: () => { throw new Error('retired owner'); } };
    const children = [tween(unrelated), tween(target, -1, true), broken, finiteChild, tween(target), timeline];
    (window as any).gsap = { globalTimeline: { getChildren: () => children } };

    const snapshot = getJourneyScreenOwnerDiagnostics();

    expect(snapshot.gsap).toEqual({ available: true, examined: 6, runningInfiniteTweens: 1, runningInfiniteTimelines: 1 });
    expect(snapshot.readErrors).toBe(1);
    expect(timeline.getChildren).toHaveBeenCalledWith(true, true, false);
  });

  test('reports canvas residency with bounded details, not an invented running count', () => {
    document.body.innerHTML = '<canvas id="pixi"></canvas>' + Array.from({ length: 10 }, () =>
      '<canvas class="journey-forest-bee-canvas" data-journey-ambient-canvas-depth="front" width="20" height="30" style="will-change:auto"></canvas>',
    ).join('');

    const snapshot = getJourneyScreenOwnerDiagnostics();

    expect(snapshot.ambient).toMatchObject({ canvases: 10, bitmapPixels: 6000 });
    expect(snapshot.ambient.details).toHaveLength(8);
    expect(snapshot.ambient.details[0]).toEqual({ classes: 'journey-forest-bee-canvas', depth: 'front', width: 20, height: 30, inlineWillChange: 'auto' });
    expect(snapshot.gsap.available).toBe(false);
    expect(snapshot.webAnimations.availableRoots).toBe(0);
    expect(snapshot.collectionMs).toBeGreaterThanOrEqual(0);
  });

  test('animation API failure leaves independent canvas and runtime evidence available', () => {
    document.body.innerHTML = '<div id="journey-screen"></div>';
    Object.assign(document.getElementById('journey-screen')!, { getAnimations: () => { throw new Error('unavailable'); } });
    (window as any).gsap = { globalTimeline: { getChildren: () => { throw new Error('unavailable'); } } };

    expect(getJourneyScreenOwnerDiagnostics()).toMatchObject({
      rootCount: 1, ambient: { canvases: 0 }, runtime: { state: null }, readErrors: 2,
      webAnimations: { availableRoots: 0 },
    });
  });
});
