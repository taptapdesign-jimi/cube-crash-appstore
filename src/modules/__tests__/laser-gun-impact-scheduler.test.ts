import {
  LASERGUN_ARRIVAL_TIMEOUT_MS,
  LASERGUN_FIRST_SHOT_LEAD_MS,
  LASERGUN_PREFLIGHT_LEAD_MS,
  LASERGUN_SHOT_INTERVAL_MS,
  LASERGUN_TIMING_SCALE,
  runLaserGunSequentialImpactScheduler,
} from '../laser-gun-impact-scheduler';

describe('LaserGun sequential impact scheduler', () => {
  test('prepares and commits strict 1 -> 2 -> 3 -> 4 at the additional 30%-faster cadence', async () => {
    let clock = 0;
    const events: string[] = [];
    const commits: number[] = [];
    const plans = Array.from({ length: 4 }, (_, index) => ({
      prepare: async () => { events.push(`prepare-${index + 1}`); },
      commit: () => {
        events.push(`commit-${index + 1}`);
        commits.push(clock);
      },
    }));

    await runLaserGunSequentialImpactScheduler(
      plans,
      async (delayMs) => { clock += delayMs; },
      () => clock,
    );

    expect(events).toEqual([
      'prepare-1', 'commit-1',
      'prepare-2', 'commit-2',
      'prepare-3', 'commit-3',
      'prepare-4', 'commit-4',
    ]);
    expect(commits).toEqual([
      LASERGUN_FIRST_SHOT_LEAD_MS,
      LASERGUN_FIRST_SHOT_LEAD_MS + LASERGUN_SHOT_INTERVAL_MS,
      LASERGUN_FIRST_SHOT_LEAD_MS + LASERGUN_SHOT_INTERVAL_MS * 2,
      LASERGUN_FIRST_SHOT_LEAD_MS + LASERGUN_SHOT_INTERVAL_MS * 3,
    ]);
    expect(LASERGUN_TIMING_SCALE).toBe(0.455);
    expect(LASERGUN_PREFLIGHT_LEAD_MS).toBe(154);
    expect(LASERGUN_SHOT_INTERVAL_MS).toBe(125);
    expect(LASERGUN_ARRIVAL_TIMEOUT_MS).toBe(900);
  });

  test('re-arms from the actual prior commit so an overdue main-thread wake cannot batch beams', async () => {
    let clock = 0;
    const commits: number[] = [];
    const plans = Array.from({ length: 4 }, (_, index) => ({
      prepare: async () => {
        if (index === 1) clock += 900;
      },
      commit: () => { commits.push(clock); },
    }));

    await runLaserGunSequentialImpactScheduler(
      plans,
      async (delayMs) => { clock += delayMs; },
      () => clock,
    );

    expect(commits[1]).toBeGreaterThan(commits[0] + LASERGUN_SHOT_INTERVAL_MS);
    expect(commits[2] - commits[1]).toBe(LASERGUN_SHOT_INTERVAL_MS);
    expect(commits[3] - commits[2]).toBe(LASERGUN_SHOT_INTERVAL_MS);
    expect(new Set(commits).size).toBe(4);
  });

  test('keeps cancelled-scene gameplay fallback sequential with no initial visual lead', async () => {
    let clock = 1000;
    const commits: number[] = [];
    const plans = Array.from({ length: 4 }, () => ({
      prepare: async () => true,
      commit: () => { commits.push(clock); },
    }));

    await runLaserGunSequentialImpactScheduler(
      plans,
      async (delayMs) => { clock += delayMs; },
      () => clock,
      0,
    );

    expect(commits).toEqual([
      1000,
      1000 + LASERGUN_SHOT_INTERVAL_MS,
      1000 + LASERGUN_SHOT_INTERVAL_MS * 2,
      1000 + LASERGUN_SHOT_INTERVAL_MS * 3,
    ]);
  });

  test('re-arms the next launch from actual asynchronous beam-tip arrival', async () => {
    let clock = 0;
    const launches: number[] = [];
    const arrivals: number[] = [];
    const plans = Array.from({ length: 3 }, () => ({
      prepare: async () => true,
      commit: async () => {
        launches.push(clock);
        clock += 95;
        arrivals.push(clock);
      },
    }));

    await runLaserGunSequentialImpactScheduler(
      plans,
      async (delayMs) => { clock += delayMs; },
      () => clock,
      0,
    );

    expect(arrivals).toEqual([95, 315, 535]);
    expect(launches).toEqual([0, 220, 440]);
  });

  test('stops after a lifecycle-cancelled commit without launching stale later shots', async () => {
    let clock = 0;
    const commits: number[] = [];
    const result = await runLaserGunSequentialImpactScheduler(
      Array.from({ length: 4 }, (_, index) => ({
        prepare: async () => true,
        commit: async () => {
          commits.push(index);
          return index !== 1;
        },
      })),
      async (delayMs) => { clock += delayMs; },
      () => clock,
      0,
    );

    expect(result).toBe('cancelled');
    expect(commits).toEqual([0, 1]);
  });
});
