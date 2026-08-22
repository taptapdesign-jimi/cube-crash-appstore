import fs from 'node:fs';
import path from 'node:path';
import { SHADOW_COLOR } from '../constants.js';

const root = path.resolve(__dirname, '../../..');
const boardSource = fs.readFileSync(path.join(root, 'src/modules/board.ts'), 'utf8');

describe('gameplay drag shadow style', () => {
  test('uses one very light warm-brown color in every active board shadow path', () => {
    expect(SHADOW_COLOR).toBe(0xB99572);
    expect(boardSource).toContain('SHADOW_COLOR,');
    expect(boardSource).not.toContain('0xBDA38D');
    expect(boardSource.match(/color: SHADOW_COLOR/g)).toHaveLength(4);
    expect(boardSource).toContain('sh.beginFill(SHADOW_COLOR, alpha)');
  });

  test('primes the hidden shadow at zero alpha before the first drag reveal', () => {
    const shadowCreation = boardSource.split('const sh = new Graphics();')[1]
      ?.split('// board center in board-local space')[0] ?? '';

    expect(shadowCreation).toContain('sh.alpha = 0;');
    expect(shadowCreation.indexOf('sh.alpha = 0;'))
      .toBeLessThan(shadowCreation.indexOf('t.addChild(sh);'));
  });
});
