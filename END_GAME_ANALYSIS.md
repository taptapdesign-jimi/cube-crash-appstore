# 🔍 END GAME ANALIZA - Scenarij: 2 obične kockice + wild tile-ovi

## 📋 Scenarij:
- **2 obične kockice** (npr. value 3 i 3)
- **2 magneta** (wild-magnet)
- **1 wild beer** (wild-beer)
- **1 wild zvjezdica** (wild)
- **Ukupno: 6 tile-ova** na boardu

---

## 🎯 Što se događa kada se spoje 2 obične kockice (merge-6)?

### **KORAK 1: Merge provjera (prije merge-6 animacije)**

**Lokacija:** `app-core.ts` linija ~2618

```typescript
const isRegularMergeLastTwo = !wildActive && 
                              activeTilesCount === 2 &&  // ⚠️ PROBLEM: Ima 6 tile-ova, ne 2!
                              activeTilesBeforeMerge.includes(src) && 
                              activeTilesBeforeMerge.includes(dst) &&
                              (src.value|0) + (dst.value|0) === 6;
```

**Rezultat:**
- `activeTilesCount = 6` (2 obične + 2 magneta + wild beer + wild zvjezdica)
- `isRegularMergeLastTwo = FALSE` (jer `activeTilesCount === 2` je FALSE)
- `_isLastMerge` se **NE POSTAVLJA** ✅

---

### **KORAK 2: Merge-6 animacija i spawn logika**

**Lokacija:** `app-core.ts` linija ~3956

```typescript
const isLastMergeFlagSet = (dst as any)?._isLastMerge === true;

if (isLastMergeFlagSet || busyEnding) {
  // Skip spawn i trigger clean board
  return;
}

// Normal spawn se izvršava
```

**Rezultat:**
- `_isLastMerge = false` → spawn se **IZVRŠAVA** ✅
- Nove kockice se spawnaju normalno

---

### **KORAK 3: Nakon spawna - checkLevelEnd()**

**Lokacija:** `app-core.ts` linija ~4262

```typescript
// Provjera emergency rescue
if (needsEmergencyRescue(tiles)) {
  // Wild cubes exist but no non-wild tiles
  scheduleWildRescue('checkLevelEnd', emergencyCount);
  return;
}

// Centralized end game checker
const checkLevelEndResult = checkEndGame(checkLevelEndContext, true);
```

**Rezultat:**
- Nakon merge-6, ostane: **merge-6 tile + 2 magneta + wild beer + wild zvjezdica = 5 tile-ova**
- `needsEmergencyRescue()` provjerava:
  - Wild cubes: 4 (2 magneta + wild beer + wild zvjezdica)
  - Mergeable non-wild tiles: 1 (merge-6)
  - **Rezultat: FALSE** (ima merge-6 koji može mergeati s wild-om)

---

### **KORAK 4: checkEndGame() provjera**

**Lokacija:** `endgame-checker.ts` linija ~280

```typescript
const mergeableNonWildTiles = activeTiles.filter(t => {
  if (t.special === 'wild' || t.special === 'wild-magnet' || t.special === 'wild-beer') return false;
  const value = (t.value|0);
  return value > 0 && value <= 6; // ✅ Wild može mergeati s merge-6!
});

// Provjera stuck
if (wildStars.length > 0 && mergeableNonWildTiles.length > 0) {
  return false; // ✅ NOT STUCK - wild može mergeati s merge-6
}
```

**Rezultat:**
- `mergeableNonWildTiles = [merge-6]` (1 tile)
- `wildStars = [wild beer, wild zvjezdica]` (2 tile-a)
- `isGameStuck()` = **FALSE** ✅
- Game continues! ✅

---

## ⚠️ POTENCIJALNI PROBLEM:

### **Problem 1: Magnet provjera u checkLevelEnd**

**Lokacija:** `app-core.ts` linija ~4289

```typescript
// 🔥 CRITICAL FIX: Check if there's a magnet on board that can be used for merge
const hasMagnetOnBoard = tiles.some((t: any) => 
  t && !t.destroyed && t.special === 'wild-magnet'
);

if (checkLevelEndResult.type === 'clean' && hasMagnetOnBoard) {
  console.log('🧲 checkLevelEnd: Magnet detected on board - NOT a clean board, game continues');
  return; // ✅ Game continues
}
```

**Rezultat:**
- Ako `checkEndGame()` vrati `type: 'clean'` (što ne bi trebalo u ovom scenariju)
- I ako ima magneta → game continues ✅

---

### **Problem 2: Ako checkEndGame() vrati 'stuck'**

**Lokacija:** `endgame-checker.ts` linija ~298

```typescript
// 🔥 CRITICAL FIX: If we have magnets and ANY other tiles, we can merge
if (magnets.length > 0 && (mergeableNonWildTiles.length > 0 || wildStars.length > 0)) {
  console.log('✅ isGameStuck: Magnets + other tiles present - can pull and merge');
  return false; // NOT STUCK
}
```

**Rezultat:**
- `magnets.length = 2` (2 magneta)
- `mergeableNonWildTiles.length = 1` (merge-6)
- `wildStars.length = 2` (wild beer + wild zvjezdica)
- `isGameStuck()` = **FALSE** ✅

---

## ✅ ZAKLJUČAK:

### **Što bi se TREBALO dogoditi:**

1. ✅ Merge-6 se izvršava (2 obične kockice se spajaju)
2. ✅ `_isLastMerge` se **NE POSTAVLJA** (jer ima 6 tile-ova, ne 2)
3. ✅ Spawn se **IZVRŠAVA** (nove kockice se spawnaju)
4. ✅ Nakon spawna, ostane: merge-6 + 2 magneta + wild beer + wild zvjezdica
5. ✅ `checkEndGame()` vidi da wild može mergeati s merge-6
6. ✅ `isGameStuck()` = FALSE
7. ✅ **Game continues!** ✅

### **Što se MOŽDA događa (BUG):**

1. ❌ `checkEndGame()` možda vraća `type: 'stuck'` umjesto `type: 'continue'`
2. ❌ `isGameStuck()` možda vraća TRUE umjesto FALSE
3. ❌ Spawn se možda ne izvršava (ali to ne bi trebalo jer `_isLastMerge` nije postavljen)

---

## 🔍 DEBUGGING CHECKLIST:

1. Provjeri u konzoli:
   - `activeTilesCount` prije merge-6 (trebalo bi biti 6)
   - `isRegularMergeLastTwo` (trebalo bi biti FALSE)
   - `_isLastMerge` flag (trebalo bi biti undefined/false)
   - `checkEndGame()` rezultat (trebalo bi biti `type: 'continue'`)
   - `isGameStuck()` rezultat (trebalo bi biti FALSE)

2. Provjeri nakon merge-6:
   - Koliko tile-ova ostane na boardu?
   - Da li se spawn izvršio?
   - Što `checkLevelEnd()` logira?

---

## 🐛 MOGUĆI BUG:

Ako se spawn **NE IZVRŠAVA** unatoč tome što `_isLastMerge` nije postavljen, problem je u:
- Spawn logici (linija ~3956)
- Ili u nekoj drugoj provjeri koja blokira spawn

Ako se spawn **IZVRŠAVA** ali `checkEndGame()` vraća `type: 'stuck'`, problem je u:
- `isGameStuck()` logici (ne prepoznaje da wild može mergeati s merge-6)
- Ili u `checkEndGame()` logici

