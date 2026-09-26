import { MOBILE_RUNTIME_PROFILE } from '../mobile-runtime-profile';
import * as decoded from '../gameplay-audio-buffer-player';
import {
  playJourneyWorldsHubSound, playJourneyWorldsWorldSound, reduceJourneyWorldsSoundForWorld,
  fadeOutJourneyWorldsSoundForBoardTransition, armJourneyWorldsSoundForBoardTransition,
  stopJourneyWorldsHubSound, resetJourneyWorldsHubSoundForTests,
} from '../journey-worlds-hub-sound';
import {
  playJourneyForestAmbientSounds, fadeOutJourneyForestAmbientSounds,
  stopJourneyForestAmbientSounds, resetJourneyForestAmbientSoundsForTests,
} from '../journey-forest-ambient-sound';
import {
  playJourneyForestGameplaySound, fadeOutJourneyForestGameplaySound,
  stopJourneyForestGameplaySound, resetJourneyForestGameplaySoundForTests,
} from '../journey-forest-gameplay-sound';
import { getJourneyLongLoopAudioStats } from '../journey-long-loop-lifecycle';

jest.mock('../mobile-runtime-profile', () => ({ MOBILE_RUNTIME_PROFILE: { isMobileDevice: true } }));
jest.mock('../gameplay-audio-buffer-player', () => ({
  getDecodedGameplaySoundsState: jest.fn(() => 'ready'),
  playDecodedGameplaySound: jest.fn(() => 'played'),
  stopDecodedGameplayVoice: jest.fn(), stopDecodedGameplayVoices: jest.fn(),
  fadeOutDecodedGameplayVoice: jest.fn(), setDecodedGameplayVoiceVolume: jest.fn(),
  preloadDecodedGameplaySounds: jest.fn(),
}));

class LoopAudio {
  static instances: LoopAudio[] = [];
  preload = '';
  loop = false;
  currentTime = 0;
  volume = 1;
  paused = true;
  ended = false;
  load = jest.fn();
  pause = jest.fn(() => { this.paused = true; });
  play = jest.fn(() => { this.paused = false; return Promise.resolve(); });
  constructor(public src: string) { LoopAudio.instances.push(this); }
}

const owners = [
  { id: 'worlds', play: playJourneyWorldsHubSound, stop: stopJourneyWorldsHubSound, fade: fadeOutJourneyWorldsSoundForBoardTransition, count: 1 },
  { id: 'forest-world', play: playJourneyForestAmbientSounds, stop: stopJourneyForestAmbientSounds, fade: fadeOutJourneyForestAmbientSounds, count: 2 },
  { id: 'forest-gameplay', play: () => playJourneyForestGameplaySound({ boardNumber: 7, isArcade: false }), stop: stopJourneyForestGameplaySound, fade: fadeOutJourneyForestGameplaySound, count: 1 },
];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('Journey long-loop route and foreground ownership', () => {
  const originalAudio = global.Audio;
  const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
  let hidden = false;
  const visibility = (value: boolean) => {
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const nativeActive = () => window.dispatchEvent(new Event('cc:native-audio-active'));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    jest.clearAllMocks();
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    global.Audio = LoopAudio as unknown as typeof Audio;
    LoopAudio.instances = [];
    (window as Window & { _settings?: { gameSoundsEnabled: boolean } })._settings = { gameSoundsEnabled: true };
    MOBILE_RUNTIME_PROFILE.isMobileDevice = true;
  });

  afterEach(() => {
    resetJourneyWorldsHubSoundForTests();
    resetJourneyForestAmbientSoundsForTests();
    resetJourneyForestGameplaySoundForTests();
    global.Audio = originalAudio;
    if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor);
    else delete (document as Document & { hidden?: boolean }).hidden;
    delete (window as Window & { _settings?: unknown })._settings;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each(owners)('$id pauses and resumes the same media position without duplicate foreground play', async (owner) => {
    owner.play();
    await flush();
    LoopAudio.instances.forEach(audio => { audio.currentTime = 12; });
    visibility(true);
    expect(LoopAudio.instances.every(audio => audio.paused && audio.currentTime === 12)).toBe(true);
    expect(getJourneyLongLoopAudioStats()).toMatchObject({ playingMedia: 0, suspendedOwners: 1 });
    visibility(false);
    window.dispatchEvent(new Event('pageshow'));
    nativeActive();
    await flush();
    expect(LoopAudio.instances).toHaveLength(owner.count);
    LoopAudio.instances.forEach(audio => {
      expect(audio.play).toHaveBeenCalledTimes(2);
      expect(audio.currentTime).toBe(12);
      expect(audio.paused).toBe(false);
    });
    owner.stop();
    visibility(true); visibility(false); nativeActive();
    LoopAudio.instances.forEach(audio => expect(audio.play).toHaveBeenCalledTimes(2));
    expect(getJourneyLongLoopAudioStats()).toMatchObject({ activeOwners: 0, playingMedia: 0, pendingMediaPlays: 0 });
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(owners)('$id starts hidden without playing and resumes only from a native-active event while WKWebView hidden is stale', async (owner) => {
    hidden = true;
    owner.play();
    LoopAudio.instances.forEach(audio => expect(audio.play).not.toHaveBeenCalled());
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));
    LoopAudio.instances.forEach(audio => expect(audio.play).not.toHaveBeenCalled());
    nativeActive();
    await flush();
    LoopAudio.instances.forEach(audio => expect(audio.play).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event('pagehide'));
    expect(LoopAudio.instances.every(audio => audio.paused)).toBe(true);
    owner.stop();
    nativeActive();
    LoopAudio.instances.forEach(audio => expect(audio.play).toHaveBeenCalledTimes(1));
  });

  test.each(owners)('$id retires an in-flight fade on background and never resumes its departing screen', async (owner) => {
    owner.play();
    await flush();
    owner.fade();
    jest.advanceTimersByTime(200);
    visibility(true);
    expect(jest.getTimerCount()).toBe(0);
    expect(getJourneyLongLoopAudioStats()).toMatchObject({ activeOwners: 0, playingMedia: 0 });
    visibility(false); nativeActive();
    LoopAudio.instances.forEach(audio => expect(audio.play).toHaveBeenCalledTimes(1));
  });

  test.each(owners)('$id retires a fade requested while suspended and obeys Sounds OFF before foreground', async (owner) => {
    owner.play(); await flush(); visibility(true); owner.fade(); visibility(false);
    expect(LoopAudio.instances.every(audio => audio.paused)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    owner.play(); await flush(); visibility(true);
    (window as Window & { _settings?: { gameSoundsEnabled: boolean } })._settings.gameSoundsEnabled = false;
    visibility(false);
    expect(getJourneyLongLoopAudioStats()).toMatchObject({ activeOwners: 0, playingMedia: 0 });
  });

  test.each(owners)('$id retries a rejected media start and ignores a late rejection from the replaced generation', async (owner) => {
    owner.play(); await flush(); owner.stop();
    const first = LoopAudio.instances[0];
    first.play.mockRejectedValueOnce(new Error('autoplay blocked'));
    owner.play(); await flush();
    expect(getJourneyLongLoopAudioStats()).toMatchObject({ activeOwners: 0, playingMedia: 0, failedStarts: 1 });
    owner.play(); await flush();
    expect(first.paused).toBe(false);
    owner.stop();
    let rejectOld!: (error: Error) => void;
    first.play.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectOld = reject; }));
    owner.play(); visibility(true); visibility(false); await flush();
    const calls = first.play.mock.calls.length;
    rejectOld(new Error('old aborted play')); await flush();
    expect(first.paused).toBe(false);
    owner.play();
    expect(first.play).toHaveBeenCalledTimes(calls);
    expect(getJourneyLongLoopAudioStats()).toMatchObject({ activeOwners: 1, playingMedia: owner.count, failedStarts: 1 });
  });

  test.each(owners)('$id retires decoded sources while hidden and reacquires only the still-active owner', (owner) => {
    MOBILE_RUNTIME_PROFILE.isMobileDevice = false;
    owner.play();
    expect(decoded.playDecodedGameplaySound).toHaveBeenCalledTimes(owner.count);
    visibility(true);
    const stops = jest.mocked(decoded.stopDecodedGameplayVoice).mock.calls.length
      + jest.mocked(decoded.stopDecodedGameplayVoices).mock.calls.length;
    expect(stops).toBeGreaterThan(0);
    visibility(false);
    expect(decoded.playDecodedGameplaySound).toHaveBeenCalledTimes(owner.count * 2);
    owner.stop(); nativeActive();
    expect(decoded.playDecodedGameplaySound).toHaveBeenCalledTimes(owner.count * 2);
    expect(LoopAudio.instances).toHaveLength(0);
  });

  test.each(owners)('$id late play completion cannot survive stop or pause a newer media session', async (owner) => {
    owner.play(); await flush(); owner.stop();
    const audio = LoopAudio.instances[0];
    let complete!: () => void;
    audio.play.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
    owner.play(); owner.stop();
    audio.paused = false;
    complete(); await flush();
    expect(audio.paused).toBe(true);
    audio.play.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
    owner.play(); owner.stop(); owner.play(); await flush();
    complete(); await flush();
    expect(audio.paused).toBe(false);
    expect(getJourneyLongLoopAudioStats().activeOwners).toBe(1);
  });

  test('World hold retains its deadline across background and cannot replay after expiry or board handoff', async () => {
    playJourneyWorldsWorldSound(); await flush();
    jest.advanceTimersByTime(1000); visibility(true);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(2000); visibility(false); await flush();
    expect(LoopAudio.instances[0].play).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(3000);
    expect(LoopAudio.instances[0].paused).toBe(true);
    playJourneyWorldsWorldSound(); await flush(); visibility(true);
    jest.advanceTimersByTime(6000); visibility(false);
    expect(LoopAudio.instances[0].play).toHaveBeenCalledTimes(3);
    expect(LoopAudio.instances[0].paused).toBe(true);
    playJourneyWorldsWorldSound(); await flush();
    armJourneyWorldsSoundForBoardTransition(); visibility(true); visibility(false);
    expect(LoopAudio.instances[0].play).toHaveBeenCalledTimes(4);
    expect(getJourneyLongLoopAudioStats().activeOwners).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('returning to Hub during the World fade restores a continuing Hub owner', async () => {
    playJourneyWorldsWorldSound(); await flush();
    jest.advanceTimersByTime(5200);
    playJourneyWorldsHubSound(); visibility(true); visibility(false); await flush();
    jest.advanceTimersByTime(10000);
    expect(LoopAudio.instances[0].paused).toBe(false);
    expect(getJourneyLongLoopAudioStats().activeOwners).toBe(1);
  });

  test('returning to Hub cancels a prior board-transition handoff deadline', async () => {
    playJourneyWorldsWorldSound(); await flush();
    armJourneyWorldsSoundForBoardTransition();
    playJourneyWorldsHubSound();
    jest.advanceTimersByTime(13000);
    expect(LoopAudio.instances[0].paused).toBe(false);
    expect(getJourneyLongLoopAudioStats().activeOwners).toBe(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('repeated Forest World → gameplay → result return keeps only the authored overlap and stops all on Home', async () => {
    for (let visit = 0; visit < 3; visit++) {
      playJourneyWorldsWorldSound(); playJourneyForestAmbientSounds(); await flush();
      expect(getJourneyLongLoopAudioStats().playingMedia).toBe(3);
      jest.advanceTimersByTime(6000);
      expect(getJourneyLongLoopAudioStats().playingMedia).toBe(2);
      armJourneyWorldsSoundForBoardTransition(); fadeOutJourneyForestAmbientSounds();
      stopJourneyWorldsHubSound({ preserveBoardTransitionHandoff: true });
      stopJourneyForestAmbientSounds({ preserveActiveFade: true });
      fadeOutJourneyWorldsSoundForBoardTransition();
      jest.advanceTimersByTime(1500);
      expect(getJourneyLongLoopAudioStats().playingMedia).toBe(0);
      playJourneyForestGameplaySound({ boardNumber: 7, isArcade: false }); await flush();
      expect(getJourneyLongLoopAudioStats().playingMedia).toBe(1);
      fadeOutJourneyForestGameplaySound();
      stopJourneyForestGameplaySound({ preserveActiveFade: true });
      jest.advanceTimersByTime(2000);
      expect(getJourneyLongLoopAudioStats()).toMatchObject({ activeOwners: 0, playingMedia: 0 });
    }
    playJourneyWorldsWorldSound(); playJourneyForestAmbientSounds(); await flush();
    stopJourneyForestAmbientSounds(); playJourneyWorldsHubSound(); stopJourneyWorldsHubSound();
    expect(getJourneyLongLoopAudioStats()).toMatchObject({ activeOwners: 0, playingMedia: 0, retainedMedia: 4 });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('three owner stats account for four detached media loops and repeated routes release every listener', async () => {
    const docAdd = jest.spyOn(document, 'addEventListener');
    const docRemove = jest.spyOn(document, 'removeEventListener');
    const winAdd = jest.spyOn(window, 'addEventListener');
    const winRemove = jest.spyOn(window, 'removeEventListener');
    for (let cycle = 0; cycle < 3; cycle++) {
      owners.forEach(owner => owner.play()); await flush();
      const snapshot = getJourneyLongLoopAudioStats();
      expect(snapshot).toMatchObject({ activeOwners: 3, retainedMedia: 4, playingMedia: 4, pendingMediaPlays: 0 });
      expect(snapshot.owners).toHaveLength(3);
      reduceJourneyWorldsSoundForWorld();
      owners.forEach(owner => owner.stop());
      expect(jest.getTimerCount()).toBe(0);
    }
    docAdd.mock.calls.forEach(([event, callback]) => expect(docRemove).toHaveBeenCalledWith(event, callback));
    winAdd.mock.calls.forEach(([event, callback]) => expect(winRemove).toHaveBeenCalledWith(event, callback));
    expect(docAdd.mock.calls).toHaveLength(9);
    expect(winAdd.mock.calls).toHaveLength(27);
    expect(docRemove.mock.calls).toHaveLength(9);
    expect(winRemove.mock.calls).toHaveLength(27);
    expect(LoopAudio.instances).toHaveLength(4);
  });
});
