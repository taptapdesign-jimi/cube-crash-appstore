import {
  createJourneySpatialDirectionMap,
  createJourneySpatialOffset,
  getForestUnitSpatialDirection,
  getGameplayTileSpatialDirection,
  getJourneySpatialDepthScale,
  JOURNEY_SPATIAL_DEPTH,
  JOURNEY_SPATIAL_SENSOR_RANGE,
  JOURNEY_SPATIAL_STRENGTH,
  JOURNEY_SPATIAL_SURFACE_GAIN,
  journeySpatialMotion,
  mixJourneyHubTilt,
  normalizeJourneySpatialTilt,
} from '../journey-spatial-motion.js';

describe('Journey spatial motion', () => {
  afterEach(() => {
    journeySpatialMotion.deactivate();
    journeySpatialMotion.releaseActivations('test-cleanup');
    document.body.innerHTML = '';
    delete (window as Window & { _settings?: unknown })._settings;
  });

  it('keeps tiny hand jitter inside the dead zone', () => {
    expect(normalizeJourneySpatialTilt(20.3, -4.4, 20, -4)).toEqual({ x: 0, y: 0 });
  });

  it('clamps larger tilt and preserves both movement axes', () => {
    const tilt = normalizeJourneySpatialTilt(44, 28, 20, -4);
    expect(tilt.x).toBe(1);
    expect(tilt.y).toBe(1);
  });

  it('handles angle wraparound without jumping across the full circle', () => {
    const tilt = normalizeJourneySpatialTilt(-178, 2, 178, 2);
    expect(tilt.x).toBe(0);
    expect(Math.abs(tilt.y)).toBeLessThan(0.5);
  });

  it('moves foreground and background layers in opposite directions', () => {
    const tilt = { x: 0.5, y: -0.25 };
    const foreground = createJourneySpatialOffset(tilt, 4, 3);
    const background = createJourneySpatialOffset(tilt, -8, -5);
    expect(foreground.x).toBeCloseTo(1.2);
    expect(foreground.y).toBeCloseTo(-0.45);
    expect(background.x).toBeCloseTo(-2.4);
    expect(background.y).toBeCloseTo(0.75);
  });

  it('applies one 40-percent reduction to every spatial offset', () => {
    expect(JOURNEY_SPATIAL_STRENGTH).toBe(0.6);
    expect(createJourneySpatialOffset({ x: 1, y: 1 }, 10, 10)).toEqual({ x: 6, y: 6 });
  });

  it('keeps equal upward and downward physical tilt equally strong', () => {
    const upward = normalizeJourneySpatialTilt(11, 5, 20, 5);
    const downward = normalizeJourneySpatialTilt(29, 5, 20, 5);
    expect(upward.y).toBe(-downward.y);
  });

  it('keeps every Journey world on the stronger shared depth profile', () => {
    expect(JOURNEY_SPATIAL_DEPTH.homepageHero).toEqual({ x: 14, y: 10 });
    expect(JOURNEY_SPATIAL_DEPTH.homepageCta).toEqual({ x: 6, y: 4.5 });
    expect(JOURNEY_SPATIAL_DEPTH.gameplayTile).toEqual({ x: 8.125, y: 12.2 });
    expect(JOURNEY_SPATIAL_DEPTH.gameplayHudPreload).toEqual({ x: 6.4, y: 5.6 });
    expect(JOURNEY_SPATIAL_DEPTH.hubWorld).toEqual({ x: 16.8, y: 16.8 });
    expect(JOURNEY_SPATIAL_DEPTH.hubCloud).toEqual({ x: -14.4, y: -14.4 });
    expect(JOURNEY_SPATIAL_DEPTH.worldMain).toEqual({ x: 17.6, y: 17.6 });
    expect(JOURNEY_SPATIAL_DEPTH.worldMainCloud).toEqual({ x: -16, y: -16 });
  });

  it('reduces only the Journey Hub by 30 percent while retaining visible vertical travel', () => {
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.journeyHub).toBe(0.7);
    expect(mixJourneyHubTilt({ x: 1, y: 0 })).toEqual({ x: 1, y: 0.34 });
    expect(mixJourneyHubTilt({ x: 0, y: 1 }).y).toBeCloseTo(0.86);
  });

  it('gives Forest Units stronger session-stable two-axis direction variety', () => {
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.forestUnit).toBe(1.35);
    const directions = Array.from({ length: 5 }, (_, index) => getForestUnitSpatialDirection(index + 1));
    expect(new Set(directions.map(({ x, y }) => `${x}:${y}`)).size).toBe(5);
    expect(getForestUnitSpatialDirection(1)).toEqual(getForestUnitSpatialDirection(6));
    expect(directions.some(({ x }) => x < 0)).toBe(true);
    expect(directions.some(({ y }) => y < 0)).toBe(true);
  });

  it('gives the physical pitch axis extra sensitivity for balanced vertical travel', () => {
    expect(JOURNEY_SPATIAL_SENSOR_RANGE.verticalDegrees).toBeLessThan(
      JOURNEY_SPATIAL_SENSOR_RANGE.horizontalDegrees,
    );
    const tilt = normalizeJourneySpatialTilt(29, 5, 20, 5);
    expect(tilt.y).toBe(1);
    expect(tilt.x).toBe(0);
  });

  it('assigns all three worlds distinct session-stable movement directions', () => {
    const directions = createJourneySpatialDirectionMap(0.1);
    const signatures = Object.values(directions).map(({ x, y }) => `${x}:${y}`);
    expect(new Set(signatures).size).toBe(3);
    expect(createJourneySpatialDirectionMap(0.1)).toEqual(directions);
  });

  it('rotates direction ownership for a different randomized session seed', () => {
    expect(createJourneySpatialDirectionMap(0.1)[1]).not.toEqual(
      createJourneySpatialDirectionMap(0.5)[1],
    );
  });

  it('gives neighboring clouds visibly different but bounded depth spacing', () => {
    const scales = Array.from({ length: 7 }, (_, index) => getJourneySpatialDepthScale(index));
    expect(new Set(scales).size).toBe(7);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.82);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1.19);
  });

  it('owns the active Homepage hero and CTA across all three sliders and cleans the previous slide', () => {
    document.body.innerHTML = `
      <div id="home">
        <div id="slider-container">
          <div class="slider-slide active" data-slide="0">
            <img class="hero-image" />
            <button class="slide-button">Play</button>
          </div>
          <div class="slider-slide" data-slide="1">
            <img class="hero-image" />
            <button class="slide-button">Journey</button>
          </div>
          <div class="slider-slide" data-slide="2">
            <img class="hero-image" />
            <button class="slide-button">Stats</button>
          </div>
        </div>
      </div>
    `;
    const container = document.getElementById('slider-container') as HTMLElement;
    const slides = Array.from(container.querySelectorAll<HTMLElement>('.slider-slide'));
    const firstHero = slides[0].querySelector<HTMLElement>('.hero-image');
    const firstCta = slides[0].querySelector<HTMLElement>('.slide-button');
    const secondHero = slides[1].querySelector<HTMLElement>('.hero-image');
    const secondCta = slides[1].querySelector<HTMLElement>('.slide-button');

    journeySpatialMotion.activateHomepage(container, 0);
    expect(firstHero?.dataset.journeySpatialTarget).toBe('homepage');
    expect(firstCta?.dataset.journeySpatialTarget).toBe('homepage');
    expect(secondHero?.dataset.journeySpatialTarget).toBeUndefined();
    expect(secondCta?.dataset.journeySpatialTarget).toBeUndefined();

    slides[0].classList.remove('active');
    slides[1].classList.add('active');
    journeySpatialMotion.activateHomepage(container, 1);
    expect(firstHero?.dataset.journeySpatialTarget).toBeUndefined();
    expect(firstCta?.dataset.journeySpatialTarget).toBeUndefined();
    expect(secondHero?.dataset.journeySpatialTarget).toBe('homepage');
    expect(secondCta?.dataset.journeySpatialTarget).toBe('homepage');

    slides[1].classList.remove('active');
    slides[2].classList.add('active');
    journeySpatialMotion.activateHomepage(container, 2);
    expect(secondHero?.dataset.journeySpatialTarget).toBeUndefined();
    expect(secondCta?.dataset.journeySpatialTarget).toBeUndefined();
    expect(slides[2].querySelector<HTMLElement>('.hero-image')?.dataset.journeySpatialTarget).toBe('homepage');
    expect(slides[2].querySelector<HTMLElement>('.slide-button')?.dataset.journeySpatialTarget).toBe('homepage');
  });

  it('coalesces Homepage activation during Settings handoff and starts only the latest slide after release', () => {
    document.body.innerHTML = `
      <div id="home">
        <div id="slider-container">
          <div class="slider-slide active" data-slide="0">
            <img class="hero-image" />
            <button class="slide-button">Play</button>
          </div>
          <div class="slider-slide" data-slide="1">
            <img class="hero-image" />
            <button class="slide-button">Journey</button>
          </div>
        </div>
      </div>
    `;
    const container = document.getElementById('slider-container') as HTMLElement;
    const slides = Array.from(container.querySelectorAll<HTMLElement>('.slider-slide'));

    journeySpatialMotion.holdActivations('settings-enter');
    journeySpatialMotion.activateHomepage(container, 0);
    slides[0].classList.remove('active');
    slides[1].classList.add('active');
    journeySpatialMotion.activateHomepage(container, 1);

    expect(container.querySelector('[data-journey-spatial-target]')).toBeNull();

    journeySpatialMotion.releaseActivations('settings-exit-homepage-complete');

    expect(slides[0].querySelector<HTMLElement>('.hero-image')?.dataset.journeySpatialTarget)
      .toBeUndefined();
    expect(slides[1].querySelector<HTMLElement>('.hero-image')?.dataset.journeySpatialTarget)
      .toBe('homepage');
    expect(slides[1].querySelector<HTMLElement>('.slide-button')?.dataset.journeySpatialTarget)
      .toBe('homepage');
  });

  it('discards a cancelled Homepage handoff without activating its pending surface', () => {
    document.body.innerHTML = `
      <div id="home">
        <div id="slider-container">
          <div class="slider-slide active" data-slide="1">
            <img class="hero-image" />
            <button class="slide-button">Journey</button>
          </div>
        </div>
      </div>
    `;
    const container = document.getElementById('slider-container') as HTMLElement;

    journeySpatialMotion.holdActivations('homepage-enter');
    journeySpatialMotion.activateHomepage(container, 1);
    journeySpatialMotion.discardHeldActivations('homepage-to-journey');

    expect(container.querySelector('[data-journey-spatial-target]')).toBeNull();
  });

  it('reuses identical Journey Hub targets without resetting their live gyro offset', () => {
    document.body.innerHTML = `
      <div id="journey-boards-container">
        <article class="journey-v700-world-card" data-world-id="1">
          <img class="journey-v700-world-image" />
        </article>
        <article class="journey-v700-world-card" data-world-id="2">
          <img class="journey-v700-world-image" />
        </article>
        <div class="journey-v700-hub-cloud" data-world-id="1"></div>
      </div>
    `;
    const container = document.getElementById('journey-boards-container') as HTMLElement;
    const firstWorld = container.querySelector<HTMLElement>('.journey-v700-world-image')!;

    journeySpatialMotion.activateJourneyHub(container);
    firstWorld.style.setProperty('translate', '4px -3px');
    journeySpatialMotion.activateJourneyHub(container);

    expect(firstWorld.style.translate).toBe('4px -3px');
    expect(container.querySelectorAll('[data-journey-spatial-target="journey-hub"]')).toHaveLength(3);
  });

  it('moves gameplay cube faces through their independent spatial wrappers and restores them on cleanup', () => {
    const wrapper = {
      x: 0,
      y: 0,
      position: {
        x: 0,
        y: 0,
        set(x: number, y: number) {
          this.x = x;
          this.y = y;
          wrapper.x = x;
          wrapper.y = y;
        },
      },
    };
    const tile = {
      visible: true,
      alpha: 1,
      value: 4,
      gridX: 2,
      gridY: 3,
      _ccSpatialG: wrapper,
    };
    const hudWrapper = {
      x: 0,
      y: 0,
      position: {
        x: 0,
        y: 0,
        set(x: number, y: number) {
          this.x = x;
          this.y = y;
          hudWrapper.x = x;
          hudWrapper.y = y;
        },
      },
    };

    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: class DeviceOrientationEventWithoutPermission {},
    });
    let pendingFrame: FrameRequestCallback | null = null;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pendingFrame = callback;
      return 1;
    });

    journeySpatialMotion.activateGameplay(() => [tile], () => hudWrapper);
    const emitOrientation = (beta: number, gamma: number) => {
      const event = new Event('deviceorientation') as DeviceOrientationEvent;
      Object.defineProperties(event, {
        beta: { value: beta },
        gamma: { value: gamma },
      });
      window.dispatchEvent(event);
    };
    emitOrientation(20, 0);
    emitOrientation(29, 14);
    pendingFrame?.(16);

    expect(Math.abs(wrapper.x)).toBeGreaterThan(0);
    expect(Math.abs(wrapper.y)).toBeGreaterThan(0);
    expect(Math.abs(hudWrapper.x)).toBeGreaterThan(0);
    expect(Math.abs(hudWrapper.y)).toBeGreaterThan(0);
    expect(Math.abs((wrapper.x * 2) % 1)).toBe(0);
    expect(Math.abs((wrapper.y * 2) % 1)).toBe(0);

    tile.value = 0;
    pendingFrame?.(32);
    expect(wrapper.x).toBe(0);
    expect(wrapper.y).toBe(0);

    journeySpatialMotion.deactivateGameplay();
    expect(wrapper.x).toBe(0);
    expect(wrapper.y).toBe(0);
    expect(hudWrapper.x).toBe(0);
    expect(hudWrapper.y).toBe(0);
  });

  it('halves both gameplay movement axes while preserving the 1.5x vertical balance', () => {
    expect(JOURNEY_SPATIAL_DEPTH.gameplayTile.x).toBe(8.125);
    expect(JOURNEY_SPATIAL_DEPTH.gameplayTile.y).toBe(12.2);
    expect(JOURNEY_SPATIAL_DEPTH.gameplayTile.y).toBeCloseTo(JOURNEY_SPATIAL_DEPTH.gameplayTile.x * 1.5, 1);
  });

  it('assigns session-stable inverted directions across gameplay cells', () => {
    const directions = Array.from({ length: 6 }, (_, index) => getGameplayTileSpatialDirection(index, 2));
    expect(getGameplayTileSpatialDirection(3, 2)).toEqual(getGameplayTileSpatialDirection(3, 2));
    expect(new Set(directions.map(({ x, y }) => `${x}:${y}`)).size).toBe(6);
    expect(directions.some(({ x }) => x < 0)).toBe(true);
    expect(directions.some(({ y }) => y < 0)).toBe(true);
  });

  it('does not attach spatial targets while the saved 3D Motion setting is off', () => {
    (window as Window & { _settings?: { spatialMotionEnabled: boolean } })._settings = {
      spatialMotionEnabled: false,
    };
    document.body.innerHTML = `
      <div id="slider-container">
        <div class="slider-slide active" data-slide="0">
          <img class="hero-image" />
          <button class="slide-button">Play</button>
        </div>
      </div>
    `;
    const container = document.getElementById('slider-container') as HTMLElement;

    journeySpatialMotion.activateHomepage(container, 0);

    expect(journeySpatialMotion.isEnabled()).toBe(false);
    expect(container.querySelector<HTMLElement>('.hero-image')?.dataset.journeySpatialTarget).toBeUndefined();
    expect(container.querySelector<HTMLElement>('.slide-button')?.dataset.journeySpatialTarget).toBeUndefined();
  });
});
