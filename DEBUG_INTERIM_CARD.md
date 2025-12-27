# 🔍 Interim Card Debug Instructions

## Problem
Interim card wrapper shows visible box on left/right sides on iPad.

## Required Information

### 1. DOM Structure
Run in iPad Safari Web Inspector Console:

```javascript
// Find interim card
const card = document.querySelector('.journey-board-card.interim');
const wrapper = card?.closest('.journey-board-card-wrapper');

console.log('WRAPPER HTML:', wrapper?.outerHTML);
console.log('CARD HTML:', card?.outerHTML);
console.log('CARD CHILDREN:', Array.from(card?.children || []).map(c => c.outerHTML));
```

### 2. Measurements (Rect + Computed Styles)

```javascript
const card = document.querySelector('.journey-board-card.interim');
const wrapper = card?.closest('.journey-board-card-wrapper');

const cardRect = card.getBoundingClientRect();
const wrapperRect = wrapper.getBoundingClientRect();

const cardComputed = window.getComputedStyle(card);
const wrapperComputed = window.getComputedStyle(wrapper);

console.log('WRAPPER RECT:', {
  x: wrapperRect.x,
  y: wrapperRect.y,
  width: wrapperRect.width,
  height: wrapperRect.height,
  left: wrapperRect.left,
  right: wrapperRect.right
});

console.log('CARD RECT:', {
  x: cardRect.x,
  y: cardRect.y,
  width: cardRect.width,
  height: cardRect.height,
  left: cardRect.left,
  right: cardRect.right
});

console.log('WRAPPER COMPUTED:', {
  width: wrapperComputed.width,
  height: wrapperComputed.height,
  paddingLeft: wrapperComputed.paddingLeft,
  paddingRight: wrapperComputed.paddingRight,
  background: wrapperComputed.background,
  backgroundColor: wrapperComputed.backgroundColor,
  border: wrapperComputed.border,
  outline: wrapperComputed.outline,
  boxShadow: wrapperComputed.boxShadow,
  filter: wrapperComputed.filter,
  position: wrapperComputed.position,
  overflow: wrapperComputed.overflow
});

console.log('CARD COMPUTED:', {
  width: cardComputed.width,
  height: cardComputed.height,
  marginLeft: cardComputed.marginLeft,
  marginRight: cardComputed.marginRight,
  position: cardComputed.position,
  transform: cardComputed.transform,
  boxShadow: cardComputed.boxShadow,
  filter: cardComputed.filter,
  background: cardComputed.background
});

console.log('DIFFERENCE:', {
  widthDiff: cardRect.width - wrapperRect.width,
  leftDiff: cardRect.left - wrapperRect.left,
  rightDiff: wrapperRect.right - cardRect.right
});
```

### 3. Children & Pseudo-elements

```javascript
const card = document.querySelector('.journey-board-card.interim');
const wrapper = card?.closest('.journey-board-card-wrapper');

// Check all children
Array.from(wrapper?.children || []).forEach((child, i) => {
  const rect = child.getBoundingClientRect();
  const computed = window.getComputedStyle(child);
  console.log(`WRAPPER CHILD ${i}:`, {
    tagName: child.tagName,
    className: child.className,
    rect: { width: rect.width, height: rect.height, left: rect.left, right: rect.right },
    computed: {
      background: computed.background,
      backgroundColor: computed.backgroundColor,
      boxShadow: computed.boxShadow,
      filter: computed.filter,
      position: computed.position,
      width: computed.width,
      height: computed.height
    }
  });
});

Array.from(card?.children || []).forEach((child, i) => {
  const rect = child.getBoundingClientRect();
  const computed = window.getComputedStyle(child);
  console.log(`CARD CHILD ${i}:`, {
    tagName: child.tagName,
    className: child.className,
    rect: { width: rect.width, height: rect.height, left: rect.left, right: rect.right },
    computed: {
      background: computed.background,
      backgroundColor: computed.backgroundColor,
      boxShadow: computed.boxShadow,
      filter: computed.filter,
      position: computed.position,
      width: computed.width,
      height: computed.height
    }
  });
});

// Check pseudo-elements
const cardAfter = window.getComputedStyle(card, '::after');
const cardBefore = window.getComputedStyle(card, '::before');
console.log('CARD ::after:', {
  content: cardAfter.content,
  display: cardAfter.display,
  position: cardAfter.position,
  width: cardAfter.width,
  height: cardAfter.height,
  background: cardAfter.background,
  boxShadow: cardAfter.boxShadow
});
```

### 4. Code That Computes Dimensions

**Location:** `src/modules/journey-boards-manager.ts`

**Lines 1532-1540:**
```typescript
const baseCardWidth = position.width || STANDARD_CARD_WIDTH;
const baseCardHeight = position.height || 150;

// Calculate actual card dimensions (iPad: 7% larger, Mobile: original size)
const actualCardWidth = isIPad ? baseCardWidth * 1.883 : baseCardWidth;
const actualCardHeight = isIPad ? baseCardHeight * 1.883 : baseCardHeight;
```

**Lines 1549-1561:**
```typescript
const isInterim = board.interim === true;
let wrapperOffset = isIPad ? 8 * 1.883 : 8; // Scale offset for iPad
let wrapperHorizontalOffset = wrapperOffset; // Horizontal offset (left/right)
let wrapperVerticalOffset = wrapperOffset; // Vertical offset (top/bottom)

// For interim cards on iPad, reduce wrapper by additional 16px on each side
// Plus additional 8px on left/right sides only to hide bg container
if (isIPad && isInterim) {
  wrapperOffset += 16; // Additional 16px reduction for all sides
  wrapperHorizontalOffset += 8; // Additional 8px reduction for left/right sides only
}

const wrapperWidth = actualCardWidth - (wrapperHorizontalOffset * 2);
const wrapperHeight = actualCardHeight - (wrapperVerticalOffset * 2);
```

**Lines 1617-1618:**
```typescript
card.style.width = `${actualCardWidth}px`;
card.style.height = `${actualCardHeight}px`;
```

## Quick Debug Script

Save this as a bookmarklet or run in console:

```javascript
(function() {
  const card = document.querySelector('.journey-board-card.interim');
  const wrapper = card?.closest('.journey-board-card-wrapper');
  if (!card || !wrapper) return console.error('Interim card not found');
  
  const cardRect = card.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  const cardComputed = window.getComputedStyle(card);
  const wrapperComputed = window.getComputedStyle(wrapper);
  
  console.group('🔍 INTERIM CARD DEBUG');
  console.log('WRAPPER RECT:', wrapperRect);
  console.log('CARD RECT:', cardRect);
  console.log('DIFF:', {
    width: cardRect.width - wrapperRect.width,
    left: cardRect.left - wrapperRect.left,
    right: wrapperRect.right - cardRect.right
  });
  console.log('WRAPPER STYLES:', {
    width: wrapperComputed.width,
    padding: wrapperComputed.paddingLeft + ' / ' + wrapperComputed.paddingRight,
    background: wrapperComputed.backgroundColor,
    border: wrapperComputed.border,
    boxShadow: wrapperComputed.boxShadow
  });
  console.log('CARD STYLES:', {
    width: cardComputed.width,
    margin: cardComputed.marginLeft + ' / ' + cardComputed.marginRight,
    position: cardComputed.position
  });
  console.groupEnd();
})();
```



