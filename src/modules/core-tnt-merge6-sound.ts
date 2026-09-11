import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';
import {
  REGULAR_MERGE6_BOOM_BASE_VOLUME,
  REGULAR_MERGE6_BOOM_SOUND_SOURCE,
  REGULAR_MERGE6_BOOM_VOLUME,
  REGULAR_MERGE6_CRASH_BASE_VOLUME,
  REGULAR_MERGE6_CRASH_PLAYBACK_RATE,
  REGULAR_MERGE6_CRASH_SOUND_SOURCE,
  REGULAR_MERGE6_CRASH_VOLUME,
  REGULAR_MERGE6_SOUND_BASE_VOLUME,
  REGULAR_MERGE6_SOUND_PLAYBACK_RATE,
  REGULAR_MERGE6_SOUND_SOURCE,
  REGULAR_MERGE6_SOUND_VOLUME,
  REGULAR_MERGE6_STACK_BASE_VOLUME,
  REGULAR_MERGE6_STACK_SOUND_SOURCE,
  REGULAR_MERGE6_STACK_VOLUME,
  playRegularMerge6Sound,
  preloadRegularMerge6Sounds,
  resetRegularMerge6SoundCacheForTests,
  stopRegularMerge6Sounds,
} from './regular-merge6-sound.ts';

export const CORE_TNT_MERGE6_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/tnt/tnt3.wav';
export const CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/tnt/wood break.wav';
export const CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/tnt/wood ssplinter.wav';
export const CORE_TNT_MERGE6_HORN_SOUND_SOURCE =
  './assets/sound/Wild and special kockice/tnt/horn.wav';
export const CORE_TNT_MERGE6_SOUND_PLAYBACK_RATE = 1;
export const CORE_TNT_MERGE6_SOUND_DELAY_MS = 500;
export const CORE_TNT_MERGE6_SOUND_BASE_VOLUME = 0.56;
export const CORE_TNT_MERGE6_SOUND_VOLUME = applySoundEffectsMasterGain(
  CORE_TNT_MERGE6_SOUND_BASE_VOLUME,
);
export const CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE = 1;
export const CORE_TNT_MERGE6_WOOD_BASE_VOLUME = 0.9;
export const CORE_TNT_MERGE6_WOOD_VOLUME = applySoundEffectsMasterGain(
  CORE_TNT_MERGE6_WOOD_BASE_VOLUME,
);
export const CORE_TNT_MERGE6_WOOD_BREAK_DELAY_MS = 0;
export const CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS = 100;
export const CORE_TNT_MERGE6_HORN_PLAYBACK_RATE = 1;
export const CORE_TNT_MERGE6_HORN_BASE_VOLUME = 0.8;
export const CORE_TNT_MERGE6_HORN_VOLUME = applySoundEffectsMasterGain(
  CORE_TNT_MERGE6_HORN_BASE_VOLUME,
);

export const CORE_TNT_BONUS_IMPACT_SOUND_SOURCES = Object.freeze([
  './assets/sound/Wild and special kockice/tnt/mini crash1.wav',
  './assets/sound/mini explozije/mini2.mp3',
  './assets/sound/mini explozije/mini3.wav',
  './assets/sound/mini explozije/mini4.wav',
  './assets/sound/mini explozije/mini5.wav',
] as const);
export const CORE_TNT_BONUS_IMPACT_BASE_VOLUMES = Object.freeze([0.48, 0.56, 0.63, 0.56] as const);
export const CORE_TNT_BONUS_IMPACT_VOLUMES = Object.freeze(
  CORE_TNT_BONUS_IMPACT_BASE_VOLUMES.map((volume) => applySoundEffectsMasterGain(volume)),
);
export const CORE_TNT_BONUS_MINI5_BASE_VOLUME = 0.25;
export const CORE_TNT_BONUS_MINI5_VOLUME = applySoundEffectsMasterGain(
  CORE_TNT_BONUS_MINI5_BASE_VOLUME,
);
export const CORE_TNT_BONUS_MINI2_VOLUME_SCALE = 0.5;
export const CORE_TNT_BONUS_IMPACT_PLAYBACK_RATE = 1;

// Core TNT deliberately reuses the complete ordinary Merge-6 owner. These
// aliases make that shared foundation explicit without duplicating its mix.
export const CORE_TNT_MERGE6_PRIMARY_SOUND_SOURCE = REGULAR_MERGE6_SOUND_SOURCE;
export const CORE_TNT_MERGE6_PRIMARY_PLAYBACK_RATE = REGULAR_MERGE6_SOUND_PLAYBACK_RATE;
export const CORE_TNT_MERGE6_PRIMARY_BASE_VOLUME = REGULAR_MERGE6_SOUND_BASE_VOLUME;
export const CORE_TNT_MERGE6_PRIMARY_VOLUME = REGULAR_MERGE6_SOUND_VOLUME;
export const CORE_TNT_MERGE6_CRASH_SOUND_SOURCE = REGULAR_MERGE6_CRASH_SOUND_SOURCE;
export const CORE_TNT_MERGE6_CRASH_PLAYBACK_RATE = REGULAR_MERGE6_CRASH_PLAYBACK_RATE;
export const CORE_TNT_MERGE6_CRASH_BASE_VOLUME = REGULAR_MERGE6_CRASH_BASE_VOLUME;
export const CORE_TNT_MERGE6_CRASH_VOLUME = REGULAR_MERGE6_CRASH_VOLUME;
export const CORE_TNT_MERGE6_BOOM_SOUND_SOURCE = REGULAR_MERGE6_BOOM_SOUND_SOURCE;
export const CORE_TNT_MERGE6_BOOM_BASE_VOLUME = REGULAR_MERGE6_BOOM_BASE_VOLUME;
export const CORE_TNT_MERGE6_BOOM_VOLUME = REGULAR_MERGE6_BOOM_VOLUME;
export const CORE_TNT_MERGE6_STACK_SOUND_SOURCE = REGULAR_MERGE6_STACK_SOUND_SOURCE;
export const CORE_TNT_MERGE6_STACK_BASE_VOLUME = REGULAR_MERGE6_STACK_BASE_VOLUME;
export const CORE_TNT_MERGE6_STACK_VOLUME = REGULAR_MERGE6_STACK_VOLUME;

const CORE_TNT_MERGE6_SOUND_SOURCES = Object.freeze([
  CORE_TNT_MERGE6_SOUND_SOURCE,
  CORE_TNT_MERGE6_HORN_SOUND_SOURCE,
  CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE,
  CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE,
] as const);
const CORE_TNT_MERGE6_VOICE_ID = Object.freeze({
  tnt3: 'core-tnt-merge6-tnt3',
  horn: 'core-tnt-merge6-horn',
  woodBreak: 'core-tnt-merge6-wood-break',
  woodSplinter: 'core-tnt-merge6-wood-splinter',
});
const CORE_TNT_MERGE6_VOICE_IDS = Object.values(CORE_TNT_MERGE6_VOICE_ID);
const CORE_TNT_BONUS_IMPACT_VOICE_IDS = CORE_TNT_BONUS_IMPACT_BASE_VOLUMES.map(
  (_, index) => `core-tnt-bonus-impact-${index}`,
);
const mediaAudioBySource = new Map<string, HTMLAudioElement>();
let tnt3StartTimer: number | null = null;
let woodSplinterStartTimer: number | null = null;
let bonusImpactSourceOrder = [...CORE_TNT_BONUS_IMPACT_SOUND_SOURCES];

export interface CoreTntMerge6SoundEvent {
  effectiveSum: number;
  srcSpecial?: string | null;
  dstSpecial?: string | null;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

/** Excludes every registered visual variant that shares TNT gameplay. */
export function isCoreTntMerge6SoundEvent(event: CoreTntMerge6SoundEvent): boolean {
  if (event.effectiveSum !== 6) return false;
  if (event.srcSpecialDiceVariantId || event.dstSpecialDiceVariantId) return false;
  return (
    (event.srcSpecial === 'wild-tnt' && !event.dstSpecial) ||
    (event.dstSpecial === 'wild-tnt' && !event.srcSpecial)
  );
}

export function areCoreTntMerge6SoundsEnabled(): boolean {
  return typeof window !== 'undefined' &&
    (window as any)._settings?.gameSoundsEnabled === true;
}

function getMediaAudio(source: string): HTMLAudioElement | null {
  const existing = mediaAudioBySource.get(source);
  if (existing) return existing;
  if (typeof Audio !== 'function') return null;
  const audio = new Audio(source);
  audio.preload = 'auto';
  try { audio.load(); } catch {}
  mediaAudioBySource.set(source, audio);
  return audio;
}

function startMediaLayer(
  audio: HTMLAudioElement,
  volume: number,
  label: string,
): void {
  audio.pause();
  audio.defaultPlaybackRate = 1;
  audio.playbackRate = 1;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play()?.catch((error) => {
    logger.warn(`Failed to play core TNT merge-6 ${label} layer:`, error);
  });
}

function clearWoodSplinterStartTimer(): void {
  if (woodSplinterStartTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(woodSplinterStartTimer);
  woodSplinterStartTimer = null;
}

function clearTnt3StartTimer(): void {
  if (tnt3StartTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(tnt3StartTimer);
  tnt3StartTimer = null;
}

function prepareBonusImpactSourceOrder(): void {
  bonusImpactSourceOrder = [...CORE_TNT_BONUS_IMPACT_SOUND_SOURCES];
  for (let index = bonusImpactSourceOrder.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [bonusImpactSourceOrder[index], bonusImpactSourceOrder[swapIndex]] = [
      bonusImpactSourceOrder[swapIndex],
      bonusImpactSourceOrder[index],
    ];
  }
}

export function stopCoreTntBonusImpactSounds(): void {
  stopDecodedGameplayVoices(CORE_TNT_BONUS_IMPACT_VOICE_IDS);
  CORE_TNT_BONUS_IMPACT_SOUND_SOURCES.forEach((source) => {
    const audio = mediaAudioBySource.get(source);
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

/**
 * Starts one four-impact sound sequence. Flower deliberately shares this
 * exact shuffled TNT mini-impact pool and mix, while keeping its own Merge-6
 * foundation and authored Flower layers separate.
 */
export function beginCoreTntBonusImpactSoundSequence(): boolean {
  if (!areCoreTntMerge6SoundsEnabled()) return false;
  stopCoreTntBonusImpactSounds();
  prepareBonusImpactSourceOrder();
  return true;
}

export function preloadCoreTntBonusImpactSounds(): boolean {
  if (!areCoreTntMerge6SoundsEnabled()) return false;
  return preloadDecodedGameplaySounds(CORE_TNT_BONUS_IMPACT_SOUND_SOURCES)
    || CORE_TNT_BONUS_IMPACT_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
}

export function preloadCoreTntMerge6Sound(): boolean {
  if (!areCoreTntMerge6SoundsEnabled()) return false;
  const ordinaryMergeReady = preloadRegularMerge6Sounds();
  const tntLayersReady = preloadDecodedGameplaySounds(CORE_TNT_MERGE6_SOUND_SOURCES) ||
    CORE_TNT_MERGE6_SOUND_SOURCES.every((source) => getMediaAudio(source) !== null);
  const bonusImpactsReady = preloadCoreTntBonusImpactSounds();
  const tntReady = tntLayersReady && bonusImpactsReady;
  return ordinaryMergeReady && tntReady;
}

export function playCoreTntMerge6Sound(): boolean {
  if (!areCoreTntMerge6SoundsEnabled()) return false;
  beginCoreTntBonusImpactSoundSequence();
  const ordinaryMergeStarted = playRegularMerge6Sound();
  const decodedState = getDecodedGameplaySoundsState(CORE_TNT_MERGE6_SOUND_SOURCES);

  if (decodedState !== 'unavailable') {
    stopDecodedGameplayVoices(CORE_TNT_MERGE6_VOICE_IDS);
    const results = [
      playDecodedGameplaySound(CORE_TNT_MERGE6_SOUND_SOURCE, {
        voiceId: CORE_TNT_MERGE6_VOICE_ID.tnt3,
        volume: CORE_TNT_MERGE6_SOUND_VOLUME,
        playbackRate: CORE_TNT_MERGE6_SOUND_PLAYBACK_RATE,
        startDelaySeconds: CORE_TNT_MERGE6_SOUND_DELAY_MS / 1000,
      }),
      playDecodedGameplaySound(CORE_TNT_MERGE6_HORN_SOUND_SOURCE, {
        voiceId: CORE_TNT_MERGE6_VOICE_ID.horn,
        volume: CORE_TNT_MERGE6_HORN_VOLUME,
        playbackRate: CORE_TNT_MERGE6_HORN_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE, {
        voiceId: CORE_TNT_MERGE6_VOICE_ID.woodBreak,
        volume: CORE_TNT_MERGE6_WOOD_VOLUME,
        playbackRate: CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE,
      }),
      playDecodedGameplaySound(CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE, {
        voiceId: CORE_TNT_MERGE6_VOICE_ID.woodSplinter,
        volume: CORE_TNT_MERGE6_WOOD_VOLUME,
        playbackRate: CORE_TNT_MERGE6_WOOD_PLAYBACK_RATE,
        startDelaySeconds: CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS / 1000,
      }),
    ];
    return ordinaryMergeStarted && results.every((result) => result !== 'unavailable');
  }

  const tnt3 = getMediaAudio(CORE_TNT_MERGE6_SOUND_SOURCE);
  const horn = getMediaAudio(CORE_TNT_MERGE6_HORN_SOUND_SOURCE);
  const woodBreak = getMediaAudio(CORE_TNT_MERGE6_WOOD_BREAK_SOUND_SOURCE);
  const woodSplinter = getMediaAudio(CORE_TNT_MERGE6_WOOD_SPLINTER_SOUND_SOURCE);
  if (!tnt3 || !horn || !woodBreak || !woodSplinter) return false;
  try {
    clearTnt3StartTimer();
    clearWoodSplinterStartTimer();
    CORE_TNT_MERGE6_SOUND_SOURCES.forEach((source) => {
      const audio = mediaAudioBySource.get(source);
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    startMediaLayer(horn, CORE_TNT_MERGE6_HORN_VOLUME, 'horn');
    startMediaLayer(woodBreak, CORE_TNT_MERGE6_WOOD_VOLUME, 'wood break');
    tnt3StartTimer = window.setTimeout(() => {
      tnt3StartTimer = null;
      if (!areCoreTntMerge6SoundsEnabled()) return;
      startMediaLayer(tnt3, CORE_TNT_MERGE6_SOUND_VOLUME, 'tnt3');
    }, CORE_TNT_MERGE6_SOUND_DELAY_MS);
    woodSplinterStartTimer = window.setTimeout(() => {
      woodSplinterStartTimer = null;
      if (!areCoreTntMerge6SoundsEnabled()) return;
      startMediaLayer(woodSplinter, CORE_TNT_MERGE6_WOOD_VOLUME, 'wood splinter');
    }, CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS);
    return ordinaryMergeStarted;
  } catch (error) {
    logger.warn('Failed to start core TNT merge-6 sound:', error);
    return false;
  }
}

export function playCoreTntBonusImpactSound(impactIndex: number): boolean {
  if (!areCoreTntMerge6SoundsEnabled()) return false;
  if (!Number.isInteger(impactIndex) || impactIndex < 0 || impactIndex >= CORE_TNT_BONUS_IMPACT_VOLUMES.length) {
    return false;
  }
  const source = bonusImpactSourceOrder[impactIndex] ?? CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[impactIndex];
  const impactVolume = CORE_TNT_BONUS_IMPACT_VOLUMES[impactIndex];
  const volume = source === CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[4]
    ? CORE_TNT_BONUS_MINI5_VOLUME
    : source === CORE_TNT_BONUS_IMPACT_SOUND_SOURCES[1]
      ? impactVolume * CORE_TNT_BONUS_MINI2_VOLUME_SCALE
      : impactVolume;
  const voiceId = CORE_TNT_BONUS_IMPACT_VOICE_IDS[impactIndex];
  const decodedState = getDecodedGameplaySoundsState([source]);
  if (decodedState !== 'unavailable') {
    stopDecodedGameplayVoices([voiceId]);
    return playDecodedGameplaySound(source, {
      voiceId,
      volume,
      playbackRate: CORE_TNT_BONUS_IMPACT_PLAYBACK_RATE,
    }) !== 'unavailable';
  }
  const audio = getMediaAudio(source);
  if (!audio) return false;
  try {
    startMediaLayer(audio, volume, `bonus impact ${impactIndex + 1}`);
    return true;
  } catch (error) {
    logger.warn(`Failed to start core TNT bonus impact ${impactIndex + 1}:`, error);
    return false;
  }
}

export function stopCoreTntMerge6Sound(): void {
  clearTnt3StartTimer();
  clearWoodSplinterStartTimer();
  stopRegularMerge6Sounds();
  stopDecodedGameplayVoices(CORE_TNT_MERGE6_VOICE_IDS);
  stopCoreTntBonusImpactSounds();
  mediaAudioBySource.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function resetCoreTntMerge6SoundCacheForTests(): void {
  stopCoreTntMerge6Sound();
  resetRegularMerge6SoundCacheForTests();
  mediaAudioBySource.clear();
  bonusImpactSourceOrder = [...CORE_TNT_BONUS_IMPACT_SOUND_SOURCES];
}
