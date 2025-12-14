# Shimmer Animation Assessment - Interim Card

## Problem
Shimmer se ne vidi na interim kartici, iako se klasa `interim-shimmer-trigger` dodaje (vidljivo u logovima).

## Analiza

### 1. Detail Screen Shimmer (RADI)
```css
#collectibles-detail-modal .detail-image::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(...);
  transform: translateX(-160%) skewX(-12deg);
  opacity: 0;
  filter: blur(0.56px);
  border-radius: 34px;
  animation: card-detail-shimmer 3s linear infinite; /* INFINITE */
  animation-delay: 0.5s;
}
```
**Ključ:** `animation: infinite` - animacija se ponavlja kontinuirano

### 2. Interim Card Shimmer (NE RADI)
```css
.journey-board-card.interim::after {
  content: "";
  position: absolute;
  ...
  animation: none !important; /* NO ANIMATION BY DEFAULT */
}

.journey-board-card.interim.interim-shimmer-trigger::after {
  transform: translateX(-160%) skewX(-12deg) translateZ(0) !important;
  opacity: 0 !important;
  animation: journey-interim-shimmer 3s linear !important; /* ONE TIME */
  animation-delay: 0.5s !important;
}
```
**Problem:** 
- Animacija se primenjuje samo jednom (nema `infinite`)
- Resetovanje transform/opacity sa `!important` može blokirati animaciju
- `animation: none` u base state može sprečiti restart

### 3. JS Timing
- Interval: 3000ms
- Animacija traje: 3000ms + 500ms delay = 3500ms
- Klasa se uklanja: 3200ms
- **Problem:** Interval se aktivira dok animacija još traje

## Rešenje

### Opcija 1: Infinite Animation (Kao Detail Screen)
- Koristiti `animation: infinite` umesto jednokratne animacije
- Ukloniti resetovanje transform/opacity sa `!important`
- Klasa samo kontroliše da li je animacija aktivna

### Opcija 2: Pravilno Restartovanje Jednokratne Animacije
- Ukloniti `animation: none` iz base state
- Koristiti `animation-play-state: paused` umesto `animation: none`
- Resetovati animaciju pre dodavanja klase

### Opcija 3: Koristiti GSAP umesto CSS animacije
- JS kontroliše animaciju potpuno
- Nema problema sa CSS restartovanjem

## Preporuka
**Opcija 1** - najjednostavnije i najpouzdanije, kao detail screen.
