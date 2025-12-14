# Shimmer Interval Assessment - Problem sa Timeline-om

## Problem
Shimmer i dalje ima isti timeline - ne restartuje se pravilno svakih 2.9 sekundi. Animacija se ne pojavljuje ponovo kako treba.

## Analiza Trenutnog Stanja

### 1. JavaScript Timing (src/modules/journey-boards-manager.ts)

```typescript
// Interval: 2900ms (2.9 sekundi)
const runCycle = () => {
  triggerShimmerAndGlow();
  this.glowPulseInterval = window.setTimeout(runCycle, 2900);
};

// Animacija traje: 3000ms (3 sekunde)
animation: journey-interim-shimmer 3s linear !important;

// Klasa se uklanja nakon: 3500ms (3.5 sekundi)
setTimeout(() => {
  currentInterimCard.classList.remove('interim-shimmer-trigger');
}, 3500);
```

### 2. Problem sa Timeline-om

**Timeline konflikt:**
- T=0ms: Prvi ciklus - shimmer klasa se dodaje
- T=2900ms: Drugi ciklus - shimmer klasa se dodaje PONOVO (ali animacija još traje!)
- T=3000ms: Prva animacija se završava
- T=3500ms: Prva klasa se uklanja (ali već je dodata druga!)

**Problem:** 
- Interval (2.9s) je **kraći** od animacije (3.0s)
- Kada se klasa doda ponovo dok animacija još traje, browser **ne restartuje** animaciju
- Browser nastavlja sa postojećom animacijom umesto da počne novu

### 3. CSS Animacija

```css
.journey-board-card.interim.interim-shimmer-trigger::after {
  animation: journey-interim-shimmer 3s linear !important;
  animation-delay: 0s !important;
}
```

**Problem:**
- Animacija traje 3 sekunde
- Kada se klasa doda ponovo pre nego što se animacija završi, CSS ne restartuje animaciju
- Browser vidi da animacija već traje i ignoriše novu klasu

## Rešenje

### Opcija 1: Povećati Interval (PREPORUČENO)
**Interval mora biti duži od animacije + buffer:**

```typescript
// Interval: 3200ms (3.2 sekundi) - duže od animacije (3s) + buffer (200ms)
this.glowPulseInterval = window.setTimeout(runCycle, 3200);

// Ukloniti klasu pre sledećeg ciklusa (npr. 3100ms)
setTimeout(() => {
  currentInterimCard.classList.remove('interim-shimmer-trigger');
}, 3100); // Ukloni pre sledećeg ciklusa (3200ms)
```

**Prednosti:**
- Jednostavno rešenje
- Nema konflikta između intervala i animacije
- Animacija se završava pre sledećeg ciklusa

### Opcija 2: Skratiti Animaciju
**Animacija mora biti kraća od intervala:**

```css
/* Skratiti animaciju na 2.5s umesto 3s */
animation: journey-interim-shimmer 2.5s linear !important;
```

```typescript
// Interval ostaje 2900ms
this.glowPulseInterval = window.setTimeout(runCycle, 2900);

// Ukloniti klasu nakon animacije (2.5s + buffer)
setTimeout(() => {
  currentInterimCard.classList.remove('interim-shimmer-trigger');
}, 2800); // 2.5s animacija + 300ms buffer
```

**Prednosti:**
- Interval ostaje 2.9s kako korisnik želi
- Animacija se završava pre sledećeg ciklusa

**Mane:**
- Animacija je brža (možda ne izgleda dobro)

### Opcija 3: Pravilno Resetovanje Animacije
**Ukloniti klasu PRE nego što se interval aktivira:**

```typescript
const triggerShimmerAndGlow = () => {
  // ... existing code ...
  
  // Ukloniti klasu PRE nego što se interval aktivira (npr. 2800ms)
  (currentInterimCard as any)._interimShimmerRemoveTimeout = window.setTimeout(() => {
    if (!this.renderDisposed && currentInterimCard.parentElement) {
      currentInterimCard.classList.remove('interim-shimmer-trigger');
      void currentInterimCard.offsetHeight;
      logger.info('✨ Shimmer stopped on interim card');
    }
    (currentInterimCard as any)._interimShimmerRemoveTimeout = null;
  }, 2800); // Ukloni pre sledećeg ciklusa (2900ms)
};
```

**Prednosti:**
- Interval ostaje 2.9s
- Animacija se pravilno resetuje pre sledećeg ciklusa

## Preporučeno Rešenje

**Kombinacija Opcije 1 i 3:**

1. **Povećati interval na 3.2s** (duže od animacije)
2. **Ukloniti klasu na 3.1s** (pre sledećeg ciklusa)
3. **Osigurati da se animacija završava pre sledećeg ciklusa**

```typescript
// Interval: 3200ms (3.2 sekundi)
this.glowPulseInterval = window.setTimeout(runCycle, 3200);

// Ukloniti klasu: 3100ms (pre sledećeg ciklusa)
setTimeout(() => {
  currentInterimCard.classList.remove('interim-shimmer-trigger');
  void currentInterimCard.offsetHeight;
}, 3100);
```

**Ili, ako korisnik insistira na 2.9s intervalu:**

```typescript
// Interval: 2900ms (2.9 sekundi)
this.glowPulseInterval = window.setTimeout(runCycle, 2900);

// Skratiti animaciju na 2.5s
animation: journey-interim-shimmer 2.5s linear !important;

// Ukloniti klasu: 2800ms (pre sledećeg ciklusa)
setTimeout(() => {
  currentInterimCard.classList.remove('interim-shimmer-trigger');
  void currentInterimCard.offsetHeight;
}, 2800);
```

## Ključni Problem

**CSS animacije se ne restartuju kada se klasa doda ponovo dok animacija još traje.**

**Rešenje:** Interval mora biti **duži** od animacije, ili animacija mora biti **kraća** od intervala, i klasa mora biti **uklonjena pre** sledećeg ciklusa.

## Test Scenariji

1. **Trenutno (NE RADI):**
   - T=0ms: Klasa dodata, animacija počinje (3s)
   - T=2900ms: Klasa dodata ponovo (animacija još traje!) → Browser ignoriše
   - T=3000ms: Prva animacija se završava
   - T=3500ms: Prva klasa se uklanja (ali već je dodata druga)

2. **Sa ispravkom (RADI):**
   - T=0ms: Klasa dodata, animacija počinje (3s)
   - T=3000ms: Animacija se završava
   - T=3100ms: Klasa se uklanja
   - T=3200ms: Klasa dodata ponovo, animacija počinje → Browser restartuje animaciju
