import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import {
  WILD_SPECIAL_LANDING_SOUND_BASE_VOLUME,
  WILD_SPECIAL_LANDING_SOUND_SOURCE,
  WILD_SPECIAL_LANDING_SOUND_VOLUME,
  areWildSpecialLandingSoundsEnabled,
  playWildSpecialLandingSound,
  preloadWildSpecialLandingSound,
  resetWildSpecialLandingSoundCacheForTests,
  stopWildSpecialLandingSound,
} from '../wild-special-landing-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  preload = '';
  currentTime = 2;
  defaultPlaybackRate = 2;
  playbackRate = 2;
  volume = 0;
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => Promise.resolve());

  constructor(public src: string) {
    MockAudio.instances.push(this);
  }
}

describe('Wild/Special landing sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetWildSpecialLandingSoundCacheForTests();
  });

  afterEach(() => {
    resetWildSpecialLandingSoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  it('uses the supplied bag drop at 50 percent action gain through the SFX master', () => {
    expect(WILD_SPECIAL_LANDING_SOUND_SOURCE).toBe('./assets/sound/sfx/bag drop.wav');
    expect(WILD_SPECIAL_LANDING_SOUND_BASE_VOLUME).toBe(0.5);
    expect(WILD_SPECIAL_LANDING_SOUND_VOLUME).toBeCloseTo(0.3);
    const asset = fs.readFileSync(path.resolve(process.cwd(), 'assets/sound/sfx/bag drop.wav'));
    expect(createHash('sha256').update(asset).digest('hex')).toBe(
      '72a68b6a7942a854c73817ff2e17ae2c8d687d3820e8e0e38bcaa5678858a127',
    );
  });

  it('preloads once and plays at the committed landing contact', () => {
    expect(preloadWildSpecialLandingSound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(1);
    const audio = MockAudio.instances[0];
    expect(audio.load).toHaveBeenCalledTimes(1);

    expect(playWildSpecialLandingSound()).toBe(true);
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.defaultPlaybackRate).toBe(1);
    expect(audio.playbackRate).toBe(1);
    expect(audio.volume).toBeCloseTo(0.3);
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(1);

    stopWildSpecialLandingSound();
    expect(audio.currentTime).toBe(0);
  });

  it('is Settings-gated and wired once to the shared Wild/Special impact owner', () => {
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    const impactOwner = appCore.split('onImpact: () => {')[1]?.split('},')[0] ?? '';
    expect(impactOwner.match(/playWildSpecialLandingSound\(\);/g)).toHaveLength(1);

    (window as any)._settings.gameSoundsEnabled = false;
    expect(areWildSpecialLandingSoundsEnabled()).toBe(false);
    expect(preloadWildSpecialLandingSound()).toBe(false);
    expect(playWildSpecialLandingSound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);
  });
});
