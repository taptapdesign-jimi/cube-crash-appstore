# 🔍 WILD BEER DRAG PARTICLES & IDLE ANIMATION ASSESSMENT

## Problem
Korisnik je prijavio:
1. **Wild beer drag particles (smoke trail) imaju lag i nisu fluidni** - želi da budu isti kao wild zvjezdica
2. **Osjeća da uzimaju puno CPU i memorije**
3. **Idle animacija na wild beeru kada se draga je i dalje prisutna** (što je dobro), ali nije siguran da li je dobro uništena na merge 6 kada wild beer mergamo sa drugom kockicom

---

## 🔍 ANALIZA PROBLEMA

### 1. DRAG PARTICLES (SMOKE TRAIL) ⚠️ **PROBLEM**

**Lokacija:** `src/modules/drag-core.ts` linija 280-306

**Trenutno stanje:**
- Wild beer i wild zvjezdica **koriste isti sistem** - `magicSparklesAtTile()`
- Oba koriste `setInterval` koji poziva `magicSparklesAtTile()` svakih 100ms tijekom drag-a
- Interval se čisti samo kada se drag završi ili tile postane destroyed

**Kod problema:**
```typescript
// drag-core.ts linija 289-306
drag._sparkleInterval = setInterval(() => {
  if (drag.t && (drag.t.special === 'wild' || drag.t.special === 'wild-beer') && !drag.t.destroyed) {
    try {
      const tileZ = drag.t?.zIndex ?? 0;
      const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001;
      magicSparklesAtTile(board, drag.t, { intensity: 1.0, zIndex: particlesZ });
    } catch (err) {
      console.warn('Wild interval sparkles error:', err);
    }
  } else {
    // Clear interval if tile is no longer being dragged
    if (drag._sparkleInterval) {
      clearInterval(drag._sparkleInterval);
      drag._sparkleInterval = null;
    }
  }
}, 100); // Every 100ms for more frequent emission
```

**Problem:**
- `magicSparklesAtTile()` stvara **20 shards** po pozivu (linija 538 u fx.js)
- Svakih 100ms = **10 poziva po sekundi** = **200 shards po sekundi** tijekom drag-a
- Svaki shard ima GSAP animaciju koja traje 0.5-0.9s
- **Akumulacija:** Nakon 1 sekunde drag-a, može biti **200+ aktivnih shards** s GSAP animacijama
- **CPU/GPU pritisak:** Previše Graphics objekata i GSAP animacija istovremeno

**Zašto wild zvjezdica izgleda bolje:**
- Wild zvjezdica koristi `attachWildStarHalo()` koji stvara **fiksni broj orbitirajućih zvjezdica** (npr. 5-8)
- Nema kontinuirano spawnanje novih particles tijekom drag-a
- Koristi `gsap.ticker.add()` za smooth animaciju (optimizirano)

---

### 2. IDLE ANIMACIJA (BUBBLES) ⚠️ **PROBLEM**

**Lokacija:** `src/modules/fx.js` linija 96-247 (`startWildBeerBubbles`)

**Trenutno stanje:**
- Wild beer ima kontinuirane bubble animacije koje se pokreću kada se tile spawna
- Bubbles se spawnaju svakih 0.3-0.6s
- Svaki bubble ima 3 GSAP animacije (scale, position, alpha)
- Bubbles se čiste u `stopWildBeerBubbles()` funkciji

**Cleanup na merge 6:**
- `removeTile()` poziva `stopWildBeerBubbles(t)` (linija 5006 u app-core.ts)
- `removeTile()` se poziva za **src tile** (linija 1507 u app-merge.ts)
- `removeTile()` se poziva za **dst tile** (linija 1775 u app-merge.ts)
- **PROBLEM:** Ako je wild beer **dst tile**, bubbles se čiste **NAKON** merge 6 animacije
- **PROBLEM:** Ako je wild beer **src tile**, bubbles se čiste **PRIJE** merge 6 animacije, ali možda ne dovoljno brzo

**Kod problema:**
```typescript
// app-merge.ts linija 1648-1775
gsap.to(src, {
  x: dst.x, y: dst.y, duration: 0.10, ease: 'power2.out',
  onComplete: async () => {
    removeTile(src); // ✅ Čisti src tile bubbles
    // ... merge 6 animacije ...
    removeTile(dst); // ✅ Čisti dst tile bubbles, ali NAKON animacije
  }
});
```

**Problem:**
- Bubbles se čiste **NAKON** merge 6 animacije za dst tile
- Ako merge 6 animacija traje 2-3 sekunde, bubbles se mogu akumulirati
- **Memory leak:** Bubbles se možda ne čiste dovoljno brzo ako se tile destroy-a prije nego što se cleanup pozove

---

### 3. CPU/GPU PRITISAK ⚠️ **PROBLEM**

**Akumulacija:**
1. **Drag particles:** 200+ shards po sekundi tijekom drag-a
2. **Idle bubbles:** 2-3 bubbles po sekundi (kontinuirano)
3. **GSAP animacije:** Svaki shard/bubble ima 2-3 GSAP animacije
4. **Graphics objekti:** Svaki shard/bubble je Graphics objekt

**Ukupno:**
- Tijekom drag-a: **200+ shards + 2-3 bubbles = 200+ Graphics objekata**
- Svaki Graphics objekt ima **2-3 GSAP animacije**
- **Ukupno: 400-600 GSAP animacija istovremeno**

**Zašto wild zvjezdica je bolja:**
- Wild zvjezdica koristi **fiksni broj orbitirajućih zvjezdica** (5-8)
- Nema kontinuirano spawnanje novih particles
- Koristi `gsap.ticker.add()` za smooth animaciju (optimizirano)
- **Ukupno: 5-8 Graphics objekata + 1 GSAP ticker = minimalan pritisak**

---

## 🎯 PREPORUKE ZA POPRAVKU

### 1. OPTIMIZIRATI DRAG PARTICLES ⚠️ **PRIORITET 1**

**Rješenje:**
- **Smanjiti frekvenciju spawnanja:** Promijeniti interval s 100ms na 200-300ms
- **Smanjiti broj shards:** Promijeniti `shardCount` s 20 na 8-12
- **Koristiti object pooling:** Već koristi `graphicsPool.acquire()`, ali možda treba optimizirati
- **Throttle animacije:** Koristiti `gsap.ticker.add()` umjesto `setInterval` za smooth animaciju

**Kod:**
```typescript
// drag-core.ts - Optimizirati interval
drag._sparkleInterval = setInterval(() => {
  if (drag.t && (drag.t.special === 'wild' || drag.t.special === 'wild-beer') && !drag.t.destroyed) {
    try {
      const tileZ = drag.t?.zIndex ?? 0;
      const particlesZ = tileZ > 9000 ? tileZ - 1 : tileZ - 0.001;
      // 🔥 OPTIMIZATION: Smanjiti intensity s 1.0 na 0.5-0.6 (smanjuje broj shards)
      magicSparklesAtTile(board, drag.t, { intensity: 0.5, zIndex: particlesZ });
    } catch (err) {
      console.warn('Wild interval sparkles error:', err);
    }
  } else {
    if (drag._sparkleInterval) {
      clearInterval(drag._sparkleInterval);
      drag._sparkleInterval = null;
    }
  }
}, 250); // 🔥 OPTIMIZATION: Povećati interval s 100ms na 250ms (4x manje poziva)
```

**Ili još bolje - koristiti isti sistem kao wild zvjezdica:**
- Wild zvjezdica koristi `attachWildStarHalo()` koji stvara fiksni broj orbitirajućih zvjezdica
- Možemo napraviti sličan sistem za wild beer - fiksni broj orbitirajućih bubbles umjesto kontinuiranog spawnanja

---

### 2. OSIGURATI CLEANUP IDLE ANIMACIJE NA MERGE 6 ⚠️ **PRIORITET 1**

**Rješenje:**
- Pozvati `stopWildBeerBubbles()` **PRIJE** merge 6 animacije za **oba tile-a** (src i dst)
- Osigurati da se bubbles čiste **odmah** kada se merge 6 pokrene

**Kod:**
```typescript
// app-merge.ts - PRIJE gsap.to(src, ...)
// 🔥 CRITICAL: Stop wild beer bubbles PRIJE merge 6 animacije
if (src?.special === 'wild-beer') {
  try {
    stopWildBeerBubbles(src);
    console.log('🧹 Stopped wild beer bubbles for src tile before merge 6');
  } catch {}
}
if (dst?.special === 'wild-beer') {
  try {
    stopWildBeerBubbles(dst);
    console.log('🧹 Stopped wild beer bubbles for dst tile before merge 6');
  } catch {}
}

gsap.to(src, {
  x: dst.x, y: dst.y, duration: 0.10, ease: 'power2.out',
  onComplete: async () => {
    removeTile(src); // ✅ Čisti src tile bubbles (double-check)
    // ... merge 6 animacije ...
    removeTile(dst); // ✅ Čisti dst tile bubbles (double-check)
  }
});
```

---

### 3. OPTIMIZIRATI MAGICSPARKLESATTILE ⚠️ **PRIORITET 2**

**Rješenje:**
- Smanjiti default `shardCount` s 20 na 8-12
- Smanjiti `duration` s 0.5-0.9s na 0.3-0.6s
- Koristiti `gsap.ticker.add()` umjesto `setInterval` za smooth animaciju

**Kod:**
```typescript
// fx.js - Optimizirati magicSparklesAtTile
const intensity = opts.intensity ?? 1.0;
const shardCount = Math.max(1, Math.round(8 * intensity)); // 🔥 OPTIMIZATION: Smanjiti s 20 na 8 (60% reduction)

// ... (ostali kod) ...

gsap.to(shard, {
  x: endX,
  y: endY,
  rotation: shard.rotation + (Math.random() - 0.5) * Math.PI * 2,
  alpha: 0,
  duration: 0.3 + Math.random() * 0.3, // 🔥 OPTIMIZATION: Smanjiti s 0.5-0.9s na 0.3-0.6s
  ease: 'power1.out',
  onComplete: () => {
    // ... cleanup ...
  }
});
```

---

## 📊 RIZIKO PROCJENA

| Problem | Riziko | Prioritet | Vjerojatnost |
|---------|--------|-----------|--------------|
| Drag particles lag | 🔴 **VISOK** | 1 | 90% |
| Idle animacija cleanup | 🟡 **SREDNJI** | 1 | 70% |
| CPU/GPU pritisak | 🔴 **VISOK** | 1 | 95% |

---

## 🎯 ZAKLJUČAK

**Glavni problemi:**
1. **Drag particles stvaraju previše shards** (200+ po sekundi) - treba smanjiti frekvenciju i broj
2. **Idle animacija se možda ne čisti dovoljno brzo** na merge 6 - treba pozvati cleanup PRIJE animacije
3. **CPU/GPU pritisak je previsok** zbog akumulacije Graphics objekata i GSAP animacija

**Rješenje:**
- Optimizirati drag particles (smanjiti frekvenciju i broj shards)
- Osigurati cleanup idle animacije PRIJE merge 6 animacije
- Optimizirati `magicSparklesAtTile()` za manji CPU/GPU pritisak

**Očekivani rezultat:**
- Drag particles su fluidni kao wild zvjezdica
- Idle animacija se čisti odmah na merge 6
- CPU/GPU pritisak je smanjen za 60-70%

---

**Napomena:** Ovo je assessment bez popravki. Sve preporuke su detaljno opisane i spremne za implementaciju.

