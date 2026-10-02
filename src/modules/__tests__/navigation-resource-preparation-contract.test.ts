import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string => fs.readFileSync(
  path.join(process.cwd(), relativePath),
  'utf8',
);

describe('navigation resource preparation contract', () => {
  test('board transitions share a bounded decode path and reject stale detail owners', () => {
    const transition = read('src/modules/board-transition-screen.ts');
    const manager = read('src/modules/journey-boards-manager.ts');
    const detailPreload = manager.slice(
      manager.indexOf('const scheduleDetailIdlePreload'),
      manager.indexOf('scheduleDetailIdlePreload();'),
    );

    expect(transition).toContain('export async function prepareBoardTransitionAssets');
    expect(transition).toContain('preloadImagesBounded(missingUrls');
    expect(transition).toContain('concurrency: 2');
    expect(transition).toContain('isCurrent: () => isTransitionActive && activeGeneration === transitionGeneration');
    expect(detailPreload).toContain('prepareBoardTransitionAssets');
    expect(detailPreload).toContain('isCurrent: isDetailPreloadCurrent');
    expect(detailPreload).toContain('this.trackTimeout(runPreload, 0)');
    expect(detailPreload).not.toContain('requestIdleCallback(runPreload');
    expect(detailPreload.indexOf('await prepareBoardTransitionAssets({')).toBeLessThan(
      detailPreload.indexOf('await preloadJourneyBoardImages([board.id])'),
    );
    expect(detailPreload.indexOf('await preloadJourneyBoardImages([board.id])')).toBeLessThan(
      detailPreload.indexOf('warmBoardGameAssetsSoon({'),
    );
  });

  test('shared image decoder has a global two-job ceiling', () => {
    const preloader = read('src/utils/bounded-image-preloader.ts');
    expect(preloader).toContain('const GLOBAL_IMAGE_LOAD_LIMIT = 2;');
    expect(preloader).toContain('const pendingSources = new Map<string, Promise<void>>();');
    expect(preloader).toContain('const imageLoadWaiters: Array<() => void> = [];');
  });
});
