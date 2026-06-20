import { getLockedSpawnCandidates } from '../locked-spawn-candidates';

describe('locked-spawn-candidates', () => {
  it('keeps only usable locked tiles outside excluded cells', () => {
    const locked = { locked: true, gridX: 1, gridY: 1 };
    const excluded = { locked: true, gridX: 2, gridY: 2 };
    const destroyed = { locked: true, gridX: 3, gridY: 3, destroyed: true };
    const active = { locked: false, gridX: 4, gridY: 4 };

    expect(getLockedSpawnCandidates(
      [locked, excluded, destroyed, active, null],
      new Set(['2,2'])
    )).toEqual([locked]);
  });

  it('sorts preferred merge cell first without dropping other candidates', () => {
    const first = { locked: true, gridX: 0, gridY: 0 };
    const preferred = { locked: true, gridX: 2, gridY: 3 };
    const last = { locked: true, gridX: 4, gridY: 4 };

    expect(getLockedSpawnCandidates(
      [first, preferred, last],
      new Set(),
      { c: 2, r: 3 }
    )).toEqual([preferred, first, last]);
  });
});
