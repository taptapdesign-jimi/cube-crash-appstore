/** @jest-environment jsdom */
import fs from 'node:fs';
import {
  isSpaceshipMerge6SoundEvent,
  playSpaceshipBeamStartSounds,
  playSpaceshipExitSound,
  playSpaceshipFinaleStartSounds,
  playSpaceshipMerge6AddonSounds,
  preloadSpaceshipMerge6Sounds,
  SPACESHIP_BEAM_START_CUES,
  SPACESHIP_FINALE_START_CUES,
  SPACESHIP_EXIT_CUE,
  SPACESHIP_MERGE6_CUES,
  stopSpaceshipFinaleSounds,
  stopSpaceshipMerge6Sounds,
} from '../spaceship-merge6-sound';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from '../gameplay-audio-buffer-player';

jest.mock('../gameplay-audio-buffer-player', () => ({
  playDecodedGameplaySound: jest.fn(() => 'played'),
  preloadDecodedGameplaySounds: jest.fn(() => true),
  stopDecodedGameplayVoices: jest.fn(),
}));

const allCues = [
  ...SPACESHIP_MERGE6_CUES,
  ...SPACESHIP_FINALE_START_CUES,
  ...SPACESHIP_BEAM_START_CUES,
  SPACESHIP_EXIT_CUE,
];

beforeEach(() => {
  stopSpaceshipMerge6Sounds();
  jest.clearAllMocks();
  jest.mocked(playDecodedGameplaySound).mockReturnValue('played');
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(true);
  (window as any)._settings = { gameSoundsEnabled: true };
});

afterEach(() => {
  stopSpaceshipMerge6Sounds();
  delete (window as any)._settings;
  jest.restoreAllMocks();
});

test('adds crash, crash2 and entry beside only a committed Spaceship merge-6', () => {
  expect(playSpaceshipMerge6AddonSounds()).toBe(true);
  expect(SPACESHIP_MERGE6_CUES.map(({ source }) => source)).toEqual([
    './assets/sound/Wild and special kockice/spaceship/crash.wav',
    './assets/sound/Wild and special kockice/spaceship/crash2.wav',
    './assets/sound/Wild and special kockice/spaceship/ulazak.wav',
  ]);
  SPACESHIP_MERGE6_CUES.forEach(({ source, gain }, index) => {
    expect(fs.existsSync(source)).toBe(true);
    expect(playDecodedGameplaySound).toHaveBeenNthCalledWith(
      index + 1,
      source,
      expect.objectContaining({ volume: gain * 0.6, playbackRate: 1 }),
    );
  });
  expect(isSpaceshipMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'spaceship' })).toBe(true);
  expect(isSpaceshipMerge6SoundEvent({ effectiveSum: 6, dstSpecialDiceVariantId: 'spaceship' })).toBe(true);
  expect(isSpaceshipMerge6SoundEvent({ effectiveSum: 5, dstSpecialDiceVariantId: 'spaceship' })).toBe(false);
  expect(isSpaceshipMerge6SoundEvent({ effectiveSum: 6, dstSpecialDiceVariantId: 'bottle' })).toBe(false);
});

test('starts abduction and high-pitch layers with the finale at the requested gains', () => {
  expect(playSpaceshipFinaleStartSounds()).toBe(true);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source, options]) => ({
    source,
    voiceId: options.voiceId,
    volume: options.volume,
  }))).toEqual([
    {
      source: './assets/sound/Wild and special kockice/spaceship/abduction.wav',
      voiceId: 'spaceship-finale-abduction',
      volume: 1 * 0.6,
    },
    {
      source: './assets/sound/Wild and special kockice/spaceship/hi pitch beam.wav',
      voiceId: 'spaceship-finale-hi-pitch-beam',
      volume: 0.3 * 0.6,
    },
  ]);
});

test('layers sucking, material and suck beam when the alien beam lights', () => {
  expect(playSpaceshipBeamStartSounds()).toBe(true);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source, options]) => ({
    source,
    voiceId: options.voiceId,
    volume: options.volume,
  }))).toEqual([
    {
      source: './assets/sound/Wild and special kockice/spaceship/sucking.wav',
      voiceId: 'spaceship-beam-sucking',
      volume: 0.5 * 0.6,
    },
    {
      source: './assets/sound/Wild and special kockice/spaceship/materijal.wav',
      voiceId: 'spaceship-beam-material',
      volume: 0.8 * 0.6,
    },
    {
      source: './assets/sound/Wild and special kockice/spaceship/suck beam.wav',
      voiceId: 'spaceship-beam-quick',
      volume: 0.7 * 0.6,
    },
  ]);
});

test('plays departure once when suction completes and the exit begins', () => {
  expect(playSpaceshipExitSound()).toBe(true);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    './assets/sound/Wild and special kockice/spaceship/odlazak.wav',
    expect.objectContaining({
      voiceId: 'spaceship-finale-exit',
      volume: 1 * 0.6,
      playbackRate: 1,
    }),
  );
});

test('preloads exact sources, obeys Sounds OFF and stops finale voices independently', () => {
  allCues.forEach(({ source }) => expect(fs.existsSync(source)).toBe(true));
  expect(preloadSpaceshipMerge6Sounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(allCues.map(({ source }) => source));
  playSpaceshipFinaleStartSounds();
  playSpaceshipBeamStartSounds();
  stopSpaceshipFinaleSounds();
  expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith([
    'spaceship-finale-abduction',
    'spaceship-finale-hi-pitch-beam',
    'spaceship-beam-sucking',
    'spaceship-beam-material',
    'spaceship-beam-quick',
    'spaceship-finale-exit',
  ]);
  (window as any)._settings.gameSoundsEnabled = false;
  expect(playSpaceshipMerge6AddonSounds()).toBe(false);
  expect(playSpaceshipFinaleStartSounds()).toBe(false);
  expect(playSpaceshipBeamStartSounds()).toBe(false);
  expect(playSpaceshipExitSound()).toBe(false);
});

test('HTMLAudio fallback is bounded, overlaps layers and stops every owned voice', () => {
  const instances: Array<{ pause: jest.Mock; play: jest.Mock; load: jest.Mock }> = [];
  jest.spyOn(window, 'Audio').mockImplementation(() => {
    const audio = {
      volume: 1,
      currentTime: 0,
      playbackRate: 1,
      onended: null,
      onerror: null,
      preload: '',
      pause: jest.fn(),
      play: jest.fn(() => Promise.resolve()),
      load: jest.fn(),
    };
    instances.push(audio);
    return audio as unknown as HTMLAudioElement;
  });
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(false);
  jest.mocked(playDecodedGameplaySound).mockReturnValue('unavailable');
  expect(preloadSpaceshipMerge6Sounds()).toBe(true);
  expect(preloadSpaceshipMerge6Sounds()).toBe(true);
  expect(instances).toHaveLength(allCues.length);
  expect(playSpaceshipMerge6AddonSounds()).toBe(true);
  expect(playSpaceshipFinaleStartSounds()).toBe(true);
  expect(playSpaceshipBeamStartSounds()).toBe(true);
  expect(playSpaceshipExitSound()).toBe(true);
  expect(instances).toHaveLength(allCues.length * 2);
  stopSpaceshipMerge6Sounds();
  instances.forEach((audio) => expect(audio.pause).toHaveBeenCalled());
});

test('connects merge, scene start, exact beam-light and cleanup boundaries', () => {
  const appCore = fs.readFileSync('src/modules/app-core.ts', 'utf8');
  const scene = fs.readFileSync('src/modules/spaceship-finale-scene.ts', 'utf8');
  expect(appCore.match(/playSpaceshipMerge6AddonSounds\(\);/g)).toHaveLength(1);
  expect(scene.match(/playSpaceshipFinaleStartSounds\(\);/g)).toHaveLength(1);
  expect(scene).toContain('playSpaceshipBeamStartSounds();');
  expect(scene).toContain('}, undefined, 0.34);');
  expect(scene).toContain('if (!disposed) playSpaceshipExitSound();');
  expect(scene).toContain('}, undefined, SPACESHIP_SAUCER_EXIT_AT_SECONDS);');
  expect(scene).toContain('stopSpaceshipFinaleSounds();');
});
