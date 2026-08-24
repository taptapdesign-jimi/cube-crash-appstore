export type BoardTransitionSettlement = (invokeOnComplete?: boolean) => boolean;

export function createBoardTransitionSettlement(options: {
  resolve: () => void;
  reject?: (error: unknown) => void;
  onComplete: () => void | Promise<void>;
  onSettled?: () => void;
}): BoardTransitionSettlement {
  let settled = false;

  return (invokeOnComplete = true): boolean => {
    if (settled) return false;
    settled = true;
    try {
      options.onSettled?.();
    } catch (error) {
      options.resolve();
      throw error;
    }
    if (!invokeOnComplete) {
      options.resolve();
      return true;
    }
    try {
      const completion = options.onComplete();
      if (!completion || typeof (completion as Promise<void>).then !== 'function') {
        options.resolve();
        return true;
      }
      void Promise.resolve(completion).then(options.resolve).catch((error) => {
        if (options.reject) options.reject(error);
        else options.resolve();
      });
    } catch (error) {
      if (options.reject) options.reject(error);
      else options.resolve();
    }
    return true;
  };
}
