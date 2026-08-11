import { appZoneManager } from '../app-zone-manager';
import { getRunMode, RUN_MODE_ARCADE_HOME, RUN_MODE_JOURNEY } from '../run-mode';
import {
  cleanupNavigationControl,
  commitHomepageNavigation,
  getHomepageNavigationLifecycleSnapshot,
  initNavigationControl,
  primeHomepageNavigation,
} from '../navigation-control';

jest.mock('../../core/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../journey-boards-manager.js', () => ({
  journeyBoardsManager: {
    getBoardById: jest.fn((boardId: number) => ({ id: boardId, unlocked: boardId === 4 })),
  },
}));

describe('app-zone-manager', () => {
  beforeEach(() => {
    cleanupNavigationControl();
    document.body.innerHTML = '';
    localStorage.clear();
    delete (global as any).__ccAppZone;
    delete (global as any).__ccRunMode;
    delete (global as any).__ccCameFromHomepage;
    delete (global as any).__ccCameFromJourney;
    delete (global as any).__ccFromInterimBoard;
    delete (global as any).__ccIsInterimBoard;
    delete (global as any).__ccReturningFromInterimBoard;
    delete (global as any).__ccCameFromDetailModal;
    delete (global as any).__ccDetailModalBoardId;
  });

  afterEach(() => {
    cleanupNavigationControl();
    document.body.innerHTML = '';
  });

  it('prepares arcade as a clean home-origin board zone', () => {
    (global as any).__ccCameFromJourney = true;
    (global as any).__ccFromInterimBoard = true;
    (global as any).__ccCameFromDetailModal = true;
    localStorage.setItem('__ccCameFromJourney', 'true');

    appZoneManager.prepareArcadeRunOrigin('test-arcade');

    expect(getRunMode()).toBe(RUN_MODE_ARCADE_HOME);
    expect(appZoneManager.getCurrentZone()).toBe('board-arcade');
    expect(appZoneManager.getLastMenuTarget()).toBe('home');
    expect((global as any).__ccCameFromHomepage).toBe(true);
    expect((global as any).__ccCameFromJourney).toBe(false);
    expect((global as any).__ccFromInterimBoard).toBe(false);
    expect((global as any).__ccCameFromDetailModal).toBeUndefined();
    expect(localStorage.getItem('__ccCameFromHomepage')).toBe('true');
    expect(localStorage.getItem('__ccCameFromJourney')).toBeNull();
  });

  it('acquires a prepared Homepage enter without painting navigation before scale-zero prime', () => {
    document.body.innerHTML = `
      <div id="independent-nav">
        <div class="independent-nav-content">
          <div class="independent-nav-buttons">
            <button class="independent-nav-button"><img alt="" /></button>
          </div>
        </div>
      </div>
    `;
    initNavigationControl();
    appZoneManager.enterArcadeBoardZone('test-gameplay');

    appZoneManager.prepareHomeMenuEnter('test-prepared-return');

    expect(appZoneManager.getCurrentZone()).toBe('home');
    expect(getHomepageNavigationLifecycleSnapshot()).toMatchObject({
      phase: 'inactive',
      owner: 'inactive',
      hidden: true,
      display: 'none',
    });

    const nav = document.getElementById('independent-nav') as HTMLElement;
    nav.classList.add('animate-enter-initial');
    nav.style.transform = 'scale(0)';
    primeHomepageNavigation('test:after-scale-zero');

    expect(getHomepageNavigationLifecycleSnapshot()).toMatchObject({
      phase: 'primed',
      owner: 'active',
      hidden: false,
      display: 'block',
      transform: 'scale(0)',
    });
  });

  it('prepares journey as a journey-origin board zone', () => {
    appZoneManager.prepareJourneyRunOrigin({
      reason: 'test-journey',
      boardId: 7,
      fromInterim: true,
    });

    expect(getRunMode()).toBe(RUN_MODE_JOURNEY);
    expect(appZoneManager.getCurrentZone()).toBe('board-journey');
    expect(appZoneManager.getLastMenuTarget()).toBe('journey');
    expect((global as any).__ccCameFromJourney).toBe(true);
    expect((global as any).__ccCameFromHomepage).toBe(false);
    expect((global as any).__ccFromInterimBoard).toBe(true);
    expect(localStorage.getItem('__ccCameFromJourney')).toBe('true');
  });

  it('lets an animated Settings transition retain nav ownership until its exit owner finishes', () => {
    document.body.innerHTML = `
      <div id="independent-nav">
        <div class="independent-nav-content"><div class="independent-nav-buttons">
          <button class="independent-nav-button"><img alt="" /></button>
        </div></div>
      </div>`;
    appZoneManager.setZone('home', 'test-settings-home');
    initNavigationControl();
    primeHomepageNavigation('test-settings-prime');
    commitHomepageNavigation('test-settings-interactive');

    appZoneManager.setZone('settings', 'test-settings-enter', {
      preserveHomepageNavigation: true,
    });

    expect(appZoneManager.getCurrentZone()).toBe('settings');
    expect(getHomepageNavigationLifecycleSnapshot()).toMatchObject({
      phase: 'interactive',
      hidden: false,
      display: 'block',
    });
  });

  it('resolves arcade return to home even with stale journey flags', () => {
    appZoneManager.prepareArcadeRunOrigin('test-arcade');
    (global as any).__ccCameFromJourney = true;
    localStorage.setItem('__ccCameFromJourney', 'true');

    expect(appZoneManager.resolveMenuReturnTarget()).toBe('home');
  });

  it('resolves journey detail return before generic journey return', () => {
    appZoneManager.prepareJourneyRunOrigin({
      reason: 'test-detail',
      boardId: 4,
      fromDetailModal: true,
    });

    expect(appZoneManager.resolveMenuReturnTarget()).toBe('detail-modal');
  });

  it('resolves game exit route for arcade to home even with stale journey flags', async () => {
    appZoneManager.prepareArcadeRunOrigin('test-arcade');
    (global as any).__ccCameFromJourney = true;
    localStorage.setItem('__ccCameFromJourney', 'true');

    await expect(appZoneManager.resolveGameExitRoute({ reason: 'test-exit' })).resolves.toMatchObject({
      target: 'home',
      targetSlide: 0,
      returnToDetailModal: false,
      detailModalBoardId: null,
    });
  });

  it('resolves game exit route for journey to journey screen', async () => {
    appZoneManager.prepareJourneyRunOrigin({ reason: 'test-journey', boardId: 8 });

    await expect(appZoneManager.resolveGameExitRoute({ reason: 'test-exit' })).resolves.toMatchObject({
      target: 'journey',
      targetSlide: 1,
      returnToDetailModal: false,
      detailModalBoardId: null,
    });
  });

  it('resolves game exit route to detail modal for unlocked detail-origin board', async () => {
    appZoneManager.prepareJourneyRunOrigin({
      reason: 'test-detail',
      boardId: 4,
      fromDetailModal: true,
    });

    await expect(appZoneManager.resolveGameExitRoute({ reason: 'test-exit' })).resolves.toMatchObject({
      target: 'detail-modal',
      targetSlide: 1,
      returnToDetailModal: true,
      detailModalBoardId: 4,
    });
  });
});
