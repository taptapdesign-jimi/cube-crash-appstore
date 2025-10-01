# 🎮 Cube Crash

A fast-paced mobile puzzle game where you stack and crash cubes to reach the required number.

## 📁 Project Structure

```
cube-crash/
├── index.html              # Main HTML file
├── manifest.webmanifest    # PWA manifest
├── favicon.ico             # App icon
│
├── src/                    # Source code
│   ├── main.js            # Entry point
│   ├── style.css          # Main styles
│   ├── slider-optimized.css
│   └── modules/           # Game modules (32 files)
│       ├── app.js         # Main game logic
│       ├── board.js       # Board creation & tile management
│       ├── drag.js        # Drag & drop system
│       ├── fx.js          # Visual effects
│       ├── hud-helpers.js # HUD & UI
│       └── ...            # Other modules
│
├── assets/                 # Static assets
│   ├── fonts/             # LTCrow font family
│   ├── fx/boom/           # Explosion sprite sheets
│   └── *.png, *.mp3       # Images & sounds
│
├── vendor/                 # External libraries
│   ├── pixi.mjs           # PIXI.js v8
│   └── gsap/              # GSAP animation library
│
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── SANITY_TEST.md
│
└── package.json           # Dependencies

```

## 🚀 Development

### Prerequisites
- Node.js 18+
- Modern browser with ES modules support

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
# Opens at http://localhost:5173
```

### Build for Production
```bash
npm run build
# Output: dist/
```

## 🎯 Game Features

- **Endless Mode**: Play as long as you can manage the board
- **Wild Cubes**: Special power-up cubes that merge with any value
- **Combo System**: Chain merges for multiplied scores
- **Save/Load**: Automatic game state persistence
- **Statistics**: Track high scores, combos, and achievements
- **Responsive**: Optimized for mobile devices (iPhone 13+)

## 🏗️ Architecture

### Module Organization
- **Core Game**: `app.js`, `app-state.js`, `app-merge.js`
- **Board Management**: `board.js`, `app-board.js`, `tile.js`
- **User Interaction**: `drag.js`, `install-drag.js`
- **Visual Effects**: `fx.js`, `fx-helpers.js`
- **UI Components**: `hud-helpers.js`, `pause-modal.js`, `board-fail-modal.js`
- **Game Flow**: `endgame-flow.js`, `level-flow.js`
- **Spawning**: `spawn-helpers.js`, `spawn-rules.js`, `app-spawn.js`

### Key Design Patterns
- **Fixed Background Layer**: Ghost placeholders rendered once, never destroyed
- **State Management**: Centralized in `app-state.js`
- **Event-Based Saving**: Smart save on every move
- **PIXI.js v8**: Modern rendering with sortable containers
- **GSAP**: Professional animations with safety guards

## 📱 App Store Submission

This project follows App Store best practices:
- ✅ Clean, professional folder structure
- ✅ No duplicate code or dead files
- ✅ Optimized asset loading
- ✅ PWA manifest for iOS
- ✅ Safe area support for notched devices
- ✅ Proper touch handling

## 🐛 Known Issues

None! v20 is stable.

## 📝 Version History

- **v20.1**: Clean project structure
- **v20**: Professional ghost placeholder system
- **v19**: Critical bug fixes (high score, wild cubes)
- **v18**: Level complete functionality
- **v17**: Enhanced visual effects

## 📄 License

Proprietary - All rights reserved

---

Built with ❤️ using PIXI.js and GSAP

