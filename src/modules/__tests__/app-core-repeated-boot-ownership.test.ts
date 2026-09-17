import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const appCoreSource = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');

describe('app-core repeated boot ownership', () => {
  test('reuses one stable viewport style element', () => {
    expect(appCoreSource).toContain("const viewportStyleId = 'cc-app-core-viewport-style'");
    expect(appCoreSource).toContain('document.getElementById(viewportStyleId)');
    expect(appCoreSource).toContain('style.id = viewportStyleId');
  });

  test('cleans the previous drag owner before installing its replacement', () => {
    const cleanupIndex = appCoreSource.indexOf("(drag as any).cleanup?.({ resumeIdle: false })");
    const installIndex = appCoreSource.indexOf('const ret = installDrag({');

    expect(cleanupIndex).toBeGreaterThanOrEqual(0);
    expect(installIndex).toBeGreaterThan(cleanupIndex);
    expect(appCoreSource.slice(cleanupIndex - 120, cleanupIndex)).toContain('reuseApp && drag');
  });

  test('stops special-dice idle ownership before destroying old tiles', () => {
    const stopIndex = appCoreSource.indexOf('stopSpecialDiceIdleMotion(t)');
    const destroyIndex = appCoreSource.indexOf("t.destroy({ children: true, texture: false, textureSource: false }");
    expect(stopIndex).toBeGreaterThan(-1);
    expect(destroyIndex).toBeGreaterThan(stopIndex);
  });

  test('retires hard-reset special artwork before clearing both tile arrays', () => {
    const boot = appCoreSource.split('export async function boot(')[1]
      ?.split('// Step 4: Stop PIXI ticker', 1)[0] ?? '';
    const stopIndex = boot.indexOf('stopSpecialDiceIdleMotion(tile)');
    const tilesClearIndex = boot.indexOf('tiles.length = 0;');
    const stateTilesClearIndex = boot.indexOf('STATE.tiles.length = 0;');

    expect(boot).toContain('const staleTiles = new Set<any>');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(tilesClearIndex).toBeGreaterThan(stopIndex);
    expect(stateTilesClearIndex).toBeGreaterThan(stopIndex);
  });
});
