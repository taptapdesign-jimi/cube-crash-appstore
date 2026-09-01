import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../first-play-tutorial.ts'),
  'utf8',
);

describe('first-play tutorial bottom-sheet edge contract', () => {
  test('keeps a paper seal below the animated sheet so entrance overshoot cannot expose the app background', () => {
    const sealStart = source.indexOf('.first-play-tutorial-sheet::after {');
    const sealEnd = source.indexOf('\n    }', sealStart);
    const sealCss = source.slice(sealStart, sealEnd);

    expect(sealStart).toBeGreaterThan(-1);
    expect(sealCss).toContain("content: '';");
    expect(sealCss).toContain('top: calc(100% - 1px);');
    expect(sealCss).toContain('height: 96px;');
    expect(sealCss).toContain('background: inherit;');
    expect(sealCss).toContain('pointer-events: none;');
  });

  test('preserves the accepted sheet position and bounce owner', () => {
    expect(source).toContain(`.first-play-tutorial-sheet {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;`);
    expect(source).toContain("gsap.to(sheet, { y: 0, duration: 0.42, ease: 'back.out(1.25)' });");
    expect(source).toContain("y: '100%',\n    duration: 0.28,\n    ease: 'power2.in'");
  });
});
