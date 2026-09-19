import { logger } from '../core/logger.js';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';

const SPACESHIP_SOUND_BASE = './assets/sound/Wild and special kockice/spaceship/';

export const SPACESHIP_MERGE6_CUES = Object.freeze([
  { source: `${SPACESHIP_SOUND_BASE}crash.wav`, gain: 0.8, voiceId: 'spaceship-merge6-crash' },
  { source: `${SPACESHIP_SOUND_BASE}crash2.wav`, gain: 0.8, voiceId: 'spaceship-merge6-crash2' },
  { source: `${SPACESHIP_SOUND_BASE}ulazak.wav`, gain: 0.6, voiceId: 'spaceship-merge6-entry' },
] as const);

export const SPACESHIP_FINALE_START_CUES = Object.freeze([
  { source: `${SPACESHIP_SOUND_BASE}abduction.wav`, gain: 1, voiceId: 'spaceship-finale-abduction' },
  { source: `${SPACESHIP_SOUND_BASE}hi pitch beam.wav`, gain: 0.3, voiceId: 'spaceship-finale-hi-pitch-beam' },
] as const);

export const SPACESHIP_BEAM_START_CUES = Object.freeze([
  { source: `${SPACESHIP_SOUND_BASE}sucking.wav`, gain: 0.5, voiceId: 'spaceship-beam-sucking' },
  { source: `${SPACESHIP_SOUND_BASE}materijal.wav`, gain: 0.8, voiceId: 'spaceship-beam-material' },
  { source: `${SPACESHIP_SOUND_BASE}suck beam.wav`, gain: 0.7, voiceId: 'spaceship-beam-quick' },
] as const);

export const SPACESHIP_EXIT_CUE = Object.freeze({
  source: `${SPACESHIP_SOUND_BASE}odlazak.wav`,
  gain: 1,
  voiceId: 'spaceship-finale-exit',
} as const);

const ALL_CUES = Object.freeze([
  ...SPACESHIP_MERGE6_CUES,
  ...SPACESHIP_FINALE_START_CUES,
  ...SPACESHIP_BEAM_START_CUES,
  SPACESHIP_EXIT_CUE,
]);
const FINALE_VOICE_IDS = Object.freeze([
  ...SPACESHIP_FINALE_START_CUES.map(({ voiceId }) => voiceId),
  ...SPACESHIP_BEAM_START_CUES.map(({ voiceId }) => voiceId),
  SPACESHIP_EXIT_CUE.voiceId,
]);
const voices = new Map<string, symbol>();
const media = new Map<string, HTMLAudioElement>();
const preloadedMedia = new Map<string, HTMLAudioElement>();

function enabled(): boolean {
  return typeof window !== 'undefined' && (window as any)._settings?.gameSoundsEnabled === true;
}

export function isSpaceshipMerge6SoundEvent(event: {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}): boolean {
  return event.effectiveSum === 6 && (
    event.srcSpecialDiceVariantId === 'spaceship' ||
    event.dstSpecialDiceVariantId === 'spaceship'
  );
}

function stopVoices(ids: readonly string[]): void {
  stopDecodedGameplayVoices(ids);
  ids.forEach((id) => {
    const audio = media.get(id);
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    media.delete(id);
    voices.delete(id);
  });
}

function playCue(source: string, gain: number, voiceId: string): boolean {
  if (!enabled()) return false;
  stopVoices([voiceId]);
  const token = Symbol(voiceId);
  voices.set(voiceId, token);
  const finish = () => {
    if (voices.get(voiceId) !== token) return;
    voices.delete(voiceId);
    media.delete(voiceId);
  };
  const fallback = () => {
    if (!enabled() || voices.get(voiceId) !== token || typeof Audio !== 'function') {
      finish();
      return false;
    }
    const audio = new Audio(source);
    media.set(voiceId, audio);
    audio.preload = 'auto';
    audio.volume = applySoundEffectsMasterGain(gain);
    audio.playbackRate = 1;
    audio.onended = finish;
    audio.onerror = finish;
    try {
      audio.play()?.catch((error) => {
        finish();
        logger.warn('Spaceship sound playback failed:', error);
      });
      return true;
    } catch {
      finish();
      return false;
    }
  };
  const result = playDecodedGameplaySound(source, {
    voiceId,
    volume: applySoundEffectsMasterGain(gain),
    playbackRate: 1,
    onEnded: finish,
    onStopped: finish,
    onDeferredUnavailable: fallback,
  });
  return result === 'unavailable' ? fallback() : true;
}

function playCueGroup(cues: ReadonlyArray<{ source: string; gain: number; voiceId: string }>): boolean {
  if (!enabled()) return false;
  const results = cues.map(({ source, gain, voiceId }) => playCue(source, gain, voiceId));
  return results.every(Boolean);
}

export function preloadSpaceshipMerge6Sounds(): boolean {
  if (!enabled()) return false;
  const sources = ALL_CUES.map(({ source }) => source);
  if (preloadDecodedGameplaySounds(sources)) return true;
  if (typeof Audio !== 'function') return false;
  return sources.every((source) => {
    if (preloadedMedia.has(source)) return true;
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    preloadedMedia.set(source, audio);
    return true;
  });
}

/** Adds Spaceship-owned layers beside the existing Magnet/Special Merge-6 package. */
export function playSpaceshipMerge6AddonSounds(): boolean {
  return playCueGroup(SPACESHIP_MERGE6_CUES);
}

export function playSpaceshipFinaleStartSounds(): boolean {
  return playCueGroup(SPACESHIP_FINALE_START_CUES);
}

export function playSpaceshipBeamStartSounds(): boolean {
  return playCueGroup(SPACESHIP_BEAM_START_CUES);
}

export function playSpaceshipExitSound(): boolean {
  return playCue(
    SPACESHIP_EXIT_CUE.source,
    SPACESHIP_EXIT_CUE.gain,
    SPACESHIP_EXIT_CUE.voiceId,
  );
}

export function stopSpaceshipFinaleSounds(): void {
  stopVoices(FINALE_VOICE_IDS);
}

export function stopSpaceshipMerge6Sounds(): void {
  stopVoices(ALL_CUES.map(({ voiceId }) => voiceId));
  preloadedMedia.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
  preloadedMedia.clear();
}
