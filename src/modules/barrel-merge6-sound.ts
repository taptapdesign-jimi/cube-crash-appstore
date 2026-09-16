import { logger } from '../core/logger.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';
import {
  CORE_TNT_MERGE6_CUSTOM_BUS_SCALE,
  CORE_TNT_MERGE6_SOUND_BASE_VOLUME,
  CORE_TNT_MERGE6_SOUND_DELAY_MS,
  CORE_TNT_MERGE6_HORN_BASE_VOLUME,
  CORE_TNT_MERGE6_WOOD_BASE_VOLUME,
  CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS,
  beginCoreTntBonusImpactSoundSequence,
  preloadCoreTntBonusImpactSounds,
} from './core-tnt-merge6-sound.ts';
import { playSpecialMerge6FoundationSound, preloadRegularMerge6Sounds } from './regular-merge6-sound.ts';

const BARREL_SOUND_BASE = './assets/sound/Wild and special kockice/barell/';
export const BARREL_SOUND_SOURCES = Object.freeze({
  tnt3: `${BARREL_SOUND_BASE}tnt3.wav`,
  horn: `${BARREL_SOUND_BASE}horn.wav`,
  woodBreak: `${BARREL_SOUND_BASE}wood break.wav`,
  woodSplinter: `${BARREL_SOUND_BASE}wood ssplinter.wav`,
  planks: `${BARREL_SOUND_BASE}planks.wav`,
  puf1: `${BARREL_SOUND_BASE}puf1.wav`,
  puf2: `${BARREL_SOUND_BASE}puf2.wav`,
  poof: `${BARREL_SOUND_BASE}poof.wav`,
});
export const BARREL_PUF1_BASE_VOLUME = 0.55;
export const BARREL_PUF2_BASE_VOLUME = 0.35;
export const BARREL_PLANKS_BASE_VOLUME = 0.7;
export const BARREL_PLANKS_DELAY_AFTER_ANIMATION_MS = 200;
export const BARREL_PUF1_VOLUME = applySoundEffectsMasterGain(BARREL_PUF1_BASE_VOLUME);
export const BARREL_PUF2_VOLUME = applySoundEffectsMasterGain(BARREL_PUF2_BASE_VOLUME);
export const BARREL_PLANKS_VOLUME = applySoundEffectsMasterGain(BARREL_PLANKS_BASE_VOLUME);
export const BARREL_FOUNDATION_BOOM_VOLUME_SCALE = 1.3;
export const BARREL_SMOKE_POOF_BASE_VOLUME = 0.35;
export const BARREL_SMOKE_POOF_VOLUME = applySoundEffectsMasterGain(BARREL_SMOKE_POOF_BASE_VOLUME);
const BARREL_SMOKE_POOF_VOICE_ID = 'barrel-merge6-smoke-poof';

const CUES = Object.freeze([
  { id: 'tnt3', source: BARREL_SOUND_SOURCES.tnt3,
    volume: applySoundEffectsMasterGain(CORE_TNT_MERGE6_SOUND_BASE_VOLUME * CORE_TNT_MERGE6_CUSTOM_BUS_SCALE),
    delayMs: CORE_TNT_MERGE6_SOUND_DELAY_MS },
  { id: 'horn', source: BARREL_SOUND_SOURCES.horn,
    volume: applySoundEffectsMasterGain(CORE_TNT_MERGE6_HORN_BASE_VOLUME * CORE_TNT_MERGE6_CUSTOM_BUS_SCALE), delayMs: 0 },
  { id: 'wood-break', source: BARREL_SOUND_SOURCES.woodBreak,
    volume: applySoundEffectsMasterGain(CORE_TNT_MERGE6_WOOD_BASE_VOLUME * CORE_TNT_MERGE6_CUSTOM_BUS_SCALE), delayMs: 0 },
  { id: 'wood-splinter', source: BARREL_SOUND_SOURCES.woodSplinter,
    volume: applySoundEffectsMasterGain(CORE_TNT_MERGE6_WOOD_BASE_VOLUME * CORE_TNT_MERGE6_CUSTOM_BUS_SCALE),
    delayMs: CORE_TNT_MERGE6_WOOD_SPLINTER_DELAY_MS },
  { id: 'puf1', source: BARREL_SOUND_SOURCES.puf1, volume: BARREL_PUF1_VOLUME, delayMs: 0 },
  { id: 'puf2', source: BARREL_SOUND_SOURCES.puf2, volume: BARREL_PUF2_VOLUME, delayMs: 100 },
]);
const BARREL_PLANKS_VOICE_ID = 'barrel-merge6-planks';
const VOICE_IDS = [...CUES.map((cue) => `barrel-merge6-${cue.id}`), BARREL_PLANKS_VOICE_ID];
const mediaAudioBySource = new Map<string, HTMLAudioElement>();
const mediaTimers = new Set<number>();
let smokePoofArmed = false;
let planksArmed = false;

export interface BarrelMerge6SoundEvent {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}

export function isBarrelMerge6SoundEvent(event: BarrelMerge6SoundEvent): boolean {
  return event.effectiveSum === 6 && (
    event.srcSpecialDiceVariantId === 'barell' || event.dstSpecialDiceVariantId === 'barell'
  );
}

export function areBarrelMerge6SoundsEnabled(): boolean {
  return typeof window !== 'undefined' && (window as any)._settings?.gameSoundsEnabled === true;
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

export function preloadBarrelMerge6Sounds(): boolean {
  if (!areBarrelMerge6SoundsEnabled()) return false;
  const sources = [...CUES.map((cue) => cue.source), BARREL_SOUND_SOURCES.planks, BARREL_SOUND_SOURCES.poof];
  const barrelReady = preloadDecodedGameplaySounds(sources) || sources.every((source) => getMediaAudio(source) !== null);
  return preloadRegularMerge6Sounds() && preloadCoreTntBonusImpactSounds() && barrelReady;
}

export function stopBarrelMerge6Sounds(): void {
  smokePoofArmed = false;
  planksArmed = false;
  if (typeof window !== 'undefined') mediaTimers.forEach((timer) => window.clearTimeout(timer));
  mediaTimers.clear();
  stopDecodedGameplayVoices([...VOICE_IDS, BARREL_SMOKE_POOF_VOICE_ID]);
  mediaAudioBySource.forEach((audio) => {
    try { audio.pause(); audio.currentTime = 0; } catch {}
  });
}

export function resetBarrelMerge6SoundCacheForTests(): void {
  stopBarrelMerge6Sounds();
  mediaAudioBySource.clear();
}

export function playBarrelMerge6Sound(): boolean {
  if (!areBarrelMerge6SoundsEnabled()) return false;
  stopBarrelMerge6Sounds();
  smokePoofArmed = true;
  planksArmed = true;
  beginCoreTntBonusImpactSoundSequence();
  const foundationStarted = playSpecialMerge6FoundationSound(BARREL_FOUNDATION_BOOM_VOLUME_SCALE);
  const sources = CUES.map((cue) => cue.source);
  if (getDecodedGameplaySoundsState(sources) !== 'unavailable') {
    const results = CUES.map((cue) => playDecodedGameplaySound(cue.source, {
      voiceId: `barrel-merge6-${cue.id}`,
      volume: cue.volume,
      playbackRate: 1,
      startDelaySeconds: cue.delayMs / 1000,
    }));
    return foundationStarted && results.every((result) => result !== 'unavailable');
  }
  const audioLayers = CUES.map((cue) => ({ cue, audio: getMediaAudio(cue.source) }));
  if (audioLayers.some((layer) => !layer.audio)) return false;
  audioLayers.forEach(({ cue, audio }) => {
    const start = () => {
      if (!areBarrelMerge6SoundsEnabled() || !audio) return;
      try {
        audio.pause();
        audio.defaultPlaybackRate = 1;
        audio.playbackRate = 1;
        audio.volume = cue.volume;
        audio.currentTime = 0;
        audio.play()?.catch((error) => logger.warn(`Failed to play Barrel ${cue.id}:`, error));
      } catch (error) { logger.warn(`Failed to start Barrel ${cue.id}:`, error); }
    };
    if (cue.delayMs === 0) start();
    else {
      const timer = window.setTimeout(() => { mediaTimers.delete(timer); start(); }, cue.delayMs);
      mediaTimers.add(timer);
    }
  });
  return foundationStarted;
}

/** Schedule once from the actual visible Barrel TNT animation start. */
export function playBarrelPlanksAfterAnimationStart(): boolean {
  if (!planksArmed || !areBarrelMerge6SoundsEnabled()) return false;
  planksArmed = false;
  const source = BARREL_SOUND_SOURCES.planks;
  if (getDecodedGameplaySoundsState([source]) !== 'unavailable') {
    return playDecodedGameplaySound(source, {
      voiceId: BARREL_PLANKS_VOICE_ID,
      volume: BARREL_PLANKS_VOLUME,
      playbackRate: 1,
      startDelaySeconds: BARREL_PLANKS_DELAY_AFTER_ANIMATION_MS / 1000,
    }) !== 'unavailable';
  }
  const audio = getMediaAudio(source);
  if (!audio) return false;
  const timer = window.setTimeout(() => {
    mediaTimers.delete(timer);
    if (!areBarrelMerge6SoundsEnabled()) return;
    try {
      audio.pause();
      audio.defaultPlaybackRate = 1;
      audio.playbackRate = 1;
      audio.volume = BARREL_PLANKS_VOLUME;
      audio.currentTime = 0;
      audio.play()?.catch((error) => logger.warn('Failed to play Barrel planks:', error));
    } catch (error) { logger.warn('Failed to start Barrel planks:', error); }
  }, BARREL_PLANKS_DELAY_AFTER_ANIMATION_MS);
  mediaTimers.add(timer);
  return true;
}

/** One midpoint accent, armed only by the current Barrel Merge-6 run. */
export function playBarrelSmokePoofSound(): boolean {
  if (!smokePoofArmed || !areBarrelMerge6SoundsEnabled()) return false;
  smokePoofArmed = false;
  const source = BARREL_SOUND_SOURCES.poof;
  if (getDecodedGameplaySoundsState([source]) !== 'unavailable') {
    return playDecodedGameplaySound(source, {
      voiceId: BARREL_SMOKE_POOF_VOICE_ID,
      volume: BARREL_SMOKE_POOF_VOLUME,
      playbackRate: 1,
    }) !== 'unavailable';
  }
  const audio = getMediaAudio(source);
  if (!audio) return false;
  try {
    audio.pause();
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    audio.volume = BARREL_SMOKE_POOF_VOLUME;
    audio.currentTime = 0;
    audio.play()?.catch((error) => logger.warn('Failed to play Barrel smoke poof:', error));
    return true;
  } catch (error) {
    logger.warn('Failed to start Barrel smoke poof:', error);
    return false;
  }
}
