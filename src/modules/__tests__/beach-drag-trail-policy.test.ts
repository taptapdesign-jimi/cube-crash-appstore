import fs from 'node:fs';
import path from 'node:path';
import { usesRoundBubbleDragTrail } from '../special-dice-registry';

describe('Beach special-dice drag trail policy', () => {
  test('uses round bubbles only for Juice, Beach Ball, and Bottle', () => {
    expect(usesRoundBubbleDragTrail({ special: 'wild-juice' })).toBe(true);
    expect(usesRoundBubbleDragTrail({ special: 'wild-magnet', _ccSpecialDiceVariant: 'beach-ball' })).toBe(true);
    expect(usesRoundBubbleDragTrail({ special: 'wild-magnet', _ccSpecialDiceVariant: 'bottle' })).toBe(true);

    expect(usesRoundBubbleDragTrail({ special: 'wild' })).toBe(false);
    expect(usesRoundBubbleDragTrail({ special: 'wild-magnet' })).toBe(false);
    expect(usesRoundBubbleDragTrail({ special: 'wild-tnt' })).toBe(false);
    expect(usesRoundBubbleDragTrail({ special: 'wild-juice', _ccSpecialDiceVariant: 'mushroom' })).toBe(false);
    expect(usesRoundBubbleDragTrail({ special: 'wild-magnet', _ccSpecialDiceVariant: 'honey' })).toBe(false);
  });

  test('keeps the existing emitter and changes only its drawn particle geometry', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/drag-core.ts'), 'utf8');
    expect(source).toContain('const roundBubbleTrail = usesRoundBubbleDragTrail(tile)');
    expect(source).toContain('forceRectParticles: !roundBubbleTrail');
    expect(source).toContain('magicSparklesAtTile(board, tile');
    expect(source).toContain('forceCircleParticles: roundBubbleTrail');
    expect(source).not.toContain('dragRoundBubbleTrail(board, tile');

    const fxSource = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/fx.ts'), 'utf8');
    expect(fxSource).toContain('opts.forceCircleParticles === true');
    expect(fxSource).toContain('isWildJuice && opts.forceRectParticles !== true');
  });
});
