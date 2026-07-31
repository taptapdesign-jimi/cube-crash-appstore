/**
 * Resolve the physical width used to position the Homepage slider while its
 * screen is hidden. A hidden container reports offsetWidth=0 on iOS/WebKit,
 * but the slider contract is still one viewport wide per slide.
 */
export function resolveHomepageSliderViewportWidth(
  measuredWidth: number,
  viewportWidth: number,
): number {
  if (Number.isFinite(measuredWidth) && measuredWidth > 0) return measuredWidth;
  if (Number.isFinite(viewportWidth) && viewportWidth > 0) return viewportWidth;
  return 390;
}
