# 🎯 Board-Specific Rules - Cube Crash

## 📋 Pregled

Modularni sistem za kontrolu wild tile spawning-a i drugih mehanika po boardovima.

---

## 🎮 Trenutne Pravila

### **Board 2: Wild Preloader Zaključan**
- ❌ **Wild spawn disabled** - nijedan wild tile se ne spawna
- ❌ **Wild meter disabled** - wild meter se ne puni (ostaje na 0)

### **Board 3: Samo Wild-Beer**
- ✅ **Wild spawn enabled** - wild tiles se spawnaju
- ✅ **Wild meter enabled** - wild meter se puni normalno
- 🍺 **Samo wild-beer** - spawna se samo wild-beer (ne wild-magnet, ne regular wild)

---

## 🔧 Kako Dodati Nova Pravila

### **Primjer: Board 5 - Samo Wild-Magnet**

U `src/modules/board-specific-rules.ts`, dodaj u `BOARD_RULES` array:

```typescript
{
  boardNumber: 5,
  wildSpawnEnabled: true,
  wildMeterEnabled: true,
  allowedWildTypes: ['wild-magnet'] // Samo wild-magnet
}
```

### **Primjer: Board 10 - Disable Wild Completely**

```typescript
{
  boardNumber: 10,
  wildSpawnEnabled: false,
  wildMeterEnabled: false,
  allowedWildTypes: []
}
```

### **Primjer: Board 7 - Samo Regular Wild**

```typescript
{
  boardNumber: 7,
  wildSpawnEnabled: true,
  wildMeterEnabled: true,
  allowedWildTypes: ['wild'] // Samo regular wild (ne wild-beer, ne wild-magnet)
}
```

---

## 📝 API Reference

### **Funkcije:**

```typescript
// Provjeri je li wild spawn enabled za board
isWildSpawnEnabled(boardNumber?: number): boolean

// Provjeri je li wild meter enabled za board
isWildMeterEnabled(boardNumber?: number): boolean

// Dohvati dozvoljene wild types za board
getAllowedWildTypes(boardNumber?: number): ('wild' | 'wild-beer' | 'wild-magnet')[]

// Provjeri je li specific wild type dozvoljen
isWildTypeAllowed(wildType: 'wild' | 'wild-beer' | 'wild-magnet', boardNumber?: number): boolean

// Filtriraj wild type prema board rules
filterWildType(preferredType: 'wild' | 'wild-beer' | 'wild-magnet', boardNumber?: number): 'wild' | 'wild-beer' | 'wild-magnet' | null
```

### **Dodavanje Pravila Programski:**

```typescript
import { boardSpecificRules } from './board-specific-rules';

// Dodaj novo pravilo
boardSpecificRules.addRule({
  boardNumber: 8,
  wildSpawnEnabled: true,
  wildMeterEnabled: true,
  allowedWildTypes: ['wild-beer', 'wild-magnet'] // Wild-beer i wild-magnet, ali ne regular wild
});

// Ukloni pravilo (revert na default)
boardSpecificRules.removeRule(8);
```

---

## 🎯 Kako Radi

1. **U `startLevel()`** - postavlja se current board u `boardSpecificRules`
2. **U `addWildProgress()`** - provjerava se `isWildMeterEnabled()` prije dodavanja progress-a
3. **U `queueWildSpawnIfNeeded()`** - provjerava se `isWildSpawnEnabled()` prije queue-anja spawn-a
4. **U `spawnWildFromMeter()`** - koristi se `filterWildType()` za određivanje koji wild type spawnati

---

## ✅ Testiranje

### **Board 2:**
- ✅ Wild meter se ne puni (ostaje na 0)
- ✅ Nijedan wild tile se ne spawna
- ✅ Wild preloader je "zaključan"

### **Board 3:**
- ✅ Wild meter se puni normalno
- ✅ Wild tiles se spawnaju
- ✅ **Samo wild-beer** se spawna (ne wild-magnet, ne regular wild)

---

## 🚀 Buduće Mogućnosti

Modul je dizajniran da može podržati:
- Custom spawn logic per board
- Difficulty modifiers per board
- Special mechanics per board
- Time-based rules
- Score-based rules

---

**Lokacija:** `src/modules/board-specific-rules.ts`  
**Integracija:** `src/modules/app-core.ts`

