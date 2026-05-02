// Shop module toggle.
// Set SHOP_MODULE_ENABLED to true to restore the shop slide and nav icon.
export const SHOP_MODULE_ENABLED = false;
export const SHOP_MODULE_SLIDE_INDEX = 2;
export const SETTINGS_SLIDE_INDEX = SHOP_MODULE_ENABLED ? 3 : 2;
export const ACTIVE_SLIDER_TOTAL_SLIDES = SHOP_MODULE_ENABLED ? 4 : 3;

export function isShopModuleSlide(slideIndex: number): boolean {
  return slideIndex === SHOP_MODULE_SLIDE_INDEX;
}

export function isSlideVisible(slideIndex: number): boolean {
  return slideIndex >= 0 && slideIndex < ACTIVE_SLIDER_TOTAL_SLIDES;
}
