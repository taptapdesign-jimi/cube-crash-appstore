/** Gain envelopes use the audio clock, including while rendering is blocked. */
export class SoundtrackAudioClockVolume {
  private level: number;
  private ramp: { from: number; to: number; start: number; end: number } | null = null;

  constructor(private readonly context: AudioContext, private readonly gain: AudioParam, initial: number) {
    this.level = initial;
    gain.setValueAtTime(initial, context.currentTime);
  }

  get value(): number {
    if (!this.ramp) return this.level;
    const progress = Math.max(0, Math.min(1,
      (this.context.currentTime - this.ramp.start) / (this.ramp.end - this.ramp.start)));
    return this.ramp.from + (this.ramp.to - this.ramp.from) * progress;
  }

  set value(value: number) {
    this.level = Math.max(0, Math.min(1, value));
    this.ramp = null;
    this.gain.cancelScheduledValues(this.context.currentTime);
    this.gain.setValueAtTime(this.level, this.context.currentTime);
  }

  cancel(): void {
    const current = this.value;
    this.value = current;
  }

  fade(to: number, durationMs: number): void {
    const from = this.value;
    this.value = from;
    if (!Number.isFinite(durationMs) || durationMs <= 0) { this.value = to; return; }
    const start = this.context.currentTime;
    const end = start + durationMs / 1000;
    this.ramp = { from, to: Math.max(0, Math.min(1, to)), start, end };
    this.gain.linearRampToValueAtTime(this.ramp.to, end);
  }
}
