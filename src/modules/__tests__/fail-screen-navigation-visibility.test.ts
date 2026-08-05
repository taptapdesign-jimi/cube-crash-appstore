import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const navigationSource = fs.readFileSync(
  path.join(root, 'src/modules/navigation-control.ts'),
  'utf8',
);
const appCoreSource = fs.readFileSync(path.join(root, 'src/modules/app-core.ts'), 'utf8');

describe('Fail-screen Homepage navigation isolation', () => {
  test('keeps the complete Homepage navigation hidden from the first Fail overlay frame', () => {
    const failBranch = navigationSource.split(
      "const boardFailModal = document.getElementById('cc-board-fail-overlay');",
    )[1]?.split('// Gameplay always excludes Homepage navigation.')[0] ?? '';

    expect(failBranch).toContain('if (boardFailModalVisible)');
    expect(failBranch).toContain("navElement.style.display = 'none'");
    expect(failBranch).toContain("navElement.style.visibility = 'hidden'");
    expect(failBranch).toContain("navElement.style.opacity = '0'");
    expect(failBranch).not.toContain("navElement.style.display = 'block'");
    expect(failBranch).not.toContain('10000000000001');
  });

  test('no-moves handoff does not ask Homepage navigation to update before Fail DOM exists', () => {
    const failFlow = appCoreSource.split('async function showFinalScreen')[1]
      ?.split('let result = null;')[0] ?? '';

    expect(failFlow).not.toContain("import('./navigation-control.js')");
    expect(failFlow).not.toContain('updateNavigationVisibility()');
  });
});
