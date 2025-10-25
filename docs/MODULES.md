# 📚 MODULE DOCUMENTATION

## **CUBE CRASH - REFACTORED MODULES**

This document describes all modules in the refactored CubeCrash codebase.

---

## **🏗️ CORE MODULES**

### **app-core.ts** (370 linija)
**Purpose:** Core application functionality and initialization
**Exports:**
- `boot()` - Initialize PIXI app
- `layout()` - Set up initial layout
- Helper functions for grid, state, HUD

### **drag-core.ts** (275 linija)
**Purpose:** Core drag and drop functionality
**Exports:**
- `initDrag()` - Initialize drag system
- `updateDrag()` - Update during game loop
- `onDragStart/Move/End()` - Event handlers

### **merge-core.ts** (367 linija)
**Purpose:** Core merge functionality
**Exports:**
- `merge()` - Merge two tiles
- `clearWildState()` - Clear wild tile state
- `anyMergePossibleOnBoard()` - Check merge possibilities

### **hud-core.ts** (402 linija)
**Purpose:** Core HUD functionality
**Exports:**
- `createUnifiedHudContainer()` - Create HUD container
- `updateHUD()` - Update HUD display
- `setScore/Board/Combo()` - Set values

---

## **🎨 VISUAL EFFECTS MODULES**

### **fx-visual-effects.ts** (200 linija)
**Purpose:** Visual effects for tiles
**Exports:**
- `glassCrackAtTile()` - Glass crack effect
- `woodShardsAtTile()` - Wood shards effect
- `innerFlashAtTile()` - Inner flash effect

### **fx-animations.ts** (250 linija)
**Purpose:** Animation effects
**Exports:**
- `landBounce()` - Tile landing bounce
- `screenShake()` - Screen shake effect
- `magicSparklesAtTile()` - Magic sparkles

### **fx-special-effects.ts** (200 linija)
**Purpose:** Special effects
**Exports:**
- `showMultiplierTile()` - Show multiplier
- `wildImpactEffect()` - Wild tile impact
- `smokeBubblesAtTile()` - Smoke bubbles

---

## **🎮 GAME LOGIC MODULES**

### **app-game-logic.ts** (449 linija)
**Purpose:** Main game logic
**Exports:**
- Game state management
- Score calculation
- Level progression

### **app-ui.ts** (439 linija)
**Purpose:** User interface management
**Exports:**
- UI state management
- Button handlers
- Modal management

### **app-board.ts** (424 linija)
**Purpose:** Board management
**Exports:**
- Board creation
- Tile management
- Grid operations

---

## **🎯 DRAG SYSTEM MODULES**

### **drag-constants.ts** (100 linija)
**Purpose:** Drag system constants
**Exports:**
- Animation constants
- Visual effects constants
- Performance limits

### **drag-utils.ts** (200 linija)
**Purpose:** Drag utility functions
**Exports:**
- `calculateTileTilt()` - Calculate tile tilt
- `applySmoothRotation()` - Apply rotation
- `createHoverEffect()` - Create hover effect

### **drag-events.ts** (453 linija)
**Purpose:** Drag event handling
**Exports:**
- `setupDragListeners()` - Setup event listeners
- Event handlers for mouse/touch
- Drag state management

### **drag-animations.ts** (421 linija)
**Purpose:** Drag animations
**Exports:**
- `animateTileTilt()` - Animate tile tilt
- `animateSnapBack()` - Animate snap back
- `animateMagnetEffect()` - Animate magnet

---

## **🔄 MERGE SYSTEM MODULES**

### **merge-constants.ts** (100 linija)
**Purpose:** Merge system constants
**Exports:**
- Animation durations
- Score multipliers
- Game over delays

### **merge-utils.ts** (200 linija)
**Purpose:** Merge utility functions
**Exports:**
- `calculateMergeValue()` - Calculate merge value
- `canMerge()` - Check if tiles can merge
- `calculateScoreGain()` - Calculate score

### **merge-animations.ts** (457 linija)
**Purpose:** Merge animations
**Exports:**
- `animateMergeEffect()` - Animate merge
- `animateWildMergeEffect()` - Animate wild merge
- `animateScoreIncrease()` - Animate score

### **merge-game-over.ts** (200 linija)
**Purpose:** Game over logic
**Exports:**
- `checkGameOver()` - Check game over
- `anyMergePossible()` - Check merge possibilities
- `handleGameOver()` - Handle game over

---

## **📊 HUD SYSTEM MODULES**

### **hud-constants.ts** (100 linija)
**Purpose:** HUD system constants
**Exports:**
- Text styles
- Animation durations
- Color schemes

### **hud-utils.ts** (465 linija)
**Purpose:** HUD utility functions
**Exports:**
- `bounceText()` - Animate text bounce
- `formatScore()` - Format score display
- `createHUDBackground()` - Create background

### **hud-animations.ts** (435 linija)
**Purpose:** HUD animations
**Exports:**
- `animateHUDDrop()` - Animate HUD drop
- `animateTextBounce()` - Animate text bounce
- `animateScoreIncrease()` - Animate score

### **hud-components.ts** (414 linija)
**Purpose:** HUD UI components
**Exports:**
- `createUnifiedHudContainer()` - Create container
- `createPIXIHUDContainer()` - Create PIXI container
- `updateHUDInfo()` - Update HUD info

---

## **🎨 UI MODULES**

### **clean-board-modal.ts** (200 linija)
**Purpose:** Clean board modal
**Exports:**
- `showCleanBoardModal()` - Show modal
- `hideCleanBoardModal()` - Hide modal

### **end-run-modal.ts** (200 linija)
**Purpose:** End run modal
**Exports:**
- `showEndRunModal()` - Show modal
- `hideModal()` - Hide modal

### **pause-modal.ts** (200 linija)
**Purpose:** Pause modal
**Exports:**
- `showPauseModal()` - Show modal
- `hidePauseModal()` - Hide modal

### **resume-game-bottom-sheet.ts** (200 linija)
**Purpose:** Resume game bottom sheet
**Exports:**
- `showResumeGameBottomSheet()` - Show sheet
- `hideResumeModal()` - Hide sheet

---

## **📈 STATISTICS**

### **Before Refactor:**
- **Total files:** 86 modules
- **Total lines:** 24,313 lines
- **Largest files:** drag.ts (799), app-merge.ts (723), hud-layout.ts (503)

### **After Refactor:**
- **Total files:** 73 modules (-13 files)
- **Total lines:** 21,202 lines (-3,111 lines)
- **Largest files:** clean-board-animations.ts (474), hud-utils.ts (465), merge-animations.ts (457)

### **Refactored Systems:**
1. **Drag System:** 799 → 5 modules (275 lines core)
2. **Merge System:** 723 → 5 modules (367 lines core)
3. **HUD System:** 503 → 5 modules (402 lines core)
4. **Removed:** 10 dead files (1,111 lines)

---

## **🚀 USAGE**

### **Importing Modules:**
```typescript
// Core modules
import { boot, layout } from './modules/app-core.js';
import { initDrag, updateDrag } from './modules/drag-core.js';
import { merge, clearWildState } from './modules/merge-core.js';
import { updateHUD, setScore } from './modules/hud-core.js';

// Effects
import { glassCrackAtTile } from './modules/fx-visual-effects.js';
import { screenShake } from './modules/fx-animations.js';
import { wildImpactEffect } from './modules/fx-special-effects.js';
```

### **Module Structure:**
- **Core modules:** Main functionality
- **Utils modules:** Utility functions
- **Constants modules:** Configuration
- **Animations modules:** Animation logic
- **Components modules:** UI components

---

## **✅ BENEFITS**

1. **Modularity:** Each module has a single responsibility
2. **Maintainability:** Easier to find and fix issues
3. **Readability:** Code is easier to understand
4. **Testability:** Each module can be tested independently
5. **Performance:** Smaller modules load faster
6. **Scalability:** Easy to add new features

---

## **🔧 TECHNICAL DETAILS**

- **TypeScript:** All modules use TypeScript
- **ES6 Modules:** Modern import/export system
- **PIXI.js:** Optimized for PIXI.js
- **GSAP:** Integrated animations
- **Error Handling:** Improved error management
- **Performance:** Optimized for 60fps

---

*Last updated: December 2024*
*Total modules: 73*
*Total lines: 21,202*
