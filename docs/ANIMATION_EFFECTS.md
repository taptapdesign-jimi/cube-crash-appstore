# Animation Effects Guide

## What Animations Are Currently in the Game

### 1. **Spawn Bounce** (Tile Entry)
**What it does:** When tiles appear on the board
```typescript
gsap.to(scale, { x: 1.08, duration: 0.16, ease: 'back.out(2.1)' })  // Bounce up
     .to(scale, { x: 0.96, duration: 0.10, ease: 'power2.inOut' })  // Compress down
     .to(scale, { x: 1.02, duration: 0.10, ease: 'power2.out' })    // Rebound up
     .to(scale, { x: 1.00, duration: 0.12, ease: 'back.out(2)' });  // Settle
```
**Ease functions:** `back.out`, `power2.inOut`, `power2.out`

### 2. **Wild Impact Effect** (Wild Cube Merge)
**What it does:** Dramatic bounce when wild cube merges
```typescript
gsap.to(scale, { x: 1.22, y: 0.88, duration: 0.08 })  // Squash down
     .to(scale, { x: 1.15, y: 1.15, duration: 0.20, ease: 'back.out(3.0)' })  // Big bounce
     .to(scale, { x: 0.96, y: 1.04, duration: 0.15 }) // Settle wiggle
     .to(scale, { x: 1, y:磚 1, duration: 0.22, ease: 'elastic.out(1, 0.7)' });  // Final elastic
```
**Ease functions:** `back.out`, `elastic.out`, `sine.out`, `sine.inOut`

### 3. **Cartoonish Bounce** (UI Elements)
**What it does:** Slider elements bounce in
```typescript
css: transition: 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)'
```
**Ease function:** `cubic-bezier(0.68, -0.6, 0.32, 1.6)` - Extra bouncy!

### 4. **Screen Shake** (Merge-6 Impact)
**What it does:** Shakes the camera when big merge happens
```typescript
screenShake(app, { strength: 24, duration: 0.32, steps: 18, ease: 'power2.out' })
```

### 5. **Wild Idle Animation** (Wild Cube Pulsing)
**What it does:** Gentle pulsing on wild cubes
```typescript
gsap.to(tile.rotation, {
  rotation: wiggle * dir,
  duration: 0.10,
  ease: 'power2.out'
}).to(tile.rotation, {
  rotation: -wiggle * 0.6 * dir,
  duration: 0.12,
  ease: 'power2.out'
}).to(tile.rotation, {
  rotation: 0,
  duration: 0.14,
  ease: 'power2.out'
});
```

## Online Resources for Animation Examples

### GSAP Documentation
- **Easing Functions:** https://greensock.com/docs/v3/Eases
- **Playground:** https://greensock.com/stagger/ (try different eases!)
- **Timeline Tutorial:** https://greensock.com/docs/v3/GSAP/gsap.timeline()

### CSS Animation Examples
- **CSS Easing Functions:** https://easings.net/ (visual examples of all easing curves)
- **Animation Principles:** https://codepen.io/collection/nRZadj (interactive demos)

### Game Animation Inspiration
- **Toon Boom Animations:** https://www.toonboom.com/ (professional 2D animations)
- **Lottie Animations:** https://lottiefiles.com/ (smooth, lightweight animations)

## Easy Animations You Can Add (With Examples)

### 1. **Shake Animation** (On Error/Blocked Merge)
```typescript
gsap.to(tile, {
  x: tile.x + (Math.random() - 0.5) * 8,
  duration: 0.08,
  repeat: 5,
  yoyo: true,
  ease: 'power2.inOut'
});
```

### 2. **Pulse Effect** (On Hover)
```typescript
gsap.to(tile.scale, {
  x: 1.1,
  y: 1.1,
  duration: 0.3,
  yoyo: true,
  repeat: -1,
  ease: 'power1.inOut'
});
```

### 3. **Wiggle** (On Drag Start)
```typescript
gsap.to(tile.rotation, {
  rotation: 0.1,
  duration: 0.05,
  repeat: 3,
  yoyo: true,
  ease: 'power1.inOut'
});
```

### 4. **Fade Out** (On Remove)
```typescript
gsap.to(tile, {
  alpha: 0,
  scale: { x: 0.8, y: 0.8 },
  duration: 0.3,
  ease: 'power2.out'
});
```

## Best Easing Functions for Different Effects

| Effect | Easing Function | Why |
|--------|----------------|-----|
| **Bouncy Entry** | `back.out(2.1)` | Overshoots then settles |
| **Smooth Settle** | `elastic.out(1, 0.7)` | Multiple tiny bounces |
| **Fast Impact** | `power2.out` | Quick and snappy |
| **Slow Fade** | `power1.inOut` | Gentle and smooth |
| **Cartoon Pop** | `cubic-bezier(0.68, -0.6, 0.32, 1.6)` | Extra bouncy! |

## Performance Tips

- **Use `willChange: 'transform'`** for elements you'll animate
- **Prefer `transform` over `position`** (GPU accelerated)
- **Kill old animations** before starting new ones
- **Batch animations** with `gsap.timeline()` instead of multiple `gsap.to()`

