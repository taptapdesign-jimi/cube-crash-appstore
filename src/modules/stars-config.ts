// src/modules/stars-config.ts (PATCHED)

export const USE_STARS_MODAL: boolean = true;

export interface StarThresholds {
  one: number;
  two: number;
  three: number;
}

export const STAR_THRESHOLDS: StarThresholds = { one: 200, two: 300, three: 360 };

export const NEXT_LEVEL_DELAY_MS: number = 900;

