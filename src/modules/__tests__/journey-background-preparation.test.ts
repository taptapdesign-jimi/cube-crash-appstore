import {
  isJourneyViewStructurallyPrepared,
  isJourneyBackgroundPreparationAllowed,
  shouldBlockHiddenJourneyRender,
} from '../journey-background-preparation';

describe('Journey background preparation ownership', () => {
  test.each(['home', 'journey'])(
    'allows menu preparation in %s zone',
    appZone => {
      expect(isJourneyBackgroundPreparationAllowed({ appZone })).toBe(true);
    }
  );

  test.each([undefined, 'loader', 'settings', 'board-arcade', 'board-journey', 'clean-board', 'new-card', 'stage-complete', 'fail-screen'])(
    'blocks late preparation in %s zone',
    appZone => {
      expect(isJourneyBackgroundPreparationAllowed({ appZone })).toBe(false);
    }
  );

  test('blocks a post-critical preload that resolves during game startup', () => {
    expect(isJourneyBackgroundPreparationAllowed({
      appZone: 'journey',
      gameStartInProgress: true,
    })).toBe(false);
  });

  test('blocks a late direct world render behind the board transition', () => {
    expect(shouldBlockHiddenJourneyRender(true, true)).toBe(true);
    expect(shouldBlockHiddenJourneyRender(false, true)).toBe(false);
    expect(shouldBlockHiddenJourneyRender(true, false)).toBe(false);
    expect(shouldBlockHiddenJourneyRender(true, false, true)).toBe(true);
  });

  test('recognizes a complete prepared Hub without requiring board cards', () => {
    const container = document.createElement('div');
    container.dataset.journeyV700View = 'hub';
    container.innerHTML = `
      <div class="journey-v700-hub">
        <div class="journey-v700-hub-cloud-layer"></div>
        <button class="journey-v700-world-card"></button>
        <button class="journey-v700-world-card"></button>
        <button class="journey-v700-world-card"></button>
      </div>`;
    document.body.appendChild(container);

    expect(isJourneyViewStructurallyPrepared(container)).toBe(true);
    container.remove();
  });

  test('recognizes a complete prepared World and rejects incomplete or detached DOM', () => {
    const container = document.createElement('div');
    container.dataset.journeyV700View = 'world';
    container.innerHTML = '<div class="journey-cards-container"><button class="journey-board-card"></button></div>';
    document.body.appendChild(container);
    expect(isJourneyViewStructurallyPrepared(container)).toBe(true);

    container.querySelector('.journey-board-card')?.remove();
    expect(isJourneyViewStructurallyPrepared(container)).toBe(false);
    container.remove();
    expect(isJourneyViewStructurallyPrepared(container)).toBe(false);
  });
});
