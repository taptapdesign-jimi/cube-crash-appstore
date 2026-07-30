import {
  FINAL_MERGE_RUNTIME_FALLBACK_MS,
  FINAL_MERGE_RUNTIME_PROTECTION_MS,
  findRecentFinalMergeRuntime,
  getFinalMergeRuntimeSnapshot,
  isFinalMergeRuntimeTileProtected,
  markFinalMergeRuntime,
  type FinalMergeRuntimeFx,
} from '../final-merge-runtime-guard';

const ALL_FINAL_MERGE_FX: FinalMergeRuntimeFx[] = [null, 'star', 'juice', 'tnt', 'magnet'];

test.each(ALL_FINAL_MERGE_FX)('protects a fresh %s final merge runtime', (finaleFx) => {
  const tile: Record<string, unknown> = { _ccFinalMergeAllowedByResolver: true };
  markFinalMergeRuntime(tile, finaleFx, 1000);

  expect(isFinalMergeRuntimeTileProtected(tile, 1000 + FINAL_MERGE_RUNTIME_PROTECTION_MS)).toBe(true);
  expect(getFinalMergeRuntimeSnapshot(tile, 1001)?.finaleFx).toBe(finaleFx);
});

test('does not protect stale legacy magnet residue without a runtime marker', () => {
  const tile = {
    value: 6,
    _ccFinalMergeAllowedByResolver: true,
    _wasWildMagnetMerge6: true,
    _noTilesPulled: true,
  };

  expect(isFinalMergeRuntimeTileProtected(tile, 2000)).toBe(false);
});

test('allows bounded recovery while retaining the exact finale type for fallback', () => {
  const tile: Record<string, unknown> = { _ccFinalMergeAllowedByResolver: true };
  markFinalMergeRuntime(tile, 'magnet', 1000);
  const afterProtection = 1001 + FINAL_MERGE_RUNTIME_PROTECTION_MS;

  expect(isFinalMergeRuntimeTileProtected(tile, afterProtection)).toBe(false);
  expect(findRecentFinalMergeRuntime([tile], afterProtection)?.finaleFx).toBe('magnet');
  expect(findRecentFinalMergeRuntime([tile], 1001 + FINAL_MERGE_RUNTIME_FALLBACK_MS)).toBeNull();
});

test('rejects destroyed tiles and non-final resolver decisions', () => {
  const destroyed: Record<string, unknown> = { destroyed: true, _ccFinalMergeAllowedByResolver: true };
  const nonFinal: Record<string, unknown> = { _ccFinalMergeAllowedByResolver: false };
  markFinalMergeRuntime(destroyed, 'star', 1000);
  markFinalMergeRuntime(nonFinal, 'juice', 1000);

  expect(isFinalMergeRuntimeTileProtected(destroyed, 1001)).toBe(false);
  expect(isFinalMergeRuntimeTileProtected(nonFinal, 1001)).toBe(false);
});
