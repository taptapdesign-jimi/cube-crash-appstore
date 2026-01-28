# Ghost Placeholders Problem - Deep Analysis

## Problem
Ghost placeholderi nestaju kada se klikne "Continue" ili "Play Again" nakon clean board modal-a.

## Flow Analysis

### CONTINUE FLOW:
1. **clean-board-modal.ts** - Klikne se "Continue"
   - Modal se zatvara, resolve-uje `{ action: 'continue' }`
   - `app.view.style.display = 'none'` - sakriva canvas
   - `stage.visible = false` - sakriva stage

2. **endgame-flow.ts** - Prima rezultat
   - Poziva `hideGrid()` (linija 133)
   - `hideGrid()` sakriva `backgroundLayer` (`bgLayer.visible = false`) ali NE destroy-ira ga
   - Poziva `startNewRunFromJourney(nextBoardNumber)` (linija 819)

3. **main.ts** - `startNewRunFromJourney()`
   - Poziva `bootGame()` i `layoutGame()`
   - `bootGame()` poziva `startLevel(nextBoardNumber)`

4. **app-core.ts** - `startLevel()`
   - Poziva `rebuildBoard()` ako nema saved state
   - `rebuildBoard()` poziva `resetBoardContainer()`

5. **app-core.ts** - `resetBoardContainer()` ⚠️ **PROBLEM**
   - `board.removeChildren()` - **UKLANJA SVE CHILDREN, UKLJUČUJUĆI backgroundLayer!**
   - Pokušava ponovno dodati `backgroundLayer` ako postoji
   - Rebuild-a `_ghostPlaceholders` array
   - **ALI**: `backgroundLayer` je možda još uvijek sakriven (`visible = false`) iz `hideGrid()`

6. **app-core.ts** - `rebuildBoard()`
   - Popunjava sve ćelije s tile-ovima (locked i unlocked)
   - Poziva `updateGhostVisibility()` - ali nema null ćelija, sve su popunjene
   - Ghost placeholderi se ne prikazuju jer nema null ćelija

### PLAY AGAIN FLOW:
- Isti flow kao Continue, samo poziva `startNewRunFromJourney(boardNumber)` (isti board)

## Root Cause

**PROBLEM 1**: `resetBoardContainer()` poziva `board.removeChildren()` što uklanja `backgroundLayer` iz board-a. Iako pokušava ponovno dodati, `backgroundLayer` je možda još uvijek sakriven iz `hideGrid()`.

**PROBLEM 2**: `backgroundLayer` se sakriva u `hideGrid()` (`bgLayer.visible = false`), ali se nikada eksplicitno ne vraća na `visible = true` kada se board ponovno prikaže.

**PROBLEM 3**: `updateGhostVisibility()` se poziva, ali nakon `rebuildBoard()` sve ćelije su popunjene (locked ili unlocked), tako da nema null ćelija za prikazati ghost placeholder-e.

**PROBLEM 4**: `showGrid()` se poziva u `endgame-flow.ts` (linija 819), ali možda se ne poziva u pravo vrijeme ili `backgroundLayer` nije još u board-u.

## Solution

### Fix 1: Osigurati da `backgroundLayer` ostane vidljiv nakon `resetBoardContainer()`
- U `resetBoardContainer()`, nakon ponovnog dodavanja `backgroundLayer`, eksplicitno postaviti `visible = true`, `alpha = 1.0`, `renderable = true`

### Fix 2: Osigurati da se `updateGhostVisibility()` poziva nakon što se board učita
- U `startLevel()`, nakon `rebuildBoard()`, eksplicitno pozvati `updateGhostVisibility()`
- Dodati delayed check da se osigura da je `backgroundLayer` vidljiv

### Fix 3: Osigurati da `showGrid()` pravilno restorira `backgroundLayer`
- U `showGrid()` funkciji, eksplicitno provjeriti da je `backgroundLayer` u board-u i vidljiv
- Pozvati `updateGhostVisibility()` nakon što se `backgroundLayer` prikaže

### Fix 4: Refactor `resetBoardContainer()` da ne uklanja `backgroundLayer`
- Umjesto `board.removeChildren()`, eksplicitno ukloniti samo tile-ove, ali ne `backgroundLayer` i `boardBG`
- Ili osigurati da se `backgroundLayer` pravilno restore-a nakon `removeChildren()`

## Recommended Refactor

1. **U `resetBoardContainer()`**: 
   - Ne uklanjati `backgroundLayer` i `boardBG` iz board-a
   - Eksplicitno ukloniti samo tile-ove
   - Osigurati da `backgroundLayer` ostane vidljiv i pravilno postavljen

2. **U `startLevel()`**:
   - Nakon `rebuildBoard()`, eksplicitno provjeriti da je `backgroundLayer` vidljiv
   - Pozvati `updateGhostVisibility()` s delayed check-om

3. **U `showGrid()`**:
   - Eksplicitno provjeriti da je `backgroundLayer` u board-u i vidljiv
   - Pozvati `updateGhostVisibility()` nakon što se prikaže

4. **U `hideGrid()`**:
   - Ne sakrivati `backgroundLayer`, samo board i HUD
   - Ili eksplicitno restore-ati `backgroundLayer` u `showGrid()`
