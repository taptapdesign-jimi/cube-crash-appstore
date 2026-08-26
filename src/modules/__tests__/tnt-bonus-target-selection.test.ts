import { selectSpatiallySeparatedTntTargets } from '../tnt-bonus-target-selection';

describe('TNT bonus target selection', () => {
  const candidates = [
    { id: 'top-left', gridX: 0, gridY: 0 },
    { id: 'near-top-left', gridX: 1, gridY: 0 },
    { id: 'top-right', gridX: 5, gridY: 0 },
    { id: 'bottom-left', gridX: 0, gridY: 5 },
    { id: 'bottom-right', gridX: 5, gridY: 5 },
  ];

  it('returns four distinct, spatially spread targets when four are available', () => {
    const selected = selectSpatiallySeparatedTntTargets(candidates, 4, () => 0);

    expect(selected.map((target) => target.id)).toEqual([
      'top-left',
      'bottom-right',
      'top-right',
      'bottom-left',
    ]);
    expect(new Set(selected).size).toBe(4);
  });

  it('uses every available target without inventing gameplay targets', () => {
    const selected = selectSpatiallySeparatedTntTargets(candidates.slice(0, 2), 4, () => 0.9);

    expect(selected).toHaveLength(2);
    expect(new Set(selected)).toEqual(new Set(candidates.slice(0, 2)));
  });
});
