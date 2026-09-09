import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ORDINARY_STACK_SOUND_BASE_VOLUME,
  ORDINARY_STACK_SOUND_PLAYBACK_RATE,
  ORDINARY_STACK_SOUND_SOURCE,
  ORDINARY_STACK_SOUND_VOLUME,
  ORDINARY_STACK_SECONDARY_BASE_VOLUME,
  ORDINARY_STACK_SECONDARY_PLAYBACK_RATE,
  ORDINARY_STACK_SECONDARY_SOUND_SOURCE,
  ORDINARY_STACK_SECONDARY_VOLUME,
  playOrdinaryStackSound,
  preloadOrdinaryStackSound,
  resetOrdinaryStackSoundCacheForTests,
  stopOrdinaryStackSound,
} from '../ordinary-stack-sound';

class MockAudio {
  static instances: MockAudio[] = [];
  src: string;
  preload = '';
  currentTime = 1;
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

describe('ordinary stack sound', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    MockAudio.instances = [];
    (global as any).Audio = MockAudio;
    (window as any)._settings = { gameSoundsEnabled: true };
    resetOrdinaryStackSoundCacheForTests();
  });

  afterEach(() => {
    resetOrdinaryStackSoundCacheForTests();
    (global as any).Audio = originalAudio;
    delete (window as any)._settings;
  });

  it('uses the supplied stack file once on the committed ordinary sub-six stack', () => {
    expect(ORDINARY_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/wood.wav');
    expect(ORDINARY_STACK_SOUND_BASE_VOLUME).toBe(0.384);
    expect(ORDINARY_STACK_SOUND_PLAYBACK_RATE).toBe(1.5);
    const asset = fs.readFileSync(path.resolve(process.cwd(), 'assets/sound/merge 6/wood.wav'));
    expect(createHash('sha256').update(asset).digest('hex')).toBe(
      'b41e49bac458088ce959317ba39c9c82f2d7255d5dcdf61c569271ce90b9f632',
    );
    expect(ORDINARY_STACK_SECONDARY_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    expect(ORDINARY_STACK_SECONDARY_BASE_VOLUME).toBe(0.8);
    expect(ORDINARY_STACK_SECONDARY_PLAYBACK_RATE).toBe(1);
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore.match(/playOrdinaryStackSound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain(
      "if (!wildActive && !srcSpecial && !dstSpecial) {\n      playOrdinaryStackSound();",
    );
  });

  it('preloads, plays 50 percent faster at the requested volume, and reuses one voice', () => {
    expect(preloadOrdinaryStackSound()).toBe(true);
    expect(playOrdinaryStackSound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(2);
    const [wood, original] = MockAudio.instances;
    expect(wood.src).toBe(ORDINARY_STACK_SOUND_SOURCE);
    expect(wood.defaultPlaybackRate).toBe(1.5);
    expect(wood.playbackRate).toBe(1.5);
    expect(ORDINARY_STACK_SOUND_VOLUME).toBeCloseTo(0.2304);
    expect(wood.volume).toBeCloseTo(0.2304);
    expect(wood.currentTime).toBe(0);
    expect(wood.play).toHaveBeenCalledTimes(1);
    expect(original.src).toBe(ORDINARY_STACK_SECONDARY_SOUND_SOURCE);
    expect(original.playbackRate).toBe(1);
    expect(ORDINARY_STACK_SECONDARY_VOLUME).toBeCloseTo(0.48);
    expect(original.volume).toBeCloseTo(0.48);
    expect(original.currentTime).toBe(0);
    expect(original.play).toHaveBeenCalledTimes(1);
  });

  it('does not allocate while Settings are off and stops its owned voice', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadOrdinaryStackSound()).toBe(false);
    expect(playOrdinaryStackSound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadOrdinaryStackSound();
    stopOrdinaryStackSound();
    MockAudio.instances.forEach((audio) => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });
});
