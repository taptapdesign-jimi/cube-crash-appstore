import {
  LASERGUN_MAX_GUNS_PER_SIDE,
  getLaserGunPlannerMuzzleX,
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

  it('chooses the farthest muzzle band for one target and randomizes only a centered tie', () => {
    expect(planLaserGunCrossfireTargets([{ id: 'left', x: 78 }], (target) => target.x, 390, () => 0.1)[0].shooter)
      .toBe('right');
    expect(planLaserGunCrossfireTargets([{ id: 'right', x: 312 }], (target) => target.x, 390, () => 0.9)[0].shooter)
      .toBe('left');
    expect(planLaserGunCrossfireTargets([{ id: 'center', x: 195 }], (target) => target.x, 390, () => 0.1)[0].shooter)
      .toBe('left');
    expect(planLaserGunCrossfireTargets([{ id: 'center', x: 195 }], (target) => target.x, 390, () => 0.9)[0].shooter)
      .toBe('right');
  });

  it('scores the same clamped muzzle bands used by the rendered scene', () => {
    expect(getLaserGunPlannerMuzzleX('left', 320)).toBe(72);
    expect(getLaserGunPlannerMuzzleX('right', 320)).toBe(248);
    expect(getLaserGunPlannerMuzzleX('left', 390)).toBeCloseTo(81.9, 6);
    expect(getLaserGunPlannerMuzzleX('right', 390)).toBeCloseTo(308.1, 6);
    expect(getLaserGunPlannerMuzzleX('left', 430)).toBe(84);
    expect(getLaserGunPlannerMuzzleX('right', 430)).toBe(346);
  });

  it('keeps the first target and every exact reference while avoiding strict alternation', () => {
    const targets = [
      { id: 'first-left', x: 20 },
      { id: 'near-left', x: 35 },
      { id: 'far-right', x: 90 },
      { id: 'near-right', x: 65 },
    ];
    const plan = planLaserGunCrossfireTargets(targets, (target) => target.x, 100);

    expect(plan[0].target).toBe(targets[0]);
    expect(new Set(plan.map(({ target }) => target))).toEqual(new Set(targets));
    expect(plan.map(({ shooter }) => shooter)).not.toEqual(['left', 'right', 'left', 'right']);
    expect(plan.map(({ shooter }) => shooter)).not.toEqual(['right', 'left', 'right', 'left']);
  });

  it('selects multiple seeded switchback patterns only among tied best geometry', () => {
    const targets = [
      { id: 'left-edge', x: 39 },
      { id: 'left-inner', x: 78 },
      { id: 'right-inner', x: 312 },
      { id: 'right-edge', x: 351 },
    ];
    const patterns = [0, 0.24, 0.51, 0.99].map((seed) => (
      planLaserGunCrossfireTargets(targets, (target) => target.x, 390, () => seed)
        .map(({ shooter }) => shooter[0].toUpperCase())
        .join('')
    ));

    expect(new Set(patterns).size).toBeGreaterThan(1);
    patterns.forEach((pattern) => {
      expect(['RLLR', 'RRLL']).toContain(pattern);
    });
  });

  it('allows a one-edge cluster to use four opposite-side guns instead of short beams', () => {
    const targets = [{ x: 5 }, { x: 15 }, { x: 25 }, { x: 35 }];
    const plan = planLaserGunCrossfireTargets(targets, (target) => target.x, 320, () => 0.8);
    const sideCounts = plan.reduce<Record<string, number>>((counts, { shooter }) => ({
      ...counts,
      [shooter]: (counts[shooter] ?? 0) + 1,
    }), {});

    expect(plan).toHaveLength(4);
    expect(sideCounts).toEqual({ right: 4 });
    expect(LASERGUN_MAX_GUNS_PER_SIDE).toBe(4);
  });

  it('improves the weakest muzzle run without reducing total distance versus the old fallback', () => {
    const targets = [{ x: 39 }, { x: 78 }, { x: 117 }, { x: 156 }];
    const plan = planLaserGunCrossfireTargets(targets, (target) => target.x, 390, () => 0);
    const muzzleX = {
      left: getLaserGunPlannerMuzzleX('left', 390),
      right: getLaserGunPlannerMuzzleX('right', 390),
    } as const;
    const distances = plan.map(({ target, shooter }) => Math.abs(target.x - muzzleX[shooter]));
    const oldShooters = ['right', 'left', 'right', 'left'] as const;
    const oldForcedDistances = targets.map((target, index) => (
      Math.abs(target.x - muzzleX[oldShooters[index]])
    ));

    expect(Math.min(...distances)).toBeGreaterThan(Math.min(...oldForcedDistances));
    expect(distances.reduce((sum, distance) => sum + distance, 0))
      .toBeGreaterThanOrEqual(oldForcedDistances.reduce((sum, distance) => sum + distance, 0));
  });

  it('preserves every canonical target when one half has no matching target', () => {
    const targets = [{ x: 10 }, { x: 20 }, { x: 30 }];
    const plan = planLaserGunCrossfireTargets(targets, (target) => target.x, 100, () => 0.4);

    expect(plan[0].target).toBe(targets[0]);
    expect(new Set(plan.map(({ target }) => target))).toEqual(new Set(targets));
  });
});
