# Wild Juice Bubbles Explosion Module - Assessment Review

## 📋 Overview
Modul `wild-juice-bubbles-explosion.ts` je dizajniran kao **standalone, outside-the-game modul** slično kao `board-transition-screen.ts`. Radi neovisno o board/tile hijerarhiji i renderira direktno na PixiJS stage.

## 🏗️ Arhitektura (usporedba s board-transition-screen)

### ✅ Sličnosti s board-transition-screen:
1. **Module-level state** - koristi module-level varijable (`isExplosionActive`, `explosionContainer`, `spawnTick`)
2. **Independent lifecycle** - upravlja vlastitim cleanup-om, ne ovisi o board state-u
3. **Direct stage access** - renderira direktno na `stage` (zIndex: 20000), izvan board hijerarhije
4. **Self-contained** - sve logika je unutar modula, nema ovisnosti o tile/board objektima
5. **Cleanup functions** - `stopWildJuiceBubblesExplosion()`, `cleanup()` funkcije za potpuni cleanup

### 🔍 Ključne razlike:
- **board-transition-screen**: Koristi DOM overlay (HTML/CSS), ne PixiJS
- **wild-juice-bubbles-explosion**: Koristi PixiJS Container na stage-u

## 🎯 Kako radi (outside the game):

### 1. **Initialization**
```typescript
export function showWildJuiceBubblesExplosion(): void {
  // Dohvaća stage preko window.STATE (ne ovisi o board objektu)
  const windowState = typeof window !== 'undefined' ? (window as any).STATE : null;
  const stage = (windowState && windowState.stage) || (app && app.stage) || null;
  
  // Kreira Container direktno na stage-u
  explosionContainer = new Container();
  explosionContainer.zIndex = 20000; // Iznad svega
  stage.addChild(explosionContainer);
}
```

### 2. **Rendering**
- Bubbles se spawnaju na full-screen (screenW x screenH)
- Koristi `graphicsPool.acquire()` za pooling
- Texture caching (`_cachedBubbleTexture`) za performanse
- FPS monitoring za throttling

### 3. **Cleanup**
- `cleanup()` funkcija uklanja sve bubbles, GSAP tweens, ticker
- Safety timeout (4.4s) za automatski cleanup
- Ne ovisi o board cleanup-u - radi samostalno

## ✅ Prednosti ovog pristupa:
1. **Resilient** - ne puca kada se board mijenja
2. **Modular** - može se pozvati bilo gdje, neovisno o board state-u
3. **Performant** - pooling, texture caching, FPS throttling
4. **Clean** - potpuni cleanup, bez memory leakova

## ⚠️ Potencijalni problemi:
1. **Stage dependency** - ako `window.STATE.stage` nije dostupan, ne radi
2. **Timing** - ako se pozove prije nego što je stage ready, neće raditi
3. **Visibility** - ako je stage hidden, bubbles neće biti vidljivi (ali modul provjerava i forsira visibility)

## 🔧 Preporuke:
- ✅ Modul je dobro dizajniran i sličan board-transition-screen pristupu
- ✅ Pooling i texture caching su implementirani
- ⚠️ Možda dodati retry mehanizam ako stage nije ready
- ⚠️ Provjeriti da li se cleanup poziva na svim board transition točkama
