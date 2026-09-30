import {
  LAUNCH_CHAIR_TRANSITION_SOUND_SOURCE,
  LAUNCH_BOARD_DICE_TRANSITION_SOUND_SOURCE,
  LAUNCH_CAMERA_TRANSITION_SOUND_SOURCE,
  LAUNCH_WATERING_TRANSITION_SOUND_SOURCE,
  LAUNCH_GAMER_TRANSITION_SOUND_SOURCES,
  LAUNCH_SMILE_TRANSITION_SOUND_SOURCE,
  LAUNCH_PAPER_BAG_TRANSITION_SOUND_SOURCE,
  LAUNCH_FOOTBALL_TRANSITION_SOUND_SOURCE,
  LAUNCH_GUITAR_TRANSITION_SOUND_SOURCES,
  LAUNCH_LOGO_TRANSITION_SOUND_SOURCES,
  LAUNCH_SLEEPY_TRANSITION_SOUND_SOURCES,
  playLaunchChairTransitionSound,
  playLaunchBoardDiceTransitionSound,
  playLaunchCameraTransitionSound,
  playLaunchWateringTransitionSound,
  playLaunchGamerTransitionSound,
  playLaunchSmileTransitionSound,
  playLaunchPaperBagTransitionSound,
  playLaunchFootballTransitionSound,
  playLaunchSleepyTransitionSounds,
  playRandomLaunchGuitarTransitionSound,
  playRandomLaunchLogoTransitionSound,
  preloadLaunchChairTransitionSound,
  preloadLaunchBoardDiceTransitionSound,
  preloadLaunchCameraTransitionSound,
  preloadLaunchWateringTransitionSound,
  preloadLaunchGamerTransitionSound,
  preloadLaunchSmileTransitionSound,
  preloadLaunchPaperBagTransitionSound,
  preloadLaunchFootballTransitionSound,
  preloadLaunchSleepyTransitionSounds,
  preloadLaunchGuitarTransitionSounds,
  preloadLaunchLogoTransitionSounds,
  stopLaunchLogoTransitionSound,
} from '../launch-logo-transition-sound';
import {
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
} from '../gameplay-audio-buffer-player';

jest.mock('../gameplay-audio-buffer-player', () => ({
  playDecodedGameplaySound: jest.fn(),
  preloadDecodedGameplaySounds: jest.fn(),
  stopDecodedGameplayVoices: jest.fn(),
}));

beforeEach(() => {
  (window as any)._settings = { gameSoundsEnabled: true };
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  jest.mocked(playDecodedGameplaySound).mockReturnValue('played');
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(true);
});

afterEach(() => {
  stopLaunchLogoTransitionSound();
  delete (window as any)._settings;
  delete (document as any).hidden;
});

test('preloads all three nala variants and maps the random range evenly', () => {
  expect(preloadLaunchLogoTransitionSounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(LAUNCH_LOGO_TRANSITION_SOUND_SOURCES);
  expect(playRandomLaunchLogoTransitionSound(() => 0)).toBe(LAUNCH_LOGO_TRANSITION_SOUND_SOURCES[0]);
  expect(playRandomLaunchLogoTransitionSound(() => 0.34)).toBe(LAUNCH_LOGO_TRANSITION_SOUND_SOURCES[1]);
  expect(playRandomLaunchLogoTransitionSound(() => 0.99)).toBe(LAUNCH_LOGO_TRANSITION_SOUND_SOURCES[2]);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source)).toEqual(
    LAUNCH_LOGO_TRANSITION_SOUND_SOURCES,
  );
  for (const [, options] of jest.mocked(playDecodedGameplaySound).mock.calls) {
    expect(options).toMatchObject({ volume: 0.42 });
  }
});

test('Sounds OFF blocks preload and playback', () => {
  (window as any)._settings.gameSoundsEnabled = false;
  expect(preloadLaunchLogoTransitionSounds()).toBe(false);
  expect(playRandomLaunchLogoTransitionSound(() => 0)).toBeNull();
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
});

test('preloads both guitar variants and splits their logo reveal evenly', () => {
  expect(preloadLaunchGuitarTransitionSounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(LAUNCH_GUITAR_TRANSITION_SOUND_SOURCES);
  expect(playRandomLaunchGuitarTransitionSound(() => 0)).toBe(LAUNCH_GUITAR_TRANSITION_SOUND_SOURCES[0]);
  expect(playRandomLaunchGuitarTransitionSound(() => 0.99)).toBe(LAUNCH_GUITAR_TRANSITION_SOUND_SOURCES[1]);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source)).toEqual(
    LAUNCH_GUITAR_TRANSITION_SOUND_SOURCES,
  );
  for (const [, options] of jest.mocked(playDecodedGameplaySound).mock.calls) {
    expect(options).toMatchObject({ volume: 0.42 });
  }
});

test('preloads and plays chair once for the rocking-chair logo reveal', () => {
  expect(preloadLaunchChairTransitionSound()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([LAUNCH_CHAIR_TRANSITION_SOUND_SOURCE]);
  expect(playLaunchChairTransitionSound()).toBe(LAUNCH_CHAIR_TRANSITION_SOUND_SOURCE);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    LAUNCH_CHAIR_TRANSITION_SOUND_SOURCE,
    expect.objectContaining({ volume: 0.42 }),
  );
});

test('plays the updated football sound exactly once for the football logo reveal', () => {
  expect(preloadLaunchFootballTransitionSound()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([LAUNCH_FOOTBALL_TRANSITION_SOUND_SOURCE]);
  expect(playLaunchFootballTransitionSound()).toBe(LAUNCH_FOOTBALL_TRANSITION_SOUND_SOURCE);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
  const firstOptions = jest.mocked(playDecodedGameplaySound).mock.calls[0][1];
  expect(firstOptions).toMatchObject({ volume: 0.42 });
  expect(firstOptions.onStopped).toBeUndefined();
});

test('plays the board dice sound exactly once for the dice-throwing logo reveal', () => {
  expect(preloadLaunchBoardDiceTransitionSound()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([LAUNCH_BOARD_DICE_TRANSITION_SOUND_SOURCE]);
  expect(playLaunchBoardDiceTransitionSound()).toBe(LAUNCH_BOARD_DICE_TRANSITION_SOUND_SOURCE);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    LAUNCH_BOARD_DICE_TRANSITION_SOUND_SOURCE,
    expect.objectContaining({ volume: 0.42 }),
  );
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
});

test('plays the camera sound exactly once for the photographer logo reveal', () => {
  expect(preloadLaunchCameraTransitionSound()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([LAUNCH_CAMERA_TRANSITION_SOUND_SOURCE]);
  expect(playLaunchCameraTransitionSound()).toBe(LAUNCH_CAMERA_TRANSITION_SOUND_SOURCE);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    LAUNCH_CAMERA_TRANSITION_SOUND_SOURCE,
    expect.objectContaining({ volume: 0.42 }),
  );
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
});

test('plays the watering sound exactly once for the watering logo reveal', () => {
  expect(preloadLaunchWateringTransitionSound()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([LAUNCH_WATERING_TRANSITION_SOUND_SOURCE]);
  expect(playLaunchWateringTransitionSound()).toBe(LAUNCH_WATERING_TRANSITION_SOUND_SOURCE);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    LAUNCH_WATERING_TRANSITION_SOUND_SOURCE,
    expect.objectContaining({ volume: 0.42 }),
  );
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
});

test('plays both gamer layers together for the controller logo reveal', () => {
  expect(preloadLaunchGamerTransitionSound()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(LAUNCH_GAMER_TRANSITION_SOUND_SOURCES);
  expect(playLaunchGamerTransitionSound()).toBe(true);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    LAUNCH_GAMER_TRANSITION_SOUND_SOURCES[0],
    expect.objectContaining({ voiceId: 'launch-logo-gamer', volume: 0.6 }),
  );
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    LAUNCH_GAMER_TRANSITION_SOUND_SOURCES[1],
    expect.objectContaining({ voiceId: 'launch-logo-gamer-2', volume: 0.42 }),
  );
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(2);
});

test('plays the smile layer once through its own overlapping voice', () => {
  expect(preloadLaunchSmileTransitionSound()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([LAUNCH_SMILE_TRANSITION_SOUND_SOURCE]);
  expect(playLaunchSmileTransitionSound()).toBe(LAUNCH_SMILE_TRANSITION_SOUND_SOURCE);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    LAUNCH_SMILE_TRANSITION_SOUND_SOURCE,
    expect.objectContaining({ voiceId: 'launch-logo-smile', volume: 0.504 }),
  );
});

test('plays the paper bag layer once through its own overlapping voice', () => {
  expect(preloadLaunchPaperBagTransitionSound()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith([LAUNCH_PAPER_BAG_TRANSITION_SOUND_SOURCE]);
  expect(playLaunchPaperBagTransitionSound()).toBe(LAUNCH_PAPER_BAG_TRANSITION_SOUND_SOURCE);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(
    LAUNCH_PAPER_BAG_TRANSITION_SOUND_SOURCE,
    expect.objectContaining({ voiceId: 'launch-logo-paper-bag', volume: 0.42 }),
  );
});

test('starts sleepy2 first and layers sleepy1 at its exact 50-percent point', () => {
  expect(preloadLaunchSleepyTransitionSounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(LAUNCH_SLEEPY_TRANSITION_SOUND_SOURCES);
  expect(playLaunchSleepyTransitionSounds()).toBe(true);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source)).toEqual(
    LAUNCH_SLEEPY_TRANSITION_SOUND_SOURCES,
  );
  expect(jest.mocked(playDecodedGameplaySound).mock.calls[0][1]).toMatchObject({
    volume: 0.336,
  });
  expect(jest.mocked(playDecodedGameplaySound).mock.calls[0][1]).not.toHaveProperty('startDelaySeconds');
  expect(jest.mocked(playDecodedGameplaySound).mock.calls[1][1]).toMatchObject({
    volume: 0.336,
    startDelaySeconds: 1.44,
  });
});

test('sleepy cleanup retires both the immediate and audio-clock-scheduled layer', () => {
  playLaunchSleepyTransitionSounds();
  stopLaunchLogoTransitionSound();
  const { stopDecodedGameplayVoices } = jest.requireMock('../gameplay-audio-buffer-player');
  expect(stopDecodedGameplayVoices).toHaveBeenCalledWith([
    'launch-logo-sleepy-2',
    'launch-logo-sleepy-1',
  ]);
});
