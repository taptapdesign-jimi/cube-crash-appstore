import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  fadeOutDecodedGameplayVoice,
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const ARCADE_STAGE_CLEAR_VICTORY_SOUND_SOURCE =
  './assets/sound/Clean board/happy victory sax .wav';
export const ARCADE_STAGE_CLEAR_APPLAUSE_SOUND_SOURCE =
  './assets/sound/Clean board/applause.wav';
export const ARCADE_STAGE_CLEAR_THUMB_WHOOSH_SOUND_SOURCE =
  './assets/sound/cjelina flip/flip soft.wav';
export const ARCADE_STAGE_CLEAR_VICTORY_ACTION_VOLUME = 0.76;
export const ARCADE_STAGE_CLEAR_APPLAUSE_ACTION_VOLUME = 0.6;
export const ARCADE_STAGE_CLEAR_THUMB_WHOOSH_ACTION_VOLUME = 1;
export const ARCADE_STAGE_CLEAR_NN_EXIT_FADE_SECONDS = 0.24;
export const ARCADE_STAGE_CLEAR_VICTORY_VOLUME = applySoundEffectsMasterGain(
  ARCADE_STAGE_CLEAR_VICTORY_ACTION_VOLUME,
);
export const ARCADE_STAGE_CLEAR_APPLAUSE_VOLUME = applySoundEffectsMasterGain(
  ARCADE_STAGE_CLEAR_APPLAUSE_ACTION_VOLUME,
);
export const ARCADE_STAGE_CLEAR_THUMB_WHOOSH_VOLUME = applySoundEffectsMasterGain(
  ARCADE_STAGE_CLEAR_THUMB_WHOOSH_ACTION_VOLUME,
);

const VICTORY_VOICE_ID = 'arcade-stage-clear-victory';
const APPLAUSE_VOICE_ID = 'arcade-stage-clear-applause';
const THUMB_WHOOSH_VOICE_ID = 'arcade-stage-clear-thumb-whoosh';
const CELEBRATION_VOICE_IDS = [VICTORY_VOICE_ID, APPLAUSE_VOICE_ID] as const;
const VOICE_IDS = [VICTORY_VOICE_ID, APPLAUSE_VOICE_ID, THUMB_WHOOSH_VOICE_ID] as const;
const mediaAudioByVoiceId = new Map<string, HTMLAudioElement>();
const activeMediaVoices = new Set<string>();
const mediaFadeFrames = new Map<string, number>();

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudio(source: string, voiceId: string): HTMLAudioElement | null {
  const cached = mediaAudioByVoiceId.get(voiceId);
  if (cached) return cached;
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  mediaAudioByVoiceId.set(voiceId, audio);
  return audio;
}

function stopMediaVoice(voiceId: string): void {
  activeMediaVoices.delete(voiceId);
  const frame = mediaFadeFrames.get(voiceId);
  if (frame !== undefined) cancelAnimationFrame(frame);
  mediaFadeFrames.delete(voiceId);
  const audio = mediaAudioByVoiceId.get(voiceId);
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {}
}

function fadeOutMediaVoice(voiceId: string): void {
  if (!activeMediaVoices.has(voiceId)) return;
  const audio = mediaAudioByVoiceId.get(voiceId);
  if (!audio) return;
  const oldFrame = mediaFadeFrames.get(voiceId);
  if (oldFrame !== undefined) cancelAnimationFrame(oldFrame);
  mediaFadeFrames.delete(voiceId);
  const startingVolume = audio.volume;
  const startedAt = performance.now();
  const fade = (now: number) => {
    if (mediaAudioByVoiceId.get(voiceId) !== audio) return;
    const progress = Math.min(1, (now - startedAt) / (ARCADE_STAGE_CLEAR_NN_EXIT_FADE_SECONDS * 1000));
    audio.volume = startingVolume * (1 - progress);
    if (progress >= 1) {
      stopMediaVoice(voiceId);
      return;
    }
    mediaFadeFrames.set(voiceId, requestAnimationFrame(fade));
  };
  mediaFadeFrames.set(voiceId, requestAnimationFrame(fade));
}

export function preloadArcadeStageClearSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  const sources = [
    ARCADE_STAGE_CLEAR_VICTORY_SOUND_SOURCE,
    ARCADE_STAGE_CLEAR_APPLAUSE_SOUND_SOURCE,
    ARCADE_STAGE_CLEAR_THUMB_WHOOSH_SOUND_SOURCE,
  ];
  return preloadDecodedGameplaySounds(sources)
    || sources.every((source, index) => getMediaAudio(source, VOICE_IDS[index]) !== null);
}

function playMediaSound(source: string, voiceId: string, volume: number): boolean {
  if (!areSoundsEnabled()) return false;
  const audio = getMediaAudio(source, voiceId);
  if (!audio) return false;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play()?.catch((error) => logger.warn(`Failed to play Arcade stage-clear sound ${source}:`, error));
    activeMediaVoices.add(voiceId);
    return true;
  } catch (error) {
    logger.warn(`Failed to start Arcade stage-clear sound ${source}:`, error);
    return false;
  }
}

function playStageClearSound(source: string, voiceId: string, volume: number): boolean {
  if (!areSoundsEnabled()) return false;
  stopDecodedGameplayVoices([voiceId]);
  stopMediaVoice(voiceId);
  const decodedState = getDecodedGameplaySoundsState([source]);
  if (decodedState !== 'unavailable') {
    const result = playDecodedGameplaySound(source, {
      voiceId,
      volume,
      onDeferredUnavailable: () => playMediaSound(source, voiceId, volume),
    });
    if (result !== 'unavailable') return true;
  }
  return playMediaSound(source, voiceId, volume);
}

export function playArcadeStageClearVictorySound(): boolean {
  return playStageClearSound(
    ARCADE_STAGE_CLEAR_VICTORY_SOUND_SOURCE,
    VICTORY_VOICE_ID,
    ARCADE_STAGE_CLEAR_VICTORY_VOLUME,
  );
}

export function playArcadeStageClearApplauseSound(): boolean {
  return playStageClearSound(
    ARCADE_STAGE_CLEAR_APPLAUSE_SOUND_SOURCE,
    APPLAUSE_VOICE_ID,
    ARCADE_STAGE_CLEAR_APPLAUSE_VOLUME,
  );
}

export function playArcadeStageClearCelebrationSounds(): boolean {
  const victory = playArcadeStageClearVictorySound();
  const applause = playArcadeStageClearApplauseSound();
  return victory && applause;
}

export function fadeOutArcadeStageClearCelebrationSounds(): void {
  CELEBRATION_VOICE_IDS.forEach((voiceId) => {
    if (!fadeOutDecodedGameplayVoice(voiceId, ARCADE_STAGE_CLEAR_NN_EXIT_FADE_SECONDS)) {
      stopDecodedGameplayVoices([voiceId]);
    }
    fadeOutMediaVoice(voiceId);
  });
}

export function playArcadeStageClearThumbWhooshSound(): boolean {
  return playStageClearSound(
    ARCADE_STAGE_CLEAR_THUMB_WHOOSH_SOUND_SOURCE,
    THUMB_WHOOSH_VOICE_ID,
    ARCADE_STAGE_CLEAR_THUMB_WHOOSH_VOLUME,
  );
}

export function stopArcadeStageClearSounds(): void {
  stopDecodedGameplayVoices(VOICE_IDS);
  VOICE_IDS.forEach(stopMediaVoice);
}

export function resetArcadeStageClearSoundsForTests(): void {
  stopArcadeStageClearSounds();
  mediaAudioByVoiceId.clear();
  activeMediaVoices.clear();
}
