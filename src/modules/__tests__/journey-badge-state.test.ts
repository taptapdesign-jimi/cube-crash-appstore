import {
  getPersistedJourneyNewlyUnlockedCount,
  JOURNEY_BOARDS_STATE_STORAGE_KEY,
  JOURNEY_LAYOUT_STATE_VERSION,
  JOURNEY_LAYOUT_STATE_VERSION_STORAGE_KEY,
  JOURNEY_VIEWED_BOARDS_STORAGE_KEY,
} from '../journey-badge-state';
import fs from 'node:fs';
import path from 'node:path';

describe('Journey persisted navigation badge', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      JOURNEY_LAYOUT_STATE_VERSION_STORAGE_KEY,
      JOURNEY_LAYOUT_STATE_VERSION,
    );
  });

  test('counts only unlocked boards that have not been viewed', () => {
    localStorage.setItem(JOURNEY_BOARDS_STATE_STORAGE_KEY, JSON.stringify([
      { id: 1, unlocked: true, interim: false },
      { id: 2, unlocked: false, interim: true },
      { id: 3, unlocked: true, interim: false },
    ]));
    localStorage.setItem(JOURNEY_VIEWED_BOARDS_STORAGE_KEY, JSON.stringify([1]));

    expect(getPersistedJourneyNewlyUnlockedCount()).toBe(1);
  });

  test('matches manager fallback semantics for missing, stale, or malformed state', () => {
    expect(getPersistedJourneyNewlyUnlockedCount()).toBe(0);

    localStorage.setItem(JOURNEY_BOARDS_STATE_STORAGE_KEY, '{broken');
    expect(getPersistedJourneyNewlyUnlockedCount()).toBe(0);

    localStorage.setItem(JOURNEY_BOARDS_STATE_STORAGE_KEY, JSON.stringify([
      { id: 1, unlocked: true },
    ]));
    localStorage.setItem(JOURNEY_LAYOUT_STATE_VERSION_STORAGE_KEY, 'stale-layout');
    expect(getPersistedJourneyNewlyUnlockedCount()).toBe(0);
  });

  test('deduplicates persisted ids and accepts numeric viewed ids from legacy state', () => {
    localStorage.setItem(JOURNEY_BOARDS_STATE_STORAGE_KEY, JSON.stringify([
      { id: 2, unlocked: true },
      { id: 2, unlocked: true },
      { id: 3, unlocked: true },
    ]));
    localStorage.setItem(JOURNEY_VIEWED_BOARDS_STORAGE_KEY, JSON.stringify(['2']));

    expect(getPersistedJourneyNewlyUnlockedCount()).toBe(1);
  });

  test('keeps Homepage badge refreshes independent from the full Journey manager', () => {
    const bootstrapSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/ui/bootstrap-ui.ts'),
      'utf8',
    );
    const uiManagerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/ui-manager.ts'),
      'utf8',
    );
    const homepageBadgeSource = uiManagerSource.split('// Hide homepage')[0] ?? '';
    const quietHomepageBadgeSource = uiManagerSource.split(
      '// 🔥 USER BUG FIX: Update Journey badge when showing homepage quietly',
    )[1]?.split('// The shared paper helper')[0] ?? '';

    expect(bootstrapSource).not.toContain("import('../modules/journey-boards-manager.js')");
    expect(homepageBadgeSource).not.toContain("import('./journey-boards-manager.js')");
    expect(quietHomepageBadgeSource).not.toContain("import('./journey-boards-manager.js')");
    expect(bootstrapSource).toContain('getPersistedJourneyNewlyUnlockedCount()');
  });
});
