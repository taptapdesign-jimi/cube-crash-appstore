import {
  areContinuousRuntimeDiagnosticsEnabled,
  areDetailedRuntimeDiagnosticsEnabled,
  arePerformanceDiagnosticsEnabled,
} from '../runtime-diagnostics-policy';

describe('runtime diagnostics policy', () => {
  afterEach(() => {
    delete (window as any).__ccContinuousRuntimeDiagnostics;
    delete (window as any).__ccDetailedRuntimeDiagnostics;
    delete (window as any).__ccPerformanceDiagnostics;
  });

  test('keeps detailed event traces off unless explicitly enabled', () => {
    expect(areDetailedRuntimeDiagnosticsEnabled()).toBe(false);
    (window as any).__ccDetailedRuntimeDiagnostics = true;
    expect(areDetailedRuntimeDiagnosticsEnabled()).toBe(true);
  });

  test('allows the existing development profiler policy without enabling detailed traces', () => {
    expect(areContinuousRuntimeDiagnosticsEnabled()).toBe(true);
    expect(areDetailedRuntimeDiagnosticsEnabled()).toBe(false);
  });

  test('keeps compact performance diagnostics as an independent opt-in', () => {
    expect(arePerformanceDiagnosticsEnabled()).toBe(false);
    (window as any).__ccPerformanceDiagnostics = true;
    expect(arePerformanceDiagnosticsEnabled()).toBe(true);
    expect(areDetailedRuntimeDiagnosticsEnabled()).toBe(false);
  });
});
