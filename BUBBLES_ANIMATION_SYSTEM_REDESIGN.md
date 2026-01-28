# Bubbles Animation System - Redesign Proposal

## 📊 Trenutno Stanje - Breakdown

### 1. **Tile-Based Bubbles Animation** (`startWildBeerBubbles`)
**Lokacija**: `src/modules/fx.ts:111-798`

**Kako radi:**
- ✅ Poziva se: `startWildBeerBubbles(tile)` kada se wild-beer tile spawna ili otvori
- ✅ Renderira se: Dodaje `Container` na `tile.rotG` (child container tile-a)
- ✅ Kako se gasi: `stopWildBeerBubbles(tile)` - cleanup bubbles, container, GSAP tweens
- ✅ Je li modul: Ne, funkcija u `fx.ts` modulu

**Problemi:**
- ❌ **Ovisi o tile hijerarhiji** - bubbles container je child od `tile.rotG`
- ❌ **Lomi se tijekom board transitions** - tiles se destroyaju/rebuildaju, bubbles gube parent
- ❌ **Kompleksan retry/health check sistem** - pokušava re-attach container nakon board transitions
- ❌ **Ne radi u subsequent boards** - tile hijerarhija se mijenja, bubbles se gube
- ❌ **Fragile** - ovisi o `tile.rotG`, `tile.parent`, board label checks

**Kod poziva:**
```typescript
// U app-core.ts:3584, 3832
if (tile.special === 'wild-beer') {
  startWildBeerBubbles(tile);
}
```

---

### 2. **Full-Screen Explosion** (`createWildBeerBubblesExplosion`)
**Lokacija**: `src/modules/fx.ts:4245-4950`

**Kako radi:**
- ✅ Poziva se: `createWildBeerBubblesExplosion(board, tile)` tijekom merge/drag events
- ✅ Renderira se: Dodaje `Container` direktno na `stage` (full-screen, z-index: 20000)
- ✅ Kako se gasi: `cleanupWildBeerExplosion()` - cleanup container, GSAP tickers
- ✅ Je li modul: Ne, funkcija u `fx.ts` modulu

**Prednosti:**
- ✅ **Ne ovisi o tile hijerarhiji** - direktno na stage
- ✅ **Radi preko cijelog ekrana** - bubbles idu od dna do vrha
- ✅ **FX efekt** - ide preko svih elemenata

**Problemi:**
- ❌ **Samo za merge events** - nije continuous idle animation
- ❌ **One-time explosion** - ne radi za idle wild-beer tiles
- ❌ **Nije modul** - nije kao `board-transition-screen.ts`

**Kod poziva:**
```typescript
// U drag-core.ts, app-merge.ts
createWildBeerBubblesExplosion(board, target);
```

---

### 3. **Transition Board Screen** (`showBoardTransitionScreen`)
**Lokacija**: `src/modules/board-transition-screen.ts`

**Kako radi:**
- ✅ Poziva se: `showBoardTransitionScreen({ boardNumber, onComplete })` bilo gdje
- ✅ Renderira se: DOM overlay (`z-index: 99999`) - full-screen, neovisno o board state
- ✅ Kako se gasi: `cleanup()` - cleanup DOM elements, GSAP timelines
- ✅ Je li modul: **DA!** - standalone modul koji se može pozvati bilo gdje

**Prednosti:**
- ✅ **Potpuno neovisan** - ne ovisi o board/tile hijerarhiji
- ✅ **Radi uvijek** - bez obzira na board state
- ✅ **Modularan** - može se pozvati bilo gdje
- ✅ **Random pool animacija** - clouds animacija s random poolom elemenata
- ✅ **Proper cleanup** - sve se čisti kada se završi

**Struktura:**
```typescript
// Module-level state
let isTransitionActive = false;
let currentOverlay: HTMLElement | null = null;
let activeCloudImages: HTMLImageElement[] = [];
let cloudTimelines: gsap.core.Timeline[] = [];

// Main function
export async function showBoardTransitionScreen(options) { ... }

// Cleanup
function cleanup() { ... }
```

---

## 🎯 Problem Statement

**Trenutno:**
- Tile-based bubbles (`startWildBeerBubbles`) se lome tijekom board transitions
- Ne rade u subsequent boards nakon interim board + continue CTA
- Ovisi o tile hijerarhiji koja se mijenja

**Željeno:**
- Bubbles animacija koja radi kao transition screen - full-screen FX
- Neovisna o board/tile state
- Continuous animacija kada wild-beer tile postoji na boardu
- Radi preko cijelog ekrana (od dna do vrha) kao FX efekt

---

## 💡 Prijedlog Rješenja

### **Opcija A: Novi Full-Screen Bubbles Modul** (PREPORUČENO)

Kreirati novi modul `wild-beer-bubbles-screen.ts` sličan `board-transition-screen.ts`:

**Struktura:**
```typescript
// src/modules/wild-beer-bubbles-screen.ts

let isBubblesActive = false;
let bubblesContainer: Container | null = null;
let bubblesSpawnTick: gsap.core.Tween | null = null;
let activeBubbles: Graphics[] = [];

/**
 * Start full-screen bubbles animation when wild-beer tile exists
 * Works independently of board/tile hierarchy
 */
export function startWildBeerBubblesScreen(): void {
  if (isBubblesActive) return;
  
  // Get stage from window.STATE
  const stage = window.STATE?.stage;
  if (!stage) return;
  
  // Create container on stage (full-screen)
  bubblesContainer = new Container();
  bubblesContainer.zIndex = 20000; // Above everything
  bubblesContainer.eventMode = 'none';
  stage.addChild(bubblesContainer);
  
  isBubblesActive = true;
  
  // Start continuous bubble spawning
  spawnBubblesLoop();
}

/**
 * Stop full-screen bubbles animation
 */
export function stopWildBeerBubblesScreen(): void {
  cleanup();
}

/**
 * Check if bubbles are active
 */
export function isWildBeerBubblesActive(): boolean {
  return isBubblesActive;
}

function spawnBubblesLoop() {
  // Spawn bubbles from bottom of screen, rise to top
  // Similar to createWildBeerBubblesExplosion but continuous
}

function cleanup() {
  // Cleanup container, bubbles, GSAP tweens
}
```

**Kako se poziva:**
```typescript
// U app-core.ts - kada se wild-beer tile spawna
import { startWildBeerBubblesScreen, stopWildBeerBubblesScreen } from './wild-beer-bubbles-screen.js';

// U applyWildSkinLocal ili openAtCell
if (tile.special === 'wild-beer') {
  startWildBeerBubblesScreen(); // Start full-screen bubbles
}

// U rebuildBoard ili cleanup
stopWildBeerBubblesScreen(); // Stop when board changes
```

**Prednosti:**
- ✅ Potpuno neovisan o tile hijerarhiji
- ✅ Radi kao full-screen FX (kao transition screen)
- ✅ Modularan - može se pozvati bilo gdje
- ✅ Continuous animacija - radi dok wild-beer tile postoji
- ✅ Lako cleanup - sve na jednom mjestu

**Nedostaci:**
- ⚠️ Treba kreirati novi modul
- ⚠️ Treba refaktorirati pozive iz `startWildBeerBubbles(tile)` u `startWildBeerBubblesScreen()`

---

### **Opcija B: Refaktorirati `createWildBeerBubblesExplosion` u Continuous**

Modificirati postojeći `createWildBeerBubblesExplosion` da radi continuous:

**Promjene:**
```typescript
// U fx.ts
let wildBeerBubblesContinuous = false; // New flag

export function startWildBeerBubblesContinuous() {
  if (wildBeerBubblesContinuous) return;
  createWildBeerBubblesExplosion(board, null); // Start continuous
  wildBeerBubblesContinuous = true;
}

export function stopWildBeerBubblesContinuous() {
  cleanupWildBeerExplosion();
  wildBeerBubblesContinuous = false;
}
```

**Prednosti:**
- ✅ Koristi postojeći kod
- ✅ Manje promjena

**Nedostaci:**
- ❌ `createWildBeerBubblesExplosion` je dizajniran za one-time explosion
- ❌ Ime je confusing (explosion vs continuous)
- ❌ Nije modularan kao transition screen

---

## 🎨 Preporučeno Rješenje: **Opcija A**

### **Implementacija Plan:**

1. **Kreirati novi modul** `src/modules/wild-beer-bubbles-screen.ts`
   - Full-screen bubbles animacija
   - Neovisna o tile hijerarhiji
   - Continuous spawning dok je aktivna

2. **Refaktorirati pozive:**
   - Zamijeniti `startWildBeerBubbles(tile)` s `startWildBeerBubblesScreen()`
   - Dodati check: ako wild-beer tile postoji na boardu → start bubbles
   - Cleanup kada se board mijenja

3. **Zadržati `createWildBeerBubblesExplosion`:**
   - Za merge/drag events (explosion effect)
   - Ne mijenjati postojeći kod

4. **Dodati health check:**
   - Periodički check da li wild-beer tile još postoji na boardu
   - Ako ne postoji → stop bubbles
   - Ako postoji → ensure bubbles su aktivne

---

## 📋 Usporedba Sistemova

| Feature | Tile-Based Bubbles | Full-Screen Explosion | Transition Screen | **Novi Bubbles Screen** |
|---------|-------------------|----------------------|-------------------|------------------------|
| **Neovisnost** | ❌ Ovisi o tile | ✅ Neovisna | ✅ Neovisna | ✅ Neovisna |
| **Board Transitions** | ❌ Lomi se | ✅ Radi | ✅ Radi | ✅ Radi |
| **Full-Screen FX** | ❌ Samo tile | ✅ Da | ✅ Da | ✅ Da |
| **Continuous** | ✅ Da | ❌ One-time | ❌ One-time | ✅ Da |
| **Modularan** | ❌ Ne | ❌ Ne | ✅ Da | ✅ Da |
| **Random Pool** | ❌ Ne | ❌ Ne | ✅ Da | ✅ Da |
| **Cleanup** | ⚠️ Kompleksan | ✅ OK | ✅ Odličan | ✅ Odličan |

---

## 🔧 Implementation Details

### **Novi Modul Struktura:**

```typescript
// src/modules/wild-beer-bubbles-screen.ts

import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { graphicsPool } from './fx-helpers.ts'; // Object pooling

let isBubblesActive = false;
let bubblesContainer: Container | null = null;
let spawnInterval: gsap.core.Tween | null = null;
let activeBubbles: Graphics[] = [];
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start full-screen bubbles animation
 * Bubbles spawn from bottom, rise to top, go over everything
 */
export function startWildBeerBubblesScreen(): void {
  if (isBubblesActive) {
    console.log('💧 Bubbles already active, skipping');
    return;
  }

  const stage = window.STATE?.stage;
  if (!stage || stage.destroyed) {
    console.warn('⚠️ Cannot start bubbles - no stage');
    return;
  }

  // Cleanup any existing
  cleanup();

  // Create container on stage
  bubblesContainer = new Container();
  bubblesContainer.name = 'wild-beer-bubbles-screen';
  bubblesContainer.zIndex = 20000; // Above everything
  bubblesContainer.eventMode = 'none';
  bubblesContainer.visible = true;
  bubblesContainer.alpha = 1.0;
  try { bubblesContainer.interactiveChildren = false; } catch {}

  stage.addChild(bubblesContainer);
  stage.sortChildren?.();

  isBubblesActive = true;

  // Start spawning
  spawnBubblesLoop();

  // Health check - ensure wild-beer tile exists
  startHealthCheck();

  console.log('✅ Wild-beer bubbles screen started');
}

/**
 * Stop full-screen bubbles animation
 */
export function stopWildBeerBubblesScreen(): void {
  cleanup();
  console.log('🛑 Wild-beer bubbles screen stopped');
}

/**
 * Check if bubbles are active
 */
export function isWildBeerBubblesActive(): boolean {
  return isBubblesActive;
}

function spawnBubblesLoop() {
  if (!isBubblesActive || !bubblesContainer) return;

  // Spawn bubble from random bottom position
  spawnBubble();

  // Next spawn in 0.3-0.6s
  const delay = 0.3 + Math.random() * 0.3;
  spawnInterval = gsap.delayedCall(delay, spawnBubblesLoop);
}

function spawnBubble() {
  if (!bubblesContainer || bubblesContainer.destroyed) return;

  const bubble = graphicsPool.acquire();
  if (!bubble) return;

  bubble.eventMode = 'none';
  bubble.visible = true;
  bubble.renderable = true;

  // Bubble size
  const size = 20 + Math.random() * 30; // 20-50px
  const radius = size / 2;

  bubble.clear();
  bubble.circle(0, 0, radius);
  bubble.fill({ color: 0xFFFFFF, alpha: 0.8 });
  
  // Highlight
  const highlightRadius = radius * 0.3;
  bubble.circle(-radius * 0.2, -radius * 0.2, highlightRadius);
  bubble.fill({ color: 0xFFFFFF, alpha: 1.0 });
  
  // Border
  bubble.circle(0, 0, radius);
  bubble.stroke({ color: 0xFFFFFF, alpha: 0.6, width: 2 });

  // Screen dimensions
  const screenW = window.innerWidth || 800;
  const screenH = window.innerHeight || 600;

  // Start at random bottom position
  const startX = Math.random() * screenW;
  const startY = screenH + radius; // Below screen

  bubble.x = startX;
  bubble.y = startY;
  bubble.scale.set(0.5 + Math.random() * 0.3);
  bubble.alpha = 0.9 + Math.random() * 0.1;

  bubblesContainer.addChild(bubble);
  activeBubbles.push(bubble);

  // Animate: rise to top + 30%
  const endY = -screenH * 0.3; // Above screen
  const endX = startX + (Math.random() - 0.5) * 20; // Slight drift
  const duration = 0.8 + Math.random() * 0.7;

  // Grow
  gsap.to(bubble.scale, {
    x: 0.6 + Math.random() * 0.4,
    y: 0.6 + Math.random() * 0.4,
    duration: duration * 0.3,
    ease: 'power2.out'
  });

  // Rise
  gsap.to(bubble, {
    x: endX,
    y: endY,
    duration: duration,
    ease: 'power1.out',
    onComplete: () => {
      const idx = activeBubbles.indexOf(bubble);
      if (idx >= 0) activeBubbles.splice(idx, 1);
      if (bubblesContainer && bubblesContainer.children.includes(bubble)) {
        bubblesContainer.removeChild(bubble);
      }
      graphicsPool.release(bubble);
    }
  });

  // Fade out
  gsap.to(bubble, {
    alpha: 0,
    duration: duration * 0.4,
    delay: duration * 0.6,
    ease: 'power2.in'
  });
}

function startHealthCheck() {
  // Check every 2 seconds if wild-beer tile still exists
  healthCheckInterval = setInterval(() => {
    if (!isBubblesActive) {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
      return;
    }

    const hasWildBeer = checkWildBeerTileExists();
    if (!hasWildBeer) {
      console.log('💧 No wild-beer tile found, stopping bubbles');
      stopWildBeerBubblesScreen();
    }
  }, 2000);
}

function checkWildBeerTileExists(): boolean {
  const tiles = window.STATE?.tiles || [];
  return tiles.some((t: any) => 
    t && !t.destroyed && t.special === 'wild-beer' && t.visible
  );
}

function cleanup() {
  isBubblesActive = false;

  // Kill spawn interval
  if (spawnInterval) {
    spawnInterval.kill();
    spawnInterval = null;
  }

  // Kill health check
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Cleanup bubbles
  if (activeBubbles.length > 0) {
    activeBubbles.forEach(bubble => {
      try {
        gsap.killTweensOf(bubble);
        gsap.killTweensOf(bubble.scale);
        gsap.killTweensOf(bubble.alpha);
        if (bubble.parent) {
          bubble.parent.removeChild(bubble);
        }
        graphicsPool.release(bubble);
      } catch {}
    });
    activeBubbles = [];
  }

  // Remove container
  if (bubblesContainer) {
    try {
      if (bubblesContainer.parent) {
        bubblesContainer.parent.removeChild(bubblesContainer);
      }
      bubblesContainer.destroy({ children: true });
    } catch {}
    bubblesContainer = null;
  }
}
```

---

## ✅ Zaključak

**Preporuka: Kreirati novi modul `wild-beer-bubbles-screen.ts`**

**Razlozi:**
1. ✅ Potpuno neovisan o tile hijerarhiji (kao transition screen)
2. ✅ Radi kao full-screen FX preko cijelog ekrana
3. ✅ Modularan - može se pozvati bilo gdje
4. ✅ Continuous animacija dok wild-beer tile postoji
5. ✅ Lako cleanup i maintenance
6. ✅ Ne mijenja postojeći `createWildBeerBubblesExplosion` (za merge events)

**Sljedeći koraci:**
1. Kreirati `src/modules/wild-beer-bubbles-screen.ts`
2. Refaktorirati pozive u `app-core.ts` (zamijeniti `startWildBeerBubbles` s `startWildBeerBubblesScreen`)
3. Dodati cleanup u `rebuildBoard` i `startLevel`
4. Testirati na subsequent boards nakon interim board + continue CTA
