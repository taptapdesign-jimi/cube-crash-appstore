import fs from 'node:fs';
import path from 'node:path';

import { HTMLBuilder } from '../../ui/components/html-builder';
import { createHomeSlide } from '../../ui/components/home-slide';
import { createNavigation } from '../../ui/components/navigation';
import { createStatsSlide } from '../../ui/components/stats-slide';
import {
  ARCADE_SLIDE_INDEX,
  DEFAULT_HOMEPAGE_SLIDE_INDEX,
  JOURNEY_SLIDE_INDEX,
} from '../homepage-slide-order';
import { appZoneManager } from '../app-zone-manager';

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

describe('Homepage Journey and Arcade slide order contract', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as any).__ccRunMode;
  });

  test('Journey is the default first slide and Arcade is second', () => {
    expect(JOURNEY_SLIDE_INDEX).toBe(0);
    expect(ARCADE_SLIDE_INDEX).toBe(1);
    expect(DEFAULT_HOMEPAGE_SLIDE_INDEX).toBe(JOURNEY_SLIDE_INDEX);

    const bootstrapSource = read('src/ui/bootstrap-ui.ts');
    expect(bootstrapSource.indexOf('renderStatsSlide(sliderWrapper, { slideIndex: JOURNEY_SLIDE_INDEX, isActive: true })'))
      .toBeLessThan(bootstrapSource.indexOf('renderHomeSlide(sliderWrapper, { slideIndex: ARCADE_SLIDE_INDEX })'));
  });

  test('the visible Play presentation is renamed Arcade without changing its CTA hook', () => {
    const arcade = HTMLBuilder.createElement(createHomeSlide({ slideIndex: ARCADE_SLIDE_INDEX }));
    const journey = HTMLBuilder.createElement(createStatsSlide({ slideIndex: JOURNEY_SLIDE_INDEX, isActive: true }));

    expect(arcade.classList).toContain('arcade-slide');
    expect(arcade.querySelector('#btn-home')?.textContent).toBe('Arcade');
    expect(arcade.querySelector('#btn-home')?.getAttribute('aria-label')).toBe('Arcade');
    expect(arcade.querySelector('[data-hero-cta="play"]')).not.toBeNull();
    expect(journey.classList).toContain('journey-slide');
    expect(journey.classList).toContain('active');
  });

  test('navigation presents Journey before Arcade and activates Journey by default', () => {
    const navigation = HTMLBuilder.createElement(createNavigation());
    const primaryButtons = Array.from(
      navigation.querySelectorAll<HTMLButtonElement>('.independent-nav-button'),
    ).slice(0, 2);

    expect(primaryButtons.map((button) => button.dataset.slide)).toEqual([
      String(JOURNEY_SLIDE_INDEX),
      String(ARCADE_SLIDE_INDEX),
    ]);
    expect(primaryButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Journey',
      'Arcade',
    ]);
    expect(primaryButtons[0].classList.contains('active')).toBe(true);
    expect(primaryButtons[1].classList.contains('active')).toBe(false);
  });

  test('Arcade exit routing explicitly returns to Arcade instead of the new default Journey slide', async () => {
    (window as any).__ccRunMode = 'arcade_home';
    const route = await appZoneManager.resolveGameExitRoute({ reason: 'homepage-order-contract' });

    expect(route.target).toBe('home');
    expect(route.targetSlide).toBe(ARCADE_SLIDE_INDEX);
    expect(route.targetSlide).not.toBe(DEFAULT_HOMEPAGE_SLIDE_INDEX);
  });

  test('art-specific layout and idle animation ownership follows semantic slide classes', () => {
    const sliderCss = read('src/slider-optimized.css');
    const baseCss = read('src/style.css');

    expect(sliderCss).toContain('.slider-slide.arcade-slide .hero-image');
    expect(sliderCss).toContain('.slider-slide.journey-slide .hero-image');
    expect(sliderCss).toContain('.slider-slide.arcade-slide .hero-shadow');
    expect(baseCss).toContain('.slider-slide.arcade-slide .hero-image');
    expect(baseCss).toContain('.slider-slide.journey-slide .hero-image');
  });
});
