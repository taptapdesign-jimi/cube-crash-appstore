# Bug: Interim board clean board modal pokazuje "Play Again" / "Exit" umjesto "Continue"

## Sažetak problema

Kada igraš **interim board** (interim kartica) i završiš s merge 6 (npr. wild beer + kockica), dobiješ clean board flow, ali umjesto **"Continue"** (jer je interim kartica) dobiješ **"Play Again"** i **"Exit"** kao da je otvorena redovna kartica.

**Uzrok:** Clean board modal odlučuje koje gumbe prikazati samo na temelju `window.__ccFromInterimBoard`. Kod putova koji pokreću interim board (npr. iz main.ts) postavlja se samo `window.__ccIsInterimBoard`, a ne i `__ccFromInterimBoard`, pa modal vidi "nije interim" i prikaže Play Again/Exit.

---

## Što točno ne valja

### 1. Neusklađenost flagova za "interim board"

- **clean-board-modal.ts** koristi **samo** `__ccFromInterimBoard` za odluku Continue vs Play Again/Exit.
- **main.ts** i drugi putovi koji pokreću interim board postavljaju **samo** `__ccIsInterimBoard` (i eventualno `__ccCameFromJourney`), **ne** i `__ccFromInterimBoard`.
- **endgame-flow.ts** i **app-core.ts** za "je li interim" koriste i `__ccFromInterimBoard`, i `__ccIsInterimBoard`, i localStorage. Modal ne — samo jedan flag.

Zato: ako je igra došla na interim board putem main.ts (npr. `startBoardFromJourney` ili `continueGameWithSavedState`), u trenutku prikaza modala vrijedi `__ccIsInterimBoard === true`, ali `__ccFromInterimBoard` nije postavljen (ili je false). Modal gleda samo `__ccFromInterimBoard` → vidi false → prikaže "Play Again" i "Exit".

### 2. Odgovoran dio u kodu (izolirano za drugog agenta)

**Datoteka:** `src/modules/clean-board-modal.ts`  
**Oko linije:** 548–550

```ts
// 🔥 NEW LOGIC: Check if user came from interim board or regular board (detail modal)
const isFromInterimBoard = (window as any).__ccFromInterimBoard === true;
console.log(`🎯 Clean board modal: isFromInterimBoard = ${isFromInterimBoard}`);
```

Tu se odlučuje hoće li biti "Continue" ili "Play Again"/"Exit". Koristi se **samo** `__ccFromInterimBoard`.  
U tvom logu: `isFromInterimBoard = false` — zato vidiš krive gumbe.

**Referenca u konzoli (tvoj log):**
```text
clean-board-modal.ts:550 🎯 Clean board modal: isFromInterimBoard = false
```

**Gdje se koristi `isFromInterimBoard`:**
- oko linije 565: `primaryBtn.textContent = (devMode || isFromInterimBoard) ? 'Continue' : 'Play Again';`
- oko linije 573: `if (!isFromInterimBoard)` → prikaz sekundarnog gumba "Exit"
- oko linije 1456: `const action = isFromInterimBoard ? 'continue' : 'play-again';`

### 3. Kako drugi dio aplikacije zna za interim

Za usporedbu, **isti koncept "interim"** drugdje se čita na više načina:

- **endgame-flow.ts** (oko 640–641):
  - `const isInterimBoard = (window as any).__ccIsInterimBoard === true;`
  - `const cameFromInterimBoard = (window as any).__ccFromInterimBoard === true;`
  - `shouldUseJourneyStart = cameFromJourney || isInterimBoard || cameFromInterimBoard;`

- **app-core.ts** (oko 9395–9397):
  - `fromInterimBoard = (window as any).__ccFromInterimBoard === true || (window as any).__ccIsInterimBoard === true || localStorage.getItem('__ccFromInterimBoard') === 'true';`

- **clean-board-modal.ts** (linija 549):
  - samo: `(window as any).__ccFromInterimBoard === true` → **nema** `__ccIsInterimBoard` ni localStorage.

Zaključak: **jedini problematični dio** je definicija `isFromInterimBoard` u **clean-board-modal.ts** (oko linije 549): treba uključiti i `__ccIsInterimBoard` (i po želji localStorage), kao u endgame-flow i app-core, a ne oslanjati se isključivo na `__ccFromInterimBoard`.  
Nijednu drugu promjenu u tvom obrazloženju nisam mijenjao — samo sam problem sažeo i točno označio koji dio ne valja i gdje ga drugi agent treba prilagoditi.
