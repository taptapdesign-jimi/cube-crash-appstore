# 🎯 Wild Meter Fill Rate Comparison: v60 vs v75

## 📊 Trenutno Stanje (v75)

### Osnovne Vrijednosti
- `WILD_INC_SMALL = 0.10` (za normalne mergeove)
- `WILD_INC_BIG = 0.22` (za merge 6)

### Board-Specific Fill Rates
- **Board 1 (default)**: `fillRate = 1.0`
- **Board 2**: `fillRate = 0.5` (50% brzine)

### Global Slowdown
- `globalSlowdown = 0.6` (60% originalne brzine = **40% sporije**)

### Stvarni Fill Rates po Boardu

#### Board 1 (default)
- **Merge 6**: `0.22 * 1.0 * 0.6 = 0.132` (13.2% per merge 6)
- **Normal merge**: `0.10 * 1.0 * 0.6 = 0.06` (6% per normal merge)
- **Za puni meter (100%)**: Potrebno ~7.6 merge 6 ili ~16.7 normalnih mergeova

#### Board 2
- **Merge 6**: `0.22 * 0.5 * 0.6 = 0.066` (6.6% per merge 6)
- **Normal merge**: `0.10 * 0.5 * 0.6 = 0.03` (3% per normal merge)
- **Za puni meter (100%)**: Potrebno ~15.2 merge 6 ili ~33.3 normalnih mergeova

---

## 📊 v60 (Pre Global Slowdown)

### Osnovne Vrijednosti
- `WILD_INC_SMALL = 0.10` (isto kao sada)
- `WILD_INC_BIG = 0.22` (isto kao sada)

### Fill Rate
- Nije postojao `globalSlowdown` - sve je bilo 100% brzine
- Nisu postojali board-specific fill rates (svi boardovi su imali `fillRate = 1.0`)

### Stvarni Fill Rates (v60)

#### Svi Boardovi
- **Merge 6**: `0.22 * 1.0 = 0.22` (22% per merge 6)
- **Normal merge**: `0.10 * 1.0 = 0.10` (10% per normal merge)
- **Za puni meter (100%)**: Potrebno ~4.5 merge 6 ili ~10 normalnih mergeova

---

## 🔄 Usporedba: v60 vs v75

### Board 1 (v75 vs v60)

| Tip Mergea | v60 | v75 | Promjena |
|------------|-----|-----|----------|
| **Merge 6** | 22% | 13.2% | **-40%** (sporije) |
| **Normal merge** | 10% | 6% | **-40%** (sporije) |

**Zaključak**: Board 1 u v75 puni se **40% sporije** nego u v60.

### Board 2 (v75 vs v60)

| Tip Mergea | v60 | v75 | Promjena |
|------------|-----|-----|----------|
| **Merge 6** | 22% | 6.6% | **-70%** (sporije) |
| **Normal merge** | 10% | 3% | **-70%** (sporije) |

**Zaključak**: Board 2 u v75 puni se **70% sporije** nego u v60 (zbog kombinacije board-specific fill rate 0.5 + global slowdown 0.6).

---

## 💡 Zaključak

**NE, wild preloader NE puni se istom brzinom kao u v60.**

### Razlike:
1. **Global Slowdown**: Dodan je 40% slowdown za sve boardove (`globalSlowdown = 0.6`)
2. **Board-Specific Rates**: Board 2 ima dodatni 50% slowdown (`fillRate = 0.5`)
3. **Rezultat**: 
   - Board 1: **40% sporije** od v60
   - Board 2: **70% sporije** od v60

### Za vraćanje na v60 brzinu:
1. Ukloniti `globalSlowdown = 0.6` ili postaviti na `1.0`
2. Ukloniti board-specific `fillRate` ili postaviti na `1.0` za sve boardove

