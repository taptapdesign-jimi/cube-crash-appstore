# 🎯 END GAME SCENARIOS - COMPREHENSIVE ANALYSIS

## ✅ FIXED CRITICAL BUGS

### 1. Wild + Merge 6 Detection (v34)
**Bug**: `anyMergePossible` in `board.ts` excluded merge 6 from mergeable tiles
- **Location**: `board.ts` line 466
- **Was**: `return value > 0 && value < 6;`
- **Fixed**: `return value > 0 && value <= 6;`
- **Impact**: Wild + merge 6 was incorrectly marked as "stuck" → immediate fail screen

### 2. Locked Tiles During Spawn (v34)
**Bug**: `checkLevelEnd()` was called while tiles were still locked/animating
- **Location**: `app-core.ts` lines 3830-3849
- **Fix**: Skip `checkLevelEnd()` if any locked active tiles exist
- **Impact**: Prevented premature fail screen during spawn animations

### 3. STUCK PROTECTION with Wild/Magnet (v34)
**Bug**: STUCK PROTECTION timer could trigger fail screen even with wild/magnet on board
- **Location**: `app-core.ts` lines 2107-2120
- **Fix**: Skip fail screen if wild/magnet exists OR locked tiles are animating
- **Impact**: Prevented premature fail screen when player still has wild/magnet moves

---

## 📋 ALL END GAME SCENARIOS

### **SUCCESS SCENARIOS (Clean Board)**

#### 1.1 Simple Merge 6 Clean
- **Board**: 1 tile (merge 6)
- **Action**: Merge 6 removed by game
- **Expected**: Clean board screen ✅
- **Status**: WORKING

#### 1.2 Wild + Tile Clean (2 tiles total)
- **Board**: wild star + tile
- **Action**: Merge wild + tile → merge 6 → removed
- **Expected**: Clean board screen ✅
- **Status**: WORKING

#### 1.3 Magnet + Tile Clean (2 tiles total, no pull)
- **Board**: magnet + tile
- **Action**: Merge magnet + tile → merge 6 → removed
- **Expected**: Clean board screen ✅
- **Status**: WORKING

---

### **CONTINUE SCENARIOS (Game Continues)**

#### 2.1 Wild + 2 Tiles (3 tiles total)
- **Board**: wild + tile1 + tile2
- **Action**: Merge wild + tile1 → merge 6
- **Expected**: 
  - Merge 6 animations play ✅
  - Spawn 2 new tiles (combinedCount = 2) ✅
  - Board: merge 6 + tile2 + 2 new tiles ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v33)

#### 2.2 Wild + Tile + Magnet (3 tiles total)
- **Board**: wild + tile + magnet
- **Action**: Merge wild + tile → merge 6
- **Expected**:
  - Merge 6 animations play ✅
  - Spawn 1 new tile ✅
  - Board: merge 6 + magnet + 1 new tile ✅
  - checkLevelEnd() skipped (magnet present) ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v32.4)

#### 2.3 Regular Merge + Wild on Board
- **Board**: tile1(2) + tile2(4) + wild
- **Action**: Merge tile1 + tile2 → merge 6
- **Expected**:
  - Merge 6 animations play ✅
  - Spawn 2 new tiles ✅
  - Board: merge 6 + wild + 2 new tiles ✅
  - `anyMergePossible` detects wild can merge with merge 6 ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v34)

#### 2.4 Magnet + Tile Pulls Another Magnet
- **Board**: magnet1 + tile + magnet2
- **Action**: Merge magnet1 + tile → pulls magnet2 → merge 6
- **Expected**:
  - Magnet pull animation ✅
  - Merge 6 created ✅
  - Spawn 1 new tile ✅
  - checkLevelEnd() called after spawn ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v32.5)

#### 2.5 Magnet + Tile Pulls Wild
- **Board**: magnet + tile + wild
- **Action**: Merge magnet + tile → pulls wild → merge 6
- **Expected**:
  - Magnet pull animation ✅
  - Merge 6 created ✅
  - Spawn 1 new tile ✅
  - Game continues ✅
- **Status**: WORKING

#### 2.6 Wild + Merge 6
- **Board**: wild + merge 6
- **Action**: Player can drag wild onto merge 6
- **Expected**:
  - `anyMergePossible` returns TRUE ✅
  - `isGameStuck` returns FALSE ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v34 - critical fix in board.ts)

#### 2.7 Magnet + Merge 6
- **Board**: magnet + merge 6
- **Action**: Player can drag magnet onto merge 6
- **Expected**:
  - `anyMergePossible` returns TRUE ✅
  - `isGameStuck` returns FALSE ✅
  - Game continues ✅
- **Status**: WORKING (already fixed in v32.1)

#### 2.8 Wild + 2 Stacks (v36 CRITICAL FIX)
- **Board**: wild + stack(5, depth=3) + stack(5, depth=2)
- **Action**: Merge wild + stack(5, depth=3) → merge 6
- **Expected**:
  - `activeTilesCount` = 6 (not 3!) ✅
  - `combinedCount` = 4 (1 + 3)
  - `allTilesInvolved` = FALSE (4 < 6) ✅
  - NOT marked as "last merge" ✅
  - Merge 6 animations play ✅
  - Spawn 4 new tiles ✅
  - Board: merge 6 + stack(5, depth=2) + 4 new tiles ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v36)

#### 2.9 Single Stack (depth > 1)
- **Board**: stack(5, depth=3)
- **Action**: Stack can merge with itself
- **Expected**:
  - `totalTilesCount` = 3 (not 1!) ✅
  - `isGameStuck` returns FALSE ✅
  - STUCK PROTECTION skipped ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v36)

#### 2.10 Magnet + Tile Pulls Other Magnets (v37 CRITICAL FIX)
- **Board**: 3 magnets + 1 tile
- **Action**: Merge magnet + tile → should pull other 2 magnets
- **Expected**:
  - Magnet filter includes wild/magnet tiles (value = 0 OK) ✅
  - Finds 2 magnets to pull ✅
  - Pulls 2 magnets to merge location ✅
  - Creates merge 6 with 3x multiplier (1 main + 2 pulled) ✅
  - Spawns 3 new tiles ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v37)

---

### **FAIL SCENARIOS (Game Stuck)**

#### 3.1 Single Non-6 Tile
- **Board**: 1 tile (not merge 6)
- **Expected**: Fail screen after 1 second ✅
- **Status**: WORKING (STUCK PROTECTION)

#### 3.2 Multiple Tiles, No Merges Possible
- **Board**: tile(1) + tile(5) (sum = 6 but not adjacent or can't merge)
- **Expected**: 
  - `anyMergePossible` returns FALSE ✅
  - Fail screen ✅
- **Status**: WORKING

#### 3.3 Only Wild Stars (2+)
- **Board**: wild + wild
- **Expected**: 
  - Wild + wild merge is BLOCKED ✅
  - `anyMergePossible` returns FALSE ✅
  - Fail screen ✅
- **Status**: WORKING

#### 3.4 Only Magnets (2+)
- **Board**: magnet + magnet
- **Expected**:
  - Magnet + magnet merge is BLOCKED ✅
  - `anyMergePossible` returns FALSE ✅
  - Fail screen ✅
- **Status**: WORKING

#### 3.5 Moves = 0, No Merges
- **Board**: Multiple tiles, no valid merges, moves = 0
- **Expected**: Fail screen ✅
- **Status**: WORKING

---

### **EDGE CASES (Special Handling)**

#### 4.1 Wild Stars Only (Emergency Rescue)
- **Board**: wild + wild (only wilds, no regular tiles)
- **Expected**:
  - `needsEmergencyRescue` returns TRUE ✅
  - Regular tiles spawn ✅
  - Game continues ✅
- **Status**: WORKING

#### 4.2 Magnets Only (Emergency Rescue)
- **Board**: magnet + magnet (only magnets, no regular tiles)
- **Expected**:
  - `needsEmergencyRescue` returns TRUE ✅
  - Regular tiles spawn ✅
  - Game continues ✅
- **Status**: WORKING

#### 4.3 Wild + Magnet (No Regular Tiles)
- **Board**: wild + magnet
- **Expected**:
  - Wild + magnet CAN merge ✅
  - `anyMergePossible` returns TRUE ✅
  - Game continues ✅
- **Status**: WORKING

#### 4.4 Locked Tiles During Endgame Check
- **Board**: Any scenario where tiles are locked (spawn in progress)
- **Expected**:
  - `checkLevelEnd()` skips check ✅
  - Reschedules after 0.5s ✅
  - Waits for tiles to unlock ✅
- **Status**: WORKING (fixed in v34)

#### 4.5 Wild Merge Mid-Game (NOT Last Merge)
- **Board**: wild + tile1 + tile2 + tile3 (4+ tiles)
- **Action**: Merge wild + tile1
- **Expected**:
  - NOT marked as "last merge" ✅
  - Spawns new tiles ✅
  - Endgame check skipped (mid-game wild merge) ✅
  - Game continues ✅
- **Status**: WORKING (fixed in v33)

---

## 🔧 KEY FIXES APPLIED

### v32.1 - Wild + Merge 6 Mergeability
- Fixed `isGameStuck` to allow wild merging with merge 6
- Fixed `needsEmergencyRescue` to include merge 6 as mergeable

### v32.2 - Removed Premature Endgame Check
- Removed premature `checkEndGame()` call after merge 6
- Endgame check now happens AFTER spawn completes

### v32.3 - Magnet Safety
- Skip endgame check if magnet present on board
- Added magnet detection in `checkLevelEnd`

### v32.4 - Magnet Safety After Spawn
- Skip `checkLevelEnd` immediately after merge 6 spawn if magnet present
- Allows player to use magnet before endgame check

### v32.5 - Magnet Pull Spawn Flow
- Added `checkLevelEnd()` call after magnet pull spawn completes
- Ensures game state re-evaluated after new tiles appear

### v33 - Wild Merge Last Merge Detection
- Refined `_isLastMerge` logic for wild merges
- Wild merge only "last merge" if exactly 2 tiles total
- Prevents false "last merge" with 3+ tiles

### v34 - Comprehensive Wild/Magnet Safety
- **CRITICAL**: Fixed `anyMergePossible` to include merge 6 in mergeable tiles
- Skip `checkLevelEnd` if locked active tiles present
- Skip STUCK PROTECTION if wild/magnet present or locked tiles animating

### v35 - Critical anyMergePossible Fix
- **CRITICAL**: Fixed `board.ts` to include merge 6 in `mergeableNonWildTiles`
- Consistent with `endgame-checker.ts` fix from v32.1
- Created comprehensive `ENDGAME_SCENARIOS.md` documentation

### v36 - StackDepth Awareness (CRITICAL)
- **ROOT CAUSE FIX**: `activeTilesCount` now includes `stackDepth` in calculations
- **Example**: wild + stack(5, depth=3) + stack(5, depth=2) = 6 total tiles, not 3!
- Fixed `app-core.ts` line 2161: Count total tiles with stackDepth for "last merge" detection
- Fixed `app-core.ts` line 2122: STUCK PROTECTION now checks stackDepth
- Fixed `endgame-checker.ts` line 228: `isGameStuck` now counts total tiles with stackDepth
- Fixed `endgame-checker.ts` line 242: Single stack can merge with itself
- **Impact**: Wild + 2 stacks scenario now works correctly with merge animations and spawns

### v37 - Magnet Pull Filter Fix (CRITICAL)
- **ROOT CAUSE FIX**: Magnet pull filter was excluding wild/magnet tiles with `value = 0`
- **Problem**: `if ((tile.value | 0) <= 0) return false;` excluded ALL magnets/wilds!
- **Example**: 3 magnets + 1 tile → merge magnet + tile → other magnets NOT pulled!
- Fixed `app-core.ts` line 2199: Check `isWildOrMagnet` BEFORE value check
- Fixed `app-core.ts` line 2437: Same fix for actual pull animation filter
- Fixed `app-core.ts` line 2444: Reset `wildMagnetPullInProgress` if no tiles to pull
- Added detailed logging to debug filter issues
- **Impact**: Magnets now CORRECTLY pull other magnets, wilds, and tiles (max 4)

---

## 🎯 VERIFICATION CHECKLIST

| Scenario | Expected | Status |
|----------|----------|--------|
| Wild + merge 6 can merge | ✅ Continue | ✅ FIXED (v34) |
| Magnet + merge 6 can merge | ✅ Continue | ✅ WORKING |
| Wild + 2 tiles merge → spawn | ✅ Continue | ✅ WORKING |
| Wild + tile + magnet → spawn | ✅ Continue | ✅ WORKING |
| Regular merge + wild on board | ✅ Continue | ✅ FIXED (v34) |
| Magnet pulls magnet → spawn | ✅ Continue | ✅ WORKING |
| Locked tiles → defer check | ✅ Deferred | ✅ FIXED (v34) |
| STUCK PROTECTION + wild/magnet | ✅ Skip | ✅ FIXED (v34) |
| Single non-6 tile | ❌ Fail | ✅ WORKING |
| Only wilds (2+) | ❌ Fail | ✅ WORKING |
| Wild + 1 tile (2 total) → clean | ✅ Clean | ✅ WORKING |
| Wild + 2 stacks → merge → spawn | ✅ Continue | ✅ FIXED (v36) |
| Single stack (depth > 1) | ✅ Continue | ✅ FIXED (v36) |
| 3 magnets + tile → pull magnets | ✅ Pull | ✅ FIXED (v37) |
| Magnet pulls wild/magnet/tiles | ✅ Pull all | ✅ FIXED (v37) |

---

## 🚀 IMPLEMENTATION DETAILS

### Core Functions

1. **`checkEndGame()`** (`endgame-checker.ts`)
   - Centralized end game logic
   - Checks: last merge, clean board, stuck, moves depleted
   - Debounced with cache for performance

2. **`anyMergePossible()`** (`board.ts`)
   - Detects if any merge combinations exist
   - **v34 FIX**: Now includes merge 6 as mergeable with wild

3. **`checkLevelEnd()`** (`app-core.ts`)
   - Entry point for end game checks
   - **v34 FIX**: Skips if locked active tiles present
   - Schedules with 1.2s delay

4. **`_isLastMerge` Flag** (`app-core.ts`)
   - Marks merge as final merge before clean board
   - Set BEFORE animation starts
   - **v33 FIX**: Only set if 2 tiles total for wild merges

5. **STUCK PROTECTION** (`app-core.ts`)
   - Fallback timer after regular merges
   - **v34 FIX**: Skips if wild/magnet present or locked tiles

---

## 📝 NOTES FOR FUTURE

- All end game checks must respect locked tiles (spawn in progress)
- Wild and magnet tiles should ALWAYS defer endgame checks
- `anyMergePossible` must be consistent with `isGameStuck`
- `_isLastMerge` detection must account for spawn behavior
- STUCK PROTECTION is a safety net, not primary endgame detection

