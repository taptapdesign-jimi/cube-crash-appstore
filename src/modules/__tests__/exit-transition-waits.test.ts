import { resolveExitWaits } from '../exit-transition-waits';

const BASELINE = {
  hudExitMs: 280,
  errorFallbackMs: 180,
  postExitSettleMs: 24,
  uiHandoffMs: 120,
  collectiblesCleanupBudgetMs: 120,
  noTilesFallbackMs: 220,
  postPopOutSettleMs: 24,
};

describe('exit transition waits', () => {
  it.each([
    ['default', {}],
    ['skip request without completion proof', { skipBoardExit: true }],
    ['completion proof without a skipped board exit', { visualExitAlreadyComplete: true }],
  ])('keeps the safe baseline for %s', (_label, input) => {
    expect(resolveExitWaits(input)).toEqual(BASELINE);
  });

  it('removes only duplicate waits after a proven completed terminal visual exit', () => {
    expect(resolveExitWaits({
      skipBoardExit: true,
      visualExitAlreadyComplete: true,
    })).toEqual({
      ...BASELINE,
      hudExitMs: 0,
      postExitSettleMs: 16,
      uiHandoffMs: 90,
    });
  });
});
