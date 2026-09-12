export const JOURNEY_WORLD_SIZE = 10;
export const JOURNEY_HUB_EAGER_WORLD_COUNT = 3;
export const JOURNEY_LAYOUT_STATE_VERSION = 'forest-board-1-interim-v1';

export type JourneyWorldTheme = 'forest' | 'beach' | 'area55' | 'future';
export type JourneyStageLayout = Readonly<{
  xPx: number;
  topPx: number;
  rotationDeg: number;
  widthPx: number;
  heightPx: number;
}>;

export type JourneyWorldDefinition = Readonly<{
  id: number;
  hubOrder: number;
  name: string;
  subtitle: string;
  asset: string;
  className: string;
  mainOffsetPx: number;
  hub: Readonly<{
    side: 'left' | 'right';
    edgePx: number;
    topPx: number;
    widthPx: number;
    heightPx: number;
    bannerSide: 'left' | 'right';
    bannerAsset: string;
    bannerAsset2x: string;
    cloudTheme: JourneyWorldTheme;
  }>;
  stages: readonly JourneyStageLayout[];
  cardTheme: JourneyWorldTheme;
  animationTheme: JourneyWorldTheme;
  transitionTheme: 'forest' | 'beach' | 'area55';
  mainAreaId: string;
  mainCloudClass: string;
  mainArtClass: string;
}>;

const stage = (xPx: number, topPx: number, rotationDeg: number): JourneyStageLayout =>
  Object.freeze({ xPx, topPx, rotationDeg, widthPx: 90, heightPx: 133 });

const FOREST_STAGES = Object.freeze([
  stage(28, 155, -4), stage(300, 243, 6), stage(40, 353, -6), stage(232, 441, 6),
  stage(74, 571, -6), stage(222, 675, 6), stage(40, 779, -6), stage(206, 903, 6),
  stage(20, 1007, -6), stage(222, 1131, 6),
]);
const BEACH_STAGES = Object.freeze([
  stage(36, 237, -6), stage(230, 367, 6), stage(44, 501, -6), stage(222, 625, 6),
  stage(40, 739, -6), stage(226, 867, 6), stage(40, 995, -6), stage(228, 1115, 6),
  stage(40, 1241, -6), stage(226, 1367, 6),
]);
const AREA55_STAGES = Object.freeze([
  stage(19, 253, -6), stage(242, 373, 6), stage(56, 497, -11), stage(246, 609, 4),
  stage(62, 777, -6), stage(234, 876, 6), stage(63, 1010, -6), stage(203, 1129, 6),
  stage(20, 1249, -8), stage(240, 1363, 10),
]);

const DEFINITIONS: JourneyWorldDefinition[] = [
  {
    id: 1,
    hubOrder: 1,
    name: 'Forest',
    subtitle: 'Stages 01-10',
    asset: './assets/journey assets/forest/forest world/Forest main.png',
    className: 'journey-v700-world-forest',
    mainOffsetPx: 0,
    hub: { side: 'left', edgePx: -2, topPx: 118, widthPx: 273, heightPx: 190, bannerSide: 'right', bannerAsset: './assets/journey assets/natpis.png', bannerAsset2x: './assets/journey assets/natpis@2x.png', cloudTheme: 'forest' },
    stages: FOREST_STAGES,
    cardTheme: 'forest', animationTheme: 'forest', transitionTheme: 'forest',
    mainAreaId: 'forest-main', mainCloudClass: 'journey-forest-main-cloud', mainArtClass: 'journey-forest-main-art',
  },
  {
    id: 2,
    hubOrder: 3,
    name: 'Beach',
    subtitle: 'Stages 01-10',
    asset: './assets/journey assets/beach/Beacj world/beach-main.png',
    className: 'journey-v700-world-beach',
    mainOffsetPx: 1454,
    hub: { side: 'left', edgePx: -6, topPx: 580, widthPx: 273, heightPx: 190, bannerSide: 'right', bannerAsset: './assets/journey assets/natpis.png', bannerAsset2x: './assets/journey assets/natpis@2x.png', cloudTheme: 'beach' },
    stages: BEACH_STAGES,
    cardTheme: 'beach', animationTheme: 'beach', transitionTheme: 'beach',
    mainAreaId: 'beach-main', mainCloudClass: 'journey-beach-main-cloud', mainArtClass: 'journey-beach-main-art',
  },
  {
    id: 3,
    hubOrder: 2,
    name: 'Area 55',
    subtitle: 'Stages 01-10',
    asset: './assets/journey assets/robo/robo world/robo-main.png',
    className: 'journey-v700-world-robo',
    mainOffsetPx: 3166,
    hub: { side: 'right', edgePx: -8, topPx: 334, widthPx: 273, heightPx: 190, bannerSide: 'left', bannerAsset: './assets/journey assets/natpis.png', bannerAsset2x: './assets/journey assets/natpis@2x.png', cloudTheme: 'area55' },
    stages: AREA55_STAGES,
    cardTheme: 'area55', animationTheme: 'area55', transitionTheme: 'area55',
    mainAreaId: 'robo-main', mainCloudClass: 'journey-robo-main-cloud', mainArtClass: 'journey-robo-main-art',
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

for (const definition of JOURNEY_WORLD_DEFINITIONS) {
  if (definition.stages.length !== JOURNEY_WORLD_SIZE) {
    throw new Error(`Journey World ${definition.id} must define exactly ${JOURNEY_WORLD_SIZE} Stage positions`);
  }
}

export function getJourneyWorldDefinition(
  worldId: number,
): JourneyWorldDefinition | null {
  if (!Number.isInteger(worldId)) return null;
  return JOURNEY_WORLD_BY_ID.get(worldId) ?? null;
}

export function normalizeJourneyBoardId(value: unknown): number | null {
  const boardId = Number(value);
  if (!Number.isInteger(boardId) || boardId < 1 || boardId > JOURNEY_MAX_BOARDS) return null;
  return getJourneyWorldIdForBoard(boardId) ? boardId : null;
}

export function getJourneyHubExtentPx(
  definitions: readonly JourneyWorldDefinition[] = JOURNEY_HUB_WORLD_DEFINITIONS,
): number {
  return definitions.reduce(
    (extent, definition) => Math.max(extent, definition.hub.topPx + definition.hub.heightPx),
    0,
  );
}

/** Visible/selected World plus one neighbour; work stays constant as the catalog grows. */
export function getJourneyHubWorkingSet(
  worldId: number,
  definitions: readonly JourneyWorldDefinition[] = JOURNEY_HUB_WORLD_DEFINITIONS,
): readonly JourneyWorldDefinition[] {
  const ordered = [...definitions].sort((a, b) => a.hubOrder - b.hubOrder);
  if (ordered.length <= JOURNEY_HUB_EAGER_WORLD_COUNT) return Object.freeze(ordered);
  const index = ordered.findIndex(definition => definition.id === worldId);
  if (index < 0) return Object.freeze([]);
  const neighbour = ordered[index + 1] ?? ordered[index - 1] ?? null;
  return Object.freeze(neighbour ? [ordered[index], neighbour] : [ordered[index]]);
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
