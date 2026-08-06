import {
  cleanupNavigationControl,
  commitHomepageNavigation,
  getHomepageNavigationLifecycleSnapshot,
  hideHomepageNavigation,
  initNavigationControl,
  markHomepageNavigationEntering,
  primeHomepageNavigation,
  updateNavigationVisibility,
} from '../navigation-control.js';

function renderNavigation(): HTMLElement {
  document.body.innerHTML = `
    <div id="independent-nav" class="independent-nav">
      <div class="independent-nav-content">
        <div class="independent-nav-buttons">
          <button class="independent-nav-button active" data-slide="0">
            <span class="nav-icon-motion"><span class="nav-icon-visual"><img alt="" /></span></span>
          </button>
        </div>
      </div>
    </div>
  `;
  return document.getElementById('independent-nav') as HTMLElement;
}

describe('Homepage navigation lifecycle owner', () => {
  beforeEach(() => {
    cleanupNavigationControl();
    (window as any).__ccAppZone = 'loader';
  });

  afterEach(() => {
    cleanupNavigationControl();
    document.body.innerHTML = '';
    delete (window as any).__ccAppZone;
  });

  test('cold start is inactive, laid out while primed, and interactive only after commit', () => {
    const nav = renderNavigation();
    initNavigationControl();

    expect(nav.dataset.homepageOwner).toBe('inactive');
    expect(nav.dataset.homepageNavigationPhase).toBe('inactive');
    expect(nav.hidden).toBe(true);
    expect(nav.style.display).toBe('none');

    (window as any).__ccAppZone = 'home';
    const generation = primeHomepageNavigation('test:cold-prime');
    expect(nav.dataset.homepageOwner).toBe('active');
    expect(nav.dataset.homepageNavigationPhase).toBe('primed');
    expect(nav.hidden).toBe(false);
    expect(nav.style.display).toBe('block');
    expect(nav.style.pointerEvents).toBe('none');
    expect((nav.querySelector('img') as HTMLElement).style.visibility).toBe('visible');

    expect(markHomepageNavigationEntering('test:cold-enter')).toBe(generation);
    expect(nav.dataset.homepageNavigationPhase).toBe('entering');
    expect(nav.style.pointerEvents).toBe('none');

    commitHomepageNavigation('test:cold-commit', generation);
    expect(nav.dataset.homepageNavigationPhase).toBe('interactive');
    expect(nav.style.pointerEvents).toBe('auto');
    expect((nav.querySelector('button') as HTMLElement).style.pointerEvents).toBe('auto');
  });

  test('a stale enter lifecycle cannot reveal, regress, or commit a newer generation', () => {
    const nav = renderNavigation();
    initNavigationControl();
    (window as any).__ccAppZone = 'home';
    const staleGeneration = primeHomepageNavigation('test:first-prime');
    markHomepageNavigationEntering('test:first-enter');

    hideHomepageNavigation('test:route-release');
    expect(nav.dataset.homepageOwner).toBe('inactive');

    const currentGeneration = primeHomepageNavigation('test:second-prime');
    markHomepageNavigationEntering('test:stale-enter', staleGeneration);
    expect(nav.dataset.homepageNavigationPhase).toBe('primed');
    commitHomepageNavigation('test:stale-completion', staleGeneration);
    expect(nav.dataset.homepageNavigationPhase).toBe('primed');
    expect(nav.style.pointerEvents).toBe('none');

    commitHomepageNavigation('test:current-completion', currentGeneration);
    expect(nav.dataset.homepageNavigationPhase).toBe('interactive');
    expect(nav.style.pointerEvents).toBe('auto');
  });

  test.each(['journey', 'board-arcade', 'board-journey', 'fail-screen'])(
    'all activation intents remain paint-proof while zone is %s',
    (zone) => {
      const nav = renderNavigation();
      initNavigationControl();
      (window as any).__ccAppZone = zone;

      const generation = primeHomepageNavigation(`test:${zone}:prime`);
      markHomepageNavigationEntering(`test:${zone}:enter`, generation);
      commitHomepageNavigation(`test:${zone}:commit`, generation);
      updateNavigationVisibility();

      expect(nav.dataset.homepageOwner).toBe('inactive');
      expect(nav.dataset.homepageNavigationPhase).toBe('inactive');
      expect(nav.hidden).toBe(true);
      expect(nav.style.display).toBe('none');
      expect(nav.style.visibility).toBe('hidden');
      expect(nav.style.opacity).toBe('0');
      expect(nav.style.pointerEvents).toBe('none');
    },
  );

  test('duplicate prime cannot regress interactive Homepage navigation', () => {
    const nav = renderNavigation();
    initNavigationControl();
    (window as any).__ccAppZone = 'home';
    const generation = primeHomepageNavigation('test:prime');
    markHomepageNavigationEntering('test:enter', generation);
    commitHomepageNavigation('test:commit', generation);

    primeHomepageNavigation('test:duplicate-prime');
    markHomepageNavigationEntering('test:duplicate-enter');

    expect(nav.dataset.homepageNavigationPhase).toBe('interactive');
    expect(nav.style.pointerEvents).toBe('auto');
  });

  test('legacy DOM writes are reconciled from owner state rather than becoming state', () => {
    const nav = renderNavigation();
    initNavigationControl();
    hideHomepageNavigation('test:gameplay');

    nav.removeAttribute('hidden');
    nav.setAttribute('aria-hidden', 'false');
    nav.style.display = 'block';
    nav.style.visibility = 'visible';
    nav.style.opacity = '1';
    updateNavigationVisibility();

    expect(nav.dataset.homepageOwner).toBe('inactive');
    expect(nav.hidden).toBe(true);
    expect(nav.getAttribute('aria-hidden')).toBe('true');
    expect(nav.style.display).toBe('none');
    expect(nav.style.visibility).toBe('hidden');
    expect(nav.style.opacity).toBe('0');
  });

  test('interactive commit is rejected outside Homepage', () => {
    const nav = renderNavigation();
    initNavigationControl();
    (window as any).__ccAppZone = 'board-arcade';

    primeHomepageNavigation('test:bad-prime');
    commitHomepageNavigation('test:bad-commit');
    const lifecycle = getHomepageNavigationLifecycleSnapshot();
    expect(lifecycle.phase).toBe('inactive');
    expect(nav.dataset.homepageOwner).toBe('inactive');
    expect(nav.hidden).toBe(true);
  });
});
