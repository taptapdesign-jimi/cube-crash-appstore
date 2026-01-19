# 🧪 QUICK START - TESTING GUIDE

**Branch:** v131-app-store-prep  
**Status:** ✅ Build PASS, Ready for testing  
**Trajanje:** 30-60 min

---

## 🎯 KRITIČNI TESTOVI (MUST DO)

### 1. **Wild Beer End Game** 🍺
**Scenarij:**
1. Igraj dok ne ostane samo 1-2 obične kockice + wild beer
2. Nema više locked tiles (sve otvoreno)
3. Stavi wild beer na običnu kockicu → merge 6

**Očekivano:**
- ✅ 1 nova kockica spawna **NA ISTOM MJESTU** gdje je bio merge
- ✅ **NE** spawnaju 2 random kockice na drugim pozicijama
- ✅ Ako je to bila zadnja kockica → clean board

**Provjeri:**
- [ ] Spawna samo 1 kockica
- [ ] Spawna na merge poziciji (ne random)
- [ ] Clean board radi ako je zadnja

---

### 2. **Wild Star End Game** ⭐
**Scenarij:**
1. Isti kao wild beer
2. Wild star + obična kockica → merge 6

**Očekivano:**
- ✅ Identično kao wild beer
- ✅ 1 kockica na merge mjestu
- ✅ Clean board ako je zadnja

**Provjeri:**
- [ ] Spawna samo 1 kockica
- [ ] Spawna na merge poziciji
- [ ] Clean board radi

---

### 3. **Wild Magnet End Game** 🧲
**Scenarij:**
1. Wild magnet + obična kockica → merge 6
2. Magnet prvo pulla kockice, zatim merge

**Očekivano:**
- ✅ Pull animacija radi
- ✅ Merge se dogodi
- ✅ Spawn logika kao wild beer/star

**Provjeri:**
- [ ] Pull animacija radi
- [ ] Merge se dogodi
- [ ] Spawn je ispravan

---

### 4. **Brzi Merge Test** ⚡
**Scenarij:**
1. Ostavi 5-6 kockica na boardu
2. **VRLO BRZO** (bez delaya) stavljaj kockice jedna na drugu
3. Wild beer → obična → wild star → obična (brzo!)

**Očekivano:**
- ✅ Nema extra spawna
- ✅ Nema "ghost" kockica
- ✅ Sve animacije završe ispravno

**Provjeri:**
- [ ] Nema extra spawna
- [ ] Nema ghost kockica
- [ ] Sve animacije OK

---

### 5. **Clean Board Flow** 🎉
**Scenarij:**
1. Igraj do clean board (sve kockice mergane)
2. Provjeri da se pojavi "Board Cleared" modal

**Očekivano:**
- ✅ Modal se pojavi
- ✅ Animacija radi
- ✅ Može se zatvoriti i nastaviti

**Provjeri:**
- [ ] Modal se pojavi
- [ ] Animacija radi
- [ ] Continue radi

---

## 🔍 PERFORMANCE TESTOVI (SHOULD DO)

### 6. **10 Min Gameplay** ⏱️
**Scenarij:**
1. Igraj normalno 10-15 minuta
2. Provjeri da nema laga ili freezea

**Očekivano:**
- ✅ Nema memory leaka
- ✅ Nema laga
- ✅ Sve animacije smooth

**Provjeri:**
- [ ] Nema laga
- [ ] Nema freezea
- [ ] Memory stabilan

---

### 7. **50+ Mergeova** 🔢
**Scenarij:**
1. Napravi 50+ mergeova u jednoj sesiji
2. Provjeri da sve radi

**Očekivano:**
- ✅ Nema performance degradacije
- ✅ Sve animacije rade

**Provjeri:**
- [ ] Performance OK
- [ ] Animacije OK

---

## 🎨 UI/UX TESTOVI (NICE TO HAVE)

### 8. **Collectibles Screen** 🎁
**Scenarij:**
1. Otvori collectibles screen
2. Provjeri sve animacije

**Provjeri:**
- [ ] Screen se otvara
- [ ] Animacije rade
- [ ] Može se zatvoriti

---

### 9. **Stats Screen** 📊
**Scenarij:**
1. Otvori stats screen
2. Provjeri da su podaci točni

**Provjeri:**
- [ ] Screen se otvara
- [ ] Podaci točni
- [ ] Može se zatvoriti

---

## 📋 TESTING CHECKLIST

### Prije Testiranja
- [ ] Build je PASS (npm run build)
- [ ] Dev server radi (npm run dev)
- [ ] Git backup siguran (v131 branch)

### Tijekom Testiranja
- [ ] Test 1: Wild beer end game ✅
- [ ] Test 2: Wild star end game ✅
- [ ] Test 3: Wild magnet end game ✅
- [ ] Test 4: Brzi merge test ✅
- [ ] Test 5: Clean board flow ✅
- [ ] Test 6: 10 min gameplay ✅
- [ ] Test 7: 50+ mergeova ✅
- [ ] Test 8: Collectibles screen ✅
- [ ] Test 9: Stats screen ✅

### Nakon Testiranja
- [ ] Svi testovi prošli ✅
- [ ] Nema kritičnih bugova
- [ ] Performance OK
- [ ] Ready za merge to main

---

## 🚨 AKO NEŠTO NE RADI

### Bug u Wild Merge Logici
1. Opiši točno što se dogodilo
2. Koji test je failao
3. Screenshot ili video ako moguće
4. Rollback na main branch

### Performance Problem
1. Opiši simptome (lag, freeze, crash)
2. Koliko dugo si igrao
3. Koliko mergeova si napravio
4. Memory usage (ako možeš vidjeti)

### UI/UX Problem
1. Koji screen ima problem
2. Što se dogodilo
3. Što si očekivao
4. Screenshot

---

## ✅ AKO SVE RADI

### Sljedeći Koraci:
```bash
# 1. Merge to main
git checkout main
git merge v131-app-store-prep

# 2. Tag release
git tag v0.10.1
git push origin main --tags

# 3. Production build
npm run build

# 4. Verify dist/
ls -lh dist/

# 5. Continue sa App Store submission
```

---

## 📊 EXPECTED RESULTS

### Wild Merge End Game
```
Prije (v101): 2 random kockice spawn (BUG)
Poslije (v131): 1 kockica na merge mjestu (FIXED)
```

### Performance
```
Memory: Stabilan (10+ min gameplay)
FPS: 60 FPS (smooth animacije)
Bundle: 8.5MB (excellent)
```

### Build
```
Build time: 4s
Modules: 775
Size: 8.5MB
Errors: 0
```

---

## 🎯 SUCCESS CRITERIA

### Minimum (MUST PASS)
- ✅ Wild merge spawna samo 1 kockicu
- ✅ Spawn je na merge poziciji
- ✅ Clean board radi
- ✅ Nema extra spawna

### Ideal (SHOULD PASS)
- ✅ Nema performance problema
- ✅ Nema memory leaka
- ✅ Sve animacije smooth
- ✅ UI/UX radi

---

## 📞 HELP

### Ako trebaš pomoć:
1. Provjeri `V131_FINAL_REPORT.md`
2. Provjeri `CLEANUP_SUMMARY_v131.md`
3. Provjeri Git history: `git log --oneline -10`
4. Rollback je siguran: `git checkout main`

---

**Pripremio:** AI Assistant  
**Datum:** 2026-01-19  
**Status:** ✅ READY TO TEST  
**Trajanje:** 30-60 min

🚀 **START TESTING!**

