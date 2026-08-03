import type { WildSpawnPermission } from './wild-spawn-permission.ts';

export type WildMeterProgressDecision =
  | { action: 'add'; reason: string }
  | { action: 'reset'; reason: 'last-merge' }
  | { action: 'skip'; reason: string };

/**
 * Meter fill can happen after the merge resolver has already captured a
 * trustworthy non-final snapshot. During that animation window, newly dropped
 * or not-yet-spawned tiles may be absent from the live active-tile query, so a
 * second last-merge check must not overrule the immutable merge decision.
 */
export function resolveWildMeterProgressDecision({
  permission,
  confirmedNonFinal,
}: {
  permission: WildSpawnPermission;
  confirmedNonFinal: boolean;
}): WildMeterProgressDecision {
  if (permission.reason === 'wild-meter-disabled') {
    return { action: 'skip', reason: permission.reason };
  }

  if (permission.reason === 'last-merge') {
    return confirmedNonFinal
      ? { action: 'add', reason: 'confirmed-non-final-merge' }
      : { action: 'reset', reason: 'last-merge' };
  }

  if (permission.action === 'block' && permission.reason !== 'wild-spawn-disabled') {
    return { action: 'skip', reason: permission.reason };
  }

  return { action: 'add', reason: permission.reason };
}
