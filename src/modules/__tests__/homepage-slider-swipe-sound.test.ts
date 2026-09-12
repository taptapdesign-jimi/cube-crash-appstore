import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HOMEPAGE_SLIDER_SWIPE_SOUND_BASE_VOLUME, HOMEPAGE_SLIDER_SWIPE_SOUND_SOURCE, HOMEPAGE_SLIDER_SWIPE_SOUND_VOLUME } from '../homepage-slider-swipe-sound.ts';

describe('Homepage slider accepted-swipe sound', () => {
  test('uses the supplied super swoosh through the shared SFX master', () => {
    expect(HOMEPAGE_SLIDER_SWIPE_SOUND_SOURCE).toBe('./assets/sound/UI /sliders/super swoosh.mp3');
    expect(HOMEPAGE_SLIDER_SWIPE_SOUND_BASE_VOLUME).toBe(0.5);
    expect(HOMEPAGE_SLIDER_SWIPE_SOUND_VOLUME).toBe(0.3);
    const bytes = fs.readFileSync(path.resolve(process.cwd(), HOMEPAGE_SLIDER_SWIPE_SOUND_SOURCE.replace(/^\.\//, '')));
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(
      'cddbbe185a12ab7b5c6f1296408e1e53b6d129c3544e2e00d8c89fc9ad0c72aa',
    );
  });

  test('plays only after an accepted gesture has a real adjacent target', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/slider-manager.ts'), 'utf8');
    expect(source).toContain('if (target !== null) {\n        playHomepageSliderSwipeSound();\n        this.goToSlide(target);');
    expect(source).toContain('} else {\n        this.updateSlider();');
    expect(source).toContain('// Prime only; playback remains owned by an accepted touchend commit.');
    expect(source).toContain('// Prime only; playback remains owned by an accepted mouseup commit.');
  });
});
