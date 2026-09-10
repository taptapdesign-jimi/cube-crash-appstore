import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const ARCADE_ROUND_FIRST_DIGIT_SOUND_SOURCE =
  './assets/sound/NN tranzicije/bum bum zvuk.wav';
export const ARCADE_ROUND_SECOND_DIGIT_SOUND_SOURCE =
  './assets/sound/NN tranzicije/bum bum 2.wav';
export const ARCADE_ROUND_EXIT_SOUND_SOURCE =
  './assets/sound/NN tranzicije/exit.wav';
export const ARCADE_ROUND_DIGIT_SOUND_PLAYBACK_RATE = 1;
export const ARCADE_ROUND_DIGIT_SOUND_BASE_VOLUME = 0.7;
export const ARCADE_ROUND_DIGIT_SOUND_VOLUME = applySoundEffectsMasterGain(
  ARCADE_ROUND_DIGIT_SOUND_BASE_VOLUME,
);

export const ARCADE_ROUND_DIGIT_SOUND_SOURCES = Object.freeze([
  ARCADE_ROUND_FIRST_DIGIT_SOUND_SOURCE,
  ARCADE_ROUND_SECOND_DIGIT_SOUND_SOURCE,
  ARCADE_ROUND_EXIT_SOUND_SOURCE,
] as const);

const ARCADE_ROUND_DIGIT_VOICE_IDS = Object.freeze([
  'arcade-round-first-digit',
  'arcade-round-second-digit',
  'arcade-round-exit',
] as const);
const BOARD_TRANSITION_DIGIT_VOICE_IDS = Object.freeze([
  'board-transition-first-digit',
  'board-transition-second-digit',
  'board-transition-exit',
] as const);
type RoundNumberVoiceIds = typeof ARCADE_ROUND_DIGIT_VOICE_IDS | typeof BOARD_TRANSITION_DIGIT_VOICE_IDS;
const mediaAudioByVoiceId = new Map<string, HTMLAudioElement>();

export function areArcadeRoundDigitSoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudio(source: string, voiceId: string): HTMLAudioElement | null {
  const existing = mediaAudioByVoiceId.get(voiceId);
  if (existing) return existing;
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  mediaAudioByVoiceId.set(voiceId, audio);
  return audio;
}

function preloadRoundNumberSounds(voiceIds: RoundNumberVoiceIds): boolean {
  if (!areArcadeRoundDigitSoundsEnabled()) return false;
  return preloadDecodedGameplaySounds(ARCADE_ROUND_DIGIT_SOUND_SOURCES) ||
    ARCADE_ROUND_DIGIT_SOUND_SOURCES.every(
      (source, index) => getMediaAudio(source, voiceIds[index]) !== null,
    );
}

export function preloadArcadeRoundDigitSounds(): boolean {
  return preloadRoundNumberSounds(ARCADE_ROUND_DIGIT_VOICE_IDS);
}

export function preloadBoardTransitionDigitSounds(): boolean {
  return preloadRoundNumberSounds(BOARD_TRANSITION_DIGIT_VOICE_IDS);
}

function playRoundNumberSound(
  sourceIndex: number,
  label: string,
  voiceIds: RoundNumberVoiceIds,
): boolean {
  if (!areArcadeRoundDigitSoundsEnabled()) return false;
  const source = ARCADE_ROUND_DIGIT_SOUND_SOURCES[sourceIndex];
  const voiceId = voiceIds[sourceIndex];
  if (!source || !voiceId) return false;

  const decodedState = getDecodedGameplaySoundsState(ARCADE_ROUND_DIGIT_SOUND_SOURCES);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(source, {
      voiceId,
      volume: ARCADE_ROUND_DIGIT_SOUND_VOLUME,
      playbackRate: ARCADE_ROUND_DIGIT_SOUND_PLAYBACK_RATE,
    }) !== 'unavailable';
  }

  const audio = getMediaAudio(source, voiceId);
  if (!audio) return false;
  try {
    audio.pause();
    audio.defaultPlaybackRate = ARCADE_ROUND_DIGIT_SOUND_PLAYBACK_RATE;
    audio.playbackRate = ARCADE_ROUND_DIGIT_SOUND_PLAYBACK_RATE;
    audio.volume = ARCADE_ROUND_DIGIT_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.play()?.catch((error) => {
      logger.warn(`Failed to play ${label} sound:`, error);
    });
    return true;
  } catch (error) {
    logger.warn(`Failed to start ${label} sound:`, error);
    return false;
  }
}

export function playArcadeRoundDigitSound(digitIndex: number): boolean {
  if (digitIndex < 0 || digitIndex > 1) return false;
  return playRoundNumberSound(
    digitIndex,
    `Arcade Round digit ${digitIndex + 1}`,
    ARCADE_ROUND_DIGIT_VOICE_IDS,
  );
}

export function playArcadeRoundExitSound(): boolean {
  return playRoundNumberSound(2, 'Arcade Round exit', ARCADE_ROUND_DIGIT_VOICE_IDS);
}

export function playBoardTransitionDigitSound(digitIndex: number): boolean {
  if (digitIndex < 0 || digitIndex > 1) return false;
  return playRoundNumberSound(
    digitIndex,
    `Board Transition digit ${digitIndex + 1}`,
    BOARD_TRANSITION_DIGIT_VOICE_IDS,
  );
}

export function playBoardTransitionExitSound(): boolean {
  return playRoundNumberSound(2, 'Board Transition exit', BOARD_TRANSITION_DIGIT_VOICE_IDS);
}

function stopRoundNumberSounds(voiceIds: RoundNumberVoiceIds): void {
  stopDecodedGameplayVoices(voiceIds);
  voiceIds.forEach((voiceId) => {
    const audio = mediaAudioByVoiceId.get(voiceId);
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function stopArcadeRoundDigitSounds(): void {
  stopRoundNumberSounds(ARCADE_ROUND_DIGIT_VOICE_IDS);
}

export function stopBoardTransitionDigitSounds(): void {
  stopRoundNumberSounds(BOARD_TRANSITION_DIGIT_VOICE_IDS);
}

export function resetArcadeRoundDigitSoundCacheForTests(): void {
  stopArcadeRoundDigitSounds();
  stopBoardTransitionDigitSounds();
  mediaAudioByVoiceId.clear();
}
