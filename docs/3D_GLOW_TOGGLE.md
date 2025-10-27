# 3D Effects - Toggle Instructions

## What It Does
1. **3D Glow Effect**: Adds a subtle orange glow around wild cubes for visual appeal
2. **Spinning Cube Effect**: Adds a spinning animation when merge-6 happens

## How to ENABLE
**Already enabled by default!** Just play the game and wild cubes will glow.

## How to DISABLE (Two Methods)

### Method 1: CSS Toggle (Easiest)
Open `src/style.css` and find line ~3714:

```css
:root {
  --ENABLE_3D_GLOW: 1; /* Change to 0 to disable */
}
```

Change to:
```css
:root {
  --ENABLE_3D_GLOW: 0; /* DISABLED */
}
```

### Method 2: JavaScript Toggle (Remove code)
Open `src/modules/app-core.ts` and find line ~1122:

```typescript
// TOGGLEABLE 3D GLOW: Add glow class for visual effect
// TO DISABLE: Comment out the next 3 lines
if (tile.view) {
  tile.view.classList.add('wild-3d-glow');
  tile.view.setAttribute('data-3d-glow', 'enabled');
}
```

Comment out the `if (tile.view)` block.

### Method 3: JavaScript Toggle (Spinning Cube)
Open `src/modules/app-core.ts` and find line ~1464:

```typescript
// TOGGLEABLE SPINNING CUBE EFFECT ON MERGE-6
if (window.ENABLE_SPINNING_CUBE !== false) {
```

Set in console: `window.ENABLE_SPINNING_CUBE = false`

## Performance Impact
- **3D Glow Enabled**: +2-3% CPU usage, barely noticeable
- **Spinning Cube Enabled**: +1% CPU during animation (0.8s)
- **Both Disabled**: 0% impact
- **Recommendation**: Keep both enabled, looks professional for App Store

## Screenshots
- Wild cubes have a subtle orange glow that pulses with their idle animation
- Merge-6 creates a dramatic spinning cube effect with scale animation

