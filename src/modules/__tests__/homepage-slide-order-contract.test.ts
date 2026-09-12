import fs from 'node:fs';
import path from 'node:path';

import { HTMLBuilder } from '../../ui/components/html-builder';
import { createHomeSlide } from '../../ui/components/home-slide';
import { createNavigation } from '../../ui/components/navigation';
import { createStatsSlide } from '../../ui/components/stats-slide';
import {
  ARCADE_SLIDE_INDEX,
  ACTIVE_HOMEPAGE_SLIDE_COUNT,
  DEFAULT_HOMEPAGE_SLIDE_INDEX,
  JOURNEY_SLIDE_INDEX,
  SETTINGS_SLIDE_INDEX,
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

  test('contains only the three live Homepage destinations and no legacy Shop slide', () => {
    expect(ACTIVE_HOMEPAGE_SLIDE_COUNT).toBe(3);
    expect(SETTINGS_SLIDE_INDEX).toBe(2);

    const navigation = HTMLBuilder.createElement(createNavigation());
    expect(Array.from(navigation.querySelectorAll('.independent-nav-button')).map((button) => (
      button.getAttribute('aria-label')
    ))).toEqual(['Journey', 'Arcade', 'Settings']);

    const bootstrapSource = read('src/ui/bootstrap-ui.ts');
    const navigationSource = read('src/ui/components/navigation.ts');
    const imagePreloaderSource = read('src/utils/comprehensive-image-preloader.ts');
    expect(bootstrapSource).not.toContain('renderCollectiblesSlide');
    expect(navigationSource).not.toContain('collectibles-nav.png');
    expect(imagePreloaderSource).not.toContain('collectibles-box');
    expect(imagePreloaderSource).not.toContain('collectibles-nav.png');
  });

  test('keeps the active Journey screen despite its historical collectibles filenames', () => {
    const journeyScreenSource = read('src/ui/components/collectibles-screen.ts');
    expect(journeyScreenSource).toContain("id: 'journey-screen'");
    expect(journeyScreenSource).toContain("text: 'Journey'");
  });

  test('keeps the Journey card New ribbon independent from the removed navigation badge', () => {
    const journeyManagerSource = read('src/modules/journey-boards-manager.ts');
    const journeyCss = read('src/collectibles-screen.css');

    expect(journeyManagerSource).toContain("localStorage.getItem('journey_viewed_boards')");
    expect(journeyManagerSource).toContain("ribbon.className = 'journey-card-ribbon'");
    expect(journeyManagerSource).toContain("ribbonLabel.textContent = 'New'");
    expect(journeyManagerSource).toContain("localStorage.setItem('journey_viewed_boards', JSON.stringify(viewedBoards))");
    expect(journeyCss).toContain('.journey-card-ribbon');
    expect(journeyCss).toContain('@keyframes journey-card-ribbon-shimmer');
    expect(journeyManagerSource).not.toContain('updateNavBadge');
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
