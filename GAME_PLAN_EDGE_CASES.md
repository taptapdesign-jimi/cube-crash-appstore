# Game Plan: Edge Cases za Wild Magnet Pull 4 Tiles

## 🎯 Cilj
Riješiti sve edge case-ove vezane za wild magnet pull funkcionalnost kako bi igra bila stabilna i ne bi se srušila u bilo kojoj situaciji.

---

## 📋 Identificirani Edge Case-ovi

### 1. **Magnet privlači wild kockice**
**Problem:** Kada magnet privuče wild kockice, igra se može srušiti jer wild kockice imaju posebnu logiku.

**Trenutno stanje:**
- Wild kockice se mogu privući (filter je uklonjen u liniji 1725 `app-core.ts`)
- Wild kockice se markiraju kao `_wildMagnetAffected = true`
- Wild kockice se uklanjaju u `mergePulledTilesIntoMerge6` funkciji

**Rizici:**
- Wild kockice mogu imati posebne animacije koje se ne zaustavljaju pravilno
- Wild kockice mogu imati `startWildShimmer` i `startWildStars` koje treba zaustaviti
- Wild kockice mogu biti u `STATE.tiles` ali ne u lokalnom `tiles` array-u

**Rješenje:**
- U `mergePulledTilesIntoMerge6`, prije uklanjanja wild kockica, zaustaviti sve wild animacije:
  - `stopWildShimmer(tile)` ako postoji
  - `stopWildIdle(tile)` ako postoji
  - `stopWildStars(tile)` ako postoji
- Provjeriti da li wild kockica ima `_wildShimmer` ili `_wildStars` i zaustaviti ih
- Osigurati da se wild kockice pravilno uklanjaju iz oba array-a (`tiles` i `STATE.tiles`)

---

### 2. **Edge case pred kraj igre: Magnet + Wild + Obična kockica**
**Problem:** Kada imamo magnet, wild kockice i običnu kockicu pred kraj igre, ne smije se napraviti fail screen ako stavljamo wild na kockice.

**Trenutno stanje:**
- `isBoardClean()` provjerava da li su sve kockice locked ili empty
- `checkGameOver()` provjerava da li je igra gotova
- `anyMergePossible()` provjerava da li postoje mogući merge-ovi

**Rizici:**
- Ako stavljamo wild na kockicu, treba spawnati novu kockicu
- Ako magnet privuče 4 kockice, treba spawnati 4 nove kockice
- Fail screen se ne smije pojaviti dok postoje mogući merge-ovi (wild može merge-ovati s bilo kojom kockicom)

**Rješenje:**
- U `mergePulledTilesIntoMerge6`, nakon što se uklone privučene kockice i dodaju animacije, spawnati 4 nove kockice
- Provjeriti da li su nove kockice mergable PRIJE nego što se pozove `checkGameOver()`
- Ako su mergable, igra se nastavlja
- Ako nisu mergable, tek onda pozvati `checkGameOver()` koji će pokazati fail screen

---

### 3. **Wild na kockicu spawna novu kockicu**
**Problem:** Kada stavljamo wild na kockicu, treba spawnati novu kockicu da igra može nastaviti.

**Trenutno stanje:**
- Wild merge (< 6) već spawna 1-2 nove kockice (linija 631-642 `app-merge.ts`)
- Wild merge 6 spawna kockice prema `REFILL_ON_SIX_BY_DEPTH` (linija 895 `app-merge.ts`)

**Rješenje:**
- Osigurati da wild merge (< 6) uvijek spawna barem 1 novu kockicu
- Osigurati da se spawn dešava PRIJE `checkGameOver()` poziva
- Provjeriti da li su spawnane kockice mergable

---

### 4. **Magnet privuče 4 kockice → spawna 4 nove**
**Problem:** Kada magnet privuče 4 kockice, treba spawnati 4 nove kockice nakon što se animacije završe.

**Trenutno stanje:**
- `mergePulledTilesIntoMerge6` uklanja privučene kockice i dodaje animacije
- **NEMA spawn logike** u `mergePulledTilesIntoMerge6` funkciji!

**Rješenje:**
- Dodati spawn logiku u `mergePulledTilesIntoMerge6` funkciju
- Spawnati 4 nove kockice nakon što se animacije završe
- Provjeriti da li su nove kockice mergable
- Ako su mergable, igra se nastavlja
- Ako nisu mergable, pozvati `checkGameOver()`

---

### 5. **Provjera mergability nakon spawn-a**
**Problem:** Nakon što se spawnaju nove kockice, treba provjeriti da li su mergable prije nego što se pozove `checkGameOver()`.

**Trenutno stanje:**
- `anyMergePossible()` provjerava da li postoje mogući merge-ovi
- `isStuck()` provjerava da li je igra stuck
- `checkGameOver()` poziva se nakon spawn-a

**Rješenje:**
- Nakon spawn-a 4 novih kockica, provjeriti `anyMergePossible(STATE.tiles)`
- Ako su mergable, igra se nastavlja (ne pozivati `checkGameOver()`)
- Ako nisu mergable, pozvati `checkGameOver()` koji će provjeriti `isStuck()` i pokazati fail screen ako je potrebno

---

## 🔧 Implementacijski Plan

### Korak 1: Zaštita wild kockica u `mergePulledTilesIntoMerge6`
**Lokacija:** `src/modules/app-merge.ts`, funkcija `mergePulledTilesIntoMerge6`

**Promjene:**
1. Prije uklanjanja privučenih kockica, provjeriti da li su wild kockice
2. Zaustaviti sve wild animacije:
   ```typescript
   // Import wild stop functions (already imported stopWildIdle, need to add others)
   import { stopWildIdle, stopWildShimmer, stopWildStars } from './fx.js';
   
   validTiles.forEach((tile: any) => {
     if (tile.special === 'wild' || tile.special === 'wild-magnet') {
       // Stop all wild animations
       try { stopWildIdle(tile); } catch {}
       try { stopWildShimmer(tile); } catch {}
       try { stopWildStars(tile); } catch {}
       
       // Clear wild state (already exists in app-merge.ts)
       clearWildState(tile);
     }
   });
   ```

---

### Korak 2: Dodati spawn logiku u `mergePulledTilesIntoMerge6`
**Lokacija:** `src/modules/app-merge.ts`, funkcija `mergePulledTilesIntoMerge6`

**Promjene:**
1. Nakon što se animacije završe, spawnati 4 nove kockice:
   ```typescript
   // After animations complete, spawn 4 new tiles
   try {
     await openEmpties(4);
     console.log('✅ Spawned 4 new tiles after pulled tiles merge 6');
   } catch (error) {
     console.error('❌ Failed to spawn tiles after pulled tiles merge 6:', error);
   }
   ```

2. Provjeriti mergability nakon spawn-a:
   ```typescript
   // Check if new tiles are mergable AFTER spawn completes
   // Wait a bit for spawn animations to complete
   setTimeout(async () => {
     const areMergable = makeBoard.anyMergePossible(STATE.tiles);
     console.log('🧲 Mergability check after spawn:', areMergable);
     
     if (!areMergable) {
       console.log('⚠️ New tiles are not mergable, checking game over...');
       // Import checkGameOver if needed
       const { checkGameOver } = await import('./app-merge');
       if (typeof checkGameOver === 'function') {
         checkGameOver();
       }
     } else {
       console.log('✅ New tiles are mergable, game continues');
     }
   }, 800); // Wait 800ms for spawn animations to complete
   ```

---

### Korak 3: Osigurati da wild merge spawna novu kockicu
**Lokacija:** `src/modules/app-merge.ts`, funkcija `merge` (linija 631-642)

**Trenutno stanje:**
- Wild merge (< 6) već spawna 1-2 nove kockice
- Provjeriti da li se spawn dešava uvijek, čak i ako je board clean

**Promjene:**
- Osigurati da se spawn dešava PRIJE `checkGameOver()` poziva
- Provjeriti mergability nakon spawn-a

---

### Korak 4: Poboljšati `checkGameOver()` logiku
**Lokacija:** `src/modules/app-merge.ts`, funkcija `checkGameOver`

**Trenutno stanje:**
- `checkGameOver()` provjerava `anyMergePossible()` prije nego što pokaže fail screen
- Ako postoje wild kockice i non-wild kockice, igra se nastavlja

**Promjene:**
- Osigurati da se `checkGameOver()` ne poziva dok se spawn dešava
- Dodati flag `_spawningInProgress` da se spriječi pozivanje `checkGameOver()` tijekom spawn-a
- Provjeriti mergability nakon što se spawn završi

---

### Korak 5: Poboljšati `isBoardClean()` logiku
**Lokacija:** `src/modules/app-core.ts`, funkcija `isBoardClean`

**Trenutno stanje:**
- `isBoardClean()` provjerava da li su sve kockice locked ili empty
- Ne uzima u obzir da se kockice mogu spawnati

**Promjene:**
- Osigurati da se `isBoardClean()` ne poziva dok se spawn dešava
- Provjeriti da li postoje locked kockice koje se mogu spawnati

---

## 🧪 Test Scenariji

### Test 1: Magnet privlači 4 wild kockice
**Koraci:**
1. Stvori magnet tile
2. Stvori 4 wild kockice na boardu
3. Spusti magnet na običnu kockicu
4. Provjeri da se wild kockice privuku bez crash-a
5. Provjeri da se animacije završe bez crash-a
6. Provjeri da se spawnaju 4 nove kockice

**Očekivani rezultat:**
- Wild kockice se privuku bez crash-a
- Animacije se završe bez crash-a
- Spawnaju se 4 nove kockice
- Igra se nastavlja ako su nove kockice mergable

---

### Test 2: Edge case pred kraj - Magnet + Wild + Obična
**Koraci:**
1. Stvori situaciju gdje imamo magnet, wild kockicu i običnu kockicu
2. Spusti wild na običnu kockicu
3. Provjeri da se spawna nova kockica
4. Provjeri da se ne pojavi fail screen
5. Spusti magnet na običnu kockicu
6. Provjeri da se privuku kockice
7. Provjeri da se spawnaju 4 nove kockice
8. Provjeri da se ne pojavi fail screen ako su mergable

**Očekivani rezultat:**
- Wild na kockicu spawna novu kockicu
- Ne pojavljuje se fail screen dok postoje mogući merge-ovi
- Magnet privuče kockice i spawna 4 nove
- Fail screen se pojavi samo ako nove kockice nisu mergable

---

### Test 3: Nemergable kockice nakon spawn-a
**Koraci:**
1. Stvori situaciju gdje magnet privuče 4 kockice
2. Nakon spawn-a, provjeri da li su nove kockice mergable
3. Ako nisu mergable (npr. 3, 5, 5, 4), provjeri da se pojavi fail screen

**Očekivani rezultat:**
- Spawnaju se 4 nove kockice
- Provjerava se mergability
- Ako nisu mergable, pojavljuje se fail screen
- Ako su mergable, igra se nastavlja

---

## 📝 Checklist za Implementaciju

- [ ] **Korak 1:** Dodati zaštitu wild kockica u `mergePulledTilesIntoMerge6`
  - [ ] Importovati `stopWildShimmer`, `stopWildIdle`, `stopWildStars`, `clearWildState`
  - [ ] Zaustaviti sve wild animacije prije uklanjanja
  - [ ] Testirati da wild kockice ne crashaju igru

- [ ] **Korak 2:** Dodati spawn logiku u `mergePulledTilesIntoMerge6`
  - [ ] Spawnati 4 nove kockice nakon animacija
  - [ ] Provjeriti mergability nakon spawn-a
  - [ ] Pozvati `checkGameOver()` samo ako nisu mergable
  - [ ] Testirati da se spawn dešava pravilno

- [ ] **Korak 3:** Osigurati da wild merge spawna novu kockicu
  - [ ] Provjeriti da se spawn dešava uvijek
  - [ ] Provjeriti mergability nakon spawn-a
  - [ ] Testirati da se ne pojavi fail screen dok postoje mogući merge-ovi

- [ ] **Korak 4:** Poboljšati `checkGameOver()` logiku
  - [ ] Dodati flag `_spawningInProgress`
  - [ ] Spriječiti pozivanje `checkGameOver()` tijekom spawn-a
  - [ ] Provjeriti mergability nakon spawn-a
  - [ ] Testirati da se fail screen ne pojavi tijekom spawn-a

- [ ] **Korak 5:** Poboljšati `isBoardClean()` logiku
  - [ ] Provjeriti da li postoje locked kockice
  - [ ] Ne pozivati `isBoardClean()` tijekom spawn-a
  - [ ] Testirati da se clean board flow ne pokrene tijekom spawn-a

---

## 🔍 Ključne Funkcije za Pregled

1. **`mergePulledTilesIntoMerge6`** (`src/modules/app-merge.ts:226`)
   - Uklanja privučene kockice
   - Dodaje animacije
   - **TREBA:** Dodati spawn logiku

2. **`openEmpties`** (`src/modules/app-spawn.ts:165`)
   - Spawna nove kockice
   - Koristi locked kockice kao spawn lokacije

3. **`anyMergePossible`** (`src/modules/board.ts:396`)
   - Provjerava da li postoje mogući merge-ovi
   - Uzima u obzir wild kockice

4. **`checkGameOver`** (`src/modules/app-merge.ts:1000+`)
   - Provjerava da li je igra gotova
   - Poziva `anyMergePossible()` prije nego što pokaže fail screen

5. **`isBoardClean`** (`src/modules/app-core.ts:2441`)
   - Provjerava da li je board clean
   - Ne uzima u obzir spawn u tijeku

---

## ⚠️ Potencijalni Rizici

1. **Race condition:** Spawn i `checkGameOver()` mogu se pozvati istovremeno
   - **Rješenje:** Koristiti flag `_spawningInProgress`

2. **Wild animacije:** Wild kockice mogu imati animacije koje se ne zaustavljaju
   - **Rješenje:** Eksplicitno zaustaviti sve wild animacije

3. **Grid sync:** Grid i STATE.tiles mogu biti out of sync
   - **Rješenje:** Provjeriti da su oba array-a ažurirana

4. **Spawn timing:** Spawn se može desiti prije nego što se animacije završe
   - **Rješenje:** Spawnati nakon što se animacije završe (koristiti `setTimeout` ili `await`)

---

## 📊 Prioritet Implementacije

1. **VISOKI PRIORITET:**
   - Zaštita wild kockica u `mergePulledTilesIntoMerge6`
   - Dodati spawn logiku u `mergePulledTilesIntoMerge6`

2. **SREDNJI PRIORITET:**
   - Poboljšati `checkGameOver()` logiku
   - Poboljšati `isBoardClean()` logiku

3. **NISKI PRIORITET:**
   - Optimizacija spawn timing-a
   - Dodatni error handling

---

## 🎯 Konačni Cilj

Osigurati da:
1. ✅ Magnet može privući wild kockice bez crash-a
2. ✅ Wild na kockicu spawna novu kockicu
3. ✅ Magnet privuče 4 kockice → spawna 4 nove kockice
4. ✅ Fail screen se ne pojavljuje dok postoje mogući merge-ovi
5. ✅ Fail screen se pojavljuje samo kada su nove kockice nemergable

---

## 📚 Reference

- `src/modules/app-merge.ts` - Merge logika
- `src/modules/app-core.ts` - Core game logika
- `src/modules/app-spawn.ts` - Spawn logika
- `src/modules/board.ts` - Board utilities
- `src/modules/app-board.js` - Board state management

