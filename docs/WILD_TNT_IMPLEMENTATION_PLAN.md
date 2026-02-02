# Plan: wild-tnt (Explosion Pack – test)

Cilj: dodati **wild-tnt** koji se ponaša kao wild-beer (isti gameplay, ista logika, ista animacija za sada), druga tekstura i `special: 'wild-tnt'`. Sprema za kasniji Shop / Explosion Pack gdje kupnja packa **zamjenjuje** default wildove.

---

## 1. Pregled dodirnih točaka (po datotekama)

### 1.1 Constants & assets

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/constants.ts` | `ASSET_WILD_TNT = './assets/wild-tnt.png'` |
| `src/modules/asset-preloader.ts` | U listu: `'./assets/wild-tnt.png'` (+ @2x/@3x ako imaš) |
| `src/utils/comprehensive-image-preloader.ts` | Isto – dodati wild-tnt u listu |
| `src/utils/preload-assets.ts` | Isto – wild-tnt |
| `src/modules/journey-boards-manager.ts` | U preload listu za board assets dodati wild-tnt (ako se tamo učitavaju wild teksture) |

**Asset:** Za test možeš privremeno kopirati `wild-beer.png` → `wild-tnt.png` (ili placeholder). Kasnije zamijeniš s TNT dizajnom.

---

### 1.2 Board rules & wild type decision

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/board-specific-rules.ts` | U `BoardRule`: `allowedWildTypes?: ('wild' \| 'wild-beer' \| 'wild-magnet' \| 'wild-tnt')[]`. U `getAllowedWildTypes`, `filterWildType`, `isWildTypeAllowed` podržati `'wild-tnt'`. Default lista uključuje `'wild-tnt'` ako želiš da ga test vidiš na svim boardovima. |
| `src/modules/app-core-wild-type.ts` | Vraćati i `spawnTnt: boolean`. Logika: npr. kad `preferredBeer` ili posebna grana za “explosion pack” – `filterWildType('wild-tnt', boardNumber)` i ako je dozvoljen, `spawnTnt = true`. Za čisti test možeš 20% šansa za TNT umjesto/uz beer. |

---

### 1.3 Spawn & open cell

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/app-core-open-cell.ts` | U `OpenCellDeps`: `isWildTnt?: boolean`. U `openAtCellCore`: u svim provjerama `isWildTile` dodati `\|\| holder.special === 'wild-tnt'`. Kad postavljaš `holder.special`: ako `isWildTnt` → `'wild-tnt'`. Za idle animaciju: ako `holder.special === 'wild-tnt'` → poziv `startWildTntBubbles(holder)` (ili za test `startWildBeerBubbles(holder)` ako želiš isti efekt). |
| `src/modules/app-core.ts` | `openAtCell(..., { ..., isWildTnt: spawnTnt })`. U `spawnWildFromMeter`: koristiti `decideWildType` koji sada vraća `spawnTnt`; proslijediti `isWildTnt: spawnTnt` u `openAtCell`. U critical/loaded textures dodati `ASSET_WILD_TNT`. U deps za openAtCell proslijediti `startWildTntBubbles` (ili za test `startWildBeerBubbles`). |

---

### 1.4 Wild skin & texture

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/app-core-wild-skin.ts` | U `WildSkinDeps`: `ASSET_WILD_TNT: string`. U `applyWildSkinLocalCore`: `else if (tile.special === 'wild-tnt') { assetPath = ASSET_WILD_TNT; }`. |
| `src/modules/app-spawn.ts` | U `applyWildSkinLocal`: isto – za `special === 'wild-tnt'` koristiti ASSET_WILD_TNT. |
| `src/modules/board.ts` | U `createTile` (ili gdje se određuje texture za tile): za `t.special === 'wild-tnt'` koristiti ASSET_WILD_TNT. U shadow drawing: dodati `isWildTnt` i poziv `drawTnt(...)` (ili za test `drawBeerMug`). |

---

### 1.5 Shadow (drag & board)

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/drag-utils.ts` | `isWildTnt = tile.special === 'wild-tnt'`. U granu za shadow: else if (isWildTnt) pozivati `drawTnt` ili privremeno `drawBeerMug`. (Za TNT možeš kasnije napraviti jednostavnu “kocku” ili cilindar.) |
| `src/modules/board.ts` | U multi-layer shadow loop: `isWildTnt` i crtati TNT oblik (ili beer za test). |

---

### 1.6 FX – idle (bubbles)

Opcija A (brzi test): wild-tnt koristi **iste** beer bubbles.  
Opcija B (čisto za kasnije): novi modul `wild-tnt-bubbles.ts` (kopija beer, druga boja/tekstura).

Za plan:

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/fx.ts` | Ili: `startWildTntBubbles` koji interno zove `startWildBeerBubbles` (tile ostaje `special === 'wild-tnt'`, ali vizual bubbles isti). Ili: kopija logike s mapom `wildTntBubbleSystems` i `tile.special === 'wild-tnt'`. `stopWildTntBubbles` isto. U cleanup pozivati `stopWildTntBubbles` za sve wild-tnt tileove. |

---

### 1.7 FX – merge 6 shards & explosion

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/fx.ts` | `wildTntMerge6ShardsTemplated`: kopija `wildBeerMerge6ShardsTemplated`, ali `selectPattern('wildTnt')`, `getColor('wildTnt')`, `getParams('wildTnt')`. U `woodShardsAtTile` i svim mjestima gdje se provjerava `tile?.special === 'wild-beer'` ili `opts.isWildBeer` dodati i `'wild-tnt'` / `opts.isWildTnt` (boja npr. narančasto-crvena za TNT). |
| `src/modules/templates/wooden-template.js` | U `woodenColors`: `wildTnt: 0x??????` (npr. 0xE85C3A). U `woodenDragParticleColors` i `woodenBubbleColors`: `wildTnt`. U `woodenPatternMap`: `wildTnt: ['wildTntOrganic1', ...]` (možeš kopirati wildBeer pattern imena i u `patterns` dodati iste podatke ili nove). U `woodenParams`: `wildTnt: { ...wildBeer }`. |
| Explosion (full-screen) | Ili: za wild-tnt merge pozivati `showWildBeerBubblesExplosion()` (isti efekt). Ili: `wild-tnt-explosion.ts` (kopija beer explosion, druga paleta). Za test dovoljno je pozivati beer explosion za wild-tnt. |

---

### 1.8 Merge dispatch (app-core)

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/app-core.ts` | Gdje se određuje `isWildBeerMerge` (npr. `srcSpecialMerge6 === 'wild-beer' \|\| dstSpecialMerge6 === 'wild-beer'`): dodati `\|\| srcSpecialMerge6 === 'wild-tnt' \|\| dstSpecialMerge6 === 'wild-tnt'` u jednu varijablu, npr. `isWildTntMerge`. Za branch “wild-only merge”: ako `isWildTntMerge` → `wildTntMerge6ShardsTemplated(board, dst, ...)` i poziv explosion-a (beer ili TNT). Sve ostale provjere tipa “wild” (za block merge, wild target value, last merge, itd.) proširiti s `\|\| ... === 'wild-tnt'`. |

Konkretno u `app-core.ts` tražiti:

- `src?.special === 'wild-beer'` / `dst?.special === 'wild-beer'` → dodati `|| ... === 'wild-tnt'`.
- `hasLastMergeTile`, `anyMergePossible`, “only tile left”, “wild on board” – svugdje uključiti `'wild-tnt'`.
- Import: `wildTntMerge6ShardsTemplated` iz fx, i eventualno `showWildTntExplosion` ili reuse beer.

---

### 1.9 Drag & drop

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/drag-core.ts` | Sve gdje je `t.special === 'wild-beer'` (drag particles, wobble, itd.) dodati `|| t.special === 'wild-tnt'` ako želiš isti efekt. Ili posebna grana za wild-tnt s istim ponašanjem. |
| `src/modules/install-drag.ts` | Ako se negdje provjerava samo wild/wild-magnet za neki efekt, proširiti na wild-tnt ako treba. |

---

### 1.10 Load / restore (save state)

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/app-core-load-tiles.ts` | U `restoreTilesFromSave`, gdje se za `tile.special === 'wild-beer'` poziva `startWildBeerBubbles`: dodati `if (tile.special === 'wild-tnt') { startWildTntBubbles(tile); }` (ili startWildBeerBubbles za test). |
| `src/modules/app-core.ts` | U listu critical/loaded assets uključiti ASSET_WILD_TNT da se stanje s wild-tnt tileovima može učitati. |

---

### 1.11 End game & clean board

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/endgame-checker.ts` | `isWildSpecial(special)` i sve provjere “wild tile” uključiti `special === 'wild-tnt'`. Npr. `wildCubes`, `wildStars`, “single tile” – tretirati wild-tnt kao wild (kao beer). |
| `src/modules/app-core.ts` | Sve provjere “is wild tile” za end game (npr. jedina kocka na boardu, last merge, clean board) dodati `|| t.special === 'wild-tnt'`. Posebno: `hasBubblesRunning` – ako wild-tnt koristi beer explosion, ostaje kao sad; ako kasnije ima svoj explosion, dodati `isWildTntBubblesExplosionActive?.()`. |
| `src/modules/app-merge.ts` | `isWildTile`, “wild merge” itd. – uključiti `special === 'wild-tnt'`. |
| `src/modules/board.ts` | `anyMergePossible`, “wild cube” filteri – uključiti `'wild-tnt'`. |
| `src/modules/board-recovery.ts` | Sort/compare i “is wild” – uključiti `'wild-tnt'`. |
| `src/modules/app-core-merge-lastmerge.ts` | `hasLastMergeTile` / “is wild” – uključiti `'wild-tnt'`. |

---

### 1.12 Wild beer explosion cleanup (transition)

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/app-core.ts` | Pri board transition / clean board: ako wild-tnt koristi beer explosion, ne treba ništa. Ako kasnije ima svoj TNT explosion modul, pozvati njegov cleanup kao za beer. |
| `src/modules/wild-beer-bubbles-screen.ts` | Ako se provjerava “tile.special === 'wild-beer'” za neki overlay, za test možeš dodati i `'wild-tnt'` ili ostaviti samo beer. |

---

### 1.13 Ostalo

| Datoteka | Što dodati |
|----------|------------|
| `src/modules/app-core-random-empty.ts` | `isWildTile`: dodati `t.special === 'wild-tnt'`. |
| `src/modules/app-core-wild-preload.ts` | Wild preload: dodati `'wild-tnt'`. |
| `src/modules/wild-stars.ts` | Gdje se isključuje magnet a dozvoljava wild/beer – dodati wild-tnt (stars/bubbles za wild-tnt). |
| `src/main.ts` | Samo ako negdje izravno provjeravaš wild tipove; inače ne. |

---

## 2. Redoslijed implementacije (preporuka)

1. **Constants + asset**  
   `ASSET_WILD_TNT`, preload listes, `wild-tnt.png` (kopija beer za test).

2. **Board rules + decideWildType**  
   `allowedWildTypes` i `filterWildType` s `'wild-tnt'`; `decideWildType` vraća `spawnTnt` (npr. 20% šansa ili samo na određenom boardu za test).

3. **Skin + open cell**  
   `applyWildSkinLocal` i board/spawn za `wild-tnt`; `openAtCell(..., isWildTnt)`; u open-cell za wild-tnt pozivati `startWildBeerBubbles` (ili `startWildTntBubbles` koji to wrapira).

4. **Shadow**  
   drag-utils + board: shadow za wild-tnt (drawTnt ili drawBeerMug za test).

5. **Merge 6 + explosion**  
   U app-core merge branch za “wild beer” proširiti na wild-tnt: `wildTntMerge6ShardsTemplated` + ista beer explosion za test. Template: `wildTnt` colors/params/patterns (kopija beer).

6. **Sve “is wild” provjere**  
   app-core, endgame-checker, app-merge, board, board-recovery, load-tiles, drag-core, wild-stars, random-empty, wild-preload, merge-lastmerge – svugdje dodati `|| special === 'wild-tnt'` / `|| t.special === 'wild-tnt'`.

7. **Test**  
   Jedan board s `allowedWildTypes: ['wild-tnt']` ili 20% spawn za wild-tnt, igra, merge 6, end game, clean board, save/load.

---

## 3. Sprema za Explosion Pack (kasnije)

- **Pack “Explosion” aktiviran** → u `decideWildType` ili u board rules možeš: za određene boardove (ili globalno) “zamijeniti” wild-beer s wild-tnt (npr. `spawnTnt = true`, `spawnBeer = false` kada je pack aktivan).
- **ownedPacks / activePacks** u user state; `getAllowedWildTypes` ili `decideWildType` uzimaju u obzir pack (npr. “ako explosion pack aktivan, vrati wild-tnt u poolu umjesto wild-beer”).

Ovim planom wild-tnt je u cijeloj app na pravim mjestima (spawn, skin, merge, end game, load/save, board rules), a logiku “pack zamjenjuje default” dodaš kasnije u jednom mjestu (board rules + decideWildType).
