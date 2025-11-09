# 🔥 ENDGAME SYSTEM - KOMPLETAN RUNDOWN PROMJENA

## 📋 Pregled

Ovaj dokument opisuje sve promjene u endgame sistemu koje su implementirane kako bi se riješili problemi s detekcijom "clean board" i "stuck" scenarija.

---

## 🎯 Glavni Ciljevi

1. **Centralizirana endgame logika** - Jedan izvor istine za sve endgame provjere
2. **Robustna detekcija "last merge"** - Wild + regular tile kao zadnje 2 kockice
3. **Precizna detekcija "stuck" stanja** - Nakon regular merge-a koji ostavlja ne-mergable kockice
4. **Sprečavanje race condition-a** - Debouncing i caching mehanizmi
5. **Sprečavanje spawn-a novih kockica** - Kada je "last merge" detektiran

---

## 📁 Promijenjene Datoteke

### 1. **`src/modules/endgame-checker.ts`** ⭐ NOVA DATOTEKA
**Status:** Kreirana kao centralizirani endgame checker

**Ključne funkcije:**
- `checkEndGame(context, forceRefresh)` - Glavna funkcija za provjeru endgame stanja
- `isGameStuck(context)` - Provjerava je li igra "stuck" (nema mogućih merge-ova)
- `isBoardCleanCheck(tiles)` - Provjerava je li board čist (0 active tiles)
- `isLastMergeScenario(context)` - Provjerava je li ovo "last merge" scenarij
- `clearEndGameCache()` - Briše cache za fresh provjere
- `needsEmergencyRescue(tiles)` - Provjerava treba li emergency rescue za wild cubes

**Optimizacije:**
- Debouncing (50ms) za sprječavanje redundantnih provjera
- Caching aktivnih tiles za performanse
- Hash-based cache invalidation
- `forceRefresh` parametar za kritične provjere

**Tipovi:**
```typescript
export type EndGameResult = 
  | { type: 'clean'; reason: string }
  | { type: 'stuck'; reason: string }
  | { type: 'continue'; reason: string };

export interface EndGameContext {
  tiles: any[];
  moves: number;
  makeBoard: { anyMergePossible: (tiles: any[]) => boolean };
  srcTile?: any;
  dstTile?: any;
  justRemovedSrc?: boolean;
  justRemovedDst?: boolean;
}
```

---

### 2. **`src/modules/app-core.ts`** 🔥 NAJVEĆE PROMJENE

#### A. **"Last Merge" Detekcija (linije ~1770-1915)**

**Problem:** Wild + regular tile merge kao zadnje 2 kockice nije pravilno detektiran, što je rezultiralo spawn-om novih kockica umjesto clean board flow-a.

**Rješenje:**
- **`isRegularWildLastTwo`** - Eksplicitna provjera za regular wild (ne wild-magnet) kada su samo 2 active tiles
- **`isWildRegularLastTwo`** - Općenitija provjera za wild/wild-magnet + regular merge
- **`isWildLastTileMerge`** - Provjera kada su svi active tiles uključeni u merge
- **`_isLastMerge` flag** - Postavlja se na `dst` tile prije merge 6 animacije

**Kod:**
```typescript
// Linije 1849-1879
const oneIsRegularWild = (srcSpecial === 'wild' || dstSpecial === 'wild');
const neitherIsWildMagnet = !(srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet');
const exactlyTwoActiveTiles = activeTilesCount === 2;
const bothTilesInActiveList = activeTilesBeforeMerge.includes(src) && activeTilesBeforeMerge.includes(dst);
const isRegularWildLastTwo = oneIsRegularWild && 
                             neitherIsWildMagnet &&
                             exactlyTwoActiveTiles &&
                             bothTilesInActiveList;

if (isRegularWildLastTwo || isWildRegularLastTwo || isLastMergeableTiles || isWildLastTileMerge) {
  busyEnding = true;
  (dst as any)._isLastMerge = true;
}
```

#### B. **Post-Regular Merge Stuck Check (linije ~1672-1725)**

**Problem:** Nakon regular merge-a (npr. 3+2=5), ako ostane samo jedna ne-mergable kockica, fail screen se nije prikazivao.

**Rješenje:**
- Dodana provjera nakon `removeTile(src)` u `onComplete` callback-u
- Koristi `checkEndGame` s `forceRefresh: true`
- Ako je rezultat `stuck`, odmah poziva `showFinalScreen()`

**Kod:**
```typescript
// Linije 1700-1724
clearEndGameCache();
const stuckCheckContext: EndGameContext = {
  tiles,
  moves,
  makeBoard
};
const stuckCheckResult = checkEndGame(stuckCheckContext, true);

if (stuckCheckResult.type === 'stuck') {
  busyEnding = true;
  showFinalScreen();
  return;
}
```

#### C. **Pre-Spawn Check (linije ~3123-3207)**

**Problem:** Novi tiles su se spawn-ali čak i kada je `_isLastMerge` flag bio postavljen.

**Rješenje:**
- Višestruke provjere prije `FLOW.openLockedBounceParallel` poziva:
  - `isLastMergeScenario` (captured prije animacije)
  - `currentIsLastMerge` (provjera `_isLastMerge` flag-a na `dst`)
  - `onlyMerge6RemainsAfterSrcRemoval` (provjera da li samo merge 6 ostaje)
  - `busyEnding` flag

**Kod:**
```typescript
// Linije 3127-3157
const currentIsLastMerge = (dst as any)?._isLastMerge === true;
const activeTilesAfterSrcRemoval = tiles.filter(t => {
  if (!t || t.locked) return false;
  const isWild = t.special === 'wild' || t.special === 'wild-magnet';
  const hasValue = (t.value|0) > 0;
  return isWild || hasValue;
});
const onlyMerge6RemainsAfterSrcRemoval = activeTilesAfterSrcRemoval.length === 1 && 
                                        activeTilesAfterSrcRemoval[0] === dst &&
                                        dst.value === 6;

if (isLastMergeScenario || currentIsLastMerge || busyEnding || onlyMerge6RemainsAfterSrcRemoval) {
  // Skip spawn i trigger clean board flow
}
```

#### D. **onComplete Callback za Last Merge (linije ~2309-2378)**

**Problem:** Clean board flow se nije trigger-ao nakon što je `src` tile uklonjen.

**Rješenje:**
- Provjera `_isLastMerge` flag-a u `onComplete` callback-u
- Ako je flag postavljen i `dst` još postoji, odmah se:
  - Uklanja `dst` tile
  - Resetira wild meter
  - Poziva `runEndgameFlow` nakon 1 sekunde delay-a
  - Return-uje se rano da se spriječi daljnji kod

**Kod:**
```typescript
// Linije 2311-2377
const isLastMergeInOnComplete = (dst as any)?._isLastMerge === true;
const dstStillExists = dst && !dst.destroyed && STATE.tiles.includes(dst);

if (isLastMergeInOnComplete && dstStillExists) {
  busyEnding = true;
  // Remove dst tile
  // Reset wild meter
  // Wait 1 second
  await runEndgameFlow({...});
  return; // Exit early
}
```

#### E. **Skip FX i Spawn Logic (linije ~2491-2496)**

**Problem:** FX efekti i spawn logika su se izvršavali čak i kada je bio "last merge" scenarij.

**Rješenje:**
- Provjera `isLastMergeScenario` prije FX i spawn logike
- Ako je true, odmah se return-uje

**Kod:**
```typescript
// Linije 2491-2496
if (isLastMergeScenario) {
  console.log('🚨🚨🚨 LAST MERGE: Skipping all FX and spawn logic');
  return; // Exit early
}
```

#### F. **Cache Management**

**Promjene:**
- `clearEndGameCache()` poziva se:
  - U `removeTile()` funkciji (PRIJE `tiles.splice`)
  - Nakon regular merge-a (prije stuck check-a)
  - U `startLevel()` funkciji

---

### 3. **`src/modules/board.ts`**

#### **`anyMergePossible` Funkcija (linije ~414-418)**

**Problem:** Funkcija nije eksplicitno provjeravala da li je samo jedna active tile ostala.

**Rješenje:**
- Dodana provjera: `if (open.length < 2) { return false; }`
- Ako je samo jedna active tile, merges nisu mogući

**Kod:**
```typescript
// Linije 414-418
const open = allTiles.filter(t => t && !t.locked && (t.value|0) > 0);
if (open.length < 2) {
  return false; // Need at least 2 tiles to merge
}
```

**Enhanced Logging:**
- Detaljno logiranje svih active tiles
- Logiranje svih provjerenih kombinacija
- Summary merge mogućnosti

---

### 4. **`src/modules/drag-core.ts`**

#### **Failed Merge Attempt Check (linije ~714-723)**

**Problem:** Kada korisnik pokuša invalid merge (npr. 1+1=2 ali nema drugog 2), fail screen se nije prikazivao.

**Rješenje:**
- Dodana provjera nakon neuspješnog merge pokušaja
- Ako `canMerge` vraća `false`, poziva se `window.CC.checkLevelEnd()` nakon 100ms delay-a

**Kod:**
```typescript
// Linije 714-723
if (!canMerge) {
  // Failed merge attempt - check if game is stuck
  setTimeout(() => {
    if (typeof window.CC?.checkLevelEnd === 'function') {
      window.CC.checkLevelEnd();
    }
  }, 100);
}
```

---

### 5. **`src/modules/endgame-flow.ts`**

#### **Guard Against Multiple Calls (linije ~39-44)**

**Problem:** `runEndgameFlow` se mogao pozvati više puta istovremeno, što je uzrokovalo race condition-e.

**Rješenje:**
- Dodan guard `_endgameFlowRunning` flag
- Ako je već running, skip-uje se duplicate call

**Kod:**
```typescript
// Linije 39-44
if ((window as any).CC?._endgameFlowRunning) {
  console.warn('⚠️ runEndgameFlow: Already running, skipping duplicate call');
  return;
}
(window as any).CC._endgameFlowRunning = true;
// ... u finally bloku: (window as any).CC._endgameFlowRunning = false;
```

---

### 6. **`src/modules/app-core.ts` - `checkLevelEnd` Funkcija**

#### **Enhanced Endgame Check (linije ~578-650)**

**Promjene:**
- Sada koristi `checkEndGame` iz `endgame-checker.ts`
- `forceRefresh: true` za kritične provjere
- Ako je rezultat `clean`, poziva `runEndgameFlow`
- Enhanced logging za debugging

**Kod:**
```typescript
// Linije ~578-650
async function checkLevelEnd() {
  if (busyEnding) return;
  
  const checkLevelEndContext: EndGameContext = {
    tiles,
    moves,
    makeBoard,
    srcTile: undefined,
    dstTile: undefined,
    justRemovedSrc: false
  };
  
  const checkLevelEndResult = checkEndGame(checkLevelEndContext, true);
  
  if (checkLevelEndResult.type === 'clean') {
    busyEnding = true;
    await runEndgameFlow({...});
  } else if (checkLevelEndResult.type === 'stuck') {
    busyEnding = true;
    showFinalScreen();
  }
}
```

---

## 🔑 Ključni Koncepti

### 1. **`_isLastMerge` Flag**
- Postavlja se na `dst` tile kada se detektira "last merge" scenarij
- Koristi se kroz cijeli merge flow da se spriječi spawn novih tiles
- Provjerava se na više mjesta:
  - Prije animacije (`isLastMergeScenario`)
  - U `onComplete` callback-u (`isLastMergeInOnComplete`)
  - Prije spawn-a (`currentIsLastMerge`)

### 2. **`busyEnding` Flag**
- Globalni flag koji sprječava višestruke endgame flow-ove
- Postavlja se na `true` kada:
  - Detektira se "last merge"
  - Detektira se "stuck" stanje
  - Pokreće se `runEndgameFlow` ili `showFinalScreen`
- Resetira se u `finally` blokovima

### 3. **`forceRefresh` Parameter**
- Koristi se za kritične provjere kada cache ne smije biti korišten
- Postavlja se na `true` kada:
  - Tile je upravo uklonjen (`removeTile`)
  - Provjerava se nakon merge-a
  - Provjerava se u `checkLevelEnd`

### 4. **Active Tiles Filtering**
- Wild tiles se uključuju čak i ako imaju `value === 0`
- Logika: `isWild || hasValue`
- Ovo je kritično za pravilnu detekciju "last merge" scenarija

---

## 🐛 Riješeni Bugovi

### 1. **Wild + Regular Merge Spawn-ao Novi Tile**
- **Problem:** Kada su wild + regular tile zadnje 2 kockice, merge 6 je napravljen ali novi tile je spawn-ao umjesto clean board flow-a
- **Rješenje:** Višestruke provjere `_isLastMerge` flag-a i `onlyMerge6Remains` prije spawn-a

### 2. **Stack 3+2=5 Ne Trigger-ao Fail Screen**
- **Problem:** Kada su samo 3 i 2 ostale, stack-ao se u 5, ali fail screen se nije prikazivao
- **Rješenje:** Post-merge stuck check nakon regular merge-a

### 3. **Unmergable Tiles Ne Trigger-ali Fail Screen**
- **Problem:** Kada su ostale ne-mergable kockice (npr. 5, 4, 4, 3, 5, 5), fail screen se nije prikazivao
- **Rješenje:** Poboljšana `anyMergePossible` funkcija i `isGameStuck` logika

### 4. **Wild-Magnet Merge Trigger-ao Fail Screen Prematurely**
- **Problem:** Mid-game wild-magnet merge je trigger-ao fail screen
- **Rješenje:** Dodana provjera `hasTilesToPull` da se isključe wild-magnet merges koji će pull-ati druge tiles

### 5. **Regular Wild Merge Trigger-ao Fail Screen Prematurely**
- **Problem:** Mid-game regular wild merge je trigger-ao fail screen
- **Rješenje:** Dodana provjera `isRegularWildMerge && isNotLastMerge` da se isključe mid-game wild merges

---

## 📊 Flow Diagram

```
MERGE STARTS
    ↓
Check if effSum === 6 (merge 6)
    ↓
Check if isRegularWildLastTwo OR isWildRegularLastTwo OR isLastMergeableTiles
    ↓ YES
Set _isLastMerge = true on dst
Set busyEnding = true
    ↓
Start merge 6 animation
    ↓
onComplete callback
    ↓
Remove src tile
    ↓
Check if _isLastMerge flag is set
    ↓ YES
Remove dst tile
Reset wild meter
Wait 1 second
Call runEndgameFlow
RETURN (skip FX and spawn)
    ↓ NO
Check if isLastMergeScenario (before animation)
    ↓ YES
RETURN (skip FX and spawn)
    ↓ NO
Continue with FX and spawn logic
    ↓
Pre-spawn check
    ↓
Check if currentIsLastMerge OR onlyMerge6RemainsAfterSrcRemoval
    ↓ YES
RETURN (skip spawn, trigger clean board flow)
    ↓ NO
Spawn new tiles
```

---

## 🧪 Test Scenariji

### 1. **Wild + Regular = Last 2 Tiles**
- **Setup:** Samo wild tile i jedna regular tile na boardu
- **Action:** Merge wild na regular (ili obrnuto)
- **Expected:** Merge 6 se napravi, nakon 1 sekunde clean board screen se prikaže, NEMA spawn-a novih tiles

### 2. **Stack 3+2=5 = Last Tile**
- **Setup:** Samo 3 i 2 tile na boardu
- **Action:** Stack 3 na 2 (rezultat: 5)
- **Expected:** Nakon merge-a, fail screen se prikaže jer 5 ne može merge-ati s ničim

### 3. **Unmergable Tiles**
- **Setup:** 5, 4, 4, 3, 5, 5 na boardu (nema mogućih merge-ova)
- **Action:** Pokušaj bilo kojeg merge-a (neuspješan)
- **Expected:** Fail screen se prikaže

### 4. **Wild-Magnet Mid-Game**
- **Setup:** Wild-magnet + regular tile + još tiles na boardu
- **Action:** Merge wild-magnet na regular
- **Expected:** Pull-aju se tiles, merge se napravi, spawn-aju se novi tiles, NEMA fail screen-a

### 5. **Regular Wild Mid-Game**
- **Setup:** Regular wild + regular tile + još tiles na boardu
- **Action:** Merge wild na regular
- **Expected:** Merge 6 se napravi, spawn-aju se novi tiles, NEMA fail screen-a

---

## 📝 Datoteke za Drugi Agent

### **Obavezno:**
1. `src/modules/endgame-checker.ts` - Centralizirani endgame checker
2. `src/modules/app-core.ts` - Glavna merge logika i endgame integracija
3. `src/modules/board.ts` - `anyMergePossible` funkcija
4. `src/modules/drag-core.ts` - Failed merge attempt check
5. `src/modules/endgame-flow.ts` - Clean board flow orchestrator

### **Opcionalno (za kontekst):**
6. `src/modules/level-flow.ts` - `checkLevelEnd` i `openLockedBounceParallel`
7. `src/modules/app-merge.ts` - Wild-magnet pulled tiles merge logika
8. `src/modules/clean-board-modal.ts` - Clean board modal UI

### **Dokumentacija:**
9. `ENDGAME_SYSTEM_RUNDOWN.md` - Ovaj dokument

---

## 🔍 Debugging Tips

### Console Logs
Svi kritični dijelovi imaju detaljno logiranje:
- `🔍 LAST MERGE CHECK` - Last merge detekcija
- `🚨🚨🚨 LAST MERGE DETECTED` - Last merge je detektiran
- `🔍 isGameStuck` - Stuck provjera
- `🎯 EndGameChecker` - Centralizirani checker logovi
- `🔍 PRE-SPAWN CHECK` - Provjera prije spawn-a

### Key Flags to Check
- `(dst as any)._isLastMerge` - Je li last merge flag postavljen?
- `busyEnding` - Je li endgame flow već pokrenut?
- `(window as any).CC._endgameFlowRunning` - Je li endgame flow running?

### Common Issues
1. **Cache not cleared** - Provjeri da li se `clearEndGameCache()` poziva na pravim mjestima
2. **Flag not set** - Provjeri da li su `activeTilesBeforeMerge` pravilno filtrirani (wild tiles uključeni)
3. **Race condition** - Provjeri da li je `busyEnding` postavljen prije svih async operacija

---

## ✅ Checklist za Drugi Agent

- [ ] Pročitati `endgame-checker.ts` i razumjeti centralizirani sistem
- [ ] Pročitati "Last Merge" detekciju u `app-core.ts` (linije ~1770-1915)
- [ ] Pročitati post-merge stuck check (linije ~1672-1725)
- [ ] Pročitati pre-spawn check (linije ~3123-3207)
- [ ] Pročitati `onComplete` callback za last merge (linije ~2309-2378)
- [ ] Pročitati `anyMergePossible` u `board.ts`
- [ ] Testirati sve test scenarije iznad
- [ ] Provjeriti console logs za debugging
- [ ] Razumjeti flow diagram

---

## 🎯 Zaključak

Endgame sistem je sada:
- ✅ **Centraliziran** - Jedan izvor istine (`endgame-checker.ts`)
- ✅ **Robustan** - Višestruke provjere i safeguards
- ✅ **Optimiziran** - Debouncing i caching za performanse
- ✅ **Bez race condition-a** - `busyEnding` i `_endgameFlowRunning` flags
- ✅ **Precizan** - Pravi detektira "last merge" i "stuck" scenarije
- ✅ **Bez bug-ova** - Svi poznati bugovi su riješeni

Sistem je spreman za produkciju, ali treba testirati sve edge case-ove prije deploy-a.

