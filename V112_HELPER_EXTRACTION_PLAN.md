# 🔧 V112: Izdvajanje Helper Funkcija iz app-core.ts

**Datum:** 2025-12-27  
**Verzija:** v112  
**Cilj:** Izdvojiti helper i utility funkcije bez uništavanja logike

---

## 📊 ANALIZA FUNKCIJA

### Kategorije funkcija u app-core.ts:

#### 1. **Utility Funkcije** (app-core-utils.ts)
- `boardSize()` - vraća board dimenzije
- `cellXY(c, r)` - vraća cell koordinate
- `randVal()` - random vrijednost za tiles
- `sleep(ms)` - sleep utility
- `pickWildValue(dstValue)` - bira wild vrijednost
- `createEmptyGrid()` - kreira prazan grid

#### 2. **Memory Management Helper Funkcije** (app-core-utils.ts)
- `trackAppTimeout()` - track timeout
- `clearAllAppTimeouts()` - clear all timeouts
- `trackAppAnimationFrame()` - track RAF
- `clearAllAppAnimationFrames()` - clear all RAF
- `trackAppInterval()` - track interval
- `clearAllAppIntervals()` - clear all intervals

#### 3. **HUD Helper Funkcije** (app-core-helpers.ts)
- `hudSetCombo(v)` - set combo
- `hudResetCombo()` - reset combo
- `animateScore(toValue, duration)` - animate score
- `animateBoardHUD(toValue, duration)` - animate board HUD

#### 4. **Wild Meter Helper Funkcije** (app-core-helpers.ts)
- `setWildProgress(ratio, animate)` - set wild progress
- `addWildProgress(amount)` - add wild progress
- `resetWildProgress(value, animate)` - reset wild progress
- `queueWildSpawnIfNeeded()` - queue wild spawn
- `scheduleWildRescue(reason, requested)` - schedule rescue
- `spawnWildFromMeter()` - spawn wild from meter
- `ensureNonWildTile(reason)` - ensure non-wild tile

#### 5. **Combo Helper Funkcije** (app-core-helpers.ts)
- `killComboTimer()` - kill combo timer
- `scheduleComboDecay()` - schedule combo decay

#### 6. **Board Rendering Helper Funkcije** (app-core-helpers.ts)
- `drawBoardBG(mode)` - draw board background
- `pulseBoardZoom(factor, opts)` - pulse board zoom
- `initializeBackgroundLayer()` - init background layer
- `setGhostVisibility(c, r, visible)` - set ghost visibility
- `updateGhostVisibility()` - update ghost visibility
- `updateAllGhostPlaceholders()` - update all ghosts
- `fixHoverAnchor(t)` - fix hover anchor
- `resetBoardContainer()` - reset board container

#### 7. **Tile Helper Funkcije** (app-core-helpers.ts)
- `tintLocked(t)` - tint locked tile
- `applyWildSkinLocal(tile)` - apply wild skin
- `addElectricGlow(tile)` - add electric glow
- `bindTileWithFallback(tile, skipBind)` - bind tile
- `openAtCell(c, r, opts)` - open at cell
- `randomEmptyCell()` - random empty cell

#### 8. **State Management Helper Funkcije** (app-core-helpers.ts)
- `syncSharedState()` - sync shared state
- `getReactiveActiveTiles()` - get active tiles
- `saveGameState()` - save game state
- `loadGameState()` - load game state
- `debouncedSaveGameState(delayMs)` - debounced save

#### 9. **Asset Loading Helper Funkcije** (app-core-helpers.ts)
- `ensureFonts()` - ensure fonts loaded
- `loadFirstTexture(paths)` - load first texture

---

## 🎯 PLAN IZDVAJANJA

### Faza 1: Utility Funkcije (app-core-utils.ts)
- ✅ Kreirati `app-core-utils.ts`
- ✅ Izdvojiti utility funkcije (boardSize, cellXY, randVal, sleep, pickWildValue, createEmptyGrid)
- ✅ Izdvojiti memory management funkcije
- ✅ Exportovati sve funkcije
- ✅ Importovati u app-core.ts

### Faza 2: Helper Funkcije (app-core-helpers.ts)
- ⏳ Kreirati `app-core-helpers.ts`
- ⏳ Izdvojiti HUD helper funkcije
- ⏳ Izdvojiti wild meter helper funkcije
- ⏳ Izdvojiti combo helper funkcije
- ⏳ Izdvojiti board rendering helper funkcije
- ⏳ Izdvojiti tile helper funkcije
- ⏳ Izdvojiti state management helper funkcije
- ⏳ Izdvojiti asset loading helper funkcije
- ⏳ Exportovati sve funkcije
- ⏳ Importovati u app-core.ts

### Faza 3: Core Funkcije (ostaju u app-core.ts)
- ⏳ `boot()` - initialization
- ⏳ `startLevel(n)` - start level
- ⏳ `merge(src, dst, helpers)` - merge logic
- ⏳ `checkLevelEnd()` - check level end
- ⏳ `checkMovesDepleted()` - check moves
- ⏳ `showFinalScreen()` - show final screen
- ⏳ `restartGame()` - restart game
- ⏳ `triggerCleanBoardFlow()` - clean board flow
- ⏳ `rebuildBoard()` - rebuild board
- ⏳ `removeTile(t)` - remove tile
- ⏳ `openLockedBounceParallel(k)` - open locked

---

## ⚠️ UPOZORENJA

1. **Globalne varijable** - helper funkcije koriste globalne varijable (tiles, grid, score, etc.)
   - **Rješenje:** Proslijediti kao parametre ili koristiti STATE objekat

2. **Zavisnosti** - helper funkcije koriste druge funkcije iz app-core.ts
   - **Rješenje:** Proslijediti kao parametre ili koristiti callback funkcije

3. **GSAP/PIXI** - helper funkcije koriste GSAP i PIXI
   - **Rješenje:** Importovati u helper fajlove

4. **Logika** - ne mijenjati logiku, samo reorganizovati

---

## 📝 SLJEDEĆI KORACI

1. ⏳ Kreirati `app-core-utils.ts` sa utility funkcijama
2. ⏳ Kreirati `app-core-helpers.ts` sa helper funkcijama
3. ⏳ Importovati u `app-core.ts`
4. ⏳ Testirati da li sve radi
5. ⏳ Dokumentovati promjene

---

**Status:** Plan kreiran, spremno za izdvajanje

