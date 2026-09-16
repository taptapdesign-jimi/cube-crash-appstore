import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

const JUICE_SOUND_DIR = './assets/sound/Wild and special kockice/juice/';
export const JUICE_FINALE_SOUND_SOURCES = Object.freeze({
  bubble: `${JUICE_SOUND_DIR}bubble.wav`,
  introBubble: `${JUICE_SOUND_DIR}introbubble.wav`,
  straw: `${JUICE_SOUND_DIR}mini2.mp3`,
  lid: `${JUICE_SOUND_DIR}mini3.wav`,
  cup: `${JUICE_SOUND_DIR}mini4.wav`,
} as const);
export type JuiceFinaleSoundCue = keyof typeof JUICE_FINALE_SOUND_SOURCES;
export const JUICE_INTRO_BUBBLE_DELAY_MS = 800;
// The supplied bubble.wav is 4.56s. End one second earlier with a short,
// smooth fade while preserving its untouched source file.
export const JUICE_BUBBLE_END_SECONDS = 3.56;
export const JUICE_BUBBLE_FADE_SECONDS = 0.5;

export function shouldPlayJuiceIntroBubble(elapsedMs: number): boolean {
  return elapsedMs >= JUICE_INTRO_BUBBLE_DELAY_MS;
}

export const JUICE_FINALE_ACTION_VOLUMES = Object.freeze({
  bubble: 0.55,
  introBubble: 0.7,
  straw: 0.65,
  lid: 0.65,
  cup: 0.5,
} as const);

const CUES: Record<JuiceFinaleSoundCue, { source: string; voiceId: string; volume: number }> = {
  bubble: { source: JUICE_FINALE_SOUND_SOURCES.bubble, voiceId: 'juice-finale-bubble', volume: applySoundEffectsMasterGain(JUICE_FINALE_ACTION_VOLUMES.bubble) },
  introBubble: { source: JUICE_FINALE_SOUND_SOURCES.introBubble, voiceId: 'juice-finale-intro-bubble', volume: applySoundEffectsMasterGain(JUICE_FINALE_ACTION_VOLUMES.introBubble) },
  straw: { source: JUICE_FINALE_SOUND_SOURCES.straw, voiceId: 'juice-finale-straw', volume: applySoundEffectsMasterGain(JUICE_FINALE_ACTION_VOLUMES.straw) },
  lid: { source: JUICE_FINALE_SOUND_SOURCES.lid, voiceId: 'juice-finale-lid', volume: applySoundEffectsMasterGain(JUICE_FINALE_ACTION_VOLUMES.lid) },
  cup: { source: JUICE_FINALE_SOUND_SOURCES.cup, voiceId: 'juice-finale-cup', volume: applySoundEffectsMasterGain(JUICE_FINALE_ACTION_VOLUMES.cup) },
};
const VOICE_IDS = Object.values(CUES).map(({ voiceId }) => voiceId);
const mediaByVoiceId = new Map<string, HTMLAudioElement>();
let bubbleMediaFadeTimer: number | null = null;
let bubbleMediaRun = 0;

function clearBubbleMediaFade(): void {
  bubbleMediaRun += 1;
  if (bubbleMediaFadeTimer !== null) {
    clearInterval(bubbleMediaFadeTimer);
    bubbleMediaFadeTimer = null;
  }
}

function startBubbleMediaFade(audio: HTMLAudioElement, fullVolume: number, run: number): void {
  if (run !== bubbleMediaRun) return;
  const fadeStart = JUICE_BUBBLE_END_SECONDS - JUICE_BUBBLE_FADE_SECONDS;
  const update = () => {
    if (run !== bubbleMediaRun) return;
    const sourceTime = audio.currentTime;
    if (sourceTime >= JUICE_BUBBLE_END_SECONDS) {
      audio.volume = 0;
      stopMediaVoice(CUES.bubble.voiceId);
      return;
    }
    const fadeProgress = Math.max(0, Math.min(1,
      (sourceTime - fadeStart) / JUICE_BUBBLE_FADE_SECONDS,
    ));
    audio.volume = fullVolume * (1 - fadeProgress);
  };
  update();
  bubbleMediaFadeTimer = window.setInterval(update, 25);
}

function soundsEnabled(): boolean {
  return typeof window !== 'undefined' && (window as any)._settings?.gameSoundsEnabled === true;
}

function mediaFor(source: string, voiceId: string): HTMLAudioElement | null {
  const cached = mediaByVoiceId.get(voiceId);
  if (cached) return cached;
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  mediaByVoiceId.set(voiceId, audio);
  return audio;
}

function stopMediaVoice(voiceId: string): void {
  if (voiceId === CUES.bubble.voiceId) clearBubbleMediaFade();
  const audio = mediaByVoiceId.get(voiceId);
  if (!audio) return;
  try { audio.pause(); audio.currentTime = 0; } catch {}
}

function playMediaSound(source: string, voiceId: string, volume: number): boolean {
  if (!soundsEnabled()) return false;
  const audio = mediaFor(source, voiceId);
  if (!audio) return false;
  try {
    stopMediaVoice(voiceId);
    audio.volume = volume;
    const playAttempt = audio.play();
    if (voiceId === CUES.bubble.voiceId) {
      const run = ++bubbleMediaRun;
      if (playAttempt && typeof playAttempt.then === 'function') {
        void playAttempt.then(
          () => startBubbleMediaFade(audio, volume, run),
          (error) => logger.warn(`Failed to play Juice finale sound ${source}:`, error),
        );
      } else {
        startBubbleMediaFade(audio, volume, run);
      }
    } else {
      playAttempt?.catch((error) => logger.warn(`Failed to play Juice finale sound ${source}:`, error));
    }
    return true;
  } catch (error) {
    logger.warn(`Failed to start Juice finale sound ${source}:`, error);
    return false;
  }
}

export function preloadJuiceMerge6Sounds(): boolean {
  if (!soundsEnabled()) return false;
  const sources = Object.values(JUICE_FINALE_SOUND_SOURCES);
  return preloadDecodedGameplaySounds(sources)
    || sources.every((source, index) => mediaFor(source, VOICE_IDS[index]) !== null);
}

export function playJuiceFinaleSound(cue: JuiceFinaleSoundCue): boolean {
  if (!soundsEnabled()) return false;
  const { source, voiceId, volume } = CUES[cue];
  stopDecodedGameplayVoices([voiceId]);
  stopMediaVoice(voiceId);
  if (getDecodedGameplaySoundsState([source]) !== 'unavailable') {
    const result = playDecodedGameplaySound(source, {
      voiceId,
      volume,
      ...(cue === 'bubble' ? {
        stopAfterSeconds: JUICE_BUBBLE_END_SECONDS,
        fadeOutSeconds: JUICE_BUBBLE_FADE_SECONDS,
      } : {}),
      onDeferredUnavailable: () => { playMediaSound(source, voiceId, volume); },
    });
    if (result !== 'unavailable') return true;
  }
  return playMediaSound(source, voiceId, volume);
}

export function stopJuiceMerge6Sounds(): void {
  stopDecodedGameplayVoices(VOICE_IDS);
  VOICE_IDS.forEach(stopMediaVoice);
}

export function resetJuiceFinaleSoundCacheForTests(): void {
  stopJuiceMerge6Sounds();
  mediaByVoiceId.clear();
}
