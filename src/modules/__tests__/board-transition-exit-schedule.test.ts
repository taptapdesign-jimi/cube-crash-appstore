import { buildBoardTransitionExitSchedule } from '../board-transition-exit-schedule';

describe('Board Transition exit schedule', () => {
  const dependencies = {
    'beach-sea-3': 'beach-ball',
    'beach-shore-2': 'beach-castle',
  } as const;

  test('schedules every visible Beach layer once and completes prerequisites first', () => {
    const schedule = buildBoardTransitionExitSchedule({
      layerKeys: [
        'beach-sea-1', 'beach-bottle', 'beach-sea-2', 'beach-ball',
        'beach-sea-3', 'beach-shore-1', 'beach-castle', 'beach-shore-2',
      ],
      baseStart: 0.7,
      stagger: 0.05,
      duration: 0.28,
      dependencies,
    });
    const byKey = new Map(schedule.entries.map((entry) => [entry.key, entry]));
    expect(new Set(schedule.entries.map((entry) => entry.key)).size).toBe(8);
    expect(byKey.get('beach-sea-3')?.start).toBeGreaterThanOrEqual(byKey.get('beach-ball')?.end ?? Infinity);
    expect(byKey.get('beach-shore-2')?.start).toBeGreaterThanOrEqual(byKey.get('beach-castle')?.end ?? Infinity);
    expect(schedule.endsAt).toBe(Math.max(...schedule.entries.map((entry) => entry.end)));
  });

  test('keeps dependencies valid when DOM input order changes', () => {
    const schedule = buildBoardTransitionExitSchedule({
      layerKeys: ['beach-sea-3', 'beach-shore-2', 'beach-castle', 'beach-ball'],
      baseStart: 0,
      stagger: 0.05,
      duration: 0.28,
      dependencies,
    });
    const byKey = new Map(schedule.entries.map((entry) => [entry.key, entry]));
    expect(byKey.get('beach-sea-3')?.start).toBe(byKey.get('beach-ball')?.end);
    expect(byKey.get('beach-shore-2')?.start).toBe(byKey.get('beach-castle')?.end);
  });

  test('applies Beach element offsets while keeping dependent exits ordered', () => {
    const baseline = buildBoardTransitionExitSchedule({
      layerKeys: ['beach-bottle', 'beach-ball', 'beach-sea-3'],
      baseStart: 0.7,
      stagger: 0.05,
      duration: 0.28,
      dependencies: { 'beach-sea-3': 'beach-ball' },
    });
    const adjusted = buildBoardTransitionExitSchedule({
      layerKeys: ['beach-bottle', 'beach-ball', 'beach-sea-3'],
      baseStart: 0.7,
      stagger: 0.05,
      duration: 0.28,
      dependencies: { 'beach-sea-3': 'beach-ball' },
      startOffsets: { 'beach-bottle': -0.2, 'beach-ball': 0.1 },
    });
    const baselineByKey = new Map(baseline.entries.map((entry) => [entry.key, entry]));
    const adjustedByKey = new Map(adjusted.entries.map((entry) => [entry.key, entry]));
    expect(adjustedByKey.get('beach-bottle')!.start).toBeCloseTo(baselineByKey.get('beach-bottle')!.start - 0.2);
    expect(adjustedByKey.get('beach-ball')!.start).toBeCloseTo(baselineByKey.get('beach-ball')!.start + 0.1);
    expect(adjustedByKey.get('beach-sea-3')!.start).toBeGreaterThanOrEqual(adjustedByKey.get('beach-ball')!.end);
  });

  test('rejects missing prerequisites and dependency cycles', () => {
    expect(() => buildBoardTransitionExitSchedule({
      layerKeys: ['beach-sea-3'],
      baseStart: 0,
      stagger: 0.05,
      duration: 0.28,
      dependencies,
    })).toThrow('Missing Board Transition exit prerequisite');
    expect(() => buildBoardTransitionExitSchedule({
      layerKeys: ['a', 'b'],
      baseStart: 0,
      stagger: 0.05,
      duration: 0.28,
      dependencies: { a: 'b', b: 'a' },
    })).toThrow('Cyclic Board Transition exit dependencies');
  });
});
