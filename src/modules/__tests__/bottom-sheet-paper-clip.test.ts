import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const appCss = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');

describe('bottom-sheet paper clipping', () => {
  test('shared paper sheets use one rounded inner surface instead of an unclipped shell background', () => {
    const sharedPaperRule = appCss.match(
      /\.simple-bottom-sheet::after\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const simpleSheetRule = appCss.match(/\.simple-bottom-sheet\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(sharedPaperRule).toContain('top: 0');
    expect(sharedPaperRule).toContain('bottom: min(-96px');
    expect(sharedPaperRule).toContain('background: var(--bottom-sheet-paper-texture)');
    expect(sharedPaperRule).toContain('border-radius: 40px 40px 0 0');
    expect(sharedPaperRule).toContain('z-index: -1');
    expect(simpleSheetRule).toContain('background: transparent');
    expect(simpleSheetRule).toContain('isolation: isolate');
  });
});
