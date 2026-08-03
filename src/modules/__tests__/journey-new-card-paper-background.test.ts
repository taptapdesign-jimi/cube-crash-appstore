import fs from 'node:fs';
import path from 'node:path';

describe('Journey New Reward paper background', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/journey-new-card-screen.ts'),
    'utf8',
  );

  test('uses the canonical full-screen app paper instead of a local background recipe', () => {
    expect(source).toContain("import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js'");
    expect(source).toContain('applyAppPaperSurfaceToElement(overlay)');
    expect(source).not.toContain("url('./assets/paper-bg.png') center / 100% 100% no-repeat");
    expect(source).not.toContain('linear-gradient(rgba(243,238,232,0.65)');
  });
});
