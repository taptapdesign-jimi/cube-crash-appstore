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
