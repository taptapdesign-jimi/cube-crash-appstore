import fs from 'node:fs';
import path from 'node:path';

import { isAnyMenuScreenVisible } from '../menu-exit-handoff';
import { isJourneyScreenPresentationReady } from '../journey-return-presentation';

jest.mock('../run-mode.js', () => ({
  RUN_MODE_JOURNEY: 'journey',
  setRunMode: jest.fn(),
}));

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

function setPaintedRect(element: HTMLElement, width = 100, height = 100): void {
  element.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  });
}

function explicitlyHide(element: HTMLElement): void {
  element.hidden = true;
  element.setAttribute('hidden', 'true');
  element.style.display = 'none';
  element.style.visibility = 'hidden';
  element.style.opacity = '0';
  element.style.pointerEvents = 'none';
  element.style.zIndex = '-1';
}

describe('Journey menu surface exclusivity', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main id="home" style="display:block;visibility:visible;opacity:1;pointer-events:auto;z-index:5">
        <section id="slider-container"
          style="display:block;visibility:visible;opacity:1;pointer-events:auto;z-index:2">
          <article class="slider-slide active" data-slide="1">
            <div class="hero-container"></div>
          </article>
        </section>
      </main>
      <section id="journey-screen"
        style="display:flex;visibility:visible;opacity:1;pointer-events:none;z-index:999999">
        <div id="journey-boards-container" data-journey-v700-view="world">
          <div class="journey-board-card-wrapper" data-journey-area-id="3">
            <button class="journey-board-card" data-board-id="21"></button>
          </div>
        </div>
      </section>`;

    setPaintedRect(document.getElementById('home') as HTMLElement, 390, 844);
    setPaintedRect(document.getElementById('slider-container') as HTMLElement, 390, 844);
    setPaintedRect(document.querySelector('.slider-slide') as HTMLElement, 390, 844);
    setPaintedRect(document.querySelector('.hero-container') as HTMLElement, 240, 260);
    setPaintedRect(document.getElementById('journey-screen') as HTMLElement, 390, 844);
    setPaintedRect(document.querySelector('.journey-board-card-wrapper') as HTMLElement, 240, 310);
    setPaintedRect(document.querySelector('.journey-board-card') as HTMLElement, 220, 290);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('rejects a painted Journey World until both Homepage surfaces are explicitly hidden', () => {
    const home = document.getElementById('home') as HTMLElement;
    const slider = document.getElementById('slider-container') as HTMLElement;

    const simultaneous = {
      journeyReady: isJourneyScreenPresentationReady(),
      anyMenuReady: isAnyMenuScreenVisible(),
    };

    explicitlyHide(home);
    const homeOnlyHidden = {
      journeyReady: isJourneyScreenPresentationReady(),
      anyMenuReady: isAnyMenuScreenVisible(),
    };

    explicitlyHide(slider);
    const journeyExclusive = {
      journeyReady: isJourneyScreenPresentationReady(),
      anyMenuReady: isAnyMenuScreenVisible(),
    };

    expect({ simultaneous, homeOnlyHidden, journeyExclusive }).toEqual({
      simultaneous: { journeyReady: false, anyMenuReady: false },
      homeOnlyHidden: { journeyReady: false, anyMenuReady: false },
      journeyExclusive: { journeyReady: true, anyMenuReady: true },
    });
  });

  test('non-home main handoff never publishes or reactivates Homepage presentation', () => {
    const source = read('src/main.ts');
    const handoffStart = source.indexOf('// Homepage state is published by playHomepageSliderEnterHandoff');
    const handoffEnd = source.indexOf('// 🔥 APP STORE FIX: Complete separation of Journey and Homepage pathways', handoffStart);

    expect(handoffStart).toBeGreaterThanOrEqual(0);
    expect(handoffEnd).toBeGreaterThan(handoffStart);

    const nonHomeHandoff = source.slice(handoffStart, handoffEnd);
    expect(nonHomeHandoff).not.toContain('homepageReady: true');
    expect(nonHomeHandoff).not.toContain('sliderManager.setSlideInstant(');
    expect(nonHomeHandoff).not.toContain("style.display = 'block'");
    expect(nonHomeHandoff).not.toContain("style.visibility = 'visible'");
    expect(nonHomeHandoff).not.toContain("style.opacity = '1'");
  });

  test('both Homepage state subscribers require active Home app-zone ownership', () => {
    const source = read('src/modules/ui-manager.ts');
    const homepageReadyStart = source.indexOf('const unsubscribeHomepageReady =');
    const gameActiveStart = source.indexOf('const unsubscribeGameActive =', homepageReadyStart);
    const subscriptionsEnd = source.indexOf('// 🔥 REMOVED: Slider locked state subscription', gameActiveStart);

    expect(homepageReadyStart).toBeGreaterThanOrEqual(0);
    expect(gameActiveStart).toBeGreaterThan(homepageReadyStart);
    expect(subscriptionsEnd).toBeGreaterThan(gameActiveStart);

    const homepageReadySubscriber = source.slice(homepageReadyStart, gameActiveStart);
    const gameActiveSubscriber = source.slice(gameActiveStart, subscriptionsEnd);
    const homeZoneGuard = /appZoneManager\.getCurrentZone\(\)[\s\S]*(?:===|!==)\s*['"]home['"]/;

    expect(homepageReadySubscriber).toMatch(homeZoneGuard);
    expect(gameActiveSubscriber).toMatch(homeZoneGuard);
  });
});
