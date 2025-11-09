# Scale Animation Problem - Rundown

## Problem koji korisnik želi riješiti

Korisnik želi da se kockice koje se privlače prema centru merge-a (wild-magnet pull animacija) **kontinuirano smanjuju nakon 40% putanje** do centra merge-a. Konkretno:
- Kockice trebaju ostati iste veličine za prva **40% putanje**
- Nakon 40% putanje, trebaju se **kontinuirano smanjivati** do **40% svoje originalne veličine** tijekom preostalih **60% putanje**

## Lokacija problema

**Datoteka:** `src/modules/app-core.ts`  
**Funkcija:** `merge()` funkcija, sekcija za wild-magnet pull animaciju  
**Linije:** ~2227-2440 (nearestTiles.forEach loop)

## Što sam dirao i promijenio

### 1. PRVI POKUŠAJ (scaleX/scaleY pristup)
**Linije:** ~2360-2436

**Promjene:**
- Koristio `tile.rotG.scaleX` i `tile.rotG.scaleY` (direktne PIXI.js properties)
- Koristio `gsap.killTweensOf(tile.rotG)` - **PROBLEM:** Ovo je ubijalo SVE animacije na rotG, uključujući rotaciju!
- Koristio GSAP label `moveStart` za pozicioniranje
- Timeline pozicioniranje: `moveStart+=${moveTo40Duration}`

**Problem:** Animacija nije radila jer:
- `killTweensOf(tile.rotG)` je ubijao i rotaciju koja je također na `rotG`
- Možda scaleX/scaleY nisu bili pravi properties za PIXI Container

### 2. DRUGI POKUŠAJ (scale.x/y pristup - FINALNI)
**Linije:** ~2364-2436

**Promjene:**

#### A. Promjena na scale Point objekt
```typescript
// PRIJE (scaleX/scaleY):
const currentScaleX = tile.rotG.scaleX ?? 1.0;
const currentScaleY = tile.rotG.scaleY ?? 1.0;
tl.to(tile.rotG, { scaleX: 0.40, scaleY: 0.40, ... });

// SADA (scale.x/y):
const currentScaleX = tile.rotG.scale.x ?? 1.0;
const currentScaleY = tile.rotG.scale.y ?? 1.0;
tl.to(tile.rotG.scale, { x: 0.40, y: 0.40, ... });
```

**Razlog:** U `fx.js` (linija 789-817) se koristi `g.scale.x` i `g.scale.y` (PIXI Point objekt), ne direktne properties.

#### B. Selektivno ubijanje animacija
```typescript
// PRIJE:
gsap.killTweensOf(tile.rotG); // Ubija SVE animacije na rotG

// SADA:
try { gsap.killTweensOf(tile.rotG.scale); } catch {} // Ubija SAMO scale animacije
```

**Razlog:** Rotacija je također na `tile.rotG`, pa `killTweensOf(tile.rotG)` ubija i rotaciju koja se animira paralelno.

#### C. Timeline pozicioniranje
```typescript
// Dodao label PRIJE animacije pokreta
tl.addLabel('moveStart', `>${moveStartTime}`);

// Scale animacije koriste label
tl.set(tile.rotG.scale, { x: currentScaleX, y: currentScaleY }, 'moveStart');
tl.to(tile.rotG.scale, { x: currentScaleX, y: currentScaleY, duration: moveTo40Duration }, 'moveStart');
tl.to(tile.rotG.scale, { x: 0.40, y: 0.40, duration: moveFrom40Duration }, `moveStart+=${moveTo40Duration}`);
```

**Timeline struktura:**
- **0.000s**: Away movement (0.05s duration)
- **0.065s** (`moveStart` label): Movement towards merge starts (0.35s duration), scale hold starts (0.14s duration)
- **0.205s** (`moveStart + 0.14s`): Scale-down starts (0.21s duration)
- **0.415s**: Scale-down completes

#### D. Dodao console.log za debugging
```typescript
console.log('🔥 Scale animation setup:', {
  tileValue: tile.value,
  currentScaleX,
  currentScaleY,
  moveDuration,
  moveTo40Duration,
  moveFrom40Duration,
  scaleObject: tile.rotG.scale
});
```

## Trenutna implementacija (finalna verzija)

```typescript
// Linije ~2348-2436 u app-core.ts

const moveDuration = 0.35;
const moveTo40Duration = moveDuration * 0.40; // 0.14s (40% of 0.35s)
const moveFrom40Duration = moveDuration * 0.60; // 0.21s (60% of 0.35s)
const moveStartTime = 0.015;

// Add label at START of movement
tl.addLabel('moveStart', `>${moveStartTime}`);

// Movement animation
tl.to(tile, {
  x: mergeX,
  y: mergeY,
  duration: moveDuration,
  ease: 'power2.inOut'
}, 'moveStart');

// Scale animations
if (tile.rotG && tile.rotG.scale) {
  // Kill ONLY scale animations (not rotation)
  try { gsap.killTweensOf(tile.rotG.scale); } catch {}
  
  // Get current scale from Point object
  const currentScaleX = tile.rotG.scale.x ?? 1.0;
  const currentScaleY = tile.rotG.scale.y ?? 1.0;
  
  // Set initial scale at moveStart
  tl.set(tile.rotG.scale, {
    x: currentScaleX,
    y: currentScaleY
  }, 'moveStart');
  
  // Hold scale at current value for first 40% of movement
  tl.to(tile.rotG.scale, {
    x: currentScaleX,
    y: currentScaleY,
    duration: moveTo40Duration, // 0.14s
    ease: 'linear'
  }, 'moveStart');
  
  // Scale down to 40% during last 60% of movement
  tl.to(tile.rotG.scale, {
    x: 0.40,
    y: 0.40,
    duration: moveFrom40Duration, // 0.21s
    ease: 'power2.inOut'
  }, `moveStart+=${moveTo40Duration}`); // Start at moveStart + 0.14s
}
```

## Potencijalni problemi koji mogu još postojati

1. **Timeline konflikti:** Možda neka druga animacija mijenja scale tijekom pull animacije
2. **PIXI.js scale Point objekt:** Možda PIXI.js automatski resetira scale na nekim mjestima
3. **GSAP timeline pozicioniranje:** Možda `moveStart+=${moveTo40Duration}` sintaksa ne radi kako očekujemo
4. **Rotacija animacija:** Možda rotacija animacija interferira sa scale animacijom (ali sada koristimo selektivno ubijanje)

## Sljedeći koraci za debugging

1. Provjeriti console.log output - vidjeti jesu li scale vrijednosti ispravno postavljene
2. Dodati `onUpdate` callback u scale animaciju da vidimo jesu li vrijednosti stvarno mijenjane
3. Provjeriti jesu li neke druge funkcije (npr. `landBounce`, `sweetPopIn`) resetiraju scale tijekom animacije
4. Testirati s jednostavnijim pristupom - možda koristiti `gsap.to` direktno umjesto timeline-a

## Reference

- `src/modules/fx.js` linija 789-817: Primjer kako se koristi `g.scale.x` i `g.scale.y`
- `src/modules/drag-animations.ts` linija 125-126: Koristi `rotG.scaleX` i `rotG.scaleY` (ali možda za drugačiji slučaj)
- `src/modules/app-core.ts` linija 2364-2436: Trenutna implementacija

