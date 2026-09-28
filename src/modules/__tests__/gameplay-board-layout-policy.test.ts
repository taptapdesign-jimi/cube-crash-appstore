import { shouldIgnoreSettledMobileBoardResize } from '../gameplay-board-layout-policy';
import fs from 'fs';
import path from 'path';

describe('settled mobile board layout policy', () => {
  const base = {
    isResizeEvent: true,
    isMobileDevice: true,
    isEntryPending: false,
    isSurfaceVisible: true,
  };

  test('ignores a late mobile resize after the visible board has settled', () => {
    expect(shouldIgnoreSettledMobileBoardResize(base)).toBe(true);
  });

  test.each([
    ['entry-time resize', { isEntryPending: true }],
    ['hidden preparation resize', { isSurfaceVisible: false }],
    ['explicit layout request', { isResizeEvent: false }],
    ['desktop resize', { isMobileDevice: false }],
  ])('allows %s', (_label, change) => {
    expect(shouldIgnoreSettledMobileBoardResize({ ...base, ...change })).toBe(false);
  });

  test('commits board geometry once after asynchronous HUD measurements settle', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../app-core.ts'), 'utf8');
    const layoutSource = source.slice(
      source.indexOf('export async function layoutBoard'),
      source.indexOf('// 🔥 v112: Utility functions moved', source.indexOf('export async function layoutBoard')),
    );
    const commit = "board.scale.set(s, s);\n  board.x = boardX;\n  board.y = boardY;";

    expect(layoutSource.split(commit)).toHaveLength(2);
    expect(layoutSource.indexOf(commit)).toBeGreaterThan(layoutSource.indexOf("HUD.layout({ app, top: safeTop });"));
    expect(layoutSource).not.toContain('board.scale.set(s2, s2)');
  });
});
