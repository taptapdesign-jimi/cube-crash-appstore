import {
  acquireCriticalGameplayAudioWindow,
  acquireDecodedGameplayAudioPackage,
  releaseUnprotectedIdleDecodedGameplayAudio,
  type DecodedGameplayAudioPackageLease,
} from './gameplay-audio-buffer-player.ts';
import { CTA_ACTIVATION_SOUND_SOURCES } from './cta-activation-sound.ts';
import { JOURNEY_BACKPACK_SOUND_SOURCES } from './journey-backpack-sound.ts';
import { JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES } from './journey-card-entry-flip-sound.ts';
import { JOURNEY_HUB_EXIT_SOUND_SOURCES } from './journey-hub-exit-sound.ts';
import { JOURNEY_UNIT_MOTION_SOUND_SOURCES } from './journey-unit-motion-sound.ts';
import { NAVIGATION_CLOSE_SOUND_SOURCES } from './navigation-close-sound.ts';
import { NAVIGATION_ICON_SOUND_SOURCES } from './navigation-icon-sound.ts';
import { releaseActiveSpecialAudioResidency } from './special-sound-warmup.ts';

/** The exact short cues needed for Hub/World entry, exit, terminal return and
 * card interaction. Long Journey ambience and one-off reward finales retain
 * their existing independent lifecycle owners. */
export const JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES = Object.freeze([
  ...new Set([
    ...CTA_ACTIVATION_SOUND_SOURCES,
    ...NAVIGATION_CLOSE_SOUND_SOURCES,
    ...NAVIGATION_ICON_SOUND_SOURCES,
    ...JOURNEY_BACKPACK_SOUND_SOURCES,
    ...JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES,
    ...JOURNEY_HUB_EXIT_SOUND_SOURCES,
    ...JOURNEY_UNIT_MOTION_SOUND_SOURCES,
  ]),
]);

// The current 15 unique 48 kHz stereo PCM sources decode to about 3.47 MiB.
// Four MiB is a conservative complete-package ceiling without taking a large
// share of the ordinary 28 MiB mobile effects cache.
export const JOURNEY_CRITICAL_AUDIO_WORKING_SET_MAX_BYTES = 4 * 1024 * 1024;

const JOURNEY_CRITICAL_AUDIO_PACKAGE = {
  id: 'journey-critical-navigation',
  sources: JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES,
  maxDecodedBytes: JOURNEY_CRITICAL_AUDIO_WORKING_SET_MAX_BYTES,
  replaceIdleWorkingSet: true,
} as const;

const activeCriticalWorkingSetReleases = new Set<() => void>();
let journeyCorePackageLease: DecodedGameplayAudioPackageLease | null = null;

function areGameSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

/**
 * Acquire one critical Journey transition's decoded-audio boundary.
 *
 * The owner first suspends new speculative work, removes only unrelated idle
 * decoded data, then leases the small incoming route package. Resident package
 * members cannot be evicted or re-decoded while the transition is visible;
 * missing members remain queued rather than decoding against animation frames.
 * Active/pending voices, the current Special family and a retained long loop
 * are protected by the shared engine throughout the sweep.
 */
export function acquireJourneyCriticalAudioWorkingSet(): () => void {
  if (!areGameSoundsEnabled()) return () => {};
  const releaseCriticalWindow = acquireCriticalGameplayAudioWindow();
  releaseActiveSpecialAudioResidency();
  if (!journeyCorePackageLease?.isCurrent()) {
    journeyCorePackageLease?.release();
    journeyCorePackageLease = null;
    releaseUnprotectedIdleDecodedGameplayAudio(
      JOURNEY_CRITICAL_AUDIO_WORKING_SET_SOURCES,
      JOURNEY_CRITICAL_AUDIO_WORKING_SET_MAX_BYTES,
    );
    const nextCoreLease = acquireDecodedGameplayAudioPackage(
      'journey-core-navigation',
      JOURNEY_CRITICAL_AUDIO_PACKAGE,
    );
    if (nextCoreLease.admitted) journeyCorePackageLease = nextCoreLease;
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeCriticalWorkingSetReleases.delete(release);
    releaseCriticalWindow();
  };
  activeCriticalWorkingSetReleases.add(release);
  return release;
}

/** Journey mount/route owner calls this only when leaving Journey entirely.
 * Hub <-> World transitions deliberately keep the core package resident. */
export function releaseJourneyCoreAudioWorkingSet(): void {
  journeyCorePackageLease?.release();
  journeyCorePackageLease = null;
}

export function stopJourneyCriticalAudioWorkingSets(): void {
  Array.from(activeCriticalWorkingSetReleases).forEach((release) => release());
  releaseJourneyCoreAudioWorkingSet();
}

export function resetJourneyCriticalAudioWorkingSetForTests(): void {
  stopJourneyCriticalAudioWorkingSets();
}
