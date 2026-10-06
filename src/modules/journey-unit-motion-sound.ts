import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const JOURNEY_UNIT_MOTION_SOUND_SOURCES = [
  './assets/sound/Board transitions/elements down1.wav',
  './assets/sound/Board transitions/elemens down2.wav',
] as const;
export const JOURNEY_UNIT_ENTER_SOUND_SOURCE = JOURNEY_UNIT_MOTION_SOUND_SOURCES[0];
export const JOURNEY_UNIT_EXIT_SOUND_SOURCE = JOURNEY_UNIT_MOTION_SOUND_SOURCES[1];
const UNIT_VOICES = Array.from({ length: 3 }, (_, unit) => (
  JOURNEY_UNIT_MOTION_SOUND_SOURCES.map((_, layer) => `journey-unit-motion-${unit}-${layer}`)
));
const VOICE_IDS = UNIT_VOICES.flat();
let activeStop: (() => void) | null = null;

export function preloadJourneyUnitMotionSounds(): boolean {
  return (window as any)._settings?.gameSoundsEnabled === true
    && preloadDecodedGameplaySounds(JOURNEY_UNIT_MOTION_SOUND_SOURCES);
}

export function stopJourneyUnitMotionSounds(): void {
  activeStop?.();
}

/** Enter uses elements down1 only; exit uses elemens down2 only. */
export function createJourneyUnitMotionSoundSession(
  units: readonly ({ id: string; targets: readonly HTMLElement[] } | { id: string; nativeVisible: boolean })[],
) {
  stopJourneyUnitMotionSounds();
  const lifecycle = createScreenLifecycle('journey-unit-motion-sound');
  const startedDirections = new Set<'enter' | 'exit'>();
  // Snapshot visibility before animation writes; no layout reads on tween ticks.
  const visible = new Set(units.filter(unit => 'nativeVisible' in unit ? unit.nativeVisible : unit.targets.some(target => {
    if (!target.isConnected) return false;
    const rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0
      && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  })).map(unit => unit.id));
  let stopped = false;
  let nextVoice = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    lifecycle.cleanup();
    if (activeStop !== stop) return;
    activeStop = null;
    stopDecodedGameplayVoices(VOICE_IDS);
  };
  activeStop = stop;
  lifecycle.trackListener(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  lifecycle.trackListener(window, 'pagehide', stop);

  const play = (unitId: string, direction: 'enter' | 'exit', durationSeconds: number, source: string) => {
      if (stopped || startedDirections.has(direction) || !visible.has(unitId)) return;
      startedDirections.add(direction);
      if ((window as any)._settings?.gameSoundsEnabled !== true || document.hidden || durationSeconds <= 0) return;
      const voices = UNIT_VOICES[nextVoice++ % UNIT_VOICES.length];
      stopDecodedGameplayVoices(voices);
      playDecodedGameplaySound(source, {
        voiceId: voices[direction === 'enter' ? 0 : 1],
        volume: applySoundEffectsMasterGain(0.5),
        stopAfterSeconds: durationSeconds,
        fadeOutSeconds: Math.min(0.05, durationSeconds),
      });
  };
  return {
    playEnter: (unitId: string, durationSeconds: number) => play(
      unitId,
      'enter',
      durationSeconds,
      JOURNEY_UNIT_ENTER_SOUND_SOURCE,
    ),
    playExit: (unitId: string, durationSeconds: number) => play(
      unitId,
      'exit',
      durationSeconds,
      JOURNEY_UNIT_EXIT_SOUND_SOURCE,
    ),
    stop,
  };
}
