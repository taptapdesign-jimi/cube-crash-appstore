import { createNativeSoundtrackVoice, disposeNativeSoundtrackVoices } from '../native-soundtrack-transport';
import { createSampleAccurateMainThemeVoice } from '../main-theme-web-audio-transport';

const options = { source: './assets/sound/soundtrack/theme-loop-v1/SIx-theme-runtime-intro-loop.wav',
  loopStartSeconds: 3, loopEndSeconds: 12, initialVolume: 0.4 };
describe('exclusive native soundtrack transport', () => {
  let postMessage: jest.Mock;
  const original = Object.getOwnPropertyDescriptor(window, 'webkit');
  const originalContext = Object.getOwnPropertyDescriptor(window, 'AudioContext');
  beforeEach(() => {
    postMessage = jest.fn(async () => ({ position: 0, duration: 12 }));
    Object.defineProperty(window, 'webkit', { configurable: true, value: { messageHandlers: { jimiMusic: { postMessage } } } });
  });
  afterEach(() => {
    disposeNativeSoundtrackVoices();
    if (original) Object.defineProperty(window, 'webkit', original);
    else Reflect.deleteProperty(window, 'webkit');
    if (originalContext) Object.defineProperty(window, 'AudioContext', originalContext);
    else Reflect.deleteProperty(window, 'AudioContext');
  });
  test('selects native before allocating Web Audio and sends exact loop/gain at play', async () => {
    const context = jest.fn(() => { throw new Error('Must not allocate Web Audio'); });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: context });
    const voice = createSampleAccurateMainThemeVoice(options)!;
    expect(postMessage).not.toHaveBeenCalled();
    await voice.play();
    expect(context).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ op: 'play', source: options.source, loopStart: 3, loopEnd: 12, volume: 0.4 }));
    expect(voice.paused).toBe(false);
    voice.dispose();
  });
  test('a late play acknowledgement cannot revive a paused or disposed voice', async () => {
    let acknowledge!: (value: { position: number; duration: number }) => void;
    postMessage.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
    const voice = createNativeSoundtrackVoice(options)!;
    const pending = voice.play();
    voice.pause(); voice.dispose();
    acknowledge({ position: 1, duration: 12 });
    await pending;
    expect(voice.paused).toBe(true);
    expect(postMessage.mock.calls.map(call => call[0].op)).toEqual(['play', 'pause', 'pause', 'dispose']);
  });
  test('failed native playback rejects without allocating or starting a web fallback', async () => {
    postMessage.mockRejectedValueOnce(new Error('file unavailable'));
    const voice = createNativeSoundtrackVoice(options)!;
    await expect(voice.play()).rejects.toThrow('file unavailable');
    expect(voice.paused).toBe(true);
  });
  test('concurrent play calls share one native start', async () => {
    const voice = createNativeSoundtrackVoice(options)!;
    await Promise.all([voice.play(), voice.play(), voice.play()]);
    expect(postMessage.mock.calls.filter(call => call[0].op === 'play')).toHaveLength(1);
  });
  test('late foreground resume cannot rewrite a newer stopped position', async () => {
    const voice = createNativeSoundtrackVoice(options)!;
    await voice.play();
    let acknowledge!: (value: { position: number; duration: number }) => void;
    postMessage.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
    const pending = voice.resumeIfInterrupted!();
    voice.pause(); voice.currentTime = 3;
    acknowledge({ position: 9, duration: 12 });
    await pending;
    expect(voice.currentTime).toBe(3);
    expect(voice.paused).toBe(true);
  });
  test('Arcade voices use the same backend with independent IDs and whole-file loops', async () => {
    const theme = createNativeSoundtrackVoice(options)!;
    const arcade = theme.createMediaVoice!('./calm.wav')!;
    await theme.play(); await arcade.play();
    const plays = postMessage.mock.calls.map(call => call[0]).filter(call => call.op === 'play');
    expect(plays[0].id).not.toBe(plays[1].id);
    expect(plays[1]).toMatchObject({ loopStart: 0, loopEnd: 0 });
    arcade.rampVolume!(0.3, 500);
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ op: 'volume', volume: 0.3, duration: 0.5 }));
  });
  test('absence of native capability leaves web selection untouched', () => {
    Reflect.deleteProperty(window, 'webkit');
    expect(createNativeSoundtrackVoice(options)).toBeNull();
  });
});
