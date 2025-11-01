# 🎬 Slide 1 Exit Animation - Technical Specification

**Location:** `src/utils/animations.ts` → `animateSliderExit()`  
**Trigger:** CTA button click on any slider slide  
**Total Duration:** `770ms` (120ms delays + 650ms animation)  
**Type:** Procedural, cartoonish bounce-to-scale

---

## 📐 Animation Overview

### **Visual Effect:**
Cartoonish "pop-in-reverse" where each UI element bounces up slightly before shrinking to scale 0. No opacity fade - pure scale transformation for snappy, playful feel.

### **Easing Function:**
```css
cubic-bezier(0.68, -0.6, 0.32, 1.6)
```

**Technical Breakdown:**
- `0.68` = starts at 68% speed (fast out)
- `-0.6` = **negative value** causes initial GROWTH above 1.0
- `0.32` = eases back to 32% at peak
- `1.6` = overshoots below 0 by 60% before settling

This creates a **cartoonish pop-out-reverse** where elements briefly GROW larger before shrinking to 0.

---

## ⏱️ Procedural Sequence

The animation is **sequential**, not simultaneous. Each element starts after a specific delay to create a cascading effect.

### **Timeline:**

| Step | Element | Delay | Start Time | Duration | End Time | Cumulative |
|------|---------|-------|------------|----------|----------|------------|
| 1 | Hero Image | `0ms` | `0ms` | `650ms` | `650ms` | 0.0s |
| 2 | CTA Button | `30ms` | `30ms` | `650ms` | `680ms` | 0.03s |
| 3 | Slide Text | `60ms` | `60ms` | `650ms` | `710ms` | 0.06s |
| 4 | Home Logo | `90ms` | `90ms` | `650ms` | `740ms` | 0.09s |
| 5 | Navigation | `120ms` | `120ms` | `650ms` | `770ms` | 0.12s |

**Sequence Flow:**
```
0ms:    [Hero starts] ───────────────────────── 650ms
30ms:    [CTA starts]  ───────────────────────── 680ms
60ms:     [Text starts]  ─────────────────────── 710ms
90ms:      [Logo starts]  ────────────────────── 740ms
120ms:        [Nav starts] ───────────────────── 770ms
```

---

## 🎯 Element Transformations

### **Standard Elements** (Hero, CTA, Logo, Nav):
```css
transform: scale(0);
```
- Shrinks from `1.0` to `0.0`
- No position change
- No opacity change (pure scale)

### **Slide Text** (Special Case):
```css
transform: translateY(-28px) scale(0);
```
- Shrinks from `1.0` to `0.0` **AND**
- Moves up by `-28px` (accounts for pre-existing offset)
- Maintains vertical position during scale

---

## 🔧 Implementation Details

### **1. Guard System**
```typescript
let isAnimatingExit = false;

if (isAnimatingExit) {
  logger.warn('⚠️ Exit animation already in progress, ignoring duplicate call');
  return;
}
```
Prevents duplicate animations if user clicks multiple times rapidly.

### **2. Element Discovery**
```typescript
const activeSlide = document.querySelector('.slider-slide.active');
const heroContainer = activeSlide.querySelector('.hero-container');
const slideButton = activeSlide.querySelector('.slide-button');
const slideText = activeSlide.querySelector('.slide-text');
const homeLogo = document.querySelector('#home-logo');
const independentNav = document.getElementById('independent-nav');
```

Only animates elements from the **currently active slide** (slide with `.active` class).

### **3. Procedural Application**
```typescript
const cartoonishBounce = (element: HTMLElement, delay: number) => {
  const timeout = setTimeout(() => {
    element.classList.remove('animate-exit', 'animate-enter', ...);
    void element.offsetHeight; // Force reflow
    element.classList.add('animate-exit');
  }, delay);
  activeTimeouts.add(timeout);
};
```

Each element:
1. **Removes** existing animation classes
2. **Forces reflow** (critical for browser to register state change)
3. **Adds** `animate-exit` class
4. **CSS transition** handles the rest

### **4. Cleanup**
```typescript
const timeout = setTimeout(() => {
  isAnimatingExit = false;
  logger.info('✅ Exit animation guard reset');
}, 770); // Total animation time
```

After `770ms`, the guard is reset and animation can run again.

---

## 📊 CSS Properties

### **Exit Class:**
```css
.animate-exit {
  will-change: transform !important;           /* GPU hint */
  transition: transform 0.65s                  /* Duration */
               cubic-bezier(0.68, -0.6, 0.32, 1.6) !important; /* Easing */
  transform: scale(0) !important;              /* Final state */
}
```

### **Special Text Handling:**
```css
.slide-text.animate-exit {
  transform: translateY(-28px) scale(0) !important;
}
```

### **GPU Optimization:**
`will-change: transform` tells the browser to composite the element on a separate layer, enabling:
- Hardware acceleration
- Smooth 60fps animation
- No layout thrashing
- Reduced repaints

---

## 🎨 Visual Behavior

### **Perception:**
1. **Hero Image** pops out first (most prominent)
2. **CTA Button** follows immediately (user interaction point)
3. **Text** trails behind (contextual info)
4. **Logo** adds branding before disappearing
5. **Navigation** stays longest (orientation helper)

### **Bounce Effect:**
The `cubic-bezier(0.68, -0.6, 0.32, 1.6)` with **negative middle value** causes elements to:
1. **Start** at scale(1)
2. **Briefly GROW** slightly above 1.0 (pop-up effect)
3. **Shrink** downward through 1.0
4. **Overshoot** below 0 briefly
5. **Settle** at scale(0)

This mimics a "POP-OUT-REVERSE" effect where elements expand first before disappearing - classic cartoon animation.

---

## 🔍 Why These Values?

### **Duration: `650ms`**
- **Fast enough:** Doesn't feel sluggish
- **Slow enough:** Visible, satisfying bounce
- **Industry standard:** Matches Material Design (600ms) + small buffer

### **Delay: `30ms` increments**
- **Too short (10ms):** Elements merge, no cascading effect
- **Too long (100ms):** Feels sluggish, disconnected
- **30ms sweet spot:** Perceived as sequential but fast

### **Easing: `cubic-bezier(0.68, -0.6, 0.32, 1.6)`**
- **Tuned for bounce:** Negative middle value creates overshoot
- **Cartoonish feel:** Playful, not mechanical
- **Performance:** CSS transitions are GPU-accelerated

---

## 🧪 Testing

### **Expected Behavior:**
✅ All 5 elements animate sequentially  
✅ Each element completes in `650ms`  
✅ Total sequence: `770ms`  
✅ No duplicate animations on rapid clicks  
✅ Smooth 60fps on modern devices  
✅ Works on all screen sizes (responsive)

### **Edge Cases:**
✅ Missing elements logged but don't crash  
✅ Legacy fallback if no `.active` slide found  
✅ Timeout cleanup prevents memory leaks  
✅ Force reflow ensures browser registers state

---

## 🎯 Design Philosophy

**Why "Cartoonish Bounce"?**
- **Playful:** Matches game's casual puzzle theme
- **Engaging:** Visual feedback rewards user action
- **Professional:** Subtle overshoot shows polish
- **Fast:** Doesn't slow down game start

**Why Sequential?**
- **Clear hierarchy:** User sees order (hero → CTA → context)
- **Reduces cognitive load:** Don't animate everything at once
- **Creates anticipation:** Each element disappearing builds momentum

**Why No Opacity?**
- **Snappy feel:** Pure scale is faster perceived speed
- **Performance:** Fewer compositing layers
- **Clarity:** Elements either exist or don't (binary)

---

## 📝 Summary

| Attribute | Value |
|-----------|-------|
| **Total Duration** | `770ms` |
| **Element Count** | 5 elements |
| **Delay Increment** | `30ms` |
| **Animation Duration** | `650ms` |
| **Easing** | `cubic-bezier(0.68, -0.6, 0.32, 1.6)` |
| **Type** | Procedural, sequential |
| **Transform** | `scale(0)` (text: `translateY(-28px) scale(0)`) |
| **Opacity** | None (pure scale) |
| **GPU** | Hardware accelerated |
| **Guard** | Prevents duplicate runs |
| **Cleanup** | Auto-timeout after `770ms` |

---

**Code Locations:**
- Animation logic: `src/utils/animations.ts` (lines 95-240)
- CSS styles: `src/style.css` (lines 867-937)
- Trigger points: `src/main.ts` (line 328), `src/modules/ui-manager.ts` (line 553)

**Last Updated:** v5.0

