import {
  playFailScreenSaxophoneSound, stopFailScreenSounds, resetFailScreenSoundsForTests,
} from '../fail-screen-sound';
import {
  playCleanBoardSaxophoneHappySound, stopCleanBoardSounds, resetCleanBoardSoundsForTests,
} from '../clean-board-sound';

jest.mock('../gameplay-audio-buffer-player', () => ({
  getDecodedGameplaySoundsState: () => 'unavailable',
  playDecodedGameplaySound: jest.fn(),
  preloadDecodedGameplaySounds: () => false,
  stopDecodedGameplayVoices: jest.fn(),
}));

class DeferredMedia {
  static instances: DeferredMedia[] = [];
  onended: (() => void) | null = null;
  currentTime = 0;
  volume = 0;
  preload = '';
  pending: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  load = jest.fn();
  pause = jest.fn();
  play = jest.fn(() => new Promise<void>((resolve, reject) => { this.pending.push({ resolve, reject }); }));
  constructor(readonly src: string) { DeferredMedia.instances.push(this); }
}

const owners = [
  { name: 'Fail', play: playFailScreenSaxophoneSound, stop: stopFailScreenSounds },
  { name: 'Clean Board', play: playCleanBoardSaxophoneHappySound, stop: stopCleanBoardSounds },
];

describe.each(owners)('$name retained media generation', ({ play, stop }) => {
  const originalAudio = global.Audio;
  const flush = async () => { for (let index = 0; index < 6; index++) await Promise.resolve(); };
  beforeEach(() => {
    DeferredMedia.instances = [];
    global.Audio = DeferredMedia as unknown as typeof Audio;
    (window as any)._settings = { gameSoundsEnabled: true };
  });
  afterEach(() => {
    resetFailScreenSoundsForTests();
    resetCleanBoardSoundsForTests();
    global.Audio = originalAudio;
    delete (window as any)._settings;
  });

  test.each(['ended', 'stopped'] as const)('a retired play rejection preserves the new %s receipt', async (completion) => {
    const oldUnavailable = jest.fn();
    play({ onUnavailable: oldUnavailable });
    const audio = DeferredMedia.instances[0];
    const oldEnded = audio.onended;
    stop();
    const onStarted = jest.fn();
    const onEnded = jest.fn();
    const onStopped = jest.fn();
    play({ onStarted, onEnded, onStopped });
    const currentEnded = audio.onended;
    audio.pending[0].reject(new Error('retired play aborted by pause'));
    await flush();
    oldEnded?.();
    expect(audio.onended).toBe(currentEnded);
    expect(oldUnavailable).not.toHaveBeenCalled();
    expect(onEnded).not.toHaveBeenCalled();
    expect(onStopped).not.toHaveBeenCalled();

    audio.pending[1].resolve();
    await flush();
    expect(onStarted).toHaveBeenCalledTimes(1);
    if (completion === 'ended') audio.onended?.();
    stop();
    stop();
    expect(onEnded).toHaveBeenCalledTimes(completion === 'ended' ? 1 : 0);
    expect(onStopped).toHaveBeenCalledTimes(completion === 'stopped' ? 1 : 0);
    expect(DeferredMedia.instances).toHaveLength(1);
  });

  test('a retired play success cannot report a start for the newer result', async () => {
    const oldStarted = jest.fn();
    const newStarted = jest.fn();
    play({ onStarted: oldStarted });
    const audio = DeferredMedia.instances[0];
    stop();
    play({ onStarted: newStarted });
    audio.pending[0].resolve();
    await flush();
    expect(oldStarted).not.toHaveBeenCalled();
    expect(newStarted).not.toHaveBeenCalled();
    audio.pending[1].resolve();
    await flush();
    expect(newStarted).toHaveBeenCalledTimes(1);
  });

  test('a current play failure still releases its own result receipt', async () => {
    const onUnavailable = jest.fn();
    const onStopped = jest.fn();
    play({ onUnavailable, onStopped });
    DeferredMedia.instances[0].pending[0].reject(new Error('current playback failed'));
    await flush();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    stop();
    expect(onStopped).not.toHaveBeenCalled();
  });
});
