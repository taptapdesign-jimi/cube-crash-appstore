import fs from 'node:fs';
import ts from 'typescript';
import { gsap } from 'gsap';
import '../../utils/gsap-safe';
import { createBoardPopInPlan, createBoardPopInHapticSchedule, createBoardPopInMeshOffsets } from '../board-popin-scheduler';
import { schedulePopInSafetyNet } from '../app-core-popin-safety';

// Install the production prototype guard too: omitting this boot-time patch
// previously let bare-GSAP tests pass while the app discarded every offset.
const dragSource = ts.createSourceFile('drag-core.ts', fs.readFileSync('src/modules/drag-core.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const guardNode = dragSource.statements.find(n => ts.isExpressionStatement(n) && n.getText(dragSource).startsWith('(function __dg_installTlGuards'))!;
const guardCode = ts.transpileModule(guardNode.getText(dragSource), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('gsap', guardCode)(gsap);

// Execute the actual board owner with real GSAP interpolation, substituting only
// its Pixi/application boundaries so no WebGL or gameplay state is required.
const source = ts.createSourceFile('app-board.ts', fs.readFileSync('src/modules/app-board.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'sweetPopIn')!;
const compiled = ts.transpileModule(node.getText(source).replace('export function', 'function'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture() {
  const timelines: gsap.core.Timeline[] = [];
  const delayed: Array<{ delay: number; run: () => void; kill: jest.Mock }> = [];
  const markers: string[] = [];
  const stopSound = jest.fn();
  const playSound = jest.fn(() => stopSound);
  const releaseFrames = jest.fn();
  const acquireFrames = jest.fn(() => releaseFrames);
  const settle = (t: any) => { t.scale.set(1); t.alpha = 1; };
  const scope = {
    gsap, createBoardPopInPlan, createBoardPopInHapticSchedule, createBoardPopInMeshOffsets, TILE: 96,
    acquirePixiMobileActivityLease: acquireFrames,
    playBoardPopInSound: playSound,
    markBoardLifecycle: (s: string) => markers.push(s),
    startBoardLifecycleFrameWindow: () => () => {}, startBoardEntryPoseDiagnostic: () => () => {},
    STATE: { board: {} }, makeBoard: { syncTileZIndex() {} }, drawBoardBG() {},
    settleBoardPopInTile: settle, triggerBoardPopInHaptic() {},
    trackTimeline: (opts: any) => { const tl = gsap.timeline({ ...opts, paused: true }); timelines.push(tl); return tl; },
    trackDelayedCall: (delay: number, run: () => void) => { const call = { delay, run, kill: jest.fn() }; delayed.push(call); return call; },
  };
  const run = new Function(...Object.keys(scope), `${compiled}; return sweetPopIn;`)(...Object.values(scope));
  const tiles = Array.from({ length: 45 }, (_, i) => ({
    x: i % 5, y: Math.floor(i / 5), value: 2, locked: false, visible: false, alpha: 0,
    scale: { x: 1, y: 1, set(n: number) { this.x = this.y = n; } },
  }));
  return { run, tiles, timelines, delayed, markers, acquireFrames, releaseFrames, playSound, stopSound };
}

describe('real board entrance timeline', () => {
  beforeEach(() => { jest.useFakeTimers(); (window as any).__ccEnterAnimationActive = true; });
  afterEach(() => { gsap.globalTimeline.clear(); gsap.ticker.sleep(); delete (window as any).__ccEnterAnimationActive; jest.useRealTimers(); });

  test('production guards preserve numeric, relative and label positions for to/fromTo/set', () => {
    const a = { x: 0 }, b = { x: 0 }, c = { x: 0 };
    const tl = gsap.timeline({ paused: true });
    tl.to(a, { x: 1, duration: 0.4 }, 0)
      .to(b, { x: 1, duration: 0.4 }, 0)
      .fromTo(c, { x: 0 }, { x: 1, duration: 0.2 }, '<')
      .addLabel('land', 0.3)
      .set(c, { x: 2 }, 'land')
      .to(a, { x: 2, duration: 0.1 }, 'land+=0.1');
    expect(tl.getChildren(false, true, false).map(t => t.startTime())).toEqual([0, 0, 0, 0.3, 0.4]);
    expect(tl.duration()).toBeCloseTo(0.5);
    tl.time(0.1);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.x).toBeGreaterThan(0);
    tl.time(0.31);
    expect(c.x).toBe(2);
    const count = tl.getChildren().length;
    tl.to(null, { x: 1 }, 0).fromTo({ destroyed: true }, {}, { x: 1 }, 0).set(null, {}, 0);
    expect(tl.getChildren()).toHaveLength(count);
  });

  test('the existing spawnBounce keeps alpha and scale concurrent under production guards', () => {
    const spawnSource = ts.createSourceFile('spawn-helpers.ts', fs.readFileSync('src/modules/spawn-helpers.ts', 'utf8'), ts.ScriptTarget.Latest, true);
    const spawnNode = spawnSource.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'spawnBounce')!;
    const code = ts.transpileModule(spawnNode.getText(spawnSource).replace('export function', 'function'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const timelines: gsap.core.Timeline[] = [];
    const trackTimeline = (opts: any = {}) => {
      const tl = gsap.timeline({ ...opts, paused: true }); timelines.push(tl); return tl;
    };
    const spawn = new Function('trackTimeline', `${code}; return spawnBounce;`)(trackTimeline);
    const tile = { locked: true, alpha: 0, scale: { x: 0, y: 0, set(n: number) { this.x = this.y = n; } }, rotG: { rotation: 0 } };
    const done = jest.fn();
    spawn(tile, gsap, { keepFullOpacity: false }, done);
    expect(timelines[0].duration()).toBeCloseTo(0.56);
    timelines[0].time(0.05, false);
    expect(tile.alpha).toBeGreaterThan(0);
    expect(tile.scale.x).toBeGreaterThan(0.3);
    expect(done).not.toHaveBeenCalled();
    timelines[0].progress(1, false);
    expect(done).toHaveBeenCalledTimes(1);
    expect(tile.scale.x).toBe(1);
  });

  test('starts as an expanded mesh and travels while bouncing without moving the board', async () => {
    const f = fixture();
    const controller = new AbortController();
    const done = f.run(f.tiles, { signal: controller.signal });
    expect(f.tiles[0].x).toBeLessThan(0);
    expect(f.tiles[0].y).toBeLessThan(0);
    expect(f.tiles[44].x).toBeGreaterThan(4);
    expect(f.tiles[44].y).toBeGreaterThan(8);
    const start = f.tiles.map(t => ({ x: t.x, y: t.y }));
    f.timelines[0].time(0.2, false);
    expect(f.tiles.some((t, i) => t.x !== start[i].x && t.scale.x > 0)).toBe(true);
    controller.abort();
    await done;
    expect(f.tiles.every((t, i) => t.x === i % 5 && t.y === Math.floor(i / 5))).toBe(true);
  });

  test('overlaps individual pops, includes compression and rebound, and completes without watchdog', async () => {
    const f = fixture();
    const done = f.run(f.tiles);
    expect(f.acquireFrames).toHaveBeenCalledWith('board-popin', 100);
    expect(f.releaseFrames).not.toHaveBeenCalled();
    const tl = f.timelines[0];
    expect(f.timelines).toHaveLength(1);
    expect(tl.duration()).toBeCloseTo(0.94, 5);
    tl.time(0.1, false);
    expect(f.tiles.filter(t => t.alpha > 0).length).toBeGreaterThan(3);
    expect(f.tiles.some(t => t.scale.x === 0)).toBe(true);
    const first = f.tiles.reduce((a, b) => a.scale.x > b.scale.x ? a : b);
    tl.time(0.20, false);
    expect(first.scale.x).toBeCloseTo(1.08, 3);
    tl.time(0.32, false);
    expect(first.scale.x).toBeCloseTo(0.96, 3);
    tl.time(0.44, false);
    expect(first.scale.x).toBeCloseTo(1.02, 3);
    tl.time(0.50, false);
    expect(f.releaseFrames).not.toHaveBeenCalled();
    expect(f.tiles.every(t => t.alpha === 1 && t.scale.x > 0)).toBe(true);
    tl.progress(1, false);
    f.delayed.find(call => call.delay === 0.03)!.run();
    await done;
    jest.advanceTimersByTime(3000);
    expect(f.markers).toEqual(['popin-start', 'popin-complete']);
    expect(f.playSound).toHaveBeenCalledWith(expect.closeTo(0.97, 5));
    expect(f.stopSound).toHaveBeenCalledTimes(1);
    expect(f.tiles.every(t => t.scale.x === 1 && t.scale.y === 1)).toBe(true);
    expect(f.tiles.every((t, i) => t.x === i % 5 && t.y === Math.floor(i / 5))).toBe(true);
    expect(f.releaseFrames).toHaveBeenCalledTimes(1);
  });

  test('aborting mid-bounce settles every tile and cancels all pending work', async () => {
    const f = fixture();
    const controller = new AbortController();
    const done = f.run(f.tiles, { signal: controller.signal });
    f.timelines[0].time(0.12, false);
    controller.abort();
    await done;
    jest.advanceTimersByTime(3000);
    expect(f.markers).toEqual(['popin-start', 'popin-aborted']);
    expect(f.stopSound).toHaveBeenCalledTimes(1);
    expect(f.tiles.every(t => t.scale.x === 1)).toBe(true);
    expect(f.timelines[0].parent).toBeNull();
    expect(f.tiles.every((t, i) => t.x === i % 5 && t.y === Math.floor(i / 5))).toBe(true);
    expect(f.releaseFrames).toHaveBeenCalledTimes(1);
  });

  test('the animation owner still recovers a stalled timeline exactly once', async () => {
    const f = fixture();
    const done = f.run(f.tiles);
    jest.advanceTimersByTime(2500);
    await done;
    expect(f.markers).toEqual(['popin-start', 'popin-forced-complete']);
    expect(f.stopSound).toHaveBeenCalledTimes(1);
    expect(f.tiles.every(t => t.scale.x === 1 && t.alpha === 1)).toBe(true);
    expect(f.timelines[0].parent).toBeNull();
    expect(f.tiles.every((t, i) => t.x === i % 5 && t.y === Math.floor(i / 5))).toBe(true);
    expect(f.releaseFrames).toHaveBeenCalledTimes(1);
  });

  test.each(['empty', 'already-aborted'])('releases rendering ownership on %s entry', async mode => {
    const f = fixture();
    const controller = new AbortController();
    if (mode === 'already-aborted') controller.abort();
    await f.run(mode === 'empty' ? [] : f.tiles, { signal: controller.signal });
    expect(f.acquireFrames).toHaveBeenCalledTimes(1);
    expect(f.releaseFrames).toHaveBeenCalledTimes(1);
    expect(f.timelines).toHaveLength(0);
    jest.advanceTimersByTime(3000);
    expect(f.releaseFrames).toHaveBeenCalledTimes(1);
  });

  test('fallback still repairs invisible tiles after an entry has finished', () => {
    (window as any).__ccEnterAnimationActive = false;
    const tile = { locked: false, value: 2, visible: false, alpha: 0, scale: { x: 0, y: 0 } };
    const resume = jest.fn();
    schedulePopInSafetyNet({ tiles: [tile], isCurrent: () => true,
      gsap: { globalTimeline: { resume } }, updateGhostVisibility: jest.fn(), devWarn: jest.fn(),
      trackAppTimeout: (fn, ms) => setTimeout(fn, ms),
    });
    jest.advanceTimersByTime(800);
    expect(tile).toMatchObject({ visible: true, alpha: 1, scale: { x: 1, y: 1 } });
    expect(resume).toHaveBeenCalledTimes(1);
  });

  test.each([true, false])('800ms visibility fallback cannot flatten a live entry or a retired board (current=%s)', current => {
    const tile = { locked: false, value: 2, visible: false, alpha: 0, scale: { x: 0.4, y: 0.4 } };
    const resume = jest.fn();
    schedulePopInSafetyNet({ tiles: [tile], isCurrent: () => current,
      gsap: { globalTimeline: { resume } }, updateGhostVisibility: jest.fn(), devWarn: jest.fn(),
      trackAppTimeout: (fn, ms) => setTimeout(fn, ms),
    });
    if (!current) (window as any).__ccEnterAnimationActive = false;
    jest.advanceTimersByTime(800);
    expect(tile.alpha).toBe(0);
    expect(tile.scale.x).toBe(0.4);
    expect(resume).not.toHaveBeenCalled();
  });
});
