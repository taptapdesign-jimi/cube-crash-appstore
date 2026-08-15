export interface BoardTransitionExitScheduleEntry {
  key: string;
  start: number;
  end: number;
  orderIndex: number;
}

export interface BoardTransitionExitSchedule {
  entries: BoardTransitionExitScheduleEntry[];
  endsAt: number;
}

export function buildBoardTransitionExitSchedule(options: {
  layerKeys: readonly string[];
  baseStart: number;
  stagger: number;
  duration: number;
  dependencies?: Readonly<Record<string, string>>;
  startOffsets?: Readonly<Partial<Record<string, number>>>;
}): BoardTransitionExitSchedule {
  const { layerKeys, baseStart, stagger, duration, dependencies = {}, startOffsets = {} } = options;
  const indexByKey = new Map<string, number>();
  layerKeys.forEach((key, index) => {
    if (indexByKey.has(key)) throw new Error(`Duplicate Board Transition exit layer: ${key}`);
    indexByKey.set(key, index);
  });

  Object.entries(dependencies).forEach(([key, prerequisite]) => {
    if (!indexByKey.has(key)) throw new Error(`Missing Board Transition exit layer: ${key}`);
    if (!indexByKey.has(prerequisite)) throw new Error(`Missing Board Transition exit prerequisite: ${prerequisite}`);
  });

  const pending = new Set(layerKeys);
  const scheduledByKey = new Map<string, BoardTransitionExitScheduleEntry>();
  while (pending.size > 0) {
    let scheduledThisPass = 0;
    layerKeys.forEach((key) => {
      if (!pending.has(key)) return;
      const prerequisite = dependencies[key];
      if (prerequisite && !scheduledByKey.has(prerequisite)) return;
      const orderIndex = indexByKey.get(key) ?? 0;
      const naturalStart = baseStart + orderIndex * stagger + (startOffsets[key] ?? 0);
      const prerequisiteEnd = prerequisite ? scheduledByKey.get(prerequisite)?.end ?? 0 : 0;
      const start = Math.max(naturalStart, prerequisiteEnd);
      scheduledByKey.set(key, { key, start, end: start + duration, orderIndex });
      pending.delete(key);
      scheduledThisPass += 1;
    });
    if (scheduledThisPass === 0) throw new Error('Cyclic Board Transition exit dependencies');
  }

  const entries = layerKeys.map((key) => scheduledByKey.get(key) as BoardTransitionExitScheduleEntry);
  return {
    entries,
    endsAt: entries.reduce((latest, entry) => Math.max(latest, entry.end), 0),
  };
}
