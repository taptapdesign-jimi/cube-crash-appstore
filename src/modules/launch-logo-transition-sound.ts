import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const LAUNCH_LOGO_TRANSITION_SOUND_SOURCES = [
  './assets/sound/logo transitions/nala1.wav',
  './assets/sound/logo transitions/nala2.wav',
  './assets/sound/logo transitions/nala3.wav',
] as const;
export const LAUNCH_GUITAR_TRANSITION_SOUND_SOURCES = [
  './assets/sound/logo transitions/guitar1.wav',
  './assets/sound/logo transitions/guitar2.wav',
] as const;
export const LAUNCH_CHAIR_TRANSITION_SOUND_SOURCE =
  './assets/sound/logo transitions/chair.wav';
export const LAUNCH_FOOTBALL_TRANSITION_SOUND_SOURCE =
  './assets/sound/logo transitions/nogomet.wav';
export const LAUNCH_BOARD_DICE_TRANSITION_SOUND_SOURCE =
  './assets/sound/logo transitions/kokcice.wav';
export const LAUNCH_CAMERA_TRANSITION_SOUND_SOURCE =
  './assets/sound/logo transitions/camera.wav';
export const LAUNCH_WATERING_TRANSITION_SOUND_SOURCE =
  './assets/sound/logo transitions/watering.wav';
export const LAUNCH_GAMER_TRANSITION_SOUND_SOURCES = [
  './assets/sound/logo transitions/gamer.wav',
  './assets/sound/logo transitions/gemer2.wav',
] as const;
const GAMER_VOICE_IDS = ['launch-logo-gamer', 'launch-logo-gamer-2'] as const;
export const LAUNCH_SMILE_TRANSITION_SOUND_SOURCE =
  './assets/sound/logo transitions/smile.wav';
const SMILE_VOICE_ID = 'launch-logo-smile';
export const LAUNCH_PAPER_BAG_TRANSITION_SOUND_SOURCE =
  './assets/sound/logo transitions/paperbag.wav';
const PAPER_BAG_VOICE_ID = 'launch-logo-paper-bag';
export const LAUNCH_SLEEPY_TRANSITION_SOUND_SOURCES = [
  './assets/sound/logo transitions/sleepy2.wav',
  './assets/sound/logo transitions/sleepy1.wav',
] as const;
const VOICE_ID = 'launch-logo-transition-character';
const SLEEPY_VOICE_IDS = ['launch-logo-sleepy-2', 'launch-logo-sleepy-1'] as const;
const SLEEPY_MIDPOINT_SECONDS = 1.44;

export function preloadLaunchLogoTransitionSounds(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds(LAUNCH_LOGO_TRANSITION_SOUND_SOURCES);
}

export function preloadLaunchGuitarTransitionSounds(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds(LAUNCH_GUITAR_TRANSITION_SOUND_SOURCES);
}

export function preloadLaunchChairTransitionSound(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds([LAUNCH_CHAIR_TRANSITION_SOUND_SOURCE]);
}

export function preloadLaunchFootballTransitionSound(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds([LAUNCH_FOOTBALL_TRANSITION_SOUND_SOURCE]);
}

export function preloadLaunchBoardDiceTransitionSound(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds([LAUNCH_BOARD_DICE_TRANSITION_SOUND_SOURCE]);
}

export function preloadLaunchCameraTransitionSound(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds([LAUNCH_CAMERA_TRANSITION_SOUND_SOURCE]);
}

export function preloadLaunchWateringTransitionSound(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds([LAUNCH_WATERING_TRANSITION_SOUND_SOURCE]);
}

export function preloadLaunchGamerTransitionSound(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds(LAUNCH_GAMER_TRANSITION_SOUND_SOURCES);
}

export function preloadLaunchSmileTransitionSound(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds([LAUNCH_SMILE_TRANSITION_SOUND_SOURCE]);
}

export function preloadLaunchPaperBagTransitionSound(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds([LAUNCH_PAPER_BAG_TRANSITION_SOUND_SOURCE]);
}

export function preloadLaunchSleepyTransitionSounds(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds(LAUNCH_SLEEPY_TRANSITION_SOUND_SOURCES);
}

function retireSleepySequence(): void {
  stopDecodedGameplayVoices(SLEEPY_VOICE_IDS);
}

function playRandomSource(sources: readonly string[], random: () => number): string | null {
  if ((window as any)._settings?.gameSoundsEnabled !== true || document.hidden) return null;
  const index = Math.min(
    sources.length - 1,
    Math.floor(Math.max(0, random()) * sources.length),
  );
  const source = sources[index];
  stopDecodedGameplayVoices([VOICE_ID]);
  const result = playDecodedGameplaySound(source, {
    voiceId: VOICE_ID,
    volume: applySoundEffectsMasterGain(0.7),
  });
  return result === 'unavailable' ? null : source;
}

export function playRandomLaunchLogoTransitionSound(random = Math.random): string | null {
  return playRandomSource(LAUNCH_LOGO_TRANSITION_SOUND_SOURCES, random);
}

export function playRandomLaunchGuitarTransitionSound(random = Math.random): string | null {
  return playRandomSource(LAUNCH_GUITAR_TRANSITION_SOUND_SOURCES, random);
}

export function playLaunchChairTransitionSound(): string | null {
  return playRandomSource([LAUNCH_CHAIR_TRANSITION_SOUND_SOURCE], () => 0);
}

export function playLaunchFootballTransitionSound(): string | null {
  return playRandomSource([LAUNCH_FOOTBALL_TRANSITION_SOUND_SOURCE], () => 0);
}

export function playLaunchBoardDiceTransitionSound(): string | null {
  return playRandomSource([LAUNCH_BOARD_DICE_TRANSITION_SOUND_SOURCE], () => 0);
}

export function playLaunchCameraTransitionSound(): string | null {
  return playRandomSource([LAUNCH_CAMERA_TRANSITION_SOUND_SOURCE], () => 0);
}

export function playLaunchWateringTransitionSound(): string | null {
  return playRandomSource([LAUNCH_WATERING_TRANSITION_SOUND_SOURCE], () => 0);
}

export function playLaunchGamerTransitionSound(): boolean {
  if ((window as any)._settings?.gameSoundsEnabled !== true || document.hidden) return false;
  stopDecodedGameplayVoices(GAMER_VOICE_IDS);
  const firstResult = playDecodedGameplaySound(LAUNCH_GAMER_TRANSITION_SOUND_SOURCES[0], {
    voiceId: GAMER_VOICE_IDS[0],
    volume: applySoundEffectsMasterGain(1),
  });
  const secondResult = playDecodedGameplaySound(LAUNCH_GAMER_TRANSITION_SOUND_SOURCES[1], {
    voiceId: GAMER_VOICE_IDS[1],
    volume: applySoundEffectsMasterGain(0.7),
  });
  return firstResult !== 'unavailable' || secondResult !== 'unavailable';
}

export function playLaunchSmileTransitionSound(): string | null {
  if ((window as any)._settings?.gameSoundsEnabled !== true || document.hidden) return null;
  stopDecodedGameplayVoices([SMILE_VOICE_ID]);
  const result = playDecodedGameplaySound(LAUNCH_SMILE_TRANSITION_SOUND_SOURCE, {
    voiceId: SMILE_VOICE_ID,
    volume: applySoundEffectsMasterGain(0.84),
  });
  return result === 'unavailable' ? null : LAUNCH_SMILE_TRANSITION_SOUND_SOURCE;
}

export function playLaunchPaperBagTransitionSound(): string | null {
  if ((window as any)._settings?.gameSoundsEnabled !== true || document.hidden) return null;
  stopDecodedGameplayVoices([PAPER_BAG_VOICE_ID]);
  const result = playDecodedGameplaySound(LAUNCH_PAPER_BAG_TRANSITION_SOUND_SOURCE, {
    voiceId: PAPER_BAG_VOICE_ID,
    volume: applySoundEffectsMasterGain(0.7),
  });
  return result === 'unavailable' ? null : LAUNCH_PAPER_BAG_TRANSITION_SOUND_SOURCE;
}

export function playLaunchSleepyTransitionSounds(): boolean {
  if ((window as any)._settings?.gameSoundsEnabled !== true || document.hidden) return false;
  retireSleepySequence();
  const firstResult = playDecodedGameplaySound(LAUNCH_SLEEPY_TRANSITION_SOUND_SOURCES[0], {
    voiceId: SLEEPY_VOICE_IDS[0],
    volume: applySoundEffectsMasterGain(0.7),
  });
  if (firstResult === 'unavailable') return false;
  playDecodedGameplaySound(LAUNCH_SLEEPY_TRANSITION_SOUND_SOURCES[1], {
    voiceId: SLEEPY_VOICE_IDS[1],
    volume: applySoundEffectsMasterGain(0.7),
    startDelaySeconds: SLEEPY_MIDPOINT_SECONDS,
  });
  return true;
}

export function stopLaunchLogoTransitionSound(): void {
  retireSleepySequence();
  stopDecodedGameplayVoices([VOICE_ID, ...GAMER_VOICE_IDS, SMILE_VOICE_ID, PAPER_BAG_VOICE_ID]);
}
