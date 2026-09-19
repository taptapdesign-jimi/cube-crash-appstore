/** @jest-environment jsdom */
import fs from 'node:fs';
import { createKantaExitSoundSequence, isKantaMerge6SoundEvent, KANTA_MERGE6_CUES, KANTA_EXIT_BASE_GAIN, KANTA_EXIT_QUIET_GAIN, KANTA_EXIT_SOURCES, KANTA_WALKING_GAIN, KANTA_WALKING_SOURCE, playKantaMerge6Sounds, preloadKantaMerge6Sounds, stopKantaMerge6Sounds } from '../kanta-merge6-sound';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices, setDecodedGameplayVoiceVolume } from '../gameplay-audio-buffer-player';
import { playSpecialMerge6FoundationSound } from '../regular-merge6-sound';
jest.mock('../gameplay-audio-buffer-player', () => ({ playDecodedGameplaySound: jest.fn(() => 'played'), preloadDecodedGameplaySounds: jest.fn(() => true), stopDecodedGameplayVoices: jest.fn(), setDecodedGameplayVoiceVolume: jest.fn() }));
jest.mock('../regular-merge6-sound', () => ({ playSpecialMerge6FoundationSound: jest.fn(() => true), preloadRegularMerge6Sounds: jest.fn() }));

beforeEach(() => {
  stopKantaMerge6Sounds();
  jest.clearAllMocks();
  jest.mocked(playSpecialMerge6FoundationSound).mockReturnValue(true);
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(true);
  jest.mocked(playDecodedGameplaySound).mockReturnValue('played');
  (window as any)._settings = { gameSoundsEnabled: true };
});
afterEach(() => { stopKantaMerge6Sounds(); delete (window as any)._settings; jest.restoreAllMocks(); });

test('adds four immediate layers at requested gains alongside one original foundation', () => {
  expect(playKantaMerge6Sounds()).toBe(true);
  expect(playSpecialMerge6FoundationSound).toHaveBeenCalledTimes(1);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(4);
  expect(KANTA_MERGE6_CUES.map(({ gain }) => gain)).toEqual([1, 0.8, 0.5, 0.9]);
  expect(KANTA_MERGE6_CUES.some(cue => cue.source.endsWith('/horn.wav'))).toBe(false);
  KANTA_MERGE6_CUES.forEach(({ source, gain }, index) => {
    expect(fs.existsSync(source)).toBe(true);
    expect(playDecodedGameplaySound).toHaveBeenNthCalledWith(index + 1, source,
      expect.objectContaining({ volume: gain * 0.6, playbackRate: 1 }));
  });
  expect(isKantaMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'kanta' })).toBe(true);
  expect(isKantaMerge6SoundEvent({ effectiveSum: 6, dstSpecialDiceVariantId: 'kanta' })).toBe(true);
  expect(isKantaMerge6SoundEvent({ effectiveSum: 5, dstSpecialDiceVariantId: 'kanta' })).toBe(false);
  expect(isKantaMerge6SoundEvent({ effectiveSum: 6, srcSpecialDiceVariantId: 'robo-cube' })).toBe(false);
});

test('preloads all eight exact sources only when Sounds is enabled', () => {
  expect(preloadKantaMerge6Sounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([...KANTA_MERGE6_CUES.map(cue => cue.source), ...KANTA_EXIT_SOURCES, KANTA_WALKING_SOURCE]);
  (window as any)._settings.gameSoundsEnabled = false;
  expect(preloadKantaMerge6Sounds()).toBe(false);
  expect(playKantaMerge6Sounds()).toBe(false);
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
});

test('chooses one random exit variant and independently lowers half the exits by 20 percent', () => {
  const values = [0, 0.2, 0.4, 0.8, 0.99, 0.1];
  const random = jest.fn(() => values.shift()!);
  const scene = createKantaExitSoundSequence(random);
  for (const key of ['can-0', 'can-1', 'composite-left']) expect(scene.play(key)).toBe(true);
  expect(scene.play('can-0')).toBe(false);
  expect(random).toHaveBeenCalledTimes(6);
  const calls = jest.mocked(playDecodedGameplaySound).mock.calls;
  expect(calls.map(([source]) => source)).toEqual(KANTA_EXIT_SOURCES);
  expect(KANTA_EXIT_BASE_GAIN).toBe(0.455);
  expect(KANTA_EXIT_QUIET_GAIN).toBe(0.364);
  const volumes = calls.map(([, options]) => options.volume);
  expect(volumes[0]).toBeCloseTo(0.2184);
  expect(volumes[1]).toBeCloseTo(0.273);
  expect(volumes[2]).toBeCloseTo(0.2184);
  const ids = calls.map(([, options]) => options.voiceId);
  expect(new Set(ids).size).toBe(3);
  scene.stop();
  expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(ids);
  expect(scene.play('late')).toBe(false);
  const next = createKantaExitSoundSequence(() => 0);
  expect(next.play('can-0')).toBe(true);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls[3][1].voiceId).not.toBe(ids[0]);
  next.stop();
});

test('does not launch a pending fallback after interruption or replay an exit muted at its start', () => {
  jest.mocked(playDecodedGameplaySound).mockReturnValue('pending');
  const scene = createKantaExitSoundSequence(() => 0);
  scene.play('first');
  const pending = jest.mocked(playDecodedGameplaySound).mock.calls[0][1];
  scene.stop();
  const audio = jest.spyOn(window, 'Audio');
  pending.onDeferredUnavailable?.();
  expect(audio).not.toHaveBeenCalled();
  const muted = createKantaExitSoundSequence();
  (window as any)._settings.gameSoundsEnabled = false;
  expect(muted.play('can')).toBe(false);
  (window as any)._settings.gameSoundsEnabled = true;
  expect(muted.play('can')).toBe(false);
  muted.stop();
});

test('connects only the committed Kanta event and cleanup/settings boundaries', () => {
  const core = fs.readFileSync('src/modules/app-core.ts', 'utf8');
  expect(core.match(/playKantaMerge6Sounds\(\);/g)).toHaveLength(1);
  expect(core).toContain('isKantaMerge6SoundEvent({');
  expect(core).toContain('stopKantaMerge6Sounds();');
  expect(fs.readFileSync('src/modules/ui-manager.ts', 'utf8')).toContain('stopKantaMerge6Sounds();');
});

test('fades only the current scene bibis from 50 percent and stops at animation end', () => {
  playKantaMerge6Sounds();
  const first = createKantaExitSoundSequence();
  first.fadeBibis(0.5);
  expect(setDecodedGameplayVoiceVolume).toHaveBeenLastCalledWith('kanta-merge6-bibis', 0.15);
  first.fadeBibis(1);
  expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(['kanta-merge6-bibis']);
  playKantaMerge6Sounds();
  const second = createKantaExitSoundSequence();
  jest.mocked(setDecodedGameplayVoiceVolume).mockClear();
  first.fadeBibis(0.8);
  expect(setDecodedGameplayVoiceVolume).not.toHaveBeenCalled();
  second.fadeBibis(0.2);
  expect(setDecodedGameplayVoiceVolume).toHaveBeenLastCalledWith('kanta-merge6-bibis', 0.24);
  second.stop();
});

test('HTMLAudio fallback reuses prepared sources, follows bibis fade and stops overlapping exit voices', () => {
  const instances: Array<{ src: string; volume: number; pause: jest.Mock; play: jest.Mock; load: jest.Mock }> = [];
  jest.spyOn(window, 'Audio').mockImplementation((source) => {
    const audio = { src: String(source), volume: 1, currentTime: 0, playbackRate: 1,
      onended: null, onerror: null, preload: '', pause: jest.fn(), play: jest.fn(() => Promise.resolve()), load: jest.fn() };
    instances.push(audio);
    return audio as unknown as HTMLAudioElement;
  });
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(false);
  jest.mocked(playDecodedGameplaySound).mockReturnValue('unavailable');
  expect(preloadKantaMerge6Sounds()).toBe(true);
  expect(preloadKantaMerge6Sounds()).toBe(true);
  expect(instances).toHaveLength(8);
  playKantaMerge6Sounds();
  expect(instances).toHaveLength(8);
  const scene = createKantaExitSoundSequence(() => 0);
  expect(scene.startWalking()).toBe(true);
  expect(scene.startWalking()).toBe(false);
  const walking = instances.find(audio => audio.src.endsWith('/hodanje.wav'))!;
  expect(walking.volume).toBe(0.18);
  scene.fadeWalking(0.5);
  expect(walking.volume).toBe(0.09);
  scene.fadeWalking(1);
  expect(walking.pause).toHaveBeenCalled();
  const bibis = instances.find(audio => audio.src.endsWith('/bibis.wav'))!;
  expect(bibis.volume).toBe(0.3);
  scene.fadeBibis(0.5);
  expect(bibis.volume).toBe(0.15);
  scene.play('a');
  scene.play('b');
  const exits = instances.filter(audio => audio.src.endsWith('/kanta1.wav'));
  expect(exits).toHaveLength(2);
  scene.fadeBibis(1);
  expect(bibis.pause).toHaveBeenCalled();
  scene.stop();
  exits.forEach(audio => expect(audio.pause).toHaveBeenCalled());
});

test('walking has one scene-owned voice at 30 percent and keeps its own gain through the final fade', () => {
  const scene = createKantaExitSoundSequence();
  expect(scene.startWalking()).toBe(true);
  expect(scene.startWalking()).toBe(false);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
  const [source, options] = jest.mocked(playDecodedGameplaySound).mock.calls[0];
  expect(source).toBe(KANTA_WALKING_SOURCE);
  expect(KANTA_WALKING_GAIN).toBe(0.3);
  expect(options.volume).toBe(0.18);
  scene.fadeWalking(0.5);
  expect(setDecodedGameplayVoiceVolume).toHaveBeenLastCalledWith(options.voiceId, 0.09);
  scene.fadeWalking(1);
  expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith([options.voiceId]);
  scene.stop();
  expect(scene.startWalking()).toBe(false);
});
