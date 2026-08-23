import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('gameplay stabilization ownership boundaries', () => {
  const appCore = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
  const uiManager = fs.readFileSync(path.join(repoRoot, 'src/modules/ui-manager.ts'), 'utf8');
  const errorHandler = fs.readFileSync(path.join(repoRoot, 'src/utils/error-handler.ts'), 'utf8');

  test('a delayed endgame check cannot cross a startLevel generation', () => {
    const resetStart = appCore.indexOf('function resetTransientRunGuards');
    const resetEnd = appCore.indexOf('function resetTransientEndgameRuntimeState', resetStart);
    const resetOwner = appCore.slice(resetStart, resetEnd);
    expect(resetOwner).toContain('gameplayRunGeneration += 1;');
    expect(resetOwner).toContain('cancelCheckLevelEndTimer();');

    const scheduleStart = appCore.indexOf('function scheduleCheckLevelEnd');
    const scheduleEnd = appCore.indexOf('function installGsapTickerTracking', scheduleStart);
    const scheduleOwner = appCore.slice(scheduleStart, scheduleEnd);
    expect(scheduleOwner).toContain('const scheduledGeneration = gameplayRunGeneration;');
    expect(scheduleOwner).toContain('if (scheduledGeneration !== gameplayRunGeneration) return;');

    const checkStart = appCore.indexOf('function checkLevelEnd()');
    const checkOwner = appCore.slice(checkStart, checkStart + 1400);
    expect(checkOwner).toContain('const scheduledGeneration = gameplayRunGeneration;');
    expect(checkOwner).toContain('if (!isCurrentCheck()) return;');
    expect(appCore).toContain("if (await waitTrackedResult(delayMs) === 'cancelled') return;\n        if (!isCurrentCheck()) return;");
  });

  test('new board and restart boundaries cancel old level-flow work', () => {
    const startLevelStart = appCore.indexOf('async function startLevel(n)');
    const startLevelOwner = appCore.slice(startLevelStart, startLevelStart + 1000);
    expect(startLevelOwner).toContain('clearAllAppTimeouts()');
    expect(startLevelOwner).toContain('FLOW.cleanupLevelFlowTimeouts()');

    const restartStart = appCore.indexOf('async function performRestartGame');
    const restartOwner = appCore.slice(restartStart, restartStart + 6000);
    expect(restartOwner).toContain("cleanupFxForBoardReset('restartGame')");
    expect(restartOwner).toContain('FLOW.cleanupLevelFlowTimeouts()');
  });

  test('a new board retires previous-board animation frames before awaiting entry work', () => {
    const startLevelBody = appCore.slice(appCore.indexOf('async function startLevel'), appCore.indexOf('async function startLevel') + 2600);
    expect(startLevelBody).toContain('clearAllAppAnimationFrames()');
    expect(startLevelBody.indexOf('clearAllAppAnimationFrames()')).toBeLessThan(startLevelBody.indexOf('await '));
  });

  test('stuck confirmation fails closed when its resolver throws', () => {
    const marker = 'Gameplay resolver failed during stuck confirmation; retrying safely';
    const markerIndex = appCore.indexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    const owner = appCore.slice(markerIndex - 1100, markerIndex + 300);
    expect(owner).toContain('try {');
    expect(owner).toContain('resolveLevelEndDecision({');
    expect(owner).toContain('catch (resolverError)');
    expect(owner).toContain('stableStuckConfirmed = false;');
  });

  test('merge-6 remainder delays settle through the cancellable wait owner', () => {
    expect(appCore).toContain("await waitTrackedResult(80 + i * 150) === 'cancelled'");
    expect(appCore).not.toContain('new Promise<void>(r => trackAppTimeout(r, 80 + i * 150))');
  });

  test('Homepage exit cannot destroy the shared app animation service', () => {
    const hideStart = uiManager.indexOf('hideHomepage()');
    const hideEnd = uiManager.indexOf('showApp()', hideStart);
    expect(hideStart).toBeGreaterThan(-1);
    expect(hideEnd).toBeGreaterThan(hideStart);
    expect(uiManager.slice(hideStart, hideEnd)).not.toContain('animationManager.destroy()');
  });

  test('memory recovery cannot clear the application-wide GSAP timeline', () => {
    const clearCachesStart = errorHandler.indexOf('private clearCaches()');
    const clearCachesOwner = errorHandler.slice(clearCachesStart, clearCachesStart + 900);
    expect(clearCachesOwner).toContain('textureGC?.run?.()');
    expect(clearCachesOwner).not.toContain('globalTimeline.clear');
  });
});
