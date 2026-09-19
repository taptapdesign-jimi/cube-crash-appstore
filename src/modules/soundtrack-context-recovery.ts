import { arePerformanceDiagnosticsEnabled } from '../utils/runtime-diagnostics-policy.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

/** WebKit can leave resume() pending instead of rejecting for missing activation. */
export const SOUNDTRACK_CONTEXT_RESUME_TIMEOUT_MS = 1000;

export class SoundtrackContextRecovery {
  private cancelPending: (() => void) | null = null;

  constructor(private readonly context: AudioContext) {}

  get pending(): boolean { return this.cancelPending !== null; }

  cancel(): void {
    this.cancelPending?.();
  }

  resume(): Promise<void> {
    this.cancel();
    if (this.context.state === 'running') return Promise.resolve();
    const startedAt = performance.now();
    const report = (event: string): void => {
      if (arePerformanceDiagnosticsEnabled()) {
        emitNativeConsoleDiagnostic('[CC_RESUME_RETURN]', event, {
          contextState: this.context.state,
          hidden: document.hidden,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      }
    };
    report('soundtrack-resume-start');
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.cancelPending = null;
        if (error) reject(error);
        else resolve();
      };
      const timeout = setTimeout(() => {
        report('soundtrack-resume-timeout');
        // Some WebKit versions resume the clock without settling the promise.
        if (this.context.state === 'running') finish();
        else finish(new DOMException('Soundtrack resume requires a gesture', 'NotAllowedError'));
      }, SOUNDTRACK_CONTEXT_RESUME_TIMEOUT_MS);
      this.cancelPending = () => { report('soundtrack-resume-cancel'); finish(); };
      // Invoke in the gesture stack. A late native completion cannot settle
      // the retired request or start an obsolete transport generation.
      try { void this.context.resume().then(() => {
        if (!settled) report('soundtrack-resume-complete');
        finish();
      }, finish); }
      catch (error) { finish(error); }
    });
  }
}
