import { logger } from '../core/logger.js';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  beginCoreTntBonusImpactSoundSequence,
  playCoreTntBonusImpactSound,
  preloadCoreTntBonusImpactSounds,
  stopCoreTntBonusImpactSounds,
} from './core-tnt-merge6-sound.ts';

const GUN_SOUND_BASE = './assets/sound/Wild and special kockice/gun/';

export const LASER_GUN_MERGE6_CUES = Object.freeze([
  {
    source: './assets/sound/Wild and special kockice/tnt/horn.wav',
    gain: 0.8,
    voiceId: 'laser-gun-merge6-horn',
  },
  {
    source: `${GUN_SOUND_BASE}prep.wav`,
    gain: 0.8,
    voiceId: 'laser-gun-merge6-prep',
  },
] as const);
export const LASER_GUN_STAGE_PREPARATION_SOURCE = `${GUN_SOUND_BASE}priprema.wav`;
export const LASER_GUN_STAGE_PREPARATION_GAIN = 0.85;
export const LASER_GUN_BEAM_CUES = Object.freeze([
  { source: `${GUN_SOUND_BASE}beam1.wav`, gain: 0.595, layerId: 'beam1' },
  { source: `${GUN_SOUND_BASE}beam2.wav`, gain: 0.42, layerId: 'beam2' },
] as const);
export const LASER_GUN_FINAL_CHANGED_CUBE_CUE = Object.freeze({
  source: `${GUN_SOUND_BASE}plombing.wav`,
  gain: 0.8,
  voiceId: 'laser-gun-final-changed-cube-plombing',
} as const);
export const LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE = Object.freeze({
  source: './assets/sound/Wild and special kockice/star/star1.wav',
  gain: 0.7,
  voiceId: 'laser-gun-final-changed-cube-star1',
} as const);

const STAGE_PREPARATION_VOICE_ID_PREFIX = 'laser-gun-stage-preparation-';
const FINAL_SHOT_INDEX = 3;
const voices = new Map<string, symbol>();
const media = new Map<string, HTMLAudioElement>();
const preloadedMedia = new Map<string, HTMLAudioElement>();

function enabled(): boolean {
  return typeof window !== 'undefined' && (window as any)._settings?.gameSoundsEnabled === true;
}

export function isLaserGunMerge6SoundEvent(event: {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}): boolean {
  return event.effectiveSum === 6 && (
    event.srcSpecialDiceVariantId === 'laser-gun' ||
    event.dstSpecialDiceVariantId === 'laser-gun'
  );
}

function stopVoices(ids: readonly string[]): void {
  stopDecodedGameplayVoices(ids);
  ids.forEach((id) => {
    const audio = media.get(id);
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    media.delete(id);
    voices.delete(id);
  });
}

function playCue(source: string, gain: number, voiceId: string): boolean {
  if (!enabled()) return false;
  stopVoices([voiceId]);
  const token = Symbol(voiceId);
  voices.set(voiceId, token);
  const finish = () => {
    if (voices.get(voiceId) !== token) return;
    voices.delete(voiceId);
    media.delete(voiceId);
  };
  const fallback = () => {
    if (!enabled() || voices.get(voiceId) !== token || typeof Audio !== 'function') {
      finish();
      return false;
    }
    const audio = new Audio(source);
    media.set(voiceId, audio);
    audio.preload = 'auto';
    audio.volume = applySoundEffectsMasterGain(gain);
    audio.playbackRate = 1;
    audio.onended = finish;
    audio.onerror = finish;
    try {
      audio.play()?.catch((error) => {
        finish();
        logger.warn('LaserGun sound playback failed:', error);
      });
      return true;
    } catch {
      finish();
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

export function preloadLaserGunMerge6Sounds(): boolean {
  if (!enabled()) return false;
  const sources = [
    ...LASER_GUN_MERGE6_CUES.map(({ source }) => source),
    LASER_GUN_STAGE_PREPARATION_SOURCE,
    ...LASER_GUN_BEAM_CUES.map(({ source }) => source),
    LASER_GUN_FINAL_CHANGED_CUBE_CUE.source,
    LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE.source,
  ];
  const impactsReady = preloadCoreTntBonusImpactSounds();
  if (preloadDecodedGameplaySounds(sources)) return impactsReady;
  if (typeof Audio !== 'function') return false;
  const mediaReady = sources.every((source) => {
    if (preloadedMedia.has(source)) return true;
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    preloadedMedia.set(source, audio);
    return true;
  });
  return mediaReady && impactsReady;
}

/** Adds LaserGun-only layers beside the already-owned Special Merge-6 package. */
export function playLaserGunMerge6AddonSounds(): boolean {
  if (!enabled()) return false;
  beginCoreTntBonusImpactSoundSequence();
  const results = LASER_GUN_MERGE6_CUES.map(({ source, gain, voiceId }) => (
    playCue(source, gain, voiceId)
  ));
  return results.every(Boolean);
}

export function playLaserGunStagePreparationSound(shotIndex: number): boolean {
  if (!Number.isInteger(shotIndex) || shotIndex < 0) return false;
  return playCue(
    LASER_GUN_STAGE_PREPARATION_SOURCE,
    LASER_GUN_STAGE_PREPARATION_GAIN,
    `${STAGE_PREPARATION_VOICE_ID_PREFIX}${shotIndex}`,
  );
}

export function playLaserGunBeamSound(
  shotIndex: number,
): boolean {
  if (!Number.isInteger(shotIndex) || shotIndex < 0) return false;
  const results = LASER_GUN_BEAM_CUES.map(({ source, gain, layerId }) => (
    playCue(source, gain, `laser-gun-beam-${shotIndex}-${layerId}`)
  ));
  return results.every(Boolean);
}

/** Forest 04 TNT mini pool, fired only after the target cube changes value. */
export function playLaserGunChangedCubeSound(impactIndex: number): boolean {
  const impactStarted = playCoreTntBonusImpactSound(impactIndex);
  if (impactIndex !== 3) return impactStarted;
  const finalCueStarted = playCue(
    LASER_GUN_FINAL_CHANGED_CUBE_CUE.source,
    LASER_GUN_FINAL_CHANGED_CUBE_CUE.gain,
    LASER_GUN_FINAL_CHANGED_CUBE_CUE.voiceId,
  );
  const starCueStarted = playCue(
    LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE.source,
    LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE.gain,
    LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE.voiceId,
  );
  return impactStarted && finalCueStarted && starCueStarted;
}

export function stopLaserGunFinaleSounds(): void {
  stopVoices([
    ...Array.from(voices.keys()).filter((id) => id.startsWith(STAGE_PREPARATION_VOICE_ID_PREFIX)),
    ...Array.from(voices.keys()).filter((id) => (
      id.startsWith('laser-gun-beam-') &&
      !id.startsWith(`laser-gun-beam-${FINAL_SHOT_INDEX}-`)
    )),
  ]);
}

export function stopLaserGunMerge6Sounds(): void {
  stopVoices([...voices.keys()]);
  stopCoreTntBonusImpactSounds();
  preloadedMedia.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
  preloadedMedia.clear();
}
