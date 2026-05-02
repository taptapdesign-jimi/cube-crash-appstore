// Shop module toggle.
// Set SHOP_MODULE_ENABLED to true to restore the shop slide and nav icon.
export const SHOP_MODULE_ENABLED = false;
export const SHOP_MODULE_SLIDE_INDEX = 2;

export function isShopModuleSlide(slideIndex: number): boolean {
  return slideIndex === SHOP_MODULE_SLIDE_INDEX;
}

export function isSlideVisible(slideIndex: number): boolean {
  return SHOP_MODULE_ENABLED || !isShopModuleSlide(slideIndex);
}
