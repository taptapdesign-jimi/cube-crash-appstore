import { SoundtrackAudioClockVolume } from './soundtrack-audio-clock-volume.js';
import { logger } from '../core/logger.js';
import { SoundtrackContextRecovery } from './soundtrack-context-recovery.js';

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export type MainThemeVoiceLike = Pick<
  HTMLAudioElement,
  'loop' | 'preload' | 'paused' | 'volume' | 'currentTime' | 'play' | 'pause'
> & {
  readonly sampleAccurateIntroLoop?: boolean;
  readonly duration?: number;
  readonly decodedBytes?: number;
  readonly contextState?: string;
  readonly resumePending?: boolean;
  rampVolume?: (to: number, durationMs: number) => void;
  cancelVolumeRamp?: () => void;
  createMediaVoice?: (source: string) => MainThemeVoiceLike | null;
  dispose?: () => void;
  resumeIfInterrupted?: () => Promise<void>;
};

export interface SampleAccurateMainThemeVoice extends MainThemeVoiceLike {
  readonly sampleAccurateIntroLoop: true;
  dispose(): void;
}

interface MainThemeTransportOptions {
  source: string;
  loopStartSeconds: number;
  loopEndSeconds: number;
  initialVolume: number;
}

function resolveSource(source: string): string {
  if (typeof document === 'undefined') return source;
  return new URL(source, document.baseURI).href;
}

function isContextRunning(context: AudioContext): boolean {
  return context.state === 'running';
}

class MainThemeWebAudioTransport implements SampleAccurateMainThemeVoice {
  readonly sampleAccurateIntroLoop = true as const;
  loop = true;
  preload: HTMLMediaElement['preload'] = 'auto';

  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private readonly options: MainThemeTransportOptions;
  private bufferPromise: Promise<AudioBuffer> | null = null;
  private buffer: AudioBuffer | null = null;
  private loadFailure: { error: unknown; retryAt: number } | null = null;
  private source: AudioBufferSourceNode | null = null;
  private storedPosition = 0;
  private anchorPosition = 0;
  private anchorContextTime = 0;
  private isPaused = true;
  private isDisposed = false;
  private readonly envelope: SoundtrackAudioClockVolume;
  private playGeneration = 0;
  private readonly recovery: SoundtrackContextRecovery;

  constructor(context: AudioContext, options: MainThemeTransportOptions) {
    this.context = context;
    this.recovery = new SoundtrackContextRecovery(context);
    this.options = options;
    this.gain = context.createGain();
    this.envelope = new SoundtrackAudioClockVolume(context, this.gain.gain, options.initialVolume);
    this.gain.connect(context.destination);
    void this.ensureBuffer().catch(() => {});
  }

  get decodedBytes(): number {
    return this.buffer ? this.buffer.length * this.buffer.numberOfChannels * 4 : 0;
  }

  get contextState(): string { return this.context.state; }
  get resumePending(): boolean { return this.recovery.pending; }

  get paused(): boolean {
    return this.isPaused;
  }

  get volume(): number { return this.envelope.value; }
  set volume(value: number) { if (!this.isDisposed) this.envelope.value = value; }
  rampVolume(to: number, durationMs: number): void {
    if (!this.isDisposed) this.envelope.fade(to, durationMs);
  }
  cancelVolumeRamp(): void { if (!this.isDisposed) this.envelope.cancel(); }

  createMediaVoice(source: string): MainThemeVoiceLike | null {
    try { return new SoundtrackMediaVoice(this.context, source); }
    catch (error) {
      logger.warn('Arcade Web Audio routing unavailable:', error);
      return null;
    }
  }

  get currentTime(): number {
    if (this.isPaused) return this.storedPosition;
    const elapsed = Math.max(0, this.context.currentTime - this.anchorContextTime);
    return this.normalizePosition(this.anchorPosition + elapsed);
  }

  set currentTime(value: number) {
    const position = this.normalizePosition(value);
    this.storedPosition = position;
    if (this.isPaused || !this.buffer) return;
    this.startSource(position);
  }

  async play(): Promise<void> {
    if (this.isDisposed) throw new Error('Main theme transport is disposed.');
    const generation = ++this.playGeneration;
    // Request unlock in the user gesture before asynchronous fetch/decode.
    const resume = this.recovery.resume();
    const [buffer] = await Promise.all([this.ensureBuffer(), resume]);
    if (this.isDisposed || generation !== this.playGeneration) return;
    this.buffer = buffer;
    if (this.context.state !== 'running') await this.recovery.resume();
    if (this.isDisposed || generation !== this.playGeneration) return;
    if (!isContextRunning(this.context)) {
      throw new DOMException('User activation required', 'NotAllowedError');
    }
    if (!this.isPaused) return;
    this.startSource(this.storedPosition);
  }

  pause(): void {
    this.playGeneration++;
    this.recovery.cancel();
    if (this.isPaused) return;
    this.storedPosition = this.currentTime;
    this.stopSource();
    this.isPaused = true;
  }

  async resumeIfInterrupted(): Promise<void> {
    if (this.isDisposed || this.isPaused || this.context.state === 'running') return;
    const generation = this.playGeneration;
    await this.recovery.resume();
    if (this.isDisposed || generation !== this.playGeneration) return;
    if (!isContextRunning(this.context)) {
      throw new DOMException('Main theme context remains interrupted', 'NotAllowedError');
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.pause();
    this.isDisposed = true;
    this.buffer = null;
    this.bufferPromise = null;
    try { this.gain.disconnect(); } catch {}
    void this.context.close().catch(() => {});
  }

  private ensureBuffer(): Promise<AudioBuffer> {
    if (this.buffer) return Promise.resolve(this.buffer);
    if (this.loadFailure && Date.now() < this.loadFailure.retryAt) {
      return Promise.reject(this.loadFailure.error);
    }
    if (!this.bufferPromise) {
      this.bufferPromise = this.loadBuffer().then((buffer) => {
        this.loadFailure = null;
        if (!this.isDisposed) this.buffer = buffer;
        return buffer;
      }).catch((error: unknown) => {
        this.bufferPromise = null;
        this.loadFailure = { error, retryAt: Date.now() + 2000 };
        throw error;
      });
    }
    return this.bufferPromise;
  }

  private async loadBuffer(): Promise<AudioBuffer> {
    const response = await fetch(resolveSource(this.options.source), { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Main theme HTTP ${response.status}`);
    const encoded = await response.arrayBuffer();
    return this.context.decodeAudioData(encoded);
  }

  private normalizePosition(value: number): number {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    const loopStart = this.options.loopStartSeconds;
    const loopEnd = this.options.loopEndSeconds;
    if (safeValue < loopEnd) return safeValue;
    const loopDuration = loopEnd - loopStart;
    if (loopDuration <= 0) return loopStart;
    return loopStart + ((safeValue - loopStart) % loopDuration);
  }

  private startSource(position: number): void {
    const buffer = this.buffer;
    if (!buffer) return;
    this.stopSource();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = this.options.loopStartSeconds;
    source.loopEnd = Math.min(this.options.loopEndSeconds, buffer.duration);
    source.connect(this.gain);
    const startAt = this.context.currentTime;
    this.source = source;
    this.anchorPosition = position;
    this.anchorContextTime = startAt;
    this.storedPosition = position;
    this.isPaused = false;
    source.start(startAt, position);
  }

  private stopSource(): void {
    const source = this.source;
    this.source = null;
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
}

/** Streams Arcade beds through the main context's GainNode; never relies on iOS media volume. */
class SoundtrackMediaVoice implements MainThemeVoiceLike {
  private readonly media: HTMLAudioElement;
  private readonly node: MediaElementAudioSourceNode;
  private readonly gain: GainNode;
  private readonly envelope: SoundtrackAudioClockVolume;
  private generation = 0;
  private disposed = false;
  private readonly recovery: SoundtrackContextRecovery;

  constructor(private readonly context: AudioContext, source: string) {
    this.recovery = new SoundtrackContextRecovery(context);
    this.media = new Audio(source);
    this.media.volume = 1;
    this.gain = context.createGain();
    this.envelope = new SoundtrackAudioClockVolume(context, this.gain.gain, 0);
    try { this.node = context.createMediaElementSource(this.media); }
    catch (error) { this.gain.disconnect(); throw error; }
    this.node.connect(this.gain);
    this.gain.connect(context.destination);
  }
  get loop(): boolean { return this.media.loop; }
  set loop(value: boolean) { this.media.loop = value; }
  get preload(): HTMLMediaElement['preload'] { return this.media.preload; }
  set preload(value: HTMLMediaElement['preload']) { this.media.preload = value; }
  get paused(): boolean { return this.media.paused; }
  get duration(): number { return this.media.duration; }
  get currentTime(): number { return this.media.currentTime; }
  set currentTime(value: number) { this.media.currentTime = value; }
  get volume(): number { return this.envelope.value; }
  set volume(value: number) { this.envelope.value = value; }
  rampVolume(to: number, durationMs: number): void { this.envelope.fade(to, durationMs); }
  cancelVolumeRamp(): void { this.envelope.cancel(); }
  async play(): Promise<void> {
    if (this.disposed) throw new Error('Soundtrack voice is disposed.');
    const generation = ++this.generation;
    // Resume synchronously in the gesture stack, before waiting for media readiness.
    const resume = this.recovery.resume();
    await Promise.all([resume, this.media.play()]);
    if (this.disposed || generation !== this.generation) return;
    if (!isContextRunning(this.context)) throw new DOMException('User activation required', 'NotAllowedError');
  }
  pause(): void { this.generation++; this.recovery.cancel(); this.media.pause(); }
  async resumeIfInterrupted(): Promise<void> {
    if (this.disposed || this.paused || isContextRunning(this.context)) return;
    const generation = this.generation;
    await this.recovery.resume();
    if (this.disposed || generation !== this.generation) return;
    if (!isContextRunning(this.context)) {
      throw new DOMException('Arcade context remains interrupted', 'NotAllowedError');
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try { this.pause(); } catch {}
    try { this.envelope.value = 0; } catch {}
    try { this.node.disconnect(); } catch {}
    try { this.gain.disconnect(); } catch {}
    try { this.media.removeAttribute('src'); } catch {}
    try { this.media.load(); } catch {}
  }
}

export function createSampleAccurateMainThemeVoice(
  options: MainThemeTransportOptions,
): SampleAccurateMainThemeVoice | null {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext ||
    (window as WebkitAudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  try {
    return new MainThemeWebAudioTransport(
      new AudioContextConstructor({ latencyHint: 'interactive' }),
      options,
    );
  } catch (error) {
    logger.warn('Sample-accurate main theme transport unavailable:', error);
    return null;
  }
}

export function isSampleAccurateMainThemeVoice(
  voice: MainThemeVoiceLike,
): voice is SampleAccurateMainThemeVoice {
  return voice.sampleAccurateIntroLoop === true;
}
