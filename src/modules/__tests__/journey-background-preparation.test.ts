import {
  isJourneyViewStructurallyPrepared,
  isJourneyBackgroundPreparationAllowed,
  isJourneyVisibleEnterPreparationAllowed,
  shouldBlockHiddenJourneyRender,
} from '../journey-background-preparation';
import fs from 'node:fs';
import path from 'node:path';

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

  test('blocks preparation throughout gameplay and terminal pop-out ownership', () => {
    expect(isJourneyBackgroundPreparationAllowed({
      appZone: 'journey',
      gameplayExitInProgress: true,
    })).toBe(false);
    expect(isJourneyBackgroundPreparationAllowed({
      appZone: 'journey',
      terminalExitInProgress: true,
    })).toBe(false);
  });

  test('allows required visible render only after Journey owns the route', () => {
    expect(isJourneyVisibleEnterPreparationAllowed({
      appZone: 'journey',
      gameplayExitInProgress: true,
    })).toBe(true);
    expect(isJourneyVisibleEnterPreparationAllowed({
      appZone: 'home',
      gameplayExitInProgress: true,
    })).toBe(false);
    expect(isJourneyVisibleEnterPreparationAllowed({
      appZone: 'journey',
      terminalExitInProgress: true,
    })).toBe(false);

    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/collectibles-manager.ts'), 'utf8');
    expect(source).toContain('this.prepareJourneyScreen({ requiredForVisibleEnter: true })');
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

  test('builds World root layers off-tree and exposes bounded construction diagnostics', () => {
    const managerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    const collectiblesSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/collectibles-manager.ts'),
      'utf8',
    );

    expect(managerSource).toContain('const worldFragment = document.createDocumentFragment()');
    expect(managerSource).toContain('worldFragment.append(cloudContainer, bgContainer, decorContainer, cardsContainer)');
    expect(managerSource).toContain('atomicRootCommit: true');
    expect(managerSource).toContain("worldFragment.querySelectorAll('*').length : 0");
    expect(managerSource).toContain('const detailedRenderDiagnostic = areDetailedRuntimeDiagnosticsEnabled()');
    expect(collectiblesSource).not.toContain("childCount: journeyContainer.querySelectorAll('*').length");
    expect(collectiblesSource).toContain("emitIOSNativeDiagnostic('journey-required-render-start'");
    expect(collectiblesSource).toContain("emitIOSNativeDiagnostic('journey-required-render-complete'");
  });
});
