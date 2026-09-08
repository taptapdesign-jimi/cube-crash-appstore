import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ORDINARY_STACK_SOUND_SOURCE,
  ORDINARY_STACK_SOUND_VOLUME,
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
    expect(ORDINARY_STACK_SOUND_SOURCE).toBe('./assets/sound/merge 6/stack.mp3');
    const appCore = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
    expect(appCore.match(/playOrdinaryStackSound\(\);/g)).toHaveLength(1);
    expect(appCore).toContain(
      "if (!wildActive && !srcSpecial && !dstSpecial) {\n      playOrdinaryStackSound();",
    );
  });

  it('preloads, plays at authored speed, and reuses one voice', () => {
    expect(preloadOrdinaryStackSound()).toBe(true);
    expect(playOrdinaryStackSound()).toBe(true);
    expect(MockAudio.instances).toHaveLength(1);
    const audio = MockAudio.instances[0];
    expect(audio.src).toBe(ORDINARY_STACK_SOUND_SOURCE);
    expect(audio.playbackRate).toBe(1);
    expect(ORDINARY_STACK_SOUND_VOLUME).toBe(0.6);
    expect(audio.volume).toBe(0.6);
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('does not allocate while Settings are off and stops its owned voice', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadOrdinaryStackSound()).toBe(false);
    expect(playOrdinaryStackSound()).toBe(false);
    expect(MockAudio.instances).toHaveLength(0);

    (window as any)._settings.gameSoundsEnabled = true;
    preloadOrdinaryStackSound();
    stopOrdinaryStackSound();
    expect(MockAudio.instances[0].pause).toHaveBeenCalled();
    expect(MockAudio.instances[0].currentTime).toBe(0);
  });
});
