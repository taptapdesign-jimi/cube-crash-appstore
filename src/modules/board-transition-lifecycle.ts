export type BoardTransitionSettlement = (invokeOnComplete?: boolean) => boolean;

export function createBoardTransitionSettlement(options: {
  resolve: () => void;
  onComplete: () => void;
  onSettled?: () => void;
}): BoardTransitionSettlement {
  let settled = false;

  return (invokeOnComplete = true): boolean => {
    if (settled) return false;
    settled = true;
    try {
      options.onSettled?.();
    } finally {
      options.resolve();
      if (invokeOnComplete) options.onComplete();
    }
    return true;
  };
}
