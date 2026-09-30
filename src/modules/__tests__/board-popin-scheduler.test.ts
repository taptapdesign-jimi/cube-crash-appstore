import { createBoardPopInHapticSchedule, createBoardPopInPlan, createBoardPopInMeshOffsets } from '../board-popin-scheduler';
import fs from 'node:fs';
import path from 'node:path';

describe('board pop-in scheduler', () => {
  test('bounds the mesh spread and preserves its center without changing layout inputs', () => {
    const positions = [{ x: 0, y: 0 }, { x: 200, y: 400 }, { x: 400, y: 800 }];
    const copy = positions.map(p => ({ ...p }));
    const offsets = createBoardPopInMeshOffsets(positions, 40);
    expect(offsets[1]).toEqual({ x: 0, y: 0 });
    expect(offsets[0].x).toBeLessThan(0);
    expect(offsets[2].y).toBeGreaterThan(0);
    expect(offsets.every(p => Math.hypot(p.x, p.y) <= 40.000001)).toBe(true);
    expect(positions).toEqual(copy);
    expect(createBoardPopInMeshOffsets([], 40)).toEqual([]);
  });

  test('keeps every active and inactive tile in the animation plan exactly once', () => {
    const plan = createBoardPopInPlan(24, () => 0.42);
    const indices = plan.map((step) => step.tileIndex).sort((a, b) => a - b);

    expect(indices).toEqual(Array.from({ length: 24 }, (_, index) => index));
  });

  test('produces deterministic bounce timing when supplied a seeded random source', () => {
    const values = [0.1, 0.7, 0.3, 0.9, 0.2, 0.8, 0.4, 0.6];
    const makeRandom = () => {
      let index = 0;
      return () => values[index++ % values.length];
    };

    expect(createBoardPopInPlan(6, makeRandom())).toEqual(createBoardPopInPlan(6, makeRandom()));
  });

  test('keeps a bounded cartoony amplitude and positive duration ranges', () => {
    const plan = createBoardPopInPlan(32, () => 0.5);

    for (const step of plan) {
      expect(step.amplitude).toBeGreaterThanOrEqual(1.08);
      expect(step.amplitude).toBeLessThanOrEqual(1.08);
      expect(step.growDuration).toBeGreaterThanOrEqual(0.18);
      expect(step.compressDuration).toBeGreaterThanOrEqual(0.1);
      expect(step.settleDuration).toBeGreaterThanOrEqual(0.14);
      expect(step.endTime).toBeGreaterThan(step.enterDelay);
    }
  });

  test('distributes the shuffled entry wave across frames without clustered starts', () => {
    const values = [0.12, 0.83, 0.34, 0.68, 0.27, 0.91, 0.46];
    let index = 0;
    const plan = createBoardPopInPlan(36, () => values[index++ % values.length]);
    const delays = plan.map((step) => step.enterDelay);

    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0);
    const sortedDelays = [...delays].sort((a, b) => a - b);
    expect(sortedDelays[0]).toBeCloseTo(0.02, 6);
    expect(sortedDelays[sortedDelays.length - 1]).toBeLessThanOrEqual(0.38);
    expect(sortedDelays.every((delay, delayIndex) =>
      delayIndex === 0 || delay > sortedDelays[delayIndex - 1] && delay - sortedDelays[delayIndex - 1] <= 0.018001
    )).toBe(true);

    const boardOwner = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-board.ts'), 'utf8');
    expect(boardOwner).toContain('Starting spatial cartoon pop-in');
    expect(boardOwner).toContain('ownerTimelines: activeTimelines.length');
  });

  test('supports four coherent whole-board directions while preserving the same timing envelope', () => {
    const positions = Array.from({ length: 45 }, (_, i) => ({ x: i % 5, y: Math.floor(i / 5) }));
    const distance = (index: number) => Math.hypot(positions[index].x - 2, positions[index].y - 4);
    const inward = createBoardPopInPlan(45, () => 0.25, { positions, preset: 'inward' });
    const outward = createBoardPopInPlan(45, () => 0.25, { positions, preset: 'outward' });
    const diagonal = createBoardPopInPlan(45, () => 0, { positions, preset: 'diagonal' });
    const burst = createBoardPopInPlan(45, () => 0.75, { positions, preset: 'burst' });

    expect(distance(inward[0].tileIndex)).toBeGreaterThan(distance(inward[inward.length - 1].tileIndex));
    expect(distance(outward[0].tileIndex)).toBeLessThan(distance(outward[outward.length - 1].tileIndex));
    expect(distance(burst[0].tileIndex)).toBeLessThan(distance(burst[burst.length - 1].tileIndex));
    expect(diagonal[0].tileIndex).toBe(0);
    for (const plan of [inward, outward, diagonal, burst]) {
      expect(new Set(plan.map(step => step.preset))).toEqual(new Set([plan[0].preset]));
      expect(Math.max(...plan.map(step => step.endTime))).toBeLessThanOrEqual(0.941);
      expect(plan.every(step => Math.hypot(step.startOffsetX, step.startOffsetY) <= 57)).toBe(true);
      expect(plan.every(step => Math.abs(step.startRotation) <= 8 * Math.PI / 180)).toBe(true);
    }
  });

  test('chooses the preset once per board and keeps its generated pose deterministic', () => {
    const positions = Array.from({ length: 12 }, (_, i) => ({ x: i % 4, y: Math.floor(i / 4) }));
    const values = [0.76, 0.2, 0.1, 0.8, 0.4, 0.6];
    const makeRandom = () => { let index = 0; return () => values[index++ % values.length]; };
    const first = createBoardPopInPlan(12, makeRandom(), { positions });
    const second = createBoardPopInPlan(12, makeRandom(), { positions });
    expect(first).toEqual(second);
    expect(first.every(step => step.preset === 'burst')).toBe(true);
  });

  test('fits an explicitly bounded wave without collapsing starts onto one final frame', () => {
    const plan = createBoardPopInPlan(12, () => 0.5, { maxEntryWave: 0.18 });
    const sortedDelays = plan.map((step) => step.enterDelay).sort((a, b) => a - b);

    expect(sortedDelays[sortedDelays.length - 1]).toBeCloseTo(0.18, 6);
    expect(new Set(sortedDelays.map((delay) => delay.toFixed(6))).size).toBe(12);
  });

  test('groups board-entry haptics into six compact ordered beats instead of one per tile', () => {
    const plan = createBoardPopInPlan(36, () => 0.5);
    const schedule = createBoardPopInHapticSchedule(plan);
    const lastTileEntry = Math.max(...plan.map((step) => step.enterDelay));

    expect(schedule).toHaveLength(6);
    expect(schedule).toEqual([...schedule].sort((a, b) => a - b));
    expect(schedule.every((beat, index) => index === 0 || beat - schedule[index - 1] >= 0.05)).toBe(true);
    expect(schedule[schedule.length - 1]).toBeLessThanOrEqual(lastTileEntry);
  });

  test('does not schedule more haptics than visible pop-in tiles', () => {
    const twoTileSchedule = createBoardPopInHapticSchedule(createBoardPopInPlan(2, () => 0.5));
    expect(twoTileSchedule.length).toBeGreaterThanOrEqual(1);
    expect(twoTileSchedule.length).toBeLessThanOrEqual(2);
    expect(createBoardPopInHapticSchedule([])).toEqual([]);
  });

  test('keeps all entry haptics on tile contacts and none on the HUD halfway callback', () => {
    const boardOwner = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-board.ts'), 'utf8');
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const onHalfStart = appCore.indexOf('onHalf: () => {');
    const onHalfOwner = appCore.slice(onHalfStart, appCore.indexOf('beforePopIn:', onHalfStart));

    expect(boardOwner).toContain('triggerBoardPopInHaptic();');
    expect(onHalfOwner).not.toContain('triggerHapticImpact');
    expect(onHalfOwner).not.toContain('triggerBoardPopInHaptic');
  });
});
