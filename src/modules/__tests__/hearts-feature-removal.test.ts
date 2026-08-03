import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');

describe('removed Hearts feature', () => {
  test('does not ship Hearts runtime modules or product hooks', () => {
    for (const file of [
      'src/modules/hearts-system.ts',
      'src/modules/hearts-bottom-sheet.ts',
      'src/modules/lives-manager.ts',
    ]) {
      expect(fs.existsSync(path.join(root, file))).toBe(false);
    }

    const sourceFiles = [
      'src/collectibles-manager.ts',
      'src/modules/app-core.ts',
      'src/modules/board-fail-modal.ts',
      'src/modules/endgame-hint.ts',
      'src/ui/components/collectibles-screen.ts',
      'src/style.css',
      'src/collectibles-screen.css',
    ];

    for (const file of sourceFiles) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      expect(source).not.toMatch(/hearts-system|hearts-bottom-sheet|lives-manager|journey-lives|no-hearts/i);
    }
  });
});
