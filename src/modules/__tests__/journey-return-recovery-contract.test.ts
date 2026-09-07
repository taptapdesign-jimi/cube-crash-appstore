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
});
