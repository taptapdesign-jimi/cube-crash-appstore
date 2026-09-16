import { logger } from '../core/logger.js';

export type GameplayAudioPlaybackResult = 'played' | 'pending' | 'unavailable';

export interface GameplayAudioPlaybackOptions {
  voiceId: string;
  volume: number;
  loop?: boolean;
  playbackRate?: number;
  startOffsetSeconds?: number;
  startDelaySeconds?: number;
  stopAfterSeconds?: number;
  fadeOutSeconds?: number;
  onStarted?: () => void;
  onEnded?: () => void;
  /** Called when lifecycle cleanup cancels a queued or active voice. */
  onStopped?: () => void;
  /** Called only when a queued cold start later proves unavailable. */
  onDeferredUnavailable?: () => void;
}

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type ActiveVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  onStopped?: () => void;
};

type PendingVoiceStart = {
  source: string;
  options: GameplayAudioPlaybackOptions;
  token: symbol;
};

let audioContext: AudioContext | null = null;
let audioContextUnavailable = false;
let foregroundListenersInstalled = false;
let foregroundGestureRetryArmed = false;
const decodedBuffers = new Map<string, AudioBuffer>();
const pendingBuffers = new Map<string, Promise<void>>();
const failedBuffers = new Set<string>();
const activeVoices = new Map<string, ActiveVoice>();
const pendingVoiceStarts = new Map<string, PendingVoiceStart>();

function onGameplayAudioForeground(): void {
  if (typeof document !== 'undefined' && document.hidden) return;
  const context = audioContext;
  if (context && context.state !== 'running' && context.state !== 'closed') {
    // A suspended/interrupted iOS Web Audio context cannot finish active
    // result or ambient voices. Resume its existing sources; never replay SFX.
    armForegroundGestureRetry();
    void resumeAudioContext(context).then(() => {
      if (context !== audioContext) return;
      if (context.state === 'running') disarmForegroundGestureRetry();
      else armForegroundGestureRetry();
    });
  }
}

function onForegroundAudioGesture(event: Event): void {
  if (event.type === 'pointerdown') {
    const pointerType = (event as PointerEvent).pointerType;
    if (pointerType && pointerType !== 'mouse') return;
  }
  if (event.type === 'pointerup' && (event as PointerEvent).pointerType === 'mouse') return;
  const context = audioContext;
  if (!context || context.state === 'closed') {
    disarmForegroundGestureRetry();
    return;
  }
  void resumeAudioContext(context).then(() => {
    if (context === audioContext && context.state === 'running') {
      disarmForegroundGestureRetry();
    }
  });
}

function armForegroundGestureRetry(): void {
  if (foregroundGestureRetryArmed) return;
  foregroundGestureRetryArmed = true;
  document.addEventListener('pointerdown', onForegroundAudioGesture, true);
  document.addEventListener('pointerup', onForegroundAudioGesture, true);
  document.addEventListener('touchend', onForegroundAudioGesture, true);
  document.addEventListener('keydown', onForegroundAudioGesture, true);
}

function disarmForegroundGestureRetry(): void {
  if (!foregroundGestureRetryArmed) return;
  foregroundGestureRetryArmed = false;
  document.removeEventListener('pointerdown', onForegroundAudioGesture, true);
  document.removeEventListener('pointerup', onForegroundAudioGesture, true);
  document.removeEventListener('touchend', onForegroundAudioGesture, true);
  document.removeEventListener('keydown', onForegroundAudioGesture, true);
}

function installForegroundListeners(): void {
  if (foregroundListenersInstalled || typeof window === 'undefined') return;
  foregroundListenersInstalled = true;
  document.addEventListener('visibilitychange', onGameplayAudioForeground);
  window.addEventListener('pageshow', onGameplayAudioForeground);
}

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
    installForegroundListeners();
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
  const pendingVoice = pendingVoiceStarts.get(voiceId);
  pendingVoiceStarts.delete(voiceId);
  pendingVoice?.options.onStopped?.();
  const voice = activeVoices.get(voiceId);
  if (!voice) return;
  activeVoices.delete(voiceId);
  voice.source.onended = null;
  try { voice.source.stop(); } catch {}
  try { voice.source.disconnect(); } catch {}
  try { voice.gain.disconnect(); } catch {}
  voice.onStopped?.();
}

export function stopDecodedGameplayVoices(voiceIds: readonly string[]): void {
  voiceIds.forEach(stopDecodedGameplayVoice);
}

export function fadeOutDecodedGameplayVoice(voiceId: string, durationSeconds: number): boolean {
  pendingVoiceStarts.delete(voiceId);
  const voice = activeVoices.get(voiceId);
  const context = audioContext;
  if (!voice || !context) return false;

  const duration = Math.max(0, durationSeconds);
  if (duration === 0) {
    stopDecodedGameplayVoice(voiceId);
    return true;
  }

  try {
    const now = context.currentTime;
    const currentVolume = voice.gain.gain.value;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(currentVolume, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + duration);
    voice.source.stop(now + duration);
    return true;
  } catch {
    stopDecodedGameplayVoice(voiceId);
    return false;
  }
}

export function setDecodedGameplayVoiceVolume(
  voiceId: string,
  volume: number,
  durationSeconds = 0,
): boolean {
  const targetVolume = Math.max(0, Math.min(1, volume));
  const pendingVoice = pendingVoiceStarts.get(voiceId);
  if (pendingVoice) {
    pendingVoice.options = {
      ...pendingVoice.options,
      volume: targetVolume,
    };
  }

  const voice = activeVoices.get(voiceId);
  const context = audioContext;
  if (!voice || !context) return pendingVoice !== undefined;

  try {
    const now = context.currentTime;
    const gain = voice.gain.gain;
    const duration = Math.max(0, durationSeconds);
    if (duration > 0 && typeof gain.cancelAndHoldAtTime === 'function') {
      gain.cancelAndHoldAtTime(now);
    } else {
      const currentVolume = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(currentVolume, now);
    }
    if (duration > 0) gain.linearRampToValueAtTime(targetVolume, now + duration);
    else gain.setValueAtTime(targetVolume, now);
    return true;
  } catch {
    return false;
  }
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
        pendingStart.options.onDeferredUnavailable?.();
        return;
      }
      if (context.state !== 'running') {
        pendingVoiceStarts.delete(options.voiceId);
        pendingStart.options.onDeferredUnavailable?.();
        return;
      }
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
    sourceNode.loop = options.loop === true;
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
    const voice = { source: sourceNode, gain: gainNode, onStopped: options.onStopped };
    activeVoices.set(options.voiceId, voice);
    sourceNode.onended = () => {
      if (activeVoices.get(options.voiceId) === voice) activeVoices.delete(options.voiceId);
      try { sourceNode.disconnect(); } catch {}
      try { gainNode.disconnect(); } catch {}
      options.onEnded?.();
    };
    sourceNode.start(startAt, startOffsetSeconds);
    if (stopAt !== null) sourceNode.stop(stopAt);
    options.onStarted?.();
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
  disarmForegroundGestureRetry();
  if (foregroundListenersInstalled) {
    document.removeEventListener('visibilitychange', onGameplayAudioForeground);
    window.removeEventListener('pageshow', onGameplayAudioForeground);
    foregroundListenersInstalled = false;
  }
  stopDecodedGameplayVoices(Array.from(activeVoices.keys()));
  decodedBuffers.clear();
  pendingBuffers.clear();
  failedBuffers.clear();
  pendingVoiceStarts.clear();
  if (audioContext) void audioContext.close().catch(() => {});
  audioContext = null;
  audioContextUnavailable = false;
}
