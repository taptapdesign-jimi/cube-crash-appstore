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
export const FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE =
  './assets/sound/fail board/six fail.wav';
export const FAIL_SCREEN_SAXOPHONE_ACTION_VOLUME = 0.9;
export const FAIL_SCREEN_SAXOPHONE_DURATION_MS = 3000;
export const FAIL_SCREEN_SAXOPHONE_VOLUME = applySoundEffectsMasterGain(
  FAIL_SCREEN_SAXOPHONE_ACTION_VOLUME,
);

const FAIL_SCREEN_CTA_VOICE_IDS = [
  'fail-screen-cta-bounce-primary',
  'fail-screen-cta-bounce-secondary',
] as const;
const FAIL_SCREEN_SAXOPHONE_VOICE_ID = 'fail-screen-saxophone';
const mediaAudioByVoiceId = new Map<string, {
  source: string;
  audio: HTMLAudioElement;
  onStopped?: () => void;
}>();

export interface FailScreenSoundLifecycle {
  onStarted?: () => void;
  onEnded?: () => void;
  onStopped?: () => void;
  onUnavailable?: () => void;
}

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined' && (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudio(source: string, voiceId: string): HTMLAudioElement | null {
  const existing = mediaAudioByVoiceId.get(voiceId);
  if (existing?.source === source) return existing.audio;
  if (existing) {
    try {
      existing.audio.pause();
      existing.audio.currentTime = 0;
    } catch {}
  }
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  mediaAudioByVoiceId.set(voiceId, { source, audio });
  return audio;
}

export function preloadFailScreenSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  const sources = [
    FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE,
    FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE,
    FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE,
  ] as const;
  const voiceIds = [
    ...FAIL_SCREEN_CTA_VOICE_IDS,
    FAIL_SCREEN_SAXOPHONE_VOICE_ID,
  ] as const;
  return preloadDecodedGameplaySounds(sources)
    || sources.every((source, index) => getMediaAudio(source, voiceIds[index]) !== null);
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
  const audio = getMediaAudio(FAIL_SCREEN_CTA_BOUNCE_SOUND_SOURCE, voiceId);
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

export function playFailScreenSaxophoneSound(
  lifecycle: FailScreenSoundLifecycle = {},
): boolean {
  if (!areSoundsEnabled()) {
    lifecycle.onUnavailable?.();
    return false;
  }
  const voiceId = FAIL_SCREEN_SAXOPHONE_VOICE_ID;
  stopDecodedGameplayVoices([voiceId]);
  const decodedState = getDecodedGameplaySoundsState([FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE]);
  if (decodedState !== 'unavailable') {
    const decodedResult = playDecodedGameplaySound(FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE, {
      voiceId,
      volume: FAIL_SCREEN_SAXOPHONE_VOLUME,
      onStarted: lifecycle.onStarted,
      onEnded: lifecycle.onEnded,
      onStopped: lifecycle.onStopped,
      onDeferredUnavailable: () => {
        playFailScreenSaxophoneMediaFallback(lifecycle);
      },
    });
    if (decodedResult !== 'unavailable') return true;
  }
  return playFailScreenSaxophoneMediaFallback(lifecycle);
}

function playFailScreenSaxophoneMediaFallback(
  lifecycle: FailScreenSoundLifecycle,
): boolean {
  const audio = getMediaAudio(
    FAIL_SCREEN_SAXOPHONE_SOUND_SOURCE,
    FAIL_SCREEN_SAXOPHONE_VOICE_ID,
  );
  if (!audio) {
    lifecycle.onUnavailable?.();
    return false;
  }
  try {
    const entry = mediaAudioByVoiceId.get(FAIL_SCREEN_SAXOPHONE_VOICE_ID);
    if (entry) entry.onStopped = lifecycle.onStopped;
    audio.pause();
    audio.volume = FAIL_SCREEN_SAXOPHONE_VOLUME;
    audio.currentTime = 0;
    audio.onended = () => {
      const activeEntry = mediaAudioByVoiceId.get(FAIL_SCREEN_SAXOPHONE_VOICE_ID);
      if (activeEntry?.audio === audio) activeEntry.onStopped = undefined;
      lifecycle.onEnded?.();
    };
    const playResult = audio.play();
    if (playResult && typeof playResult.then === 'function') {
      void playResult.then(() => lifecycle.onStarted?.()).catch((error) => {
        audio.onended = null;
        const activeEntry = mediaAudioByVoiceId.get(FAIL_SCREEN_SAXOPHONE_VOICE_ID);
        if (activeEntry?.audio === audio) activeEntry.onStopped = undefined;
        logger.warn('Failed to play Fail Screen saxophone:', error);
        lifecycle.onUnavailable?.();
      });
    } else {
      lifecycle.onStarted?.();
    }
    return true;
  } catch (error) {
    audio.onended = null;
    const activeEntry = mediaAudioByVoiceId.get(FAIL_SCREEN_SAXOPHONE_VOICE_ID);
    if (activeEntry?.audio === audio) activeEntry.onStopped = undefined;
    logger.warn('Failed to start Fail Screen saxophone:', error);
    lifecycle.onUnavailable?.();
    return false;
  }
}

function stopMediaAudioVoices(voiceIds: readonly string[]): void {
  voiceIds.forEach((voiceId) => {
    const entry = mediaAudioByVoiceId.get(voiceId);
    const audio = entry?.audio;
    if (!audio) return;
    const onStopped = entry.onStopped;
    entry.onStopped = undefined;
    try { audio.onended = null; audio.pause(); audio.currentTime = 0; } catch {}
    onStopped?.();
  });
}

export function stopFailScreenCtaBounceSounds(): void {
  stopDecodedGameplayVoices(FAIL_SCREEN_CTA_VOICE_IDS);
  stopMediaAudioVoices(FAIL_SCREEN_CTA_VOICE_IDS);
}

export function stopFailScreenSounds(): void {
  stopFailScreenCtaBounceSounds();
  stopDecodedGameplayVoices([FAIL_SCREEN_SAXOPHONE_VOICE_ID]);
  stopMediaAudioVoices([FAIL_SCREEN_SAXOPHONE_VOICE_ID]);
}

export function resetFailScreenSoundsForTests(): void {
  stopFailScreenSounds();
  mediaAudioByVoiceId.clear();
}
