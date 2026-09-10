export const JOURNEY_SLIDE_INDEX = 0 as const;
export const ARCADE_SLIDE_INDEX = 1 as const;
export const DEFAULT_HOMEPAGE_SLIDE_INDEX = JOURNEY_SLIDE_INDEX;

export type PrimaryHomepageSlideIndex =
  | typeof JOURNEY_SLIDE_INDEX
  | typeof ARCADE_SLIDE_INDEX;
