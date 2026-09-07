import {
  isJourneyDetailModalPresentationReady,
  isJourneyScreenPresentationReady,
  prepareJourneyWorldRecovery,
  waitForJourneyReturnPresentation,
} from '../journey-return-presentation';

jest.mock('../run-mode.js', () => ({
  RUN_MODE_JOURNEY: 'journey',
  setRunMode: jest.fn(),
}));

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

describe('Journey return presentation contract', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    [
      '__ccCameFromJourney',
      '__ccCameFromHomepage',
      '__ccCameFromDetailModal',
      '__ccDetailModalBoardId',
      '__ccFromInterimBoard',
      '__ccIsInterimBoard',
      '__ccReturningFromDetailModal',
      '__ccSuppressJourneyShowForDirectDetailReturn',
      '__ccDirectDetailModalReturnActive',
      '__ccSuppressJourneyV700AutoWorldEnter',
      '__ccJourneyReturnBoardId',
      '__ccLastActiveJourneyBoardAreaId',
    ].forEach((key) => delete (window as any)[key]);
  });

  test('rejects a visible paper shell with no painted Journey Units', () => {
    document.body.innerHTML = `
      <section id="journey-screen" style="display:flex;visibility:visible;opacity:1">
        <div id="journey-boards-container" data-journey-v700-view="world"></div>
      </section>`;
    setPaintedRect(document.getElementById('journey-screen') as HTMLElement, 390, 844);

    expect(isJourneyScreenPresentationReady()).toBe(false);
  });

  test.each([
    ['hub', '<button class="journey-v700-world-card"></button>'],
    ['world', '<div class="journey-board-card-wrapper"></div>'],
  ])('accepts a painted %s Journey presentation', (view, content) => {
    document.body.innerHTML = `
      <section id="journey-screen" style="display:flex;visibility:visible;opacity:1">
        <div id="journey-boards-container" data-journey-v700-view="${view}">${content}</div>
      </section>`;
    const screen = document.getElementById('journey-screen') as HTMLElement;
    const target = screen.querySelector('#journey-boards-container > *') as HTMLElement;
    setPaintedRect(screen, 390, 844);
    setPaintedRect(target, 220, 180);

    expect(isJourneyScreenPresentationReady()).toBe(true);
  });

  test('requires visible content inside the detail modal', () => {
    document.body.innerHTML = `
      <section id="collectibles-detail-modal" aria-hidden="false"
        style="display:flex;visibility:visible;opacity:1;pointer-events:auto">
        <button id="detail-close-btn" style="display:flex;visibility:visible;opacity:1"></button>
      </section>`;
    const modal = document.getElementById('collectibles-detail-modal') as HTMLElement;
    const close = document.getElementById('detail-close-btn') as HTMLElement;
    setPaintedRect(modal, 390, 844);
    setPaintedRect(close, 44, 44);

    expect(isJourneyDetailModalPresentationReady()).toBe(true);
    close.style.visibility = 'hidden';
    expect(isJourneyDetailModalPresentationReady()).toBe(false);
  });

  test('waits for a Journey Unit instead of accepting the outer shell', async () => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <section id="journey-screen" style="display:flex;visibility:visible;opacity:1">
        <div id="journey-boards-container" data-journey-v700-view="world"></div>
      </section>`;
    const screen = document.getElementById('journey-screen') as HTMLElement;
    const container = document.getElementById('journey-boards-container') as HTMLElement;
    setPaintedRect(screen, 390, 844);

    const wait = waitForJourneyReturnPresentation('screen', { timeoutMs: 200, pollMs: 20 });
    window.setTimeout(() => {
      const unit = document.createElement('div');
      unit.className = 'journey-board-card-wrapper';
      setPaintedRect(unit, 200, 160);
      container.appendChild(unit);
    }, 60);
    await jest.advanceTimersByTimeAsync(80);

    await expect(wait).resolves.toBe(true);
  });

  test('converts a failed detail return into one canonical World recovery intent', () => {
    (window as any).__ccCameFromDetailModal = true;
    (window as any).__ccDetailModalBoardId = 21;
    (window as any).__ccSuppressJourneyShowForDirectDetailReturn = true;
    (window as any).__ccDirectDetailModalReturnActive = true;

    expect(prepareJourneyWorldRecovery({
      boardId: 21,
      fromInterim: false,
      reason: 'test',
    })).toBe(21);

    expect((window as any).__ccCameFromDetailModal).toBeUndefined();
    expect((window as any).__ccDetailModalBoardId).toBeUndefined();
    expect((window as any).__ccSuppressJourneyShowForDirectDetailReturn).toBeUndefined();
    expect((window as any).__ccDirectDetailModalReturnActive).toBeUndefined();
    expect((window as any).__ccReturningFromDetailModal).toBe(true);
    expect((window as any).__ccJourneyReturnBoardId).toBe(21);
    expect((window as any).__ccLastActiveJourneyBoardAreaId).toBe(21);
    expect(localStorage.getItem('__ccJourneyReturnBoardId')).toBe('21');
    expect(localStorage.getItem('__ccLastActiveJourneyBoardAreaId')).toBe('21');
  });

  test('clears stale World targeting when no valid recovery board exists', () => {
    (window as any).__ccJourneyReturnBoardId = 21;
    (window as any).__ccLastActiveJourneyBoardAreaId = 21;
    localStorage.setItem('__ccJourneyReturnBoardId', '21');
    localStorage.setItem('__ccLastActiveJourneyBoardAreaId', '21');

    expect(prepareJourneyWorldRecovery({
      boardId: null,
      fromInterim: false,
      reason: 'missing-board-test',
    })).toBeNull();

    expect((window as any).__ccJourneyReturnBoardId).toBeUndefined();
    expect((window as any).__ccLastActiveJourneyBoardAreaId).toBeUndefined();
    expect(localStorage.getItem('__ccJourneyReturnBoardId')).toBeNull();
    expect(localStorage.getItem('__ccLastActiveJourneyBoardAreaId')).toBeNull();
  });
});
