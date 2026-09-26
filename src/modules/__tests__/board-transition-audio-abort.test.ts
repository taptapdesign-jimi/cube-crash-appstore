import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {
  playBoardTransitionArea55StartSounds, resetBoardTransitionArea55SoundsForTests,
  stopBoardTransitionArea55Sounds,
} from '../board-transition-area55-sound';
import {
  playBoardTransitionForestAmbientSound, resetBoardTransitionForestAmbientSoundForTests,
  stopBoardTransitionForestAmbientSound,
} from '../board-transition-forest-ambient-sound';
import * as decoded from '../gameplay-audio-buffer-player';

jest.mock('../gameplay-audio-buffer-player', () => ({
  getDecodedGameplaySoundsState: jest.fn(() => 'unavailable'),
  playDecodedGameplaySound: jest.fn(() => 'unavailable'),
  preloadDecodedGameplaySounds: jest.fn(() => false),
  stopDecodedGameplayVoice: jest.fn(), stopDecodedGameplayVoices: jest.fn(),
}));

class TransitionAudio {
  static instances: TransitionAudio[] = [];
  paused = true;
  currentTime = 0;
  volume = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  load = jest.fn();
  pause = jest.fn(() => { this.paused = true; });
  play = jest.fn(() => { this.paused = false; return Promise.resolve(); });
  constructor(public src: string) { TransitionAudio.instances.push(this); }
}

/** Execute the real screen cleanup and public abort with real sound owners.
 * Unrelated graphics are stubs; no copied cleanup/audio implementation. */
function transitionOwner() {
  const source = ts.createSourceFile('board-transition-screen.ts', fs.readFileSync(
    'src/modules/board-transition-screen.ts', 'utf8',
  ), ts.ScriptTarget.Latest, true);
  const cleanupSource = source.statements.filter((node): node is ts.FunctionDeclaration => (
    ts.isFunctionDeclaration(node) && ['cleanup', 'cleanupBoardTransitionScreen'].includes(node.name?.text ?? '')
  )).map(node => node.getText(source)).join('\n');
  const exported = {} as {
    cleanupBoardTransitionScreen(): void;
    cleanupForTest(options?: { preserveDom?: boolean; keepVisibleCover?: boolean; abortAudio?: boolean }): void;
  };
  const overlay = document.createElement('div');
  document.body.append(overlay);
  const noOp = () => {};
  const context = {
    exports: exported, document, window,
    logger: { info: noOp, warn: noOp, error: noOp },
    stopMemSampling: noOp, stopIOSJourneyPerformanceAudit: noOp,
    stopBoardTransitionDigitSounds: noOp,
    stopBoardTransitionForestAmbientSound, stopBoardTransitionArea55Sounds,
    lifecycle: { cleanup: jest.fn() },
    isCleaningUp: false, isTransitionActive: true, transitionGeneration: 1,
    boardTransitionPresentationHandoff: { cancel: jest.fn() },
    activeTransitionSettlement: jest.fn(),
    activeTweens: [], enterTimeline: null, exitTimeline: null, pauseTimeline: null,
    cloudDelayedCalls: [], activeCloudImages: [], cloudTimelines: [], contentTimelines: [],
    stopForestNNBees: noOp, beachShoreAmbientTimeline: null,
    beachAmbientTimelines: new Set(), roboGroundAmbientTimelines: new Set(),
    stopRoboAirCombatMotion: noOp, activeRoboAirCombatVariation: null,
    activeCloudWrappers: [], activeSceneImages: [], activeSceneElements: [],
    currentOverlay: overlay, gsap: { killTweensOf: noOp },
    applyAppPaperSurfaceToElement: noOp,
  };
  vm.runInNewContext(ts.transpileModule(
    `${cleanupSource}\nexport { cleanup as cleanupForTest };`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText, context);
  return { api: exported, context, overlay };
}

const families = [
  { name: 'Forest', start: playBoardTransitionForestAmbientSound, voices: 2 },
  { name: 'Area55', start: playBoardTransitionArea55StartSounds, voices: 4 },
];

describe('Board transition audio tail versus hard abort', () => {
  const originalAudio = global.Audio;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    jest.clearAllMocks();
    jest.mocked(decoded.getDecodedGameplaySoundsState).mockReturnValue('unavailable');
    jest.mocked(decoded.playDecodedGameplaySound).mockReturnValue('unavailable');
    global.Audio = TransitionAudio as unknown as typeof Audio;
    TransitionAudio.instances = [];
    (window as Window & { _settings?: { gameSoundsEnabled: boolean } })._settings = { gameSoundsEnabled: true };
  });
  afterEach(() => {
    resetBoardTransitionArea55SoundsForTests();
    resetBoardTransitionForestAmbientSoundForTests();
    delete (window as Window & { _settings?: unknown })._settings;
    global.Audio = originalAudio;
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  test.each(families)('$name public hard abort stops live media and prevents delayed new cues', (family) => {
    const owner = transitionOwner();
    family.start();
    expect(TransitionAudio.instances.filter(audio => !audio.paused)).toHaveLength(family.voices);
    jest.advanceTimersByTime(500);
    owner.api.cleanupBoardTransitionScreen();
    expect(owner.overlay.isConnected).toBe(false);
    expect(owner.context.isTransitionActive).toBe(false);
    expect(owner.context.activeTransitionSettlement).toHaveBeenCalledWith(false);
    expect(TransitionAudio.instances.every(audio => audio.paused)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    const plays = TransitionAudio.instances.reduce((count, audio) => count + audio.play.mock.calls.length, 0);
    jest.advanceTimersByTime(10000);
    expect(TransitionAudio.instances).toHaveLength(family.voices);
    expect(TransitionAudio.instances.reduce((count, audio) => count + audio.play.mock.calls.length, 0)).toBe(plays);
  });

  test.each(families)('$name normal presentation completion preserves authored tails through cover release', (family) => {
    const owner = transitionOwner();
    family.start();
    owner.api.cleanupForTest({ preserveDom: true, keepVisibleCover: true });
    owner.api.cleanupForTest({ preserveDom: true });
    expect(TransitionAudio.instances.every(audio => !audio.paused)).toBe(true);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(4000);
    if (family.name === 'Area55') {
      const delayed = TransitionAudio.instances.find(audio => audio.src.endsWith('/fly2.wav'));
      expect(delayed?.play).toHaveBeenCalledTimes(1);
    } else {
      expect(TransitionAudio.instances[0].paused).toBe(false);
      expect(TransitionAudio.instances[1].paused).toBe(true);
    }
    expect(jest.getTimerCount()).toBe(0);
  });

  test('replacement retires old audio independently of retaining the overlay DOM', () => {
    const owner = transitionOwner();
    playBoardTransitionArea55StartSounds();
    owner.api.cleanupForTest({ preserveDom: true, abortAudio: true });
    expect(owner.overlay.isConnected).toBe(true);
    expect(TransitionAudio.instances.every(audio => audio.paused)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('graphics cleanup failure and reentrant cleanup cannot bypass the audio hard stop', () => {
    const owner = transitionOwner();
    playBoardTransitionArea55StartSounds(); playBoardTransitionForestAmbientSound();
    owner.context.lifecycle.cleanup.mockImplementationOnce(() => { throw new Error('graphics cleanup failed'); });
    owner.api.cleanupBoardTransitionScreen();
    expect(TransitionAudio.instances.every(audio => audio.paused)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    expect(owner.context.activeTransitionSettlement).toHaveBeenCalledWith(false);
    playBoardTransitionArea55StartSounds();
    owner.context.isCleaningUp = true;
    owner.api.cleanupBoardTransitionScreen();
    expect(TransitionAudio.instances.every(audio => audio.paused)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('hard abort also cancels decoded voices and the Area55 cue queue', () => {
    const owner = transitionOwner();
    jest.mocked(decoded.getDecodedGameplaySoundsState).mockReturnValue('ready');
    jest.mocked(decoded.playDecodedGameplaySound).mockReturnValue('played');
    playBoardTransitionForestAmbientSound(); playBoardTransitionArea55StartSounds();
    const voiceIds = jest.mocked(decoded.playDecodedGameplaySound).mock.calls.map(([, options]) => options.voiceId);
    jest.mocked(decoded.stopDecodedGameplayVoice).mockClear();
    jest.mocked(decoded.stopDecodedGameplayVoices).mockClear();
    owner.api.cleanupBoardTransitionScreen();
    const stopped = [
      ...jest.mocked(decoded.stopDecodedGameplayVoice).mock.calls.map(([voiceId]) => voiceId),
      ...jest.mocked(decoded.stopDecodedGameplayVoices).mock.calls.flatMap(([ids]) => ids),
    ];
    expect(stopped).toEqual(expect.arrayContaining(voiceIds));
    jest.advanceTimersByTime(10000);
    expect(decoded.playDecodedGameplaySound).toHaveBeenCalledTimes(6);
    expect(jest.getTimerCount()).toBe(0);
  });
});
