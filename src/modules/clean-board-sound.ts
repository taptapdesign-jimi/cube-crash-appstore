import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

const CLEAN_BOARD_SOUND_BASE = './assets/sound/Clean board/';

export const CLEAN_BOARD_APPLAUSE_SOUND_SOURCE = `${CLEAN_BOARD_SOUND_BASE}applause.wav`;
export const CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE = `${CLEAN_BOARD_SOUND_BASE}saxophone happy.wav`;
export const CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE = `${CLEAN_BOARD_SOUND_BASE}money count.wav`;
export const CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE = `${CLEAN_BOARD_SOUND_BASE}fastpointsstack.wav`;
export const CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE = `${CLEAN_BOARD_SOUND_BASE}boinb.wav`;
export const CLEAN_BOARD_STAR_HARP_SOUND_SOURCES = [
  `${CLEAN_BOARD_SOUND_BASE}harp1.wav`,
  `${CLEAN_BOARD_SOUND_BASE}harp2.wav`,
  `${CLEAN_BOARD_SOUND_BASE}harp3.wav`,
] as const;
export const CLEAN_BOARD_CTA_BOUNCE_SOUND_SOURCE = './assets/sound/magnet pul lforce/pull1.wav';
export const CLEAN_BOARD_SOUND_VOLUME = applySoundEffectsMasterGain(1);
export const CLEAN_BOARD_APPLAUSE_ACTION_VOLUME = 0.8;
export const CLEAN_BOARD_APPLAUSE_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_APPLAUSE_ACTION_VOLUME,
);
export const CLEAN_BOARD_SAXOPHONE_HAPPY_ACTION_VOLUME = 0.9;
export const CLEAN_BOARD_SAXOPHONE_HAPPY_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_SAXOPHONE_HAPPY_ACTION_VOLUME,
);
export const CLEAN_BOARD_MONEY_COUNT_ACTION_VOLUME = 0.8;
export const CLEAN_BOARD_MONEY_COUNT_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_MONEY_COUNT_ACTION_VOLUME,
);
export const CLEAN_BOARD_FAST_POINTS_STACK_ACTION_VOLUME = 0.9;
export const CLEAN_BOARD_FAST_POINTS_STACK_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_FAST_POINTS_STACK_ACTION_VOLUME,
);
export const CLEAN_BOARD_STAR_HARP_ACTION_VOLUME = 0.5;
export const CLEAN_BOARD_STAR_HARP_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_STAR_HARP_ACTION_VOLUME,
);

const CLEAN_BOARD_VOICE_IDS = [
  'clean-board-crowd',
  'clean-board-money-count',
  'clean-board-bonus-count',
  'clean-board-star-bounce-1',
  'clean-board-star-bounce-2',
  'clean-board-star-bounce-3',
  'clean-board-star-harp-1',
  'clean-board-star-harp-2',
  'clean-board-star-harp-3',
  'clean-board-cta-bounce-primary',
  'clean-board-cta-bounce-secondary',
  'clean-board-saxophone-happy',
  'clean-board-fast-points-main-count',
  'clean-board-fast-points-bonus-count',
] as const;
const mediaAudioByVoiceId = new Map<string, { source: string; audio: HTMLAudioElement }>();
const mediaFadeTimeouts = new Map<string, number>();
const mediaFadeFrames = new Map<string, number>();
let previousHarpOrder = '';
const CLEAN_BOARD_COUNTER_FADE_SECONDS = 0.12;

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudio(source: string, voiceId: string): HTMLAudioElement | null {
  const existing = mediaAudioByVoiceId.get(voiceId);
  if (existing?.source === source) return existing.audio;
  if (existing) stopMediaVoice(voiceId);
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  mediaAudioByVoiceId.set(voiceId, { source, audio });
  return audio;
}

function stopMediaVoice(voiceId: string): void {
  const timeout = mediaFadeTimeouts.get(voiceId);
  if (timeout !== undefined) window.clearTimeout(timeout);
  mediaFadeTimeouts.delete(voiceId);
  const frame = mediaFadeFrames.get(voiceId);
  if (frame !== undefined) cancelAnimationFrame(frame);
  mediaFadeFrames.delete(voiceId);
  const entry = mediaAudioByVoiceId.get(voiceId);
  if (!entry) return;
  try {
    entry.audio.pause();
    entry.audio.currentTime = 0;
  } catch {}
}

function scheduleMediaFadeOut(
  audio: HTMLAudioElement,
  voiceId: string,
  stopAfterSeconds: number,
  volume: number,
): void {
  const fadeSeconds = Math.min(CLEAN_BOARD_COUNTER_FADE_SECONDS, stopAfterSeconds);
  const fadeStartMs = Math.max(0, (stopAfterSeconds - fadeSeconds) * 1000);
  const timeout = window.setTimeout(() => {
    mediaFadeTimeouts.delete(voiceId);
    const startedAt = performance.now();
    const fade = (now: number) => {
      if (mediaAudioByVoiceId.get(voiceId)?.audio !== audio) return;
      const progress = Math.min(1, (now - startedAt) / (fadeSeconds * 1000 || 1));
      audio.volume = volume * (1 - progress);
      if (progress >= 1) {
        mediaFadeFrames.delete(voiceId);
        stopMediaVoice(voiceId);
        return;
      }
      mediaFadeFrames.set(voiceId, requestAnimationFrame(fade));
    };
    mediaFadeFrames.set(voiceId, requestAnimationFrame(fade));
  }, fadeStartMs);
  mediaFadeTimeouts.set(voiceId, timeout);
}

function playCleanBoardSound(
  source: string,
  voiceId: string,
  stopAfterSeconds?: number,
  volume = CLEAN_BOARD_SOUND_VOLUME,
): boolean {
  if (!areSoundsEnabled()) return false;
  stopDecodedGameplayVoices([voiceId]);
  stopMediaVoice(voiceId);
  const decodedState = getDecodedGameplaySoundsState([source]);
  if (decodedState !== 'unavailable') {
    return playDecodedGameplaySound(source, {
      voiceId,
      volume,
      stopAfterSeconds,
      fadeOutSeconds: stopAfterSeconds === undefined ? undefined : CLEAN_BOARD_COUNTER_FADE_SECONDS,
    }) !== 'unavailable';
  }
  const audio = getMediaAudio(source, voiceId);
  if (!audio) return false;
  try {
    audio.pause();
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play()?.catch(error => logger.warn(`Failed to play Clean Board sound ${source}:`, error));
    if (stopAfterSeconds !== undefined) scheduleMediaFadeOut(audio, voiceId, stopAfterSeconds, volume);
    return true;
  } catch (error) {
    logger.warn(`Failed to start Clean Board sound ${source}:`, error);
    return false;
  }
}

export function createCleanBoardStarHarpOrder(random: () => number = Math.random): typeof CLEAN_BOARD_STAR_HARP_SOUND_SOURCES {
  const sources = [...CLEAN_BOARD_STAR_HARP_SOUND_SOURCES];
  for (let index = sources.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.max(0, Math.min(index, Math.floor(random() * (index + 1))));
    [sources[index], sources[swapIndex]] = [sources[swapIndex], sources[index]];
  }
  if (sources.join('|') === previousHarpOrder) sources.push(sources.shift()!);
  previousHarpOrder = sources.join('|');
  return sources as unknown as typeof CLEAN_BOARD_STAR_HARP_SOUND_SOURCES;
}

export function preloadCleanBoardSounds(): boolean {
  if (!areSoundsEnabled()) return false;
  const sources = [
    CLEAN_BOARD_APPLAUSE_SOUND_SOURCE,
    CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE,
    CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE,
    CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE,
    CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE,
    ...CLEAN_BOARD_STAR_HARP_SOUND_SOURCES,
    CLEAN_BOARD_CTA_BOUNCE_SOUND_SOURCE,
  ];
  return preloadDecodedGameplaySounds(sources)
    || sources.every((source, index) => getMediaAudio(source, `clean-board-preload-${index}`) !== null);
}

export function playCleanBoardApplauseSound(): boolean {
  return playCleanBoardSound(
    CLEAN_BOARD_APPLAUSE_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[0],
    undefined,
    CLEAN_BOARD_APPLAUSE_VOLUME,
  );
}

export function playCleanBoardSaxophoneHappySound(): boolean {
  return playCleanBoardSound(
    CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[11],
    undefined,
    CLEAN_BOARD_SAXOPHONE_HAPPY_VOLUME,
  );
}

export function playCleanBoardMoneyCountSound(countDurationSeconds?: number): boolean {
  const moneyStarted = playCleanBoardSound(
    CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[1],
    countDurationSeconds,
    CLEAN_BOARD_MONEY_COUNT_VOLUME,
  );
  const fastPointsStarted = playCleanBoardSound(
    CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[12],
    countDurationSeconds,
    CLEAN_BOARD_FAST_POINTS_STACK_VOLUME,
  );
  return moneyStarted && fastPointsStarted;
}

export function playCleanBoardBonusCountSound(countDurationSeconds?: number): boolean {
  const moneyStarted = playCleanBoardSound(
    CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[2],
    countDurationSeconds,
    CLEAN_BOARD_MONEY_COUNT_VOLUME,
  );
  const fastPointsStarted = playCleanBoardSound(
    CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[13],
    countDurationSeconds,
    CLEAN_BOARD_FAST_POINTS_STACK_VOLUME,
  );
  return moneyStarted && fastPointsStarted;
}

export function playCleanBoardEarnedStarSound(
  starIndex: number,
  harpSource: (typeof CLEAN_BOARD_STAR_HARP_SOUND_SOURCES)[number],
): boolean {
  if (starIndex < 0 || starIndex > 2 || !CLEAN_BOARD_STAR_HARP_SOUND_SOURCES.includes(harpSource)) return false;
  const bounceStarted = playCleanBoardSound(CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE, CLEAN_BOARD_VOICE_IDS[3 + starIndex]);
  const harpStarted = playCleanBoardSound(
    harpSource,
    CLEAN_BOARD_VOICE_IDS[6 + starIndex],
    undefined,
    CLEAN_BOARD_STAR_HARP_VOLUME,
  );
  return bounceStarted && harpStarted;
}

export function playCleanBoardCtaBounceSound(ctaIndex: 0 | 1): boolean {
  return playCleanBoardSound(CLEAN_BOARD_CTA_BOUNCE_SOUND_SOURCE, CLEAN_BOARD_VOICE_IDS[9 + ctaIndex]);
}

export function stopCleanBoardSounds(): void {
  stopDecodedGameplayVoices([...CLEAN_BOARD_VOICE_IDS]);
  CLEAN_BOARD_VOICE_IDS.forEach(stopMediaVoice);
  Array.from(mediaAudioByVoiceId.keys()).forEach(stopMediaVoice);
}

export function resetCleanBoardSoundsForTests(): void {
  stopCleanBoardSounds();
  mediaAudioByVoiceId.clear();
  previousHarpOrder = '';
}
