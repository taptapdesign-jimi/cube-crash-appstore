import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const BOARD_POPIN_SOUND_SOURCE = './assets/sound/board etting up/setting up boards.wav';
export const BOARD_POPIN_SOUND_LAYERS = [
  { source: BOARD_POPIN_SOUND_SOURCE, voiceId: 'board-popin-setting-up', gain: 0.5 },
  { source: './assets/sound/board etting up/plump.wav', voiceId: 'board-popin-plump', gain: 0.7 },
  { source: './assets/sound/board etting up/setting up2.wav', voiceId: 'board-popin-setting-up2', gain: 0.7 },
  { source: './assets/sound/board etting up/cubes.wav', voiceId: 'board-popin-cubes', gain: 0.4, enterOnly: true },
] as const;
const VOICE_IDS = BOARD_POPIN_SOUND_LAYERS.map(layer => layer.voiceId);
let generation = 0;

export function preloadBoardPopInSound(): boolean {
  if ((window as any)._settings?.gameSoundsEnabled !== true) return false;
  return preloadDecodedGameplaySounds(BOARD_POPIN_SOUND_LAYERS.map(layer => layer.source));
}

export function stopBoardPopInSound(): void {
  generation++;
  stopDecodedGameplayVoices(VOICE_IDS);
}

/** Shared bounded three-layer cue for board entry/exit; retired animation cleanup cannot stop its successor. */
export function playBoardPopInSound(durationSeconds: number, phase: 'enter' | 'exit' = 'enter'): () => void {
  stopBoardPopInSound();
  const owner = generation;
  if ((window as any)._settings?.gameSoundsEnabled === true && durationSeconds > 0) {
    for (const layer of BOARD_POPIN_SOUND_LAYERS) {
      if ('enterOnly' in layer && layer.enterOnly && phase !== 'enter') continue;
      playDecodedGameplaySound(layer.source, {
        voiceId: layer.voiceId,
        volume: applySoundEffectsMasterGain(layer.gain),
        stopAfterSeconds: durationSeconds,
        fadeOutSeconds: Math.min(0.05, durationSeconds),
      });
    }
  }
  return () => {
    if (generation === owner) stopBoardPopInSound();
  };
}
