export interface JourneyReturnEntryPolicyInput {
  interimReturnRequested: boolean;
  detailReturnRequested: boolean;
  returnBoardId: number | null;
  hasRenderedBoardTarget: boolean;
  isWorldView: boolean;
}

export interface JourneyReturnEntryPolicy {
  hasConcreteTarget: boolean;
  returningFromInterimBoard: boolean;
  returningFromDetailModal: boolean;
  useWorldReturnEnter: boolean;
  playActiveBoardAreaEnter: boolean;
  clearStaleReturn: boolean;
}

/**
 * A persisted board id is only a hint. It becomes a return target when the
 * prepared Journey surface can actually present it: either the World view is
 * active, or the corresponding board card exists in the rendered legacy area.
 */
export function resolveJourneyReturnEntryPolicy(
  input: JourneyReturnEntryPolicyInput,
): JourneyReturnEntryPolicy {
  const hasValidBoardId =
    Number.isInteger(input.returnBoardId) && (input.returnBoardId as number) > 0;
  const hasConcreteTarget =
    hasValidBoardId && (input.isWorldView || input.hasRenderedBoardTarget);
  const returningFromInterimBoard =
    input.interimReturnRequested && hasConcreteTarget;
  const returningFromDetailModal =
    input.detailReturnRequested && hasConcreteTarget;
  const hasAcceptedReturn = returningFromInterimBoard || returningFromDetailModal;

  return {
    hasConcreteTarget,
    returningFromInterimBoard,
    returningFromDetailModal,
    useWorldReturnEnter: hasAcceptedReturn && input.isWorldView,
    playActiveBoardAreaEnter: hasAcceptedReturn && !input.isWorldView,
    clearStaleReturn:
      !hasConcreteTarget &&
      (input.interimReturnRequested || input.detailReturnRequested),
  };
}
