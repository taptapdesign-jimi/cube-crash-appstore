/** @jest-environment jsdom */

import {
  acquireGameplayDragForeground,
  getGameplayDragForegroundOwnerCount,
} from '../gameplay-drag-foreground-owner';

describe('gameplay drag foreground ownership', () => {
  const releases: Array<() => void> = [];

  afterEach(() => {
    while (releases.length) {
      try { releases.pop()?.(); } catch {}
    }
    expect(getGameplayDragForegroundOwnerCount()).toBe(0);
    expect(document.body.classList.contains('gameplay-drag-active')).toBe(false);
  });

  test('keeps foreground active until the last overlapping drag owner releases', () => {
    const releaseOldOwner = acquireGameplayDragForeground();
    const releaseCurrentOwner = acquireGameplayDragForeground();
    releases.push(releaseOldOwner, releaseCurrentOwner);

    expect(getGameplayDragForegroundOwnerCount()).toBe(2);
    expect(document.body.classList.contains('gameplay-drag-active')).toBe(true);
    expect((window as any).__ccGameplayDragActive).toBe(true);

    releaseOldOwner();
    expect(getGameplayDragForegroundOwnerCount()).toBe(1);
    expect(document.body.classList.contains('gameplay-drag-active')).toBe(true);

    releaseCurrentOwner();
    expect(getGameplayDragForegroundOwnerCount()).toBe(0);
    expect(document.body.classList.contains('gameplay-drag-active')).toBe(false);
    expect((window as any).__ccGameplayDragActive).toBe(false);
  });

  test('makes every release idempotent', () => {
    const release = acquireGameplayDragForeground();
    releases.push(release);
    release();
    release();
    expect(getGameplayDragForegroundOwnerCount()).toBe(0);
  });
});
