import {
  getJourneyWorldDefinition,
  getJourneyWorldIdForBoard,
  getJourneyWorldRange,
  JOURNEY_HUB_EAGER_WORLD_COUNT,
  JOURNEY_HUB_WORLD_DEFINITIONS,
  JOURNEY_MAX_BOARDS,
  JOURNEY_WORLD_COUNT,
  JOURNEY_WORLD_DEFINITIONS,
  JOURNEY_WORLD_SIZE,
} from '../journey-world-definitions';

describe('Journey world definitions', () => {
  test('keeps stable gameplay ids while owning Hub presentation order as data', () => {
    expect(JOURNEY_WORLD_DEFINITIONS.map(world => world.id)).toEqual([1, 2, 3]);
    expect(JOURNEY_HUB_WORLD_DEFINITIONS.map(world => world.id)).toEqual([1, 3, 2]);
    expect(JOURNEY_WORLD_COUNT).toBe(3);
    expect(JOURNEY_HUB_EAGER_WORLD_COUNT).toBe(3);
    expect(JOURNEY_WORLD_SIZE).toBe(10);
    expect(JOURNEY_MAX_BOARDS).toBe(30);
  });

  test('derives board ownership and ranges from the registry boundary', () => {
    expect(getJourneyWorldIdForBoard(1)).toBe(1);
    expect(getJourneyWorldIdForBoard(20)).toBe(2);
    expect(getJourneyWorldIdForBoard(21)).toBe(3);
    expect(getJourneyWorldIdForBoard(31)).toBeNull();
    expect(getJourneyWorldRange(3)).toEqual({ start: 21, end: 30 });
    expect(getJourneyWorldRange(4)).toBeNull();
    expect(getJourneyWorldDefinition(2)?.name).toBe('Beach');
  });
});
