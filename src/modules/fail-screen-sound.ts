import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE = './assets/sound/magnet pul lforce/pull1.wav';
export const FAIL_SCREEN_CTA_BOUNCE_SOUND_VOLUME = applySoundEffectsMasterGain(1);

const FAIL_SCREEN_CTA_VOICE_IDS = [
  'fail-screen-cta-bounce-primary',
  'fail-screen-cta-bounce-secondary',
] as const;
const mediaAudioByVoiceId = new Map<string, HTMLAudioElement>();

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined' && (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudio(voiceId: string): HTMLAudioElement | null {
  const existing = mediaAudioByVoiceId.get(voiceId);
  if (existing) return existing;
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  mediaAudioByVoiceId.set(voiceId, audio);
  return audio;
}

export function preloadFailScreenSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds([FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE])
    || FAIL_SCREEN_CTA_VOICE_IDS.every((voiceId) => getMediaAudio(voiceId) !== null);
}

export function playFailScreenCtaBounceSound(ctaIndex: 0 | 1): boolean {
  if (!areSoundsEnabled()) return false;
  const voiceId = FAIL_SCREEN_CTA_VOICE_IDS[ctaIndex];
  stopDecodedGameplayVoices([voiceId]);
  const decodedState = getDecodedGameplaySoundsState([FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE, {
      voiceId,
      volume: FAIL_SCREEN_CTA_BOUNCE_SOUND_VOLUME,
    }) !== 'unavailable';
  }
  const audio = getMediaAudio(voiceId);
  if (!audio) return false;
  try {
    audio.pause();
    audio.volume = FAIL_SCREEN_CTA_BOUNCE_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.play()?.catch((error) => logger.warn('Failed to play Fail Screen CTA bounce:', error));
    return true;
  } catch (error) {
    logger.warn('Failed to start Fail Screen CTA bounce:', error);
    return false;
  }
}

export function stopFailScreenSounds(): void {
  stopDecodedGameplayVoices(FAIL_SCREEN_CTA_VOICE_IDS);
  mediaAudioByVoiceId.forEach((audio) => {
    try { audio.pause(); audio.currentTime = 0; } catch {}
  });
}

export function resetFailScreenSoundsForTests(): void {
  stopFailScreenSounds();
  mediaAudioByVoiceId.clear();
}
