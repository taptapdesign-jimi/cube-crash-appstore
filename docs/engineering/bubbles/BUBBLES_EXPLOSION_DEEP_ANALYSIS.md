# 🔍 Deep Analysis: Wild Juice Bubbles Explosion - Not Triggering in New Board

## Problem Statement
U novom boardu, kada se wild juice spoji s običnom kockicom i napravi merge 6, **explosion bubble animacija se ne poziva**. Također, **ghost placeholders se ponovno pojavljuju** nakon merge 6.

## Root Cause Analysis

### 1. 🔴 **CRITICAL: srcSpecial/dstSpecial Scope Issue**

**Lokacija:** `src/modules/app-core.ts`, linija 3943-3944, 4429-4430, 6033-6034

**Problem:**
```typescript
// Linija 3943-3944 (u merge funkciji, prije merge 6 bloka):
const srcSpecial = src?.special;
const dstSpecial = dst?.special;

// Linija 4429-4430 (u merge 6 bloku):
const srcSpecial = src?.special;  // ← OVO PREPISUJE PREVIOUS srcSpecial!
const dstSpecial = dst?.special; // ← OVO PREPISUJE PREVIOUS dstSpecial!

// Linija 6033-6034 (u merge 6 bloku, kasnije):
const isMainWildMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
const isMainWildOnlyMerge = (srcSpecial === 'wild' || dstSpecial === 'wild' || srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice') && !isMainWildMagnetMerge;
```

**Analiza:**
- `srcSpecial` i `dstSpecial` se postavljaju **DVA PUTA** u merge funkciji
- Prvi put na liniji 3943-3944 (prije merge 6 bloka)
- Drugi put na liniji 4429-4430 (u merge 6 bloku)
- **PROBLEM:** Ako se `src` tile uništi ili modificira između ova dva postavljanja, `src?.special` može biti `undefined` ili promijenjen
- **PROBLEM:** Ako se `dst` tile modificira (npr. `setValue(6)` ili `clearWildState()`), `dst?.special` može biti `undefined` ili promijenjen

**Impact:** 🔴 **CRITICAL** - Glavni uzrok problema

---

### 2. 🔴 **CRITICAL: Tile Destruction Before Special Check**

**Lokacija:** `src/modules/app-core.ts`, linija 4429-4430, 6033-6034

**Problem:**
```typescript
// Linija 4429-4430 (u merge 6 bloku):
const srcSpecial = src?.special;  // ← src može biti destroyed ili modified
const dstSpecial = dst?.special; // ← dst može biti modified (setValue, clearWildState)

// Kasnije u kodu (linija ~4500+):
// setValue(6) se poziva na dst
// clearWildState() se poziva na dst
// removeTile(src) se poziva

// Linija 6033-6034 (kasnije u merge 6 bloku):
const isMainWildOnlyMerge = (srcSpecial === 'wild' || dstSpecial === 'wild' || srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice') && !isMainWildMagnetMerge;
// ← srcSpecial i dstSpecial mogu biti undefined ili promijenjeni!
```

**Analiza:**
- `srcSpecial` i `dstSpecial` se postavljaju na liniji 4429-4430
- Ali između linije 4429 i linije 6033, `src` i `dst` se mogu modificirati:
  - `dst.setValue(6)` - može promijeniti `dst.special`
  - `clearWildState(dst)` - **UKLANJA** `dst.special`!
  - `removeTile(src)` - može uništiti `src`
- Kada se dođe do linije 6033, `srcSpecial` i `dstSpecial` mogu biti **undefined** ili **promijenjeni**

**Impact:** 🔴 **CRITICAL** - Sprječava ispravnu detekciju wild-juice merge

---

### 3. 🟠 **HIGH: clearWildState() Removes Special Property**

**Lokacija:** `src/modules/app-core.ts`, linija ~4500+

**Problem:**
```typescript
// clearWildState() se poziva na dst tile
// Ova funkcija UKLANJA special property:
dst.special = undefined; // ili null
```

**Analiza:**
- `clearWildState()` se poziva na `dst` tile nakon merge 6
- Ova funkcija **uklanja** `special` property
- Ako se `dstSpecial` postavi PRIJE `clearWildState()`, ali se koristi NAKON `clearWildState()`, `dstSpecial` će biti ispravan
- **ALI:** Ako se `dstSpecial` postavi NAKON `clearWildState()`, `dstSpecial` će biti `undefined`

**Impact:** 🟠 **HIGH** - Može uzrokovati da `dstSpecial` bude `undefined`

---

### 4. 🟡 **MEDIUM: isMainWildOnlyMerge Condition**

**Lokacija:** `src/modules/app-core.ts`, linija 6034

**Problem:**
```typescript
const isMainWildOnlyMerge = (srcSpecial === 'wild' || dstSpecial === 'wild' || srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice') && !isMainWildMagnetMerge;
```

**Analiza:**
- Ako je `srcSpecial` ili `dstSpecial` `undefined`, ova provjera će biti `false`
- Ako je `srcSpecial === 'wild-juice'` ali je `dstSpecial` `undefined`, provjera će biti `true` (ispravno)
- **ALI:** Ako je `srcSpecial` `undefined` i `dstSpecial === 'wild-juice'`, provjera će biti `true` (ispravno)
- **PROBLEM:** Ako su OBA `undefined`, provjera će biti `false` (pogrešno)

**Impact:** 🟡 **MEDIUM** - Može uzrokovati da se wild-juice merge ne detektira

---

### 5. 🟡 **MEDIUM: Ghost Placeholders Visibility**

**Lokacija:** `src/modules/app-core.ts`, linija 1844-1860

**Problem:**
```typescript
function updateGhostVisibility() {
  if (!window._ghostPlaceholders) return;
  
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      const cell = grid[r]?.[c];
      const shouldShow = (cell === null); // Show ONLY if no tile exists
      
      if (window._ghostPlaceholders[r] && window._ghostPlaceholders[r][c]) {
        window._ghostPlaceholders[r][c].visible = shouldShow;
      }
    }
  }
}
```

**Analiza:**
- `updateGhostVisibility()` se poziva nakon merge 6
- Ako se `grid[r][c]` ne ažurira ispravno nakon merge 6, ghost placeholders se mogu pojaviti
- **PROBLEM:** Ako se `removeTile()` ne pozove ispravno, `grid[r][c]` može ostati `null` umjesto da se ažurira

**Impact:** 🟡 **MEDIUM** - Uzrokuje pojavu ghost placeholders

---

## Flow Analysis: What Happens During Wild Juice Merge 6

### Scenario: Wild Juice + Regular Tile → Merge 6 (Current Problem)
```
1. User drags wild-juice tile onto regular tile
2. merge() function called
3. Line 3943-3944: srcSpecial = src?.special ('wild-juice'), dstSpecial = dst?.special (undefined)
4. Line 4426: effSum === 6, enter merge 6 block
5. Line 4429-4430: srcSpecial = src?.special ('wild-juice'), dstSpecial = dst?.special (undefined) ← PREPISUJE PREVIOUS!
6. Line ~4500+: dst.setValue(6) → dst.value = 6
7. Line ~4500+: clearWildState(dst) → dst.special = undefined (ako je dst bio wild)
8. Line ~4500+: removeTile(src) → src destroyed
9. Line 6033-6034: Check isMainWildOnlyMerge
   - srcSpecial = 'wild-juice' (ispravno, iz closure-a)
   - dstSpecial = undefined (možda ispravno, ali možda ne)
   - isMainWildOnlyMerge = (true || false || true || false) && !false = true ✅
10. Line 6063: isWildJuiceMerge = srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice'
   - isWildJuiceMerge = true || false = true ✅
11. Line 6093: if (isWildJuiceMerge) → TRUE ✅
12. Line 6120: showWildJuiceBubblesExplosion() → ✅ POZIVA SE
```

**Ali zašto se ne poziva?**

**MOGUĆI UZROK 1:** `srcSpecial` ili `dstSpecial` su `undefined` u liniji 4429-4430
- Ako je `src` već destroyed ili modified prije linije 4429, `src?.special` može biti `undefined`
- Ako je `dst` već modified (npr. `setValue` ili `clearWildState`), `dst?.special` može biti `undefined`

**MOGUĆI UZROK 2:** `isMainWildOnlyMerge` je `false` zbog scope problema
- Ako se `srcSpecial` i `dstSpecial` ne koriste iz ispravnog scope-a, provjera može biti pogrešna

**MOGUĆI UZROK 3:** `wasWild` je `false`
- Ako je `wildActive` `false`, merge 6 blok se neće izvršiti (linija 6036: `if (wasWild)`)

---

## 🔍 Debugging Strategy

### Step 1: Add Logging
Dodati logging na kritične točke:
```typescript
// Linija 3943-3944:
const srcSpecial = src?.special;
const dstSpecial = dst?.special;
console.log('🔍 MERGE: srcSpecial/dstSpecial (first):', { srcSpecial, dstSpecial, srcValue: src?.value, dstValue: dst?.value });

// Linija 4429-4430:
const srcSpecial = src?.special;
const dstSpecial = dst?.special;
console.log('🔍 MERGE 6: srcSpecial/dstSpecial (second):', { srcSpecial, dstSpecial, srcValue: src?.value, dstValue: dst?.value, srcDestroyed: src?.destroyed });

// Linija 6033-6034:
const isMainWildMagnetMerge = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
const isMainWildOnlyMerge = (srcSpecial === 'wild' || dstSpecial === 'wild' || srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice') && !isMainWildMagnetMerge;
console.log('🔍 MERGE 6: isMainWildOnlyMerge check:', { srcSpecial, dstSpecial, isMainWildMagnetMerge, isMainWildOnlyMerge, wasWild });

// Linija 6063:
const isWildJuiceMerge = srcSpecial === 'wild-juice' || dstSpecial === 'wild-juice';
console.log('🔍 MERGE 6: isWildJuiceMerge check:', { srcSpecial, dstSpecial, isWildJuiceMerge });

// Linija 6093:
if (isWildJuiceMerge) {
  console.log('✅ MERGE 6: Wild-juice merge detected, calling showWildJuiceBubblesExplosion()');
  // ...
}
```

### Step 2: Check wasWild
Provjeriti da li je `wasWild` `true`:
```typescript
// Linija 6031:
const wasWild = wildActive;
console.log('🔍 MERGE 6: wasWild check:', { wasWild, wildActive, srcSpecial, dstSpecial });
```

### Step 3: Check Stage
Provjeriti da li je stage validan:
```typescript
// U showWildJuiceBubblesExplosion():
console.log('🔍 BUBBLES: Stage check:', { 
  hasWindowState: !!windowState, 
  hasApp: !!app, 
  hasStage: !!stage, 
  stageDestroyed: stage?.destroyed,
  stageVisible: stage?.visible,
  stageAlpha: stage?.alpha,
  stageRenderable: stage?.renderable
});
```

---

## 💡 Solution Strategy

### 🎯 **PRIMARY SOLUTION: Save Special Properties Early**

**Idea:** Snimiti `srcSpecial` i `dstSpecial` **ODMAH** na početku merge funkcije i **NE PREPISIVATI** ih.

**Implementation:**
1. **Save early** - Snimiti `srcSpecial` i `dstSpecial` na liniji 3943-3944
2. **Don't overwrite** - **NE** prepisivati ih na liniji 4429-4430
3. **Use saved values** - Koristiti snimljene vrijednosti kroz cijeli merge 6 blok

### 🛡️ **SECONDARY SOLUTION: Validate Before Use**

**Idea:** Provjeriti da li su `srcSpecial` i `dstSpecial` validni prije korištenja.

**Implementation:**
1. **Validate** - Provjeriti da li su `srcSpecial` i `dstSpecial` definirani
2. **Fallback** - Koristiti fallback vrijednosti ako nisu definirani
3. **Logging** - Dodati logging za debugging

### 🔄 **TERTIARY SOLUTION: Fix Ghost Placeholders**

**Idea:** Osigurati da se `updateGhostVisibility()` poziva ispravno nakon merge 6.

**Implementation:**
1. **Call after merge** - Pozvati `updateGhostVisibility()` nakon merge 6
2. **Fix grid state** - Osigurati da se `grid[r][c]` ažurira ispravno
3. **Test visibility** - Testirati da li se ghost placeholders prikazuju ispravno

---

## 📋 Implementation Plan

### Phase 1: Fix Special Properties Scope (Priority: 🔴 CRITICAL)
1. ✅ Remove duplicate `srcSpecial`/`dstSpecial` assignment on line 4429-4430
2. ✅ Use saved values from line 3943-3944 throughout merge 6 block
3. ✅ Add validation to ensure values are not undefined

### Phase 2: Add Debugging (Priority: 🟠 HIGH)
1. ✅ Add comprehensive logging at critical points
2. ✅ Log `wasWild`, `isMainWildOnlyMerge`, `isWildJuiceMerge` values
3. ✅ Log stage validation in `showWildJuiceBubblesExplosion()`

### Phase 3: Fix Ghost Placeholders (Priority: 🟡 MEDIUM)
1. ✅ Ensure `updateGhostVisibility()` is called after merge 6
2. ✅ Fix grid state updates after tile removal
3. ✅ Test ghost placeholder visibility

---

## 🧪 Testing Scenarios

### Test 1: Wild Juice + Regular Tile → Merge 6
- Drag wild-juice onto regular tile
- **Expected:** `srcSpecial = 'wild-juice'`, `dstSpecial = undefined`, `isWildJuiceMerge = true`, bubbles animation starts

### Test 2: Regular Tile + Wild Juice → Merge 6
- Drag regular tile onto wild-juice
- **Expected:** `srcSpecial = undefined`, `dstSpecial = 'wild-juice'`, `isWildJuiceMerge = true`, bubbles animation starts

### Test 3: Check Console Logs
- Open browser console
- **Expected:** See detailed logging of `srcSpecial`, `dstSpecial`, `isWildJuiceMerge`, `wasWild` values

---

## 🎯 Recommended Solution

**Best Approach:** Phase 1 (Fix Special Properties Scope)

1. **Remove duplicate assignment** - Ukloniti liniju 4429-4430 koja prepisuje `srcSpecial`/`dstSpecial`
2. **Use saved values** - Koristiti snimljene vrijednosti iz linije 3943-3944
3. **Add validation** - Dodati provjeru da li su vrijednosti definirani

**Why:**
- ✅ Rješava glavni problem (scope issue)
- ✅ Minimalne promjene u kodu
- ✅ Ne utječe na druge dijelove sistema
- ✅ Lako testirati i debugirati

---

## 📝 Code Changes Required

### 1. `src/modules/app-core.ts` (linija 4429-4430)
```typescript
// BEFORE:
if (effSum === 6){
  // 🔥 CRITICAL: Snimiti src.special i dst.special PRIJE setValue i clearWildState!
  // setValue i clearWildState mogu promijeniti special property
  const srcSpecial = src?.special;
  const dstSpecial = dst?.special;

// AFTER:
if (effSum === 6){
  // 🔥 CRITICAL FIX: Use saved srcSpecial/dstSpecial from line 3943-3944 (don't overwrite!)
  // These values were saved BEFORE any modifications to src/dst
  // If they're not available, fallback to current values (but log warning)
  const srcSpecialForMerge6 = srcSpecial !== undefined ? srcSpecial : (src?.special);
  const dstSpecialForMerge6 = dstSpecial !== undefined ? dstSpecial : (dst?.special);
  
  if (srcSpecialForMerge6 !== srcSpecial || dstSpecialForMerge6 !== dstSpecial) {
    console.warn('⚠️ MERGE 6: Using fallback srcSpecial/dstSpecial values:', {
      saved: { srcSpecial, dstSpecial },
      fallback: { srcSpecialForMerge6, dstSpecialForMerge6 }
    });
  }
  
  // Use saved/fallback values throughout merge 6 block
  const srcSpecial = srcSpecialForMerge6;
  const dstSpecial = dstSpecialForMerge6;
```

**ALI:** Bolje rješenje je **NE PREPISIVATI** `srcSpecial`/`dstSpecial` uopće, već koristiti snimljene vrijednosti iz closure-a.

---

**Created:** 2026-01-27  
**Status:** 🔴 **READY FOR IMPLEMENTATION**
