# 🎮 Cube Crash - Game Assessment & Breakdown

**Version:** 0.10.0  
**Date:** 2025-01-XX  
**Purpose:** Comprehensive breakdown for monetization strategy planning

---

## 📋 Executive Summary

**Cube Crash** je match-3 puzzle igra napravljena u TypeScript/JavaScript s PIXI.js i GSAP animacijama. Igra koristi drag-and-drop mehaniku gdje igrači spajaju kockice (tiles) vrijednosti 1-6 da bi postigli "merge 6" i napredovali kroz različite boardove. Igra ima kompleksan sistem wild tiles, combos, collectibles, i currency sistema (stars, coins).

---

## 🎯 Core Game Mechanics

### **1. Basic Gameplay Loop**

1. **Board Setup**: 5x9 grid (45 cells) s početnim tiles (vrijednosti 1-5)
2. **Drag & Drop**: Igrač vuče tile na drugi tile da bi ih spojio
3. **Merging Rules**:
   - Dva ista tile-a se spajaju u veći (1+1=2, 2+2=3, ..., 5+5=6)
   - **Merge 6** je cilj - kada se postigne, spawnaju se novi tiles
   - Wild tiles mogu spajati s bilo kojim tile-om
4. **Spawn System**: Nakon merge 6, novi tiles se spawnaju na praznim mjestima
5. **Endgame Conditions**:
   - Clean board (svi tiles su merge 6)
   - Stuck (nema mogućih merge-ova)
   - Moves depleted (ako je moves sistem aktivan)

### **2. Tile System**

#### **Regular Tiles**
- Vrijednosti: 1, 2, 3, 4, 5, 6
- Merge 6 je najveći i cilj igre
- Visual: Brojevi na kockicama

#### **Wild Tiles** (Special Tiles)
1. **Wild** (Regular Wild)
   - Može se spojiti s bilo kojim tile-om
   - Rotirajuće zvjezdice animacije
   - Shimmer efekt

2. **Wild-Beer** 🍺
   - Ista funkcionalnost kao Wild
   - Bubbles animacija umjesto zvjezdica
   - Posebna tekstura (`wild-beer.png`)

3. **Wild-Magnet** 🧲
   - Može se spojiti s bilo kojim tile-om (osim wild/wild-magnet)
   - **SPECIAL ABILITY**: Kada se spoji, privlači do 4 najbliža tile-a prema sebi
   - Pulled tiles se automatski spajaju u merge 6
   - Electric glow efekt
   - Magnet idle particles animacija

### **3. Scoring System**

- **Base Score**: Zasnovan na merge vrijednosti
- **Combo System**: Multiplier koji se povećava s uzastopnim merge-ovima
   - Combo se resetira nakon 2 sekunde neaktivnosti
   - Combo ikone: `combo-hud.png` (0-4), `extra-combo-hud.png` (5-9), `mega-combo-hud.png` (10+)
- **Score Cap**: Postoji maksimalni score limit
- **High Score**: Trajno se čuva u localStorage

### **4. Currency System**

#### **Stars** ⭐
- **Collection**: 3 zvjezdice se animiraju u HUD kada se wild star spoji s tile-om u merge 6
- **Storage**: `stars-collector.ts` modul
- **Display**: Star HUD icon s brojem
- **Usage**: Trenutno samo prikupljanje (spremno za monetizaciju)

#### **Coins** 🪙
- **Display**: Coin HUD icon s brojem
- **Current State**: Prikazuje score (trenutno nije zasebna valuta)
- **Potential**: Može biti zasebna valuta za monetizaciju

### **5. Wild Meter System**

- **Progress Bar**: Prikazuje napredak prema wild tile spawn-u
- **Fill Rate**: Zasnovan na merge-ovima (board-specific)
- **Spawn**: Kada se napuni, spawna se wild tile na random praznom mjestu
- **Board-Specific Rules**:
  - Board 2: Wild meter enabled, normal fill rate
  - Board 3: Samo wild-beer se spawna
  - Može se disable-ati po boardovima

### **6. Combo System**

- **Increment**: Svaki merge povećava combo za 1
- **Decay**: Resetira se na 0 nakon 2 sekunde neaktivnosti
- **Visual Feedback**:
  - Combo ikone se mijenjaju ovisno o vrijednosti
  - Morph animacija pri promjeni ikone
  - Wobble animacija za extra-combo (5-9)
- **Magnet Integration**: Combo se nastavlja i povećava kada magnet pull-a tiles

---

## 🏗️ Architecture Overview

### **Tech Stack**

- **Frontend Framework**: Vanilla TypeScript/JavaScript (ES6+)
- **Rendering**: PIXI.js v8.2.0 (2D WebGL canvas)
- **Animations**: GSAP v3.12.5
- **Build Tool**: Vite v7.1.12
- **Platform**: Web (iOS/Android ready via Capacitor)
- **State Management**: Centralized `STATE` object + `GameStateService`

### **Project Structure**

```
src/
├── main.ts                    # Entry point
├── modules/                   # Core game modules
│   ├── app-core.ts           # Main game logic, state, board management
│   ├── app-merge.ts          # Merge logic, animations, magnet pull
│   ├── app-spawn.ts          # Tile spawning system
│   ├── app-boot.ts           # Game initialization
│   ├── drag-core.ts          # Drag & drop system
│   ├── fx.js                 # Visual effects, particles, animations
│   ├── hud-helpers.js        # HUD UI, score, combo, stars display
│   ├── stars-collector.ts    # Star currency collection system
│   ├── endgame-checker.ts    # Endgame detection logic
│   ├── board-specific-rules.ts # Board-specific configurations
│   └── ...
├── ui/                       # UI components
│   ├── components/           # React-like components (homepage, settings, etc.)
│   └── ...
├── services/                 # Business logic services
│   ├── game-state-service.ts
│   ├── stats-service.ts
│   └── board-service.ts
└── core/                     # Core utilities
    ├── logger.ts
    ├── dependency-injection.ts
    └── event-bus.ts
```

### **Key Modules**

#### **app-core.ts** (Main Game Engine)
- Game state management
- Board initialization
- Level progression
- Wild meter management
- Save/load system
- HUD updates
- Endgame flow orchestration

#### **app-merge.ts** (Merge Logic)
- Merge validation
- Merge 6 detection
- Wild-magnet pull logic
- Combo calculation
- Spawn triggering
- Chain merge detection

#### **fx.js** (Visual Effects)
- Particle systems (bubbles, shards, stars)
- Wild tile animations (beer bubbles, magnet particles, star rotation)
- Merge animations (explosions, shards, flashes)
- Star collection animations (3 stars to HUD)

#### **hud-helpers.js** (UI System)
- HUD rendering (score, combo, stars, coins, board number)
- HUD animations (bounce, wobble, morph)
- Progress bar (wild meter)
- Close button, settings integration

---

## 🎮 Game Flow

### **1. Initialization**
1. `main.ts` → `initializeApp()`
2. Asset preloading
3. UI bootstrap
4. Game state initialization
5. Homepage display

### **2. Game Start**
1. User clicks "Play" button
2. `ui-manager.ts` → `startGame()`
3. `app-boot.ts` → `boot()` → `startLevel(1)`
4. Board creation (5x9 grid)
5. Initial tile spawn
6. HUD initialization
7. Drag system activation

### **3. Gameplay Loop**
1. User drags tile
2. `drag-core.ts` → validates drop
3. `app-core.ts` → `merge()` function
4. Merge validation & calculation
5. Visual effects (`fx.js`)
6. Score/combo update
7. Spawn new tiles (if merge 6)
8. Wild meter progress
9. Endgame check

### **4. Endgame Scenarios**

#### **Clean Board**
- Svi tiles su merge 6
- `endgame-flow.ts` → `runEndgameFlow()`
- Clean board modal
- Bonus score calculation
- Next board option

#### **Stuck State**
- Nema mogućih merge-ova
- `endgame-checker.ts` → `checkEndGame()`
- Fail screen modal
- Restart/Exit options

#### **Moves Depleted** (if enabled)
- Moves counter = 0
- Fail screen
- Restart option

### **5. Board Progression**
- Board 1 → Board 2 → Board 3 → ...
- Score se prenosi između boardova
- Board-specific rules se primjenjuju
- Wild meter se resetira na novom boardu

---

## 💰 Monetization Opportunities

### **Current Currency Systems**

1. **Stars** ⭐
   - **Collection**: 3 stars per wild star merge 6
   - **Storage**: Implemented in `stars-collector.ts`
   - **Display**: HUD icon with count
   - **Status**: Ready for monetization integration

2. **Coins** 🪙
   - **Current**: Displays score (not separate currency)
   - **Potential**: Can be converted to separate currency

### **Monetization Hooks (Ready to Implement)**

#### **1. In-App Purchases (IAP)**
- **Stars Purchase**: Buy stars directly
- **Coins Purchase**: Buy coins for power-ups
- **Starter Packs**: Bundle deals
- **Subscription**: Premium features

#### **2. Rewarded Ads**
- **Continue Game**: Watch ad to continue after fail
- **Extra Moves**: Watch ad for +5 moves
- **Wild Tile**: Watch ad to spawn wild tile
- **Double Score**: Watch ad for 2x score multiplier

#### **3. Power-Ups (Premium Items)**
- **Wild Tile Spawn**: Instant wild tile (costs stars/coins)
- **Extra Moves**: +10 moves (costs stars/coins)
- **Combo Freeze**: Freeze combo timer (costs stars/coins)
- **Hint System**: Show possible merges (costs stars/coins)
- **Undo Move**: Undo last move (costs stars/coins)

#### **4. Progression Systems**
- **Collectibles**: Already implemented (`collectibles-logic.ts`)
  - Common, Rare, Epic, Legendary cards
  - Unlock via events (first-game, score-100, level-5, combo-10, wild-merge)
  - **Monetization**: Buy collectible packs, unlock specific cards

#### **5. Premium Features**
- **Ad-Free**: Remove all ads (subscription)
- **Unlimited Moves**: Remove moves limit (subscription)
- **Custom Themes**: Unlock board themes (stars/coins)
- **Stat Tracking**: Advanced stats (subscription)

### **Integration Points**

#### **Stars System** (`stars-collector.ts`)
```typescript
// Current: Collection only
StarsCollector.addStars(3); // On wild star merge 6

// Ready for: Purchase integration
StarsCollector.addStars(purchasedAmount); // From IAP
StarsCollector.spendStars(cost); // For power-ups
```

#### **Coins System** (Needs Implementation)
```typescript
// Current: Shows score
// Needs: Separate currency system
CoinsManager.addCoins(earnedAmount); // From gameplay
CoinsManager.spendCoins(cost); // For power-ups
```

#### **Power-Up System** (Needs Implementation)
```typescript
// Hook points in app-core.ts:
- Before merge: Check for active power-ups
- After fail: Offer continue with ad/IAP
- On board start: Offer power-ups
- In HUD: Power-up buttons
```

---

## 📊 Game Systems Deep Dive

### **1. Board System**

- **Grid**: 5 columns × 9 rows = 45 cells
- **Tile Size**: Configurable (TILE constant)
- **Gap**: Spacing between tiles (GAP constant)
- **Ghost Placeholders**: Empty cell indicators
- **Locked Tiles**: Tiles waiting to spawn (locked=true)

### **2. Drag & Drop System**

- **Library**: Custom implementation (`drag-core.ts`)
- **Features**:
  - Touch & mouse support
  - Snap to grid
  - Hover effects
  - Drop validation
  - Animation feedback

### **3. Animation System**

- **GSAP Timeline**: Complex animations
- **PIXI.js Sprites**: Tile rendering
- **Particle Systems**: Explosions, bubbles, shards
- **Performance**: Object pooling, texture caching

### **4. Save/Load System**

- **Storage**: localStorage
- **Keys**: `cc_saved_game`, `cubeCrash_gameState`
- **Data Saved**:
  - Board state (tiles, positions, values)
  - Score, combo, moves
  - Board number
  - Wild meter progress
  - Stars count
- **Resume**: Resume game bottom sheet

### **5. Stats System**

- **Service**: `stats-service.ts`
- **Tracks**:
  - High score
  - Total games played
  - Total cubes cracked
  - Highest board reached
  - Total play time
- **Storage**: localStorage

---

## 🎨 UI/UX Components

### **Main Screens**

1. **Homepage** (`home-slide.ts`)
   - Play button
   - Settings button
   - Stats button
   - Collectibles button

2. **Game Screen**
   - Board (PIXI.js canvas)
   - HUD (top bar: close, stars, coins, combo)
   - Wild meter (progress bar)
   - Bottom sheet modals

3. **Settings Screen** (`settings-screen.ts`)
   - Sound toggle
   - Haptic feedback toggle
   - About section
   - Back button

4. **Stats Screen** (`stats-screen.ts`)
   - High score
   - Games played
   - Cubes cracked
   - Highest board

5. **Collectibles Screen** (`collectibles-screen.ts`)
   - Card collection
   - Rarity filters
   - Unlock progress
   - Card details modal

### **Modals**

1. **End Run Modal** (`end-run-modal.ts`)
   - Restart button
   - Clean Board button
   - Exit button

2. **Board Fail Modal** (`board-fail-modal.ts`)
   - Continue option
   - Restart option
   - Exit option

3. **Clean Board Modal** (`clean-board-modal.ts`)
   - Bonus score display
   - Next board button
   - Exit button

4. **Resume Game Modal** (`resume-game-bottom-sheet.ts`)
   - Continue saved game
   - New game option

---

## 🔧 Technical Features

### **Performance Optimizations**

1. **Object Pooling**: Graphics objects reused
2. **Texture Caching**: Shared textures for particles
3. **Memory Management**: Cleanup intervals, leak detection
4. **FPS Monitoring**: Dynamic quality adjustments
5. **Asset Preloading**: All assets loaded before game start

### **Platform Support**

- **Web**: Primary platform
- **iOS**: Via Capacitor (haptics support)
- **Android**: Via Capacitor (ready)
- **Responsive**: Mobile-first design

### **Accessibility**

- **Screen Reader**: ARIA labels
- **Focus Management**: Focus trap modals
- **Keyboard Navigation**: Tab support
- **Color Contrast**: WCAG compliant

### **App Store Compliance**

- **Error Boundary**: Crash prevention
- **Performance Monitor**: FPS, memory tracking
- **Accessibility Manager**: WCAG compliance
- **App Store Compliance**: iOS/Android ready

---

## 📈 Current Game State

### **Implemented Features**

✅ Core gameplay (merge, spawn, drag-drop)  
✅ Wild tiles (wild, wild-beer, wild-magnet)  
✅ Combo system  
✅ Score system  
✅ Stars collection  
✅ Wild meter  
✅ Board progression  
✅ Save/load  
✅ Collectibles system  
✅ Stats tracking  
✅ Multiple boards with rules  
✅ Animations & effects  
✅ HUD system  
✅ Modals & UI  

### **Ready for Monetization**

✅ Stars currency (collection working)  
✅ Coins display (needs separation from score)  
✅ Collectibles system (unlock logic ready)  
✅ Stats tracking (for analytics)  
✅ Save/load (for progression)  

### **Needs Implementation**

❌ IAP integration  
❌ Ad integration  
❌ Power-up system  
❌ Coins as separate currency  
❌ Purchase flows  
❌ Reward systems  

---

## 🎯 Monetization Strategy Recommendations

### **Phase 1: Quick Wins**

1. **Rewarded Ads**
   - Continue after fail
   - Extra moves
   - Wild tile spawn
   - **Integration Point**: `end-run-modal.ts`, `board-fail-modal.ts`

2. **Stars → Power-Ups**
   - Convert stars to power-ups
   - Wild tile spawn (cost: 10 stars)
   - Extra moves (cost: 5 stars)
   - **Integration Point**: `stars-collector.ts`, HUD buttons

### **Phase 2: IAP Integration**

1. **Star Packs**
   - Small pack: 50 stars ($0.99)
   - Medium pack: 150 stars ($2.99)
   - Large pack: 500 stars ($9.99)
   - **Integration Point**: `stars-collector.ts`

2. **Starter Packs**
   - Bundle: Stars + Coins + Power-ups
   - **Integration Point**: New purchase flow

### **Phase 3: Premium Features**

1. **Subscription Model**
   - Ad-free experience
   - Unlimited moves
   - Premium themes
   - Advanced stats
   - **Integration Point**: New subscription service

2. **Collectibles Monetization**
   - Buy collectible packs
   - Unlock specific cards
   - **Integration Point**: `collectibles-logic.ts`

---

## 📝 Code Integration Points

### **For Ad Integration**

```typescript
// In end-run-modal.ts or board-fail-modal.ts
async function showRewardedAd(): Promise<boolean> {
  // Show ad
  // On success: continue game
  // Return true if ad watched
}

// In app-core.ts
if (adWatched) {
  // Grant reward (moves, wild tile, etc.)
}
```

### **For IAP Integration**

```typescript
// In stars-collector.ts
export function purchaseStars(packId: string): Promise<number> {
  // Call IAP service
  // On success: addStars(purchasedAmount)
  // Return purchased amount
}

// In new power-ups.ts
export function usePowerUp(type: PowerUpType, cost: number): boolean {
  if (StarsCollector.getStarsCount() >= cost) {
    StarsCollector.spendStars(cost);
    activatePowerUp(type);
    return true;
  }
  return false;
}
```

### **For Coins System**

```typescript
// New: coins-manager.ts
export class CoinsManager {
  private coins: number = 0;
  
  addCoins(amount: number): void {
    this.coins += amount;
    updateHUD();
  }
  
  spendCoins(amount: number): boolean {
    if (this.coins >= amount) {
      this.coins -= amount;
      updateHUD();
      return true;
    }
    return false;
  }
}
```

---

## 🚀 Next Steps for Monetization Agent

1. **Review this document** to understand game structure
2. **Identify ad SDK** (AdMob, Unity Ads, etc.)
3. **Identify IAP SDK** (RevenueCat, native IAP, etc.)
4. **Design purchase flows** for stars, coins, power-ups
5. **Design ad placement** strategy
6. **Implement reward systems** (ads → rewards, IAP → currency)
7. **Test monetization** flows
8. **Analytics integration** for tracking purchases/ads

---

## 📞 Key Files for Monetization

- `src/modules/stars-collector.ts` - Stars currency system
- `src/modules/hud-helpers.js` - HUD display (stars, coins)
- `src/modules/end-run-modal.ts` - End game modal (ad placement)
- `src/modules/board-fail-modal.ts` - Fail screen (ad placement)
- `src/modules/collectibles-logic.ts` - Collectibles (purchase integration)
- `src/modules/app-core.ts` - Main game logic (power-up hooks)
- `src/services/stats-service.ts` - Analytics integration point

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Maintained By:** Development Team

