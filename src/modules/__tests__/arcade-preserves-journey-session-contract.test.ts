import fs from 'fs';
import path from 'path';

test('ordinary Arcade exit preserves the suspended Journey session instead of rebuilding it cold', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../main.ts'), 'utf8');
  const preserveBranch = source.indexOf('else if (isArcadeHomeRunMode())');
  const cleanupCall = source.indexOf('collectiblesManager.cleanup()', preserveBranch);

  expect(preserveBranch).toBeGreaterThan(-1);
  expect(source.slice(preserveBranch, cleanupCall)).toContain(
    'Preserving suspended Journey DOM/assets across Arcade exit',
  );
});
