# TNT Animation – Sprite enter & exit (bez slova)

Samo sprite (img) animacije: gdje se stvaraju, kako i kako izlaze.

---

## 1. Gdje se stvaraju – DOM struktura

```
document.body
  └── overlay (#cc-tnt-animation-overlay)
        └── framesContainer
              └── wrapper (za svaki frame)
                    └── img (frameEl)
```

**Overlay:**
```css
position: fixed;
left: 0; top: 0;
width: 100%; height: 100%;
z-index: 99998;
pointer-events: none;
background: transparent;
```

**Frames container:**
```css
position: absolute;
left: 0; top: 0;
width: 100%; height: 100%;
pointer-events: none;
```

**Wrapper (jedan po frameu):**
```css
position: absolute;
left: 50%;
top: 50%;
transform: translate(-50%, -50%);  /* centrira u viewport */
display: flex;
align-items: center;
justify-content: center;
```

**img (sprite):**
```css
display: block;
max-width: 95vw;
max-height: 95vh;
object-fit: contain;
opacity: 0;                        /* start invisibilno */
transform-origin: center center;
will-change: transform, opacity;
filter: brightness(1.02);
```

---

## 2. Kako se stvaraju

```javascript
const frameEl = document.createElement('img');
frameEl.src = FRAME_URLS[i];
frameEl.alt = '';
// inline style iznad
wrapper.appendChild(frameEl);
framesContainer.appendChild(wrapper);
overlay.appendChild(framesContainer);
document.body.appendChild(overlay);
```

Svi frameovi su jedan preko drugog u centru (left 50%, top 50%, translate -50% -50%). Prikazuje se samo jedan po jedan jer su svi `opacity: 0` na startu – GSAP ih uključuje/isključuje tijekom animacije.

---

## 3. Ulaz (enter)

**Inicijalno stanje:**
```javascript
gsap.set(frameEl, {
  x: 0, y: 0,
  scaleX: 0, scaleY: 0,
  opacity: 0,
  rotation: (Math.random() - 0.5) * 20
});
```

**Random varijable:**
- `randomSize` = `1 + Math.random() * 0.52` (1.0–1.52)
- `randomRotation` = `(Math.random() - 0.5) * 20` (deg)
- `VERTICAL_STRETCH` = 1.4

**Korak 1 – bounce in (0.24s):**
```javascript
tl.to(frameEl, {
  opacity: 1,
  scaleX: randomSize * 1.2,
  scaleY: randomSize * 1.2 * 1.4,
  duration: 0.24,
  ease: 'back.out(2.0)'
});
```

**Korak 2 – settle (0.1s):**
```javascript
tl.to(frameEl, {
  scaleX: randomSize,
  scaleY: randomSize * 1.4,
  duration: 0.1,
  ease: 'power2.out'
}, '>0');
```

**Korak 3 – idle bounce (traje do izlaza):**
```javascript
gsap.to(frameEl, {
  scaleX: randomSize * (1.02 + Math.random() * 0.06),
  scaleY: randomSize * 1.4 * (1.02 + Math.random() * 0.06),
  y: (Math.random() - 0.5) * 4,
  duration: 0.4,
  ease: 'elastic.inOut(1, 0.25)',
  repeat: -1,
  yoyo: true
});
```

**Stagger:** `0.07 + i * 0.04` – svaki frame 40ms kasnije.

---

## 4. Izlaz (exit)

**Korak 1 – bounce out (0.13s):**
```javascript
gsap.to(frameEl, {
  scaleX: randomSize * 1.2,
  scaleY: randomSize * 1.2 * 1.4,
  z: 30,
  duration: 0.13,
  ease: 'power2.out',
  onComplete: () => { /* korak 2 */ }
});
```

**Korak 2 – fade & collapse (0.17s):**
```javascript
gsap.to(frameEl, {
  opacity: 0,
  scaleX: 0,
  scaleY: 0,
  z: -100,
  duration: 0.17,
  ease: 'back.in(2.0)'
});
```

**Stagger:** `i * 0.04` – između frameova.

---

## 5. Konstante

```javascript
const ENTER_BOUNCE_SCALE = 1.2;
const VERTICAL_STRETCH = 1.4;
const ENTER_DURATION = 0.24;
const SETTLE_DURATION = 0.1;
const EXIT_BOUNCE_SCALE = 1.2;
const EXIT_BOUNCE_DURATION = 0.13;
const EXIT_FADE_DURATION = 0.17;
const SPRITE_EXIT_STAGGER = 0.04;
```

---

## 6. Sažetak

| Faza | Trajanje | Easing | Što se mijenja |
|------|----------|--------|----------------|
| Enter 1 | 0.24s | back.out(2.0) | opacity 0→1, scale 0→1.2× |
| Enter 2 | 0.1s | power2.out | scale→1.0 |
| Enter 3 | ∞ | elastic.inOut | idle bounce |
| Exit 1 | 0.13s | power2.out | scale→1.2, z:30 |
| Exit 2 | 0.17s | back.in(2.0) | opacity→0, scale→0, z:-100 |
