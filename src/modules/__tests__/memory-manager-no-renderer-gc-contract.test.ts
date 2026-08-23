import fs from 'fs';
import path from 'path';

test('generic periodic memory monitoring never owns Pixi renderer texture GC', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../memory-manager.ts'), 'utf8');

  expect(source).not.toContain('textureGC');
  expect(source).not.toContain("container.get('app')");
  expect(source).not.toContain('cleanupMainApp()');
});
