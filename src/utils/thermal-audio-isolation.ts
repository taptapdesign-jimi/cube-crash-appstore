/** Natural-play diagnostic switch. No settings write, persistence, or timer. */
let suppressed = typeof window !== 'undefined'
  && (window as any).__ccThermalAudioSuppressedOnLaunch === true;
const listeners = new Set<(enabled: boolean) => void>();
const blocked: Record<string, number> = {};

export function isThermalAudioSuppressed(): boolean { return suppressed; }

export function isThermalAudioIsolationAvailable(): boolean {
  return typeof window !== 'undefined' && ((window as any).__ccThermalIsolation === true
    || (window as any).__ccThermalAudioIsolationAvailable === true
    || (location.hostname === 'localhost' && new URLSearchParams(location.search).get('ccThermalIsolation') === '1'));
}

export function setThermalAudioSuppressed(enabled: boolean): boolean {
  if (enabled && !isThermalAudioIsolationAvailable()) return false;
  if (suppressed === enabled) return suppressed;
  suppressed = enabled;
  for (const listener of listeners) {
    try { listener(enabled); } catch { /* One diagnostic owner cannot block the others. */ }
  }
  return suppressed;
}

export function subscribeThermalAudioIsolation(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  if (suppressed) listener(true);
  return () => { listeners.delete(listener); };
}

export function recordThermalAudioIsolationBlock(kind: string): void {
  if (suppressed) blocked[kind] = (blocked[kind] ?? 0) + 1;
}

export function getThermalAudioIsolationStats() {
  return { isolationEnabled: suppressed, suppressed: { ...blocked } };
}

export function resetThermalAudioIsolationForTests(): void {
  setThermalAudioSuppressed(false);
  Object.keys(blocked).forEach(key => { delete blocked[key]; });
}
