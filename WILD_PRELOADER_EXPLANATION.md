# 🌟 Wild Preloader - Jednostavan Prikaz

## Što je Wild Preloader?

Wild preloader je **crta na vrhu ekrana** koja se puni dok igraš. Kada se napuni do kraja, **pojavi se wild kockica** na ploči!

---

## 📊 Kako se Puni?

Wild preloader se puni kada **spajaš kockice**:

### 1. **Mali Merge** (bilo koji merge koji daje 2, 3, 4 ili 5)
- **Što je:** Kada spajaš bilo koje dvije kockice i rezultat je **manji od 6**
- **Primjeri:**
  - 1+1=2 ✅
  - 1+2=3 ✅
  - 1+3=4 ✅
  - 1+4=5 ✅
  - 2+2=4 ✅
  - 2+3=5 ✅
  - 3+2=5 ✅
  - 4+1=5 ✅
- **Dodaje:** **13%** (0.13)
- **Znači:** **~8 mala merge-a = puna crta** ✅ (7.7 merge-a točno)
- **Napomena:** 
  - Merge 6 (npr. 3+3=6) **NIJE** mali merge - to je poseban merge koji daje više!
  - Ako spajaš **iste brojeve** (npr. 2+2), to je "stack merge" koji daje samo 10%, ne 13%!

### 2. **Stack Merge** (spajanje ISTIH brojeva)
- **Što je:** Kada spajaš **dvije kockice s istim brojem** (npr. 2+2, 3+3, 4+4)
- **Primjeri:**
  - 1+1=2 ✅ (stack merge)
  - 2+2=4 ✅ (stack merge)
  - 3+3=6 ✅ (stack merge, ali ovo je merge 6 - daje 22%!)
  - 4+4=8 ❌ (ne može, jer je više od 6)
- **Dodaje:** **10%** (0.10)
- **Znači:** **10 stack merge-a = puna crta** ✅
- **VAŽNO:** Stack merge daje **manje** od običnog malog merge-a! Bolje je spajati različite brojeve!

### 3. **Merge 6** (kada napraviš 6)
- Dodaje: **22%** (0.22)
- Znači: **5 merge-a 6 = puna crta** ✅

---

## 🎯 Maksimum

**Maksimum je 100% (1.0)**

Kada crta dosegne **100%**, wild kockica se automatski spawna na ploči!

---

## 🔄 Što se Dogodi Nakon Spawna?

1. Wild kockica se pojavi na ploči
2. Preloader se **resetira** (oduzme se 100%)
3. Ako si imao **više od 100%** (npr. 125%), ostatak ostaje!
   - Primjer: Ako si imao 125%, nakon spawna ostane 25%

---

## 📈 Primjer Punanja

**Početak:** 0%

**Merge 1:** 2+3=5 (mali merge, različiti brojevi) → **13%** (0.13)
**Merge 2:** 1+4=5 (mali merge, različiti brojevi) → **26%** (0.26)
**Merge 3:** 2+2=4 (stack merge, isti brojevi) → **36%** (0.36) - samo +10%!
**Merge 4:** 1+3=4 (mali merge, različiti brojevi) → **49%** (0.49)
**Merge 5:** 2+3=5 (mali merge, različiti brojevi) → **62%** (0.62)
**Merge 6:** 1+4=5 (mali merge, različiti brojevi) → **75%** (0.75)
**Merge 7:** 2+2=4 (stack merge, isti brojevi) → **85%** (0.85) - samo +10%!
**Merge 8:** 1+3=4 (mali merge, različiti brojevi) → **98%** (0.98)
**Merge 9:** 1+1=2 (stack merge, isti brojevi) → **100%** (1.0) → **WILD SPAWNA!** 🎉

---

## 💡 Zanimljivosti

- Preloader može biti **više od 100%** (npr. 150%)
- Ako spawnaš wild kockicu s 150%, ostane ti 50% za sljedeći spawn
- Wild kockica može biti **obična wild** (70% šansa) ili **wild-magnet** (30% šansa)

---

## 🎮 Kako Brže Napuniti?

1. **Spajaj RAZLIČITE brojeve koji daju 2-5** → +13% (brzo!)
   - Primjer: 2+3=5, 1+4=5, 2+2=4 (ako su različiti)
   - Trebaš ~8 malih merge-a za punu crtu
2. **Spajaj kockice koje daju 6** → +22% (brzo, ali malo manje!)
   - Primjer: 3+3=6, 2+4=6
3. **Spajaj ISTE brojeve** → +10% (sporije, ali lakše)
   - Primjer: 2+2=4, 1+1=2
   - ⚠️ **PAŽNJA:** Stack merge daje manje! Bolje spajati različite brojeve!

---

**Zapamti:** Wild preloader je kao **baterija** - što više spajaš, brže se puni! 🔋✨

