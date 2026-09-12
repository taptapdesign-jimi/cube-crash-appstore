import {
  getJourneyWorldDefinition,
  getJourneyHubExtentPx,
  getJourneyHubWorkingSet,
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
    expect(JOURNEY_MAX_BOARDS).toBe(JOURNEY_WORLD_COUNT * JOURNEY_WORLD_SIZE);
    JOURNEY_WORLD_DEFINITIONS.forEach(world => expect(world.stages).toHaveLength(JOURNEY_WORLD_SIZE));
  });

  test('derives board ownership and ranges from the registry boundary', () => {
    expect(getJourneyWorldIdForBoard(1)).toBe(1);
    expect(getJourneyWorldIdForBoard(20)).toBe(2);
    expect(getJourneyWorldIdForBoard(21)).toBe(3);
    expect(getJourneyWorldIdForBoard(JOURNEY_MAX_BOARDS + 1)).toBeNull();
    expect(getJourneyWorldRange(3)).toEqual({ start: 21, end: 30 });
    expect(getJourneyWorldRange(4)).toBeNull();
    expect(getJourneyWorldDefinition(2)?.name).toBe('Beach');
  });

  test.each([8, 13])('keeps layout and active work bounded for %i World fixtures', (count) => {
    const template = JOURNEY_WORLD_DEFINITIONS[0];
    const fixture = Array.from({ length: count }, (_, index) => ({
      ...template,
      id: index + 1,
      hubOrder: index + 1,
      hub: {
        ...template.hub,
        side: (index % 2 === 0 ? 'left' : 'right') as 'left' | 'right',
        topPx: 118 + (index * 246),
      },
    }));

    const extent = getJourneyHubExtentPx(fixture);
    expect(Number.isFinite(extent)).toBe(true);
    expect(extent).toBeGreaterThan(fixture[fixture.length - 1].hub.topPx);
    const work = getJourneyHubWorkingSet(Math.ceil(count / 2), fixture);
    expect(work).toHaveLength(2);
    expect(work.map(world => world.id)).toContain(Math.ceil(count / 2));
    expect(new Set(work.map(world => world.id)).size).toBe(2);
    for (let index = 1; index < fixture.length; index += 1) {
      expect(fixture[index].hub.topPx).toBeGreaterThanOrEqual(
        fixture[index - 1].hub.topPx + fixture[index - 1].hub.heightPx,
      );
    }
  });
});
