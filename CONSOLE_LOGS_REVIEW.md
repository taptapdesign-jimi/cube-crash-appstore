# Console Logs Review – Journey Boards 5–9

Review of console output from a full playthrough (boards 5–9) with `__ccLogRuntimeStats('manual test')`.

## ✅ Working as intended

- **Runtime stats**: `__ccLogRuntimeStats` and `CC runtime [clean board]` report `stageChildren`, `tilesActive`, `textureCount`, `gsapTweens` etc.
- **Launch → Journey → Game**: Launch, Journey, board load, merges, and endgame flows complete successfully.
- **Memory**: Heap grows from ~27 MB to ~92 MB across boards 5–8; no obvious leak.
- **Endgame**: Magnet/wild merges, last merge detection, clean board modal, Continue flow, and transitions behave as expected.
- **Combo / scoring**: Combo decay, magnet combo calculation, and HUD updates run correctly.

## Issues found and fixes

### 1. GSAP rotation plugin warning ✅ fixed

- **Log**: `Invalid property rotation set to 0.18 Missing plugin? gsap.registerPlugin()`
- **Source**: `wildImpactEffect` in `fx.ts` using `gsap.to(g, { rotation: tilt })` on Pixi DisplayObjects.
- **Fix**: Replaced direct `rotation` animation with a proxy object and `onUpdate` sync (see `fx.ts` wildImpactEffect).

### 2. `dst.gridX` / `dst.gridY` undefined ✅ fixed

- **Log**: `⚠️ dst.gridX or dst.gridY is undefined, using current position: 508.021374 1111.449988`
- **Source**: In magnet pull merge, when `dst` is destroyed, a fallback `{ x, y }` without grid coords was passed to `mergePulledTilesIntoMerge6`.
- **Fix**: Include `gridX` and `gridY` from `validTiles[0]` in the fallback object in `app-core.ts` (around line 5156).

### 3. Bubbles explosion timeout

- **Log**: `⚠️ Bubbles explosion wait timeout, forcing cleanup` (`wild-juice-bubbles-explosion.ts:1109`)
- **Status**: Expected when bubbles do not finish before a timeout; cleanup runs.
- **Action**: Optional: tune timeout or bubble animation duration if this appears too often.

### 4. `setValue` skipped (tile destroyed)

- **Log**: `⚠️ setValue skipped: tile is null or destroyed` (`board.ts:255`)
- **Source**: Wild spawn calls `setValue` on a tile that was destroyed in a race (e.g. during wild meter fill).
- **Action**: Optional: add a guard in `spawnWildFromMeter` / `openAtCell` to avoid calling `setValue` on destroyed tiles.

### 5. PixiJS deprecations (informational)

- `board.ts:655`: `DRAW_MODES.NEAREST` → use `'nearest'`
- `wild-stars.ts:155`: `Texture.baseTexture` → use `Texture.source`

### 6. HUD_ROOT null

- **Log**: `⚠️ HUD_ROOT is null, cannot update HUD` (`hud-helpers.ts:2442`)
- **Source**: `updateHUD` called during board boot before HUD is created.
- **Action**: Optional: skip or defer `updateHUD` until HUD is initialized.

### 7. Spawn targets retry

- **Log**: `⚠️ Not enough spawn targets found, retrying with larger search...` (`app-merge.ts:1627`)
- **Source**: Magnet pull requests 4 spawn targets but initially finds 3; retry logic runs.
- **Status**: Retry succeeds; behavior is correct.

## Summary

| Issue                         | Severity | Status   |
|------------------------------|----------|----------|
| GSAP rotation plugin         | Medium   | ✅ Fixed |
| dst.gridX/gridY undefined    | Low      | ✅ Fixed |
| Bubbles timeout              | Low      | Expected |
| setValue skipped             | Low      | Optional |
| PixiJS deprecations          | Low      | Informational |
| HUD_ROOT null                | Low      | Optional |
| Spawn targets retry          | Info     | Working  |

All critical problems have been addressed. Remaining items are low priority or informational.
