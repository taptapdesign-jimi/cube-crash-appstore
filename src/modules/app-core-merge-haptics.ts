type MergeHapticsDeps = {
  wildActive: boolean;
  trackAppTimeout: (fn: () => void, ms: number) => any;
};

export function triggerMergeHaptics({ wildActive, trackAppTimeout }: MergeHapticsDeps){
  // Haptic feedback based on merge type
  if (typeof (window as any).triggerHapticImpact === 'function') {
    if (wildActive) {
      // Wild merge = Double HEAVY for longer feel
      (window as any).triggerHapticImpact('heavy');
      trackAppTimeout(() => {
        (window as any).triggerHapticImpact('heavy');
      }, 150);
    } else {
      // A successful merge must read above pickup/hover confirmation.
      (window as any).triggerHapticImpact('medium');
    }
  }
}
