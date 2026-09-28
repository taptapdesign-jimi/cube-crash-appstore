import { startThermalIsolation, type ThermalIsolationGroup } from './thermal-isolation.js';

type AuditOwner = {
  getStationaryThermalScene(checkViewport?: boolean): { ready: boolean; key: string };
  suspendInterimForThermalTest(): () => void;
};

/** Three owner-level ABBA runs: same viewport, no global timeline freezing.
 * Audio intentionally stays unchanged: destructive audio suppression cannot
 * honestly form the final A phase without a verified route-owned restart. */
export function startJourneyThermalAudit(options: {
  enabled: boolean;
  owner: AuditOwner;
  emit(event: Record<string, unknown>): void;
  onStop(reason: string): void;
}): (() => void) | null {
  if (!options.enabled || !options.owner.getStationaryThermalScene().ready) return null;
  const scene = options.owner.getStationaryThermalScene(false).key;
  const groups: ThermalIsolationGroup[] = ['ambient', 'journey-units', 'journey-interim'];
  let index = 0;
  let stopped = false;
  let stopCurrent: (() => void) | null = null;
  const finish = (reason: string) => {
    if (stopped) return;
    stopped = true;
    options.emit({ event: 'audit-stop', reason, complete: reason === 'complete', wall: Date.now() });
    options.onStop(reason);
  };
  const next = () => {
    if (stopped) return;
    if (options.owner.getStationaryThermalScene(false).key !== scene) { finish('scene-changed'); return; }
    if (index === groups.length) { finish('complete'); return; }
    const group = groups[index++];
    stopCurrent = startThermalIsolation({
      enabled: true, group,
      fingerprint: () => options.owner.getStationaryThermalScene(false).key,
      suppress: () => {
        if (group !== 'journey-interim') return () => {};
        const restore = options.owner.suspendInterimForThermalTest();
        options.emit({ event: 'owner-suspended', group, verified: true, wall: Date.now() });
        return () => {
          restore();
          options.emit({ event: 'owner-restored', group, wall: Date.now() });
        };
      },
      emit: event => options.emit({ ...event, auditGroup: index, auditGroups: groups.length }),
      onStop: reason => {
        stopCurrent = null;
        if (reason === 'complete') next();
        else finish(reason);
      },
    });
    if (!stopCurrent && !stopped) finish('not-started');
  };
  next();
  return () => {
    if (stopped) return;
    const stop = stopCurrent;
    finish('manual');
    stop?.();
  };
}
