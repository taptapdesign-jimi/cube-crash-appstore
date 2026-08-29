/** Continuous profilers are opt-in in bundled production. Their RAF loops,
 * DOM scans and geometry reads must never become part of the game workload. */
export function areContinuousRuntimeDiagnosticsEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') return true;
  try {
    return (window as any).__ccContinuousRuntimeDiagnostics === true;
  } catch {
    return false;
  }
}

/** High-volume event traces are a separate, explicit opt-in. Performance
 * captures default to one compact periodic sample instead of per-event logs. */
export function areDetailedRuntimeDiagnosticsEnabled(): boolean {
  try {
    return (window as any).__ccDetailedRuntimeDiagnostics === true;
  } catch {
    return false;
  }
}

/** Compact physical-soak opt-in. It may enable short interaction samples but
 * never the permanent RAF/DOM profilers guarded by the continuous flag. */
export function arePerformanceDiagnosticsEnabled(): boolean {
  try {
    return (window as any).__ccPerformanceDiagnostics === true;
  } catch {
    return false;
  }
}
