import fs from 'fs';
import path from 'path';

describe('Magnet Star-to-HUD ownership', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/app-merge.ts'),
    'utf8',
  );

  test('one Magnet transaction schedules one bounded, consolidated Star batch', () => {
    expect(source).toContain('const magnetStarPayload = [');
    expect(source).toMatch(/\]\s*\.filter\([\s\S]*?\)\.slice\(0, 3\)/);
    expect(source).toContain('magnetStarPayload,');
    expect(source.match(/await animateStarsToHudIcon\(/g)).toHaveLength(1);
  });
});
