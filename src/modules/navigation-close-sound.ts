import { applySoundEffectsMasterGain } from './sound-effects-volume.ts';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from './gameplay-audio-buffer-player.ts';

export const NAVIGATION_CLOSE_SOUND_SOURCES = [
  './assets/sound/CTA/deppimpact.wav',
] as const;
export const NAVIGATION_CLOSE_SOUND_BASE_VOLUMES = [0.6] as const;
export const NAVIGATION_CLOSE_SOUND_VOLUMES = NAVIGATION_CLOSE_SOUND_BASE_VOLUMES.map(
  applySoundEffectsMasterGain,
);
const VOICE_IDS = [
  'navigation-back-close-deep-impact',
] as const;
const SELECTOR = [
  '#collectibles-back',
  '#detail-close-btn',
  '#settings-back-btn',
  '#stats-back-btn',
  '#hud-close-button',
  '.collectibles-back-button',
  '.detail-close-button',
  '.settings-back-button',
  '.gameplay-sheet-close',
  'button.close-button',
  'button[aria-label^="Back"]',
  'button[aria-label^="Close"]',
].join(',');

let initialized = false;

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !(event.target instanceof Element) || !event.target.closest(SELECTOR)) return;
  playNavigationCloseSound();
}

export function playNavigationCloseSound(): boolean {
  if (typeof window === 'undefined' || (window as any)._settings?.gameSoundsEnabled !== true) return false;
  stopNavigationCloseSound();
  const results = NAVIGATION_CLOSE_SOUND_SOURCES.map((source, index) => (
    playDecodedGameplaySound(source, {
      voiceId: VOICE_IDS[index],
      volume: NAVIGATION_CLOSE_SOUND_VOLUMES[index],
    })
  ));
  return results.every((result) => result !== 'unavailable');
}

export function initNavigationCloseSound(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;
  preloadDecodedGameplaySounds(NAVIGATION_CLOSE_SOUND_SOURCES);
  document.addEventListener('pointerdown', onPointerDown, true);
}

export function stopNavigationCloseSound(): void {
  stopDecodedGameplayVoices(VOICE_IDS);
}
