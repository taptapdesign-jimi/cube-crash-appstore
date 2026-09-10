import { logger } from '../core/logger.js';

export type GameplayAudioPlaybackResult = 'played' | 'pending' | 'unavailable';

export interface GameplayAudioPlaybackOptions {
  voiceId: string;
  volume: number;
  playbackRate?: number;
  startOffsetSeconds?: number;
  startDelaySeconds?: number;
  stopAfterSeconds?: number;
  fadeOutSeconds?: number;
}

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type ActiveVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

type PendingVoiceStart = {
  source: string;
  options: GameplayAudioPlaybackOptions;
  token: symbol;
};

let audioContext: AudioContext | null = null;
let audioContextUnavailable = false;
const decodedBuffers = new Map<string, AudioBuffer>();
const pendingBuffers = new Map<string, Promise<void>>();
const failedBuffers = new Set<string>();
const activeVoices = new Map<string, ActiveVoice>();
const pendingVoiceStarts = new Map<string, PendingVoiceStart>();

function resolveSource(source: string): string {
  if (typeof document === 'undefined') return source;
  return new URL(source, document.baseURI).href;
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  if (audioContextUnavailable || typeof window === 'undefined') return null;

  const AudioContextConstructor = window.AudioContext ||
    (window as WebkitAudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) {
    audioContextUnavailable = true;
    return null;
  }

  try {
    audioContext = new AudioContextConstructor({ latencyHint: 'interactive' });
    return audioContext;
  } catch (error) {
    audioContextUnavailable = true;
    logger.warn('Web Audio gameplay owner unavailable; using media-element fallback:', error);
    return null;
  }
}

function resumeAudioContext(context: AudioContext): Promise<void> {
  if (context.state === 'running' || context.state === 'closed') return Promise.resolve();
  return context.resume().catch((error) => {
    logger.warn('Failed to resume Web Audio gameplay owner:', error);
  });
}

function preloadSource(context: AudioContext, source: string): void {
  const resolvedSource = resolveSource(source);
  if (
    decodedBuffers.has(resolvedSource) ||
    pendingBuffers.has(resolvedSource) ||
    failedBuffers.has(resolvedSource)
  ) return;

  const pending = (async () => {
    try {
      const response = await fetch(resolvedSource, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const encodedAudio = await response.arrayBuffer();
      const decodedAudio = await context.decodeAudioData(encodedAudio);
      decodedBuffers.set(resolvedSource, decodedAudio);
    } catch (error) {
      failedBuffers.add(resolvedSource);
      logger.warn(`Failed to predecode gameplay sound ${source}:`, error);
    } finally {
      pendingBuffers.delete(resolvedSource);
    }
  })();
  pendingBuffers.set(resolvedSource, pending);
}

export function preloadDecodedGameplaySounds(sources: readonly string[]): boolean {
  const context = getAudioContext();
  if (!context) return false;
  resumeAudioContext(context);
  sources.forEach((source) => preloadSource(context, source));
  return true;
}

export function getDecodedGameplaySoundsState(
  sources: readonly string[],
): 'ready' | 'pending' | 'unavailable' {
  const context = getAudioContext();
  if (!context) return 'unavailable';

  const resolvedSources = sources.map(resolveSource);
  if (resolvedSources.some((source) => failedBuffers.has(source))) return 'unavailable';
  if (resolvedSources.every((source) => decodedBuffers.has(source))) return 'ready';
  sources.forEach((source) => preloadSource(context, source));
  return 'pending';
}

export function stopDecodedGameplayVoice(voiceId: string): void {
  pendingVoiceStarts.delete(voiceId);
  const voice = activeVoices.get(voiceId);
  if (!voice) return;
  activeVoices.delete(voiceId);
  voice.source.onended = null;
  try { voice.source.stop(); } catch {}
  try { voice.source.disconnect(); } catch {}
  try { voice.gain.disconnect(); } catch {}
}

export function stopDecodedGameplayVoices(voiceIds: readonly string[]): void {
  voiceIds.forEach(stopDecodedGameplayVoice);
}

export function playDecodedGameplaySound(
  source: string,
  options: GameplayAudioPlaybackOptions,
): GameplayAudioPlaybackResult {
  const context = getAudioContext();
  if (!context) return 'unavailable';

  const resolvedSource = resolveSource(source);
  if (failedBuffers.has(resolvedSource)) return 'unavailable';
  const buffer = decodedBuffers.get(resolvedSource);
  if (!buffer || context.state !== 'running') {
    const token = Symbol(options.voiceId);
    pendingVoiceStarts.set(options.voiceId, { source, options: { ...options }, token });
    preloadSource(context, source);
    const decodeReady = pendingBuffers.get(resolvedSource) ?? Promise.resolve();
    void Promise.all([decodeReady, resumeAudioContext(context)]).then(() => {
      const pendingStart = pendingVoiceStarts.get(options.voiceId);
      if (!pendingStart || pendingStart.token !== token) return;
      if (failedBuffers.has(resolvedSource)) {
        pendingVoiceStarts.delete(options.voiceId);
        return;
      }
      if (context.state !== 'running') return;
      pendingVoiceStarts.delete(options.voiceId);
      playDecodedGameplaySound(pendingStart.source, pendingStart.options);
    });
    return 'pending';
  }

  try {
    stopDecodedGameplayVoice(options.voiceId);

    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    const now = context.currentTime;
    const volume = Math.max(0, Math.min(1, options.volume));
    const playbackRate = Math.max(0.01, options.playbackRate ?? 1);
    const startOffsetSeconds = Math.max(0, options.startOffsetSeconds ?? 0);
    const startDelaySeconds = Math.max(0, options.startDelaySeconds ?? 0);
    const startAt = now + startDelaySeconds;
    const stopAfterSeconds = options.stopAfterSeconds;
    const fadeOutSeconds = Math.max(0, options.fadeOutSeconds ?? 0);
    let stopAt: number | null = null;

    sourceNode.buffer = buffer;
    sourceNode.playbackRate.setValueAtTime(playbackRate, now);
    gainNode.gain.setValueAtTime(volume, now);
    if (stopAfterSeconds !== undefined) {
      stopAt = startAt + Math.max(0, stopAfterSeconds);
      if (fadeOutSeconds > 0) {
        const fadeStartsAt = Math.max(startAt, stopAt - fadeOutSeconds);
        gainNode.gain.setValueAtTime(volume, fadeStartsAt);
        gainNode.gain.linearRampToValueAtTime(0, stopAt);
      }
    }

    sourceNode.connect(gainNode);
    gainNode.connect(context.destination);
    const voice = { source: sourceNode, gain: gainNode };
    activeVoices.set(options.voiceId, voice);
    sourceNode.onended = () => {
      if (activeVoices.get(options.voiceId) === voice) activeVoices.delete(options.voiceId);
      try { sourceNode.disconnect(); } catch {}
      try { gainNode.disconnect(); } catch {}
    };
    sourceNode.start(startAt, startOffsetSeconds);
    if (stopAt !== null) sourceNode.stop(stopAt);
    return 'played';
  } catch (error) {
    logger.warn(`Failed to start decoded gameplay sound ${source}:`, error);
    return 'unavailable';
  }
}

export function getDecodedGameplayAudioStats() {
  return {
    contextState: audioContext?.state ?? (audioContextUnavailable ? 'unavailable' : 'uninitialized'),
    decodedBuffers: decodedBuffers.size,
    pendingBuffers: pendingBuffers.size,
    failedBuffers: failedBuffers.size,
    activeVoices: activeVoices.size,
    pendingVoiceStarts: pendingVoiceStarts.size,
  };
}

export function resetDecodedGameplayAudioForTests(): void {
  stopDecodedGameplayVoices(Array.from(activeVoices.keys()));
  decodedBuffers.clear();
  pendingBuffers.clear();
  failedBuffers.clear();
  pendingVoiceStarts.clear();
  if (audioContext) void audioContext.close().catch(() => {});
  audioContext = null;
  audioContextUnavailable = false;
}
