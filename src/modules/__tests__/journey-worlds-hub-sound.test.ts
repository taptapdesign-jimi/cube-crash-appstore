import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  armJourneyWorldsSoundForBoardTransition,
  fadeOutJourneyWorldsSoundForBoardTransition,
  JOURNEY_WORLDS_BOARD_TRANSITION_FADE_OUT_MS,
  JOURNEY_WORLDS_HUB_ACTION_VOLUME,
  JOURNEY_WORLDS_HUB_SOUND_SOURCE,
  JOURNEY_WORLDS_HUB_VOLUME,
  JOURNEY_WORLDS_VOLUME_TRANSITION_MS,
  JOURNEY_WORLDS_WORLD_FADE_DELAY_MS,
  JOURNEY_WORLDS_WORLD_FADE_OUT_MS,
  JOURNEY_WORLDS_WORLD_VOLUME,
  JOURNEY_WORLDS_WORLD_VOLUME_RATIO,
  playJourneyWorldsHubSound,
  playJourneyWorldsWorldSound,
  preloadJourneyWorldsHubSound,
  reduceJourneyWorldsSoundForWorld,
  resetJourneyWorldsHubSoundForTests,
  stopJourneyWorldsHubSound,
} from '../journey-worlds-hub-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  loop = false;
  currentTime = 5;
  volume = 0;
  paused = true;
  load = jest.fn();
  pause = jest.fn(() => { this.paused = true; });
  play = jest.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });

  constructor(public src: string) {
    MockAudio.instances.push(this);
  }
}

describe('Journey Worlds Hub sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetJourneyWorldsHubSoundForTests();
  });

  afterEach(() => {
    resetJourneyWorldsHubSoundForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('locks the supplied Worlds Hub loop and shared ambient mix', () => {
    expect(JOURNEY_WORLDS_HUB_SOUND_SOURCE).toBe(
      './assets/sound/worlds/crumbleworlds.wav',
    );
    expect(JOURNEY_WORLDS_HUB_ACTION_VOLUME).toBe(0.58);
    expect(JOURNEY_WORLDS_HUB_VOLUME).toBeCloseTo(0.348);
    expect(JOURNEY_WORLDS_WORLD_VOLUME_RATIO).toBe(0.3);
    expect(JOURNEY_WORLDS_WORLD_VOLUME).toBeCloseTo(0.1044);
    expect(JOURNEY_WORLDS_VOLUME_TRANSITION_MS).toBe(1000);
    expect(JOURNEY_WORLDS_WORLD_FADE_DELAY_MS).toBe(5000);
    expect(JOURNEY_WORLDS_WORLD_FADE_OUT_MS).toBe(1000);
    expect(JOURNEY_WORLDS_BOARD_TRANSITION_FADE_OUT_MS).toBe(1000);

    const bytes = fs.readFileSync(
      path.resolve(process.cwd(), JOURNEY_WORLDS_HUB_SOUND_SOURCE.replace(/^\.\//, '')),
    );
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(
      '069d9b381d3e1e3aaa4ed4efad0044a8d348e466740f1398e0fd4ef40fad99c5',
    );
  });

  test('preloads and continuously loops only while Sounds are enabled', () => {
    expect(preloadJourneyWorldsHubSound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(1);
    const audio = MockAudio.instances[0];
    expect(audio.preload).toBe('auto');
    expect(audio.loop).toBe(true);

    expect(playJourneyWorldsHubSound()).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(0);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_HUB_VOLUME);

    (window as any)._settings.gameSoundsEnabled = false;
    stopJourneyWorldsHubSound();
    expect(playJourneyWorldsHubSound()).toBe(false);
    expect(audio.paused).toBe(true);
  });

  test('keeps the same loop alive for five seconds after World activation, then fades it out', () => {
    playJourneyWorldsHubSound();
    const audio = MockAudio.instances[0];
    audio.currentTime = 12;
    expect(reduceJourneyWorldsSoundForWorld()).toBe(true);

    jest.advanceTimersByTime(JOURNEY_WORLDS_VOLUME_TRANSITION_MS / 2);
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeGreaterThan(JOURNEY_WORLDS_WORLD_VOLUME);
    expect(audio.volume).toBeLessThan(JOURNEY_WORLDS_HUB_VOLUME);
    expect(audio.currentTime).toBe(12);

    jest.advanceTimersByTime(JOURNEY_WORLDS_VOLUME_TRANSITION_MS / 2);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(12);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_WORLD_VOLUME);
    expect(audio.play).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(JOURNEY_WORLDS_WORLD_FADE_DELAY_MS - JOURNEY_WORLDS_VOLUME_TRANSITION_MS);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(12);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_WORLD_VOLUME);

    jest.advanceTimersByTime(JOURNEY_WORLDS_WORLD_FADE_OUT_MS / 2);
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeGreaterThan(0);
    expect(audio.volume).toBeLessThan(JOURNEY_WORLDS_WORLD_VOLUME);

    jest.advanceTimersByTime(JOURNEY_WORLDS_WORLD_FADE_OUT_MS / 2);
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_HUB_VOLUME);
  });

  test('restores full Hub volume without restarting the continuous voice', () => {
    playJourneyWorldsHubSound();
    const audio = MockAudio.instances[0];
    reduceJourneyWorldsSoundForWorld(0);
    audio.currentTime = 18;

    expect(playJourneyWorldsHubSound()).toBe(true);
    jest.advanceTimersByTime(JOURNEY_WORLDS_VOLUME_TRANSITION_MS);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(18);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_HUB_VOLUME);

    jest.advanceTimersByTime(JOURNEY_WORLDS_WORLD_FADE_DELAY_MS + JOURNEY_WORLDS_WORLD_FADE_OUT_MS);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(18);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_HUB_VOLUME);
  });

  test('starts a direct World entry at the reduced level without a full-volume frame', () => {
    expect(playJourneyWorldsWorldSound()).toBe(true);
    const audio = MockAudio.instances[0];
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_WORLD_VOLUME);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  test('preserves the World-level voice through Play cleanup and fades only at transition mount', () => {
    playJourneyWorldsWorldSound();
    const audio = MockAudio.instances[0];
    audio.currentTime = 21;

    expect(armJourneyWorldsSoundForBoardTransition()).toBe(true);
    stopJourneyWorldsHubSound({ preserveBoardTransitionHandoff: true });
    jest.advanceTimersByTime(500);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(21);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_WORLD_VOLUME);

    expect(fadeOutJourneyWorldsSoundForBoardTransition()).toBe(true);
    jest.advanceTimersByTime(JOURNEY_WORLDS_BOARD_TRANSITION_FADE_OUT_MS / 2);
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeGreaterThan(0);
    expect(audio.volume).toBeLessThan(JOURNEY_WORLDS_WORLD_VOLUME);

    jest.advanceTimersByTime(JOURNEY_WORLDS_BOARD_TRANSITION_FADE_OUT_MS / 2);
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(audio.volume).toBeCloseTo(JOURNEY_WORLDS_HUB_VOLUME);
  });

  test('connects Hub and every current or future World through generic lifecycle owners', () => {
    const manager = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    const openWorldOwner = manager.slice(
      manager.indexOf('private openJourneyV700World('),
      manager.indexOf('private async buildJourneyMainCloudComposite', manager.indexOf('private openJourneyV700World(')),
    );
    expect(manager).toContain('preloadJourneyWorldsHubSound();');
    expect(manager).toContain('playJourneyWorldsHubSound();');
    expect(manager).toContain('playJourneyWorldsWorldSound();');
    expect(manager).toContain('armJourneyWorldsSoundForBoardTransition();');
    expect(manager).toContain('stopJourneyWorldsHubSound({ preserveBoardTransitionHandoff: true });');
    expect(manager.match(/this\.prepareJourneyAmbientForGameEntry\(\);/g)).toHaveLength(5);
    expect(openWorldOwner).toContain('reduceJourneyWorldsSoundForWorld();');
    expect(openWorldOwner.indexOf('this.journeyV700WorldOpenInProgress = true;')).toBeLessThan(
      openWorldOwner.indexOf('reduceJourneyWorldsSoundForWorld();'),
    );

    const uiManager = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/ui-manager.ts'),
      'utf8',
    );
    expect(uiManager).toContain("import('./journey-worlds-hub-sound.ts')");
    expect(uiManager).toContain('stopJourneyWorldsHubSound();');

    const boardTransition = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/board-transition-screen.ts'),
      'utf8',
    );
    const overlayMount = boardTransition.indexOf('document.body.appendChild(overlay);');
    const journeyFade = boardTransition.indexOf(
      'if (runMode === RUN_MODE_JOURNEY) fadeOutJourneyWorldsSoundForBoardTransition();',
    );
    expect(overlayMount).toBeGreaterThan(-1);
    expect(journeyFade).toBeGreaterThan(overlayMount);
  });
});
