import { createJourneyUnitMotionSoundSession } from './journey-unit-motion-sound.js';
import {
  playJourneyForestAmbientSounds,
  stopJourneyForestAmbientSounds,
} from './journey-forest-ambient-sound.js';
import {
  playJourneyWorldsWorldSound,
  stopJourneyWorldsHubSound,
} from './journey-worlds-hub-sound.js';
import {
  playJourneyCardEntryFlipSounds,
  playJourneyCardManualFlipSound,
  playJourneyCardReturnFlipSounds,
  stopJourneyCardEntryFlipSounds,
} from './journey-card-entry-flip-sound.js';
import {
  playCardTapPlopSound,
  playCtaActivationSounds,
  stopCtaActivationSounds,
} from './cta-activation-sound.js';
import {
  playNavigationCloseSound,
  stopNavigationCloseSound,
} from './navigation-close-sound.js';

export type NativeWorldFeedbackKind =
  | 'world-enter'
  | 'world-exit'
  | 'ambience'
  | 'card-tap'
  | 'card-entry-flip'
  | 'card-manual-flip'
  | 'card-return-flip'
  | 'cta'
  | 'back';
export interface NativeWorldFeedbackEvent {
  id: number;
  routeGeneration: number;
  stateRevision: number;
  worldID: 1 | 2 | 3;
  kind: NativeWorldFeedbackKind;
  boardID?: number;
  durationSeconds?: number;
}
export interface NativeWorldFeedback {
  play(event: NativeWorldFeedbackEvent): boolean;
  stop(): void;
  releaseToWeb(): void;
}
let active: NativeWorldFeedback | undefined;
export function stopNativeWorldFeedback(): void {
  active?.stop();
}
/** Native receipts replace only the geometry admission. The original family
 * owners retain sources, Settings, voices, decode/fallback and contact gain. */
export function createNativeWorldFeedback(): NativeWorldFeedback {
  active?.stop();
  let ended = false;
  const latest = new Map<NativeWorldFeedbackKind, number>();
  const stops = new Set<() => void>();
  let motion:
    | ReturnType<typeof createJourneyUnitMotionSoundSession>
    | undefined;
  const settings = () =>
    (
      window as Window & {
        _settings?: { gameSoundsEnabled?: boolean; hapticsEnabled?: boolean };
      }
    )._settings;
  const sound = (play: () => unknown, stop: () => void) => {
    if (settings()?.gameSoundsEnabled !== true) return;
    stops.add(stop);
    try {
      play();
    } catch {
      /* transport failure does not reject input */
    }
  };
  const haptic = () => {
    if (settings()?.hapticsEnabled === false) return;
    try {
      window.triggerHapticImpact?.('light');
    } catch {
      /* unavailable */
    }
  };
  const retire = (stopVoices: boolean) => {
    if (ended) return;
    ended = true;
    if (active !== feedback) return;
    active = undefined;
    if (stopVoices)
      for (const stop of stops) {
        try {
          stop();
        } catch {
          /* continue independent cleanup */
        }
      }
    stops.clear();
  };
  const feedback: NativeWorldFeedback = {
    play(event) {
      if (
        ended ||
        active !== feedback ||
        document.hidden ||
        !Number.isSafeInteger(event.id) ||
        event.id <= 0 ||
        event.id <= (latest.get(event.kind) ?? 0)
      )
        return false;
      latest.set(event.kind, event.id); // OFF consumes a contact; ON never replays.
      switch (event.kind) {
        case 'world-enter':
        case 'world-exit':
          if (
            typeof event.durationSeconds !== 'number' ||
            !Number.isFinite(event.durationSeconds) ||
            event.durationSeconds <= 0 ||
            event.durationSeconds > 10
          )
            return false;
          if (settings()?.gameSoundsEnabled === true) {
            motion ??= createJourneyUnitMotionSoundSession([
              { id: 'native-visible-unit', nativeVisible: true },
            ]);
            stops.add(motion.stop);
            if (event.kind === 'world-enter')
              motion.playEnter('native-visible-unit', event.durationSeconds);
            else motion.playExit('native-visible-unit', event.durationSeconds);
          }
          break;
        case 'ambience':
          sound(
            () => {
              playJourneyWorldsWorldSound();
              if (event.worldID === 1) playJourneyForestAmbientSounds();
            },
            () => {
              stopJourneyForestAmbientSounds();
              stopJourneyWorldsHubSound();
            },
          );
          break;
        case 'card-tap':
          sound(playCardTapPlopSound, stopCtaActivationSounds);
          haptic();
          break;
        case 'card-entry-flip':
          sound(playJourneyCardEntryFlipSounds, stopJourneyCardEntryFlipSounds);
          break;
        case 'card-manual-flip':
          sound(playJourneyCardManualFlipSound, stopJourneyCardEntryFlipSounds);
          haptic();
          break;
        case 'card-return-flip':
          sound(
            playJourneyCardReturnFlipSounds,
            stopJourneyCardEntryFlipSounds,
          );
          break;
        case 'cta':
          sound(playCtaActivationSounds, stopCtaActivationSounds);
          haptic();
          break;
        case 'back':
          sound(playNavigationCloseSound, stopNavigationCloseSound);
          haptic();
          break;
        default:
          return false;
      }
      return true;
    },
    stop() {
      retire(true);
    },
    releaseToWeb() {
      retire(false);
    },
  };
  active = feedback;
  return feedback;
}
