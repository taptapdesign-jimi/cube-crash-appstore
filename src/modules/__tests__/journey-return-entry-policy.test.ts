import { resolveJourneyReturnEntryPolicy } from '../journey-return-entry-policy';

describe('Journey return entry policy', () => {
  test('rejects a stale interim marker on Hub even when an old id survived', () => {
    expect(resolveJourneyReturnEntryPolicy({
      interimReturnRequested: true,
      detailReturnRequested: false,
      returnBoardId: 7,
      hasRenderedBoardTarget: false,
      isWorldView: false,
    })).toEqual({
      hasConcreteTarget: false,
      returningFromInterimBoard: false,
      returningFromDetailModal: false,
      useWorldReturnEnter: false,
      playActiveBoardAreaEnter: false,
      clearStaleReturn: true,
    });
  });

  test('uses the active-area enter for a rendered legacy board target', () => {
    const result = resolveJourneyReturnEntryPolicy({
      interimReturnRequested: true,
      detailReturnRequested: false,
      returnBoardId: 7,
      hasRenderedBoardTarget: true,
      isWorldView: false,
    });
    expect(result.playActiveBoardAreaEnter).toBe(true);
    expect(result.useWorldReturnEnter).toBe(false);
    expect(result.clearStaleReturn).toBe(false);
  });

  test.each([
    ['interim', true, false],
    ['detail', false, true],
  ])('uses World return for a concrete %s return', (_name, interim, detail) => {
    const result = resolveJourneyReturnEntryPolicy({
      interimReturnRequested: interim,
      detailReturnRequested: detail,
      returnBoardId: 11,
      hasRenderedBoardTarget: false,
      isWorldView: true,
    });
    expect(result.hasConcreteTarget).toBe(true);
    expect(result.useWorldReturnEnter).toBe(true);
    expect(result.playActiveBoardAreaEnter).toBe(false);
  });

  test('does not invent a World return without a valid board id', () => {
    const result = resolveJourneyReturnEntryPolicy({
      interimReturnRequested: true,
      detailReturnRequested: false,
      returnBoardId: null,
      hasRenderedBoardTarget: true,
      isWorldView: true,
    });
    expect(result.hasConcreteTarget).toBe(false);
    expect(result.clearStaleReturn).toBe(true);
  });
});
