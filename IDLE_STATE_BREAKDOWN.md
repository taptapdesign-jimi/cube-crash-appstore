# Breakdown: Idle Stanje Obične Kockice - Bump Animacija i Smoke Efekti

## 📋 Pregled

Ovaj dokument objašnjava kako funkcioniše idle animacija za obične kockice (tiles) u igri. Kada tabla nije aktivna određeno vreme, kockice dobijaju subtilnu "bump" animaciju (povećanje i rotacija) zajedno sa smoke efektima (čestice dima).

---

## 🎯 1. IDLE STANJE - Detekcija i Aktivacija

### 1.1 Lokacija Koda
- **Fajl:** `/src/modules/tile-idle-bounce.ts`
- **Funkcija:** `startTileIdleBounce(tiles: Tile[], board: any)`

### 1.2 Kako Se Aktivira

Idle animacije se pokreću kada:
1. **Tabla je postavljena** - poziva se `TILE_IDLE_BOUNCE.start(tiles, board)` u `app-core.ts` funkciji `layoutBoard()`
2. **Nema interakcije 4 sekunde** - `IDLE_WAIT_TIME = 4000ms`
3. **Kockica je aktivna** - mora biti `value > 0`, nije `locked`, nije `destroyed`

### 1.3 Konstante i Timing

```typescript
IDLE_WAIT_TIME = 4000        // 4 sekunde čekanja nakon poslednje interakcije
ANIMATION_INTERVAL = 3000    // 3 sekunde između animacija
RANDOM_INTERVAL = 1000       // ±1 sekunda random varijacija
```

### 1.4 State Management

Modul koristi globalni `state` objekat koji čuva:
- `tiles`: Lista aktivnih kockica
- `board`: Referenca na board objekat
- `isActive`: Da li je modul aktivan
- `lastInteractionTime`: Vreme poslednje interakcije
- `animationTimer`: Timer za sledeću animaciju
- `activeAnimations`: Set kockica koje trenutno animiraju

### 1.5 Resetovanje Idle Timer-a

Kada korisnik interaguje sa tablom:
- Poziva se `notifyBoardInteraction()`
- Resetuje se `lastInteractionTime = Date.now()`
- Prekida se svaka aktivna animacija
- Restartuje se timer za sledeću animaciju

---

## 🎬 2. BUMP ANIMACIJA - Scale i Rotacija

### 2.1 Lokacija Koda
- **Fajl:** `/src/modules/tile-idle-bounce.ts`
- **Funkcija:** `animateTile(tile: Tile)`

### 2.2 Kako Funkcioniše

Bump animacija se sastoji od **2 faze** koje traju ukupno **0.2 sekunde**:

#### **Faza 1: Scale Up + Rotacija (0.1s)**
```typescript
// Povećanje scale-a za 5%
tile.scale.x = baseScaleX * 1.05  // 105% originalne veličine
tile.scale.y = baseScaleY * 1.05

// Random rotacija: 1-5 stepeni levo ili desno
tiltDegrees = 1 + Math.random() * 4  // 1-5 stepeni
tiltDirection = Math.random() > 0.5 ? 1 : -1  // levo ili desno
rotation = originalRotation + tiltRadians

// Easing: power2.out (brzo start, sporiji kraj)
duration: 0.1s
```

#### **Faza 2: Return to Base (0.1s)**
```typescript
// Vraćanje na originalnu veličinu
tile.scale.x = baseScaleX  // 100%
tile.scale.y = baseScaleY

// Vraćanje rotacije na 0
rotation = originalRotation

// Easing: power2.in (sporiji start, brži kraj)
duration: 0.1s
```

### 2.3 GSAP Timeline

Animacija koristi **GSAP timeline** za koordinaciju:

```typescript
const tl = gsap.timeline({
  onComplete: () => {
    state.activeAnimations.delete(tile);
    tile._idleBounceTl = null;
  }
});

// Faza 1: Scale up
tl.to(tile.scale, { x: 1.05, y: 1.05, duration: 0.1, ease: 'power2.out' });

// Faza 1: Rotacija (istovremeno sa scale)
tl.to(tile, { rotation: tiltRadians, duration: 0.1, ease: 'power2.out' }, '<');

// Faza 2: Scale down
tl.to(tile.scale, { x: 1, y: 1, duration: 0.1, ease: 'power2.in' });

// Faza 2: Rotacija (istovremeno sa scale)
tl.to(tile, { rotation: 0, duration: 0.1, ease: 'power2.in' }, '<');
```

**Napomena:** `'<'` znači da animacija počinje **istovremeno** sa prethodnom animacijom.

### 2.4 Zašto Ovako?

- **5% scale** - dovoljno subtilno da ne ometa, ali dovoljno vidljivo
- **1-5 stepeni rotacije** - daje prirodan "bump" efekat
- **0.1s po fazi** - brzo i fluidno, ne ometa gameplay
- **power2 easing** - prirodan, ne-mehanički pokret

---

## 💨 3. SMOKE EFEKTI - Čestice i Halo

### 3.1 Lokacija Koda
- **Fajl:** `/src/modules/fx.js`
- **Funkcija:** `smokeBubblesAtTile(board, tile, tileSize, strength, options)`

### 3.2 Kada Se Aktivira

Smoke efekti se aktiviraju **u vrhuncu bump animacije** (na 0.1s):

```typescript
// U animateTile funkciji, na 0.1s timeline-a:
tl.call(() => {
  smokeBubblesAtTile(state.board, tile, 96, {
    behind: true,           // Iza kockice
    sizeScale: 0.67,        // 67% normalne veličine
    distanceScale: 0.7,     // 70% normalne distance
    countScale: 0.75,       // 75% normalnog broja čestica
    haloScale: 1.1,         // 110% normalne veličine halo-a
    strength: 0.5 + Math.random() * 0.3,  // 0.5-0.8 random
    trailAlpha: 0.3,        // 30% opacity za trail
    baseAlpha: 0.3          // 30% opacity za base
  });
}, null, 0.1);  // Poziva se na 0.1s
```

### 3.3 Kako Funkcioniše

#### **3.3.1 Kreiranje Layer-a**

```typescript
// Pozicija na centru kockice
const { x, y } = centerInBoard(board, tile, size);
const layer = new Container();
layer.x = x;
layer.y = y;

// Z-index: iza kockice (tileZ - 0.001)
layer.zIndex = behind ? tileZ - 0.001 : 9990;
```

#### **3.3.2 Generisanje Čestica**

**Broj čestica:**
```typescript
const COUNT = Math.max(6, Math.round((44 + Math.random()*14) * baseStrength * countScale));
// Za idle: ~25-35 čestica (75% od normalnog)
```

**Burst sistem:**
- Čestice se generišu u **5 burst-ova** (`BURSTS = 5`)
- Svaki burst ima mali delay (`BURST_GAP = 0.035s`)
- Daje efekat "valova" dima

**Veličina čestica:**
```typescript
const BASE_R = size * 0.051 * sizeScale;  // ~5px za idle
const MAX_R = size * 0.24 * sizeScale;    // ~16px za idle
```

**Oblik čestica:**
- **Circle** (50% šanse) - običan krug
- **Ellipse** (50% šanse) - elipsa sa aspect ratio 0.6-1.4
- Random rotacija za elipse

**Pozicija spawn-a:**
- Čestice se spawn-uju na **4 strane** kockice (top, right, bottom, left)
- Random pozicija duž strane sa `INSET` marginom

#### **3.3.3 Animacija Čestica**

Svaka čestica ima svoj **GSAP timeline** sa 4 faze:

```typescript
const tl = gsap.timeline({
  onComplete: () => {
    puff.destroy();  // Cleanup
  }
});

// Faza 1: Fade In (0.018-0.04s)
tl.to(puff, { 
  alpha: targetAlpha,  // 0.3 za idle
  duration: tIn, 
  ease: 'power2.out' 
}, stg);

// Faza 2: Move Out (0.16-0.28s)
tl.to(puff, { 
  x: dx + driftX,  // Finalna pozicija + random drift
  y: dy + driftY,
  duration: tRun, 
  ease: 'sine.out' 
}, `>${0}`);

// Faza 3: Hold (0.02-0.05s)
tl.to(puff, { 
  alpha: targetAlpha, 
  duration: tHold, 
  ease: 'none' 
}, `>${0}`);

// Faza 4: Fade Out (0.08-0.14s)
tl.to(puff, { 
  alpha: 0, 
  duration: tOut, 
  ease: 'power1.in' 
}, `>${0}`);
```

**Napomena:** `'>${0}'` znači da faza počinje **odmah nakon** prethodne.

**Kretanje:**
- Čestice se kreću **od strane kockice ka spolja**
- Random ugao (`spread = 0.9`) za prirodan efekat
- Random distance (`OUT_MIN` do `OUT_MAX`)
- Random drift za dodatnu prirodnost

#### **3.3.4 Halo Efekat**

Ispod svih čestica se kreira **halo** (svetleći krug):

```typescript
const halo = new Graphics();
const rr = size * (0.22 + 0.05*baseStrength) * haloScale;  // ~21-25px radius
halo.circle(0, 0, rr).fill({ color: 0xFFFFFF, alpha: 0.10 });

// Fade in (0.08s)
gsap.to(halo, { alpha: 0.22, duration: 0.08, ease: 'power2.out' });

// Fade out (0.28s, delay 0.18s)
gsap.to(halo, { 
  alpha: 0, 
  duration: 0.28, 
  delay: 0.18, 
  ease: 'power2.in',
  onComplete: () => halo.destroy()
});
```

### 3.4 Zašto Ovako?

- **Reduced opacity (0.3)** - subtilniji efekat za idle animaciju
- **Smaller size (0.67)** - ne ometa vizuelno
- **Fewer particles (0.75)** - manje performansi
- **Behind tile** - ne prekriva kockicu
- **Burst system** - prirodniji efekat dima

---

## 🔄 4. KOORDINACIJA - Kako Sve Radi Zajedno

### 4.1 Tok Izvršavanja

```
1. Korisnik prestane da interaguje sa tablom
   ↓
2. Čeka se IDLE_WAIT_TIME (4 sekunde)
   ↓
3. animateRandomTile() se poziva
   ↓
4. Filtrirane su dostupne kockice (ne locked, ne destroyed, ne animiraju)
   ↓
5. Izabrana je random kockica
   ↓
6. animateTile(tile) se poziva
   ↓
7. GSAP timeline se kreira
   ↓
8. Faza 1: Scale up + Rotacija (0.1s)
   ↓
9. Na 0.1s: smokeBubblesAtTile() se poziva (vrhunac animacije)
   ↓
10. Smoke čestice se generišu i animiraju
   ↓
11. Faza 2: Scale down + Rotacija (0.1s)
   ↓
12. Timeline se završava, kockica se uklanja iz activeAnimations
   ↓
13. Čeka se ANIMATION_INTERVAL + random (3-4 sekunde)
   ↓
14. Ponavlja se proces sa drugom random kockicom
```

### 4.2 Cleanup i Memory Management

**Kada se animacija prekine:**
```typescript
function stopTileAnimation(tile: Tile) {
  // Kill sve GSAP tweens
  gsap.killTweensOf(tile);
  gsap.killTweensOf(tile.scale);
  gsap.killTweensOf(tile.rotation);
  
  // Kill timeline
  if (tile._idleBounceTl) {
    tile._idleBounceTl.kill();
    tile._idleBounceTl = null;
  }
  
  // Reset scale/rotation
  tile.scale.x = 1;
  tile.scale.y = 1;
  tile.rotation = 0;
}
```

**Smoke čestice se automatski uništavaju:**
- Svaka čestica ima `onComplete` callback koji poziva `puff.destroy()`
- Halo se uništava nakon fade out animacije
- Layer se automatski uklanja nakon `ttl` vremena

### 4.3 Integracija u App Lifecycle

**Pokretanje:**
```typescript
// app-core.ts - layoutBoard()
if (TILE_IDLE_BOUNCE.ENABLE) {
  TILE_IDLE_BOUNCE.start(tiles, board);
}
```

**Zaustavljanje:**
```typescript
// app-core.ts - rebuildBoard()
TILE_IDLE_BOUNCE.stop();  // Pre rebuild-a
```

**Notifikacija interakcije:**
```typescript
// Poziva se kada korisnik klikne/pomeri kockicu
TILE_IDLE_BOUNCE.notifyInteraction();
```

---

## 📊 5. TEHNIČKI DETALJI

### 5.1 Tehnologije

- **GSAP (GreenSock Animation Platform)**: Za sve animacije (scale, rotation, alpha, position)
- **Pixi.js**: Za rendering (Container, Graphics, Sprite)
- **TypeScript**: Za type safety

### 5.2 Performance Optimizacije

1. **Filtering kockica** - samo aktivne kockice se animiraju
2. **Set za tracking** - `activeAnimations` Set za brzu proveru
3. **Automatic cleanup** - sve animacije se automatski uništavaju
4. **Reduced particle count** - manje čestica za idle animaciju
5. **Lower opacity** - manje GPU load

### 5.3 Edge Cases

- **Kockica se uništi tokom animacije** - provera `tile.destroyed` u `animateTile`
- **Tabla se rebuild-uje** - `stop()` se poziva pre rebuild-a
- **Korisnik interaguje tokom animacije** - sve animacije se prekidaju
- **Document visibility change** - (nije implementirano u ovom modulu, ali bi trebalo)

---

## 🎨 6. VIZUELNI REZULTAT

### 6.1 Bump Animacija
- Kockica se **blago poveća** (5%)
- Kockica se **blago nagne** (1-5°)
- Vraća se na originalnu poziciju
- **Ukupno trajanje: 0.2s**

### 6.2 Smoke Efekti
- **25-35 čestica** dima se pojavi oko kockice
- Čestice se kreću **od strane ka spolja**
- **Subtilan halo** ispod čestica
- **Ukupno trajanje: ~0.4-0.5s**

### 6.3 Kombinovani Efekat
- Bump animacija daje **"pulsing"** efekat
- Smoke efekti daju **"breathing"** efekat
- Zajedno daju prirodan, živ efekat kada tabla miruje

---

## 🔍 7. KLJUČNE FUNKCIJE - Reference

### 7.1 tile-idle-bounce.ts

| Funkcija | Opis |
|----------|------|
| `startTileIdleBounce()` | Pokreće idle animacije |
| `stopTileIdleBounce()` | Zaustavlja sve animacije |
| `resetTileIdleBounce()` | Resetuje state |
| `notifyBoardInteraction()` | Resetuje idle timer |
| `animateRandomTile()` | Bira i animira random kockicu |
| `animateTile()` | Izvršava bump animaciju |
| `stopTileAnimation()` | Prekida animaciju kockice |

### 7.2 fx.js

| Funkcija | Opis |
|----------|------|
| `smokeBubblesAtTile()` | Generiše i animira smoke efekte |

---

## 🧭 8. JOURNEY KARTICE - Specifičnosti (HTML)

- **Lokacija:** `src/modules/journey-card-idle-bounce.ts` (startuje se iz `journey-boards-manager.ts` nakon renderovanja kartica)
- **Timing:** `IDLE_WAIT_TIME = 4000ms`, `ANIMATION_INTERVAL = 150ms`, `RANDOM_INTERVAL = 0` → kada ekran miruje, kartice pulsiraju i dime **~6.6x u sekundi**
- **Animacija:** isti 2-step bump (scale 1.05 + rotacija pa povratak), ali na `.journey-board-card-wrapper`; smoke se pali na 0.1s timeline-a
- **Smoke vidljiv oko kartice:** kontejner je centriran na kartici (translate -50%/-50%), rotira se istim uglom kao kartica, padding 40% oko kartice; z-index se računa iz wrappera/parenta/container-a i postavlja na `max(...) - 1` (sedne odmah ispod kartice, da viri preko ivica odozdo)
- **Parametri dima:** `sizeScale 0.18`, `distanceScale 0.18`, `countScale 0.2`, `haloScale 0.18`, `strength 1.8-2.5`, `trailAlpha 1.0`, `baseAlpha 1.0`, randomAlpha clamped na 1.0 → dim je 80% manji po veličini/halo-u, bez drop-shadow artefakata
- **Halo:** pravougaoni (16px radius) centriran oko kartice sa proširenjem po aspectu; fade in/out kao kod tile sistema
- **Cleanup:** smoke se uklanja posle ~2s; `_idleBounceTl` se čisti na `onComplete`; `notifyJourneyInteraction()` prekida animacije i resetuje 1s loop

---

## 📝 9. ZAKLJUČAK

Idle animacija za obične kockice kombinuje:
1. **Subtilnu bump animaciju** (scale + rotation) za vizuelni interes
2. **Smoke efekte** (čestice + halo) za atmosferu
3. **Pametno timing** (4s idle wait, 3-4s između animacija) za prirodnost
4. **Robust cleanup** za memory management

Sve zajedno daje prirodan, živ efekat kada tabla miruje, bez ometanja gameplay-a.

---

**Napomena:** Ovaj dokument je napravljen za razumevanje kako sistem funkcioniše, posebno za AI agente koji treba da razume i modifikuje ovaj kod.
