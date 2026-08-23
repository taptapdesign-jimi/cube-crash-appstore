import {
  AppSpatialMotionController,
  applyJourneySceneTiltResponse,
  createJourneySpatialDirectionMap,
  createJourneyHubWorldTilt,
  createJourneySpatialOffset,
  getForestUnitSpatialDirection,
  getGameplayTileSpatialDirection,
  getJourneyCloudDepthScale,
  getJourneyHubCloudDirection,
  getJourneySpatialDepthScale,
  getJourneyUnitSpatialDirection,
  JOURNEY_SCENE_MOVEMENT_MASTER,
  JOURNEY_SPATIAL_DEPTH,
  JOURNEY_SPATIAL_SENSOR_RANGE,
  JOURNEY_SPATIAL_STRENGTH,
  JOURNEY_SPATIAL_SURFACE_GAIN,
  journeySpatialMotion,
  mixJourneyHubTilt,
  normalizeJourneySpatialTilt,
  quantizeJourneyWorldTilt,
  type JourneySpatialTilt,
} from '../journey-spatial-motion.js';
import { resolveMobileRuntimeProfile } from '../mobile-runtime-profile.js';

describe('Journey spatial motion', () => {
  afterEach(() => {
    journeySpatialMotion.deactivate();
    journeySpatialMotion.releaseActivations('test-cleanup');
    document.body.innerHTML = '';
    delete (window as Window & { _settings?: unknown })._settings;
  });

  it('keeps tiny hand jitter inside the dead zone', () => {
    expect(normalizeJourneySpatialTilt(20.2, -4.3, 20, -4)).toEqual({ x: 0, y: 0 });
  });

  it('caps mobile spatial paint at 30fps while desktop keeps display cadence', () => {
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: class DeviceOrientationEventWithoutPermission {},
    });
    document.body.innerHTML = `
      <section id="journey-world">
        <img class="journey-forest-main-art" data-journey-area-id="forest-main" />
      </section>
    `;
    const world = document.getElementById('journey-world') as HTMLElement;
    const art = world.querySelector<HTMLElement>('.journey-forest-main-art') as HTMLElement;
    const queuedFrames: FrameRequestCallback[] = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
    const controller = new AppSpatialMotionController(resolveMobileRuntimeProfile({
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    }));
    const emitOrientation = (beta: number, gamma: number) => {
      const event = new Event('deviceorientation') as DeviceOrientationEvent;
      Object.defineProperties(event, {
        beta: { value: beta },
        gamma: { value: gamma },
      });
      window.dispatchEvent(event);
    };

    controller.activateJourneyWorld(world, 1);
    emitOrientation(20, 0);
    emitOrientation(29, 14);
    queuedFrames.shift()?.(0);
    const firstPaint = art.style.translate;
    queuedFrames.shift()?.(16);
    expect(art.style.translate).toBe(firstPaint);
    queuedFrames.shift()?.(34);
    expect(art.style.translate).not.toBe(firstPaint);

    controller.deactivate();
  });

  it('does not rewrite an identical Journey spatial inline value', () => {
    document.body.innerHTML = `
      <section id="journey-world">
        <img class="journey-forest-main-art" data-journey-area-id="forest-main" />
      </section>
    `;
    const world = document.getElementById('journey-world') as HTMLElement;
    const art = world.querySelector<HTMLElement>('.journey-forest-main-art') as HTMLElement;
    const controller = new AppSpatialMotionController(resolveMobileRuntimeProfile({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    }));
    const setProperty = jest.spyOn(art.style, 'setProperty');

    controller.activateJourneyWorld(world, 1);
    (controller as unknown as { currentTilt: JourneySpatialTilt }).currentTilt = { x: 0.4, y: -0.2 };
    (controller as unknown as { applyCurrentTilt(): void }).applyCurrentTilt();
    const writesAfterFirstPaint = setProperty.mock.calls.length;
    (controller as unknown as { applyCurrentTilt(): void }).applyCurrentTilt();

    expect(writesAfterFirstPaint).toBeGreaterThan(0);
    expect(setProperty.mock.calls).toHaveLength(writesAfterFirstPaint);
    controller.deactivate();
  });

  it('coalesces subpixel Journey World sensor noise without reducing frame cadence', () => {
    expect(quantizeJourneyWorldTilt({ x: 0.101, y: -0.203 }))
      .toEqual({ x: 0.104, y: -0.2 });
    expect(quantizeJourneyWorldTilt({ x: 0.103, y: -0.201 }))
      .toEqual({ x: 0.104, y: -0.2 });
    expect(quantizeJourneyWorldTilt({ x: 1, y: -1 })).toEqual({ x: 1, y: -1 });
  });

  it('amplifies relaxed Journey movement without increasing maximum travel', () => {
    const shaped = applyJourneySceneTiltResponse({ x: 0.1, y: -0.25 });
    expect(shaped.x).toBeGreaterThan(0.17);
    expect(shaped.y).toBeLessThan(-0.4);
    expect(applyJourneySceneTiltResponse({ x: 1, y: -1 })).toEqual({ x: 1, y: -1 });
    expect(applyJourneySceneTiltResponse({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
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
    expect(JOURNEY_SPATIAL_DEPTH.homepageHero).toEqual({ x: 26, y: 20 });
    expect(JOURNEY_SPATIAL_DEPTH.homepageCta).toEqual({ x: 12, y: 9 });
    expect(JOURNEY_SPATIAL_DEPTH.gameplayTile).toEqual({ x: 14.625, y: 21.96 });
    expect(JOURNEY_SPATIAL_DEPTH.gameplayHudPreload).toEqual({ x: 7.2, y: 6.3 });
    expect(JOURNEY_SPATIAL_DEPTH.hubWorld).toEqual({ x: 16.8, y: 16.8 });
    expect(JOURNEY_SPATIAL_DEPTH.hubCloud).toEqual({ x: -14.4, y: -14.4 });
    expect(JOURNEY_SPATIAL_DEPTH.worldMain).toEqual({ x: 17.6, y: 17.6 });
    expect(JOURNEY_SPATIAL_DEPTH.worldMainCloud).toEqual({ x: -16, y: -16 });
  });

  it('makes the Journey Hub 60 percent stronger on X with extra vertical travel', () => {
    expect(JOURNEY_SCENE_MOVEMENT_MASTER).toBe(2.2);
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.journeyHub).toEqual({ x: 1.54, y: 1.925 });
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.journeyWorld).toEqual({ x: 1.804, y: 1.804 });
    expect(mixJourneyHubTilt({ x: 1, y: 0 })).toEqual({ x: 1, y: 0.34 });
    expect(mixJourneyHubTilt({ x: 0, y: 1 }).y).toBeCloseTo(0.86);
  });

  it('gives Forest Units stronger session-stable two-axis direction variety', () => {
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.journeyUnit).toBe(1.35);
    const directions = Array.from({ length: 5 }, (_, index) => getForestUnitSpatialDirection(index + 1));
    expect(new Set(directions.map(({ x, y }) => `${x}:${y}`)).size).toBe(5);
    expect(getForestUnitSpatialDirection(1)).toEqual(getForestUnitSpatialDirection(6));
    expect(directions.some(({ x }) => x < 0)).toBe(true);
    expect(directions.some(({ y }) => y < 0)).toBe(true);
  });

  it('uses the same stable randomized two-axis Unit principle in every Journey world', () => {
    ([1, 2, 3] as const).forEach((worldId) => {
      const startBoardId = ((worldId - 1) * 10) + 1;
      const directions = Array.from(
        { length: 5 },
        (_, index) => getJourneyUnitSpatialDirection(startBoardId + index, worldId),
      );
      expect(new Set(directions.map(({ x, y }) => `${x}:${y}`)).size).toBe(5);
      expect(directions.some(({ x }) => x < 0)).toBe(true);
      expect(directions.some(({ y }) => y < 0)).toBe(true);
    });
  });

  it('keeps Area 55 crater and beam on the same standard sibling target model', () => {
    document.body.innerHTML = `
      <section id="journey-area55-world">
        <img class="journey-robo-main-art" />
        <img class="journey-robo-crater-art journey-forest-stump-21" />
        <div class="journey-robo-alien-beam-art journey-forest-star-board-21"></div>
        <div class="journey-board-card-wrapper">
          <button class="journey-board-card" data-board-id="21"></button>
        </div>
      </section>
    `;
    const container = document.getElementById('journey-area55-world') as HTMLElement;
    const crater = container.querySelector<HTMLElement>('.journey-robo-crater-art') as HTMLElement;
    const beam = container.querySelector<HTMLElement>('.journey-robo-alien-beam-art') as HTMLElement;

    journeySpatialMotion.activateJourneyWorld(container, 3);

    expect(crater.dataset.journeySpatialTarget).toBe('journey-world');
    expect(beam.dataset.journeySpatialTarget).toBe('journey-world');
    expect(container.querySelectorAll('[data-journey-spatial-target="journey-world"]')).toHaveLength(4);
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

  it('separates cloud layers more strongly than regular organic layers', () => {
    const cloudScales = Array.from({ length: 7 }, (_, index) => getJourneyCloudDepthScale(index));
    expect(new Set(cloudScales).size).toBe(7);
    expect(Math.min(...cloudScales)).toBe(0.68);
    expect(Math.max(...cloudScales)).toBe(1.38);
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.hubCloudSeparation).toBe(1.3);
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.worldCloudSeparation).toBe(1.3);
  });

  it('gives every Hub cloud an independent session-stable direction', () => {
    const directions = Array.from({ length: 7 }, (_, index) => getJourneyHubCloudDirection(index, 3));
    expect(new Set(directions.map(({ x, y }) => `${x}:${y}`)).size).toBe(7);
    expect(directions.some(({ x }) => x < 0)).toBe(true);
    expect(directions.some(({ x }) => x > 0)).toBe(true);
    expect(directions.some(({ y }) => y < 0)).toBe(true);
    expect(directions.some(({ y }) => y > 0)).toBe(true);
    expect(getJourneyHubCloudDirection(2, 3)).toEqual(getJourneyHubCloudDirection(2, 3));
  });

  it('moves all three Hub Worlds independently while biasing each one toward centre', () => {
    const input = { x: 0.35, y: -0.42 };
    const forest = createJourneyHubWorldTilt(1, input);
    const beach = createJourneyHubWorldTilt(2, input);
    const robo = createJourneyHubWorldTilt(3, input);
    expect(forest.x).toBeGreaterThan(0);
    expect(beach.x).toBeLessThan(0);
    expect(robo.x).toBeGreaterThan(0);
    expect(new Set([forest, beach, robo].map(({ x, y }) => `${x}:${y}`)).size).toBe(3);
    expect(forest.y).not.toBeCloseTo(beach.y);
    expect(beach.y).not.toBeCloseTo(robo.y);
  });

  it('keeps the Hub centre response continuous and directional at tiny input', () => {
    const neutral = createJourneyHubWorldTilt(1, { x: 0, y: 0 });
    const tiny = createJourneyHubWorldTilt(1, { x: 0.01, y: -0.01 });
    expect(neutral).toEqual({ x: 0, y: 0 });
    expect(Math.abs(tiny.x)).toBeLessThan(0.02);
    expect(Math.abs(tiny.y)).toBeLessThan(0.02);
  });

  it('rotates Hub World paths per entry without changing each World inward side', () => {
    const input = { x: 0.42, y: 0.28 };
    const firstEntry = ([1, 2, 3] as const).map((worldId) => (
      createJourneyHubWorldTilt(worldId, input, 0)
    ));
    const nextEntry = ([1, 2, 3] as const).map((worldId) => (
      createJourneyHubWorldTilt(worldId, input, 1)
    ));
    expect(nextEntry).not.toEqual(firstEntry);
    expect(nextEntry[0].x).toBeGreaterThan(0);
    expect(nextEntry[1].x).toBeLessThan(0);
    expect(nextEntry[2].x).toBeGreaterThan(0);
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

  it('replaces Homepage slide targets without restarting the shared sensor listener', () => {
    (window as Window & { _settings?: { spatialMotionEnabled: boolean } })._settings = {
      spatialMotionEnabled: true,
    };
    class DeviceOrientationEventWithoutPermission {}
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: DeviceOrientationEventWithoutPermission,
    });
    document.body.innerHTML = `
      <div id="home"><div id="slider-container">
        <div class="slider-slide active" data-slide="0"><img class="hero-image" /><button class="slide-button"></button></div>
        <div class="slider-slide" data-slide="1"><img class="hero-image" /><button class="slide-button"></button></div>
      </div></div>`;
    const adds = jest.spyOn(window, 'addEventListener');
    const removes = jest.spyOn(window, 'removeEventListener');
    const controller = new AppSpatialMotionController();
    const container = document.getElementById('slider-container') as HTMLElement;

    controller.activateHomepage(container, 0);
    controller.activateHomepage(container, 1);

    expect(adds.mock.calls.filter(([type]) => type === 'deviceorientation')).toHaveLength(1);
    expect(removes.mock.calls.filter(([type]) => type === 'deviceorientation')).toHaveLength(0);
    expect(container.querySelector('.slider-slide[data-slide="0"] .hero-image')?.getAttribute('data-journey-spatial-target')).toBeNull();
    expect(container.querySelector('.slider-slide[data-slide="1"] .hero-image')?.getAttribute('data-journey-spatial-target')).toBe('homepage');

    controller.deactivate();
    adds.mockRestore();
    removes.mockRestore();
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
          <div class="journey-v700-world-visual"><img class="journey-v700-world-image" /></div>
        </article>
        <article class="journey-v700-world-card" data-world-id="2">
          <div class="journey-v700-world-visual"><img class="journey-v700-world-image" /></div>
        </article>
        <div class="journey-v700-hub-cloud" data-world-id="1"></div>
      </div>
    `;
    const container = document.getElementById('journey-boards-container') as HTMLElement;
    const firstWorld = container.querySelector<HTMLElement>('.journey-v700-world-visual')!;

    journeySpatialMotion.activateJourneyHub(container);
    firstWorld.style.setProperty('translate', '4px -3px');
    journeySpatialMotion.activateJourneyHub(container);

    expect(firstWorld.style.translate).toBe('4px -3px');
    expect(container.querySelectorAll('[data-journey-spatial-target="journey-hub"]')).toHaveLength(3);
  });

  it('resumes the existing Journey Hub owner after an aborted World open', () => {
    document.body.innerHTML = `
      <div id="journey-boards-container">
        <article class="journey-v700-world-card" data-world-id="1">
          <div class="journey-v700-world-visual"><img class="journey-v700-world-image" /></div>
        </article>
        <div class="journey-v700-hub-cloud" data-world-id="1"></div>
      </div>
    `;
    const container = document.getElementById('journey-boards-container') as HTMLElement;
    const controllerState = journeySpatialMotion as unknown as { suspended: boolean; activeSurface: string | null };

    journeySpatialMotion.activateJourneyHub(container);
    journeySpatialMotion.suspend();
    expect(controllerState.suspended).toBe(true);
    expect(controllerState.activeSurface).toBe('journey-hub');

    journeySpatialMotion.resumeJourneyHub(container);

    expect(controllerState.suspended).toBe(false);
    expect(controllerState.activeSurface).toBe('journey-hub');
    expect(container.querySelectorAll('[data-journey-spatial-target="journey-hub"]')).toHaveLength(2);
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
    const journeyDecor = document.createElement('img');
    journeyDecor.id = 'journey-game-bottom-decor';
    document.body.appendChild(journeyDecor);

    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: class DeviceOrientationEventWithoutPermission {},
    });
    let pendingFrame: FrameRequestCallback | null = null;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pendingFrame = callback;
      return 1;
    });

    journeySpatialMotion.activateGameplay(() => [tile], () => hudWrapper, () => journeyDecor);
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
    expect(journeyDecor.style.translate).not.toBe('');
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
    expect(journeyDecor.style.translate).toBe('');
  });

  it('keeps stronger cubes while giving the isolated preload fill subtle extra depth', () => {
    expect(JOURNEY_SPATIAL_DEPTH.gameplayTile.x).toBe(14.625);
    expect(JOURNEY_SPATIAL_DEPTH.gameplayTile.y).toBe(21.96);
    expect(JOURNEY_SPATIAL_DEPTH.gameplayHudPreload).toEqual({ x: 7.2, y: 6.3 });
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.gameplayJourneyBottomDecor).toEqual({ x: 0.6, y: 0.2 });
    expect(JOURNEY_SPATIAL_DEPTH.gameplayTile.y).toBeCloseTo(JOURNEY_SPATIAL_DEPTH.gameplayTile.x * 1.5, 1);
  });

  it('composes opposing Journey modal/card gyro targets on the shared listener and cleans both', () => {
    document.body.innerHTML = `
      <section id="modal-stage">
        <div id="card-gyro"></div>
        <div id="paper-gyro"></div>
      </section>
    `;
    const stage = document.getElementById('modal-stage') as HTMLElement;
    const card = document.getElementById('card-gyro') as HTMLElement;
    const paper = document.getElementById('paper-gyro') as HTMLElement;
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: class DeviceOrientationEventWithoutPermission {},
    });
    let pendingFrame: FrameRequestCallback | null = null;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pendingFrame = callback;
      return 1;
    });

    const dispose = journeySpatialMotion.registerModalTargets(stage, [
      { element: card, xDepth: 9, yDepth: 7, rotateXDegrees: 4, rotateYDegrees: 5, zDepth: 10 },
      { element: paper, xDepth: -7, yDepth: -5, rotateXDegrees: -3, rotateYDegrees: -4, zDepth: 6 },
    ]);
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

    expect(card.classList).toContain('cc-modal-spatial-target');
    expect(paper.classList).toContain('cc-modal-spatial-target');
    expect(parseFloat(card.style.translate)).toBeGreaterThan(0);
    expect(parseFloat(paper.style.translate)).toBeLessThan(0);
    expect(parseFloat(card.style.translate.split(' ')[1])).not.toBe(0);
    expect(parseFloat(paper.style.translate.split(' ')[1])).not.toBe(0);
    expect(card.style.getPropertyValue('--cc-modal-gyro-rx')).not.toBe('0.00deg');
    expect(paper.style.getPropertyValue('--cc-modal-gyro-rx')).not.toBe('0.00deg');
    expect(card.style.getPropertyValue('--cc-modal-gyro-ry')).toMatch(/^[^-]/);
    expect(paper.style.getPropertyValue('--cc-modal-gyro-ry')).toMatch(/^-/);

    dispose();
    expect(card.style.translate).toBe('');
    expect(paper.style.translate).toBe('');
    expect(card.classList).not.toContain('cc-modal-spatial-target');
    expect(paper.classList).not.toContain('cc-modal-spatial-target');
    expect(card.style.getPropertyValue('--cc-modal-gyro-rx')).toBe('');
    expect(paper.style.getPropertyValue('--cc-modal-gyro-ry')).toBe('');
  });

  it('keeps Journey World and modal gyro continuous on one shared stream', () => {
    document.body.innerHTML = `
      <section id="journey-world">
        <img class="journey-forest-main-art" data-journey-area-id="forest-main" />
        <div class="journey-forest-island-1"></div>
        <section id="modal-stage">
          <div id="modal-card"></div>
          <div id="modal-paper"></div>
        </section>
      </section>
    `;
    const world = document.getElementById('journey-world') as HTMLElement;
    const island = world.querySelector<HTMLElement>('.journey-forest-island-1') as HTMLElement;
    const stage = document.getElementById('modal-stage') as HTMLElement;
    const card = document.getElementById('modal-card') as HTMLElement;
    const paper = document.getElementById('modal-paper') as HTMLElement;
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: class DeviceOrientationEventWithoutPermission {},
    });
    let pendingFrame: FrameRequestCallback | null = null;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pendingFrame = callback;
      return 1;
    });

    journeySpatialMotion.activateJourneyWorld(world, 1);
    island.style.translate = '3px 4px';
    const dispose = journeySpatialMotion.registerModalTargets(stage, [
      { element: card, xDepth: 9, yDepth: 7 },
      { element: paper, xDepth: -7, yDepth: -5 },
    ]);
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

    expect(island.style.translate).not.toBe('3px 4px');
    expect(card.style.translate).not.toBe('');
    expect(paper.style.translate).not.toBe('');
    const worldPoseBeforeModalDispose = island.style.translate;

    dispose();
    expect(island.style.translate).toBe(worldPoseBeforeModalDispose);
    expect(card.style.translate).toBe('');
    expect(paper.style.translate).toBe('');
    expect(island.dataset.journeySpatialTarget).toBe('journey-world');

    emitOrientation(29, 14);
    emitOrientation(11, -14);
    pendingFrame?.(32);
    expect(island.style.translate).not.toBe(worldPoseBeforeModalDispose);
  });

  it('keeps the Journey detail modal at only 20 percent of its former gyro travel', () => {
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.journeyDetailCard).toBe(0.23);
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.journeyDetailStat).toBe(0.2);
  });

  it('moves the Journey detail card and each stat in stable cube-like directions and cleans them', () => {
    document.body.innerHTML = `
      <section id="collectibles-detail-modal" data-journey-board-id="4">
        <div id="detail-card-image"></div>
        <div class="detail-stats-list">
          <div class="detail-stat-item"></div>
          <div class="detail-stat-divider"></div>
          <div class="detail-stat-item"></div>
          <div class="detail-stat-divider"></div>
          <div class="detail-stat-item"></div>
        </div>
      </section>
    `;
    const modal = document.getElementById('collectibles-detail-modal') as HTMLElement;
    const card = modal.querySelector<HTMLElement>('#detail-card-image') as HTMLElement;
    const stats = Array.from(modal.querySelectorAll<HTMLElement>('.detail-stat-item'));

    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: class DeviceOrientationEventWithoutPermission {},
    });
    let pendingFrame: FrameRequestCallback | null = null;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pendingFrame = callback;
      return 1;
    });

    journeySpatialMotion.activateJourneyDetailModal(modal, 4);
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

    expect(card.dataset.journeySpatialTarget).toBe('journey-detail-modal');
    expect(stats.every((element) => element.dataset.journeySpatialTarget === 'journey-detail-modal')).toBe(true);
    expect(card.style.translate).not.toBe('');
    expect(stats.every((element) => element.style.translate !== '')).toBe(true);
    expect(new Set(stats.map((element) => element.style.translate)).size).toBeGreaterThan(1);

    journeySpatialMotion.deactivateJourneyDetailModal();
    expect(card.style.translate).toBe('');
    expect(stats.every((element) => element.style.translate === '')).toBe(true);
    expect(stats.every((element) => element.dataset.journeySpatialTarget === undefined)).toBe(true);
  });

  it('owns every Journey board-transition depth layer and keeps hills at 30 percent', () => {
    document.body.innerHTML = `
      <section id="cc-board-transition-overlay">
        <span class="cc-board-transition-digit"></span>
        <span class="cc-board-transition-digit"></span>
        <img data-scene-layer="mountain" />
        <img data-scene-layer="hill1" />
        <img data-scene-layer="hill2" />
        <img data-scene-layer="pine1" />
        <img class="cc-board-transition-cloud" />
      </section>
    `;
    const overlay = document.getElementById('cc-board-transition-overlay') as HTMLElement;

    journeySpatialMotion.activateBoardTransition(overlay, 4);

    expect(JOURNEY_SPATIAL_DEPTH.boardTransition).toEqual({
      number: { x: 18, y: 14 },
      mountain: { x: 18, y: 14 },
      scene: { x: 16, y: 12 },
      cloud: { x: -18, y: -14 },
    });
    expect(JOURNEY_SPATIAL_SURFACE_GAIN.boardTransitionHill).toBe(0.3);
    expect(overlay.querySelectorAll('[data-journey-spatial-target="board-transition"]')).toHaveLength(7);

    journeySpatialMotion.deactivateBoardTransition();
    expect(overlay.querySelector('[data-journey-spatial-target]')).toBeNull();
    expect(Array.from(overlay.querySelectorAll<HTMLElement>('*')).every((element) => (
      element.style.translate === ''
    ))).toBe(true);
  });

  it('owns both Arcade Round Complete phases with one shared gyro controller', () => {
    document.body.innerHTML = `
      <section id="cc-arcade-stage-clear-overlay">
        <h1 class="cc-arcade-stage-title"></h1>
        <p class="cc-arcade-stage-subtitle"></p>
        <div class="cc-arcade-stage-thumb-wrap"></div>
        <div class="cc-arcade-next-label"></div>
        <span class="cc-arcade-next-digit-wrap"></span>
        <span class="cc-arcade-next-digit-wrap"></span>
      </section>
    `;
    const overlay = document.getElementById('cc-arcade-stage-clear-overlay') as HTMLElement;

    journeySpatialMotion.activateArcadeStageClear(overlay, 3);

    expect(JOURNEY_SPATIAL_DEPTH.arcadeStageClear).toEqual({
      title: { x: 9, y: 7 },
      subtitle: { x: 6, y: 5 },
      thumb: { x: 12, y: 9 },
      nextLabel: { x: 7, y: 5 },
      nextDigit: { x: 14, y: 11 },
    });
    expect(overlay.querySelectorAll('[data-journey-spatial-target="arcade-stage-clear"]')).toHaveLength(6);

    journeySpatialMotion.deactivateArcadeStageClear();
    expect(overlay.querySelector('[data-journey-spatial-target]')).toBeNull();
    expect(Array.from(overlay.querySelectorAll<HTMLElement>('*')).every((element) => (
      element.style.translate === ''
    ))).toBe(true);
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
    const modalTarget = container.querySelector<HTMLElement>('.hero-image') as HTMLElement;

    journeySpatialMotion.activateHomepage(container, 0);
    journeySpatialMotion.registerModalTargets(container, [{
      element: modalTarget,
      xDepth: 5,
      yDepth: 4,
    }]);

    expect(journeySpatialMotion.isEnabled()).toBe(false);
    expect(container.querySelector<HTMLElement>('.hero-image')?.dataset.journeySpatialTarget).toBeUndefined();
    expect(container.querySelector<HTMLElement>('.slide-button')?.dataset.journeySpatialTarget).toBeUndefined();
    expect(modalTarget.classList).not.toContain('cc-modal-spatial-target');
  });

  it('re-requests iOS motion permission from the first trusted gesture after a hard relaunch', async () => {
    (window as Window & { _settings?: { spatialMotionEnabled: boolean } })._settings = {
      spatialMotionEnabled: true,
    };
    const requestPermission = jest.fn().mockResolvedValue('granted');
    const persistPermission = jest.fn();
    Object.defineProperty(window, 'webkit', {
      configurable: true,
      value: {
        messageHandlers: {
          motionPermissionResult: { postMessage: persistPermission },
        },
      },
    });
    class DeviceOrientationEventWithPermission {}
    Object.defineProperty(DeviceOrientationEventWithPermission, 'requestPermission', {
      configurable: true,
      value: requestPermission,
    });
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: DeviceOrientationEventWithPermission,
    });
    document.body.innerHTML = `
      <div id="home">
        <div id="slider-container">
          <div class="slider-slide active" data-slide="0">
            <img class="hero-image" />
            <button class="slide-button">Play</button>
          </div>
        </div>
      </div>
    `;

    let permissionGesture: EventListener | null = null;
    const listenerTypes: string[] = [];
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    addEventListenerSpy.mockImplementation((type, listener) => {
      listenerTypes.push(type);
      if (type === 'click') permissionGesture = listener as EventListener;
    });
    const controller = new AppSpatialMotionController();
    const container = document.getElementById('slider-container') as HTMLElement;

    controller.activateHomepage(container, 0);
    controller.armPermissionFromNextGesture();
    expect(permissionGesture).not.toBeNull();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(listenerTypes).not.toContain('deviceorientation');

    permissionGesture?.({ isTrusted: false } as Event);
    expect(requestPermission).not.toHaveBeenCalled();

    permissionGesture?.({ isTrusted: true } as Event);
    await Promise.resolve();
    await Promise.resolve();

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(persistPermission).toHaveBeenCalledWith({ granted: true });
    expect(listenerTypes).toContain('deviceorientation');
    controller.armPermissionFromNextGesture();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    controller.deactivate();
    addEventListenerSpy.mockRestore();
  });
});
