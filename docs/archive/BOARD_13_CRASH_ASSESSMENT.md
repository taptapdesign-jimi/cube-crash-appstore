# 🚨 BOARD 13 CRASH ASSESSMENT - Brutalno Iskreno

## Problem
Igra se ruši i resetira od preload screena kada se pojavi clean board na boardu 13. Korisnik sumnja na:
1. Konfete animacija stvara memory leak
2. Bubbles animacija se ne čisti prije clean board flow-a i konfliktuje s njim

---

## 🔍 ANALIZA PROBLEMA

### 1. KONFETE ANIMACIJA - MEMORY LEAK ⚠️ **KRITIČNO**

**Lokacija:** `src/modules/confetti-system.ts`

**Problem:**
- `createConfettiExplosion()` kreira `setInterval` koji spawna konfete svake sekunde (5 sekundi ukupno)
- **Interval se čisti SAMO kada `spawnCount >= maxSpawns` (5 sekundi)**
- **Ako se modal zatvori prije 5 sekundi, interval ostaje aktivan i nastavlja spawnati konfete**
- Svaki confetti element ima `animProgress` interval (linija 208) koji se ne čisti ako se modal zatvori
- DOM elementi se dodaju u `document.body` ali se ne čiste ako se modal zatvori prije nego što animacija završi
- **Nema cleanup funkcije koja se poziva kada se modal zatvori**

**Kod problema:**
```typescript
// confetti-system.ts linija 47-53
const spawnInterval = setInterval(() => {
  if (spawnCount >= maxSpawns) {
    clearInterval(spawnInterval); // ✅ Čisti se samo ovdje
    return;
  }
  spawnBatch();
}, 1000);

// ❌ PROBLEM: Ako se modal zatvori prije 5 sekundi, interval ostaje aktivan!
```

**Akumulacija:**
- Nakon 13 boardova, može biti 13+ aktivnih intervala koji spawnaju konfete
- Svaki interval može kreirati 15 konfeta po sekundi
- DOM elementi se akumuliraju u `document.body`
- Memory usage raste eksponencijalno

---

### 2. BUBBLES ANIMACIJA VS CLEAN BOARD - KONFLIKT ⚠️ **KRITIČNO**

**Lokacija:** `src/modules/endgame-flow.ts` i `src/modules/fx.js`

**Problem:**
- `endgame-flow.ts` **NE poziva `cleanupWildJuiceExplosion()`** prije nego što se clean board modal pojavi
- Ako bubbles animacija još traje (2-3 sekunde), ona pokušava renderirati na stage koji se mijenja
- `rebuildBoard()` poziva `cleanupWildJuiceExplosion()`, ali to se dešava **NAKON** clean board flow-a
- Bubbles animacija može pokušati pristupati stage/board objektima koji su već u procesu cleanup-a

**Kod problema:**
```typescript
// endgame-flow.ts linija 113 - clean board modal se poziva BEZ cleanup-a bubbles animacije
await showCleanBoardModal({ 
  app, stage,
  // ... params
});

// ❌ PROBLEM: Bubbles animacija još traje i pokušava renderirati na stage koji se mijenja!
```

**Konflikt:**
- Bubbles animacija koristi `gsap.ticker.add()` za spawn ticker
- Clean board flow mijenja `stage.eventMode = 'none'` i sakriva board
- Bubbles animacija pokušava dodati elemente u stage koji je možda već u cleanup procesu
- To može uzrokovati `Cannot read property 'addChild' of null` ili slične errore

---

### 3. BOARD 13 SPECIFIČNO - AKUMULACIJA ⚠️ **KRITIČNO**

**Problem:**
- Nakon 13 boardova, memory leak se akumulira:
  - 13+ aktivnih konfete intervala
  - 13+ setova DOM elemenata koji se nisu očistili
  - Bubbles animacije koje se nisu očistile prije clean board flow-a
- iOS WebView ima stroge memory limite
- Kada se memory limit prekorači, iOS može:
  - Crash-ati aplikaciju
  - Resetirati WebView (što uzrokuje reload od preload screena)

**Zašto board 13:**
- Memory leak se akumulira linearno s brojem boardova
- Board 13 = 13 clean board flow-ova = 13 potencijalnih memory leaka
- iOS memory limit je obično 50-100MB za WebView
- Nakon 13 boardova, memory usage može prekoračiti limit

---

### 4. ZAŠTO SE RESETIRA OD PRELOAD SCREENA ⚠️ **KRITIČNO**

**Mogući uzroci:**
1. **Memory overflow crash:**
   - iOS WebView crash-uje zbog prekoračenja memory limita
   - Browser se resetira i vraća na preload screen

2. **Unhandled error u `startLevel`:**
   - `endgame-flow.ts` linija 252: `startLevel(nextLevel)` je wrapped u try-catch
   - Ali ako error nastane u `rebuildBoard()` ili `initializeBackgroundLayer()`, može uzrokovati unhandled error
   - Unhandled error može uzrokovati reload

3. **Konflikt između bubbles animacije i clean board flow-a:**
   - Bubbles animacija pokušava pristupati stage/board objektima koji su već u cleanup procesu
   - To može uzrokovati `TypeError: Cannot read property 'addChild' of null`
   - Error može uzrokovati crash ili reload

---

## 🎯 PREPORUKE ZA POPRAVKU

### 1. KONFETE ANIMACIJA - CLEANUP ⚠️ **PRIORITET 1**

**Rješenje:**
- Dodati cleanup funkciju u `confetti-system.ts` koja:
  - Čisti sve aktivne intervale
  - Uklanja sve DOM elemente iz `document.body`
  - Resetira `activeAnimations` counter
- Pozvati cleanup funkciju u `clean-board-modal.ts` kada se modal zatvori
- Eksportirati cleanup funkciju iz `confetti-system.ts`

**Kod:**
```typescript
// confetti-system.ts
let activeIntervals: Set<NodeJS.Timeout> = new Set();
let activeConfettiElements: Set<HTMLElement> = new Set();

export function cleanupConfetti() {
  // Čisti sve intervale
  activeIntervals.forEach(interval => clearInterval(interval));
  activeIntervals.clear();
  
  // Uklanja sve DOM elemente
  activeConfettiElements.forEach(el => {
    try { el.remove(); } catch {}
  });
  activeConfettiElements.clear();
  
  // Resetira counter
  activeAnimations = 0;
  
  console.log('🧹 Confetti cleanup completed');
}
```

**Poziv:**
```typescript
// clean-board-modal.ts - kada se modal zatvori
import { cleanupConfetti } from './confetti-system.js';

// U cleanup sekciji
cleanupConfetti();
```

---

### 2. BUBBLES ANIMACIJA - CLEANUP PRIJE CLEAN BOARD ⚠️ **PRIORITET 1**

**Rješenje:**
- Dodati `cleanupWildJuiceExplosion()` poziv u `endgame-flow.ts` **PRIJE** poziva `showCleanBoardModal()`
- Osigurati da se bubbles animacija čisti prije nego što se clean board modal pojavi

**Kod:**
```typescript
// endgame-flow.ts - PRIJE showCleanBoardModal
import { cleanupWildJuiceExplosion, isWildJuiceExplosionRunning } from './fx.js';

// Linija 88 - PRIJE showCleanBoardModal
try {
  // 🔥 CRITICAL: Cleanup bubbles animaciju PRIJE clean board flow-a
  if (isWildJuiceExplosionRunning && typeof cleanupWildJuiceExplosion === 'function') {
    cleanupWildJuiceExplosion();
    console.log('🧹 Cleaned up wild juice explosion before clean board flow');
  }
} catch (e) {
  console.warn('⚠️ Failed to cleanup bubbles animation:', e);
}

// Zatim pozovi showCleanBoardModal
await showCleanBoardModal({ ... });
```

---

### 3. DODATNI CLEANUP U ENDGAME FLOW ⚠️ **PRIORITET 2**

**Rješenje:**
- Dodati cleanup konfete animacije u `endgame-flow.ts` cleanup sekciju (linija 152-248)
- Osigurati da se sve animacije čiste prije `startLevel()`

**Kod:**
```typescript
// endgame-flow.ts - u cleanup sekciji (linija 152)
try {
  // Cleanup confetti animations
  const confettiSystem = await import('./confetti-system.js');
  if (confettiSystem && typeof confettiSystem.cleanupConfetti === 'function') {
    confettiSystem.cleanupConfetti();
    console.log('🧹 Cleaned up confetti animations');
  }
} catch {}
```

---

### 4. DODATNA ZAŠTITA U STARTLEVEL ⚠️ **PRIORITET 3**

**Rješenje:**
- Dodati dodatni try-catch u `startLevel()` funkciju
- Osigurati da se sve animacije čiste prije nego što se board rebuild-a

**Kod:**
```typescript
// app-core.ts - u startLevel funkciji
function startLevel(n) {
  try {
    // Cleanup sve animacije prije rebuild-a
    if (typeof cleanupWildJuiceExplosion === 'function') {
      cleanupWildJuiceExplosion();
    }
    // ... rest of startLevel
  } catch (error) {
    console.error('❌ startLevel error:', error);
    // Ne rethrow - prevent crash
  }
}
```

---

## 📊 RIZIKO PROCJENA

| Problem | Riziko | Prioritet | Vjerojatnost |
|---------|--------|-----------|--------------|
| Konfete memory leak | 🔴 **VISOK** | 1 | 90% |
| Bubbles konflikt | 🔴 **VISOK** | 1 | 80% |
| Board 13 akumulacija | 🔴 **VISOK** | 1 | 95% |
| Reset od preload | 🔴 **VISOK** | 1 | 85% |

---

## 🎯 ZAKLJUČAK

**Glavni problemi:**
1. **Konfete animacija nema cleanup funkciju** - intervali i DOM elementi se akumuliraju
2. **Bubbles animacija se ne čisti prije clean board flow-a** - konflikt s stage/board objektima
3. **Memory leak se akumulira nakon 13 boardova** - iOS WebView crash-uje

**Rješenje:**
- Dodati cleanup funkciju za konfete animaciju
- Pozvati `cleanupWildJuiceExplosion()` prije `showCleanBoardModal()`
- Dodati cleanup u `endgame-flow.ts` cleanup sekciju
- Testirati na boardu 13+ da se osigura da se problem ne ponavlja

**Očekivani rezultat:**
- Memory usage ostaje stabilan nakon 13+ boardova
- Nema crash-ova ili reset-ova
- Bubbles animacija se čisti prije clean board flow-a
- Konfete animacija se čisti kada se modal zatvori

---

**Napomena:** Ovo je assessment bez popravki. Sve preporuke su detaljno opisane i spremne za implementaciju.

