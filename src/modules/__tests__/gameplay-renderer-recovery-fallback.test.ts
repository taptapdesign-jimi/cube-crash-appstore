import {
  hideGameplayRendererRecoveryFallback,
  isGameplayRendererRecoveryFallbackVisible,
  resetGameplayRendererRecoveryFallbackForTests,
  showGameplayRendererRecoveryFallback,
} from '../gameplay-renderer-recovery-fallback';

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

describe('gameplay renderer recovery fallback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGameplayRendererRecoveryFallbackForTests();
  });

  afterEach(() => {
    resetGameplayRendererRecoveryFallbackForTests();
  });

  test('mounts one opaque fail-visible surface without mutating Pixi or input ownership', () => {
    const onRetry = jest.fn(() => false);
    const controller = showGameplayRendererRecoveryFallback({
      reason: 'webglcontextrestored',
      onRetry,
      document,
    });

    expect(controller).not.toBeNull();
    expect(isGameplayRendererRecoveryFallbackVisible()).toBe(true);
    expect(controller?.element.dataset.reason).toBe('webglcontextrestored');
    expect(controller?.element.getAttribute('role')).toBe('alertdialog');
    expect(controller?.element.style.pointerEvents).toBe('auto');
    expect(controller?.element.style.backgroundImage).toContain('paper-bg.png');
    expect(document.body.textContent).toContain('Your run is still protected');
    expect(document.body.querySelectorAll('#cc-gameplay-renderer-recovery')).toHaveLength(1);
  });

  test('keeps fallback visible and restores actions when recovery rejects', async () => {
    const onRetry = jest.fn().mockRejectedValue(new Error('GPU unavailable'));
    const controller = showGameplayRendererRecoveryFallback({
      reason: 'failed-recovery',
      onRetry,
      onReturnToMenu: jest.fn(() => false),
      document,
    });
    const retry = controller?.element.querySelector<HTMLButtonElement>('button');

    retry?.click();
    retry?.click();
    await flush();

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(isGameplayRendererRecoveryFallbackVisible()).toBe(true);
    expect(retry?.disabled).toBe(false);
    expect(controller?.element.textContent).toContain('Recovery did not complete');
  });

  test('dismisses only after an action explicitly confirms a safe completion', async () => {
    const controller = showGameplayRendererRecoveryFallback({
      reason: 'failed-recovery',
      onRetry: jest.fn(() => false),
      onReturnToMenu: jest.fn(() => true),
      document,
    });
    const buttons = controller?.element.querySelectorAll<HTMLButtonElement>('button');

    buttons?.[0]?.click();
    await flush();
    expect(isGameplayRendererRecoveryFallbackVisible()).toBe(true);

    buttons?.[1]?.click();
    await flush();
    expect(isGameplayRendererRecoveryFallbackVisible()).toBe(false);
  });

  test('replacement invalidates late completion from the retired owner', async () => {
    let finishFirst!: (completed: boolean) => void;
    const first = showGameplayRendererRecoveryFallback({
      reason: 'first',
      onRetry: () => new Promise<boolean>((resolve) => { finishFirst = resolve; }),
      document,
    });
    first?.element.querySelector<HTMLButtonElement>('button')?.click();

    const second = showGameplayRendererRecoveryFallback({
      reason: 'second',
      onRetry: () => false,
      document,
    });
    finishFirst(true);
    await flush();

    expect(first?.isCurrent()).toBe(false);
    expect(second?.isCurrent()).toBe(true);
    expect(document.body.querySelectorAll('#cc-gameplay-renderer-recovery')).toHaveLength(1);
    expect(document.body.querySelector<HTMLElement>('#cc-gameplay-renderer-recovery')?.dataset.reason).toBe('second');
  });

  test('dispose and global hide are idempotent', () => {
    const controller = showGameplayRendererRecoveryFallback({
      reason: 'cleanup',
      onRetry: () => false,
      document,
    });

    controller?.dispose();
    controller?.dispose();
    hideGameplayRendererRecoveryFallback();

    expect(isGameplayRendererRecoveryFallbackVisible()).toBe(false);
    expect(document.getElementById('cc-gameplay-renderer-recovery')).toBeNull();
  });
});
