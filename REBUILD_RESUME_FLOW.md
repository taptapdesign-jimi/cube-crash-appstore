# Rebuild / Resume flow (nakon refaktora)

## Gdje što živi

| Što | Lokacija | Napomena |
|-----|----------|----------|
| **Save (tijekom igre)** | `app-core.ts` → `saveGameState()` | Piše u `getBoardSaveKey(boardNumber)` (board-specific). |
| **Format savea** | `app-core-save-state.ts` (buildSaveState), `app-core-save-tiles.ts` (buildGridSnapshot) | Sprema `.grid`, ne `.tiles`. |
| **Load save (čitati iz LS)** | `app-core-load-save.ts` → `loadSavedBoardState()` | Čita board-specific key, 7-day expiry. |
| **loadGameState** | `app-core.ts` (funkcija) | Zove `loadSavedBoardState`, `restoreTilesFromSave`, itd. Na `window.loadGameState` se stavlja na **top-level** modula (lin. ~8359), **ne** u boot(). |
| **rebuildBoard** | `app-core.ts` (lokalna funkcija) | Koristi refaktorirane module (prepareBoardForRebuild, createAndOpenBoard, …). Na `window.rebuildBoard` se stavlja **unutar boot()** (lin. ~1859). |
| **startLevel** | `app-core.ts` | Na `window.startLevel` u boot(). U startLevel() se zove `maybeRebuildBoard()` koji gleda `__ccSkipRebuildBoard`. |
| **maybeRebuildBoard** | `app-core-startlevel-rebuild.ts` | Ako `__ccSkipRebuildBoard` → skip rebuild; inače `rebuildBoard()`. |
| **Journey: priprema savea** | `journey-boards-manager.ts` (Step 8) | Čita iz `getBoardSaveKey(board.id)`, piše u **isti** key (`boardSaveKey`) da main i loadGameState vide isti save. |
| **main: continueGameWithSavedState** | `main.ts` | `boardToLoad = __ccStartAtLevel || currentRunState?.boardId || 1`, `saveKey = getBoardSaveKey(boardToLoad)`, čita save. Ako null → fallback na `cc_saved_game` i migracija u board-specific. Zatim `bootGame()` → pa `loadGameState(savedBoardNumber)` ako `canLoadState && __ccSkipRebuildBoard`. |
| **boot()** | `app-core.ts` | Čita `window.__ccStartAtLevel`, briše ga, pozove `startLevel(forcedStartLevel)`. Ne briše `__ccSkipRebuildBoard`. |

## Redoslijed (Journey → nastavak)

1. Korisnik u Journeyu odabere ploču (npr. board 3).
2. **journey-boards-manager**: čita `cc_saved_game_board_03`, ako ima tiles/grid → piše ažurirani state u **isti** key (`boardSaveKey`), postavi `__ccSkipRebuildBoard`, `__ccStartAtLevel = 3`, pozove `continueGameWithSavedState()`.
3. **main**: `boardToLoad = 3`, `savedGame = localStorage.getItem(cc_saved_game_board_03)` (ili fallback s `cc_saved_game`). Parsira, `canLoadState = hasTiles || hasGrid`, postavi `__ccStartAtLevel = 3`, `bootGame()`.
4. **boot()**: vidi `__ccStartAtLevel = 3`, briše ga, `startLevel(3)`.
5. **startLevel(3)**: `maybeRebuildBoard()` vidi `__ccSkipRebuildBoard` → **ne** zove `rebuildBoard()`. Ostalo (saveAfterBoardStart, layout, …) se izvodi.
6. **main** (nakon boot): ako `canLoadState && __ccSkipRebuildBoard` → `loadGameState(3)`. U app-core, `loadGameState(3)` zove `loadSavedBoardState({ boardNumber: 3 })` → čita `cc_saved_game_board_03`, `restoreTilesFromSave`, itd.
7. **main**: `layoutGame()`, briše flagove.

## Važno

- **window.loadGameState** i **window.saveGameState** dodaju se na **top-level** app-core modula (čim se modul učitava), ne u boot().
- **window.rebuildBoard** i **window.startLevel** dodaju se **u boot()**, pa postoje tek nakon prvog `bootGame()`.
- Journey **mora** pisati u board-specific key (`getBoardSaveKey(board.id)`), inače main čita prazan key i ide u rebuild.
- **app-board.ts** ima svoj `rebuildBoard()` (koristi STATE) – koristi ga **app-merge**. main i continueGameWithSavedState koriste **window.rebuildBoard** koji je **app-core** verzija.

---

## Grid / tiles – tko što drži (nakon refaktora)

| Što | Gdje | Napomena |
|-----|------|----------|
| **STATE** | `app-state.ts` | Singleton: `STATE.grid`, `STATE.tiles`, `STATE.board`, `STATE.drag`, … |
| **app-core closure** | `app-core.ts` | `let grid = …` (lokalna varijabla), `const tiles = STATE.tiles` (isti ref kao STATE.tiles). |
| **createEmptyGrid** | `app-core-grid-helpers.ts` | Prima `setGrid` i `setStateGrid`; kreira novi 2D grid, zove oba settera, **vraća** taj grid. |
| **app-core createEmptyGrid()** | `app-core.ts` | `setGrid: (g) => { grid = g; }`, `setStateGrid: (g) => { STATE.grid = g; }` → nakon poziva i app-core `grid` i `STATE.grid` pokazuju na isti array. |
| **restoreTilesFromSave** | `app-core-load-tiles.ts` | Prima `grid`, `createEmptyGrid`, … Unutra: **mora** koristiti `gridToUse = createEmptyGrid()` i pisati u `gridToUse` (i predati `grid: gridToUse` u `createTile`), jer proslijeđeni `grid` može biti stari (prazan/sparse) ref → inače `grid[r][c] = null` baca "Cannot set properties of undefined (setting '0')". |
| **board.ts createTile** | `board.ts` | Radi `tiles.push(t)` i `grid[r][c] = t` na predanim `grid`/`tiles` – mora dobiti isti grid koji restore puni. |
| **install-drag getGrid** | app-core → install-drag | `getGrid: () => grid` – drag koristi app-core `grid`; nakon load to je već grid iz createEmptyGrid. |

---

## Struktura modula (glavni ulazi)

- **main.ts** – entry: uvozi `boot`, `layoutBoard` iz app-core; `getBoardSaveKey` iz board-save-utils; fx/hud/drag iz refaktoriranih modula (fx-visual-effects, fx-animations, hud-core, drag-core).
- **app-core.ts** – i dalje uvozi **fx.ts**, **hud-helpers.ts**, **install-drag.ts** (ne fx-visual-effects / hud-core). Drži grid/tiles u closureu i sinkronizira s STATE preko createEmptyGrid settera.
- **app-state.ts** – jedan STATE objekt; grid/tiles/board/drag.
- **app-board.ts** – koristi **STATE** (STATE.grid, STATE.tiles, STATE.board); `rebuildBoard()` ovdje koristi app-merge; app-core ima **svoju** `rebuildBoard` u closureu koja koristi svoj grid/tiles.
- **Load chain**: loadGameState (app-core) → loadSavedBoardState (app-core-load-save) → restoreTilesFromSave (app-core-load-tiles) → createEmptyGrid() + gridToUse + createTile(gridToUse).
