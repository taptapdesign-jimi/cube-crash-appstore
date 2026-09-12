export const JOURNEY_SLIDE_INDEX = 0 as const;
export const ARCADE_SLIDE_INDEX = 1 as const;
export const SETTINGS_SLIDE_INDEX = 2 as const;
export const DEFAULT_HOMEPAGE_SLIDE_INDEX = JOURNEY_SLIDE_INDEX;
export const ACTIVE_HOMEPAGE_SLIDE_COUNT = 3 as const;

export type PrimaryHomepageSlideIndex =
  | typeof JOURNEY_SLIDE_INDEX
  | typeof ARCADE_SLIDE_INDEX;

export function isHomepageSlideVisible(slideIndex: number): boolean {
  return Number.isInteger(slideIndex)
    && slideIndex >= JOURNEY_SLIDE_INDEX
    && slideIndex < ACTIVE_HOMEPAGE_SLIDE_COUNT;
}
