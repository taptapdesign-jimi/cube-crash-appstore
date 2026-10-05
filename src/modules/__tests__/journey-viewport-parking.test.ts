import {
  isJourneyViewportParked,
  parkJourneyViewportForGameplay,
  releaseJourneyViewportParking,
} from '../journey-viewport-parking';

function fixture(worldId = '2', view = 'world') {
  const screen = document.createElement('section');
  const surface = document.createElement('div');
  surface.dataset.journeyV700View = view;
  surface.dataset.journeyV700WorldId = worldId;
  screen.append(surface);
  document.body.append(screen);
  return { screen, surface };
}

describe('bounded route-owned viewport parking', () => {
  afterEach(() => {
    releaseJourneyViewportParking();
    document.body.replaceChildren();
  });

  it('installs an opaque body-level cover before publishing the visible parking marker', () => {
    const { screen, surface } = fixture();
    const original = screen.setAttribute.bind(screen);
    jest.spyOn(screen, 'setAttribute').mockImplementation((name, value) => {
      if (name === 'data-journey-viewport-parked') {
        const cover = document.querySelector<HTMLElement>('.journey-viewport-parking-cover')!;
        expect(cover?.parentElement).toBe(document.body);
        expect(cover.style.position).toBe('fixed');
        expect(cover.style.inset).toBe('0');
        expect(cover.style.zIndex).toBe('2');
        expect(cover.style.pointerEvents).toBe('none');
        expect(cover.getAttribute('aria-hidden')).toBe('true');
        expect(cover.style.background).toContain('var(--app-gradient');
        expect(cover.style.backgroundColor).toBe('rgb(243, 238, 232)');
      }
      original(name, value);
    });
    expect(parkJourneyViewportForGameplay(screen, surface)).toBe(true);
    expect(isJourneyViewportParked(screen)).toBe(true);
    expect(screen.inert).toBe(true);
    expect(screen.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getAttribute('data-journey-viewport-resident')).toBe('true');
  });

  it('reuses the exact lease without replacing the cover or touching content inertness', () => {
    const { screen, surface } = fixture();
    surface.inert = true;
    parkJourneyViewportForGameplay(screen, surface);
    const cover = document.querySelector('.journey-viewport-parking-cover');
    expect(parkJourneyViewportForGameplay(screen, surface)).toBe(true);
    expect(document.querySelectorAll('.journey-viewport-parking-cover')).toHaveLength(1);
    expect(document.querySelector('.journey-viewport-parking-cover')).toBe(cover);
    expect(surface.inert).toBe(true);
    releaseJourneyViewportParking(screen);
    expect(surface.inert).toBe(true);
  });

  it.each([['0', 'world'], ['4', 'world'], ['2', 'hub'], ['', 'world']])('rejects invalid gameplay admission %s/%s', (world, view) => {
    const { screen, surface } = fixture(world, view);
    expect(parkJourneyViewportForGameplay(screen, surface)).toBe(false);
    expect(isJourneyViewportParked(screen)).toBe(false);
    expect(document.querySelector('.journey-viewport-parking-cover')).toBeNull();
    expect(screen.hasAttribute('data-journey-viewport-resident')).toBe(false);
  });

  it.each(['1', '2', '3'])('admits existing World %s only for gameplay', world => {
    const { screen, surface } = fixture(world);
    expect(parkJourneyViewportForGameplay(screen, surface)).toBe(true);
    expect(isJourneyViewportParked(screen)).toBe(true);
  });

  it('never paint-parks the Hub or installs a Homepage-obscuring cover', () => {
    const { screen, surface } = fixture('', 'hub');
    expect(parkJourneyViewportForGameplay(screen, surface)).toBe(false);
    expect(isJourneyViewportParked(screen)).toBe(false);
    expect(document.querySelector('.journey-viewport-parking-cover')).toBeNull();
  });

  it('clears stale inline important hiding only after gameplay cover publication', () => {
    const { screen, surface } = fixture();
    for (const [property, value] of [['display', 'none'], ['opacity', '0'], ['visibility', 'hidden'], ['z-index', '999999']]) {
      screen.style.setProperty(property, value, 'important');
    }
    const original = screen.style.setProperty.bind(screen.style);
    jest.spyOn(screen.style, 'setProperty').mockImplementation((property, value, priority) => {
      expect(document.querySelector('.journey-viewport-parking-cover')?.isConnected).toBe(true);
      original(property, value, priority);
    });
    expect(parkJourneyViewportForGameplay(screen, surface)).toBe(true);
    for (const property of ['display', 'opacity', 'visibility', 'z-index']) {
      expect(screen.style.getPropertyPriority(property)).toBe('');
    }
    expect(isJourneyViewportParked(screen)).toBe(true);
  });

  it('replaces a World lease without retaining root inertness from the previous lease', () => {
    const { screen, surface } = fixture();
    parkJourneyViewportForGameplay(screen, surface);
    surface.dataset.journeyV700WorldId = '3';
    expect(parkJourneyViewportForGameplay(screen, surface)).toBe(true);
    expect(document.querySelectorAll('.journey-viewport-parking-cover')).toHaveLength(1);
    expect(isJourneyViewportParked(screen)).toBe(true);
    releaseJourneyViewportParking(screen);
    expect(screen.inert).toBe(false);
    expect(screen.getAttribute('aria-hidden')).toBeNull();
  });

  it('retains only the requested compositor marker through return and clears it on later permanent cleanup', () => {
    const { screen, surface } = fixture();
    parkJourneyViewportForGameplay(screen, surface);
    releaseJourneyViewportParking(screen, true);
    expect(screen.getAttribute('data-journey-viewport-resident')).toBe('true');
    expect(screen.hasAttribute('data-journey-viewport-parked')).toBe(false);
    expect(document.querySelector('.journey-viewport-parking-cover')).toBeNull();
    expect(screen.style.visibility).toBe('hidden');
    expect(screen.inert).toBe(false);
    releaseJourneyViewportParking(screen, true);
    expect(screen.getAttribute('data-journey-viewport-resident')).toBe('true');
    releaseJourneyViewportParking(screen);
    expect(screen.hasAttribute('data-journey-viewport-resident')).toBe(false);
  });

  it('does not clear a foreign resident marker when another screen owns the active lease', () => {
    const current = fixture();
    const foreign = fixture();
    foreign.screen.setAttribute('data-journey-viewport-resident', 'true');
    parkJourneyViewportForGameplay(current.screen, current.surface);
    releaseJourneyViewportParking(foreign.screen);
    expect(foreign.screen.getAttribute('data-journey-viewport-resident')).toBe('true');
    expect(isJourneyViewportParked(current.screen)).toBe(true);
  });

  it('rejects disconnected or foreign surfaces without changing an existing lease', () => {
    const current = fixture();
    const foreign = fixture();
    parkJourneyViewportForGameplay(current.screen, current.surface);
    expect(parkJourneyViewportForGameplay(current.screen, foreign.surface)).toBe(false);
    foreign.screen.remove();
    expect(parkJourneyViewportForGameplay(foreign.screen, foreign.surface)).toBe(false);
    expect(parkJourneyViewportForGameplay(current.surface, current.surface)).toBe(false);
    expect(isJourneyViewportParked(current.screen)).toBe(true);
    releaseJourneyViewportParking(foreign.screen);
    expect(isJourneyViewportParked(current.screen)).toBe(true);
  });

  it('hides a replaced owner before uncovering it and ignores its stale release', () => {
    const first = fixture();
    const second = fixture();
    parkJourneyViewportForGameplay(first.screen, first.surface);
    const oldCover = document.querySelector<HTMLElement>('.journey-viewport-parking-cover')!;
    const remove = oldCover.remove.bind(oldCover);
    jest.spyOn(oldCover, 'remove').mockImplementation(() => {
      expect(first.screen.hidden).toBe(true);
      expect(first.screen.style.visibility).toBe('hidden');
      expect(first.screen.style.opacity).toBe('0');
      expect(document.querySelectorAll('.journey-viewport-parking-cover')).toHaveLength(2);
      remove();
    });
    expect(parkJourneyViewportForGameplay(second.screen, second.surface)).toBe(true);
    expect(isJourneyViewportParked(first.screen)).toBe(false);
    expect(isJourneyViewportParked(second.screen)).toBe(true);
    releaseJourneyViewportParking(first.screen);
    expect(isJourneyViewportParked(second.screen)).toBe(true);
  });

  it.each([[false, null], [true, 'false'], [false, 'true']])('restores prior root inert=%s and aria=%s while leaving the root hidden', (inert, aria) => {
    const { screen, surface } = fixture();
    screen.inert = inert as boolean;
    if (aria !== null) screen.setAttribute('aria-hidden', aria as string);
    surface.inert = false;
    parkJourneyViewportForGameplay(screen, surface);
    const cover = document.querySelector<HTMLElement>('.journey-viewport-parking-cover')!;
    const remove = cover.remove.bind(cover);
    jest.spyOn(cover, 'remove').mockImplementation(() => {
      expect(screen.style.opacity).toBe('0');
      expect(screen.style.visibility).toBe('hidden');
      expect(screen.style.getPropertyPriority('opacity')).toBe('important');
      expect(screen.style.getPropertyPriority('visibility')).toBe('important');
      expect(screen.hasAttribute('data-journey-viewport-parked')).toBe(false);
      remove();
    });
    releaseJourneyViewportParking(screen);
    releaseJourneyViewportParking(screen);
    expect(screen.inert).toBe(inert);
    expect(screen.getAttribute('aria-hidden')).toBe(aria);
    expect(surface.inert).toBe(false);
    expect(isJourneyViewportParked(screen)).toBe(false);
    expect(document.querySelector('.journey-viewport-parking-cover')).toBeNull();
  });

  it('does not report a lease as parked after its surface is moved or cover removed', () => {
    const { screen, surface } = fixture();
    parkJourneyViewportForGameplay(screen, surface);
    document.body.append(surface);
    expect(isJourneyViewportParked(screen)).toBe(false);
    screen.append(surface);
    expect(isJourneyViewportParked(screen)).toBe(true);
    document.querySelector('.journey-viewport-parking-cover')!.remove();
    expect(isJourneyViewportParked(screen)).toBe(false);
    releaseJourneyViewportParking();
    expect(screen.hasAttribute('data-journey-viewport-parked')).toBe(false);
  });
});
