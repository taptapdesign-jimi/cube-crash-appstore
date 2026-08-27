import fs from 'fs';
import path from 'path';

test('ordinary menu exit suspends the Pixi renderer instead of destroying its WebGL session', () => {
  const core = fs.readFileSync(path.resolve(__dirname, '../app-core.ts'), 'utf8');
  const main = fs.readFileSync(path.resolve(__dirname, '../../main.ts'), 'utf8');

  expect(core).toContain('export function cleanupGame(options: { destroyRenderer?: boolean } = {})');
  expect(core).toContain('const destroyRenderer = options.destroyRenderer !== false;');
  expect(core).toContain('if (app && destroyRenderer)');
  expect(core).toContain('PIXI renderer session suspended for menu reuse');
  expect(core).toContain("app.canvas.style.visibility = 'hidden'");
  expect(core).toContain('drag = null as any');
  expect(core).toContain('if (!reuseApp) app.ticker.add(onFirstFrame);');
  expect(core).toContain('installMobileSaveLifecycle({ saveGameState, trackAppTimeout });');
  expect(core).toContain('cleanupMobileSaveLifecycle({ log: devLog, warn: devWarn });');
  expect(main).toContain('cleanupGame({ destroyRenderer: false });');
  expect(main).not.toContain('canvas.remove();');
});
