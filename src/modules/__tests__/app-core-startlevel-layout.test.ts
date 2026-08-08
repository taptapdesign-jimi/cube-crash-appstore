import { ensureStartLevelLayout } from '../app-core-startlevel-layout';

describe('startLevel layout ownership', () => {
  test('a slow layout restores ghosts when pop-in finishes while layout is pending', async () => {
    let finishLayout!: () => void;
    const layoutBoard = jest.fn(() => new Promise<void>((resolve) => {
      finishLayout = resolve;
    }));
    const layer = { label: 'BackgroundLayer', visible: false, zIndex: 0 };
    const board = {
      children: [layer],
      removeChild: jest.fn(),
      addChildAt: jest.fn(),
      sortChildren: jest.fn(),
    };
    const hideGhostPlaceholders = jest.fn();
    const updateGhostVisibility = jest.fn();
    (window as any).__ccEnterAnimationActive = true;

    const owner = ensureStartLevelLayout({
      layoutBoard,
      initializeBackgroundLayer: jest.fn(),
      board,
      backgroundLayer: layer,
      setBackgroundLayer: jest.fn(),
      updateGhostVisibility,
      hideGhostPlaceholders,
      devError: jest.fn(),
    });

    expect(hideGhostPlaceholders).toHaveBeenCalledTimes(1);
    (window as any).__ccEnterAnimationActive = false;
    finishLayout();
    await owner;

    expect(updateGhostVisibility).toHaveBeenCalledTimes(1);
    expect(hideGhostPlaceholders).toHaveBeenCalledTimes(1);
    delete (window as any).__ccEnterAnimationActive;
  });
});
