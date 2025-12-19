# X Button & Score Touch Area Problem - Detailed Description

## Problem Summary
X button (red rectangle in top-left corner) and Score touch area (red rectangle on score area) work **only once** after opening/closing the End Run modal. After the first close, clicking them again does nothing - no logs appear, event handlers don't fire.

## Current Behavior

### First Time (WORKS):
1. User clicks X button → `🎯 RED RECTANGLE CLICKED` appears in console
2. End Run modal opens successfully
3. User closes modal (drag down or outside click)
4. User clicks X button again → `🎯 RED RECTANGLE CLICKED` appears → modal opens ✅

### Second Time (BROKEN):
1. User closes modal again
2. User clicks X button → **NO LOGS** → **NOTHING HAPPENS** ❌
3. Event handler doesn't fire at all

## Technical Details

### Files Involved:
- `src/modules/end-run-modal.ts` - Modal show/hide logic
- `src/modules/hud-helpers.js` - X button and score touch area creation
- `src/modules/score-bottom-sheet.ts` - Score bottom sheet logic

### X Button Setup (hud-helpers.js):
```javascript
// X button is a PIXI Container with:
// - debugBg: Red Graphics rectangle (zIndex: 1000, eventMode: 'static', interactive: true)
// - Event handler: debugBg.on('pointerdown', ...) calls window.showEndRunModalFromGame()
```

### Current Freeze/Unfreeze Logic:

**When Modal Opens (showEndRunModal):**
```typescript
// Freezes PIXI HUD:
hudRoot.eventMode = 'none';
hudRoot.interactive = false;
```

**When Modal Closes (drag handler - IMMEDIATELY):**
```typescript
// Unfreezes PIXI HUD IMMEDIATELY:
hudRoot.eventMode = 'static';
hudRoot.interactive = true;
// Also explicitly re-enables xButton and debugBg
```

**When Modal Closes (hideModal - after 400ms):**
```typescript
// Safety check - only unfreezes if still frozen
```

### What We've Tried:

1. ✅ **Visibility state management** - Reset immediately in drag handler
2. ✅ **PIXI HUD freeze/unfreeze** - Freeze on open, unfreeze on close
3. ✅ **Immediate unfreeze in drag handler** - Unfreeze before setTimeout
4. ✅ **Explicit re-enable of X button** - Set eventMode and interactive on debugBg
5. ✅ **Safety check in hideModal()** - Only unfreeze if still frozen

### Console Logs Analysis:

**Working case:**
```
🎯 RED RECTANGLE CLICKED - Opening End Run bottom sheet
🎯 Pausing game for End This Run modal
🔒 PIXI HUD frozen - ALL events disabled
...modal opens...
...modal closes...
🔓 PIXI HUD unfrozen IMMEDIATELY - events enabled
🎯 RED RECTANGLE CLICKED - Opening End Run bottom sheet  ← WORKS
```

**Broken case:**
```
...modal closes...
🔓 PIXI HUD unfrozen IMMEDIATELY - events enabled
[User clicks X button]
[NO LOGS - event handler doesn't fire]  ← BROKEN
```

## Root Cause Hypothesis

The event handler (`debugBg.on('pointerdown', ...)`) is **lost or blocked** after the first modal close, even though:
- `debugBg.eventMode = 'static'` is set
- `debugBg.interactive = true` is set
- `hudRoot.eventMode = 'static'` is set
- `hudRoot.interactive = true` is set

## Possible Causes:

1. **Event handler removed** - PIXI might be removing event handlers when `eventMode = 'none'`
2. **Parent container blocking** - `hudRoot` or `xButton` might be blocking events even when unfrozen
3. **Event propagation stopped** - Some other code might be stopping event propagation
4. **PIXI Container state** - Container might be in a state where events don't propagate
5. **Multiple event handlers** - Event handler might be registered multiple times and conflicting

## What Needs to Be Fixed:

1. **Ensure event handler persists** - Event handler should not be lost when freezing/unfreezing
2. **Verify event propagation** - Events should propagate from debugBg → xButton → hudRoot → stage
3. **Check for event conflicts** - No other code should be blocking or removing event handlers
4. **Test event handler registration** - Event handler should be registered once and persist

## Test Steps to Reproduce:

1. Start game
2. Click X button → Modal opens ✅
3. Close modal (drag down) → Modal closes ✅
4. Click X button → Modal opens ✅ (WORKS)
5. Close modal again → Modal closes ✅
6. Click X button → **NOTHING HAPPENS** ❌ (BROKEN)

## Expected Behavior:

X button and score touch area should work **every time**, not just the first time after modal closes.

## Additional Context:

- Score bottom sheet has the same problem
- Both use PIXI Graphics elements with `eventMode = 'static'` and `interactive = true`
- Both have event handlers registered with `.on('pointerdown', ...)`
- Problem occurs after first modal close, not immediately

## Code References:

- X button creation: `src/modules/hud-helpers.js` lines ~1684-1767
- Score touch area creation: `src/modules/hud-helpers.js` lines ~1804-1844
- Modal freeze/unfreeze: `src/modules/end-run-modal.ts` lines ~270-281, ~432-470, ~633-669

