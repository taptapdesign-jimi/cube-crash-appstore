# Merge 6 Shake Animation Comparison

## Trenutna verzija (v99)

### 1. Obicna kockica + Obicna kockica (Regular Merge 6)

**Screen Shake:**
- **Strength**: `Math.min(24, 10 + Math.max(1, mult) * 3)`
  - Formula: `10 + (mult * 3)`, max 24
  - Primjer: mult=1 → 13px, mult=2 → 16px, mult=3 → 19px, mult=4 → 22px, mult=5+ → 24px
- **Duration**: `0.32s`
- **Steps**: `18`
- **Ease**: `power2.out`

**Dodatne animacije:**
- `regularMerge6Shards()` - brown shards (16-24 komada, 1s TTL)
- `wildImpactEffect()` - squash: 0.12, stretch: 0.10, tilt: 0.07, bounce: 1.09
- `smokeBubblesAtTile()` - strength: 1.3

---

### 2. Obicna kockica + Wild kockica (Wild Merge 6)

**Screen Shake:**
- **Strength**: `Math.min(28, 12 + Math.max(1, mult) * 4)`
  - Formula: `12 + (mult * 4)`, max 28
  - Primjer: mult=1 → 16px, mult=2 → 20px, mult=3 → 24px, mult=4 → 28px, mult=5+ → 28px
- **Duration**: `0.36s`
- **Steps**: `28`
- **Ease**: `sine.inOut`

**Dodatne animacije:**
- `spawnMerge6Shards()` - wild shards (yellow/brown, 2x poziv)
- `glassCrackAtTile()` - intensity: 2.6
- `innerFlashAtTile()` - brightness: 2.2
- `wildImpactEffect()` - squash: 0.30, stretch: 0.26, tilt: 0.18, bounce: 1.24
- `smokeBubblesAtTile()` - strength: 4.0 (wild-beer: 0.6)
- `showMultiplierTile()` - scale: 1.6

---

## v70 (starija verzija)

### 1. Obicna kockica + Obicna kockica (Regular Merge 6)

**Screen Shake:**
- **Strength**: `Math.min(24, 10 + Math.max(1, mult) * 3)` ✅ **ISTO**
- **Duration**: `0.32s` ✅ **ISTO**
- **Steps**: `18` ✅ **ISTO**
- **Ease**: `power2.out` ✅ **ISTO**

**Dodatne animacije:**
- `FX.landBounce?.(dst)` - bounce animacija
- `smokeBubblesAtTile()` - strength: 0.5-0.8 (random)

---

### 2. Obicna kockica + Wild kockica (Wild Merge 6)

**Screen Shake:**
- **Strength**: `26` (fiksna vrijednost) ❌ **RAZLIČITO**
- **Duration**: `0.36s` ✅ **ISTO**
- **Steps**: `26` ❌ **RAZLIČITO** (sada 28)
- **Ease**: `sine.inOut` ✅ **ISTO**

**Dodatne animacije:**
- `woodShardsAtTile()` - count: 26, intensity: 1.6
- `glassCrackAtTile()` - intensity: 1.6
- `wildImpactEffect()` - squash: 0.24, stretch: 0.20, tilt: 0.14, bounce: 1.18
- `smokeBubblesAtTile()` - strength: 2.6

---

## Usporedba u tablici

| Parametar | Regular Merge 6 | Wild Merge 6 |
|-----------|----------------|--------------|
| **Trenutna verzija** | | |
| Strength formula | `min(24, 10 + mult*3)` | `min(28, 12 + mult*4)` |
| Strength (mult=1) | 13px | 16px |
| Strength (mult=5) | 24px | 28px |
| Duration | 0.32s | 0.36s |
| Steps | 18 | 28 |
| Ease | power2.out | sine.inOut |
| **v70 verzija** | | |
| Strength formula | `min(24, 10 + mult*3)` ✅ | `26` (fiksno) ❌ |
| Strength (mult=1) | 13px | 26px |
| Strength (mult=5) | 24px | 26px |
| Duration | 0.32s ✅ | 0.36s ✅ |
| Steps | 18 ✅ | 26 ❌ |
| Ease | power2.out ✅ | sine.inOut ✅ |

---

## Ključne razlike

### Regular Merge 6:
- ✅ **ISTO** - Nema promjena u shake animaciji
- ✅ **POBOLJŠANJE** - Dodana `regularMerge6Shards()` animacija (brown shards)
- ✅ **POBOLJŠANJE** - Dodan `wildImpactEffect()` (squash/stretch/tilt/bounce)
- ✅ **POBOLJŠANJE** - Poboljšan `smokeBubblesAtTile()` (strength: 1.3)

### Wild Merge 6:
- ❌ **PROMJENA** - Strength sada ovisi o multiplieru (12 + mult*4, max 28) umjesto fiksnog 26
- ❌ **PROMJENA** - Steps povećan s 26 na 28
- ✅ **POBOLJŠANJE** - Dodana `glassCrackAtTile()` s većom intenzitetom (2.6)
- ✅ **POBOLJŠANJE** - Dodana `innerFlashAtTile()` animacija
- ✅ **POBOLJŠANJE** - Poboljšan `wildImpactEffect()` (veći squash/stretch/tilt/bounce)
- ✅ **POBOLJŠANJE** - Poboljšan `smokeBubblesAtTile()` (strength: 4.0)

---

## Zaključak

**Regular Merge 6:**
- Shake animacija je **ISTA** kao u v70
- Dodane su **NOVE** animacije (shards, impact effect, smoke)

**Wild Merge 6:**
- Shake animacija je **JAČA** (sada ovisi o multiplieru, max 28px umjesto fiksnog 26px)
- Shake animacija ima **VIŠE KORAKA** (28 umjesto 26)
- Dodane su **NOVE** animacije (glass crack, inner flash, poboljšan impact effect, smoke)

