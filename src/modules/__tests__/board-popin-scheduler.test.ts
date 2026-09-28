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

  test('spatially separates successive entries even on a dense board', () => {
    const positions = Array.from({ length: 45 }, (_, i) => ({ x: i % 5, y: Math.floor(i / 5) }));
    const plan = createBoardPopInPlan(45, () => 0.5, { positions });
    for (let i = 1; i < plan.length - 3; i++) {
      const previous = positions[plan[i - 1].tileIndex];
      const next = positions[plan[i].tileIndex];
      expect(Math.abs(previous.x - next.x) + Math.abs(previous.y - next.y)).toBeGreaterThan(1);
    }
    expect(Math.max(...plan.map(step => step.endTime))).toBeLessThanOrEqual(0.941);
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
