# 🎮 Board Animations - Technical Specification

**Version:** v5.0  
**Updated:** 2025-01-XX

---

## 📋 Overview

CubeCrash uses two distinct animation systems for game initialization:
1. **Tile Board Spawn** - `sweetPopIn()` - random staggered pop-in
2. **HUD Drop** - `playHudDrop()` - elastic downward drop

Both trigger **simultaneously** when game starts, creating cohesive orchestrated entrance.

---

## 🎲 1. TILE BOARD SPAWN ANIMATION (`sweetPopIn`)

**Location:** `src/modules/app-board.js` → `sweetPopIn()`  
**Trigger:** Game start (new or continue)  
**Type:** Procedural random stagger + scale bounce  

### **Animation Sequence:**

Each tile animates **independently** in full random order:

```
Start: scale(0), alpha(0)
↓
[Delay: 0–180ms random + stagger]
↓
Step 1: Scale OUT to 1.08–1.15 + fade in (alpha 0→1)
       Duration: 0.18–0.27s (variable per tile)
       Easing: 'back.out(2.0)'
↓
Step 2: Scale COMPRESS to 0.88
       Duration: 0.12–0.16s
       Easing: 'power2.out'
↓
Step 3: Scale SETTLE to 1.0
       Duration: 0.10–0.12s
       Easing: 'back.out(1.5)'
```

### **Per-Tile Timing:**

| Parameter | Range | Description |
|-----------|-------|-------------|
| **Delay** | `0ms - 180ms` | Random start offset per tile |
| **Stagger** | `20-30ms` per tile index | Procedural timing |
| **Burst** | `-160ms` (22% chance) | Early spawn for select tiles |
| **Blow** | `0.10-0.27s` | Scale to max (1.08-1.15) |
| **Compress** | `0.08-0.16s` | Scale down to 0.88 |
| **Settle** | `0.08-0.12s` | Scale to 1.0 final |
| **Total** | `~0.38s - 0.55s` | Per tile |

**Total Board Population:** `500ms - 1000ms` (depends on tile count)

### **Technical Details:**

**Randomization:**
- Full shuffle of tile list (Fisher-Yates)
- Each tile gets unique timing variation
- 22% tiles get "burst" early spawn

**Scale Curve:**
- **Max amplitude:** `1.08 + random(0.07)` → `1.08-1.15`
- **Compress target:** `0.88`
- **Final:** `1.0`

**Easing Functions:**
```javascript
Step 1: 'back.out(2.0)'  // Overshoot outward
Step 2: 'power2.out'      // Smooth compress
Step 3: 'back.out(1.5)'   // Gentle settle
```

**Halfway Trigger:** `onHalf()` fires at **50% tile completion** to sync with HUD drop

---

## 📊 2. HUD DROP ANIMATION (`playHudDrop`)

**Location:** `src/modules/hud-helpers.js` → `playHudDrop()`  
**Trigger:** `sweetPopIn` halfway callback (50% tiles populated)  
**Type:** Elastic downward Y-axis drop  

### **Animation Sequence:**

```
Start: HUD hidden above screen, alpha(0)
↓
[Delay: ~0ms - fires when 50% tiles spawned]
↓
Drop: translateY(-top) → translateY(0)
      Duration: 800ms (0.8s)
      Easing: 'elastic.out(1, 0.6)'
      Alpha: 0 → 1
↓
Settle: Final position at y=top
```

### **Timing:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Delay** | `~250-500ms` | Based on sweetPopIn 50% completion |
| **Duration** | `800ms` | Fixed |
| **Easing** | `elastic.out(1, 0.6)` | Elastic bounce with 0.6 damping |
| **Alpha fade** | `800ms` | Simultaneous with drop |

**Total:** `~1050ms - 1300ms` from game start

### **Technical Details:**

**Elastic Parameters:**
- **Overshoot:** Yes (elastic bounce)
- **Damping:** 0.6 (moderate bounce)
- **Direction:** Downward only (Y-axis)

**GSAP Implementation:**
```javascript
gsap.to(HUD_ROOT, {
  alpha: 1,              // Fade in
  y: top,                // Drop to position
  duration: 0.8,         // 800ms
  ease: 'elastic.out(1, 0.6)',
  onComplete: () => { 
    HUD_ROOT._dropped = true;
    HUD_ROOT.y = top;
  }
});
```

---

## 🎬 Orchestration

### **Timeline:**

```
0ms:    Game starts
        ↓
        sweetPopIn(tiles) → random stagger delays (0-180ms)
        ↓
0-180ms: Tiles start popping in (random order)
        ↓
250-500ms: ~50% tiles spawned → onHalf() fires
        ↓
250-500ms: playHudDrop() triggered
        ↓
500-1000ms: Remaining tiles finish pop-in
        ↓
1050-1300ms: HUD drop completes
        ↓
RESULT: All visible and ready
```

### **Synchronization:**

**Critical Sync Point:** `onHalf()` callback
- Fires when 50% of tiles are visually spawned
- Triggers HUD drop immediately
- Creates perceived "halfway split" effect

**Visual Effect:**
- Board populates from bottom
- HUD drops from top
- Meet in middle for balanced entrance

---

## 🔍 Animation Properties

### **Tile Spawn (`sweetPopIn`)**

| Property | Start | Peak | Compress | Final |
|----------|-------|------|----------|-------|
| **Scale** | 0 | 1.08-1.15 | 0.88 | 1.0 |
| **Alpha** | 0 | 1 | 1 | 1 |
| **Duration** | - | 0.10-0.27s | 0.08-0.16s | 0.08-0.12s |
| **Easing** | - | back.out(2.0) | power2.out | back.out(1.5) |

### **HUD Drop (`playHudDrop`)**

| Property | Start | Final |
|----------|-------|-------|
| **Y Position** | -top (above) | 0 (top) |
| **Alpha** | 0 | 1 |
| **Duration** | - | 800ms |
| **Easing** | - | elastic.out(1, 0.6) |

---

## 📐 Why These Values?

### **Tile Spawn:**

**Random Stagger:**
- **Why:** No grid pattern feels organic
- **Range:** 20-30ms maintains perceived speed
- **Jitter:** 180ms wildness for playful chaos

**Scale Overshoot:**
- **Why:** "Pop" effect = engaging feedback
- **Peak:** 1.15 max prevents over-animation
- **Compress:** 0.88 creates satisfying "bounce back"

**Duration Variations:**
- **Why:** Prevents "robot dance" feel
- **Range:** ±20% creates organic timing

### **HUD Drop:**

**800ms Duration:**
- **Fast enough:** Doesn't lag behind tiles
- **Slow enough:** Visible, satisfying drop

**Elastic Bounce:**
- **Why:** Premium polish feeling
- **Damping:** 0.6 balanced (not too springy, not too damped)
- **One bounce:** Subtle, not distracting

**50% Trigger:**
- **Why:** Perfect middle ground
- **Too early:** HUD drops before board visible
- **Too late:** Feels disconnected

---

## 🎯 Code Locations

**Tile Spawn:**
- Function: `src/modules/app-board.js` → `sweetPopIn()` (line 110)
- Trigger: `src/modules/app-core.ts` → `startLevel()` (line 1066)
- Import: `import * as FLOW from './app-board.js'`

**HUD Drop:**
- Function: `src/modules/hud-helpers.js` → `playHudDrop()` (line 499)
- Trigger: `sweetPopIn` `onHalf()` callback
- Import: `import * as HUD from './hud-helpers.js'`

---

## 🧪 Testing

### **Expected Behavior:**
✅ Tiles spawn in random order (not grid pattern)  
✅ Each tile completes in ~0.38-0.55s  
✅ HUD drops midway (~250-500ms)  
✅ HUD completes in 800ms  
✅ No visual glitches or jumps  
✅ Smooth 60fps on all devices  

### **Edge Cases:**
✅ Empty board (no tiles) → HUD still drops  
✅ Single tile → still gets full bounce  
✅ Rapid game start/restart → animations cancel cleanly  
✅ Low-end devices → acceptable performance  

---

## 📊 Performance

**Frame Budget:**
- Target: 60fps (16.67ms per frame)
- Tile spawn: ~200-300 draw calls during animation
- HUD drop: 2 draw calls (before/after)
- GPU: Hardware accelerated via GSAP transforms

**Optimization:**
- GPU compositing via GSAP `force3D`
- Minimal repaint (transform-only)
- No layout thrashing
- Single z-index sort per tile

---

## 🎨 Visual Perception

**Tile Spawn:**
- **Feel:** Playful, organic, "bouncy"
- **Pacing:** Fast but readable
- **Feedback:** Each tile "lands" with satisfying pop

**HUD Drop:**
- **Feel:** Professional, polished
- **Pacing:** Deliberate, not rushed
- **Feedback:** "Game is ready" signal

**Combined:**
- **Result:** Cohesive, energetic entrance
- **Brand:** Matches "comic/cartoon" aesthetic
- **Polish:** Exceeds casual game standard

---

## 📝 Summary

| Animation | Type | Duration | Trigger | Easing |
|-----------|------|----------|---------|--------|
| **Tile Spawn** | Random stagger | ~500-1000ms | Game start | back.out(2.0) → power2.out → back.out(1.5) |
| **HUD Drop** | Elastic drop | 800ms | 50% tiles | elastic.out(1, 0.6) |
| **Total** | Combined | ~1300ms | - | - |

**Design Philosophy:**
- **Organic:** Randomization prevents mechanical feel
- **Responsive:** Quick enough for mobile attention spans
- **Polished:** Overshoot/compress adds premium touch
- **Cohesive:** Both animations complement, don't conflict

---

**Last Updated:** v5.0

