import { gsap } from 'gsap';
import { startThermalIsolation } from './thermal-isolation.js';

type NativeSample = {
  wall: number;
  batteryState: number;
  brightnessPercent: number;
  thermalState: string;
  persistenceAvailable: boolean;
};
type Owner = {
  getStationaryThermalScene(checkViewport?: boolean): { ready: boolean; key: string };
  suspendInterimForThermalTest(): () => void;
};

export function readUnpluggedThermalSample(): NativeSample | undefined {
  return (window as Window & { __ccNativeThermalSample?: NativeSample }).__ccNativeThermalSample;
}

export function unpluggedThermalInvalidReason(
  sample: NativeSample | undefined, brightness?: number, starting = false,
): string | null {
  if (!sample || !Number.isFinite(sample.wall) || Date.now() - sample.wall > 12_000 || sample.wall > Date.now() + 1000) return 'native-sample-missing';
  if (!sample.persistenceAvailable) return 'recording-unavailable';
  if (sample.batteryState !== 1) return 'unplug-cable';
  if (sample.thermalState === 'serious' || sample.thermalState === 'critical') return 'thermal-stop';
  if (starting && sample.thermalState !== 'nominal') return 'cool-to-nominal';
  if (!Number.isFinite(sample.brightnessPercent)) return 'brightness-unavailable';
  if (brightness !== undefined && Math.abs(sample.brightnessPercent - brightness) > 2) return 'brightness-changed';
  return null;
}

/** Diagnostic only: no gameplay, no audio changes, no global ticker sleep.
 * A frozen global timeline is restored before input handlers run. Owner-level
 * paint gates separately hold ambient canvases and both World Unit tickers.
 * Existing timers drive this run and cancel on input/route/background changes.
 */
export function startJourneyUnpluggedThermalTest(options: {
  enabled: boolean;
  owner: Owner;
  emit(event: Record<string, unknown>): void;
  onStop(reason: string): void;
  holdWebAnimations(): () => void;
}): (() => void) | null {
  if (!options.enabled || !options.owner.getStationaryThermalScene().ready) return null;
  const initial = readUnpluggedThermalSample();
  const invalid = unpluggedThermalInvalidReason(initial, undefined, true);
  if (invalid) { options.emit({ event: 'unplugged-rejected', reason: invalid }); return null; }
  if (gsap.globalTimeline.paused()) return null;
  let frozen = false;
  let mutations = 0;
  let lastVisualSignature = '';
  // The existing one-second diagnostic guard samples inline DOM state in BOTH
  // arms. No layout reads, new observer, RAF or production polling owner.
  const sampleVisualSignature = () => [root, ...Array.from(root?.querySelectorAll('*') ?? [])].filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map(element => `${element.getAttribute('class')}:${element.getAttribute('style')}`).join('|');
  const root = document.getElementById('journey-boards-container');
  if (!root || Array.from(document.querySelectorAll('video')).some(video => !video.paused)) return null;
  const emit = (event: Record<string, unknown>) => {
    // Static windows with unexpected DOM writes are explicitly invalid, not
    // silently described as a static baseline. Canvas gates report separately.
    const signature = sampleVisualSignature();
    if (frozen && lastVisualSignature && signature !== lastVisualSignature) mutations++;
    lastVisualSignature = signature;
    options.emit({ ...event, protocol: 'unplugged-static-animated-static',
      native: readUnpluggedThermalSample(), staticDomChangedSamples: mutations,
      staticSampledVerified: frozen ? mutations === 0 && gsap.globalTimeline.paused()
        && !document.getAnimations().some(animation => animation.playState === 'running') : null,
    });
    if (event.event === 'measure-start') mutations = 0;
  };
  return startThermalIsolation({
    enabled: true, group: 'world-visuals',
    timing: { settleMs: 15_000, measureMs: 165_000, staticFirst: true },
    fingerprint: () => options.owner.getStationaryThermalScene(false).key,
    invalidReason: () => {
      const signature = sampleVisualSignature();
      if (frozen && lastVisualSignature && signature !== lastVisualSignature) mutations++;
      lastVisualSignature = signature;
      return unpluggedThermalInvalidReason(readUnpluggedThermalSample(), initial!.brightnessPercent);
    },
    suppress: () => {
      const restoreInterim = options.owner.suspendInterimForThermalTest();
      let restoreWebAnimations: (() => void) | null = null;
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true; frozen = false;
        try { gsap.globalTimeline.resume(); } finally {
          try { restoreWebAnimations?.(); } finally { restoreInterim(); }
        }
      };
      try {
        gsap.globalTimeline.pause();
        restoreWebAnimations = options.holdWebAnimations();
        frozen = true; mutations = 0;
        lastVisualSignature = sampleVisualSignature();
        emit({ event: 'static-owners-held', wall: Date.now() });
        return restore;
      } catch (error) { restore(); throw error; }
    },
    emit,
    onStop: options.onStop,
  });
}
