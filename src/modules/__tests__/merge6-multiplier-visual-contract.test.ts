import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('regular merge-6 multiplier visual contract', () => {
  it('keeps the number explicitly white on its brown badge', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/fx.ts'), 'utf8');
    const start = source.indexOf('export function showMultiplierTile');
    const end = source.indexOf('export function smokeBubblesAtTile', start);
    const multiplierOwner = source.slice(start, end);

    expect(multiplierOwner).toContain("const FILL   = 0xAB806E;");
    expect(multiplierOwner).toContain("const TXT    = '#FFFFFF';");
    expect(multiplierOwner).toContain('fill: TXT');
    expect(multiplierOwner).toContain('stroke: { color: TXT_STROKE');
  });
});
