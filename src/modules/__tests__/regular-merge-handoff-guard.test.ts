import fs from 'node:fs';
import path from 'node:path';
import { shouldBlockMergeDuringRegularHandoff } from '../regular-merge-handoff-guard';

const repoRoot = path.resolve(__dirname, '../../..');

describe('regular merge handoff entry guard', () => {
  test.each([
    ['core star', { special: 'wild' }],
    ['cubero', { special: 'wild', _ccSpecialDiceVariant: 'cubero' }],
    ['core juice', { special: 'wild-juice' }],
    ['mushroom', { special: 'wild-juice', _ccSpecialDiceVariant: 'mushroom' }],
    ['beach ball', { special: 'wild-juice', _ccSpecialDiceVariant: 'ball' }],
    ['core magnet', { special: 'wild-magnet' }],
    ['bottle', { special: 'wild-magnet', _ccSpecialDiceVariant: 'bottle' }],
    ['honey', { special: 'wild-magnet', _ccSpecialDiceVariant: 'honey' }],
    ['core TNT', { special: 'wild-tnt' }],
    ['flower', { special: 'wild-tnt', _ccSpecialDiceVariant: 'flower' }],
  ])('blocks %s while a prior regular absorb owns the board', (_name, src) => {
    expect(shouldBlockMergeDuringRegularHandoff(true, src, { value: 2 })).toBe(true);
  });

  test('also serializes a second ordinary drag until the accepted stack commits', () => {
    expect(shouldBlockMergeDuringRegularHandoff(true, { value: 1 }, { value: 1 })).toBe(true);
    expect(shouldBlockMergeDuringRegularHandoff(false, { value: 1 }, { value: 1 })).toBe(false);
  });

  test('allows only Magnet-owned internal pulled-tile consolidation', () => {
    const pulled = { _wildMagnetAffected: true };
    expect(shouldBlockMergeDuringRegularHandoff(true, pulled, pulled)).toBe(false);
    expect(shouldBlockMergeDuringRegularHandoff(true, pulled, { value: 2 })).toBe(true);
  });

  test('guards both hover/drop eligibility and merge entry before mutation', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const canDropStart = source.indexOf('canDrop: (s, d) =>');
    const canDropEnd = source.indexOf('hoverColor:', canDropStart);
    const canDrop = source.slice(canDropStart, canDropEnd);
    expect(canDrop).toContain('shouldBlockMergeDuringRegularHandoff(regularMergeHandoffTokens.size > 0, s, d)');

    const mergeStart = source.indexOf('function merge(src: Tile, dst: Tile');
    const firstMutation = source.indexOf('grid[src.gridY][src.gridX] = null', mergeStart);
    const mergeEntry = source.slice(mergeStart, firstMutation);
    expect(mergeEntry).toContain('shouldBlockMergeDuringRegularHandoff(regularMergeHandoffTokens.size > 0, src, dst)');
    expect(mergeEntry).toContain("helpers.snapBack?.(src)");
  });
});
