# Shimmer Fix Instructions for Interim Card

## Problem
Shimmer se pojavljuje samo jednom na početku i više se ne pojavljuje. Treba da se pojavljuje **svaki put zajedno sa glow efektom** u sekvenci (shimmer prvo, glow 100ms kasnije).

## Željeno Ponašanje
1. **Shimmer** se aktivira prvo
2. **Glow** se aktivira 100ms kasnije  
3. Ovo se **ponavlja svake 3 sekunde** u intervalu
4. Shimmer mora biti **vidljiv svaki put** kada se glow pojavi
5. **Sekvenca**: Shimmer → (100ms delay) → Glow → (pauza do sledećeg intervala) → ponavlja se

## Trenutno Stanje

### CSS (src/collectibles-screen.css)
- **Linija ~1194**: `.journey-board-card.interim::after` - base state bez animacije (`animation: none`)
- **Linija ~1223**: `.journey-board-card.interim.interim-shimmer-trigger::after` - infinite animacija
- **Problem**: Infinite animacija se ne restartuje pravilno kada se klasa dodaje ponovo. CSS animacije se ne restartuju samo dodavanjem klase ako animacija već traje.

### JS (src/modules/journey-boards-manager.ts)
- **Linija ~286**: `triggerShimmerAndGlow()` funkcija u intervalu
- **Linija ~320**: Interval se aktivira svake 3 sekunde (`setInterval(triggerShimmerAndGlow, 3000)`)
- **Problem**: 
  - Klasa se dodaje, ali animacija se ne restartuje
  - Klasa se uklanja nakon 3.5s, ali interval se aktivira svake 3s (konflikt timing-a)

## Konkretno Rešenje

### Korak 1: Promeniti CSS animaciju da NIJE infinite
```css
.journey-board-card.interim.interim-shimmer-trigger::after {
  /* Ukloniti infinite - animacija traje 3s + 0.5s delay = 3.5s total */
  animation: journey-interim-shimmer 3s linear !important; /* BEZ infinite */
  animation-delay: 0.5s !important;
}
```

### Korak 2: Promeniti JS da pravilno restartuje animaciju
```typescript
const triggerShimmerAndGlow = () => {
  const currentInterimCard = document.querySelector('.journey-board-card.interim') as HTMLElement;
  if (!currentInterimCard || this.renderDisposed) {
    this.stopGlowPulse();
    return;
  }
  
  // 1. Ukloniti klasu da resetujemo animaciju
  currentInterimCard.classList.remove('interim-shimmer-trigger');
  
  // 2. Force reflow
  void currentInterimCard.offsetHeight;
  
  // 3. Koristiti requestAnimationFrame da osiguramo da se animacija restartuje
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!this.renderDisposed && currentInterimCard.parentElement) {
        // 4. Dodati klasu - animacija počinje
        currentInterimCard.classList.add('interim-shimmer-trigger');
        logger.info('✨ Shimmer triggered on interim card');
        
        // 5. Glow 100ms kasnije
        setTimeout(() => {
          if (!this.renderDisposed && currentInterimCard.parentElement) {
            this.triggerGlowPulse(currentInterimCard);
          }
        }, 100);
        
        // 6. Ukloniti klasu nakon animacije (3s + 0.5s delay = 3.5s)
        setTimeout(() => {
          if (!this.renderDisposed && currentInterimCard.parentElement) {
            currentInterimCard.classList.remove('interim-shimmer-trigger');
            void currentInterimCard.offsetHeight;
          }
        }, 3500);
      }
    });
  });
};
```

### Korak 3: Proveriti da li postoji CSS konflikt
- Proveriti da li `overflow: hidden` na `.journey-board-card.interim` ne sakriva shimmer
- Proveriti da li `z-index` dovoljno visok (trenutno 999)
- Proveriti da li `::after` element postoji (može se proveriti u DevTools)

## Alternativno Rešenje (Ako CSS ne radi)

### Koristiti realan DOM element umesto ::after
Umesto CSS `::after` pseudo-elementa, kreirati realan `<div>` element za shimmer i animirati ga sa GSAP:

```typescript
// U journey-boards-manager.ts
private createShimmerElement(card: HTMLElement): HTMLElement {
  // Proveriti da li već postoji
  let shimmer = card.querySelector('.interim-shimmer-element') as HTMLElement;
  if (!shimmer) {
    shimmer = document.createElement('div');
    shimmer.className = 'interim-shimmer-element';
    shimmer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.52) 50%, rgba(255,255,255,0) 100%);
      transform: translateX(-160%) skewX(-12deg);
      opacity: 0;
      filter: blur(0.56px);
      z-index: 999;
      pointer-events: none;
      border-radius: 12px;
    `;
    card.appendChild(shimmer);
  }
  return shimmer;
}

private triggerShimmerWithGSAP(card: HTMLElement): void {
  const shimmer = this.createShimmerElement(card);
  
  // Kill any existing animation
  gsap.killTweensOf(shimmer);
  
  // Reset to start
  gsap.set(shimmer, {
    transform: 'translateX(-160%) skewX(-12deg)',
    opacity: 0
  });
  
  // Animate shimmer
  gsap.to(shimmer, {
    transform: 'translateX(160%) skewX(-12deg)',
    opacity: [0, 0.5, 1, 1, 1, 0.5, 0],
    duration: 3,
    delay: 0.5,
    ease: 'none'
  });
}
```

## Fajlovi za Izmenu

1. **src/collectibles-screen.css** - linija ~1223: ukloniti `infinite` iz animacije
2. **src/modules/journey-boards-manager.ts** - linija ~286: promeniti `triggerShimmerAndGlow()` funkciju

## Testiranje

1. Otvoriti journey screen
2. Naći interim kartice
3. Proveriti u konzoli da li se log "✨ Shimmer triggered" pojavljuje svake 3 sekunde
4. Proveriti u DevTools:
   - Da li se klasa `interim-shimmer-trigger` dodaje/uklanja pravilno
   - Da li `::after` element ima animaciju
   - Da li se transform i opacity menjaju tokom animacije
5. Proveriti vizuelno da li se shimmer pojavljuje svaki put zajedno sa glow-om

## Reference

Detail screen shimmer (RADI):
- `src/collectibles-screen.css` linija ~940-963
- Koristi `animation: card-detail-shimmer 3s linear infinite;`
- Animacija je uvek aktivna (infinite), nema JS kontrole

## Ključni Problem

**CSS animacije se ne restartuju samo dodavanjem klase ako animacija već traje ili je nedavno završena.**

Kada se klasa `interim-shimmer-trigger` doda ponovo pre nego što se animacija završi, browser ne restartuje animaciju. Treba:
1. Ukloniti klasu
2. Sačekati da se CSS resetuje (force reflow + requestAnimationFrame)
3. Dodati klasu ponovo
4. Animacija se restartuje

## Očekivani Rezultat

Nakon popravke:
- Shimmer se pojavljuje svake 3 sekunde
- Shimmer se pojavljuje 100ms pre glow-a
- Shimmer je vidljiv svaki put (ne samo jednom)
- Animacija se pravilno restartuje svaki put
