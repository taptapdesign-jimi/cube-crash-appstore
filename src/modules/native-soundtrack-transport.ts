import type { MainThemeVoiceLike, MainThemeTransportOptions, SampleAccurateMainThemeVoice } from './main-theme-web-audio-transport.js';
import { isThermalAudioSuppressed } from '../utils/thermal-audio-isolation.js';

interface NativeReply { position: number; duration: number }
interface MusicBridge { postMessage(message: Record<string, unknown>): Promise<NativeReply> }
type MusicWindow = Window & { webkit?: { messageHandlers?: { jimiMusic?: MusicBridge } } };
let nextVoice = 0;
const liveVoices = new Set<NativeSoundtrackVoice>();

/** One exclusive transport, not a second soundtrack decision owner. */
class NativeSoundtrackVoice implements SampleAccurateMainThemeVoice {
  readonly sampleAccurateIntroLoop = true as const;
  readonly decodedBytes = 0; // Web PCM only; native file/player memory is separate.
  readonly contextState = 'running';
  readonly resumePending = false;
  preload: HTMLMediaElement['preload'] = 'auto';
  loop = true;
  private readonly id = `soundtrack-${++nextVoice}`;
  private generation = 0;
  private retired = false;
  private playing = false;
  private position = 0;
  private anchor = 0;
  private length = 0;
  private gain: number;
  private pendingPlay: Promise<void> | null = null;
  private ramp: { from: number; to: number; start: number; duration: number } | null = null;
  constructor(private readonly bridge: MusicBridge, private readonly options: MainThemeTransportOptions) {
    this.gain = options.initialVolume;
    liveVoices.add(this);
  }
  get paused(): boolean { return !this.playing; }
  get sourcePresent(): boolean { return this.playing; }
  get sourceGeneration(): number { return this.generation; }
  get duration(): number { return this.length || this.options.loopEndSeconds; }
  get currentTime(): number {
    const position = this.position + (this.playing ? (performance.now() - this.anchor) / 1000 : 0);
    const end = this.options.loopEndSeconds || this.duration;
    const start = this.options.loopStartSeconds;
    return this.loop && end > start && position >= end ? start + (position - end) % (end - start) : position;
  }
  set currentTime(value: number) {
    this.position = Number.isFinite(value) ? Math.max(0, value) : 0;
    this.anchor = performance.now();
    if (this.playing) void this.command('seek', { position: this.position }).catch(() => {});
  }
  get volume(): number {
    if (!this.ramp) return this.gain;
    const t = Math.min(1, Math.max(0, (performance.now() - this.ramp.start) / this.ramp.duration));
    return this.ramp.from + (this.ramp.to - this.ramp.from) * t;
  }
  set volume(value: number) {
    this.ramp = null;
    this.gain = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
    void this.command('volume', { volume: this.gain, duration: 0 }).catch(() => {});
  }
  rampVolume(to: number, durationMs: number): void {
    const from = this.volume;
    this.gain = Math.min(1, Math.max(0, to));
    this.ramp = { from, to: this.gain, start: performance.now(), duration: Math.max(1, durationMs) };
    void this.command('volume', { volume: this.gain, duration: Math.max(0, durationMs) / 1000 }).catch(() => {});
  }
  cancelVolumeRamp(): void {
    const audibleGain = this.volume;
    this.volume = audibleGain;
  }
  play(): Promise<void> {
    if (this.pendingPlay) return this.pendingPlay;
    const attempt = this.startNativePlayback();
    this.pendingPlay = attempt;
    void attempt.finally(() => { if (this.pendingPlay === attempt) this.pendingPlay = null; }).catch(() => {});
    return attempt;
  }
  private async startNativePlayback(): Promise<void> {
    if (this.retired || isThermalAudioSuppressed()) throw new DOMException('Audio retired', 'AbortError');
    if (this.playing) return;
    const generation = ++this.generation;
    const reply = await this.command('play', {
      source: this.options.source, position: this.position, volume: this.volume,
      loop: this.loop, loopStart: this.options.loopStartSeconds, loopEnd: this.options.loopEndSeconds,
    });
    if (generation !== this.generation || this.retired) return;
    this.position = reply.position;
    this.length = reply.duration;
    this.anchor = performance.now();
    this.playing = true;
  }
  pause(): void {
    this.position = this.currentTime;
    this.playing = false;
    ++this.generation;
    this.pendingPlay = null;
    void this.command('pause').catch(() => {});
  }
  dispose(): void {
    if (this.retired) return;
    this.pause();
    void this.command('dispose').catch(() => {});
    this.retired = true;
    liveVoices.delete(this);
  }
  async resumeIfInterrupted(): Promise<void> {
    if (!this.playing || this.retired || isThermalAudioSuppressed()) return;
    const generation = this.generation;
    const reply = await this.command('resume', { volume: this.volume });
    if (generation !== this.generation || this.retired) return;
    this.position = reply.position;
    this.anchor = performance.now();
  }
  async reacquireAfterNativeActivation(): Promise<boolean> {
    await this.resumeIfInterrupted();
    return this.playing;
  }
  createMediaVoice(source: string): MainThemeVoiceLike | null {
    if (this.retired || isThermalAudioSuppressed()) return null;
    return new NativeSoundtrackVoice(this.bridge, { source, loopStartSeconds: 0, loopEndSeconds: 0, initialVolume: 0 });
  }
  private command(op: string, values: Record<string, unknown> = {}): Promise<NativeReply> {
    if (this.retired) return Promise.reject(new DOMException('Audio retired', 'AbortError'));
    try { return Promise.resolve(this.bridge.postMessage({ op, id: this.id, ...values })); }
    catch (error) { return Promise.reject(error); }
  }
}

export function createNativeSoundtrackVoice(options: MainThemeTransportOptions): SampleAccurateMainThemeVoice | null {
  if (typeof window === 'undefined' || isThermalAudioSuppressed()) return null;
  const bridge = (window as MusicWindow).webkit?.messageHandlers?.jimiMusic;
  return bridge ? new NativeSoundtrackVoice(bridge, options) : null;
}

export function disposeNativeSoundtrackVoices(): void {
  liveVoices.forEach((voice) => voice.dispose());
}
