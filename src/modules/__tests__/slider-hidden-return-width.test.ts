import { resolveHomepageSliderViewportWidth } from '../homepage-slider-layout';

describe('hidden Homepage slider return width', () => {
  it('uses viewport width when display none makes offsetWidth zero', () => {
    expect(resolveHomepageSliderViewportWidth(0, 390)).toBe(390);
  });

  it('keeps the measured container width when it is available', () => {
    expect(resolveHomepageSliderViewportWidth(428, 390)).toBe(428);
  });

  it('keeps a deterministic iPhone-width fallback when both measurements are unavailable', () => {
    expect(resolveHomepageSliderViewportWidth(0, 0)).toBe(390);
  });
});
