# Dubinska analiza: reset aplikacije (interim board 1→3 → Continue → clean board → board 4)

## Put koji izaziva reset

1. **Interim kartice** (board 1, 2, 3) – korisnik vidi Journey, interim kartica za board 3.
2. **Continue na board 3** – `continueFromInterimBoard(3)` → board transition → `continueGameWithSavedState` ili fresh run.
3. **Igra board 3** – do clean board (svi tileovi očišćeni).
4. **Clean board flow** – modal, korisnik klikne **Continue**.
5. **Endgame flow** – `runEndgameFlow` → cleanup → **board transition screen** (board 4) → `onComplete` → **startNewRunFromJourney(4)** (jer je `shouldUseJourneyStart === true`).
6. **startNewRunFromJourney(4)** poziva **bootGame()** pa **layoutGame()**.
7. **boot()** se ponovo poziva sa **postojećim** PIXI app (board 3 je još u memoriji) → **reuseApp = true**.

---

## Uzrok #1 (kritičan): Dupli board/hud pri reuse u boot()

**Lokacija:** `app-core.ts` ~linije 1410–1430 (boot).

Kada je **reuseApp === true**:
- **Ne** radimo nuclear cleanup (ne uništavamo app, ne brišemo stage/board/hud reference u tom bloku).
- Ali **i dalje** izvršavamo:
  - `board = new Container();`
  - `boardBG = new Graphics();`
  - `hud = new Container();`
  - `stage.addChild(board, hud);`

Znači:
- **Stari** board i hud i dalje stoje na **stage** (nikad uklonjeni).
- Dodajemo **novi** board i **novi** hud na stage.
- Modulne varijable `board` i `hud` sada pokazuju na **nove** containere.

Rezultat:
- **stage.children** = [stariBoard, stariHud, noviBoard, noviHud] → **4 childa** umjesto 2.
- Stari board (svi tileovi, background layer, texture references) **nikad se ne uništava** → **memory leak**.
- Dupla scena (2 boarda, 2 huda) → mogući **crash**, **pogrešan render**, ili **WebGL/PIXI greške** kad se u startLevel(4) radi rebuild nad **novim** boardom dok stari još živi na stageu.

Ovo objašnjava reset posebno na putu: **interim → Continue → clean board → board 4**, jer je to jedan od putova gdje se **boot()** ponovo poziva sa **reuseApp = true** (startNewRunFromJourney → bootGame).

---

## Uzrok #2: Agresivni cleanup u endgame-flow prije board 4

**Lokacija:** `endgame-flow.ts` – cleanup prije board transition (kill GSAP, timeouts, cleanupAllEffects, memoryManager.performCleanup).

- **gsap.killTweensOf('*')** i brisanje timeoutova mogu ubiti animacije/reference koje PIXI ili board još koristi.
- Ako neki GSAP callback ili timeout kasnije pokuša pristupiti **već obrisanom** objektu (npr. tile, board), može doći do **unhandled exception**.
- Na iOS/WebView, neuhvaćena greška može dovesti do **reloada** ili “reset” dojma.

Ovaj faktor je vjerojatno **sekundaran** u odnosu na dupli board/hud, ali može pogoršati stanje ako su reference ostale na stari board/hud.

---

## Uzrok #3: Akumulacija memorije (board 1 → 2 → 3 → 4)

- Svaki board dodaje tileove, texture-e, GSAP tweens, event listenere.
- **Endgame cleanup** ne briše PIXI texture cache za board 4 (agresivno brisanje tek od board 10+).
- Kad se u boot() **reuse**-a app i **dodaju novi board/hud** bez uklanjanja starih, memorija raste (stari board 3 ostaje u stage).
- Na niskom memorijskom uređaju (npr. stariji iPhone) to može dovesti do **killa od strane OS-a** ili **WebGL out of memory** → korisnik vidi “reset” (reload).

---

## Uzrok #4: Error handler i reload

**Lokacija:** `utils/error-handler.ts`.

- `window.location.reload()` se poziva **samo** kad korisnik klikne “Refresh Page” u error overlayu (nakon 50+ grešaka u produkciji).
- Nema automatskog reloada na prvu grešku.
- Ako ipak dođe do **neuhvaćene promise rejection** ili **sync exception** u boot()/startLevel() (npr. pristup destroyed objektu), browser/WebView može sam odlučiti “restart” stranice, što korisnik doživljava kao reset.

---

## Preporučeni fix (prioritet)

### 1. Boot reuse: ne kreirati novi board/hud ako reuseApp

U **boot()** u `app-core.ts`, nakon postavljanja `stage`:

- Ako je **reuseApp === true**:
  - **Ne** praviti `new Container()` za board/hud niti `new Graphics()` za boardBG.
  - **Ne** pozivati `stage.addChild(board, hud)`.
  - Koristiti postojeće **board** i **hud** (već na stageu).
  - Postaviti `backgroundLayer = null` i `window._ghostPlaceholders = null` (kao sada), da ih startLevel ponovo kreira.
  - Po potrebi samo osigurati `board.visible = true`, `hud.visible = true`, `stage.visible = true`.

Tako stage ostane sa **jednim** boardom i **jednim** hudom, a startLevel(4) i rebuildBoard() rade na **istom** containeru kao i prije; nema duplog boarda/huda ni curenja starih kontejnera.

### 2. (Opcionalno) Raniji PIXI/memory cleanup za interim put

Za put **interim → clean board → sljedeći board** može se razmisliti o blago ranijem oslobađanju neiskorištenih tekstura (npr. nakon clean board prije transition), bez čekanja na board 10+, da se smanji memorijski pritisak na slabijim uređajima.

### 3. (Opcionalno) Dodatni try/catch u startNewRunFromJourney

U **main.ts** u `startNewRunFromJourney`:
- Omotati `await bootGame()` i `await layoutGame()` u try/catch.
- U catch logirati grešku i eventualno pozvati `startLevel(boardId)` kao fallback (bez ponovnog boota), da se izbjegne neuhvaćena rejection koja može izazvati “reset” dojam.

---

## Sažetak

- **Glavni uzrok resetiranja** na putu interim 1→3 → Continue → clean board → board 4 je **dupli board/hud u boot() pri reuseApp**: stari board/hud ostaju na stageu, novi se dodaju, što vodi u memory leak, dupli render i moguće PIXI/WebGL greške ili crash.
- **Ispravka:** pri **reuseApp** u boot() **ne kreirati** nove board/hud/boardBG i **ne** dodavati ih na stage; koristiti postojeće containere i samo ih pripremiti za startLevel (visibility, null za backgroundLayer i ghost placeholders).
