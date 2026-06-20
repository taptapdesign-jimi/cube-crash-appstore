import { resolveRegularMerge6SpawnCount } from '../regular-merge6-spawn-count';

describe('regular-merge6-spawn-count', () => {
  it('keeps regular merge-6 spawn count between two and three', () => {
    expect(resolveRegularMerge6SpawnCount(0)).toBe(2);
    expect(resolveRegularMerge6SpawnCount(1)).toBe(2);
    expect(resolveRegularMerge6SpawnCount(2)).toBe(2);
    expect(resolveRegularMerge6SpawnCount(3)).toBe(2);
    expect(resolveRegularMerge6SpawnCount(4)).toBe(3);
    expect(resolveRegularMerge6SpawnCount(99)).toBe(3);
  });
});
