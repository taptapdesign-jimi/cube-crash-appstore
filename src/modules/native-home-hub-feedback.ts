import { playCtaActivationSounds, stopCtaActivationSounds } from './cta-activation-sound.js';
import { playNavigationIconSounds, stopNavigationIconSounds } from './navigation-icon-sound.js';
import { playNavigationCloseSound, stopNavigationCloseSound } from './navigation-close-sound.js';
import { playHomepageSliderSwipeSound, stopHomepageSliderSwipeSound } from './homepage-slider-swipe-sound.js';
import { playHomepageSliderEnterSound, playHomepageSliderExitSound, stopHomepageSliderMotionSounds } from './homepage-slider-motion-sound.js';
import { playJourneyWorldsHubSound, stopJourneyWorldsHubSound } from './journey-worlds-hub-sound.js';
import { createJourneyHubExitSoundSession } from './journey-hub-exit-sound.js';

export type NativeCtaFeedbackPolicy = 'native-only' | 'web-home-source' | 'web-hub-source' | 'canonical-gameplay';
export interface NativeHomeHubFeedback {
  pressCTA(id: number, policy: NativeCtaFeedbackPolicy): boolean;
  pressTab(id: number, policy: 'native-only' | 'web-home-source'): boolean;
  pressSwipe(id: number): boolean;
  pressBack(id: number): boolean;
  homeMotion(id: number, direction: 'enter' | 'exit', durationSeconds: number): boolean;
  hubAmbience(id: number): boolean;
  hubExit(id: number): boolean;
  /** Terminal cancellation of this native lease. Construct a new lease on a
   * later native admission; callbacks retaining this one remain inert. */
  stop(): void;
  /** Relinquish BEFORE canonical web preparation/action starts its same cue
   * families. A later stop/dispose cannot retire the web owner's new voices. */
  releaseToWeb(): void;
  dispose(): void;
}

let activeFeedback: NativeHomeHubFeedback | null = null;

/** Global Settings/thermal full stop delegates to the current native lease.
 * Existing cue owners also remain in the sole global SFX registry. */
export function stopNativeHomeHubFeedback(): void {
  activeFeedback?.stop();
}

/** Semantic adapter only: no new transport, sources, timers, listeners, preload
 * or automatic replay. Call only for committed native interaction/motion. Hub
 * Unit enter remains deferred: its existing owner requires visible DOM geometry;
 * native artwork must not fake that geometry or substitute a generic cue. */
export function createNativeHomeHubFeedback(enabled: boolean): NativeHomeHubFeedback {
  if (enabled) activeFeedback?.stop();
  let ended = !enabled;
  const latest = new Map<string, number>(); // Eight fixed semantic categories.
  const ownedStops = new Map<string, () => void>();
  const settings = () => (window as Window & { _settings?: { gameSoundsEnabled?: boolean; hapticsEnabled?: boolean } })._settings;
  const admit = (kind: string, id: number): boolean => {
    if (ended || activeFeedback !== feedback || document.hidden || !Number.isSafeInteger(id) || id <= 0 || id <= (latest.get(kind) ?? 0)) return false;
    latest.set(kind, id); // Sounds OFF consumes the event, so ON cannot replay it.
    return true;
  };
  const sound = (family: string, play: () => unknown, stop: () => void): void => {
    if (settings()?.gameSoundsEnabled !== true) return;
    ownedStops.set(family, stop);
    try { play(); } catch { /* Existing audio failure cannot reject navigation. */ }
  };
  const light = (): void => {
    if (settings()?.hapticsEnabled === false) return;
    try { window.triggerHapticImpact?.('light'); } catch { /* Native haptic unavailable. */ }
  };
  const retire = (stopVoices: boolean): void => {
    if (ended) return;
    ended = true;
    const ownsLease = activeFeedback === feedback;
    if (ownsLease) activeFeedback = null;
    if (stopVoices && ownsLease) {
      for (const stop of ownedStops.values()) {
        try { stop(); } catch { /* Retire the remaining independent families. */ }
      }
    }
    ownedStops.clear();
  };
  const feedback: NativeHomeHubFeedback = {
    pressCTA(id, policy) {
      if (!['native-only', 'web-home-source', 'web-hub-source', 'canonical-gameplay'].includes(policy) || !admit('cta', id)) return false;
      // Manager.openJourneyV700World owns its CTA cue. UIManager Home handlers
      // own light haptic but their ordinary DOM CTA wrapper owns the sound.
      if (policy !== 'web-hub-source') sound('cta', playCtaActivationSounds, stopCtaActivationSounds);
      if (policy === 'native-only') light();
      return true;
    },
    pressTab(id, policy) {
      if ((policy !== 'native-only' && policy !== 'web-home-source') || !admit('tab', id)) return false;
      sound('tab', playNavigationIconSounds, stopNavigationIconSounds);
      if (policy === 'native-only') light();
      return true;
    },
    pressSwipe(id) {
      if (!admit('swipe', id)) return false;
      sound('swipe', playHomepageSliderSwipeSound, stopHomepageSliderSwipeSound);
      return true; // Canonical accepted slider swipe has no extra impact.
    },
    pressBack(id) {
      if (!admit('back', id)) return false;
      sound('back', playNavigationCloseSound, stopNavigationCloseSound);
      light();
      return true;
    },
    homeMotion(id, direction, durationSeconds) {
      if ((direction !== 'enter' && direction !== 'exit') || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 10
        || !admit(`home-${direction}`, id)) return false;
      sound('home-motion', () => (direction === 'enter' ? playHomepageSliderEnterSound : playHomepageSliderExitSound)(durationSeconds), stopHomepageSliderMotionSounds);
      return true;
    },
    hubAmbience(id) {
      if (!admit('hub-ambience', id)) return false;
      sound('hub-ambience', playJourneyWorldsHubSound, stopJourneyWorldsHubSound);
      return true;
    },
    hubExit(id) {
      if (!admit('hub-exit', id)) return false;
      if (settings()?.gameSoundsEnabled === true) {
        try {
          const session = createJourneyHubExitSoundSession();
          ownedStops.set('hub-exit', session.stop);
          session.play();
        } catch { /* Original cue owner handles audio availability. */ }
      }
      return true;
    },
    stop() { retire(true); },
    releaseToWeb() { retire(false); },
    dispose() { retire(true); },
  };
  if (enabled) activeFeedback = feedback;
  return feedback;
}
