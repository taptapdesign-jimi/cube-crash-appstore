export type JourneyReturnScrollClaimReason = 'touchstart' | 'wheel';

interface JourneyReturnScrollOwnership {
  userOwned: boolean;
  dispose: () => void;
}

const ownershipByScrollable = new WeakMap<HTMLElement, JourneyReturnScrollOwnership>();

export function beginJourneyReturnScrollOwnership(
  scrollable: HTMLElement,
  onUserClaim?: (reason: JourneyReturnScrollClaimReason) => void,
): void {
  ownershipByScrollable.get(scrollable)?.dispose();

  let disposed = false;
  const ownership: JourneyReturnScrollOwnership = {
    userOwned: false,
    dispose: () => {},
  };

  const claim = (reason: JourneyReturnScrollClaimReason): void => {
    if (disposed || ownership.userOwned) return;
    ownership.userOwned = true;
    removeListeners();
    onUserClaim?.(reason);
  };
  const onTouchStart = (): void => claim('touchstart');
  const onWheel = (): void => claim('wheel');
  const removeListeners = (): void => {
    scrollable.removeEventListener('touchstart', onTouchStart, true);
    scrollable.removeEventListener('wheel', onWheel, true);
  };

  ownership.dispose = () => {
    if (disposed) return;
    disposed = true;
    removeListeners();
  };

  scrollable.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  scrollable.addEventListener('wheel', onWheel, { passive: true, capture: true });
  ownershipByScrollable.set(scrollable, ownership);
}

export function applyJourneyReturnScrollIfOwned(
  scrollable: HTMLElement,
  apply: () => void,
): boolean {
  const ownership = ownershipByScrollable.get(scrollable);
  if (ownership?.userOwned) return false;
  apply();
  return true;
}

export function hasUserClaimedJourneyReturnScroll(scrollable: HTMLElement): boolean {
  return ownershipByScrollable.get(scrollable)?.userOwned === true;
}
