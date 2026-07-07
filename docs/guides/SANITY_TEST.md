# CubeCrash Sanity Test

## Test Scenarios

### 1. Homepage Functionality
- [ ] **Slider navigation** - swipe/click dots
- [ ] **Play button** - starts game
- [ ] **Stats button** - shows stats slide
- [ ] **Collectibles button** - shows collectibles slide

### 2. Game Functionality
- [ ] **Game starts** - PIXI.js loads
- [ ] **Game plays** - tiles, HUD, interactions
- [ ] **Pause works** - pause modal appears
- [ ] **Resume works** - game continues
- [ ] **Restart works** - game restarts
- [ ] **Exit works** - returns to homepage

### 3. Animations
- [ ] **Home pop-in** - smooth entrance
- [ ] **Home pop-out** - smooth exit
- [ ] **Game pop-in** - smooth game start
- [ ] **Pause modal** - smooth modal appearance
- [ ] **Graceful fallbacks** - works without animations

### 4. State Management
- [ ] **No duplicate calls** - single event per action
- [ ] **Clean transitions** - no state conflicts
- [ ] **Memory management** - no leaks
- [ ] **Event cleanup** - proper cleanup on destroy

## Test Commands

### Start Test
```bash
# Start dev server
npm run dev:restart

# Open in browser
http://localhost:5173/index-refactored.html
```

### Console Tests
```javascript
// Check AppShell
console.log(window.appShell.getState());

// Check modules
console.log(window.appShell.getModule('home'));
console.log(window.appShell.getModule('game'));
console.log(window.appShell.getModule('animations'));

// Test events
window.appShell.getEventBus().emit('home:play');
```

## Expected Results

### ✅ Success Indicators
- Smooth homepage slider
- Game starts without errors
- Pause modal works
- Clean state transitions
- No console errors
- No memory leaks

### ❌ Failure Indicators
- Blank screens
- Console errors
- Duplicate calls
- State conflicts
- Memory leaks
- Broken animations

## Performance

### Metrics
- **Initial load:** < 2s
- **Home to game:** < 1s
- **Game to pause:** < 0.5s
- **Pause to home:** < 1s
- **Memory usage:** Stable

### Browser Support
- **Chrome:** ✅
- **Safari:** ✅
- **Firefox:** ✅
- **Mobile:** ✅

## Debugging

### Common Issues
1. **Module not found** - check import paths
2. **Event not firing** - check event names
3. **State not updating** - check AppShell state
4. **Animation not working** - check graceful fallbacks

### Debug Tools
- **Console logs** - detailed logging
- **EventBus** - event debugging
- **State tracking** - state changes
- **Performance** - timing measurements
