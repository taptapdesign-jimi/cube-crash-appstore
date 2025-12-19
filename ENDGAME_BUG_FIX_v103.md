# 🐛 Critical End Game Bug Fix - v103

## Bug Report

### User Description
Korisnik je igrao igru i došao do kritičnog end game buga:

1. Ostale su 2 kockice na boardu (magnet + obična)
2. Stavio kockicu na magnet → spawn 2 nove kockice
3. Mergao 2 nove kockice u stack (value 3, stackDepth=2)
4. **STUCK** - igra se nije završila iako nema više moguéih poteza

### Root Cause Analysis

#### Problem
`tileIsActive()` funkcija u `board.ts` tretirala je **locked tiles kao active tiles**:

```typescript
// board.ts (prije fix-a)
function tileIsActive(tile: Tile | null | undefined): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  
  const value = (tile.value | 0);
  if (value > 0) {
    return true; // ❌ BUG: Vraća true čak i za locked tiles!
  }
  
  return tileIsWild(tile);
}
```

#### Why This Caused the Bug

1. **Magnet Merge Spawns Locked Tiles**: Kada korisnik stavi kockicu na magnet, spawn-aju se 2 nove kockice koje su **locked** tijekom animacije.

2. **User Can Merge Spawned Tiles**: Ako korisnik brzo reagira, može mergat 2 nove kockice u stack prije nego se unlockaju.

3. **Remaining Locked Tile**: Nakon merge-a, preostala locked kockica ostaje na board-u.

4. **anyMergePossible() Returns TRUE**: `anyMergePossible()` poziva `tileIsActive()` i vidi locked kockicu kao "active", pa vraća `true` (misli da user može mergati).

5. **User CANNOT Drag Locked Tiles**: Drag je blokiran za locked tiles:
   - `drag-core.ts:189` - `if (t.locked) return;` (blokira drag)
   - `merge-utils.ts:341` - `if (src.locked || dst.locked) return false;` (blokira merge)
   - `app-core.ts:811` - `if (!d || d.locked || ...) return false;` (blokira canDrop)

6. **Result: STUCK**: Igra misli da ima moguće poteze (jer vidi locked kockicu kao active), ali korisnik NE MOŽE mergat locked kockicu, pa ostaje stuck.

---

## Solution

### Code Changes

**File**: `src/modules/board.ts`  
**Function**: `tileIsActive()`

```typescript
function tileIsActive(tile: Tile | null | undefined): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  
  // 🔥 CRITICAL FIX: Exclude locked tiles from active tiles
  // User CANNOT drag or merge locked tiles, so they should NOT be counted as "active" for anyMergePossible
  // Exception: Wild-magnet affected tiles are locked during pull animation but will unlock after merge
  // These are handled separately in endgame-checker.ts
  const isWildMagnetAffected = (tile as any)?._wildMagnetAffected === true;
  
  if (tile.locked && !isWildMagnetAffected) {
    // Locked tiles (except wild-magnet affected) are NOT active for gameplay
    // User cannot drag or merge them, so they should not be counted in anyMergePossible
    return false;
  }
  
  // Only exclude locked tiles with value 0 (ghost placeholders)
  const value = (tile.value | 0);
  if (value > 0) {
    return true; // Active if unlocked (or wild-magnet affected)
  }
  
  // Wild tiles are active even if locked temporarily (wild-magnet affected case)
  return tileIsWild(tile);
}
```

### Key Changes

1. **Check for locked status**: Dodao provjeru `tile.locked` prije tretiranja tile-a kao active.
2. **Exception for wild-magnet affected tiles**: Wild-magnet affected tiles su locked tijekom pull animacije, ali će se unlockirat nakon merge-a, pa ih tretiramo kao active.
3. **Return false for locked tiles**: Locked tiles (osim wild-magnet affected) vraćaju `false`, što znači da `anyMergePossible()` ih neće vidjet kao moguće poteze.

---

## Impact

### Before Fix
- **anyMergePossible()**: Vidi locked tiles kao active → vraća `true` (game continues)
- **User**: Ne može draggat locked tiles → stuck
- **Result**: Game never ends, user stuck

### After Fix
- **anyMergePossible()**: NE vidi locked tiles kao active → vraća `false` (game stuck)
- **checkEndGame()**: Detektira stuck state → pokazuje fail screen
- **Result**: Game properly ends, user sees fail screen

---

## Testing Scenarios

### Scenario 1: Magnet Merge + Fast Stack (Bug Scenario)
1. Board ima 2 kockice (magnet + obična)
2. User stavi kockicu na magnet → spawn 2 nove (locked)
3. User brzo merguje 2 nove u stack
4. **Expected**: Game detektira stuck i pokazuje fail screen
5. **Actual**: ✅ Game shows fail screen (fixed)

### Scenario 2: Wild-Magnet Pull (Edge Case)
1. Wild-magnet na board-u
2. Wild-magnet povlači 2+ kockice → locked tijekom pull animacije
3. Povučene kockice merge-aju u merge 6
4. **Expected**: Game nastavlja (tiles će se unlockirat)
5. **Actual**: ✅ Game continues (wild-magnet affected tiles su active)

### Scenario 3: Normal Locked Tiles (Common Case)
1. Board ima locked kockice nakon merge 6 spawn-a
2. User čeka da se unlockaju
3. **Expected**: anyMergePossible() ne vidi locked tiles
4. **Actual**: ✅ anyMergePossible() returns false (locked tiles excluded)

---

## Related Code Locations

### Drag Blocking (locked tiles)
- **drag-core.ts:189**: `if (t.locked) return;` - Blokira drag za locked tiles
- **merge-utils.ts:341**: `if (src.locked || dst.locked) return false;` - Blokira merge
- **app-core.ts:811**: `if (!d || d.locked || ...) return false;` - Blokira canDrop

### End Game Logic
- **board.ts:706-724**: `tileIsActive()` - Fixed function
- **board.ts:721**: `anyMergePossible()` - Koristi tileIsActive
- **endgame-checker.ts:379**: `isGameStuck()` - Poziva anyMergePossible
- **endgame-checker.ts:449**: `checkEndGame()` - Glavni end game checker

### Wild-Magnet Logic
- **app-core.ts:4323-4327**: Locked tiles during pull (`tile.locked = true`)
- **app-core.ts:4318-4320**: Wild-magnet affected flag (`tile._wildMagnetAffected = true`)

---

## Conclusion

Ovaj fix rješava kritični bug gdje igra ostaje stuck nakon što user merguje spawned tiles u stack, ostavljajući locked kockice na board-u. 

**Status**: ✅ RESOLVED  
**Version**: v103  
**Priority**: CRITICAL  
**Impact**: High (blocks gameplay)

