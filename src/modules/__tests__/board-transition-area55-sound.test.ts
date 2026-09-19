/** @jest-environment jsdom */
import fs from 'node:fs';
import {
  BOARD_TRANSITION_AREA55_ACTION_GAIN,
  BOARD_TRANSITION_AREA55_BEAM_ACTION_GAIN,
  BOARD_TRANSITION_AREA55_BEAM_PREP_ACTION_GAIN,
  BOARD_TRANSITION_AREA55_BEAM_PREP_SOURCE,
  BOARD_TRANSITION_AREA55_BEAM_SOURCE,
  BOARD_TRANSITION_AREA55_BIBICE_ACTION_GAIN,
  BOARD_TRANSITION_AREA55_BIBICE_SOURCE,
  BOARD_TRANSITION_AREA55_FLY2_DELAY_SECONDS,
  BOARD_TRANSITION_AREA55_FLY2_SOURCE,
  BOARD_TRANSITION_AREA55_GUN_BEAM_SOURCE,
  BOARD_TRANSITION_AREA55_START_CUES,
  playBoardTransitionArea55BeamSound,
  playBoardTransitionArea55StartSounds,
  preloadBoardTransitionArea55Sounds,
  resetBoardTransitionArea55SoundsForTests,
  stopBoardTransitionArea55Sounds,
} from '../board-transition-area55-sound';
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

beforeEach(() => {
  jest.useFakeTimers();
  (window as any)._settings = { gameSoundsEnabled: true };
  resetBoardTransitionArea55SoundsForTests();
  jest.clearAllMocks();
  jest.mocked(playDecodedGameplaySound).mockReturnValue('played');
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(true);
});

afterEach(() => {
  resetBoardTransitionArea55SoundsForTests();
  delete (window as any)._settings;
  jest.useRealTimers();
});

test('preloads the complete Area 55 package and added gun layers without renaming them', () => {
  const sources = [
    ...BOARD_TRANSITION_AREA55_START_CUES.map(({ source }) => source),
    BOARD_TRANSITION_AREA55_BEAM_SOURCE,
    BOARD_TRANSITION_AREA55_GUN_BEAM_SOURCE,
    BOARD_TRANSITION_AREA55_BEAM_PREP_SOURCE,
    BOARD_TRANSITION_AREA55_FLY2_SOURCE,
  ];
  expect(sources.map((source) => source.split('/').pop())).toEqual([
    'space.wav', 'djeca.wav', 'fly1.wav', 'bibice.wav',
    'beams.wav', 'beam1.wav', 'prep.wav', 'fly2.wav',
  ]);
  expect(BOARD_TRANSITION_AREA55_BIBICE_SOURCE)
    .toBe('./assets/sound/Wild and special kockice/robo/bibice.wav');
  sources.forEach((source) => expect(fs.existsSync(source)).toBe(true));
  expect(preloadBoardTransitionArea55Sounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(sources);
});

test('starts space, children, fly1 and reduced bibice immediately without beam layers', () => {
  expect(playBoardTransitionArea55StartSounds()).toBe(true);
  expect(BOARD_TRANSITION_AREA55_ACTION_GAIN).toBe(1);
  expect(BOARD_TRANSITION_AREA55_BIBICE_ACTION_GAIN).toBe(0.192);
  expect(BOARD_TRANSITION_AREA55_FLY2_DELAY_SECONDS).toBe(3);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source))
    .toEqual(BOARD_TRANSITION_AREA55_START_CUES.map(({ source }) => source));
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([, options]) => options.volume))
    .toEqual([0.6, 0.6, 0.6, 0.1152]);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source))
    .not.toEqual(expect.arrayContaining([
      BOARD_TRANSITION_AREA55_BEAM_SOURCE,
      BOARD_TRANSITION_AREA55_GUN_BEAM_SOURCE,
      BOARD_TRANSITION_AREA55_BEAM_PREP_SOURCE,
    ]));
  jest.advanceTimersByTime(2999);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(4);
  jest.advanceTimersByTime(1);
  expect(playDecodedGameplaySound).toHaveBeenNthCalledWith(
    5,
    BOARD_TRANSITION_AREA55_FLY2_SOURCE,
    expect.objectContaining({ volume: 0.6, playbackRate: 1 }),
  );
});

test('layers raised beam sources with reduced prep on each visible background beam', () => {
  expect(playBoardTransitionArea55BeamSound(1)).toBe(true);
  expect(playBoardTransitionArea55BeamSound(2)).toBe(true);
  const calls = jest.mocked(playDecodedGameplaySound).mock.calls;
  expect(calls.map(([source]) => source)).toEqual([
    BOARD_TRANSITION_AREA55_BEAM_SOURCE,
    BOARD_TRANSITION_AREA55_GUN_BEAM_SOURCE,
    BOARD_TRANSITION_AREA55_BEAM_PREP_SOURCE,
    BOARD_TRANSITION_AREA55_BEAM_SOURCE,
    BOARD_TRANSITION_AREA55_GUN_BEAM_SOURCE,
    BOARD_TRANSITION_AREA55_BEAM_PREP_SOURCE,
  ]);
  expect(new Set(calls.map(([, options]) => options.voiceId)).size).toBe(6);
  expect(BOARD_TRANSITION_AREA55_BEAM_ACTION_GAIN).toBe(0.5);
  expect(BOARD_TRANSITION_AREA55_BEAM_PREP_ACTION_GAIN).toBe(0.15);
  expect(calls.map(([, options]) => options.volume))
    .toEqual([0.3, 0.3, 0.09, 0.3, 0.3, 0.09]);
});

test('obeys Sounds OFF while its explicit hard stop cancels delayed and active voices', () => {
  playBoardTransitionArea55StartSounds();
  playBoardTransitionArea55BeamSound(1);
  stopBoardTransitionArea55Sounds();
  jest.advanceTimersByTime(3000);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(7);
  expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(expect.arrayContaining([
    expect.stringMatching(/^board-transition-area55-space-/),
    expect.stringMatching(/^board-transition-area55-djeca-/),
    expect.stringMatching(/^board-transition-area55-fly1-/),
    expect.stringMatching(/^board-transition-area55-bibice-/),
    expect.stringMatching(/^board-transition-area55-beam-1-.*-area55$/),
    expect.stringMatching(/^board-transition-area55-beam-1-.*-gun-beam1$/),
    expect.stringMatching(/^board-transition-area55-beam-1-.*-gun-prep$/),
  ]));
  jest.clearAllMocks();
  (window as any)._settings.gameSoundsEnabled = false;
  expect(preloadBoardTransitionArea55Sounds()).toBe(false);
  expect(playBoardTransitionArea55StartSounds()).toBe(false);
  expect(playBoardTransitionArea55BeamSound(2)).toBe(false);
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
});

test('releases every voice only after its own sound naturally ends', () => {
  playBoardTransitionArea55StartSounds();
  playBoardTransitionArea55BeamSound(1);
  jest.advanceTimersByTime(3000);
  const options = jest.mocked(playDecodedGameplaySound).mock.calls.map(([, value]) => value);
  options.forEach((value) => value.onEnded?.());
  jest.mocked(stopDecodedGameplayVoices).mockClear();
  stopBoardTransitionArea55Sounds();
  expect(stopDecodedGameplayVoices).toHaveBeenCalledWith([]);
});

test('connects Area 55 start, exact beam boundary and preload without transition-end cutoff', () => {
  const owner = fs.readFileSync('src/modules/board-transition-screen.ts', 'utf8');
  expect(owner).toContain("const isArea55Transition = resolvedTheme === 'area55';");
  expect(owner).toContain('if (isArea55Transition) preloadBoardTransitionArea55Sounds();');
  expect(owner).toContain('if (isArea55Transition) playBoardTransitionArea55StartSounds();');
  expect(owner).toContain('onStart: () => {\n        playBoardTransitionArea55BeamSound(beam === beamFinal ? 2 : 1);');
  expect(owner.match(/playBoardTransitionArea55BeamSound\(/g)).toHaveLength(1);
  expect(owner.slice(owner.indexOf('function cleanup(')))
    .not.toContain('stopBoardTransitionArea55Sounds();');
});
