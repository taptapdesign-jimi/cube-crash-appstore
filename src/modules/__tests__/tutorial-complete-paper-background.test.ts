import fs from 'node:fs';
import path from 'node:path';

describe('Tutorial Complete paper background', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/tutorial-complete-modal.ts'),
    'utf8',
  );

  test('uses the canonical full-screen app paper instead of its old local recipe', () => {
    expect(source).toContain("import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js'");
    expect(source).toContain('applyAppPaperSurfaceToElement(overlay)');
    expect(source).not.toContain('linear-gradient(rgba(243,238,232,0.65)');
    expect(source).not.toContain('radial-gradient(ellipse at center, rgba(255,255,255,0.88)');
  });
});

