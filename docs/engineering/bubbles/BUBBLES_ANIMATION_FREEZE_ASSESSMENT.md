# Bubbles Animation Freeze - Assessment & Rundown

## 📋 Sažetak
Bubbles animacija se zamrzne na pola animacije - par bubblesa se zamrzne i cijela igra je frozen. Identificirano je 5 glavnih problema, implementirano je 8 promjena, ali još uvijek postoji nekoliko kritičnih problema koje treba riješiti.

## 🎯 Problem
Bubbles animacija se zamrzne na pola animacije - par bubblesa se zamrzne i cijela igra je frozen, korisnik ne može ništa. Animacija je super ali ne traje do kraja.

**Kada se događa**: Tijekom merge 6 wild-juice animacije, nakon što se spawna ~100-200 bubblesa, animacija se zamrzne.

**Simptomi**:
- Bubbles se zamrzne na ekranu
- Igra je frozen, korisnik ne može ništa
- Console nema errora
- Memory usage raste (memory leak?)

## 🔍 Identificirani Problemi

### 1. **Board Wobble Konflikt** (KRITIČNO)
- **Problem**: Board wobble animacija mijenja `board.x` i `board.y` direktno tokom drag-a
- **Uzrok**: Bubbles container je bio na `board.parent`, što uzrokuje da se bubbles "zamrznu" kada se board pomiče
- **Lokacija**: `src/modules/drag-core.ts:334-345` (board wobble), `src/modules/fx.js:1370-1372` (bubbles container pozicija)

### 2. **Previše GSAP Animacija Odjednom**
- **Problem**: 500 bubbles × 4 tweens = 2000 GSAP animacija može uzrokovati freeze
- **Uzrok**: Nema validacije animacijskih parametara, invalid parametri mogu uzrokovati infinite loops
- **Lokacija**: `src/modules/fx.js:1555-1632` (bubble animacije)

### 3. **Duplicate GSAP Ticker**
- **Problem**: Ako se `createWildJuiceBubblesExplosion` pozove više puta, može se dodati više tickera
- **Uzrok**: Nema provjere da ticker već postoji prije dodavanja
- **Lokacija**: `src/modules/fx.js:1805-1810`

### 4. **Invalid Animation Parameters**
- **Problem**: Ako su `oscillationCycles` ili `cycleDuration` invalid, može uzrokovati freeze
- **Uzrok**: Nema provjere za edge cases (0, negative, infinity)
- **Lokacija**: `src/modules/fx.js:1595-1609`

### 5. **Cleanup Problemi**
- **Problem**: Bubbles se možda ne cleanup-aju pravilno, što može uzrokovati memory leak i freeze
- **Uzrok**: Nema sigurnih provjera za destroyed objekte
- **Lokacija**: `src/modules/fx.js:1820-1867`

## ✅ Implementirane Promjene

### 1. Bubbles Container Pozicija
**File**: `src/modules/fx.js:1287-1289, 1370-1372`

**Promjena**:
```javascript
// PRIJE:
const boardParent = board.parent || stage;
bubblesContainer.x = 0;
bubblesContainer.y = 0;

// NAKON:
const boardParent = (app && app.stage) || stage || board.parent;
bubblesContainer.x = 0;
bubblesContainer.y = 0;
```

**Razlog**: Bubbles container je sada na `app.stage` (screen space) umjesto `board.parent` (board space), tako da board wobble ne utječe na bubbles pozicije.

### 2. Validacija Animacijskih Parametara
**File**: `src/modules/fx.js:1555-1632`

**Promjene**:
- Dodan `safeAnimDuration` - clamp između 0.1-10s
- Dodana provjera za `oscillationCycles` - mora biti > 0
- Dodana provjera za `cycleDuration` - mora biti > 0.1
- Limit repeat count na max 10 za horizontal oscillation

**Kod**:
```javascript
const safeAnimDuration = Math.max(0.1, Math.min(10, animDuration));
const oscillationCycles = Math.max(1, Math.floor(oscillationSpeed * animDuration));
const cycleDuration = animDuration / oscillationCycles;

if (oscillationCycles > 0 && cycleDuration > 0.1) {
  // Create horizontal animation
  const horizontalTween = gsap.to(bubble, {
    x: clampedStartX + oscillationAmplitude,
    duration: cycleDuration * 0.5,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: Math.min(10, Math.max(0, oscillationCycles * 2 - 1)), // Limit to 10
    immediateRender: true
  });
}
```

### 3. Sprječavanje Duplih Ticker-a
**File**: `src/modules/fx.js:1805-1814`

**Promjena**:
```javascript
// PRIJE:
gsap.ticker.add(spawnTick);
tickerId = spawnTick;

// NAKON:
if (tickerId === null) {
  gsap.ticker.add(spawnTick);
  tickerId = spawnTick;
  bubblesContainer._bubbleSpawnTicker = spawnTick;
} else {
  console.warn('⚠️ Spawn ticker already exists, skipping duplicate add');
}
```

### 4. Poboljšan Cleanup
**File**: `src/modules/fx.js:1820-1867`

**Promjene**:
- Kopiranje children array prije iteracije (prevent modification during iteration)
- Dodane provjere za `destroyed` objekte
- Dodano cleanup za `tickerId` reference
- Dodane try-catch blokovi za sve cleanup operacije

**Kod**:
```javascript
const childrenCopy = [...bubblesContainer.children];
childrenCopy.forEach((bubble) => {
  // Kill tweens
  if (bubble && !bubble.destroyed) {
    bubble.destroy();
  }
});

// Remove both ticker references
if (bubblesContainer._bubbleSpawnTicker) {
  gsap.ticker.remove(bubblesContainer._bubbleSpawnTicker);
}
if (tickerId !== null) {
  gsap.ticker.remove(tickerId);
  tickerId = null;
}
```

### 5. Uklonjeni onUpdate Callbacks
**File**: `src/modules/fx.js:1591-1612`

**Promjena**: Uklonjeni svi `onUpdate` callbacks koji su uzrokovali 500+ JS poziva po frame-u. Umjesto toga koriste se GSAP native property animacije (GPU-accelerated).

### 6. Povećan Broj Bubblesa
**File**: `src/modules/fx.js:1397-1417`

**Promjene**:
- `totalBubbles`: 250 → 500
- `initialBatchSize`: 50 → 100
- `MAX_ACTIVE_BUBBLES`: 200 → 400
- `spawnDuration`: 2.5s → 3s

### 7. Throttling za pickDropTarget
**File**: `src/modules/drag-core.ts:832-842`

**Promjena**: Dodan throttling (16ms) i cache za `pickDropTarget` pozive da se smanji lag.

### 8. Uklonjeni Console.log Pozivi
**File**: `src/modules/drag-core.ts`, `src/modules/app-core.ts`

**Promjena**: Uklonjeni svi console.log pozivi iz `pickDropTarget` i `canDrop` funkcija da se smanji lag.

## 🔴 Preostali Problemi (Za Drugog Agenta)

### 1. **Board Wobble i Bubbles Konflikt** (NAJKRITIČNIJI)
**Problem**: Board wobble animacija se još uvijek izvršava tokom drag-a i mijenja `board.x/y`. Iako sam promijenio bubbles container na `app.stage`, možda još uvijek ima konflikta.

**Potrebno provjeriti**:
- Da li se board wobble animacija zaustavlja kada se bubbles animacija pokreće?
- Da li bubbles container stvarno ne ovisi o board poziciji?
- Možda treba onemogućiti board wobble tokom bubbles animacije?

**Lokacija**: 
- `src/modules/drag-core.ts:334-345` (board wobble logic)
- `src/modules/fx.js:1264, 1339, 1888` (`isWildJuiceExplosionActive` flag)

**Rješenje**: Koristiti `isWildJuiceExplosionActive` flag da se onemogući board wobble:
```javascript
// U drag-core.ts onMove funkciji:
if (drag._boardWobbleActive && board) {
  // Import isWildJuiceExplosionActive from fx.js ili provjeri globalno
  const isBubblesActive = window.STATE?.isWildJuiceExplosionActive || false;
  if (!isBubblesActive) {
    // Board wobble logic
  }
}
```

### 2. **GSAP Ticker Konflikt**
**Problem**: Možda ima više GSAP tickera koji se izvršavaju istovremeno i uzrokuju freeze.

**Potrebno provjeriti**:
- Koliko GSAP tickera je aktivno istovremeno?
- Da li se tickeri pravilno cleanup-aju?
- Možda treba koristiti jedan globalni ticker umjesto više?

**Lokacija**: `src/modules/fx.js:1805-1814`, sve lokacije gdje se `gsap.ticker.add()` poziva

### 3. **Previše GSAP Animacija**
**Problem**: 500 bubbles × 4 tweens = 2000 animacija može biti previše za neke uređaje.

**Potrebno provjeriti**:
- Da li možemo smanjiti broj tweens po bubble-u?
- Da li možemo koristiti object pooling za bubbles?
- Da li možemo batch-ovati animacije?

**Lokacija**: `src/modules/fx.js:1555-1632`

### 4. **Memory Leak**
**Problem**: Možda bubbles se ne cleanup-aju pravilno, što uzrokuje memory leak i freeze.

**Potrebno provjeriti**:
- Da li se svi tweens kill-aju prije destroy-a?
- Da li se svi tickeri remove-aju?
- Da li se svi event listeneri cleanup-aju?

**Lokacija**: `src/modules/fx.js:1820-1867`

### 5. **Merge 6 Animacija Konflikt**
**Problem**: Možda merge 6 animacija (shards, screen shake, etc.) konfliktira s bubbles animacijom.

**Potrebno provjeriti**:
- Da li se merge 6 animacija izvršava istovremeno s bubbles animacijom?
- Da li merge 6 animacija blokira GSAP ticker?
- Možda treba delay-ati bubbles animaciju ili merge 6 animaciju?

**Lokacija**: `src/modules/app-core.ts:3476-3501` (merge 6 animacije), `src/modules/drag-core.ts:797-808` (bubbles trigger)

## 🛠️ Preporučena Rješenja

### 1. Onemogućiti Board Wobble Tijekom Bubbles Animacije
**Problem**: `isWildJuiceExplosionActive` flag postoji u `fx.js` ali se ne koristi u `drag-core.ts` za onemogućavanje board wobble-a.

**Rješenje**:
```javascript
// U drag-core.ts onMove funkciji (linija ~334):
// Import flag ili provjeri globalno
const windowState = typeof window !== 'undefined' ? window.STATE : null;
const isBubblesActive = windowState?.isWildJuiceExplosionActive || false;

if (drag._boardWobbleActive && board && !isBubblesActive) {
  // Board wobble logic - samo ako bubbles animacija nije aktivna
  const smooth = 0.16;
  // ... rest of wobble logic
}
```

**Alternativno**: Export `isWildJuiceExplosionActive` iz `fx.js` i import u `drag-core.ts`:
```javascript
// U fx.js:
export { isWildJuiceExplosionActive };

// U drag-core.ts:
import { isWildJuiceExplosionActive } from './fx.js';

// U onMove:
if (drag._boardWobbleActive && board && !isWildJuiceExplosionActive) {
  // Board wobble logic
}
```

### 2. Koristiti Object Pooling za Bubbles
- Kreirati pool bubblesa prije nego što se animacija pokrene
- Reuse bubbles umjesto kreiranja novih
- Smanjiti garbage collection

### 3. Batch GSAP Animacije
- Umjesto 2000 individual animacija, koristiti batch animacije
- Koristiti `gsap.to()` s array targeta umjesto individual animacija

### 4. Dodati Performance Monitoring
- Dodati FPS monitoring tokom bubbles animacije
- Dodati warning ako FPS padne ispod 30
- Automatski smanjiti broj bubblesa ako FPS padne

### 5. Delay Bubbles Animaciju
- Možda treba delay-ati bubbles animaciju za 100-200ms nakon merge 6 trigger-a
- To bi omogućilo da merge 6 animacija završi prije nego što bubbles animacija krene

## 📝 Test Scenarios

1. **Test 1**: Merge 6 wild-juice → provjeri da li se bubbles animacija zamrzne
2. **Test 2**: Merge 6 wild-juice dok se board pomiče (drag) → provjeri konflikt
3. **Test 3**: Više merge 6 u kratkom vremenu → provjeri da li se tickeri duplicate-aju
4. **Test 4**: Dugotrajna igra → provjeri memory leak
5. **Test 5**: Slabiji uređaj → provjeri performanse s 500 bubblesa

## 🔗 Relevantne Datoteke

- `src/modules/fx.js` - Bubbles animacija (linije 1264-1875)
  - `isWildJuiceExplosionActive` flag (linija 1264, 1339, 1888)
  - `createWildJuiceBubblesExplosion` funkcija (linija 1266)
  - Bubble animacije (linije 1555-1632)
  - Cleanup funkcija (linije 1820-1867)
- `src/modules/drag-core.ts` - Board wobble, bubbles trigger
  - Board wobble logic (linije 334-345) - **TREBA DODATI PROVJERU ZA isWildJuiceExplosionActive**
  - Bubbles trigger (linije 797-808)
  - `pickDropTarget` throttling (linije 832-997)
- `src/modules/app-core.ts` - Merge 6 animacije, canDrop
  - Merge 6 animacije (linije 3476-3501)
  - `canDrop` funkcija (linije 665-675)

## 📊 Trenutno Stanje

- ✅ Bubbles container na app.stage (ne ovisi o board poziciji)
- ✅ Validacija animacijskih parametara
- ✅ Sprječavanje duplih tickera
- ✅ Poboljšan cleanup
- ✅ Uklonjeni onUpdate callbacks
- ⚠️ Board wobble konflikt još uvijek moguć
- ⚠️ Previše GSAP animacija (2000 animacija)
- ⚠️ Nema object pooling
- ⚠️ Nema performance monitoring

## 🎯 Sljedeći Koraci (Za Drugog Agenta)

1. **Provjeriti board wobble konflikt** - onemogućiti board wobble tokom bubbles animacije
2. **Smanjiti broj GSAP animacija** - koristiti object pooling ili batch animacije
3. **Dodati performance monitoring** - FPS monitoring i automatsko smanjenje bubblesa
4. **Testirati na slabijim uređajima** - provjeriti da li 500 bubblesa radi na svim uređajima
5. **Dodati delay između merge 6 i bubbles** - možda treba mali delay da merge 6 animacija završi

