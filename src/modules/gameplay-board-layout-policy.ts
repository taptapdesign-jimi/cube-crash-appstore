export type SettledMobileBoardResizeInput = Readonly<{
  isResizeEvent: boolean;
  isMobileDevice: boolean;
  isEntryPending: boolean;
  isSurfaceVisible: boolean;
}>;

/**
 * WKWebView can publish a late resize after the board has completed its
 * authored entry. A second full layout then visibly nudges every settled tile.
 * Explicit layout owners and entry-time resizes remain allowed.
 */
export function shouldIgnoreSettledMobileBoardResize({
  isResizeEvent,
  isMobileDevice,
  isEntryPending,
  isSurfaceVisible,
}: SettledMobileBoardResizeInput): boolean {
  return isResizeEvent && isMobileDevice && !isEntryPending && isSurfaceVisible;
}
