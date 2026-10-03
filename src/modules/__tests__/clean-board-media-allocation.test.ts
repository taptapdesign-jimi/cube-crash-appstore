import {
  CLEAN_BOARD_APPLAUSE_SOUND_SOURCE,
  CLEAN_BOARD_APPLAUSE_VOLUME,
  CLEAN_BOARD_CTA_BOUNCE_SOUND_SOURCE,
  CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE,
  CLEAN_BOARD_FAST_POINTS_STACK_VOLUME,
  CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE,
  CLEAN_BOARD_MONEY_COUNT_VOLUME,
  CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE,
  CLEAN_BOARD_SAXOPHONE_HAPPY_VOLUME,
  CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE,
  CLEAN_BOARD_STAR_BOUNCE_VOLUME,
  CLEAN_BOARD_STAR_HARP_VOLUME,
  createCleanBoardStarHarpOrder,
  playCleanBoardApplauseSound,
  playCleanBoardBonusCountSound,
  playCleanBoardCtaBounceSound,
  playCleanBoardEarnedStarSound,
  playCleanBoardMoneyCountSound,
  playCleanBoardSaxophoneHappySound,
  preloadCleanBoardSounds,
  resetCleanBoardSoundsForTests,
  stopCleanBoardSounds,
} from '../clean-board-sound';
import {
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplayAudioPackage,
  preloadDecodedGameplaySounds,
} from '../gameplay-audio-buffer-player';
import { MOBILE_RUNTIME_PROFILE } from '../mobile-runtime-profile';

jest.mock('../mobile-runtime-profile', () => ({
  MOBILE_RUNTIME_PROFILE: { isMobileDevice: true },
}));

jest.mock('../gameplay-audio-buffer-player', () => ({
  acquireDecodedGameplayAudioPackage: jest.fn(() => ({ admitted: true, release: jest.fn() })),
  getDecodedGameplaySoundsState: jest.fn(() => 'unavailable'),
  playDecodedGameplaySound: jest.fn(),
  preloadDecodedGameplayAudioPackage: jest.fn(),
  preloadDecodedGameplaySounds: jest.fn(),
  stopDecodedGameplayVoices: jest.fn(),
}));

class CountingMedia {
  static instances: CountingMedia[] = [];
  onended: (() => void) | null = null;
  currentTime = 0;
  volume = 0;
  preload = '';
  paused = true;
  load = jest.fn();
  pause = jest.fn(() => { this.paused = true; });
  play = jest.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  constructor(readonly src: string) { CountingMedia.instances.push(this); }
}

describe('Clean Board actual HTML fallback allocation', () => {
  const originalAudio = global.Audio;
  const forSource = (source: string) => CountingMedia.instances.filter(audio => audio.src === source);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    global.Audio = CountingMedia as unknown as typeof Audio;
    CountingMedia.instances = [];
    MOBILE_RUNTIME_PROFILE.isMobileDevice = true;
    (window as any)._settings = { gameSoundsEnabled: true };
    jest.mocked(preloadDecodedGameplayAudioPackage).mockReturnValue(false);
    jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(false);
    jest.mocked(getDecodedGameplaySoundsState).mockReturnValue('unavailable');
  });

  afterEach(() => {
    resetCleanBoardSoundsForTests();
    global.Audio = originalAudio;
    delete (window as any)._settings;
    jest.useRealTimers();
  });

  test('the first two plays use their prepared elements without allocating copies', () => {
    expect(preloadCleanBoardSounds()).toBe(true);
    expect(CountingMedia.instances).toHaveLength(9);
    const applause = forSource(CLEAN_BOARD_APPLAUSE_SOUND_SOURCE)[0];
    const saxophone = forSource(CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE)[0];

    expect(playCleanBoardApplauseSound()).toBe(true);
    expect(playCleanBoardSaxophoneHappySound()).toBe(true);
    expect(CountingMedia.instances).toHaveLength(9);
    expect(applause.play).toHaveBeenCalledTimes(1);
    expect(saxophone.play).toHaveBeenCalledTimes(1);
    expect(applause.volume).toBe(CLEAN_BOARD_APPLAUSE_VOLUME);
    expect(saxophone.volume).toBe(CLEAN_BOARD_SAXOPHONE_HAPPY_VOLUME);
    expect(CountingMedia.instances.every(audio => audio.load.mock.calls.length === 1)).toBe(true);
  });

  test('repeated preload does not copy, pause or restart an already playing source', () => {
    playCleanBoardApplauseSound();
    const applause = forSource(CLEAN_BOARD_APPLAUSE_SOUND_SOURCE)[0];
    applause.currentTime = 2.5;
    const pauseCalls = applause.pause.mock.calls.length;

    for (let index = 0; index < 5; index++) expect(preloadCleanBoardSounds()).toBe(true);

    expect(CountingMedia.instances).toHaveLength(9);
    expect(applause.currentTime).toBe(2.5);
    expect(applause.paused).toBe(false);
    expect(applause.pause).toHaveBeenCalledTimes(pauseCalls);
    expect(applause.play).toHaveBeenCalledTimes(1);
  });

  test('all fourteen authored voices can overlap, then reuse their sources across shuffled results', () => {
    for (let round = 0; round < 25; round++) {
      expect(preloadCleanBoardSounds()).toBe(true);
      playCleanBoardApplauseSound();
      playCleanBoardSaxophoneHappySound();
      playCleanBoardMoneyCountSound(2);
      playCleanBoardBonusCountSound(1);
      const harpOrder = createCleanBoardStarHarpOrder(() => 0);
      harpOrder.forEach((source, index) => expect(playCleanBoardEarnedStarSound(index, source)).toBe(true));
      playCleanBoardCtaBounceSound(0);
      playCleanBoardCtaBounceSound(1);

      expect(CountingMedia.instances).toHaveLength(14);
      expect(CountingMedia.instances.every(audio => !audio.paused && audio.play.mock.calls.length > 0)).toBe(true);
      expect(forSource(CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE)).toHaveLength(2);
      expect(forSource(CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE)).toHaveLength(2);
      expect(forSource(CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE)).toHaveLength(3);
      expect(forSource(CLEAN_BOARD_CTA_BOUNCE_SOUND_SOURCE)).toHaveLength(2);
      expect(forSource(CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE).every(audio => audio.volume === CLEAN_BOARD_STAR_BOUNCE_VOLUME)).toBe(true);
      expect(harpOrder.every(source => forSource(source)[0].volume === CLEAN_BOARD_STAR_HARP_VOLUME)).toBe(true);

      stopCleanBoardSounds();
      stopCleanBoardSounds();
      expect(CountingMedia.instances.every(audio => audio.paused && audio.onended === null)).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    }
  });

  test('reused counters keep both layers and their authored fade duration', () => {
    preloadCleanBoardSounds();
    playCleanBoardMoneyCountSound(2);
    const money = forSource(CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE)[0];
    const fastPoints = forSource(CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE)[0];
    jest.advanceTimersByTime(1850);
    expect(money.volume).toBe(CLEAN_BOARD_MONEY_COUNT_VOLUME);
    expect(fastPoints.volume).toBe(CLEAN_BOARD_FAST_POINTS_STACK_VOLUME);
    jest.advanceTimersByTime(90);
    expect(money.volume).toBeGreaterThan(0);
    expect(money.volume).toBeLessThan(CLEAN_BOARD_MONEY_COUNT_VOLUME);
    expect(fastPoints.volume).toBeGreaterThan(0);
    expect(fastPoints.volume).toBeLessThan(CLEAN_BOARD_FAST_POINTS_STACK_VOLUME);
    jest.advanceTimersByTime(100);
    expect(money.paused).toBe(true);
    expect(fastPoints.paused).toBe(true);
    expect(jest.getTimerCount()).toBe(0);

    playCleanBoardMoneyCountSound(2);
    expect(CountingMedia.instances).toHaveLength(9);
    expect(money.play).toHaveBeenCalledTimes(2);
    expect(fastPoints.play).toHaveBeenCalledTimes(2);
    expect(money.volume).toBe(CLEAN_BOARD_MONEY_COUNT_VOLUME);
    expect(fastPoints.volume).toBe(CLEAN_BOARD_FAST_POINTS_STACK_VOLUME);
  });

  test('mobile decoded preparation allocates media only for long results and Sounds OFF adds nothing', () => {
    jest.mocked(preloadDecodedGameplayAudioPackage).mockReturnValue(true);
    expect(preloadCleanBoardSounds()).toBe(true);
    expect(CountingMedia.instances).toHaveLength(2);
    expect(CountingMedia.instances.map(audio => audio.src)).toEqual([
      CLEAN_BOARD_APPLAUSE_SOUND_SOURCE,
      CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE,
    ]);
    expect(preloadDecodedGameplayAudioPackage).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'result-clean-board-short',
      sources: [
        CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE,
        CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE,
        CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE,
        './assets/sound/Clean board/harp1.wav',
        './assets/sound/Clean board/harp2.wav',
        './assets/sound/Clean board/harp3.wav',
        CLEAN_BOARD_CTA_BOUNCE_SOUND_SOURCE,
      ],
    }));

    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadCleanBoardSounds()).toBe(false);
    expect(playCleanBoardApplauseSound()).toBe(false);
    expect(CountingMedia.instances).toHaveLength(2);
  });

  test('mobile applause and sax never enter decoded playback while short cues stay decoded', () => {
    jest.mocked(preloadDecodedGameplayAudioPackage).mockReturnValue(true);
    jest.mocked(getDecodedGameplaySoundsState).mockReturnValue('ready');
    jest.mocked(playDecodedGameplaySound).mockReturnValue('played');
    expect(preloadCleanBoardSounds()).toBe(true);

    expect(playCleanBoardApplauseSound()).toBe(true);
    expect(playCleanBoardSaxophoneHappySound()).toBe(true);
    expect(playDecodedGameplaySound).not.toHaveBeenCalled();

    expect(playCleanBoardMoneyCountSound(2)).toBe(true);
    expect(playCleanBoardEarnedStarSound(0, createCleanBoardStarHarpOrder(() => 0)[0])).toBe(true);
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(4);
    expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source)).toEqual([
      CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE,
      CLEAN_BOARD_FAST_POINTS_STACK_SOUND_SOURCE,
      CLEAN_BOARD_STAR_BOUNCE_SOUND_SOURCE,
      './assets/sound/Clean board/harp2.wav',
    ]);
  });

  test('desktop retains the decoded-first transport for the complete Clean Board family', () => {
    MOBILE_RUNTIME_PROFILE.isMobileDevice = false;
    jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(true);
    jest.mocked(getDecodedGameplaySoundsState).mockReturnValue('ready');
    jest.mocked(playDecodedGameplaySound).mockReturnValue('played');

    expect(preloadCleanBoardSounds()).toBe(true);
    expect(CountingMedia.instances).toHaveLength(0);
    expect(jest.mocked(preloadDecodedGameplaySounds).mock.calls[0][0]).toEqual(expect.arrayContaining([
      CLEAN_BOARD_APPLAUSE_SOUND_SOURCE,
      CLEAN_BOARD_SAXOPHONE_HAPPY_SOUND_SOURCE,
      CLEAN_BOARD_MONEY_COUNT_SOUND_SOURCE,
    ]));
    expect(playCleanBoardApplauseSound()).toBe(true);
    expect(playCleanBoardSaxophoneHappySound()).toBe(true);
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(2);
  });
});
