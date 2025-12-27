# 🔍 V112: End Game Provjere - Analiza i Konsolidacija Plan

**Datum:** 2025-12-27  
**Verzija:** v112  
**Cilj:** Konsolidirati end game provjere bez uništavanja logike

---

## 📊 TRENUTNO STANJE

### Centralizirani checker: `endgame-checker.ts`
- ✅ `checkEndGame()` - glavna funkcija za sve provjere
- ✅ `isLastMergeScenario()` - provjerava last merge
- ✅ `isBoardCleanCheck()` - provjerava clean board
- ✅ `isGameStuck()` - provjerava stuck state
- ✅ `isMovesDepleted()` - provjerava moves
- ✅ `needsEmergencyRescue()` - provjerava wild rescue

### Pozivi u `app-core.ts`:

#### 1. `checkLevelEnd()` (linija ~6420)
- **Status:** ✅ Koristi `checkEndGame()`
- **Lokacija:** Glavna funkcija za provjeru nakon merge-a
- **Timing:** Delay od `CHECK_LEVEL_END_DELAY_MS`
- **Action:** Poziva `checkEndGame()` s `forceRefresh: true`

#### 2. `checkMovesDepleted()` (linija ~6373)
- **Status:** ✅ Koristi `checkEndGame()`
- **Lokacija:** Provjerava kada moves = 0
- **Action:** Poziva `checkEndGame()` s `forceRefresh: true`

#### 3. Post-merge stuck check (linija ~3836)
- **Status:** ✅ Koristi `checkEndGame()`
- **Lokacija:** Nakon regular merge-a
- **Action:** Poziva `checkEndGame()` s `forceRefresh: true`

#### 4. Direct `anyMergePossible()` poziv (linija ~3698)
- **Status:** ⚠️ Direktan poziv, ne koristi `checkEndGame()`
- **Lokacija:** Post-merge check za 2+ tiles
- **Razlog:** Brza provjera prije stuck check-a
- **Action:** Može se zamijeniti sa `checkEndGame()` ali treba paziti na timing

#### 5. Last merge detekcija (linija ~4231)
- **Status:** ⚠️ Custom logika, ne koristi `checkEndGame()`
- **Lokacija:** Prije merge 6 animacije
- **Razlog:** Treba detektovati PRIJE animacije
- **Action:** Ova logika je specifična i treba ostati

---

## 🎯 PLAN KONSOLIDACIJE

### Faza 1: Dokumentacija (SADA)
- ✅ Napraviti ovu analizu
- ✅ Identificirati sve pozive

### Faza 2: Sigurne zamjene (OPREZNO)
- ⚠️ Zamijeniti direktni `anyMergePossible()` poziv (linija ~3698) sa `checkEndGame()`
- ⚠️ Provjeriti da li postoje drugi direktni pozivi koji se mogu zamijeniti

### Faza 3: Last merge logika (NE DIRATI)
- ❌ **NE DIRATI** last merge detekciju - ova logika je kritična i specifična
- ❌ **NE DIRATI** `_isLastMerge` flag logiku - koristi se na više mjesta

---

## ⚠️ UPOZORENJA

1. **Last merge logika je kritična** - ne mijenjati bez detaljne analize
2. **Timing je važan** - neke provjere se moraju desiti u specifičnom trenutku
3. **`_isLastMerge` flag** - koristi se na više mjesta, ne dirati
4. **Emergency rescue** - već koristi `needsEmergencyRescue()` iz `endgame-checker.ts`

---

## 📝 SLJEDEĆI KORACI

1. ✅ Napraviti ovu analizu
2. ✅ Pažljivo zamijeniti direktni `anyMergePossible()` poziv (linija ~3698) sa `checkEndGame()`
3. ✅ Dodati komentar za specifičnu provjeru unlocked tiles (linija ~6688)
4. ✅ Dokumentovati promjene

---

## ✅ ZAVRŠENO (v112)

### Promjene:
1. **Zamijenjen direktni `anyMergePossible()` poziv (linija ~3698)**
   - **Prije:** `const canStillMerge = makeBoard?.anyMergePossible?.(activeTilesBeforeCheck);`
   - **Poslije:** Koristi `checkEndGame()` sa `type === 'continue'` provjerom
   - **Razlog:** Konzistentnost - sve end game provjere koriste centralizirani checker
   - **Logika:** Sačuvana - provjerava se da li game može nastaviti prije stuck check-a

2. **Dodan komentar za specifičnu provjeru unlocked tiles (linija ~6688)**
   - **Razlog:** Ova provjera je specifična - provjerava samo unlocked tiles, ne sve tiles
   - **Status:** Ostavljena kako jeste jer je drugačija od standardne provjere

### Rezultat:
- ✅ Logika je sačuvana - nema promjene u funkcionalnosti
- ✅ Konzistentnost - većina provjera koristi `checkEndGame()`
- ✅ Dokumentacija - dodani komentari za specifične provjere

---

**Status:** ✅ Konsolidacija završena, logika sačuvana

