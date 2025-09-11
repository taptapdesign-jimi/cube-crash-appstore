# CubeCrash Architecture

## Overview
CubeCrash je refaktoriran u modularnu arhitekturu s čistim odvajanjem odgovornosti.

## Core Modules

### AppShell (`app/app-shell.js`)
- **Odgovornost:** Centralni orkestrator i state machine
- **Stanja:** HOME ⇄ GAME ⇄ PAUSE
- **Komunikacija:** EventBus
- **API:** setState(), getState(), getModule()

### Home Module (`features/home/index.js`)
- **Odgovornost:** Homepage slider + CTA buttons
- **Nezavisan:** Ne zna ništa o igri
- **API:** mount(), show(), hide(), destroy()
- **Eventi:** home:play, home:stats, home:collectibles

### Game Module (`game/index.js`)
- **Odgovornost:** PIXI.js igra logika
- **Wrapper:** Oko postojećeg app.js
- **API:** start(), stop(), pause(), resume(), restart()
- **Eventi:** game:pauseRequest, game:gameOver

### Animations Module (`ui/animations.js`)
- **Odgovornost:** Clean visual effects
- **Nezavisan:** Bez poslovne logike
- **API:** homePopIn(), homePopOut(), gamePopIn(), showPauseModal()
- **Graceful fallbacks:** Ako animacija ne radi, app radi

## Communication

### EventBus (`utils/event-bus.js`)
- **Minimalni event emitter**
- **API:** on(), off(), emit(), once()
- **Nema globalnih window.* poziva**

### Event Flow
```
Home Play → AppShell → Game Start
HUD Pause → AppShell → Pause Modal
Pause Exit → AppShell → Home Show
```

## File Structure
```
src/
├── app/
│   └── app-shell.js          # Central orkestrator
├── features/
│   └── home/
│       └── index.js          # Homepage modul
├── game/
│   └── index.js              # Game modul
├── ui/
│   └── animations.js         # Animacije
├── utils/
│   └── event-bus.js          # Event komunikacija
└── main-new.js               # Entry point
```

## Benefits

### Separation of Concerns
- **Homepage** - možeš mijenjati slider bez utjecaja na igru
- **Igra** - možeš dodavati features bez utjecaja na homepage
- **Animacije** - možeš dodavati/uklanjati bez rušenja

### No Conflicts
- **Nema duplih poziva** - sve preko EventBus-a
- **Nema globalnih varijabli** - sve u modulima
- **Nema circular dependencies** - jasna hijerarhija

### Easy Maintenance
- **Svaki modul nezavisan** - lako testiranje
- **Jasni API-ji** - lako razumijevanje
- **Event-driven** - lako dodavanje funkcionalnosti

## Migration Notes

### From Old Structure
- **main-clean.js** → **main-new.js** + **AppShell**
- **Slider logic** → **HomeModule**
- **Game logic** → **GameModule** (wrapper)
- **Animations** → **AnimationModule**

### Preserved
- **HTML/CSS** - isti dizajn
- **PIXI.js** - ista igra logika
- **Assets** - isti resursi
- **User experience** - isti flow

## Future Extensions

### Easy to Add
- **New slides** - dodaj u HomeModule
- **New game features** - dodaj u GameModule
- **New animations** - dodaj u AnimationModule
- **New states** - dodaj u AppShell

### No Breaking Changes
- **Modular design** - promjene su izolirane
- **Event-driven** - lako dodavanje eventova
- **Clean interfaces** - jasni API-ji
