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
export const CLEAN_BOARD_APPLAUSE_DURATION_MS = 10000;
export const CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE =
  `${CLEAN_BOARD_SOUND_BASE}happy victory sax .wav`;
export const CLEAN_BOARD_SAXOPHONE_HAPPY_DURATION_MS = 5000;
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
export const CLEAN_BOARD_APPLAUSE_ACTION_VOLUME = 0.6;
export const CLEAN_BOARD_APPLAUSE_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_APPLAUSE_ACTION_VOLUME,
);
export const CLEAN_BOARD_SAXOPHONE_HAPPY_ACTION_VOLUME = 0.76;
export const CLEAN_BOARD_SAXOPHONE_HAPPY_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_SAXOPHONE_HAPPY_ACTION_VOLUME,
);
export const CLEAN_BOARD_MONEY_COUNT_ACTION_VOLUME = 0.95;
export const CLEAN_BOARD_MONEY_COUNT_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_MONEY_COUNT_ACTION_VOLUME,
);
export const CLEAN_BOARD_FAST_POINTS_STACK_ACTION_VOLUME = 0.6;
export const CLEAN_BOARD_FAST_POINTS_STACK_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_FAST_POINTS_STACK_ACTION_VOLUME,
);
export const CLEAN_BOARD_STAR_BOUNCE_ACTION_VOLUME = 0.8;
export const CLEAN_BOARD_STAR_BOUNCE_VOLUME = applySoundEffectsMasterGain(
  CLEAN_BOARD_STAR_BOUNCE_ACTION_VOLUME,
);
export const CLEAN_BOARD_STAR_HARP_ACTION_VOLUME = 0.4;
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
const mediaAudioByVoiceId = new Map<string, {
  source: string;
  audio: HTMLAudioElement;
  generation: number;
  onStopped?: () => void;
}>();
// Preload and playback share these elements. Extra copies are acquired only
// when the authored counter/star/CTA voices need the same source concurrently.
const availableMediaAudioBySource = new Map<string, HTMLAudioElement[]>();
const mediaFadeTimeouts = new Map<string, number>();
const mediaFadeFrames = new Map<string, number>();
let previousHarpOrder = '';
const CLEAN_BOARD_COUNTER_FADE_SECONDS = 0.12;

export interface CleanBoardSoundLifecycle {
  onStarted?: () => void;
  onEnded?: () => void;
  onStopped?: () => void;
  onUnavailable?: () => void;
}

function areSoundsEnabled(): boolean {
  return typeof window !== 'undefined'
    && (window as any)._settings?.gameSoundsEnabled === true;
}

function createMediaAudio(source: string): HTMLAudioElement | null {
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  return audio;
}

function retainAvailableMediaAudio(source: string, audio: HTMLAudioElement): void {
  const available = availableMediaAudioBySource.get(source) ?? [];
  available.push(audio);
  availableMediaAudioBySource.set(source, available);
}

function preloadMediaSource(source: string): boolean {
  if (availableMediaAudioBySource.get(source)?.length) return true;
  if (Array.from(mediaAudioByVoiceId.values()).some(entry => entry.source === source)) return true;
  const audio = createMediaAudio(source);
  if (!audio) return false;
  retainAvailableMediaAudio(source, audio);
  return true;
}

function getMediaAudio(source: string, voiceId: string): HTMLAudioElement | null {
  const existing = mediaAudioByVoiceId.get(voiceId);
  if (existing?.source === source) return existing.audio;
  if (existing) stopMediaVoice(voiceId);
  const audio = availableMediaAudioBySource.get(source)?.pop() ?? createMediaAudio(source);
  if (!audio) return null;
  mediaAudioByVoiceId.set(voiceId, { source, audio, generation: 0 });
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
  entry.generation++;
  mediaAudioByVoiceId.delete(voiceId);
  const onStopped = entry.onStopped;
  entry.onStopped = undefined;
  try {
    entry.audio.onended = null;
    entry.audio.pause();
    entry.audio.currentTime = 0;
  } catch {}
  retainAvailableMediaAudio(entry.source, entry.audio);
  onStopped?.();
}

function scheduleMediaFadeOut(
  audio: HTMLAudioElement,
  voiceId: string,
  stopAfterSeconds: number,
  volume: number,
  isCurrent: () => boolean,
): void {
  const fadeSeconds = Math.min(CLEAN_BOARD_COUNTER_FADE_SECONDS, stopAfterSeconds);
  const fadeStartMs = Math.max(0, (stopAfterSeconds - fadeSeconds) * 1000);
  const timeout = window.setTimeout(() => {
    if (!isCurrent()) return;
    mediaFadeTimeouts.delete(voiceId);
    const startedAt = performance.now();
    const fade = (now: number) => {
      if (!isCurrent()) return;
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
  lifecycle: CleanBoardSoundLifecycle = {},
): boolean {
  if (!areSoundsEnabled()) {
    lifecycle.onUnavailable?.();
    return false;
  }
  stopDecodedGameplayVoices([voiceId]);
  stopMediaVoice(voiceId);
  const decodedState = getDecodedGameplaySoundsState([source]);
  if (decodedState !== 'unavailable') {
    const decodedResult = playDecodedGameplaySound(source, {
      voiceId,
      volume,
      stopAfterSeconds,
      fadeOutSeconds: stopAfterSeconds === undefined ? undefined : CLEAN_BOARD_COUNTER_FADE_SECONDS,
      onStarted: lifecycle.onStarted,
      onEnded: lifecycle.onEnded,
      onStopped: lifecycle.onStopped,
      onDeferredUnavailable: () => {
        playCleanBoardMediaFallback(source, voiceId, stopAfterSeconds, volume, lifecycle);
      },
    });
    if (decodedResult !== 'unavailable') return true;
  }
  return playCleanBoardMediaFallback(source, voiceId, stopAfterSeconds, volume, lifecycle);
}

function playCleanBoardMediaFallback(
  source: string,
  voiceId: string,
  stopAfterSeconds: number | undefined,
  volume: number,
  lifecycle: CleanBoardSoundLifecycle,
): boolean {
  const audio = getMediaAudio(source, voiceId);
  if (!audio) {
    lifecycle.onUnavailable?.();
    return false;
  }
  const entry = mediaAudioByVoiceId.get(voiceId)!;
  const generation = ++entry.generation;
  const isCurrent = () => mediaAudioByVoiceId.get(voiceId) === entry && entry.generation === generation;
  try {
    entry.onStopped = lifecycle.onStopped;
    audio.pause();
    audio.volume = volume;
    audio.currentTime = 0;
    audio.onended = () => {
      if (!isCurrent()) return;
      entry.onStopped = undefined;
      lifecycle.onEnded?.();
    };
    const playResult = audio.play();
    if (playResult && typeof playResult.then === 'function') {
      void playResult.then(() => { if (isCurrent()) lifecycle.onStarted?.(); }).catch(error => {
        if (!isCurrent()) return;
        audio.onended = null;
        entry.onStopped = undefined;
        logger.warn(`Failed to play Clean Board sound ${source}:`, error);
        lifecycle.onUnavailable?.();
      });
    } else {
      lifecycle.onStarted?.();
    }
    if (stopAfterSeconds !== undefined) scheduleMediaFadeOut(audio, voiceId, stopAfterSeconds, volume, isCurrent);
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    audio.onended = null;
    entry.onStopped = undefined;
    logger.warn(`Failed to start Clean Board sound ${source}:`, error);
    lifecycle.onUnavailable?.();
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
    || sources.every(preloadMediaSource);
}

export function playCleanBoardApplauseSound(
  lifecycle: CleanBoardSoundLifecycle = {},
): boolean {
  return playCleanBoardSound(
    CLEAN_BOARD_APPLAUSE_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[0],
    undefined,
    CLEAN_BOARD_APPLAUSE_VOLUME,
    lifecycle,
  );
}

export function playCleanBoardSaxophoneHappySound(
  lifecycle: CleanBoardSoundLifecycle = {},
): boolean {
  return playCleanBoardSound(
    CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[11],
    undefined,
    CLEAN_BOARD_SAXOPHONE_HAPPY_VOLUME,
    lifecycle,
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
  const bounceStarted = playCleanBoardSound(
    CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE,
    CLEAN_BOARD_VOICE_IDS[3 + starIndex],
    undefined,
    CLEAN_BOARD_STAR_BOUNCE_VOLUME,
  );
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
  availableMediaAudioBySource.clear();
  previousHarpOrder = '';
}
