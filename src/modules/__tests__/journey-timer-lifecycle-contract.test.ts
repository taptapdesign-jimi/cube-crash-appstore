import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/modules/journey-boards-manager.ts'),
  'utf8',
);

function between(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('Journey render timer lifecycle', () => {
  test('tracked timeout and RAF callbacks belong to the render generation that created them', () => {
    const ownership = between(
      'private trackRAF(callback: FrameRequestCallback, onCancel?: () => void)',
      'private cancelAllRAFs()',
    );

    expect(ownership).toContain('const generation = this.renderLifecycleGeneration');
    expect(ownership).toContain('generation !== this.renderLifecycleGeneration');
    expect(ownership).toContain('this._activeRAFCancellationHandlers.delete(rafId)');
    expect(ownership).toContain('private waitForTrackedFrames');
    expect(ownership).toContain('this._activeTimeoutCancellationHandlers.delete(timeoutId)');
    expect(ownership).toContain('try { onCancel?.(); } catch {}');
  });

  test('beginning a replacement render immediately retires the previous callback bag', () => {
    const beginLifecycle = between(
      'private beginRenderLifecycle()',
      'private cancelAllRAFs()',
    );
    const rafCancellation = between(
      'private cancelAllRAFs()',
      'private cancelAllTimeouts()',
    );

    expect(beginLifecycle).toContain('this.cancelAllRAFs()');
    expect(beginLifecycle).toContain('this.cancelAllTimeouts()');
    expect(beginLifecycle.indexOf('this.cancelAllRAFs()')).toBeLessThan(
      beginLifecycle.indexOf('this.renderLifecycleGeneration += 1'),
    );
    expect(rafCancellation).toContain('this._activeRAFCancellationHandlers.clear()');
    expect(rafCancellation).toContain('cancellationHandlers.forEach');
  });

  test('cleanup invalidates the generation and settles tracked cancellation handlers', () => {
    const cancellation = between(
      'private cancelAllTimeouts()',
      'private isJourneyCardTapExitProtectedTarget',
    );
    const cleanup = between('public cleanup(): void', 'private initializeBoards(): void');

    expect(cancellation).toContain('this._activeTimeoutCancellationHandlers.clear()');
    expect(cancellation).toContain('cancellationHandlers.forEach');
    expect(cleanup).toContain('this.renderDisposed = true');
    expect(cleanup).toContain('this.renderLifecycleGeneration += 1');
    expect(cleanup).toContain('this.cancelAllTimeouts()');
    expect(cleanup).toContain('(this as any)._scrollRetryCount = 0');
  });

  test('detail-return and scroll retries no longer bypass Journey lifecycle ownership', () => {
    const revealFallback = between(
      'const runJourneyRevealFallback = (attempt = 0)',
      'constructor()',
    );
    const scrollRetry = between(
      'private scrollToInterimCard(preferredBoardId?: number)',
      'public renderBoards(): void',
    );

    expect(revealFallback).toContain('!isCurrentDetailReturn() || this.renderDisposed');
    expect(revealFallback).not.toContain('window.setTimeout');
    expect(revealFallback).toContain('this.trackTimeout(() => runJourneyRevealFallback');
    expect(scrollRetry).not.toContain('setTimeout(');
    expect(scrollRetry).not.toContain('requestAnimationFrame(');
    expect(scrollRetry).toContain('this.trackTimeout(() =>');
    expect(scrollRetry).toContain('this.trackRAF(() =>');
  });

  test('promise fallbacks settle when their render lifecycle is cancelled', () => {
    const hubWait = between(
      'public waitForJourneyV700HubPresentation',
      'private cancelJourneyV700HubEnter',
    );
    const navExit = between(
      'private playJourneyV700NavExit()',
      'private playJourneyV700NavEnter',
    );

    expect(hubWait).toContain('this.trackTimeout(() => finish(false), timeoutMs, () => finish(false))');
    expect(navExit).toContain("() => completeOnce('lifecycle-cancelled')");
    expect(navExit).toContain('this.clearTrackedTimeout(fallbackTimer)');

    const cardRemainderOverlap = between(
      'private waitForJourneyTapRemainderOverlap()',
      'private async runClickedJourneyBoardUnitExit',
    );
    expect(cardRemainderOverlap).toContain(
      'this.trackTimeout(resolve, BOARD_AREA_CARD_REMAINDER_EXIT_OVERLAP_MS, resolve)',
    );
  });

  test('high-risk render and detail DOM mutations use generation-owned frames and timers', () => {
    const overlayReady = between(
      'private waitForJourneyOverlayReturnReady',
      'public playJourneyOverlayReturnCard',
    );
    const detailOpen = between(
      'public async openBoardDetails',
      'public refreshBackgroundPosition',
    );
    const backgroundRefresh = between(
      'public refreshBackgroundPosition',
      'private ensureWorldInterimCards',
    );

    expect(overlayReady).not.toContain('requestAnimationFrame(');
    expect(overlayReady).toContain('this.trackRAF(sample, () => resolve(null))');
    expect(detailOpen).toContain('if (!await this.waitForTrackedFrames(2)) return;');
    expect(detailOpen).toContain('this.trackTimeout(() =>');
    expect(detailOpen).toContain('this.trackRAF(() =>');
    expect(backgroundRefresh).not.toContain('requestAnimationFrame(');
    expect(backgroundRefresh).toContain('this.trackRAF(() =>');
  });
});
