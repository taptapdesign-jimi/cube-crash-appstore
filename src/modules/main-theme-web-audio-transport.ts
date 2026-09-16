import { logger } from '../core/logger.js';

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export type MainThemeVoiceLike = Pick<
  HTMLAudioElement,
  'loop' | 'preload' | 'paused' | 'volume' | 'currentTime' | 'play' | 'pause'
> & {
  readonly sampleAccurateIntroLoop?: boolean;
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
  private readonly bufferPromise: Promise<AudioBuffer>;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private storedPosition = 0;
  private anchorPosition = 0;
  private anchorContextTime = 0;
  private isPaused = true;
  private isDisposed = false;
  private currentVolume: number;
  private playGeneration = 0;

  constructor(context: AudioContext, options: MainThemeTransportOptions) {
    this.context = context;
    this.options = options;
    this.currentVolume = options.initialVolume;
    this.gain = context.createGain();
    this.gain.gain.setValueAtTime(this.currentVolume, context.currentTime);
    this.gain.connect(context.destination);
    this.bufferPromise = this.loadBuffer();
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get volume(): number {
    return this.currentVolume;
  }

  set volume(value: number) {
    this.currentVolume = Math.max(0, Math.min(1, value));
    if (this.isDisposed) return;
    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.currentVolume, now);
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
    const buffer = await this.bufferPromise;
    if (this.isDisposed || generation !== this.playGeneration) return;
    this.buffer = buffer;
    if (this.context.state !== 'running') await this.context.resume();
    if (this.isDisposed || generation !== this.playGeneration) return;
    if (!isContextRunning(this.context)) {
      throw new DOMException('User activation required', 'NotAllowedError');
    }
    if (!this.isPaused) return;
    this.startSource(this.storedPosition);
  }

  pause(): void {
    this.playGeneration++;
    if (this.isPaused) return;
    this.storedPosition = this.currentTime;
    this.stopSource();
    this.isPaused = true;
  }

  async resumeIfInterrupted(): Promise<void> {
    if (this.isDisposed || this.isPaused || this.context.state === 'running') return;
    await this.context.resume();
    if (!isContextRunning(this.context)) {
      throw new DOMException('Main theme context remains interrupted', 'NotAllowedError');
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.pause();
    this.isDisposed = true;
    try { this.gain.disconnect(); } catch {}
    void this.context.close().catch(() => {});
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
