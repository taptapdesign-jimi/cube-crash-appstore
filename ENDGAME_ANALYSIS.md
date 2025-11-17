# 🔍 ENDGAME LOGIC - COMPREHENSIVE FORENSIC ANALYSIS

## 📋 EXECUTIVE SUMMARY

**Status**: All known bugs fixed (v32-v37)
**Critical Components**: 
- `endgame-checker.ts` - Centralized checker
- `app-core.ts` - checkLevelEnd(), merge flows, timers
- `board.ts` - anyMergePossible()

**Timing Configuration**:
- `CHECK_LEVEL_END_DELAY_MS` = 1200ms (1.2 seconds)
- `DEBOUNCE_MS` = 50ms (endgame checker debounce)

---

## 🎯 ENDGAME FLOW DIAGRAM

```
┌─────────────────────────────────────────────────┐
│         PLAYER MAKES MOVE (merge/stack)         │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│         MERGE ANIMATION COMPLETES                │
│         - removeTile(src)                        │
│         - dst becomes merge 6 (or other)         │
└────────────────┬────────────────────────────────┘
                 │
                 v
        ┌────────┴────────┐
        │  Is Wild/Magnet? │
        └────────┬────────┘
           Yes   │   No
        ┌────────┴────────┐
        v                  v
┌───────────────┐   ┌──────────────┐
│ WILD MERGE    │   │ REGULAR      │
│ - Skip spawn  │   │ MERGE        │
│   if last=2   │   │ - Normal     │
│ - Spawn based │   │   flow       │
│   on combined │   │              │
│   count       │   │              │
└───────┬───────┘   └──────┬───────┘
        │                  │
        └────────┬─────────┘
                 v
      ┌──────────────────┐
      │  Is Magnet Pull?  │
      └──────────┬─────────┘
           Yes   │   No
        ┌────────┴────────┐
        v                  v
┌───────────────┐   ┌──────────────┐
│ MAGNET PULL   │   │ CHECK MERGE  │
│ - Pull tiles  │   │ 6 FLOW       │
│ - Merge them  │   │              │
│ - Spawn based │   │              │
│   on pulled   │   │              │
│   count       │   │              │
└───────┬───────┘   └──────┬───────┘
        │                  │
        └────────┬─────────┘
                 v
┌─────────────────────────────────────────────────┐
│         SPAWN NEW TILES (if applicable)          │
│         - Tiles locked during spawn              │
│         - Animations play (drop, appear)         │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│         TILES UNLOCK (spawn complete)            │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│         checkLevelEnd() CALLED                   │
│         (DELAY: 1.2 seconds)                     │
└────────────────┬────────────────────────────────┘
                 │
                 v
      ┌──────────────────┐
      │ Are tiles locked? │
      └──────────┬─────────┘
           Yes   │   No
        ┌────────┴────────┐
        v                  v
┌───────────────┐   ┌──────────────────┐
│ RESCHEDULE    │   │ Is wild spawn    │
│ checkLevelEnd │   │ in progress?     │
│ (+0.5s)       │   └──────┬───────────┘
└───────────────┘     Yes   │   No
                   ┌────────┴────────┐
                   v                  v
            ┌───────────────┐   ┌──────────────────┐
            │ RESCHEDULE    │   │ checkEndGame()   │
            │ checkLevelEnd │   │ CENTRALIZED      │
            │ (+0.3s)       │   │ CHECKER          │
            └───────────────┘   └──────┬───────────┘
                                       │
                   ┌───────────────────┼───────────────────┐
                   v                   v                   v
            ┌──────────┐        ┌──────────┐       ┌──────────┐
            │  CLEAN   │        │  STUCK   │       │ CONTINUE │
            │  BOARD   │        │  (FAIL)  │       │          │
            └────┬─────┘        └────┬─────┘       └──────────┘
                 │                   │
                 v                   v
          ┌──────────────────────────────┐
          │   runEndgameFlow()           │
          │   - Set busyEnding = true    │
          │   - Show animations          │
          │   - Show final screen        │
          └──────────────────────────────┘
```

---

## 🔥 CRITICAL TIMING ANALYSIS

### 1. checkLevelEnd() Delay
```typescript
// app-core.ts line 48
const CHECK_LEVEL_END_DELAY_MS = 1200; // 1.2 seconds
```

**Purpose**: Wait for animations/spawns to complete
**Risk**: Too short → premature checks, Too long → slow feedback

**Analysis**: ✅ **APPROPRIATE**
- Merge animations: ~600-800ms
- Spawn animations: ~400-600ms
- Total: ~1000-1400ms
- 1.2s delay is in the middle range

### 2. Debounce Window
```typescript
// endgame-checker.ts line 40
const DEBOUNCE_MS = 50; // 50ms debounce window
```

**Purpose**: Prevent duplicate checks within 50ms
**Risk**: Multiple rapid calls could use stale cache

**Analysis**: ✅ **SAFE**
- Only used for same context hash
- Force refresh bypasses debounce
- 50ms is short enough to not cause issues

### 3. Locked Tiles Reschedule
```typescript
// app-core.ts line 3898 (approximate)
if (lockedActiveTiles.length > 0) {
  checkLevelEndTimer = gsap.delayedCall(0.5, () => {
    checkLevelEnd();
  });
}
```

**Purpose**: Wait for locked tiles to unlock
**Risk**: Infinite loop if tiles never unlock

**Analysis**: ⚠️ **POTENTIAL ISSUE**
- No max retry count
- If tiles stuck locked → infinite reschedule
- **Recommendation**: Add max retry counter

### 4. Wild Spawn Reschedule
```typescript
// app-core.ts line 3908 (approximate)
if (wildSpawnInProgress) {
  checkLevelEndTimer = gsap.delayedCall(0.3, () => {
    checkLevelEnd();
  });
}
```

**Purpose**: Wait for wild spawn to complete
**Risk**: Similar to locked tiles - no max retry

**Analysis**: ⚠️ **POTENTIAL ISSUE**
- No max retry count
- **Recommendation**: Add max retry counter

---

## 🧩 TILEISACTIVE() LOGIC ANALYSIS

### Definition (endgame-checker.ts line 58)
```typescript
function tileIsActive(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  
  // 🔥 CRITICAL: Locked tiles with value > 0 are still active
  const value = (tile.value | 0);
  if (value > 0) {
    return true; // Active regardless of locked status
  }
  
  // Wild tiles are active even if locked temporarily
  return tileIsWild(tile);
}
```

### Issue Analysis
**Problem**: `locked` tiles with `value > 0` are considered **ACTIVE**

**Example**:
- Tile spawning (locked=true, value=3)
- `tileIsActive()` returns **TRUE**
- `getActiveTiles()` includes this tile
- Endgame checker counts it as active tile

**But then**:
- `checkLevelEnd()` detects locked tiles (line 3915)
- Reschedules check (+0.5s)

**Is this correct?** 🤔

**Analysis**: ⚠️ **INCONSISTENCY**

Option 1: Locked tiles are NOT active → exclude from getActiveTiles()
- Pro: Simpler logic, no rescheduling needed
- Con: What if locked tile is part of endgame calculation?

Option 2: Locked tiles ARE active → current behavior
- Pro: Correctly counts tiles during spawn
- Con: Requires rescheduling logic

**Current behavior is CORRECT** because:
- During magnet pull, tiles are locked but still "on board"
- We need to count them as active to prevent premature fail
- Rescheduling ensures we wait for them to unlock

**BUT**: We need max retry counter!

---

## 🎲 ANYMERGEPOSSIBLE() ANALYSIS

### Location: board.ts line 453

```typescript
export function anyMergePossible(allTiles: (Container | Tile)[]): boolean {
  const open = allTiles.filter((t) => tileIsActive(t as Tile)) as Tile[];
  
  // Check for wild cubes
  const wildStars = open.filter((t) => t.special === 'wild');
  const magnets = open.filter((t) => t.special === 'wild-magnet');
  
  const mergeableNonWildTiles = open.filter((t) => {
    if (!t || t.special === 'wild' || t.special === 'wild-magnet') return false;
    const value = (t.value | 0);
    return value > 0 && value <= 6; // ✅ v35 FIX: includes merge 6
  });
  
  // Wild stars + regular tiles
  if (wildStars.length > 0 && mergeableNonWildTiles.length > 0) {
    return true;
  }
  
  // Only wild stars (blocked - wild+wild not allowed)
  if (wildStars.length >= 2 && mergeableNonWildTiles.length === 0 && magnets.length === 0) {
    return false;
  }
  
  // Magnets + other tiles
  if (magnets.length > 0 && (mergeableNonWildTiles.length > 0 || wildStars.length > 0)) {
    return true;
  }
  
  // Regular tile combinations
  if (open.length < 2) {
    return false;
  }
  
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const tile1 = open[i];
      const tile2 = open[j];
      
      // Skip wild cubes (already handled above)
      if (tile1.special === 'wild' || tile1.special === 'wild-magnet' || 
          tile2.special === 'wild' || tile2.special === 'wild-magnet') {
        continue;
      }
      
      const s = (tile1.value || 0) + (tile2.value || 0);
      const isValid = s >= 2 && s <= 6;
      
      if (isValid) {
        return true;
      }
    }
  }
  
  return false;
}
```

### Issue Analysis

**Question**: Does this correctly handle **STACKS**?

**Example**:
- stack(5, depth=3) - single visible tile
- `open.length = 1`
- Returns **FALSE** (< 2 tiles)

**BUT**: Stack can merge with itself!

**Analysis**: ⚠️ **POTENTIAL BUG**

`anyMergePossible()` does NOT check `stackDepth`!

Single stack with depth > 1 should return **TRUE** (can merge with itself)

---

## 🚨 IDENTIFIED ISSUES (ALL FIXED IN v38)

### ~~Issue #1: No Max Retry Counter~~ ✅ FIXED v38
**Location**: `checkLevelEnd()` reschedule logic
**Severity**: Medium
**Impact**: Potential infinite loop if tiles stuck locked

**Status**: ✅ **FIXED** in v38
- Added `checkLevelEndRetryCount` counter
- Added `MAX_CHECK_LEVEL_END_RETRIES = 10` constant
- Counter increments on each reschedule
- Forces check after 10 retries with error logging
- Counter resets on new `checkLevelEnd()` call
- Counter resets after successful check

### ~~Issue #2: anyMergePossible() Doesn't Check stackDepth~~ ✅ FIXED v38
**Location**: `board.ts` line 500
**Severity**: High
**Impact**: Single stack incorrectly marked as "stuck"

**Status**: ✅ **FIXED** in v38
- Added stackDepth calculation for total tiles
- Single stack (depth > 1) correctly returns TRUE
- Merge 6 with depth 1 correctly returns FALSE
- Includes detailed logging for debugging

### Issue #3: tileIsActive() Includes Locked Tiles
**Location**: `endgame-checker.ts` line 58
**Severity**: Low (working as intended, but confusing)
**Impact**: Requires reschedule logic

**Analysis**: This is actually **CORRECT BEHAVIOR** for magnet pulls, but the name `tileIsActive()` is misleading.

**Recommendation**: Rename to `tileExistsOnBoard()` for clarity

### Issue #4: Debounce Cache Might Be Stale
**Location**: `endgame-checker.ts` line 333
**Severity**: Low
**Impact**: Within 50ms, same hash returns cached result

**Analysis**: This is **SAFE** because:
- 50ms is very short
- Cache cleared on tile add/remove
- Force refresh bypasses cache

**No action needed**.

### Issue #5: Missing Edge Case - Magnet + Only Locked Tiles
**Location**: Magnet pull filter
**Severity**: Low
**Impact**: If all tiles are locked, magnet can't pull anything

**Scenario**:
- Magnet + 3 locked tiles (spawning)
- User drags magnet onto last tile
- Filter excludes locked tiles
- `nearestTiles.length = 0`
- `wildMagnetPullInProgress` reset (v37 fix)
- Merge 6 created, spawns 2 tiles
- Game continues

**Analysis**: ✅ **HANDLED CORRECTLY** by v37 fix

---

## ✅ VERIFIED CORRECT BEHAVIORS

### 1. Wild + Merge 6 Can Merge
**Status**: ✅ FIXED (v35)
- `mergeableNonWildTiles` includes `value <= 6`
- Wild + merge 6 correctly detected as mergeable

### 2. Magnet Pulls Other Magnets
**Status**: ✅ FIXED (v37)
- Filter checks `isWildOrMagnet` before value check
- Magnets/wilds included regardless of value

### 3. StackDepth in Last Merge Detection
**Status**: ✅ FIXED (v36)
- `activeTilesCount` uses reduce() with stackDepth
- Correctly counts total tiles, not just visible

### 4. Locked Tiles Defer Endgame Check
**Status**: ✅ FIXED (v34)
- `checkLevelEnd()` detects locked active tiles
- Reschedules check until tiles unlock

### 5. Magnet/Wild on Board → No Premature Fail
**Status**: ✅ FIXED (v34)
- STUCK PROTECTION checks for wild/magnet
- `isLastMergeScenario()` checks for magnet
- `checkLevelEnd()` skips if magnet present after spawn

---

## 📊 RISK ASSESSMENT MATRIX

| Issue | Severity | Likelihood | Impact | Priority |
|-------|----------|------------|--------|----------|
| No max retry counter | Medium | Low | High | **HIGH** |
| anyMergePossible stackDepth | High | Medium | High | **CRITICAL** |
| tileIsActive naming | Low | N/A | Low | Low |
| Debounce staleness | Low | Low | Low | Low |

---

## 🔧 ~~RECOMMENDED FIXES~~ ✅ ALL FIXED IN v38

### ~~Priority 1: anyMergePossible() stackDepth (CRITICAL)~~ ✅ FIXED
**File**: `board.ts` line 500
**Status**: ✅ **IMPLEMENTED** in v38

### ~~Priority 2: Max Retry Counter (HIGH)~~ ✅ FIXED
**File**: `app-core.ts` checkLevelEnd()
**Status**: ✅ **IMPLEMENTED** in v38

### Priority 3: Rename tileIsActive() (LOW)
**File**: `endgame-checker.ts` line 58
**Status**: ⏳ **DEFERRED** (low priority, working as intended)
**Note**: Behavior is correct for magnet pulls, just naming is confusing

---

## 🎯 CONCLUSION

**Overall Status**: ✅ **EXCELLENT**

The endgame logic is **fundamentally sound** with comprehensive checks and proper edge case handling. All major bugs from v32-v38 have been fixed.

**All Critical Issues Resolved** ✅
1. ✅ **v38**: `anyMergePossible()` now checks stackDepth
2. ✅ **v38**: Max retry counter prevents infinite reschedule loops
3. ✅ **v37**: Magnet pull filter includes wild/magnet tiles
4. ✅ **v36**: activeTilesCount includes stackDepth
5. ✅ **v35**: anyMergePossible includes merge 6
6. ✅ **v34**: Locked tiles defer endgame check
7. ✅ **v32-v33**: Wild/magnet endgame logic

**Outstanding Issues**: 
- Low priority naming clarification (not blocking)

**Test Coverage**: ✅ All known scenarios tested and documented in `ENDGAME_SCENARIOS.md`

**Performance**: ✅ Debouncing and caching prevent redundant checks

**Maintainability**: ✅ Centralized checker, clear separation of concerns

**Safety**: ✅ Max retry counters prevent infinite loops

**Edge Cases**: ✅ Wild, magnet, stack, locked tiles all handled correctly

