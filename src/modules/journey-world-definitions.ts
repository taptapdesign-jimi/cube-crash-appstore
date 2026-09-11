export const JOURNEY_WORLD_SIZE = 10;
export const JOURNEY_HUB_EAGER_WORLD_COUNT = 3;

export type JourneyWorldDefinition = Readonly<{
  id: number;
  hubOrder: number;
  name: string;
  subtitle: string;
  asset: string;
  className: string;
  mainOffsetPx: number;
}>;

const DEFINITIONS: JourneyWorldDefinition[] = [
  {
    id: 1,
    hubOrder: 1,
    name: 'Forest',
    subtitle: 'Stages 01-10',
    asset: './assets/journey assets/forest/forest world/Forest main.png',
    className: 'journey-v700-world-forest',
    mainOffsetPx: 0,
  },
  {
    id: 2,
    hubOrder: 3,
    name: 'Beach',
    subtitle: 'Stages 01-10',
    asset: './assets/journey assets/beach/Beacj world/beach-main.png',
    className: 'journey-v700-world-beach',
    mainOffsetPx: 1454,
  },
  {
    id: 3,
    hubOrder: 2,
    name: 'Area 55',
    subtitle: 'Stages 01-10',
    asset: './assets/journey assets/robo/robo world/robo-main.png',
    className: 'journey-v700-world-robo',
    mainOffsetPx: 3166,
  },
];

export const JOURNEY_WORLD_DEFINITIONS = Object.freeze(
  [...DEFINITIONS].sort((a, b) => a.id - b.id),
);

export const JOURNEY_HUB_WORLD_DEFINITIONS = Object.freeze(
  [...DEFINITIONS].sort((a, b) => a.hubOrder - b.hubOrder),
);

export const JOURNEY_WORLD_COUNT = JOURNEY_WORLD_DEFINITIONS.length;
export const JOURNEY_MAX_BOARDS = JOURNEY_WORLD_COUNT * JOURNEY_WORLD_SIZE;

const JOURNEY_WORLD_BY_ID = new Map(
  JOURNEY_WORLD_DEFINITIONS.map(definition => [definition.id, definition] as const),
);

export function getJourneyWorldDefinition(
  worldId: number,
): JourneyWorldDefinition | null {
  if (!Number.isInteger(worldId)) return null;
  return JOURNEY_WORLD_BY_ID.get(worldId) ?? null;
}

export function getJourneyWorldIdForBoard(boardId: number): number | null {
  if (!Number.isInteger(boardId) || boardId < 1 || boardId > JOURNEY_MAX_BOARDS) return null;
  const worldId = Math.floor((boardId - 1) / JOURNEY_WORLD_SIZE) + 1;
  return JOURNEY_WORLD_BY_ID.has(worldId) ? worldId : null;
}

export function getJourneyWorldRange(
  worldId: number,
): Readonly<{ start: number; end: number }> | null {
  if (!getJourneyWorldDefinition(worldId)) return null;
  const start = ((worldId - 1) * JOURNEY_WORLD_SIZE) + 1;
  return Object.freeze({ start, end: start + JOURNEY_WORLD_SIZE - 1 });
}
