import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

describe('Journey return recovery integration contract', () => {
  test('reactivates a disposed manager before direct detail presentation and reports readiness', () => {
    const source = read('src/modules/journey-boards-manager.ts');
    const start = source.indexOf('public async openBoardDetailsById(');
    const end = source.indexOf('\n  // 🔥 FIGMA DESIGN:', start);
    const method = source.slice(start, end);

    expect(method).toContain('if (skipJourneyExit && this.renderDisposed)');
    expect(method).toContain('this.beginRenderLifecycle();');
    expect(method).toContain('isJourneyDetailModalPresentationReady()');
    expect(method).toContain('return presented;');
  });

  test('does not hide gameplay behind an unverified detail or World return', () => {
    const source = read('src/main.ts');
    const detailBranchStart = source.indexOf('if (returnToDetailModal && detailModalBoardId !== null)');
    const journeyBranchStart = source.indexOf("} else if (exitRoute.target === 'journey')", detailBranchStart);
    const detailBranch = source.slice(detailBranchStart, journeyBranchStart);
    const journeyBranch = source.slice(journeyBranchStart, source.indexOf('\n    } else {', journeyBranchStart));

    expect(detailBranch).toContain('detailPresentationReady = await journeyBoardsManager.openBoardDetailsById');
    expect(detailBranch).toContain('if (!detailPresentationReady)');
    expect(detailBranch).toContain('prepareJourneyWorldRecovery({');
    expect(detailBranch).toContain("waitForJourneyReturnPresentation('screen')");
    expect(journeyBranch).toContain("waitForJourneyReturnPresentation('screen')");
    expect(journeyBranch).toContain("throw new Error('Journey return did not present a visible Hub or World Unit')");
  });

  test('menu watchdog rejects paper-only Journey and rebuilds through the shared recovery owner', () => {
    const source = read('src/modules/menu-exit-handoff.ts');
    const visibleCheck = source.slice(
      source.indexOf('export function isAnyMenuScreenVisible()'),
      source.indexOf('\nfunction isHomepageMenuReady'),
    );
    const autoRecovery = source.slice(
      source.indexOf('async function forceAutoMenuVisible('),
      source.indexOf('\nexport async function ensureMenuVisibleAfterExit'),
    );

    expect(visibleCheck).toContain('isJourneyScreenPresentationReady()');
    expect(visibleCheck).toContain('isJourneyDetailModalPresentationReady()');
    expect(visibleCheck).not.toContain("isVisible(document.getElementById('journey-screen')");
    expect(autoRecovery).toContain('prepareJourneyWorldRecovery({');
    expect(autoRecovery).toContain("waitForJourneyReturnPresentation('screen')");
  });

  test('Journey visible enter retries join one owner and its watchdog performs a real current-route recovery', () => {
    const collectibles = read('src/collectibles-manager.ts');
    const show = collectibles.slice(
      collectibles.indexOf('async showCollectibles(options?: CollectiblesShowOptions): Promise<void>'),
      collectibles.indexOf('\n  async hideCollectibles(', collectibles.indexOf('async showCollectibles')),
    );

    expect(show).toContain('const visibleEnterLease = this.journeyVisibleEnterOwner.acquire(journeyPresentationEpoch)');
    expect(show).toContain('if (visibleEnterLease.joined)');
    expect(show).toContain('await visibleEnterLease.promise;');
    expect(show).toContain("logger.warn('⚠️ Journey enter missed its visible commit - applying current-route recovery'");
    expect(show).toContain("emitIOSNativeDiagnostic('visible-enter-watchdog-recovered'");
    expect(show).toContain("restoreJourneyScrollableInteractivity('journey-visible-commit-watchdog')");
    expect(show).not.toContain('keeping screen primed hidden to prevent flash');
  });

  test('World return reactivates a disposed manager and completes only its terminal owner', () => {
    const boards = read('src/modules/journey-boards-manager.ts');
    const playStart = boards.indexOf('public playJourneyV700WorldEnterFromReturn(');
    const prepareStart = boards.indexOf('public prepareJourneyV700WorldEnterFromReturn(');
    const play = boards.slice(playStart, prepareStart);
    const prepare = boards.slice(prepareStart, boards.indexOf('\n  public cancelPreparedJourneyV700WorldEnter', prepareStart));
    const enterStart = boards.indexOf('private playJourneyV700WorldEnter(');
    const enter = boards.slice(enterStart, boards.indexOf('\n  private ', enterStart + 10));

    expect(play).toContain('this.resumeForVisibleWorldReturn(source);');
    expect(prepare).toContain('this.resumeForVisibleWorldReturn(source);');
    expect(enter).toContain('options.returnOwnerToken ?? null');
    expect(enter).toContain('completeJourneyReturnTransition(');
  });
});
