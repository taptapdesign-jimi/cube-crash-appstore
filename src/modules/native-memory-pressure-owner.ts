type NativeMemoryPressureOwner = () => void;

const owners = new Set<NativeMemoryPressureOwner>();

/** Register a cache/resource owner that can safely shed only idle memory. */
export function registerNativeMemoryPressureOwner(owner: NativeMemoryPressureOwner): () => void {
  owners.add(owner);
  return () => owners.delete(owner);
}

/** Notify registered owners without allowing one cleanup failure to block another. */
export function notifyNativeMemoryPressureOwners(): void {
  owners.forEach((owner) => {
    try { owner(); } catch {}
  });
}

export function resetNativeMemoryPressureOwnersForTests(): void {
  owners.clear();
}
