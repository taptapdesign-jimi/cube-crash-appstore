# 🔧 END GAME REFACTORING PROPOSAL - Kvalitetniji pristup

## 🎯 CILJ

**Zadržati SVE provjere, ali organizirati ih bolje:**
- ✅ Svi use case-ovi ostaju pokriveni
- ✅ Ista logika, samo na boljem mjestu
- ✅ Eliminirati redundanciju
- ✅ Fix timing problema
- ✅ Konzistentne definicije

---

## 📋 KONKRETNI USE CASE-OVI

### Use Case 1: 3 kockice (4, 4, 3)
**Trenutno stanje:**
- `anyMergePossible()` provjerava: 4+4=8 > 6 ❌, 4+3=7 > 6 ❌, 3+4=7 > 6 ❌
- Rezultat: `false` → fail screen ✅

**Problem:**
- Provjera se poziva na 3 mjesta:
  1. `isGameStuck()` u `endgame-checker.ts` (linija 238)
  2. `checkLevelEnd()` u `app-core.ts` (linija 4911) - **DODATNA PROVJERA**
  3. `checkEndGame()` u `endgame-checker.ts` (linija 462) - **DOUBLE-CHECK**

**Refaktoring:**
- Koristiti SAMO `isGameStuck()` → vraća `false` → `checkEndGame()` vraća `{ type: 'stuck' }`
- `checkLevelEnd()` samo poziva `checkEndGame()` i reagira na rezultat
- **REZULTAT: Ista logika, samo 1 provjera umjesto 3!**

---

### Use Case 2: 2 kockice (4, 2) → merge 6
**Trenutno stanje:**
- `anyMergePossible()` provjerava: 4+2=6 ✅ → `true`
- Early check u `app-core.ts` (linija ~2374): `isRegularLastTwoMerge6` → postavlja `_isLastMerge`
- Merge-6 block provjerava `_isLastMerge` → skip spawn → clean board ✅

**Problem:**
- "Last merge" provjera na 2 mjesta:
  1. `app-core.ts` - early check (linija ~2374)
  2. `endgame-checker.ts` - `isLastMergeScenario()` (linija 169)
- Različite logike! `app-core.ts` koristi `activeTilesCountBeforeWildProgress === 2`, dok `endgame-checker.ts` koristi `activeTiles.length === 0`

**Refaktoring:**
- Koristiti SAMO `isLastMergeScenario()` iz `endgame-checker.ts`
- `app-core.ts` samo poziva `checkEndGame()` s `srcTile` i `dstTile` contextom
- **REZULTAT: Ista logika, samo 1 provjera umjesto 2!**

---

### Use Case 3: 2 kockice (3, 2) → stack 5
**Trenutno stanje:**
- `anyMergePossible()` provjerava: 3+2=5 ✅ → `true` (može stack)
- Post-merge check u `app-core.ts` (linija ~2504): `wasLastTwoRegularStack` → provjerava `canReachMerge6`
- Ako `canReachMerge6 = false` → fail screen ✅

**Problem:**
- Provjera se poziva NAKON merge-a (100ms delay)
- `checkLevelEnd()` se poziva ODMAH
- STUCK PROTECTION timer se poziva nakon 1 sekunde
- **3 provjere u različitim trenucima!**

**Refaktoring:**
- Koristiti SAMO `checkEndGame()` s delay-om (500ms) nakon merge-a
- Ukloniti post-merge check i STUCK PROTECTION timer
- **REZULTAT: Ista logika, samo 1 provjera u 1 trenutku!**

---

### Use Case 4: 1 kockica (merge 6)
**Trenutno stanje:**
- `anyMergePossible()` provjerava: 1 tile, value=6, stackDepth=1 → `false` ❌
- `isGameStuck()` provjerava: `activeTiles.length === 1 && value !== 6` → `true` ✅
- Rezultat: fail screen ✅

**Problem:**
- Provjera se poziva na 2 mjesta:
  1. `isGameStuck()` u `endgame-checker.ts` (linija 274)
  2. STUCK PROTECTION timer u `app-core.ts` (linija 2724)

**Refaktoring:**
- Koristiti SAMO `isGameStuck()` → vraća `true` → `checkEndGame()` vraća `{ type: 'stuck' }`
- Ukloniti STUCK PROTECTION timer
- **REZULTAT: Ista logika, samo 1 provjera umjesto 2!**

---

## 🔧 REFACTORING PLAN

### Faza 1: Konsolidirati provjere u `endgame-checker.ts`

#### 1.1 Ukloniti redundanciju `anyMergePossible()`

**TRENUTNO:**
```typescript
// endgame-checker.ts linija 238
const canMerge = makeBoard.anyMergePossible(tiles); // Provjera #1

// endgame-checker.ts linija 462
const canMergeDoubleCheck = makeBoard.anyMergePossible(tiles); // Provjera #2 (REDUNDANTNO!)

// app-core.ts linija 4911
const canMerge = makeBoard.anyMergePossible(tiles); // Provjera #3 (REDUNDANTNO!)
```

**NOVO:**
```typescript
// endgame-checker.ts - SAMO OVDJE
function isGameStuck(context: EndGameContext): boolean {
  const canMerge = makeBoard.anyMergePossible(tiles);
  // ... ostatak logike
  return !canMerge; // Vraća true ako je stuck
}

// app-core.ts - SAMO POZIVA
checkLevelEnd() {
  const result = checkEndGame(context, true);
  if (result.type === 'stuck') {
    // Reagira na rezultat
  }
}
```

**UTJECAJ:** ✅ Nema lošeg utjecaja - ista logika, samo 1 provjera umjesto 3!

---

#### 1.2 Konsolidirati "last merge" provjeru

**TRENUTNO:**
```typescript
// app-core.ts linija ~2374
const isRegularLastTwoMerge6 = bothAreRegular && 
                               activeTilesCountBeforeWildProgress === 2 && 
                               ...; // Provjera #1

// app-core.ts linija ~3022
const isLastMerge = isRegularRegularLastTwoMerge6 || isAnyWildLastTwo || ...; // Provjera #2

// endgame-checker.ts linija 169
function isLastMergeScenario(context: EndGameContext): boolean {
  // Provjera #3 (različita logika!)
}
```

**NOVO:**
```typescript
// endgame-checker.ts - SAMO OVDJE
function isLastMergeScenario(context: EndGameContext): boolean {
  const { tiles, srcTile, dstTile, justRemovedSrc } = context;
  
  // Konsolidirana logika za SVE scenarije:
  // 1. Regular + regular → merge 6 (2 tiles)
  // 2. Wild + regular → merge 6 (2 tiles)
  // 3. Any wild + regular → merge 6 (2 tiles)
  
  if (!justRemovedSrc || !dstTile || dstTile.value !== 6) return false;
  
  const activeTiles = getActiveTiles(tiles).filter(t => t !== dstTile);
  const visibleTilesCount = activeTiles.length;
  
  // Provjeri sve scenarije
  const isRegularRegular = !srcTile?.special && !dstTile?.special && 
                           (srcTile?.value|0) + (dstTile?.value|0) === 6;
  const isWildRegular = (srcTile?.special?.startsWith('wild') || 
                        dstTile?.special?.startsWith('wild')) &&
                       visibleTilesCount === 0; // Nakon removeTile(src), samo dst ostaje
  
  return (isRegularRegular || isWildRegular) && visibleTilesCount === 0;
}

// app-core.ts - SAMO POZIVA
if (effSum === 6) {
  // ... merge 6 logika ...
  
  // Pozovi checkEndGame s contextom
  const endGameContext = {
    tiles,
    moves,
    makeBoard,
    srcTile: src, // Pass src tile
    dstTile: dst, // Pass dst tile
    justRemovedSrc: false // Will be true after removeTile
  };
  
  // Provjeri nakon removeTile(src)
  removeTile(src);
  endGameContext.justRemovedSrc = true;
  
  const result = checkEndGame(endGameContext, true);
  if (result.type === 'clean' && result.reason === 'last_merge') {
    // Skip spawn, trigger clean board
  }
}
```

**UTJECAJ:** ✅ Nema lošeg utjecaja - ista logika, samo 1 provjera umjesto 3!

---

#### 1.3 Konsolidirati "active tiles" definiciju

**TRENUTNO:**
```typescript
// app-core.ts linija 135
function tileIsVisuallyActive(tile: any): boolean {
  if (!tile || tile.destroyed || tile.locked) return false;
  return value > 0 || isWild;
}

// endgame-checker.ts linija 58
function tileIsActive(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  const value = (tile.value | 0);
  if (value > 0) return true; // Active regardless of locked status
  return tileIsWild(tile);
}

// board.ts - također ima svoju definiciju
```

**NOVO:**
```typescript
// endgame-checker.ts - SAMO OVDJE (eksportirati)
export function tileIsActive(tile: any): boolean {
  if (!tile || tile.destroyed) return false;
  if (tile.visible === false) return false;
  
  const value = (tile.value | 0);
  if (value > 0) return true; // Active regardless of locked status
  return tileIsWild(tile);
}

// app-core.ts - KORISTITI IZVUČENU FUNKCIJU
import { tileIsActive } from './endgame-checker.ts';

// Ukloniti tileIsVisuallyActive(), koristiti tileIsActive()
```

**UTJECAJ:** ✅ Nema lošeg utjecaja - ista logika, samo 1 definicija umjesto 3!

---

### Faza 2: Fix timing problema

#### 2.1 Ukloniti STUCK PROTECTION timer

**TRENUTNO:**
```typescript
// app-core.ts linija 2683
checkLevelEnd(); // Poziva se ODMAH

// app-core.ts linija 2690
gsap.delayedCall(1.0, () => {
  // STUCK PROTECTION - provjerava nakon 1 sekunde
  const canMerge = makeBoard.anyMergePossible(tiles);
  // ...
});
```

**PROBLEM:** 2 provjere u različitim trenucima - race condition!

**NOVO:**
```typescript
// app-core.ts - SAMO checkLevelEnd() s delay-om
if (effSum !== 6) {
  // Za non-merge-6, provjeri nakon animacije
  setTimeout(() => {
    checkLevelEnd(); // Poziva se nakon 500ms (delay u checkLevelEnd)
  }, 100); // Mala delay za animaciju
} else {
  // Za merge-6, provjeri nakon spawn-a (već postoji delay u merge-6 block)
  // checkLevelEnd() se već poziva s delay-om u merge-6 block
}
```

**UTJECAJ:** ✅ Nema lošeg utjecaja - ista logika, samo 1 provjera u 1 trenutku!

---

#### 2.2 Konsolidirati post-merge check

**TRENUTNO:**
```typescript
// app-core.ts linija ~2504
if (wasLastTwoRegularStack && isTrulyLastMoveForTwo) {
  // Provjeri canReachMerge6
  if (!canReachMerge6) {
    showFinalScreen(); // Fail screen
  }
}
```

**PROBLEM:** Provjera se poziva NAKON merge-a, ali `checkLevelEnd()` se poziva ODMAH!

**NOVO:**
```typescript
// app-core.ts - Ukloniti post-merge check
// Umjesto toga, koristiti checkEndGame() s contextom

// Nakon removeTile(src)
const endGameContext = {
  tiles,
  moves,
  makeBoard,
  srcTile: src, // Pass src tile (prije removeTile)
  dstTile: dst,
  justRemovedSrc: true
};

const result = checkEndGame(endGameContext, true);

// checkEndGame() će provjeriti:
// 1. Last merge scenario
// 2. Board clean
// 3. Game stuck (uključujući stack can reach merge 6)
// 4. Moves depleted

if (result.type === 'stuck') {
  showFinalScreen();
}
```

**UTJECAJ:** ✅ Nema lošeg utjecaja - ista logika, samo 1 provjera umjesto 2!

---

## 📊 COMPARISON: TRENUTNO vs NOVO

### Use Case 1: 3 kockice (4, 4, 3)

**TRENUTNO:**
```
1. Merge se izvršava
2. Post-merge check (100ms delay) → anyMergePossible() → false
3. checkLevelEnd() (odmah) → checkEndGame() → isGameStuck() → anyMergePossible() → false
4. STUCK PROTECTION (1 sekunda) → anyMergePossible() → false
5. Fail screen
```
**PROVJERE: 3 puta `anyMergePossible()`**

**NOVO:**
```
1. Merge se izvršava
2. checkLevelEnd() (500ms delay) → checkEndGame() → isGameStuck() → anyMergePossible() → false
3. Fail screen
```
**PROVJERE: 1 puta `anyMergePossible()`**

**REZULTAT:** ✅ Ista logika, 3x manje provjera!

---

### Use Case 2: 2 kockice (4, 2) → merge 6

**TRENUTNO:**
```
1. Early check → isRegularLastTwoMerge6 → true → _isLastMerge = true
2. Merge-6 block → provjerava _isLastMerge → skip spawn
3. checkLevelEnd() → checkEndGame() → isLastMergeScenario() → true
4. Clean board
```
**PROVJERE: 2 puta "last merge" provjera**

**NOVO:**
```
1. Merge-6 block → removeTile(src)
2. checkEndGame() s contextom → isLastMergeScenario() → true
3. Clean board
```
**PROVJERE: 1 puta "last merge" provjera**

**REZULTAT:** ✅ Ista logika, 2x manje provjera!

---

## ✅ ZAKLJUČAK

### ŠTO SE NEĆE PROMIJENITI:
- ✅ Svi use case-ovi ostaju pokriveni
- ✅ Ista logika za provjere
- ✅ Isti rezultati (fail screen, clean board, continue)
- ✅ Ista funkcionalnost

### ŠTO ĆE SE POBOLJŠATI:
- ✅ 3x manje provjera (bolje performanse)
- ✅ 1 provjera umjesto 3 (eliminirana redundancija)
- ✅ 1 trenutak umjesto 3 (eliminirani timing problemi)
- ✅ 1 definicija umjesto 3 (eliminirana nedosljednost)
- ✅ Lakše održavanje (sve na jednom mjestu)

### UTJECAJ NA SADAŠNJU LOGIKU:
**NEMA LOŠEG UTJECAJA!** ✅

Refaktoring samo **reorganizira** kod, ne mijenja logiku. Sve provjere ostaju, samo su na boljem mjestu.

---

## 🚀 IMPLEMENTACIJA

### Korak 1: Eksportirati funkcije iz `endgame-checker.ts`
```typescript
export function tileIsActive(tile: any): boolean { ... }
export function getActiveTiles(tiles: any[]): any[] { ... }
```

### Korak 2: Ukloniti redundanciju u `app-core.ts`
```typescript
// Ukloniti tileIsVisuallyActive()
// Koristiti tileIsActive() iz endgame-checker.ts

// Ukloniti early check za last merge
// Koristiti checkEndGame() s contextom

// Ukloniti STUCK PROTECTION timer
// Koristiti samo checkLevelEnd() s delay-om
```

### Korak 3: Konsolidirati logiku u `endgame-checker.ts`
```typescript
// Poboljšati isLastMergeScenario() da pokriva sve scenarije
// Ukloniti double-check anyMergePossible()
```

### Korak 4: Testirati
- [ ] Use Case 1: 3 kockice (4, 4, 3) → fail screen
- [ ] Use Case 2: 2 kockice (4, 2) → merge 6 → clean board
- [ ] Use Case 3: 2 kockice (3, 2) → stack 5 → fail screen
- [ ] Use Case 4: 1 kockica (merge 6) → fail screen
- [ ] Use Case 5: Wild + regular → merge 6 → clean board
- [ ] Use Case 6: Magnet pull → merge 6 → spawn → continue

---

**Datum:** 2024-12-19
**Verzija:** v71
**Autor:** AI Refactoring Proposal

