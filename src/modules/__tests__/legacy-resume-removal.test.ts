import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');

describe('removed legacy Resume Game sheet', () => {
  test('does not ship unreachable Resume Game modules, styles, or runtime hooks', () => {
    for (const file of [
      'src/modules/resume-game-bottom-sheet.ts',
      'src/modules/resume-bottom-sheet.css',
      'src/modules/resume-sheet-ui.ts',
      'src/modules/resume-sheet-utils.ts',
    ]) {
      expect(fs.existsSync(path.join(root, file))).toBe(false);
    }

    const uiManager = fs.readFileSync(path.join(root, 'src/modules/ui-manager.ts'), 'utf8');
    const appCss = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
    const endgameHint = fs.readFileSync(path.join(root, 'src/modules/endgame-hint.ts'), 'utf8');

    expect(uiManager).not.toMatch(/showResumeGameBottomSheet|checkForSavedGame/);
    expect(appCss).not.toContain('.resume-bottom-sheet');
    expect(endgameHint).not.toContain('.resume-bottom-sheet');
  });
});
