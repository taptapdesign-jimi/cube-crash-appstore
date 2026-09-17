import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { logger, LogLevel } from '../../core/logger.js';

test('actual merge diagnostic traversal is absent at WARN, retained at DEBUG, without changing resolver finality', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/modules/app-core.ts'), 'utf8');
  const start = source.indexOf('        const debugLastMerge = logger.isEnabled(LogLevel.DEBUG);');
  const end = source.indexOf('        if (isLastMergeInOnComplete) {', start);
  const segment = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const run = new Function('logger', 'LogLevel', 'getReactiveActiveTiles', 'collectBoardGameplayTiles',
    'src', 'dst', 'srcSpecial', 'dstSpecial', 'isWildLikeSpecial', 'isSpecialDiceMagnetLikeTile',
    'isFinalMergeByResolver', 'isLastMergeInOnComplete', 'isFinalRegularMerge6Snapshot', 'devLog',
    'setPendingCleanBoard', 'boardNumber', 'devWarn', 'dstStillExists', 'busyEnding', segment);
  for (const debug of [false, true]) {
    if (debug) (window as any).__ccLogger.showAll();
    else (window as any).__ccLogger.showWarnings();
    const dst = { value: 6, _isLastMerge: false };
    const collect = jest.fn(() => [dst]);
    const pending = jest.fn();
    run(logger, LogLevel, (tiles: any[]) => tiles, collect, { value: 3 }, dst, null, null,
      () => false, () => false, true, false, false, jest.fn(), pending, 7, jest.fn(), true, false);
    expect(collect).toHaveBeenCalledTimes(debug ? 1 : 0);
    expect(dst._isLastMerge).toBe(true);
    expect(pending).toHaveBeenCalledWith(7);
  }
  (window as any).__ccLogger.showWarnings();
});
