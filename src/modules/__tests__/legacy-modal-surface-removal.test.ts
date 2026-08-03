import fs from 'node:fs';
import path from 'node:path';

describe('removed legacy modal surfaces', () => {
  const root = process.cwd();

  test('does not ship unreachable Pause, duplicate End Run, or global Resume UI systems', () => {
    for (const relativePath of [
      'src/modules/pause-modal.ts',
      'src/modules/pause-ui.ts',
      'src/modules/pause-animations.ts',
      'src/modules/end-run-ui.ts',
      'src/modules/end-run-animations.ts',
    ]) {
      expect(fs.existsSync(path.join(root, relativePath))).toBe(false);
    }

    const appCore = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');
    const windowTypes = fs.readFileSync(path.join(root, 'src/types/window.d.ts'), 'utf8');
    const appCss = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
    const pauseUtils = fs.readFileSync(path.join(root, 'src/modules/pause-utils.ts'), 'utf8');

    expect(appCore).not.toMatch(/showResumeGameModal|Resume game\?/);
    expect(windowTypes).not.toContain('showResumeGameModal');
    expect(appCss).not.toMatch(/#pause-overlay|\.pause-modal-btn|\.pause-card|\.end-run-actions|\.end-run-bottom-sheet/);
    expect(pauseUtils).not.toMatch(/getModalButtonOptions|executeModalCallback|pause-modal-/);
  });
});
