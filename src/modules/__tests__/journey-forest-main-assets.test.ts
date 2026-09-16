import { existsSync } from 'node:fs';
import {
  JOURNEY_FOREST_MAIN_ASSET,
  JOURNEY_FOREST_MAIN_ASSET_2X,
} from '../journey-forest-main-assets';

describe('Forest World main artwork', () => {
  test('uses the supplied 1Forest main image and its retina version', () => {
    expect(JOURNEY_FOREST_MAIN_ASSET).toBe('./assets/journey assets/forest/forest world/1Forest main.png');
    expect(JOURNEY_FOREST_MAIN_ASSET_2X).toBe('./assets/journey assets/forest/forest world/1Forest main@2x.png');
    expect(existsSync(JOURNEY_FOREST_MAIN_ASSET.replace(/^\.\//, ''))).toBe(true);
    expect(existsSync(JOURNEY_FOREST_MAIN_ASSET_2X.replace(/^\.\//, ''))).toBe(true);
  });
});
