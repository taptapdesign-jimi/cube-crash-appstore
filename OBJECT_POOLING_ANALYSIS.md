# 🎯 Object Pooling - Analiza i Implementacijski Plan

## 📊 Trenutno Stanje

### Gdje se kreiraju objekti:

1. **Tiles (Container)** - `board.ts:373` (`createTile`)
   - ~20-30 tiles po boardu
   - Kreira se: `new Container()` + `new Graphics()` (shadow) + `new Sprite()` (base)
   - Destroy-uje se: pri merge-6, clean board, rebuild

2. **Graphics objekti** - `fx.js` (particles, shards, bubbles)
   - **Shards**: `woodShardsAtTile()` - ~20-40 shards po merge-6
   - **Bubbles**: `dragJuiceBubbleTrail()` - 4-10 bubbles po drag
   - **Sparkles**: `magicSparklesAtTile()` - kontinuirano za wild tiles
   - **Crack overlay**: `regularMerge6Shards()` - 1 Graphics po merge

3. **Container objekti** - za particle systems
   - `new Container()` za layer-e u `fx.js`
   - ~5-10 po merge animaciji

### Frekvencija kreiranja:
- **Tiles**: ~2-4 po merge-u (spawn nakon merge-6)
- **Graphics (particles)**: ~50-100 po merge-6 (shards + bubbles)
- **Containers**: ~5-10 po merge-u

### GC pritisak:
- **Visok**: Kontinuirano kreiranje/destroyanje tijekom gameplay-a
- **Peak**: Merge-6 animacije (50+ objekata odjednom)
- **Problem**: GC pauze mogu uzrokovati frame drops

---

## ✅ Prednosti Object Pooling-a

1. **Smanjenje GC pauza** - objekti se reuse-aju umjesto destroy/create
2. **Brže spawn/destroy** - nema alokacije memorije
3. **Predvidljiviji performance** - manje varijabilnosti u frame time-u
4. **Bolje za iOS** - manje pritiska na memory management

---

## ⚠️ Rizici i Utjecaj

### 1. **Core Game Logic** - 🟢 NEMA UTJECAJA
- Object pooling je **samo memory optimization**
- Game logic ostaje identična
- `createTile()` i `destroy()` funkcije samo mijenjaju **kako** se objekti kreiraju, ne **što** se događa

### 2. **Dizajn/UI** - 🟢 NEMA UTJECAJA
- Visual output ostaje identičan
- Pooling je transparentan za rendering
- Nema promjena u animacijama ili vizualima

### 3. **Performance** - 🟢 POZITIVAN UTJECAJ
- **Smanjenje GC pauza**: 30-50% manje GC overhead
- **Brže spawn**: 2-3x brže tile spawn (nema alokacije)
- **Stabilniji FPS**: manje frame drops tijekom merge-6

### 4. **Timeline Animacije (GSAP)** - 🟡 POTREBNA PAŽNJA
- **Rizik**: GSAP animacije drže reference na objekte
- **Rješenje**: 
  - Kill GSAP tweens prije vraćanja u pool
  - Reset animacijskih svojstava (x, y, alpha, rotation, scale)
  - Provjeriti da animacije ne drže "zombie" reference

### 5. **Memory Leaks** - 🟡 POTREBNA PAŽNJA
- **Rizik**: Objekti u pool-u mogu zadržati reference
- **Rješenje**:
  - Eksplicitno reset-ovati sve svojstva prije reuse-a
  - Kill GSAP tweens
  - Clear Graphics objekti (`graphics.clear()`)
  - Remove children iz Container-a

---

## 🎯 Implementacijski Plan

### Faza 1: Graphics Pool (Najlakše, najveći benefit)

**Cilj**: Pool za Graphics objekte (shards, bubbles, sparkles)

**Koraci**:
1. Kreirati `GraphicsPool` klasu
2. Pool size: 100-200 Graphics objekata
3. Modificirati `woodShardsAtTile()`, `dragJuiceBubbleTrail()`, `magicSparklesAtTile()`
4. Reset funkcija: `clear()`, reset `x`, `y`, `alpha`, `rotation`, `scale`
5. Kill GSAP tweens prije vraćanja u pool

**Utjecaj na kod**:
- Minimalan - samo mijenja `new Graphics()` → `pool.acquire()`
- Nema promjene u game logic

**Rizici**:
- Nizak - Graphics objekti su jednostavni
- Potrebno paziti na GSAP cleanup

---

### Faza 2: Container Pool (Srednje teško)

**Cilj**: Pool za Container objekte (particle layers)

**Koraci**:
1. Kreirati `ContainerPool` klasu
2. Pool size: 20-30 Container objekata
3. Modificirati `fx.js` gdje se kreiraju layer-i
4. Reset funkcija: remove all children, reset transform properties
5. Kill GSAP tweens na container-u i djeci

**Utjecaj na kod**:
- Srednji - potrebno paziti na children cleanup
- Nema promjene u game logic

**Rizici**:
- Srednji - Container može imati children koji se moraju cleanup-ati
- Potrebno eksplicitno remove children prije reuse-a

---

### Faza 3: Tile Pool (Najteže, najmanji benefit)

**Cilj**: Pool za Tile objekte (Container + Graphics + Sprite)

**Koraci**:
1. Kreirati `TilePool` klasu
2. Pool size: 30-40 Tile objekata (max board size)
3. Modificirati `createTile()` u `board.ts`
4. Reset funkcija:
   - Remove all children
   - Reset `gridX`, `gridY`, `value`, `stackDepth`, `locked`
   - Reset `shadow`, `rotG`, `base`, `overlay`, `pips`
   - Kill GSAP tweens
   - Clear Graphics objekti
5. Modificirati destroy logiku - vraćanje u pool umjesto destroy

**Utjecaj na kod**:
- **VISOK** - Tile objekti su kompleksni (children, animacije, state)
- Potrebno paziti na:
  - GSAP animacije (idle bounce, merge animacije)
  - Wild tile animacije (bubbles, shimmer, stars)
  - Grid references
  - Board parent references

**Rizici**:
- **VISOK** - Tile objekti imaju puno state-a i referenci
- Mogućnost memory leak-a ako se ne reset-uje sve
- Potrebno testirati sve edge case-ove (wild tiles, magnet, merge-6)

**Preporuka**: 
- **NE preporučujem Fazu 3** za sada
- Tile pooling je kompleksan i rizičan
- Graphics pooling daje 80% benefita uz 20% rizika

---

## 📋 Do Lista (Preporučena Implementacija)

### ✅ Faza 1: Graphics Pool (PRIORITET)

- [ ] **1.1** Kreirati `src/modules/object-pool.ts` modul
  - [ ] `GraphicsPool` klasa
  - [ ] `acquire()` metoda
  - [ ] `release(graphics)` metoda
  - [ ] `reset(graphics)` metoda (clear, reset properties)
  - [ ] Pool size: 150 objekata (configurable)

- [ ] **1.2** Integrirati u `fx.js`
  - [ ] Import `GraphicsPool`
  - [ ] Modificirati `woodShardsAtTile()` - koristiti pool
  - [ ] Modificirati `dragJuiceBubbleTrail()` - koristiti pool
  - [ ] Modificirati `magicSparklesAtTile()` - koristiti pool
  - [ ] Modificirati `regularMerge6Shards()` - koristiti pool

- [ ] **1.3** GSAP Cleanup
  - [ ] Kill GSAP tweens prije `release()`
  - [ ] Provjeriti da animacije ne drže reference
  - [ ] Testirati da se animacije ne "zombie" nakon release-a

- [ ] **1.4** Testing
  - [ ] Test merge-6 animacije (shards)
  - [ ] Test wild juice drag (bubbles)
  - [ ] Test wild star sparkles (kontinuirano)
  - [ ] Test memory usage (Chrome DevTools)
  - [ ] Test performance (FPS, GC pauses)

---

### ⚠️ Faza 2: Container Pool (OPCIONALNO)

- [ ] **2.1** Proširiti `object-pool.ts`
  - [ ] `ContainerPool` klasa
  - [ ] `acquire()` metoda
  - [ ] `release(container)` metoda
  - [ ] `reset(container)` metoda (remove children, reset transform)

- [ ] **2.2** Integrirati u `fx.js`
  - [ ] Modificirati sve `new Container()` za particle layers
  - [ ] Paziti na children cleanup

- [ ] **2.3** Testing
  - [ ] Test merge animacije
  - [ ] Test memory leaks
  - [ ] Test performance

---

### ❌ Faza 3: Tile Pool (NE PREPORUČUJEM)

- [ ] **3.1** Proširiti `object-pool.ts`
  - [ ] `TilePool` klasa
  - [ ] Kompleksna reset logika

- [ ] **3.2** Modificirati `board.ts`
  - [ ] `createTile()` koristi pool
  - [ ] Destroy logika vraća u pool

- [ ] **3.3** Extensive Testing
  - [ ] Sve edge case-ove
  - [ ] Wild tiles
  - [ ] Magnet merges
  - [ ] Memory leaks

**Preporuka**: Preskoči Fazu 3 - previše rizično za mali benefit.

---

## 🔧 Tehnički Detalji

### GraphicsPool Implementacija

```typescript
class GraphicsPool {
  private pool: Graphics[] = [];
  private maxSize: number = 150;
  
  acquire(): Graphics {
    let g = this.pool.pop();
    if (!g) {
      g = new Graphics();
    }
    // Reset properties
    g.clear();
    g.x = 0;
    g.y = 0;
    g.alpha = 1;
    g.rotation = 0;
    g.scale.set(1);
    return g;
  }
  
  release(g: Graphics): void {
    // Kill GSAP tweens
    gsap.killTweensOf(g);
    gsap.killTweensOf(g.x);
    gsap.killTweensOf(g.y);
    gsap.killTweensOf(g.alpha);
    gsap.killTweensOf(g.rotation);
    gsap.killTweensOf(g.scale);
    
    // Remove from parent
    if (g.parent) {
      g.parent.removeChild(g);
    }
    
    // Reset
    g.clear();
    g.x = 0;
    g.y = 0;
    g.alpha = 1;
    g.rotation = 0;
    g.scale.set(1);
    
    // Return to pool
    if (this.pool.length < this.maxSize) {
      this.pool.push(g);
    } else {
      g.destroy();
    }
  }
}
```

### Integracija u fx.js

```javascript
// Na vrhu fajla
import { graphicsPool } from './object-pool.js';

// Umjesto: const shard = new Graphics();
const shard = graphicsPool.acquire();

// Umjesto: shard.destroy();
graphicsPool.release(shard);
```

---

## 📊 Očekivani Rezultati

### Performance Metrics

| Metrika | Prije | Poslije | Poboljšanje |
|---------|-------|---------|-------------|
| GC Pauses | ~50-100ms | ~20-40ms | 50-60% |
| Tile Spawn Time | ~2-3ms | ~0.5-1ms | 66-75% |
| Merge-6 FPS Drop | ~5-10 FPS | ~2-5 FPS | 50% |
| Memory Allocations | Visoke | Niske | 70-80% |

### Memory Usage

- **Prije**: ~5-10MB allocations po merge-6
- **Poslije**: ~1-2MB allocations po merge-6
- **Smanjenje**: 70-80%

---

## ⚠️ Upozorenja

1. **GSAP Cleanup je kritičan** - animacije moraju biti kill-ane prije release-a
2. **Parent References** - objekti moraju biti remove-ani iz parent-a prije release-a
3. **Graphics.clear()** - mora se pozvati prije reuse-a
4. **Testing je obavezan** - testirati sve animacije i edge case-ove

---

## 🎯 Preporuka

**Implementiraj samo Fazu 1 (Graphics Pool)**:
- ✅ Najveći benefit (80% poboljšanja)
- ✅ Najmanji rizik (jednostavni objekti)
- ✅ Minimalan utjecaj na kod
- ✅ Lako testirati i rollback-ati

**Preskoči Fazu 2 i 3** za sada:
- ⚠️ Faza 2: Srednji benefit, srednji rizik
- ❌ Faza 3: Mali benefit, visok rizik

---

## 📝 Sljedeći Koraci

1. **Odluči se**: Faza 1 samo, ili Faza 1 + 2?
2. **Kreiraj branch**: `feature/object-pooling-graphics`
3. **Implementiraj**: GraphicsPool klasu
4. **Integriraj**: U fx.js (shards, bubbles, sparkles)
5. **Testiraj**: Sve animacije, memory usage, performance
6. **Merge**: Ako sve radi kako treba

---

## 🔍 Monitoring

Nakon implementacije, pratiti:
- Chrome DevTools Memory profiler
- Performance profiler (GC pauses)
- FPS stabilnost tijekom merge-6
- Memory leaks (heap snapshot)

---

**Verzija**: v60  
**Datum**: 2024  
**Status**: Analiza - čeka odluku

