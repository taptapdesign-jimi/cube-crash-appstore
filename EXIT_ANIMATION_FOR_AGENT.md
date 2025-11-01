# 🎬 Slide Exit Animation - Quick Reference for AI Agent

## TL;DR - Core Animation Behavior

**CRITICAL:** Elements **GROW slightly ABOVE 1.0** before shrinking to 0. This is a "pop-out-reverse" comic effect, NOT a simple shrink.

---

## Visual Behavior Breakdown

### The Animation Sequence:

1. **Element starts** at `scale(1.0)` 
2. **Briefly GROWS** to maybe `scale(1.05-1.10)` (pop-out effect)
3. **Shrinks downward** through `scale(1.0)`
4. **Overshoots below** 0 briefly
5. **Settles** at `scale(0)`

**Why?** The `cubic-bezier(0.68, **-0.6**, 0.32, 1.6)` has a **negative middle value** which causes the upward "pop" before shrinking.

---

## Technical Specifications

### Easing Function:
```css
cubic-bezier(0.68, -0.6, 0.32, 1.6)
```

### Breakdown:
- `0.68` = starts at 68% speed (fast out)
- **`-0.6`** = ⚠️ **NEGATIVE** - causes initial GROWTH above 1.0
- `0.32` = eases back to 32% 
- `1.6` = overshoots below 0 by 60% (bounce back up slightly)

---

## Procedural Timing (5 Elements in Sequence)

| Element | Delay | Duration | Total Time |
|---------|-------|----------|------------|
| Hero Image | `0ms` | `650ms` | `650ms` |
| CTA Button | `30ms` | `650ms` | `680ms` |
| Slide Text | `60ms` | `650ms` | `710ms` |
| Home Logo | `90ms` | `650ms` | `740ms` |
| Navigation | `120ms` | `650ms` | `770ms` |

**Total:** `770ms` (0.77 seconds)

---

## CSS Implementation

### Exit Class:
```css
.animate-exit {
  will-change: transform !important;
  transition: transform 0.65s cubic-bezier(0.68, -0.6, 0.32, 1.6) !important;
  transform: scale(0) !important;
}
```

### Special Text Case:
```css
.slide-text.animate-exit {
  transform: translateY(-28px) scale(0) !important;
}
```
Maintains existing vertical offset during scale.

---

## Key Points for AI Agent

### ✅ What This Animation DOES:
- Elements **pop out** (grow) before shrinking
- Sequential timing (30ms increments)
- GPU-accelerated (smooth 60fps)
- No opacity fade (pure scale transformation)
- Prevents duplicate runs (guard system)
- Total duration: 770ms

### ❌ What This Animation Does NOT Do:
- Simple shrink (scale 1 → 0 linearly)
- Simultaneous element animation
- Opacity fade
- Position changes (except text translateY offset)

---

## Code Locations

**Animation Logic:**
- `src/utils/animations.ts` → `animateSliderExit()`
- `src/utils/animations.ts` → `cartoonishBounce()` helper

**CSS Styles:**
- `src/style.css` → `.animate-exit` class (line 867)
- `src/style.css` → `.slide-text.animate-exit` class (line 883)

**Trigger Points:**
- `src/main.ts` → line 328
- `src/modules/ui-manager.ts` → line 553

---

## Testing Checklist

✅ All 5 elements animate sequentially  
✅ Each element **grows** before shrinking (visible pop)  
✅ No duplicate animations on rapid clicks  
✅ 60fps smooth on modern devices  
✅ Works on iPhone, iPad, Desktop  
✅ Total sequence completes in 770ms  

---

## Summary

**Animation Type:** Cartoonish "pop-out-reverse"  
**Key Visual:** Elements GROW slightly before shrinking to 0  
**Duration:** 770ms total  
**Elements:** 5 (sequential, 30ms apart)  
**Easing:** `cubic-bezier(0.68, -0.6, 0.32, 1.6)` with negative middle value  
**Transform:** `scale(0)` with overshoot bounce  
**GPU:** Hardware accelerated via `will-change: transform`  

**Comic Effect:** YES ✅

