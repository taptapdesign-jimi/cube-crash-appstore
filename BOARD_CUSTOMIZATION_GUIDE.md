# 🎯 Board Customization Guide - Cube Crash

## ✅ DA! Sada možeš podesiti board details za svaki board zasebno!

Modul `board-specific-rules.ts` omogućava ti da kontroliraš **SVE parametre** za svaki board zasebno.

---

## 📋 Što možeš kontrolirati?

### **1. Wild Tile Settings**
- ✅ `wildSpawnEnabled` - Enable/disable wild spawning
- ✅ `allowedWildTypes` - Koje wild types su dozvoljene (`'wild'`, `'wild-beer'`, `'wild-magnet'`)
- ✅ `wildMeterEnabled` - Enable/disable wild meter
- ✅ `wildMeterFillRate` - Brzina punjenja wild meter-a (multiplier, default: 1.0)

### **2. Gameplay Settings**
- ✅ `maxMoves` - Max poteza za board (override default MOVES_MAX)
- ✅ `scoreMultiplier` - Score multiplier za board (default: 1.0)
- ✅ `comboMultiplier` - Combo multiplier za board (default: 1.0)

### **3. Spawn Settings**
- ✅ `spawnRate` - Spawn rate modifier (default: 1.0)
- ✅ `initialTiles` - Broj početnih tiles na boardu

### **4. Difficulty Settings**
- ✅ `difficulty` - `'easy'` | `'normal'` | `'hard'` | `'extreme'`

### **5. Custom Functions**
- ✅ `customSpawnLogic` - Custom spawn funkcija
- ✅ `onBoardStart` - Callback kada board počne
- ✅ `onBoardEnd` - Callback kada board završi

---

## 🎮 Primjeri

### **Primjer 1: Board 5 - Hard Mode**

```typescript
{
  boardNumber: 5,
  maxMoves: 30, // Manje poteza (default je 50)
  scoreMultiplier: 2.0, // Duplo više bodova
  difficulty: 'hard',
  wildMeterFillRate: 0.5, // Sporije punjenje wild meter-a
  allowedWildTypes: ['wild', 'wild-beer'] // Ne wild-magnet
}
```

### **Primjer 2: Board 10 - Easy Mode**

```typescript
{
  boardNumber: 10,
  maxMoves: 70, // Više poteza
  scoreMultiplier: 1.5, // Više bodova
  difficulty: 'easy',
  wildMeterFillRate: 2.0, // Brže punjenje wild meter-a
  allowedWildTypes: ['wild', 'wild-beer', 'wild-magnet'] // Sve dozvoljeno
}
```

### **Primjer 3: Board 20 - Extreme Mode**

```typescript
{
  boardNumber: 20,
  maxMoves: 25, // Jako malo poteza
  scoreMultiplier: 3.0, // Tri puta više bodova
  difficulty: 'extreme',
  wildMeterFillRate: 0.3, // Jako sporo punjenje
  allowedWildTypes: ['wild'] // Samo regular wild (nema wild-beer, nema wild-magnet)
}
```

### **Primjer 4: Board 7 - Custom Logic**

```typescript
{
  boardNumber: 7,
  maxMoves: 40,
  scoreMultiplier: 1.2,
  onBoardStart: (boardNumber) => {
    console.log(`🎯 Board ${boardNumber} started - special event!`);
    // Možeš dodati custom logiku ovdje
  },
  onBoardEnd: (boardNumber) => {
    console.log(`🎯 Board ${boardNumber} ended - cleanup!`);
    // Možeš dodati cleanup logiku ovdje
  }
}
```

---

## 🔧 Kako Dodati Pravila

### **Metoda 1: Direktno u `board-specific-rules.ts`**

U `src/modules/board-specific-rules.ts`, dodaj u `BOARD_RULES` array:

```typescript
const BOARD_RULES: BoardRule[] = [
  // Postojeća pravila...
  {
    boardNumber: 5,
    maxMoves: 30,
    scoreMultiplier: 2.0,
    difficulty: 'hard',
    wildMeterFillRate: 0.5,
    allowedWildTypes: ['wild', 'wild-beer']
  }
];
```

### **Metoda 2: Programski (runtime)**

```typescript
import { boardSpecificRules } from './board-specific-rules';

// Dodaj novo pravilo
boardSpecificRules.addRule({
  boardNumber: 8,
  maxMoves: 35,
  scoreMultiplier: 1.5,
  difficulty: 'normal',
  wildMeterFillRate: 1.2,
  allowedWildTypes: ['wild-beer', 'wild-magnet']
});
```

---

## 📊 API Funkcije

### **Wild Settings:**
```typescript
isWildSpawnEnabled(boardNumber?: number): boolean
isWildMeterEnabled(boardNumber?: number): boolean
getAllowedWildTypes(boardNumber?: number): ('wild' | 'wild-beer' | 'wild-magnet')[]
getWildMeterFillRate(boardNumber?: number): number
```

### **Gameplay Settings:**
```typescript
getMaxMoves(boardNumber?: number, defaultMoves?: number): number
getScoreMultiplier(boardNumber?: number): number
getComboMultiplier(boardNumber?: number): number
```

### **Spawn Settings:**
```typescript
getSpawnRate(boardNumber?: number): number
```

### **Difficulty:**
```typescript
getDifficulty(boardNumber?: number): 'easy' | 'normal' | 'hard' | 'extreme'
```

### **Callbacks:**
```typescript
triggerOnBoardStart(boardNumber: number): void
triggerOnBoardEnd(boardNumber: number): void
```

---

## 🎯 Integracija u app-core.ts

Trenutno je integrirano:
- ✅ `addWildProgress()` - koristi `isWildMeterEnabled()` i `getWildMeterFillRate()`
- ✅ `queueWildSpawnIfNeeded()` - koristi `isWildSpawnEnabled()`
- ✅ `spawnWildFromMeter()` - koristi `filterWildType()`
- ✅ `startLevel()` - postavlja current board

**Za buduće integracije:**
- `maxMoves` - može se koristiti u `startLevel()` umjesto `MOVES_MAX`
- `scoreMultiplier` - može se koristiti u score calculation
- `comboMultiplier` - može se koristiti u combo calculation
- `onBoardStart` / `onBoardEnd` - može se pozvati u `startLevel()` i `triggerCleanBoardFlow()`

---

## ✅ Trenutna Pravila

### **Board 2:**
```typescript
{
  boardNumber: 2,
  wildSpawnEnabled: false,
  wildMeterEnabled: false,
  allowedWildTypes: []
}
```

### **Board 3:**
```typescript
{
  boardNumber: 3,
  wildSpawnEnabled: true,
  wildMeterEnabled: true,
  allowedWildTypes: ['wild-beer']
}
```

---

## 🚀 Sljedeći Koraci

1. **Dodaj više parametara** u `BoardRule` interface ako trebaš
2. **Integriraj u app-core.ts** gdje trebaš (maxMoves, scoreMultiplier, itd.)
3. **Kreiraj board-specific pravila** za sve boardove koje želiš

---

**Lokacija:** `src/modules/board-specific-rules.ts`  
**Dokumentacija:** `BOARD_SPECIFIC_RULES_README.md`

