# 📐 Detail Modal Container Breakdown

## 🎯 Glavni Container: `detail-swipeable-container`

### Početna širina (CSS):
- **Width**: `100%` (viewport width)
- **Padding**: `0`
- **Margin**: `0`
- **Display**: `flex`
- **Flex-direction**: `row`

### Dinamička širina (JavaScript):
- **Container width** (prije JS): `container.offsetWidth` (obično **390px** na iPhone)
- **Section width**: `containerWidth` = **390px**
- **Total width** (nakon JS): `sectionWidth * 2` = **780px** (2 sekcije)

---

## 📦 Sekcija 1: `detail-section-stats-card`

### Širina:
- **Width**: `sectionWidth` = **390px** (postavljeno u JS)
- **Min-width**: `390px`
- **Max-width**: `390px`
- **Flex-shrink**: `0`

### Padding & Margin:
- **Padding**: `0 40px 24px 40px`
  - Top: `0px`
  - Right: `40px`
  - Bottom: `24px`
  - Left: `40px`
- **Margin-top**: `calc(-40px + env(safe-area-inset-top, 0px))`
- **Margin-bottom**: `0`
- **Transform**: `translateY(-80px)`

### Layout:
- **Flex-direction**: `row` (horizontalno)
- **Align-items**: `center`
- **Justify-content**: `flex-start`
- **Gap**: `48px` (između svih elemenata)

### Elementi unutar (horizontalno):

#### 1. Stats (`detail-section-stats`)
- **Width**: `229px` (fiksno)
- **Flex-shrink**: `0`
- **Gap unutar**: `40px` (između stat itema)

#### 2. Gap
- **48px** (između Stats i Card)

#### 3. Card (`detail-section-card`)
- **Width**: `310px` (fiksno, od `detail-image`)
- **Flex-shrink**: `0`
- **Margin**: `16px 0 0 0` (samo top margin)
- **Aspect ratio**: `310 / 458` (height: `458px`)

#### 4. Gap
- **48px** (između Card i Text)

#### 5. Text (`detail-description`)
- **Margin-left**: `200px` (udaljenost od kartice)
- **Width**: auto (širina teksta)
- **Max-width**: nema (uklonjeno)
- **Font-size**: `20px`

---

## 📊 Kalkulacija Ukupne Širine

### Unutar `detail-section-stats-card` (390px širina):

```
Left padding:        40px
Stats:              229px
Gap:                 48px
Card:               310px
Gap:                 48px
Text margin-left:   200px
Text width:         auto (širina teksta)
Right padding:       40px
─────────────────────────
UKUPNO:            ~915px+ (bez teksta)
```

**⚠️ PROBLEM**: Container je **390px** širok, ali sadržaj unutra je **~915px+** širok!

### Stvarna širina elemenata:
- Stats: `229px`
- Gap 1: `48px`
- Card: `310px`
- Gap 2: `48px`
- Text margin: `200px`
- **UKUPNO**: `229 + 48 + 310 + 48 + 200 = 835px` (bez padding-a i teksta)

### S padding-om:
- Left padding: `40px`
- Content: `835px`
- Right padding: `40px`
- **UKUPNO**: `915px` (bez širine teksta)

---

## 🔍 Problem Identifikovan

**Container je 390px širok, ali sadržaj je ~915px širok!**

To znači da:
1. Container je preuzak za sadržaj
2. Elementi se preklapaju ili se tekst ne vidi
3. Text margin-left od 200px je relativno na card, ali container nema dovoljno prostora

---

## 💡 Rješenje

Container treba biti širi ili elementi trebaju biti manji. Opcije:

1. **Povećati container širinu** na minimum `915px+`
2. **Smanjiti elemente** (stats, card, gap, margin)
3. **Promijeniti layout** (vertical stacking ili drugačiji gap)

---

## 📝 Trenutna Struktura HTML

```
detail-swipeable-container (390px → 780px u JS)
  ├── detail-section-stats-card (390px)
  │   ├── detail-section-stats (229px)
  │   ├── [gap: 48px]
  │   ├── detail-section-card (310px)
  │   │   └── detail-image (310px × 458px)
  │   ├── [gap: 48px]
  │   └── detail-description (margin-left: 200px)
  └── detail-section-description (390px) [buttons sekcija]
```

---

## 🎯 Preporuka

Za iPhone 13/14 (390px viewport):
- Container treba biti **minimum 915px** širok za prvu sekciju
- Ili smanjiti elemente:
  - Stats: `229px` → `150px`
  - Card: `310px` → `250px`
  - Gap: `48px` → `24px`
  - Text margin: `200px` → `100px`
  - **Nova širina**: `150 + 24 + 250 + 24 + 100 = 548px` (još uvijek preširoko za 390px)

**Najbolje rješenje**: Container treba biti scrollable horizontalno ili elementi trebaju biti značajno smanjeni.


