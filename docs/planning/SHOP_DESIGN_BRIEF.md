# Cube Crash – Shop Design Brief

**Svrha dokumenta:** Ovaj dokument opisuje igru Cube Crash, igrivost, wild sustav i zvjezdice kako bi drugi agent mogao dizajnirati logičan shop i mehaniku korištenja kupovnih predmeta (npr. dodatni wildovi) u igri.

---

## 1. Pregled igre

**Cube Crash** je merge puzzle igra (slično 2048 / Merge Cube):

- **Grid:** 4×6 ploča s kockicama (tiles)
- **Cilj:** Spajati kockice do vrijednosti 6 (merge 6), čistiti ploču i prelaziti na sljedeći board
- **Potezi:** Ograničen broj poteza (npr. 50 po boardu)
- **Game over:** Kad ponestane poteza ili kad nema više mogućih mergeova

---

## 2. Osnovna igrivost

### 2.1 Merge mehanika

- Kockice imaju vrijednosti **1–5**
- **Merge:** Dvije kockice iste vrijednosti ili čiji zbroj ≤ 6 mogu se spojiti
- **Merge 6:** Kada zbroj = 6 (npr. 3+3, 4+2, 5+1), kockice nestaju i ostavljaju prazno polje
- **Spawn:** Nakon merge 6, na prazna mjesta se spawnaju nove kockice (1–5)

### 2.2 Potezi i game over

- Svaki drag & drop = 1 potez
- Broj poteza se smanjuje pri svakom mergeu
- **Fail:** Kad potezi = 0 ili kad `anyMergePossible()` vrati false (nema više mogućih mergeova)
- **Clean board:** Kad se sve kockice uspješno očiste, igrač prelazi na sljedeći board

### 2.3 Score i combo

- Bodovi za merge
- Combo multiplier za uzastopne mergeove
- High score se sprema po boardu

---

## 3. Wild sustav

### 3.1 Što su wildovi?

Wildovi su posebne kockice koje mogu spojiti s **bilo kojom** redovnom kockicom (1–5) i uvijek daju merge 6.

**Tipovi wildova:**

| Tip | Opis | Efekt pri merge 6 |
|-----|------|-------------------|
| **Wild star** (zvjezdica) | Osnovni wild | Spawn 3 nove kockice; 3 zvjezdice lete u HUD |
| **Wild juice** | Narančasti sok | Bubble animacija; spawn 3 kockice |
| **Wild magnet** | Magnet | Privuče do 4 susjedne kockice, sve se mergeaju; spawn novih kockica = broj privučenih |
| **Wild TNT** | Eksplozija | Razbije 2 susjedne kockice; dodatni wild meter progress |

### 3.2 Kako se wildovi dobivaju (trenutno)

**Wild meter (progress bar):**

- Puna se mergiranjem (addWildProgress)
- Kad dosegne 100%, spawna se **1 wild** na slučajno prazno polje
- Tip wilda je **slučajan** (decideWildType):
  - ~50% wild star
  - ~16.67% wild juice
  - ~16.67% wild magnet
  - ~16.66% wild TNT

**Ograničenja:**

- Wild meter i spawn mogu biti onemogućeni po boardu (board-specific rules)
- Wild se ne spawna tijekom last merge (2 kockice → clean board)
- Wild se ne spawna kad je fail screen aktivan

### 3.3 Wild merge 6 → zvjezdice (stars)

- Kad **wild star** napravi merge 6, 3 zvjezdice animiraju prema HUD ikoni
- `addStars(1)` se poziva 3 puta → **+3 stars** u valutu
- Wild juice, magnet, TNT nemaju ovaj efekt (samo wild star daje stars)

### 3.4 Tehnički API za spawn wilda

```typescript
// openAtCell(c, r, options) – spawna kockicu na ćeliju (c, r)
// Opcije za wild:
openAtCell(c, r, {
  isWild: true,           // wild star
  isWildMagnet: true,     // wild magnet
  isWildJuice: true,      // wild juice
  isWildTnt: true,        // wild TNT
});
```

- Mora postojati **prazna ćelija** (locked placeholder ili null)
- `getRandomEmptyCell()` vraća slučajnu praznu ćeliju

---

## 4. Zvjezdice (Stars) – soft valuta

### 4.1 Kako se dobivaju

- **Samo** kad wild star napravi merge 6 → +3 stars (animacija 3 zvjezdice prema HUD-u)
- Nema drugog izvora stars u igri (trenutno)

### 4.2 Kako se koriste

- Trenutno: **samo prikaz** u HUD-u (stars count)
- Sprema se u game state (`starsCount`)
- **Nema shopa** – stars se ne troše

### 4.3 API

- `getStarsCount()` – trenutni broj
- `addStars(n)` – dodaj
- `setStarsCount(n)` – postavi (npr. load iz savea)

---

## 5. Trenutni flow (bez shopa)

```
Home → Journey (boardi) → Tap board → Board transition → Game
  → Igra: merge, wild meter se puni, wild spawna, stars se skupljaju
  → Fail ili Clean board → End run modal / Clean board modal
  → Povratak na Journey ili Home
```

**HUD tijekom igre:**

- Score, Combo, Stars count
- Wild meter (progress bar)
- X gumb (end run)
- Board broj

---

## 6. Cilj: Shop koji ima smisla

### 6.1 Zašto shop?

- Korisnik može **kupiti** predvidive boostere umjesto da čeka random wild iz metera
- **Value:** kontrola nad **kada** koristiti booster (npr. kad je stuck ili pred teški merge)

### 6.2 Dva kanala valute

| Valuta | Izvor | Namjena |
|--------|-------|---------|
| **Stars** | Wild star merge 6 | Soft valuta – kupnja u shopu (npr. wildovi, moves) |
| **Real money (IAP)** | Kupnja | Hard valuta – stars packovi, premium predmeti, remove ads |

### 6.3 Predloženi shop predmeti

| Predmet | Cijena (stars) | Cijena (IAP) | Efekt |
|---------|-----------------|-------------|-------|
| 1× Wild | 10 stars | $0.99 | +1 wild u inventory |
| 3× Wild pack | 25 stars | $1.99 | +3 wild u inventory |
| Extra moves (10) | 15 stars | $0.99 | +10 poteza |
| Wild tip po izboru | 20 stars | $1.99 | +1 wild (magnet/juice/TNT) u inventory |

---

## 7. Mehanika korištenja – inventory → in-game

### 7.1 Inventory

- Kupovni predmeti idu u **inventory** (npr. `inventoryWilds: number`, `inventoryMoves: number`)
- Sprema se u game state (persistent)

### 7.2 Korištenje wilda iz inventorya

**Flow:**

1. Korisnik ima `inventoryWilds > 0`
2. Tijekom igre vidi gumb **"Use Wild"** (npr. uz wild meter u HUD-u)
3. Tapne "Use Wild" → ulazi u **placement mode**
4. Odabere praznu ćeliju (tap na board) ili auto-pick prve prazne
5. `openAtCell(c, r, { isWild: true })` ili s odabranim tipom
6. `inventoryWilds--`
7. Wild se spawna na board

**Alternativa – po tipu:**

- Shop: "Kupi Wild Magnet" → inventory: `inventoryWildMagnets: 1`
- Use: spawn s `isWildMagnet: true`

### 7.3 Korištenje extra moves

- Kad potezi padnu na 0 ili blizu, može se prikazati "Use +10 moves?"
- Ako ima u inventoryu: `moves += 10`, `inventoryMoves -= 10`

---

## 8. Integracijski točke u kodu

### 8.1 Inventory state

- Dodati u `game state` / `app-state`: `inventoryWilds`, `inventoryMoves`, itd.
- Spremati u `app-core-save-state.ts` uz `starsCount`, `score`, `moves`, itd.

### 8.2 Shop UI

- Novi screen ili tab (npr. "Shop" u navigaciji)
- Prikaz predmeta, cijena (stars / IAP), gumb "Kupi"
- Pri kupnji: `addStars(-cost)` ili IAP flow, zatim `inventoryWilds += count`

### 8.3 Use Wild u igri

- HUD: gumb "Use Wild" (vidljiv kad `inventoryWilds > 0`)
- Pozicija: npr. desno od wild metera (vidi `hud-helpers.ts` layout)
- Handler: placement mode → `openAtCell(c, r, { isWild: true })` + `inventoryWilds--`

### 8.4 openAtCell

- Već podržava sve wild tipove: `isWild`, `isWildMagnet`, `isWildJuice`, `isWildTnt`
- Potrebno samo pozvati s ispravnim parametrima i odabranom ćelijom

---

## 9. Pitanja za agenta

1. **Inventory struktura:** Jedan broj `inventoryWilds` (random tip) ili odvojeno po tipu (star, juice, magnet, TNT)?
2. **Placement:** Korisnik bira ćeliju ili automatski prva prazna?
3. **Stars cijene:** Koje cijene u stars za 1 wild, 3 wild, 10 moves?
4. **IAP integracija:** Treba li odmah IAP ili prvo samo stars shop?
5. **Use Wild UX:** Gumb u HUD-u, floating button, ili drugi pristup?

---

## 10. Sažetak za brzu referencu

| Koncept | Trenutno stanje |
|---------|------------------|
| Wild meter | Puni se mergiranjem → spawna 1 random wild |
| Wild tipovi | Star (50%), Juice (~17%), Magnet (~17%), TNT (~17%) |
| Stars | +3 kad wild star merge 6; prikaz u HUD-u; nema trošenja |
| Shop | Ne postoji |
| Inventory | Ne postoji |
| openAtCell | Podržava spawn svih wild tipova na (c, r) |

**Sljedeći koraci za agenta:**

1. Dizajnirati inventory strukturu i persistence
2. Dizajnirati shop UI i flow (kupnja za stars)
3. Implementirati "Use Wild" flow: HUD gumb → placement → openAtCell → inventory--
4. Povezati s game state save/load
