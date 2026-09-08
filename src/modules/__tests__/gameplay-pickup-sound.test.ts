import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  GAMEPLAY_PICKUP_SOUND_PLAYBACK_RATE,
  GAMEPLAY_PICKUP_SOUND_SOURCE,
  GAMEPLAY_PICKUP_SOUND_START_OFFSET_SECONDS,
  GAMEPLAY_PICKUP_SOUND_VOLUME,
  GAMEPLAY_RETURN_SOUND_PLAYBACK_RATE,
  GAMEPLAY_RETURN_SOUND_SOURCE,
  GAMEPLAY_RETURN_SOUND_START_OFFSET_SECONDS,
  GAMEPLAY_RETURN_SOUND_VOLUME,
  playGameplayPickupSound,
  playGameplayReturnSound,
  preloadGameplayPickupSound,
  resetGameplayPickupSoundCacheForTests,
  stopGameplayPickupSound,
} from '../gameplay-pickup-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 2;
  defaultPlaybackRate = 2;
  playbackRate = 2;
  volume = 0;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

describe('gameplay pickup sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetGameplayPickupSoundCacheForTests();
  });

  afterEach(() => {
    resetGameplayPickupSoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  it('uses the supplied woosh for both pickup and return at authored speed', () => {
    expect(GAMEPLAY_PICKUP_SOUND_SOURCE).toBe('./assets/sound/merge 6/woosh.mp3');
    expect(GAMEPLAY_PICKUP_SOUND_PLAYBACK_RATE).toBe(1);
    expect(GAMEPLAY_PICKUP_SOUND_START_OFFSET_SECONDS).toBe(0.045);
    expect(GAMEPLAY_PICKUP_SOUND_VOLUME).toBeCloseTo(0.2592);
    expect(GAMEPLAY_RETURN_SOUND_SOURCE).toBe('./assets/sound/merge 6/woosh.mp3');
    expect(GAMEPLAY_RETURN_SOUND_PLAYBACK_RATE).toBe(1);
    expect(GAMEPLAY_RETURN_SOUND_START_OFFSET_SECONDS).toBe(0.045);
    expect(GAMEPLAY_RETURN_SOUND_VOLUME).toBeCloseTo(0.51);
    expect(fs.existsSync(path.resolve(process.cwd(), 'assets/sound/merge 6/woosh.mp3'))).toBe(true);
  });

  it('plays pickup after accepted drag ownership and woosh only when snap-back begins', () => {
    const dragSource = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/drag-core.ts'), 'utf8');
    expect(dragSource.match(/playGameplayPickupSound\(\);/g)).toHaveLength(1);
    expect(dragSource.match(/playGameplayReturnSound\(\);/g)).toHaveLength(1);
    expect(dragSource.indexOf('if (!inputGateDecision.allowed)')).toBeLessThan(
      dragSource.indexOf('playGameplayPickupSound();'),
    );
    expect(dragSource.indexOf('drag.t = t;')).toBeLessThan(
      dragSource.indexOf('playGameplayPickupSound();'),
    );
    const snapBackSource = dragSource.split('function snapBack(t, onSnapBackComplete) {')[1];
    expect(snapBackSource).toBeDefined();
    expect(snapBackSource.indexOf('playGameplayReturnSound();')).toBeLessThan(
      snapBackSource.indexOf('restoreGridCell(t);'),
    );
  });

  it('preloads, restarts from the measured perceptual onset, and reuses two bounded woosh voices', () => {
    expect(preloadGameplayPickupSound()).toBe(true);
    expect(playGameplayPickupSound()).toBe(true);
    expect(playGameplayPickupSound()).toBe(true);
    expect(playGameplayReturnSound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(2);
    const pickup = MockAudio.instances[0];
    const returned = MockAudio.instances[1];
    expect(pickup.src).toBe(GAMEPLAY_PICKUP_SOUND_SOURCE);
    expect(returned.src).toBe(GAMEPLAY_RETURN_SOUND_SOURCE);
    expect(pickup.load).toHaveBeenCalledTimes(1);
    expect(returned.load).toHaveBeenCalledTimes(1);
    expect(pickup.playbackRate).toBe(1);
    expect(returned.playbackRate).toBe(1);
    expect(pickup.volume).toBeCloseTo(0.2592);
    expect(returned.volume).toBeCloseTo(0.51);
    expect(pickup.currentTime).toBe(0.045);
    expect(returned.currentTime).toBe(0.045);
    expect(pickup.play).toHaveBeenCalledTimes(2);
    expect(returned.play).toHaveBeenCalledTimes(1);
  });

  it('obeys Settings and exposes preload and cleanup in both game routes', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadGameplayPickupSound()).toBe(false);
    expect(playGameplayPickupSound()).toBe(false);
    expect(playGameplayReturnSound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadGameplayPickupSound();
    stopGameplayPickupSound();
    expect(MockAudio.instances[0].pause).toHaveBeenCalled();
    expect(MockAudio.instances[0].currentTime).toBe(0);
    expect(MockAudio.instances[1].pause).toHaveBeenCalled();
    expect(MockAudio.instances[1].currentTime).toBe(0);

    const uiManager = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');
    const journeyManager = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'), 'utf8');
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(uiManager.match(/preloadGameplayPickupSound\(\);/g)).toHaveLength(3);
    expect(journeyManager.match(/preloadGameplayPickupSound\(\);/g)).toHaveLength(1);
    expect(uiManager).toContain('stopGameplayPickupSound');
    expect(appCore).toContain('stopGameplayPickupSound();');
  });
});
