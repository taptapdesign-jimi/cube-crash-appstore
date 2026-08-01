import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const appCss = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
const resumeCss = fs.readFileSync(path.join(root, 'src/modules/resume-bottom-sheet.css'), 'utf8');
const rewardUiSource = fs.readFileSync(path.join(root, 'src/modules/collectible-reward-ui.ts'), 'utf8');

describe('bottom-sheet paper clipping', () => {
  test('shared paper sheets use one rounded inner surface instead of an unclipped shell background', () => {
    const sharedPaperRule = appCss.match(
      /\.simple-bottom-sheet::after,\s*\.hearts-bottom-sheet::after,\s*\.collectible-reward-bottom-sheet::after\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    const simpleSheetRule = appCss.match(/\.simple-bottom-sheet\s*\{([^}]*)\}/)?.[1] ?? '';
    const heartsSheetRule = appCss.match(/\.hearts-bottom-sheet\s*\{([^}]*)\}/)?.[1] ?? '';
    const rewardSheetRule = appCss.match(/\.collectible-reward-bottom-sheet\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(sharedPaperRule).toContain('top: 0');
    expect(sharedPaperRule).toContain('bottom: min(-96px');
    expect(sharedPaperRule).toContain('background: var(--bottom-sheet-paper-texture)');
    expect(sharedPaperRule).toContain('border-radius: 40px 40px 0 0');
    expect(sharedPaperRule).toContain('z-index: -1');
    [simpleSheetRule, heartsSheetRule, rewardSheetRule].forEach((rule) => {
      expect(rule).toContain('background: transparent');
      expect(rule).toContain('isolation: isolate');
    });
  });

  test('resume and legacy reward surfaces do not paint a rectangular shadow beyond rounded corners', () => {
    const resumeSheetRule = resumeCss.match(/\.resume-bottom-sheet\s*\{([^}]*)\}/)?.[1] ?? '';
    const resumePaperRule = resumeCss.match(/\.resume-bottom-sheet::after\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(resumeSheetRule).toContain('background: transparent');
    expect(resumeSheetRule).toContain('box-shadow: none');
    expect(resumeSheetRule).toContain('isolation: isolate');
    expect(resumePaperRule).toContain('border-radius: 40px 40px 0 0');
    expect(resumePaperRule).toContain('z-index: -1');
    expect(rewardUiSource).not.toContain('box-shadow: 0 -30px 45px rgba(0, 0, 0, 0.42)');
  });
});
