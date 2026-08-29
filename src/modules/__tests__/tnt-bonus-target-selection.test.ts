import {
  planLaserGunCrossfireTargets,
  selectSpatiallySeparatedTntTargets,
} from '../tnt-bonus-target-selection';

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

  it('randomly chooses either side when only one gun is needed', () => {
    expect(planLaserGunCrossfireTargets([{ id: 'left', x: 20 }], (target) => target.x, 100, () => 0.1)[0].shooter)
      .toBe('left');
    expect(planLaserGunCrossfireTargets([{ id: 'right', x: 80 }], (target) => target.x, 100, () => 0.9)[0].shooter)
      .toBe('right');
    expect(planLaserGunCrossfireTargets([{ id: 'center', x: 50 }], (target) => target.x, 100, () => 0.1)[0].shooter)
      .toBe('left');
    expect(planLaserGunCrossfireTargets([{ id: 'center', x: 50 }], (target) => target.x, 100, () => 0.9)[0].shooter)
      .toBe('right');
  });

  it('keeps the first target and strictly alternates opposite-side shooters', () => {
    const targets = [
      { id: 'first-left', x: 20 },
      { id: 'near-left', x: 35 },
      { id: 'far-right', x: 90 },
      { id: 'near-right', x: 65 },
    ];
    const plan = planLaserGunCrossfireTargets(targets, (target) => target.x, 100);

    expect(plan.map(({ target }) => target.id)).toEqual([
      'first-left',
      'far-right',
      'near-left',
      'near-right',
    ]);
    expect(plan.map(({ shooter }) => shooter)).toEqual(['right', 'left', 'right', 'left']);
    expect(new Set(plan.map(({ target }) => target))).toEqual(new Set(targets));
  });

  it('preserves every canonical target when one half has no matching target', () => {
    const targets = [{ x: 10 }, { x: 20 }, { x: 30 }];
    const plan = planLaserGunCrossfireTargets(targets, (target) => target.x, 100);

    expect(plan.map(({ shooter }) => shooter)).toEqual(['right', 'left', 'right']);
    expect(new Set(plan.map(({ target }) => target))).toEqual(new Set(targets));
  });
});
