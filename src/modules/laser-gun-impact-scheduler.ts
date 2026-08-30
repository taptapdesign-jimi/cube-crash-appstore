// The accepted choreography was first shortened to 65%, then shortened by a
// further 30%. Keep the combined factor shared with the DOM scene so entry,
// build-up, shots and exit cannot drift into different rhythms.
export const LASERGUN_TIMING_SCALE = 0.455;
export const LASERGUN_FIRST_SHOT_LEAD_MS = Math.round(540 * LASERGUN_TIMING_SCALE);
// This minimum gap starts at the prior beam-tip arrival. With a ready incoming
// gun, launches cannot land closer than about 220ms; the real scene may widen
// that cadence while it awaits the gun's entry/build-up and two paint frames.
export const LASERGUN_SHOT_INTERVAL_MS = 125;
export const LASERGUN_ARRIVAL_TIMEOUT_MS = 900;
// This is scheduling headroom, not visible animation time. It starts each
// build-up early enough to absorb its gun-entry promise and WebKit paint
// barriers while the actual impact cadence remains 35% faster.
export const LASERGUN_PREFLIGHT_LEAD_MS = 154;

export type LaserGunImpactPlan = {
  prepare: () => Promise<boolean | unknown>;
  commit: () => boolean | void | Promise<boolean | void>;
};

export type LaserGunSchedulerWaitResult = 'elapsed' | 'cancelled' | void;
export type LaserGunSchedulerResult = 'completed' | 'cancelled';

export async function runLaserGunSequentialImpactScheduler(
  plans: readonly LaserGunImpactPlan[],
  wait: (delayMs: number) => Promise<LaserGunSchedulerWaitResult>,
  now: () => number = Date.now,
  firstShotLeadMs = LASERGUN_FIRST_SHOT_LEAD_MS,
): Promise<LaserGunSchedulerResult> {
  let earliestImpactAt = now() + Math.max(0, firstShotLeadMs);

  for (const plan of plans) {
    const preflightDelay = Math.max(0, earliestImpactAt - now() - LASERGUN_PREFLIGHT_LEAD_MS);
    if (preflightDelay > 0 && await wait(preflightDelay) === 'cancelled') return 'cancelled';

    if (await plan.prepare() === false) return 'cancelled';

    const remainingDelay = Math.max(0, earliestImpactAt - now());
    if (remainingDelay > 0 && await wait(remainingDelay) === 'cancelled') return 'cancelled';

    if (await plan.commit() === false) return 'cancelled';
    // Arm the next shot only after this one's beam tip arrives and its exact
    // native cube commits. A main-thread stall can never batch later launches.
    earliestImpactAt = now() + LASERGUN_SHOT_INTERVAL_MS;
  }
  return 'completed';
}
