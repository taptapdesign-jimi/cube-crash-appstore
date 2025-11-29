# 📊 WILD TILES SMOKE TRAIL BREAKDOWN

## Analiza particlesa za wild zvjezdicu, wild beer i wild magnet

---

## 1. WILD ZVJEZDICA (Wild Star) ⭐

### Količina particlesa:
- **Base shard count:** 12 particles
- **Intensity:** 1.0 (100%)
- **Final count:** `Math.max(1, Math.round(12 * 1.0))` = **12 particles**
- **Spawn interval:** 250ms (4x per second)
- **Particles per second:** 12 × 4 = **48 particles/sekundi**

### Veličina particlesa:
- **Oblik:** Pravokutnik (rect)
- **Base width:** 12-24px (random: `12 + Math.random() * 12`)
- **Base height:** 16-32px (random: `16 + Math.random() * 16`)
- **Size multiplier:** 1x (default)
- **Final size:** 12-24px × 16-32px

### Boja particlesa:
- **Paleta boja:** 5 nijansi bež/krem
  - `0xF4EEE7` - Svijetlo bež
  - `0xFBE3C5` - Krem
  - `0xECD7C2` - Srednje bež
  - `0xE5C7AD` - Tamnije bež
  - `0xFADEC0` - Svijetlo krem
- **Random selection:** Jedna boja po particle (random iz palete)

### Oblik particlesa:
- **Type:** Pravokutnik (rect)
- **Drawing:** `shard.rect(-width/2, -height/2, width, height)`
- **Rotation:** Random (0-2π)

### Animacija:
- **Duration:** 0.3-0.6s (random: `0.3 + Math.random() * 0.3`)
- **Ease:** `power1.out` (constant speed)
- **Movement:** Spiralno kretanje (angle + drift, distance × 1.5-2.0)
- **Fade:** Alpha 0 na kraju

---

## 2. WILD BEER 🍺

### Količina particlesa:
- **Base shard count:** 12 particles
- **Intensity:** 1.0 (100%)
- **Final count:** `Math.max(1, Math.round(12 * 1.0))` = **12 particles**
- **Spawn interval:** 250ms (4x per second)
- **Particles per second:** 12 × 4 = **48 particles/sekundi**

### Veličina particlesa:
- **Oblik:** Krug (circle) 🔥 **NOVO - promijenjeno iz pravokutnika**
- **Base radius:** 8-16px (random: `8 + Math.random() * 8`)
- **Size multiplier:** 1x (default)
- **Final size:** 16-32px diameter (8-16px radius)

### Boja particlesa:
- **Paleta boja:** Ista kao wild zvjezdica (5 nijansi bež/krem)
  - `0xF4EEE7` - Svijetlo bež
  - `0xFBE3C5` - Krem
  - `0xECD7C2` - Srednje bež
  - `0xE5C7AD` - Tamnije bež
  - `0xFADEC0` - Svijetlo krem
- **Random selection:** Jedna boja po particle (random iz palete)

### Oblik particlesa:
- **Type:** Krug (circle) 🔥 **NOVO - promijenjeno iz pravokutnika**
- **Drawing:** `shard.circle(0, 0, radius)`
- **Rotation:** Random (0-2π) - nema efekta na krug, ali se koristi za animaciju

### Animacija:
- **Duration:** 0.3-0.6s (random: `0.3 + Math.random() * 0.3`)
- **Ease:** `power1.out` (constant speed)
- **Movement:** Spiralno kretanje (angle + drift, distance × 1.5-2.0)
- **Fade:** Alpha 0 na kraju

---

## 3. WILD MAGNET 🧲

### Količina particlesa:
- **Base shard count:** 12 particles
- **Intensity:** 1.0 (100%)
- **Final count:** `Math.max(1, Math.round(12 * 1.0))` = **12 particles**
- **Spawn interval:** 250ms (4x per second)
- **Particles per second:** 12 × 4 = **48 particles/sekundi**

### Veličina particlesa:
- **Oblik:** Pravokutnik (rect)
- **Base width:** 12-24px (random: `12 + Math.random() * 12`)
- **Base height:** 16-32px (random: `16 + Math.random() * 16`)
- **Size multiplier:** 1x (default)
- **Final size:** 12-24px × 16-32px

### Boja particlesa:
- **Paleta boja:** 6 nijansi (5 bež/krem + 1 crvena) 🔥 **SPECIJALNO - dodana crvena boja**
  - `0xF4EEE7` - Svijetlo bež
  - `0xFBE3C5` - Krem
  - `0xECD7C2` - Srednje bež
  - `0xE5C7AD` - Tamnije bež
  - `0xFADEC0` - Svijetlo krem
  - `0xF26034` - Crvena (magnet specifična) 🔥
- **Random selection:** Jedna boja po particle (random iz palete)

### Oblik particlesa:
- **Type:** Pravokutnik (rect)
- **Drawing:** `shard.rect(-width/2, -height/2, width, height)`
- **Rotation:** Random (0-2π)

### Animacija:
- **Duration:** 0.3-0.6s (random: `0.3 + Math.random() * 0.3`)
- **Ease:** `power1.out` (constant speed)
- **Movement:** Spiralno kretanje (angle + drift, distance × 1.5-2.0)
- **Fade:** Alpha 0 na kraju

---

## 📊 USPOREDBA

| Parametar | Wild Zvjezdica ⭐ | Wild Beer 🍺 | Wild Magnet 🧲 |
|-----------|------------------|-------------|----------------|
| **Količina** | 12 particles | 12 particles | 12 particles |
| **Particles/sekundi** | 48 | 48 | 48 |
| **Oblik** | Pravokutnik | **Krug** 🔥 | Pravokutnik |
| **Veličina** | 12-24px × 16-32px | 16-32px ⌀ (8-16px radius) | 12-24px × 16-32px |
| **Boja paleta** | 5 nijansi (bež/krem) | 5 nijansi (bež/krem) | **6 nijansi (bež/krem + crvena)** 🔥 |
| **Intensity** | 1.0 (100%) | 1.0 (100%) | 1.0 (100%) |
| **Duration** | 0.3-0.6s | 0.3-0.6s | 0.3-0.6s |
| **Spawn interval** | 250ms | 250ms | 250ms |

---

## 🎯 KLJUČNE RAZLIKE

### 1. Oblik:
- **Wild Zvjezdica:** Pravokutnik (rect)
- **Wild Beer:** **Krug (circle)** 🔥 - jedini koristi krugove
- **Wild Magnet:** Pravokutnik (rect)

### 2. Boja:
- **Wild Zvjezdica:** 5 nijansi bež/krem
- **Wild Beer:** 5 nijansi bež/krem (ista kao zvjezdica)
- **Wild Magnet:** **6 nijansi (5 bež/krem + 1 crvena `0xF26034`)** 🔥

### 3. Veličina:
- **Wild Zvjezdica:** 12-24px × 16-32px (pravokutnik)
- **Wild Beer:** 16-32px diameter (krug) - slična veličina kao pravokutnik
- **Wild Magnet:** 12-24px × 16-32px (pravokutnik)

---

## 💡 ZAKLJUČAK

**Svi wild tiles koriste istu količinu particlesa (12) i isti spawn interval (250ms), ali se razlikuju po:**
1. **Obliku:** Wild beer koristi krugove, ostali pravokutnike
2. **Boji:** Wild magnet ima dodatnu crvenu boju u paleti
3. **Veličini:** Wild beer koristi radius-based sizing (krug), ostali width/height-based (pravokutnik)

**Performance:** Svi imaju isti performance impact (48 particles/sekundi, 0.3-0.6s duration).

