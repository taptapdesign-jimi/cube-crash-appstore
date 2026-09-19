import { logger } from '../core/logger';
import { applySoundEffectsMasterGain } from './sound-effects-volume';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices, setDecodedGameplayVoiceVolume } from './gameplay-audio-buffer-player';
import { playSpecialMerge6FoundationSound, preloadRegularMerge6Sounds } from './regular-merge6-sound';

const BASE = './assets/sound/Wild and special kockice/kanta/';
export const KANTA_MERGE6_CUES = Object.freeze([
  { source: `${BASE}tup.wav`, gain: 1 },
  { source: `${BASE}spacesound.wav`, gain: 0.8 },
  { source: `${BASE}bibis.wav`, gain: 0.5 },
  { source: `${BASE}kanta4.wav`, gain: 0.9 },
]);
export const KANTA_WALKING_SOURCE = `${BASE}hodanje.wav`;
export const KANTA_WALKING_GAIN = 0.3;
export const KANTA_EXIT_SOURCES = [1, 2, 3].map(index => `${BASE}kanta${index}.wav`);
// Several two-second exits overlap; keep their combined bed below the start cue.
export const KANTA_EXIT_BASE_GAIN = 0.455;
export const KANTA_EXIT_QUIET_GAIN = 0.364;
const voices = new Map<string, symbol>();
const preloadedMedia = new Map<string, HTMLAudioElement>();
const volumes = new Map<string, number>();
const BIBIS_VOICE_ID = 'kanta-merge6-bibis';
export const KANTA_BIBIS_FADE_SECONDS = 0.5;
const media = new Map<string, HTMLAudioElement>();
let nextSequence = 0;

function enabled(): boolean {
  return typeof window !== 'undefined' && (window as any)._settings?.gameSoundsEnabled === true;
}

export function isKantaMerge6SoundEvent(event: {
  effectiveSum: number;
  srcSpecialDiceVariantId?: string | null;
  dstSpecialDiceVariantId?: string | null;
}): boolean {
  return event.effectiveSum === 6 && (event.srcSpecialDiceVariantId === 'kanta' || event.dstSpecialDiceVariantId === 'kanta');
}

function stopVoices(ids: readonly string[]): void {
  stopDecodedGameplayVoices(ids);
  ids.forEach(id => {
    const audio = media.get(id);
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try { audio.pause(); audio.currentTime = 0; } catch {}
      media.delete(id);
    }
    voices.delete(id);
    volumes.delete(id);
  });
}

function playCue(source: string, gain: number, id: string): boolean {
  if (!enabled()) return false;
  stopVoices([id]);
  const token = Symbol(id);
  voices.set(id, token);
  volumes.set(id, applySoundEffectsMasterGain(gain));
  const finish = () => {
    if (voices.get(id) !== token) return;
    voices.delete(id);
    volumes.delete(id);
    media.delete(id);
  };
  const fallback = () => {
    if (!enabled() || voices.get(id) !== token || typeof Audio !== 'function') { finish(); return false; }
    const audio = preloadedMedia.get(source) ?? new Audio(source);
    preloadedMedia.delete(source);
    media.set(id, audio);
    audio.volume = volumes.get(id) ?? applySoundEffectsMasterGain(gain);
    audio.playbackRate = 1;
    audio.onended = finish;
    audio.onerror = finish;
    try {
      audio.play()?.catch(error => { finish(); logger.warn('Kanta sound playback failed:', error); });
      return true;
    } catch { finish(); return false; }
  };
  const result = playDecodedGameplaySound(source, {
    voiceId: id,
    volume: applySoundEffectsMasterGain(gain),
    playbackRate: 1,
    onEnded: finish,
    onStopped: finish,
    onDeferredUnavailable: () => { fallback(); },
  });
  if (result !== 'unavailable') return true;
  voices.set(id, token);
  return fallback();
}

export function preloadKantaMerge6Sounds(): boolean {
  if (!enabled()) return false;
  preloadRegularMerge6Sounds();
  const sources = [...KANTA_MERGE6_CUES.map(cue => cue.source), ...KANTA_EXIT_SOURCES, KANTA_WALKING_SOURCE];
  if (preloadDecodedGameplaySounds(sources)) return true;
  if (typeof Audio !== 'function') return false;
  sources.forEach(source => {
    if (preloadedMedia.has(source)) return;
    const audio = new Audio(source);
    audio.preload = 'auto';
    try { audio.load(); } catch {}
    preloadedMedia.set(source, audio);
  });
  return true;
}

export function playKantaMerge6Sounds(): boolean {
  if (!enabled()) return false;
  const foundation = playSpecialMerge6FoundationSound();
  const results = KANTA_MERGE6_CUES.map(cue => playCue(cue.source, cue.gain, `kanta-merge6-${cue.source.slice(BASE.length, -4)}`));
  return foundation && results.every(Boolean);
}

function fadeOwnedVoice(id: string, token: symbol | undefined, gain: number, progress: number): void {
  if (!token || voices.get(id) !== token) return;
  const p = Math.max(0, Math.min(1, progress));
  if (p >= 1) { stopVoices([id]); return; }
  const volume = applySoundEffectsMasterGain(gain) * (1 - p);
  volumes.set(id, volume);
  setDecodedGameplayVoiceVolume(id, volume);
  const audio = media.get(id);
  if (audio) audio.volume = volume;
}

/** One choice per visible exit, with separate voices so neighbouring cans do not restart each other. */
export function createKantaExitSoundSequence(random: () => number = Math.random) {
  const sequence = ++nextSequence;
  const bibisToken = voices.get(BIBIS_VOICE_ID);
  const walkingId = `kanta-walking-${sequence}`;
  let walkingToken: symbol | undefined;
  let walkingStarted = false;
  const fired = new Set<string>();
  const ownedIds: string[] = [];
  let disposed = false;
  return {
    startWalking(): boolean {
      if (disposed || walkingStarted) return false;
      walkingStarted = true;
      const started = playCue(KANTA_WALKING_SOURCE, KANTA_WALKING_GAIN, walkingId);
      walkingToken = voices.get(walkingId);
      if (walkingToken) ownedIds.push(walkingId);
      return started;
    },
    fadeWalking(progress: number): void {
      if (!disposed) fadeOwnedVoice(walkingId, walkingToken, KANTA_WALKING_GAIN, progress);
    },
    play(key: string): boolean {
      if (disposed || fired.has(key)) return false;
      fired.add(key);
      if (!enabled()) return false;
      const source = KANTA_EXIT_SOURCES[Math.min(2, Math.max(0, Math.floor(random() * 3)))];
      const gain = random() < 0.5 ? KANTA_EXIT_QUIET_GAIN : KANTA_EXIT_BASE_GAIN;
      const id = `kanta-exit-${sequence}-${key}`;
      ownedIds.push(id);
      return playCue(source, gain, id);
    },
    fadeBibis(progress: number): void {
      if (!disposed) fadeOwnedVoice(BIBIS_VOICE_ID, bibisToken, 0.5, progress);
    },
    stop(): void {
      if (disposed) return;
      disposed = true;
      stopVoices(ownedIds);
      if (bibisToken && voices.get(BIBIS_VOICE_ID) === bibisToken) stopVoices([BIBIS_VOICE_ID]);
    },
  };
}

export function stopKantaMerge6Sounds(): void {
  stopVoices([...voices.keys()]);
  preloadedMedia.forEach(audio => { try { audio.pause(); } catch {} });
  preloadedMedia.clear();
}
