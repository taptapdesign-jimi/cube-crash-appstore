# 🎬 Board Exit Animation - Technical Specification

**Location:** `src/modules/app-board.js` → `sweetPopOut()`  
**Location:** `src/modules/hud-helpers.js` → `playHudRise()`  
**Trigger:** "Exit" button in "End This Run" bottom sheet → `exitToMenu()` → `animateBoardExit()`  
**Total Duration:** ~500-1000ms for tiles + 800ms for HUD = **~1300-1800ms total**  
**Type:** Exact reverse of board entry animations

---

## 📐 Animation Overview

The board exit animation is the **perfect mirror** of the entry animations. When the user clicks "Exit" in the "End This Run" bottom sheet, both tiles and HUD animate out in reverse order before the game is cleaned up and the homepage slider enters.

**Visual Effect:** Cartoonish "pop-out" where tiles compress slightly, briefly expand, then shrink to zero. HUD rises upward while fading out.

---

## ⏱️ Procedural Sequence

### **1. Board Tiles Exit (`sweetPopOut`)**

**Order:** Reverse of entry order - last spawned tile exits first

**Scale Transformation:** `1.0 → 0.88 → 1.15 → 0.0`

**Easing Sequence:**
1. **Compress** (1.0 → 0.88): `back.in(1.5)` - reverse of `back.out(1.5)`
2. **Expand** (0.88 → 1.15): `power2.in` - reverse of `power2.out`
3. **Shrink** (1.15 → 0.0): `back.in(2)` - reverse of `back.out(2)`

**Duration per Tile:**
- Compress: `~0.08-0.16s` (variable `d3`)
- Expand: `~0.08-0.12s` (variable `d2`)
- Fade: `~0.08-0.12s` (alpha 0)
- Shrink: `~0.10-0.18s` (variable `d1`)
- **Total per tile:** `~0.38-0.55s`

**Stagger/Delay:**
- Random delay: `~20-180ms` per tile
- Creates "pure random stagger" effect
- **Effective total:** `~500-1000ms` (all tiles)

**Technical Details:**
- Uses `GSAP` timeline with procedural delays
- Tiles animated in reverse random order
- Opacity fades to 0 during expansion
- Transform origin: center
- GPU-accelerated via `will-change: transform`

### **2. HUD Rise Animation (`playHudRise`)**

**Trigger:** At 50% of tile exit (via `onHalf` callback)

**Transformation:**
- **Y position:** `y: top` → `y: -top * 2` (rises above screen)
- **Opacity:** `1` → `0` (fades out)

**Easing:** `elastic.in(1, 0.6)` - reverse of `elastic.out(1, 0.6)`

**Duration:** `800ms` (0.8s)

**Technical Details:**
- Animates `HUD_ROOT` (PIXI container)
- Uses GSAP `gsap.to()` for smooth animation
- Hardware accelerated
- State reset: `HUD_ROOT._dropped = false`

---

## 🔄 Synchronization

1. User clicks "Exit" in bottom sheet
2. Bottom sheet animates closed
3. `exitToMenu()` function called
4. **Step 1:** `animateBoardExit()` starts `sweetPopOut` with all tiles
5. **Step 2:** At 50% tile exit, `playHudRise` triggers via `onHalf` callback
6. **Step 3:** All animations complete
7. **Step 4:** `cleanupGame()` destroys PIXI app and clears state
8. **Step 5:** UI transitions to homepage
9. **Step 6:** Homepage slider enters with "Comic Pop-In" animation

**Timeline:**
```
0ms:     [Tiles start exiting] ──────────────────────── 500-1000ms
≈250ms:    [HUD starts rising]     ─────────────────────────── 800ms
≈500ms:     ────────────────────────  [All animations complete]
         └───────────────────────────────────────────────┘
            Cleanup game, show homepage, play entry animation
```

---

## 🎯 Element Transformations

### **Tiles:**
```css
/* Initial → Final */
scale(1.0) → scale(0.88) → scale(1.15) → scale(0.0)
alpha(1) → alpha(0)
```

### **HUD:**
```css
/* Initial → Final */
y: top → y: -top * 2
alpha: 1 → 0
```

---

## 🔧 Implementation Details

### **Entry Point:**
`src/main.ts` → `exitToMenu()` → `animateBoardExit()`

### **Orchestration:**
```typescript
async function animateBoardExit(){
  const tilesToAnimate = STATE.tiles || [];
  
  if (tilesToAnimate.length === 0) {
    return Promise.resolve();
  }
  
  return sweetPopOut(tilesToAnimate, {
    onHalf: () => {
      HUD.playHudRise?.({});
    }
  });
}
```

### **Tiles Animation:**
```typescript
export function sweetPopOut(listTiles, opts = {}){
  // Reverse order
  for (let i = 0; i < Math.floor(list.length / 2); i++) {
    const j = list.length - 1 - i;
    [list[i], list[j]] = [list[j], list[i]];
  }
  
  // Animate with reverse easing
  gsap.timeline({ delay: exitDel })
    .to(t.scale, { x: 0.88, y: 0.88, duration: d3, ease: 'back.in(1.5)' }, 0)
    .to(t.scale, { x: amp, y: amp, duration: d2, ease: 'power2.in' }, d3)
    .to(t, { alpha: 0, duration: d1 * 0.68, ease: 'power2.in' }, d3)
    .to(t.scale, { x: 0.0, y: 0.0, duration: d1, ease: 'back.in(2)' }, d3 + d2);
}
```

### **HUD Animation:**
```javascript
export function playHudRise({ duration = 0.8 } = {}){
  const top = HUD_ROOT._dropTop ?? HUD_ROOT.y ?? 0;
  
  gsap.to(HUD_ROOT, {
    alpha: 0,
    y: -top * 2,
    duration: duration,
    ease: 'elastic.in(1, 0.6)',
    onComplete: () => { 
      HUD_ROOT._dropped = false; 
      HUD_ROOT.y = -top * 2; 
    }
  });
}
```

---

## 🔍 Why These Values?

**Duration (`0.38-0.55s` per tile):**
- Fast enough to feel snappy
- Slow enough to see satisfying bounce
- Industry standard for UI animations

**Stagger (`20-180ms`):**
- Creates cascading effect
- Not too slow (would feel sluggish)
- Not too fast (would merge into single effect)

**Easing (`back.in`, `power2.in`):**
- Perfect reverse of entry animations
- Cartoonish feel matches game aesthetic
- GPU-accelerated via GSAP

**HUD timing (`50%`, `800ms`):**
- Appears halfway through tile exit
- Creates synchronized, cohesive transition
- Matches entry animation duration

---

## 📊 Related Files

- `src/modules/app-board.js`: Contains `sweetPopOut` tile animation
- `src/modules/hud-helpers.js`: Contains `playHudRise` HUD animation
- `src/modules/app-core.ts`: Contains `animateBoardExit` orchestrator
- `src/main.ts`: Contains `exitToMenu` entry point
- `src/modules/end-run-modal.ts`: Contains "End This Run" bottom sheet
- `EXIT_ANIMATION_SPEC.md`: Slider exit animation spec
- `BOARD_ANIMATIONS_SPEC.md`: Entry animations spec

---

## ✅ Success Criteria

The exit animation is successful when:
1. ✅ All tiles pop-out in reverse random order
2. ✅ HUD rises and fades synchronously with tile exit
3. ✅ No visual glitches or stuttering
4. ✅ Clean transition to homepage slider
5. ✅ Game state properly cleaned up after animations
6. ✅ Entry animation plays correctly on next game start

---

## 🎨 Visual Comparison

**Entry (Homepage → Game):**
- Slider elements exit with comic pop-out
- Board tiles pop-in with random stagger
- HUD drops down

**Exit (Game → Homepage):**
- Board tiles pop-out with reverse stagger
- HUD rises up
- Slider elements enter with comic pop-in

**Perfect Symmetry:** Entry and exit are exact mirrors of each other, creating a cohesive, polished user experience.
