# 🎯 Wild Meter Balance Calculation: Mobitel vs iPad

## 📊 Trenutno Stanje

### Grid Dimensions
- **Mobitel**: 5 kolona × 9 redova = **45 kockica**
- **iPad**: 7 kolona × 9 redova = **63 kockica**
- **Razlika**: 63 - 45 = **+18 kockica** (40% više kockica na iPad-u)

### Wild Meter Fill Rates (Trenutno)
- **WILD_INC_SMALL** = 0.10 (za merge-ove 2-5)
- **WILD_INC_BIG** = 0.22 (za merge 6)
- **globalSlowdown** = 0.8 (20% usporavanje = 80% brzine)
- **fillRate** (board-specific, default 1.0)

### Formula za Punjenje
```
adjustedInc = WILD_INC × fillRate × globalSlowdown
```

### Stvarni Fill Rates (Mobitel - Baseline)
- **Merge 6**: `0.22 × 1.0 × 0.8 = 0.176` (17.6% per merge 6)
- **Mali merge**: `0.10 × 1.0 × 0.8 = 0.08` (8% per mali merge)
- **Za puni meter (100%)**: Potrebno ~5.7 merge 6 ili ~12.5 malih mergeova

---

## 🔍 Problem: iPad Imbalance

### Analiza
- **iPad ima 40% više kockica** (63 vs 45)
- **Više kockica = više mogućnosti za merge-ove**
- **Više merge-ova = brže punjenje wild metera**
- **Rezultat**: Na iPad-u je **previše lako** napraviti clean board

### Matematička Analiza

#### Relativna Brzina Punjenja
- **Mobitel**: 45 kockica → baseline brzina punjenja = 1.0x
- **iPad**: 63 kockica → očekivana brzina punjenja = 63/45 = **1.4x** (40% brže)

#### Potrebno Usporavanje
Da bi wild meter punio se **istom relativnom brzinom** na iPad-u kao na mobitelu:
- **Faktor usporavanja** = 1 / 1.4 = **0.714** (71.4% brzine)
- **Usporavanje** = 1 - 0.714 = **0.286** (28.6% sporije)

---

## 📈 Predviđanje za iPad

### Scenario 1: Bez Usporavanja (Trenutno)
- **Merge 6**: `0.22 × 1.0 × 0.8 = 0.176` (17.6% per merge 6)
- **Mali merge**: `0.10 × 1.0 × 0.8 = 0.08` (8% per mali merge)
- **Problem**: Ista brzina kao mobitel, ali **40% više kockica** = **40% brže punjenje u praksi**

### Scenario 2: Sa Usporavanjem (Predloženo)
- **iPad slowdown factor** = 0.714 (28.6% usporavanje)
- **Merge 6**: `0.22 × 1.0 × 0.8 × 0.714 = 0.126` (12.6% per merge 6)
- **Mali merge**: `0.10 × 1.0 × 0.8 × 0.714 = 0.057` (5.7% per mali merge)
- **Za puni meter (100%)**: Potrebno ~7.9 merge 6 ili ~17.5 malih mergeova

---

## 🎯 Preporučeno Rješenje

### Opcija 1: Direktno Usporavanje (28.6%)
- **iPad slowdown factor** = **0.714**
- **Formula**: `adjustedInc = WILD_INC × fillRate × globalSlowdown × iPadSlowdown`
- **Rezultat**: Wild meter puni se **28.6% sporije** na iPad-u

### Opcija 2: Konzervativnije Usporavanje (25%)
- **iPad slowdown factor** = **0.75**
- **Formula**: `adjustedInc = WILD_INC × fillRate × globalSlowdown × iPadSlowdown`
- **Rezultat**: Wild meter puni se **25% sporije** na iPad-u

### Opcija 3: Agresivnije Usporavanje (30%)
- **iPad slowdown factor** = **0.70**
- **Formula**: `adjustedInc = WILD_INC × fillRate × globalSlowdown × iPadSlowdown`
- **Rezultat**: Wild meter puni se **30% sporije** na iPad-u

---

## 📊 Usporedba: Mobitel vs iPad (Sa Usporavanjem)

| Metrika | Mobitel | iPad (bez usporavanja) | iPad (28.6% usporavanje) |
|---------|---------|------------------------|---------------------------|
| **Broj kockica** | 45 | 63 | 63 |
| **Merge 6 fill** | 17.6% | 17.6% (ali 40% brže u praksi) | 12.6% |
| **Mali merge fill** | 8% | 8% (ali 40% brže u praksi) | 5.7% |
| **Merge 6 za puni meter** | ~5.7 | ~4.1 (praktično) | ~7.9 |
| **Mali merge za puni meter** | ~12.5 | ~8.9 (praktično) | ~17.5 |
| **Relativna brzina** | 1.0x | 1.4x (nebalansirano) | ~1.0x (balansirano) |

---

## 🎮 Preporuka

### Preporučeni Faktor: **0.714** (28.6% usporavanje)

**Razlog**:
- Matematički točan faktor koji kompenzira 40% više kockica
- Osigurava da wild meter puni se **istom relativnom brzinom** na oba uređaja
- Igra postaje **podjednako fer** na mobitelu i iPad-u

### Implementacija
```typescript
// U addWildProgress funkciji
const isIPad = window.innerWidth >= 768 && window.innerWidth <= 1024;
const iPadSlowdown = isIPad ? 0.714 : 1.0; // 28.6% usporavanje na iPad-u
const adjustedInc = inc * fillRate * globalSlowdown * iPadSlowdown;
```

---

## 📋 Sažetak

| Parametar | Vrijednost |
|-----------|------------|
| **Mobitel kockice** | 45 |
| **iPad kockica** | 63 |
| **Razlika** | +18 kockica (40% više) |
| **Preporučeni iPad slowdown** | **0.714** (28.6% usporavanje) |
| **Alternativni faktor** | 0.75 (25% usporavanje) - konzervativnije |
| **Alternativni faktor** | 0.70 (30% usporavanje) - agresivnije |

**Finalni broj za implementaciju**: **0.714** (ili **71.4%** brzine)

