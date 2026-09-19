/** @jest-environment jsdom */
import fs from 'node:fs';
import {
  isLaserGunMerge6SoundEvent,
  LASER_GUN_BEAM_CUES,
  LASER_GUN_FINAL_CHANGED_CUBE_CUE,
  LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE,
  LASER_GUN_MERGE6_CUES,
  LASER_GUN_STAGE_PREPARATION_GAIN,
  LASER_GUN_STAGE_PREPARATION_SOURCE,
  playLaserGunBeamSound,
  playLaserGunChangedCubeSound,
  playLaserGunMerge6AddonSounds,
  playLaserGunStagePreparationSound,
  preloadLaserGunMerge6Sounds,
  stopLaserGunFinaleSounds,
  stopLaserGunMerge6Sounds,
} from '../laser-gun-merge6-sound';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  stopDecodedGameplayVoices,
} from '../gameplay-audio-buffer-player';
import {
  beginCoreTntBonusImpactSoundSequence,
  playCoreTntBonusImpactSound,
  preloadCoreTntBonusImpactSounds,
  stopCoreTntBonusImpactSounds,
} from '../core-tnt-merge6-sound';

jest.mock('../gameplay-audio-buffer-player', () => ({
  playDecodedGameplaySound: jest.fn(() => 'played'),
  preloadDecodedGameplaySounds: jest.fn(() => true),
  stopDecodedGameplayVoices: jest.fn(),
}));
jest.mock('../core-tnt-merge6-sound', () => ({
  beginCoreTntBonusImpactSoundSequence: jest.fn(() => true),
  playCoreTntBonusImpactSound: jest.fn(() => true),
  preloadCoreTntBonusImpactSounds: jest.fn(() => true),
  stopCoreTntBonusImpactSounds: jest.fn(),
}));

beforeEach(() => {
  stopLaserGunMerge6Sounds();
  jest.clearAllMocks();
  jest.mocked(playDecodedGameplaySound).mockReturnValue('played');
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(true);
  jest.mocked(beginCoreTntBonusImpactSoundSequence).mockReturnValue(true);
  jest.mocked(playCoreTntBonusImpactSound).mockReturnValue(true);
  jest.mocked(preloadCoreTntBonusImpactSounds).mockReturnValue(true);
  (window as any)._settings = { gameSoundsEnabled: true };
});

afterEach(() => {
  stopLaserGunMerge6Sounds();
  delete (window as any)._settings;
  jest.restoreAllMocks();
});

test('adds horn and gun prep beside only a committed LaserGun merge-6', () => {
  expect(playLaserGunMerge6AddonSounds()).toBe(true);
  expect(beginCoreTntBonusImpactSoundSequence).toHaveBeenCalledTimes(1);
  expect(LASER_GUN_MERGE6_CUES.map(({ source }) => source)).toEqual([
    './assets/sound/Wild and special kockice/tnt/horn.wav',
    './assets/sound/Wild and special kockice/gun/prep.wav',
  ]);
  LASER_GUN_MERGE6_CUES.forEach(({ source, gain }, index) => {
    expect(fs.existsSync(source)).toBe(true);
    expect(playDecodedGameplaySound).toHaveBeenNthCalledWith(
      index + 1,
      source,
      expect.objectContaining({ volume: gain * 0.6, playbackRate: 1 }),
    );
  });
  expect(isLaserGunMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'laser-gun' })).toBe(true);
  expect(isLaserGunMerge6SoundEvent({ effectiveSum: 6, dstSpecialDiceVariantId: 'laser-gun' })).toBe(true);
  expect(isLaserGunMerge6SoundEvent({ effectiveSum: 5, dstSpecialDiceVariantId: 'laser-gun' })).toBe(false);
  expect(isLaserGunMerge6SoundEvent({ effectiveSum: 6, dstSpecialDiceVariantId: 'flower' })).toBe(false);
});

test('plays stage preparation and layers both beam sources on every shot', () => {
  expect(playLaserGunStagePreparationSound(0)).toBe(true);
  expect(playDecodedGameplaySound).toHaveBeenLastCalledWith(
    LASER_GUN_STAGE_PREPARATION_SOURCE,
    expect.objectContaining({
      voiceId: 'laser-gun-stage-preparation-0',
      volume: LASER_GUN_STAGE_PREPARATION_GAIN * 0.6,
    }),
  );
  expect(playLaserGunBeamSound(0)).toBe(true);
  expect(playLaserGunBeamSound(1)).toBe(true);
  const calls = jest.mocked(playDecodedGameplaySound).mock.calls;
  expect(calls.slice(1).map(([source, options]) => ({
    source,
    voiceId: options.voiceId,
    volume: options.volume,
  }))).toEqual([
    {
      source: LASER_GUN_BEAM_CUES[0].source,
      voiceId: 'laser-gun-beam-0-beam1',
      volume: 0.595 * 0.6,
    },
    {
      source: LASER_GUN_BEAM_CUES[1].source,
      voiceId: 'laser-gun-beam-0-beam2',
      volume: 0.42 * 0.6,
    },
    {
      source: LASER_GUN_BEAM_CUES[0].source,
      voiceId: 'laser-gun-beam-1-beam1',
      volume: 0.595 * 0.6,
    },
    {
      source: LASER_GUN_BEAM_CUES[1].source,
      voiceId: 'laser-gun-beam-1-beam2',
      volume: 0.42 * 0.6,
    },
  ]);
  stopLaserGunFinaleSounds();
  expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(expect.arrayContaining([
    'laser-gun-stage-preparation-0',
    'laser-gun-beam-0-beam1',
    'laser-gun-beam-0-beam2',
    'laser-gun-beam-1-beam1',
    'laser-gun-beam-1-beam2',
  ]));
});

test('starts a separate preparation cue for every laser before its beam', () => {
  [0, 1, 2, 3].forEach((shotIndex) => {
    expect(playLaserGunStagePreparationSound(shotIndex)).toBe(true);
  });
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source, options]) => ({
    source,
    voiceId: options.voiceId,
  }))).toEqual([0, 1, 2, 3].map((shotIndex) => ({
    source: LASER_GUN_STAGE_PREPARATION_SOURCE,
    voiceId: `laser-gun-stage-preparation-${shotIndex}`,
  })));
});

test('lets both fourth-shot beam layers finish after the laser leaves the viewport', () => {
  playLaserGunStagePreparationSound(0);
  [0, 1, 2, 3].forEach((shotIndex) => expect(playLaserGunBeamSound(shotIndex)).toBe(true));
  stopLaserGunFinaleSounds();
  const stopCalls = jest.mocked(stopDecodedGameplayVoices).mock.calls;
  const stoppedIds = stopCalls[stopCalls.length - 1]?.[0] ?? [];
  expect(stoppedIds).toEqual(expect.arrayContaining([
    'laser-gun-stage-preparation-0',
    'laser-gun-beam-0-beam1',
    'laser-gun-beam-0-beam2',
    'laser-gun-beam-1-beam1',
    'laser-gun-beam-1-beam2',
    'laser-gun-beam-2-beam1',
    'laser-gun-beam-2-beam2',
  ]));
  expect(stoppedIds).not.toContain('laser-gun-beam-3-beam1');
  expect(stoppedIds).not.toContain('laser-gun-beam-3-beam2');
  stopLaserGunMerge6Sounds();
  expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(expect.arrayContaining([
    'laser-gun-beam-3-beam1',
    'laser-gun-beam-3-beam2',
  ]));
});

test('adds 80-percent plombing and 70-percent star1 only to the fourth changed cube', () => {
  [0, 1, 2, 3].forEach((index) => expect(playLaserGunChangedCubeSound(index)).toBe(true));
  expect(jest.mocked(playCoreTntBonusImpactSound).mock.calls).toEqual([[0], [1], [2], [3]]);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(2);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source, options]) => ({
    source,
    voiceId: options.voiceId,
    volume: options.volume,
  }))).toEqual([
    {
      source: LASER_GUN_FINAL_CHANGED_CUBE_CUE.source,
      voiceId: LASER_GUN_FINAL_CHANGED_CUBE_CUE.voiceId,
      volume: 0.8 * 0.6,
    },
    {
      source: LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE.source,
      voiceId: LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE.voiceId,
      volume: 0.7 * 0.6,
    },
  ]);
});

test('preloads every exact source and obeys Sounds OFF and cleanup', () => {
  expect(preloadLaserGunMerge6Sounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([
    ...LASER_GUN_MERGE6_CUES.map(({ source }) => source),
    LASER_GUN_STAGE_PREPARATION_SOURCE,
    ...LASER_GUN_BEAM_CUES.map(({ source }) => source),
    LASER_GUN_FINAL_CHANGED_CUBE_CUE.source,
    LASER_GUN_FINAL_CHANGED_CUBE_STAR_CUE.source,
  ]);
  expect(preloadCoreTntBonusImpactSounds).toHaveBeenCalledTimes(1);
  (window as any)._settings.gameSoundsEnabled = false;
  expect(playLaserGunMerge6AddonSounds()).toBe(false);
  expect(playLaserGunStagePreparationSound(0)).toBe(false);
  expect(playLaserGunBeamSound(0)).toBe(false);
  stopLaserGunMerge6Sounds();
  expect(stopCoreTntBonusImpactSounds).toHaveBeenCalled();
});

test('HTMLAudio fallback stays bounded, overlaps separate cues and stops on cleanup', () => {
  const instances: Array<{ src: string; pause: jest.Mock; play: jest.Mock; load: jest.Mock }> = [];
  jest.spyOn(window, 'Audio').mockImplementation((source) => {
    const audio = {
      src: String(source),
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
  expect(preloadLaserGunMerge6Sounds()).toBe(true);
  expect(preloadLaserGunMerge6Sounds()).toBe(true);
  expect(instances).toHaveLength(7);
  expect(playLaserGunMerge6AddonSounds()).toBe(true);
  expect(playLaserGunStagePreparationSound(0)).toBe(true);
  expect(playLaserGunBeamSound(0)).toBe(true);
  expect(playLaserGunChangedCubeSound(3)).toBe(true);
  expect(instances).toHaveLength(14);
  stopLaserGunMerge6Sounds();
  instances.forEach((audio) => expect(audio.pause).toHaveBeenCalled());
});

test('connects merge, stage entry, beam launch, changed-cube and cleanup boundaries', () => {
  const appCore = fs.readFileSync('src/modules/app-core.ts', 'utf8');
  const scene = fs.readFileSync('src/modules/lasergun-finale-scene.ts', 'utf8');
  expect(appCore.match(/playLaserGunMerge6AddonSounds\(\);/g)).toHaveLength(1);
  expect(appCore).toContain('makeBoard.setValueImmediate(tile, replacementValue, 0);');
  expect(appCore).toContain('playLaserGunChangedCubeSound(i);');
  expect(scene.match(/playLaserGunStagePreparationSound\(shot\.index\);/g)).toHaveLength(1);
  expect(scene.match(/playLaserGunBeamSound\(shot\.index\);/g)).toHaveLength(1);
  expect(scene).toContain('stopLaserGunFinaleSounds();');
});
