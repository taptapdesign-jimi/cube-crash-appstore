# Changelog v20-stabilna

## Datum: 2024

## Pregled promjena

Ova verzija uključuje kritične popravke endgame sistema, poboljšanja animacija, redesign collectible tagova, i vraćanje board size-a na normalnu veličinu.

---

## 🔥 ENDGAME FIXES

### High Score Check Fix
- **Problem:** "NEW HIGH SCORE" se prikazivao čak i kada novi score (npr. 3922) nije bio veći od prethodnog best score-a (npr. 4200)
- **Rješenje:** Promijenjena logika provjere da koristi `currentScore` (bez bonusa) umjesto `finalScore` (s bonusom)
- **Datoteka:** `src/modules/clean-board-modal.ts`
- **Linija:** 118-120

### Stuck State Detection
- **Problem:** Nakon validnog merge-a (npr. 3+2=5 stack), stuck state nije bio detektiran
- **Rješenje:** Dodan `setTimeout` delay od 50ms prije `checkEndGame` poziva da se osigura da `removeTile(src)` završi
- **Datoteka:** `src/modules/app-core.ts`
- **Linije:** 1672-1700

### Last Merge Detection Enhancement
- **Problem:** Wild + regular tile merge kao zadnje dvije kockice nije uvijek detektirao clean board flow
- **Rješenje:** Poboljšana logika za detekciju "last merge" scenarija, posebno za regular wild tile (`special === 'wild'`)
- **Datoteka:** `src/modules/app-core.ts`
- **Linije:** 1782-1870

### Endgame Checker Simplification
- **Problem:** Previše kompleksna logika u `isGameStuck` funkciji
- **Rješenje:** Pojednostavljena da potpuno vjeruje `anyMergePossible` rezultatu
- **Datoteka:** `src/modules/endgame-checker.ts`

### Wild-Magnet Merge Guards
- **Problem:** Wild-magnet merge u sredini igre je triggerirao fail screen
- **Rješenje:** Dodani guardovi da preskaču endgame check ako wild-magnet merge ima tile-ove za pull
- **Datoteka:** `src/modules/app-core.ts`
- **Linije:** 2314-2341, 2553-2638

---

## 🎨 SCALE ANIMATION (Wild-Magnet Pull)

### Problem
Scale-down animacija za pulled tiles tijekom wild-magnet merge-a nije radila. Kockice su ostale iste veličine tijekom pristupa merge centru.

### Rješenje
1. **Promjena na PIXI Point objekt:** Koristi `scale.x/y` umjesto `scaleX/scaleY`
2. **Selektivno ubijanje animacija:** `killTweensOf(tile.rotG.scale)` umjesto `killTweensOf(tile.rotG)`
3. **GSAP label pristup:** Koristi `moveStart` label za precizno pozicioniranje
4. **Timeline struktura:**
   - 0.065s: Pokret počinje, scale se drži na trenutnoj vrijednosti
   - 0.205s (40% putanje): Scale-down počinje
   - 0.415s: Scale-down završava (60% putanje)

### Datoteke
- `src/modules/app-core.ts` (linije 2348-2436)
- `SCALE_ANIMATION_RUNDOWN.md` (dokumentacija)

---

## ⭐ WILD STARS

### Promjena
- Povećan orbit radius za 10% (maksimum 0.77 umjesto 0.7)
- Zvjezdice sada orbitiraju dalje od wild kockice

### Datoteka
- `src/modules/wild-stars.ts` (linije 178, 353)

---

## 🏷️ COLLECTIBLE TAGS REDESIGN

### Promjene
1. **Fill boja:** Bijela za sve tagove
2. **Stroke:** 1px solid border u boji koja je prije bila fill
   - Common: `#BD968C` (smeđa)
   - Legendary: `#E87A54` (narančasta)
3. **Tekst:** Ista boja kao stroke
4. **Padding:** Povećan horizontalni padding sa 8px na 40px
5. **Width:** Promijenjeno sa fiksne `135px` na `auto` s `min-width: 135px`

### Datoteke
- `src/modules/collectible-reward-ui.ts` (linije 174-211)
- `src/collectibles-screen.css` (linije 850-870)

---

## 📐 BOARD SIZE

### Promjena
- Vraćen board sa 5x5 (testiranje) na 5x9 (normalna veličina)

### Datoteka
- `src/modules/constants.ts` (linija 22)

---

## ✨ SHARDS ANIMATION IMPROVEMENTS

### Regular Merge 6 Shards
- Animacija počinje 0.150s ranije
- TTL: 1.0s (točno 1 sekunda)
- Fast fade-out: instant procedural fade-out
- Travel duration: 50% brže
- Fade delay: 90% brže

### Wild-Magnet Merge 6 Shards
- Isti timing improvements kao regular merge 6
- `ttl: 1.0`, `fastFadeOut: true`, `travelDurMultiplier: 0.5`, `fadeDelayMultiplier: 0.1`

### Datoteke
- `src/modules/app-core.ts` (regular merge 6 shards)
- `src/modules/app-merge.ts` (wild-magnet merge 6 shards)
- `src/modules/fx.js` (`woodShardsAtTile` funkcija)

---

## 📝 DOKUMENTACIJA

### Novi fajlovi
- `SCALE_ANIMATION_RUNDOWN.md` - Detaljna dokumentacija problema i rješenja za scale animaciju

---

## 🔧 TEHNIČKI DETALJI

### Promijenjene datoteke (13)
1. `src/collectibles-screen.css`
2. `src/modules/app-core.ts`
3. `src/modules/app-merge.ts`
4. `src/modules/app-spawn.ts`
5. `src/modules/board.ts`
6. `src/modules/clean-board-modal.ts`
7. `src/modules/collectible-reward-ui.ts`
8. `src/modules/constants.ts`
9. `src/modules/fx.js`
10. `src/modules/level-flow.ts`
11. `src/modules/tile-idle-bounce.ts`
12. `src/modules/wild-stars.ts`
13. `SCALE_ANIMATION_RUNDOWN.md` (novi)

### Statistika
- **Dodano:** 400+ linija
- **Uklonjeno:** 82 linije
- **Neto promjena:** +318 linija

---

## ✅ TESTIRANJE

### Testirano scenariji
1. ✅ High score check s bonusom (3922 < 4200 ne prikazuje "NEW HIGH SCORE")
2. ✅ Stuck state nakon 3+2=5 stack merge-a
3. ✅ Wild + regular tile merge kao zadnje dvije kockice
4. ✅ Wild-magnet merge u sredini igre (ne triggerira fail screen)
5. ✅ Scale animacija za pulled tiles (vidljivo smanjenje nakon 40% putanje)
6. ✅ Wild stars orbit radius (10% veći)
7. ✅ Collectible tags redesign (bijeli fill, obrubljeni stroke, obojeni tekst)
8. ✅ Board size 5x9

---

## 🚀 DEPLOYMENT

### Git
- **Commit:** `aecda47`
- **Tag:** `v20-stabilna`
- **Branch:** `main`
- **Remote:** `origin/main`

### Status
✅ Sve promjene su commitane i pushane na remote
✅ Tag je kreiran i pushan
✅ Dokumentacija je dodana

---

## 📌 ZNAČAJNE PROMJENE

### Breaking Changes
- Nema breaking changes

### Deprecated
- Nema deprecated funkcija

### Nova funkcionalnost
- Poboljšana scale animacija za wild-magnet pull
- Redesign collectible tagova

---

## 🔮 SLJEDEĆI KORACI

1. Testirati scale animaciju na različitim uređajima
2. Provjeriti endgame flow na edge case scenarijima
3. Testirati collectible tags na različitim screen size-ovima
4. Optimizirati performance ako je potrebno

---

**Verzija:** v20-stabilna  
**Datum:** 2024  
**Autor:** Development Team

