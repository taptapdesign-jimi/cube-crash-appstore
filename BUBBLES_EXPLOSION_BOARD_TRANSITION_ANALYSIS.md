# 🔍 Deep Analysis: Wild Beer Bubbles Explosion - Board Transition Problem

## Problem Statement
Bubble animation se ne pokreće kada se wild beer spoji s kockicom i rezultira merge 6, posebno kada se prelazi iz jednog boarda u drugi (continue na clean board flowu).

## Root Cause Analysis

### 1. ⏱️ **TIMING RACE CONDITION: setTimeout Delay**

**Lokacija:** `src/modules/app-core.ts`, linija 6109

**Problem:**
```typescript
setTimeout(() => {
  try {
    if (isWildBeerBubblesExplosionActive()) {
      stopWildBeerBubblesExplosion();
    }
    showWildBeerBubblesExplosion();
  } catch (error) {
    console.error('❌ Failed to trigger bubbles explosion:', error);
  }
}, 200);
```

**Analiza:**
- `setTimeout` delay od 200ms omogućava da se clean board flow pokrene PRIJE nego što se animacija pokrene
- Ako se `triggerCleanBoardFlow()` pozove unutar 200ms nakon merge 6, animacija se neće pokrenuti jer:
  - `cleanupAllEffects()` se poziva u `clean-board-modal.ts` (linija 1389)
  - `rebuildBoard()` se poziva i poziva `stopWildBeerBubblesExplosion()` (linija 2134)
  - Stage se može uništiti u `boot()` funkciji (linija 738-752)

**Impact:** 🔴 **CRITICAL** - Glavni uzrok problema

---

### 2. 🧹 **CLEANUP PRIJE POKRETANJA: cleanupAllEffects()**

**Lokacija:** `src/modules/clean-board-modal.ts`, linija 1388-1395

**Problem:**
```typescript
try {
  const fxModule = await import('./fx.js');
  if (fxModule && typeof fxModule.cleanupAllEffects === 'function') {
    fxModule.cleanupAllEffects(); // ← Ovo poziva cleanupWildBeerExplosion()
    console.log('🧹 clean-board-modal: Cleaned up all effects...');
  }
} catch (e) {
  console.warn('⚠️ clean-board-modal: Failed to cleanup all effects...', e);
}
```

**Analiza:**
- `cleanupAllEffects()` poziva `cleanupWildBeerExplosion()` koji poziva `stopWildBeerBubblesExplosion()`
- Ako se ovo pozove prije nego što se `setTimeout` izvrši, animacija će biti zaustavljena prije nego što se pokrene
- Clean board modal se može prikazati vrlo brzo nakon merge 6 (posebno ako je to zadnji merge)

**Impact:** 🔴 **CRITICAL** - Direktno sprječava pokretanje animacije

---

### 3. 🔄 **BOARD REBUILD CLEANUP: rebuildBoard()**

**Lokacija:** `src/modules/app-core.ts`, linija 2130-2143

**Problem:**
```typescript
try {
  if (typeof stopWildBeerBubblesExplosion === 'function') {
    if (isWildBeerBubblesExplosionActive()) {
      stopWildBeerBubblesExplosion();
      console.log('🧹 rebuildBoard: Cleaned up active wild beer explosion...');
    } else {
      // 🔥 CRITICAL: Force cleanup even if flag says inactive
      stopWildBeerBubblesExplosion();
      console.log('🧹 rebuildBoard: Force cleaned up wild beer explosion...');
    }
  }
} catch (e) {
  console.warn('⚠️ rebuildBoard: Error cleaning up wild beer explosion:', e);
}
```

**Analiza:**
- `rebuildBoard()` se poziva kada se board rebuilda (npr. prije novog boarda)
- Ako se ovo pozove prije nego što se `setTimeout` izvrši, animacija će biti zaustavljena
- `rebuildBoard()` se poziva u `startLevel()` funkciji koja se poziva nakon clean board flowa

**Impact:** 🟠 **HIGH** - Sprječava animaciju ako se board rebuilda brzo

---

### 4. 🎬 **STAGE DESTRUCTION: boot() Function**

**Lokacija:** `src/modules/app-core.ts`, linija 656-752

**Problem:**
```typescript
// Step 5: Clear stage children BEFORE destroy
if (app && app.stage) {
  try {
    app.stage.removeChildren();
    console.log('✅ Stage children removed');
  } catch (e) {
    console.warn('⚠️ Error removing stage children:', e);
  }
}

// Step 6: Clear references BEFORE destroy
stage = null as any;
board = null as any;
hud = null as any;

// 🔥 CRITICAL FIX: DESTROY existing app if it exists
if (app && app.canvas) {
  console.log('🧹 Destroying existing PIXI app');
  app.destroy(true, { children: true, texture: false, textureSource: false });
  app = null as any;
}
```

**Analiza:**
- `boot()` se poziva kada se kreira novi board
- Ako se `boot()` pozove prije nego što se `setTimeout` izvrši, stage će biti uništen
- `showWildBeerBubblesExplosion()` provjerava `stage.destroyed` i neće pokrenuti animaciju ako je stage uništen

**Impact:** 🟠 **HIGH** - Sprječava animaciju ako se stage uništi prije pokretanja

---

### 5. 🎭 **BOARD TRANSITION SCREEN: Stage Visibility**

**Lokacija:** `src/modules/endgame-flow.ts`, linija 648-695

**Problem:**
```typescript
// 🔥 CRITICAL FIX: Hide app first to cleanup previous board before starting new one
try {
  const uiManagerModule = await import('./ui-manager.js');
  const uiMgr = uiManagerModule.default;
  if (uiMgr && typeof uiMgr.hideApp === 'function') {
    uiMgr.hideApp(); // ← Ovo može sakriti stage
    console.log('✅ endgame-flow: Hidden app before starting new board');
  }
} catch (hideError) {
  console.warn('⚠️ endgame-flow: Failed to hide app (non-fatal):', hideError);
}
```

**Analiza:**
- Board transition screen se prikazuje prije nego što se pokrene novi board
- `hideApp()` može sakriti stage ili učiniti ga nevidljivim
- `showWildBeerBubblesExplosion()` provjerava `stage.visible`, `stage.alpha`, `stage.renderable`
- Ako je stage sakriven, animacija se neće pokrenuti

**Impact:** 🟡 **MEDIUM** - Može sprječavati animaciju ako je stage sakriven

---

### 6. 🧪 **MODULE STATE VALIDATION: showWildBeerBubblesExplosion()**

**Lokacija:** `src/modules/wild-beer-bubbles-explosion.ts`, linija 63-76

**Problem:**
```typescript
export function showWildBeerBubblesExplosion(): void {
  if (isExplosionActive) {
    console.log('💧 Wild-beer bubbles explosion already active, skipping');
    return;
  }

  const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
  const app = (windowState && windowState.app) || null;
  const stage = (windowState && windowState.stage) || (app && app.stage) || null;

  if (!stage || stage.destroyed) {
    console.warn('⚠️ Cannot start wild-beer bubbles explosion - no stage');
    return;
  }
  // ...
}
```

**Analiza:**
- Modul provjerava `stage.destroyed` prije pokretanja
- Ako je stage uništen, animacija se neće pokrenuti
- Modul također provjerava `stage.visible`, `stage.alpha`, `stage.renderable` u `spawnTicker()` funkciji

**Impact:** 🟡 **MEDIUM** - Validacija je ispravna, ali problem je što se stage uništi prije nego što se animacija pokrene

---

## 🔍 Flow Analysis: What Happens During Board Transition

### Scenario 1: Merge 6 → Clean Board Flow (Ideal)
```
1. User merges wild-beer + regular tile → merge 6
2. setTimeout(() => showWildBeerBubblesExplosion(), 200) scheduled
3. triggerCleanBoardFlow() called
4. runEndgameFlow() called
5. showCleanBoardModal() called
6. User clicks "Continue"
7. cleanupAllEffects() called → stopWildBeerBubblesExplosion() → ❌ Animacija zaustavljena
8. setTimeout fires → showWildBeerBubblesExplosion() → ❌ Ne može pokrenuti (stage destroyed/cleaned)
```

### Scenario 2: Merge 6 → Board Transition (Current Problem)
```
1. User merges wild-beer + regular tile → merge 6
2. setTimeout(() => showWildBeerBubblesExplosion(), 200) scheduled
3. triggerCleanBoardFlow() called
4. runEndgameFlow() called
5. showBoardTransitionScreen() called
6. setTimeout fires → showWildBeerBubblesExplosion() → ✅ Može pokrenuti (stage još postoji)
7. onComplete() → hideApp() → ❌ Stage sakriven → Animacija se ne vidi
8. startLevel() → boot() → ❌ Stage destroyed → Animacija se zaustavlja
```

### Scenario 3: Merge 6 → Fast Clean Board (Worst Case)
```
1. User merges wild-beer + regular tile → merge 6
2. setTimeout(() => showWildBeerBubblesExplosion(), 200) scheduled
3. triggerCleanBoardFlow() called IMMEDIATELY (< 200ms)
4. cleanupAllEffects() called → stopWildBeerBubblesExplosion() → ❌ Animacija zaustavljena
5. rebuildBoard() called → stopWildBeerBubblesExplosion() → ❌ Animacija zaustavljena
6. setTimeout fires → showWildBeerBubblesExplosion() → ❌ Ne može pokrenuti (already stopped)
```

---

## 💡 Solution Strategy

### 🎯 **PRIMARY SOLUTION: Immediate Execution + Stage Protection**

**Idea:** Pokrenuti animaciju **ODMAH** (bez setTimeout delay) i zaštititi je od cleanup-a tijekom board transitiona.

**Implementation:**
1. **Remove setTimeout delay** - Pokrenuti animaciju odmah nakon merge 6 detekcije
2. **Protect from cleanup** - Dodati flag koji sprječava cleanup tijekom board transitiona
3. **Stage validation** - Provjeriti da li je stage validan prije pokretanja, ali ne blokirati ako je u transitionu

### 🛡️ **SECONDARY SOLUTION: Deferred Cleanup**

**Idea:** Odgoditi cleanup animacije dok se board transition ne završi.

**Implementation:**
1. **Delay cleanup** - Ne pozivati `stopWildBeerBubblesExplosion()` u `cleanupAllEffects()` ako je animacija aktivna
2. **Wait for completion** - Čekati da se animacija završi prije nego što se pozove cleanup
3. **Graceful shutdown** - Omogućiti animaciji da se završi prirodno prije nego što se stage uništi

### 🔄 **TERTIARY SOLUTION: Board Transition Integration**

**Idea:** Integrirati bubble explosion u board transition screen (kao što je board-transition-screen modul).

**Implementation:**
1. **Transition-aware** - Provjeriti da li je board transition aktivan prije pokretanja animacije
2. **Persist across transition** - Omogućiti animaciji da traje kroz board transition
3. **Cleanup after transition** - Zaustaviti animaciju tek nakon što se board transition završi

---

## 📋 Implementation Plan

### Phase 1: Immediate Execution (Priority: 🔴 CRITICAL)
1. ✅ Remove `setTimeout` delay u `app-core.ts` linija 6109
2. ✅ Call `showWildBeerBubblesExplosion()` immediately after merge 6 detection
3. ✅ Add validation to ensure stage is valid before calling

### Phase 2: Cleanup Protection (Priority: 🔴 CRITICAL)
1. ✅ Add `_isBoardTransitionActive` flag to prevent cleanup during transition
2. ✅ Modify `cleanupAllEffects()` to skip bubble explosion cleanup if transition is active
3. ✅ Modify `rebuildBoard()` to skip bubble explosion cleanup if transition is active

### Phase 3: Stage Protection (Priority: 🟠 HIGH)
1. ✅ Add stage validation in `showWildBeerBubblesExplosion()` to handle transition state
2. ✅ Ensure stage is visible/rendering before starting animation
3. ✅ Add retry logic if stage is temporarily unavailable

### Phase 4: Board Transition Integration (Priority: 🟡 MEDIUM)
1. ✅ Check if board transition is active before starting animation
2. ✅ Allow animation to persist across transition if already started
3. ✅ Cleanup animation after transition completes

---

## 🧪 Testing Scenarios

### Test 1: Fast Clean Board
- Merge 6 wild-beer → Clean board flow starts immediately
- **Expected:** Bubble animation starts immediately and completes before cleanup

### Test 2: Board Transition
- Merge 6 wild-beer → Board transition screen shows
- **Expected:** Bubble animation starts and persists through transition

### Test 3: Multiple Boards
- Merge 6 wild-beer → Continue → New board → Merge 6 wild-beer again
- **Expected:** Both animations work independently

### Test 4: Stage Destruction
- Merge 6 wild-beer → Stage destroyed during transition
- **Expected:** Animation handles gracefully, no errors

---

## 🎯 Recommended Solution

**Best Approach:** Combine Phase 1 + Phase 2

1. **Remove setTimeout delay** - Pokrenuti animaciju odmah
2. **Add cleanup protection** - Sprječavati cleanup tijekom board transitiona
3. **Stage validation** - Provjeriti da li je stage validan, ali ne blokirati ako je u transitionu

**Why:**
- ✅ Rješava glavni problem (timing race condition)
- ✅ Minimalne promjene u kodu
- ✅ Ne utječe na druge dijelove sistema
- ✅ Lako testirati i debugirati

---

## 📝 Code Changes Required

### 1. `src/modules/app-core.ts` (linija 6109)
```typescript
// BEFORE:
setTimeout(() => {
  try {
    if (isWildBeerBubblesExplosionActive()) {
      stopWildBeerBubblesExplosion();
    }
    showWildBeerBubblesExplosion();
  } catch (error) {
    console.error('❌ Failed to trigger bubbles explosion:', error);
  }
}, 200);

// AFTER:
// 🔥 CRITICAL FIX: Execute immediately (no delay) to prevent race condition with board transition
try {
  if (isWildBeerBubblesExplosionActive()) {
    stopWildBeerBubblesExplosion();
  }
  showWildBeerBubblesExplosion();
} catch (error) {
  console.error('❌ Failed to trigger bubbles explosion:', error);
}
```

### 2. `src/modules/wild-beer-bubbles-explosion.ts` (linija 63)
```typescript
// Add board transition check
const isBoardTransitionActive = (window as any).__ccBoardTransitionActive === true;

// If board transition is active, allow animation to start even if stage is temporarily unavailable
if (!stage || stage.destroyed) {
  if (isBoardTransitionActive) {
    // Retry after short delay if in transition
    setTimeout(() => {
      showWildBeerBubblesExplosion();
    }, 100);
    return;
  }
  console.warn('⚠️ Cannot start wild-beer bubbles explosion - no stage');
  return;
}
```

### 3. `src/modules/fx.ts` (linija 3416)
```typescript
// Modify cleanupAllEffects to skip bubble explosion if board transition is active
export function cleanupAllEffects() {
  console.log('🧹 cleanupAllEffects: Cleaning up all active effects');
  
  // 🔥 CRITICAL FIX: Skip bubble explosion cleanup during board transition
  const isBoardTransitionActive = (window as any).__ccBoardTransitionActive === true;
  if (!isBoardTransitionActive) {
    cleanupWildBeerExplosion();
  } else {
    console.log('⏸️ Skipping bubble explosion cleanup - board transition active');
  }
  
  // ... rest of cleanup
}
```

### 4. `src/modules/endgame-flow.ts` (linija 648)
```typescript
// Set flag before board transition
(window as any).__ccBoardTransitionActive = true;

await showBoardTransitionScreen({
  boardNumber: nextLevel,
  onComplete: async () => {
    // Clear flag after transition
    (window as any).__ccBoardTransitionActive = false;
    
    // Now safe to cleanup
    // ... rest of onComplete
  }
});
```

---

## ✅ Success Criteria

1. ✅ Bubble animation se pokreće **odmah** nakon merge 6 wild-beer
2. ✅ Animacija **ne zaustavlja** tijekom board transitiona
3. ✅ Animacija se **završava** prirodno prije nego što se stage uništi
4. ✅ **Nema errora** u konzoli
5. ✅ Animacija radi **konzistentno** kroz sve boardove

---

## 🔗 Related Files

- `src/modules/app-core.ts` - Merge 6 detection and animation trigger
- `src/modules/wild-beer-bubbles-explosion.ts` - Animation module
- `src/modules/fx.ts` - Cleanup functions
- `src/modules/clean-board-modal.ts` - Clean board flow
- `src/modules/endgame-flow.ts` - Endgame flow and board transition
- `src/modules/board-transition-screen.ts` - Board transition screen

---

## 📅 Next Steps

1. ✅ Review and approve solution strategy
2. ✅ Implement Phase 1 (Immediate Execution)
3. ✅ Implement Phase 2 (Cleanup Protection)
4. ✅ Test all scenarios
5. ✅ Deploy and monitor

---

**Created:** 2026-01-27  
**Status:** 🔴 **READY FOR IMPLEMENTATION**
