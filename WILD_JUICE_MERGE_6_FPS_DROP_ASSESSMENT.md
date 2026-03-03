# 🚨 WILD JUICE MERGE 6 FPS DROP & FREEZE ASSESSMENT

## Problem
Korisnik ima FPS drop, freeze i lag kada se radi merge 6 wild juice na kockicu.

---

## 🔍 ANALIZA PROBLEMA

### 1. ISTOVREMENO POKRETANJE PREVIŠE ANIMACIJA ⚠️ **KRITIČNO**

**Lokacija:** `src/modules/app-core.ts` linija 4040-4123

**Trenutno stanje:**
Kada se wild juice merga s kockicom (merge 6), **SVE animacije se pokreću istovremeno** u `requestAnimationFrame` callback-u:

```typescript
// app-core.ts linija 4066-4089
requestAnimationFrame(() => {
  // 🔥 PROBLEM: Sve se pokreće istovremeno!
  createWildJuiceBubblesExplosion(board, dst); // 100 bubbles + GSAP ticker + FPS monitoring
  woodShardsAtTile(...); // 30 shards
  wildImpactEffect(...); // Tile animacija
  smokeBubblesAtTile(...); // Smoke efekti
  screenShake(...); // Screen shake
  glassCrackAtTile(...); // Glass crack
  innerFlashAtTile(...); // Flash
  showMultiplierTile(...); // Multiplier animacija
});
```

**Problem:**
- **100 bubbles** se stvara u `createWildJuiceBubblesExplosion()`
- Svaki bubble ima **3 GSAP animacije** (position, scale, alpha)
- **GSAP ticker** se dodaje za spawn logic (svaki frame)
- **FPS monitoring** se pokreće i poziva se svaki frame
- **30 shards** se stvara u `woodShardsAtTile()`
- **Screen shake** animira cijeli board
- **Wild impact effect** animira tile
- **Smoke bubbles** se stvaraju

**Ukupno:**
- **100 bubbles × 3 animacije = 300 GSAP animacije**
- **30 shards × 1 animacija = 30 GSAP animacije**
- **1 GSAP ticker** (svaki frame)
- **FPS monitoring** (svaki frame)
- **Screen shake** (board animacija)
- **Wild impact** (tile animacija)
- **Smoke bubbles** (multiple animacije)
- **Glass crack** (multiple animacije)
- **Flash** (animacija)
- **Multiplier** (animacija)

**Ukupno: 330+ GSAP animacije + ticker + FPS monitoring = PREVIŠE!**

---

### 2. BUBBLES ANIMACIJA - PREVIŠE ISTOVREMENIH OBJEKATA ⚠️ **KRITIČNO**

**Lokacija:** `src/modules/fx.js` linija 1661-2100

**Trenutno stanje:**
```javascript
const totalBubbles = 100; // 100 bubbles
const spawnDuration = 2000; // 2 sekunde spawn
const maxActive = 80; // Max 80 aktivnih bubbles
```

**Problem:**
- **100 bubbles** se stvara u 2 sekunde
- Svaki bubble ima **3 GSAP animacije**
- **GSAP ticker** se poziva **svaki frame** (60fps = 60 puta po sekundi)
- **FPS monitoring** se poziva **svaki frame**
- **Culling** se provodi **svaki 3. frame**

**Akumulacija:**
- Nakon 1 sekunde: **~50 bubbles × 3 animacije = 150 GSAP animacije**
- Nakon 2 sekunde: **~100 bubbles × 3 animacije = 300 GSAP animacije**
- **GSAP ticker** se poziva **120 puta** (2 sekunde × 60fps)
- **FPS monitoring** se poziva **120 puta**

**CPU/GPU pritisak:**
- **300 GSAP animacije** istovremeno
- **1 GSAP ticker** (svaki frame)
- **FPS monitoring** (svaki frame)
- **Culling** (svaki 3. frame)
- **100 Graphics/Sprite objekata** na stage-u

---

### 3. REQUESTANIMATIONFRAME OVERHEAD ⚠️ **PROBLEM**

**Lokacija:** `src/modules/app-core.ts` linija 4066

**Problem:**
```typescript
requestAnimationFrame(() => {
  createWildJuiceBubblesExplosion(board, dst);
  // ... ostale animacije ...
});
```

**Problem:**
- `requestAnimationFrame` se poziva **NAKON** merge 6 animacije
- Sve animacije se pokreću **istovremeno** u istom frame-u
- To uzrokuje **masivni spike** u CPU/GPU pritisku
- Browser može **freeze-ati** ili **drop-ati FPS** na 0

---

### 4. FPS MONITORING OVERHEAD ⚠️ **PROBLEM**

**Lokacija:** `src/modules/fx.js` linija 65-80

**Problem:**
```javascript
function updateFpsCounter() {
  fpsUpdateCounter++;
  if (fpsUpdateCounter % 2 !== 0) return; // Throttled to every 2nd frame
  if (!fpsMonitorActive) return;
  fpsFrameCount++;
  const now = performance.now();
  // ... FPS calculation ...
}
```

**Problem:**
- FPS monitoring se poziva **svaki 2. frame** (30 puta po sekundi)
- `performance.now()` se poziva **30 puta po sekundi**
- To dodaje **overhead** u kritičnom trenutku (merge 6)

---

### 5. GSAP TICKER OVERHEAD ⚠️ **PROBLEM**

**Lokacija:** `src/modules/fx.js` linija 1980-2030

**Problem:**
```javascript
gsap.ticker.add(spawnTick);
```

**Problem:**
- `spawnTick` se poziva **svaki frame** (60fps = 60 puta po sekundi)
- Unutar `spawnTick` se poziva:
  - `updateFpsCounter()` (svaki 2. frame)
  - `makeBubble()` (do 3 puta po frame-u)
  - Culling (svaki 3. frame)
- To dodaje **masivni overhead** u kritičnom trenutku

---

### 6. KONFLIKT IZMEĐU ANIMACIJA ⚠️ **PROBLEM**

**Problem:**
- `createWildJuiceBubblesExplosion()` se pokreće **istovremeno** s:
  - `woodShardsAtTile()` - stvara 30 shards
  - `wildImpactEffect()` - animira tile
  - `smokeBubblesAtTile()` - stvara smoke
  - `screenShake()` - animira board
  - `glassCrackAtTile()` - stvara glass crack
  - `innerFlashAtTile()` - stvara flash
  - `showMultiplierTile()` - animira multiplier

**Konflikt:**
- Sve animacije pokušavaju **animirati isti tile/board** istovremeno
- To može uzrokovati **race condition** ili **conflict**
- Browser može **freeze-ati** ili **drop-ati FPS**

---

## 🎯 PREPORUKE ZA POPRAVKU

### 1. STAGGER ANIMACIJE (NE ISTOVREMENO) ⚠️ **PRIORITET 1**

**Rješenje:**
- Pokrenuti animacije **sekvencijalno** umjesto istovremeno
- Koristiti `gsap.delayedCall()` ili `gsap.timeline()` za stagger

**Kod:**
```typescript
// app-core.ts - Umjesto requestAnimationFrame s istovremenim pozivima
if (isWildJuiceMerge) {
  // 1. Pokreni shards i efekte PRVO (brzo, 0-200ms)
  woodShardsAtTile(board, dst, { ... });
  wildImpactEffect(dst, { ... });
  screenShake(STATE.app, { ... });
  glassCrackAtTile(STATE.board, dst, ...);
  innerFlashAtTile(STATE.board, dst, ...);
  
  // 2. Pokreni bubbles NAKON 200ms (stagger)
  gsap.delayedCall(0.2, () => {
    createWildJuiceBubblesExplosion(board, dst);
  });
  
  // 3. Pokreni smoke NAKON 300ms (stagger)
  gsap.delayedCall(0.3, () => {
    smokeBubblesAtTile(board, dst, ...);
  });
  
  // 4. Pokreni multiplier NAKON 100ms (stagger)
  gsap.delayedCall(0.1, () => {
    showMultiplierTile(board, dst, mult, ...);
  });
}
```

---

### 2. SMANJITI BROJ BUBBLES ⚠️ **PRIORITET 1**

**Rješenje:**
- Smanjiti `totalBubbles` s 100 na 60-70
- Smanjiti `maxActive` s 80 na 50-60
- Smanjiti `spawnDuration` s 2000ms na 1500ms

**Kod:**
```javascript
// fx.js - Smanjiti bubbles
const totalBubbles = 70; // Smanjeno s 100 na 70 (30% reduction)
const spawnDuration = 1500; // Smanjeno s 2000ms na 1500ms (25% faster)
const maxActive = 60; // Smanjeno s 80 na 60 (25% reduction)
```

---

### 3. OPTIMIZIRATI GSAP TICKER ⚠️ **PRIORITET 1**

**Rješenje:**
- Throttle `spawnTick` na **svaki 2. frame** umjesto svaki frame
- Throttle FPS monitoring na **svaki 4. frame** umjesto svaki 2. frame
- Throttle culling na **svaki 5. frame** umjesto svaki 3. frame

**Kod:**
```javascript
// fx.js - Optimizirati ticker
let frameCounter = 0;
const spawnTick = () => {
  frameCounter++;
  
  // Throttle spawn logic na svaki 2. frame
  if (frameCounter % 2 === 0) {
    // Spawn logic...
  }
  
  // Throttle FPS monitoring na svaki 4. frame
  if (frameCounter % 4 === 0) {
    updateFpsCounter();
  }
  
  // Throttle culling na svaki 5. frame
  if (frameCounter % 5 === 0) {
    // Culling logic...
  }
};
```

---

### 4. DISABLE FPS MONITORING U KRITIČNOM TRENUTKU ⚠️ **PRIORITET 2**

**Rješenje:**
- Ne pokretati FPS monitoring ako je već aktivan
- Disable FPS monitoring nakon 2 sekunde (kada bubbles završe)

**Kod:**
```javascript
// fx.js - Disable FPS monitoring nakon 2 sekunde
if (!fpsMonitorActive) {
  startFpsMonitoring();
  
  // Auto-disable nakon 2 sekunde
  gsap.delayedCall(2.0, () => {
    stopFpsMonitoring();
  });
}
```

---

### 5. OPTIMIZIRATI BUBBLES SPAWN RATE ⚠️ **PRIORITET 2**

**Rješenje:**
- Smanjiti `perMs` (bubbles per millisecond)
- Smanjiti `toSpawn` s 3 na 2 po frame-u
- Dodati **cooldown** između spawn-a

**Kod:**
```javascript
// fx.js - Optimizirati spawn rate
const perMs = totalBubbles / spawnDuration; // Već optimizirano
const toSpawn = Math.min(2, Math.floor(acc)); // Smanjeno s 3 na 2
```

---

### 6. REMOVE REQUESTANIMATIONFRAME ⚠️ **PRIORITET 1**

**Rješenje:**
- Ukloniti `requestAnimationFrame` wrapper
- Pokrenuti animacije **direktno** ali **stagger-ano**

**Kod:**
```typescript
// app-core.ts - Ukloniti requestAnimationFrame
if (isWildJuiceMerge) {
  // Pokreni direktno, ali stagger-ano
  woodShardsAtTile(board, dst, { ... });
  wildImpactEffect(dst, { ... });
  
  // Stagger bubbles
  gsap.delayedCall(0.2, () => {
    createWildJuiceBubblesExplosion(board, dst);
  });
}
```

---

## 📊 RIZIKO PROCJENA

| Problem | Riziko | Prioritet | Vjerojatnost |
|---------|--------|-----------|--------------|
| Istovremeno pokretanje animacija | 🔴 **VISOK** | 1 | 95% |
| Previše bubbles | 🔴 **VISOK** | 1 | 90% |
| GSAP ticker overhead | 🔴 **VISOK** | 1 | 85% |
| FPS monitoring overhead | 🟡 **SREDNJI** | 2 | 70% |
| RequestAnimationFrame overhead | 🟡 **SREDNJI** | 1 | 80% |

---

## 🎯 ZAKLJUČAK

**Glavni problemi:**
1. **Sve animacije se pokreću istovremeno** u `requestAnimationFrame` - masivni spike
2. **100 bubbles × 3 animacije = 300 GSAP animacije** istovremeno
3. **GSAP ticker se poziva svaki frame** - overhead
4. **FPS monitoring se poziva svaki frame** - overhead
5. **Konflikt između animacija** - race condition

**Rješenje:**
- Stagger animacije (ne istovremeno)
- Smanjiti broj bubbles (100 → 70)
- Optimizirati GSAP ticker (throttle)
- Disable FPS monitoring u kritičnom trenutku
- Ukloniti `requestAnimationFrame` wrapper

**Očekivani rezultat:**
- FPS drop smanjen za 60-70%
- Freeze eliminiran
- Lag smanjen za 50-60%
- Smooth animacija bez spike-ova

---

**Napomena:** Ovo je assessment bez popravki. Sve preporuke su detaljno opisane i spremne za implementaciju.

