import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

const BASE = './assets/sound/Board transitions/Area 55/';
export const BOARD_TRANSITION_AREA55_BIBICE_SOURCE =
  './assets/sound/Wild and special kockice/robo/bibice.wav';
export const BOARD_TRANSITION_AREA55_ACTION_GAIN = 1;
export const BOARD_TRANSITION_AREA55_BIBICE_ACTION_GAIN = 0.192;

export const BOARD_TRANSITION_AREA55_START_CUES = Object.freeze([
  { source: `${BASE}space.wav`, voiceId: 'board-transition-area55-space', gain: BOARD_TRANSITION_AREA55_ACTION_GAIN },
  { source: `${BASE}djeca.wav`, voiceId: 'board-transition-area55-djeca', gain: BOARD_TRANSITION_AREA55_ACTION_GAIN },
  { source: `${BASE}fly1.wav`, voiceId: 'board-transition-area55-fly1', gain: BOARD_TRANSITION_AREA55_ACTION_GAIN },
  { source: BOARD_TRANSITION_AREA55_BIBICE_SOURCE, voiceId: 'board-transition-area55-bibice', gain: BOARD_TRANSITION_AREA55_BIBICE_ACTION_GAIN },
]);
export const BOARD_TRANSITION_AREA55_BEAM_SOURCE = `${BASE}beams.wav`;
export const BOARD_TRANSITION_AREA55_GUN_BEAM_SOURCE =
  './assets/sound/Wild and special kockice/gun/beam1.wav';
export const BOARD_TRANSITION_AREA55_BEAM_ACTION_GAIN = 0.5;
export const BOARD_TRANSITION_AREA55_BEAM_PREP_SOURCE =
  './assets/sound/Wild and special kockice/gun/prep.wav';
export const BOARD_TRANSITION_AREA55_BEAM_PREP_ACTION_GAIN = 0.15;
export const BOARD_TRANSITION_AREA55_FLY2_SOURCE = `${BASE}fly2.wav`;
export const BOARD_TRANSITION_AREA55_FLY2_DELAY_SECONDS = 3;

const BEAM_VOICE_IDS = Object.freeze([
  'board-transition-area55-beam-1',
  'board-transition-area55-beam-2',
]);
const FLY2_VOICE_ID = 'board-transition-area55-fly2';
const ALL_SOURCES = Object.freeze([
  ...BOARD_TRANSITION_AREA55_START_CUES.map(({ source }) => source),
  BOARD_TRANSITION_AREA55_BEAM_SOURCE,
  BOARD_TRANSITION_AREA55_GUN_BEAM_SOURCE,
  BOARD_TRANSITION_AREA55_BEAM_PREP_SOURCE,
  BOARD_TRANSITION_AREA55_FLY2_SOURCE,
]);

const preparedMedia = new Map<string, HTMLAudioElement>();
const activeMedia = new Map<string, HTMLAudioElement>();
const activeVoiceIds = new Set<string>();
const fly2TimeoutIds = new Map<number, number>();
let nextSequence = 0;
let currentSequence = 0;

function enabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function createMedia(source: string): HTMLAudioElement | null {
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  audio.volume = applySoundEffectsMasterGain(BOARD_TRANSITION_AREA55_ACTION_GAIN);
  try { audio.load(); } catch {}
  return audio;
}

function stopMediaVoice(voiceId: string): void {
  const audio = activeMedia.get(voiceId);
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  try { audio.pause(); audio.currentTime = 0; } catch {}
  activeMedia.delete(voiceId);
  activeVoiceIds.delete(voiceId);
}

function playCue(source: string, voiceId: string, gain = BOARD_TRANSITION_AREA55_ACTION_GAIN): boolean {
  if (!enabled()) return false;
  stopDecodedGameplayVoices([voiceId]);
  stopMediaVoice(voiceId);
  activeVoiceIds.add(voiceId);

  const finish = (): void => {
    activeVoiceIds.delete(voiceId);
    if (activeMedia.has(voiceId)) activeMedia.delete(voiceId);
    if (activeVoiceIds.size === 0 && fly2TimeoutIds.size === 0) currentSequence = 0;
  };

  const fallback = (): boolean => {
    if (!enabled()) { finish(); return false; }
    const audio = preparedMedia.get(source) ?? createMedia(source);
    if (!audio) { finish(); return false; }
    preparedMedia.delete(source);
    activeMedia.set(voiceId, audio);
    const finishMedia = () => {
      if (activeMedia.get(voiceId) === audio) finish();
    };
    audio.volume = applySoundEffectsMasterGain(gain);
    audio.playbackRate = 1;
    audio.currentTime = 0;
    audio.onended = finishMedia;
    audio.onerror = finishMedia;
    try {
      audio.play()?.catch((error) => {
        finishMedia();
        logger.warn('Area 55 Board Transition sound playback failed:', error);
      });
      return true;
    } catch (error) {
      finishMedia();
      logger.warn('Area 55 Board Transition sound playback failed:', error);
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

export function preloadBoardTransitionArea55Sounds(): boolean {
  if (!enabled()) return false;
  if (preloadDecodedGameplaySounds(ALL_SOURCES)) return true;
  const prepared = ALL_SOURCES.map((source) => {
    if (preparedMedia.has(source)) return true;
    const audio = createMedia(source);
    if (!audio) return false;
    preparedMedia.set(source, audio);
    return true;
  });
  return prepared.every(Boolean);
}

export function playBoardTransitionArea55StartSounds(): boolean {
  if (!enabled()) return false;
  const sequence = ++nextSequence;
  currentSequence = sequence;
  const started = BOARD_TRANSITION_AREA55_START_CUES.map(({ source, voiceId, gain }) => (
    playCue(source, `${voiceId}-${sequence}`, gain)
  ));
  const timeoutId = window.setTimeout(() => {
    fly2TimeoutIds.delete(sequence);
    playCue(BOARD_TRANSITION_AREA55_FLY2_SOURCE, `${FLY2_VOICE_ID}-${sequence}`);
  }, BOARD_TRANSITION_AREA55_FLY2_DELAY_SECONDS * 1000);
  fly2TimeoutIds.set(sequence, timeoutId);
  return started.every(Boolean);
}

export function playBoardTransitionArea55BeamSound(beamIndex: 1 | 2): boolean {
  const sequence = currentSequence || ++nextSequence;
  currentSequence = sequence;
  const beamVoiceId = `${BEAM_VOICE_IDS[beamIndex - 1]}-${sequence}`;
  return [
    playCue(
      BOARD_TRANSITION_AREA55_BEAM_SOURCE,
      `${beamVoiceId}-area55`,
      BOARD_TRANSITION_AREA55_BEAM_ACTION_GAIN,
    ),
    playCue(
      BOARD_TRANSITION_AREA55_GUN_BEAM_SOURCE,
      `${beamVoiceId}-gun-beam1`,
      BOARD_TRANSITION_AREA55_BEAM_ACTION_GAIN,
    ),
    playCue(
      BOARD_TRANSITION_AREA55_BEAM_PREP_SOURCE,
      `${beamVoiceId}-gun-prep`,
      BOARD_TRANSITION_AREA55_BEAM_PREP_ACTION_GAIN,
    ),
  ].every(Boolean);
}

export function stopBoardTransitionArea55Sounds(): void {
  fly2TimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  fly2TimeoutIds.clear();
  const voiceIds = [...activeVoiceIds];
  stopDecodedGameplayVoices(voiceIds);
  voiceIds.forEach(stopMediaVoice);
  activeVoiceIds.clear();
  currentSequence = 0;
}

export function resetBoardTransitionArea55SoundsForTests(): void {
  stopBoardTransitionArea55Sounds();
  preparedMedia.forEach((audio) => {
    try { audio.pause(); audio.currentTime = 0; } catch {}
  });
  preparedMedia.clear();
}
