# ANALIZA: Navigation Divider Shadow na Stats Screenu

## 📋 PREGLED PROBLEMA

Shadow element (`#navigation-divider-shadow`) se ne pozicionira konzistentno kada se uđe u stats screen. Svaki put kada se screen otvori, shadow se pomiče na drugačiju poziciju umjesto da ostane fiksno 1px ispod dividera.

## 🏗️ TRENUTNA IMPLEMENTACIJA

### 1. **Kreiranje Shadow Elementa**

**Lokacija:** `src/ui/bootstrap-ui.ts` (linija 284-304)

Shadow element se kreira kao globalni `<img>` element direktno u `document.body`:

```typescript
const navDividerShadow = document.createElement('img');
navDividerShadow.id = 'navigation-divider-shadow';
navDividerShadow.src = './assets/home-shadow.png';
navDividerShadow.style.cssText = `
  position: fixed;
  left: 0;
  right: 0;
  width: 100%;
  top: 0; /* Dinamički pozicioniran via JavaScript */
  bottom: auto;
  height: 49px;
  object-fit: contain;
  pointer-events: none;
  z-index: 99;
  opacity: 0.55;
  display: none;
`;
document.body.appendChild(navDividerShadow);
```

**CSS:** `src/style.css` (linija 1878-1891)
- `position: fixed` - fiksno pozicioniranje relativno na viewport
- `opacity: 0` - početna opacity (animira se na 0.6 via GSAP)
- `display: none` - sakriven po defaultu

### 2. **Pozicioniranje Shadow-a**

**Lokacija:** `src/modules/ui-manager.ts` (linija 1640-1749)

**Funkcija:** `showNavigationDividerShadow(dividerSelector: string)`

**Kako radi:**
1. Pronalazi shadow element (`#navigation-divider-shadow`)
2. Pronalazi divider element (npr. `.stats-title-underline`)
3. Koristi `getBoundingClientRect()` da dobije poziciju dividera
4. Računa shadow poziciju: `shadowTop = dividerRect.bottom + 1` (1px ispod dividera)
5. Postavlja `style.top` na izračunatu vrijednost

**Problem:** `getBoundingClientRect()` vraća poziciju relativno na viewport, koja se može mijenjati ovisno o:
- Scroll poziciji
- Layout promjenama
- Animacijama
- Timing-u kada se pozicija računa

### 3. **Kada se Shadow Prikazuje**

**Lokacija:** `src/modules/ui-manager.ts` (linija 844-848)

Shadow se prikazuje nakon što se stats screen animacija pokrene:

```typescript
setTimeout(() => {
  this.showNavigationDividerShadow('.stats-title-underline');
}, 100);
```

**Timing:**
- Stats screen se prikaže (opacity: 0 → 1)
- `animateStatsScreenEnter()` se pozove (50ms delay)
- Shadow se pozicionira (100ms delay nakon animacije)

**Problem:** 100ms delay možda nije dovoljan da se layout potpuno stabilizira, što rezultira različitim pozicijama.

### 4. **Pozicioniranje Logika**

**Lokacija:** `src/modules/ui-manager.ts` (linija 1660-1687)

```typescript
const updateShadowPosition = () => {
  const dividerRect = divider.getBoundingClientRect();
  
  if (dividerRect.height === 0 || dividerRect.width === 0) {
    // Retry ako divider nije renderiran
    setTimeout(() => updateShadowPosition(), 50);
    return;
  }
  
  const shadowTop = dividerRect.bottom + 1; // 1px ispod dividera
  navDividerShadow.style.top = `${shadowTop}px`;
};
```

**Triple requestAnimationFrame:**
```typescript
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updateShadowPosition();
      // GSAP fade-in animacija
    });
  });
});
```

**Problem:** Iako se koristi triple RAF, pozicija se računa u različitim trenucima layout ciklusa, što može rezultirati različitim vrijednostima.

### 5. **Event Handlers**

**Lokacija:** `src/modules/ui-manager.ts` (linija 1716-1739)

Shadow prati promjene pozicije dividera kroz:
- `resize` event - kada se prozor resize-uje
- `scroll` event - kada se scrolla (capture phase: `true`)

**Problem:** Scroll listener može biti previše agresivan i uzrokovati nepotrebne repainte.

### 6. **Sakrivanje Shadow-a**

**Lokacija:** `src/modules/ui-manager.ts` (linija 1754-1790)

Shadow se sakriva s GSAP fade-out animacijom (0.6 → 0 opacity, 0.3s duration).

## 🐛 IDENTIFICIRANI PROBLEMI

### Problem 1: **Nekonzistentno Pozicioniranje**
- Shadow se pozicionira na temelju `getBoundingClientRect()` koji može dati različite vrijednosti ovisno o timing-u
- Layout možda nije potpuno stabiliziran kada se pozicija računa
- Triple RAF možda nije dovoljan za kompleksne animacije

### Problem 2: **Timing Issues**
- 100ms delay možda nije dovoljan da se divider potpuno renderira
- Animacije mogu utjecati na poziciju dividera dok se shadow pozicionira

### Problem 3: **Scroll/Resize Handlers**
- Scroll listener može uzrokovati nepotrebne repainte
- Handlers se možda ne čiste pravilno

### Problem 4: **Provjera Postojeće Pozicije**
- Provjera `storedDivider === divider` možda ne radi kako treba jer se divider element možda re-kreira

## 💡 PREPORUČENA RJEŠENJA

### Rješenje 1: **Koristiti CSS Positioning Umjesto JavaScript**

Umjesto dinamičkog pozicioniranja via JavaScript, koristiti CSS `::after` pseudo-element na divideru:

```css
.stats-title-underline::after {
  content: "";
  position: absolute;
  top: calc(100% + 1px); /* 1px ispod dividera */
  left: 0;
  right: 0;
  height: 49px;
  background-image: url('./assets/home-shadow.png');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  pointer-events: none;
  z-index: 99;
  opacity: 0.6;
}
```

**Prednosti:**
- Automatski prati divider poziciju
- Nema timing problema
- Nema potrebe za event handlers
- Relativno pozicioniranje osigurava konzistentan razmak

### Rješenje 2: **Poboljšati JavaScript Pozicioniranje**

Ako se želi zadržati JavaScript pristup:

1. **Koristiti `IntersectionObserver` umjesto scroll listener:**
```typescript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      updateShadowPosition();
    }
  });
}, { threshold: 0 });
observer.observe(divider);
```

2. **Čekati da se animacije završe prije pozicioniranja:**
```typescript
// Čekati da GSAP animacije završe
gsap.to(statsScreen, {
  opacity: 1,
  duration: 0.5,
  onComplete: () => {
    // Sada pozicionirati shadow
    this.showNavigationDividerShadow('.stats-title-underline');
  }
});
```

3. **Koristiti `offsetTop` umjesto `getBoundingClientRect()`:**
```typescript
// Relativno na parent element
const parentRect = divider.parentElement.getBoundingClientRect();
const dividerRect = divider.getBoundingClientRect();
const relativeTop = dividerRect.top - parentRect.top;
const shadowTop = parentRect.top + relativeTop + dividerRect.height + 1;
```

### Rješenje 3: **Kombinirati CSS i JavaScript**

Koristiti CSS za pozicioniranje, JavaScript za animacije:

```css
.stats-title-underline {
  position: relative; /* Potrebno za ::after positioning */
}

.stats-title-underline::after {
  content: "";
  position: absolute;
  top: calc(100% + 1px);
  /* ... */
  opacity: 0;
  transition: opacity 0.3s ease;
}

.stats-title-underline.shadow-visible::after {
  opacity: 0.6;
}
```

```typescript
// Dodati klasu kada se screen prikaže
divider.classList.add('shadow-visible');
```

## 📝 ZAKLJUČAK

**Trenutni problem:** Shadow se pozicionira dinamički via JavaScript koristeći `getBoundingClientRect()`, što može dati različite rezultate ovisno o timing-u i layout stanju.

**Najbolje rješenje:** Koristiti CSS `::after` pseudo-element na divideru s `position: absolute` i `top: calc(100% + 1px)`. Ovo osigurava konzistentan relativni razmak od 1px bez obzira na timing ili layout promjene.

**Alternativno:** Poboljšati JavaScript pozicioniranje čekanjem da se animacije završe i korištenjem `IntersectionObserver` umjesto scroll listenera.

