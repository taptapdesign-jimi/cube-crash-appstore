# 🎯 BOARD LEVELS - How To Guide

## 📋 Pregled

Ovaj dokument objašnjava kako podesiti **board-specific pravila** za svaki board zasebno u Cube Crash igri.

**Lokacija modula:** `src/modules/board-specific-rules.ts`

---

## 🎮 Što Možeš Kontrolirati?

### **1. Wild Tile Settings** 🍺🧲⭐

#### `wildSpawnEnabled` (boolean)
- **Opis:** Enable/disable wild tile spawning za board
- **Default:** `true` (wild tiles se spawnaju)
- **Primjer:**
  ```typescript
  wildSpawnEnabled: false  // Wild tiles se NE spawnaju
  ```

#### `allowedWildTypes` (array)
- **Opis:** Koje wild types su dozvoljene za board
- **Moguće vrijednosti:** `'wild'`, `'wild-beer'`, `'wild-magnet'`
- **Default:** `['wild', 'wild-beer', 'wild-magnet']` (sve dozvoljeno)
- **Primjeri:**
  ```typescript
  allowedWildTypes: ['wild-beer']           // Samo wild-beer
  allowedWildTypes: ['wild', 'wild-beer']  // Wild i wild-beer (ne wild-magnet)
  allowedWildTypes: []                      // Nijedan wild type (wild spawn disabled)
  ```

#### `wildMeterEnabled` (boolean)
- **Opis:** Enable/disable wild meter (progress bar) za board
- **Default:** `true` (wild meter se puni)
- **Primjer:**
  ```typescript
  wildMeterEnabled: false  // Wild meter se NE puni (ostaje na 0)
  ```

#### `wildMeterFillRate` (number)
- **Opis:** Brzina punjenja wild meter-a (multiplier)
- **Default:** `1.0` (normalna brzina)
- **Primjeri:**
  ```typescript
  wildMeterFillRate: 0.5   // Sporije punjenje (50% brzine)
  wildMeterFillRate: 1.0    // Normalna brzina
  wildMeterFillRate: 2.0    // Brže punjenje (200% brzine)
  ```

---

### **2. Gameplay Settings** 🎮

#### `maxMoves` (number)
- **Opis:** Max broj poteza za board (override default MOVES_MAX)
- **Default:** `50` (iz `MOVES_MAX` konstante)
- **Primjeri:**
  ```typescript
  maxMoves: 30   // 30 poteza (teže)
  maxMoves: 50   // 50 poteza (normalno)
  maxMoves: 70   // 70 poteza (lakše)
  ```

#### `scoreMultiplier` (number)
- **Opis:** Score multiplier za board (svi bodovi se množe s ovim brojem)
- **Default:** `1.0` (normalni bodovi)
- **Primjeri:**
  ```typescript
  scoreMultiplier: 0.5   // Pola bodova (50%)
  scoreMultiplier: 1.0   // Normalni bodovi (100%)
  scoreMultiplier: 2.0   // Duplo više bodova (200%)
  scoreMultiplier: 3.0   // Tri puta više bodova (300%)
  ```

#### `comboMultiplier` (number)
- **Opis:** Combo multiplier za board (combo se množi s ovim brojem)
- **Default:** `1.0` (normalni combo)
- **Primjeri:**
  ```typescript
  comboMultiplier: 0.5   // Pola combo (50%)
  comboMultiplier: 1.0   // Normalni combo (100%)
  comboMultiplier: 1.5   // 50% više combo (150%)
  comboMultiplier: 2.0   // Duplo više combo (200%)
  ```

---

### **3. Spawn Settings** 🎲

#### `spawnRate` (number)
- **Opis:** Spawn rate modifier (brzina spawnanja novih tiles)
- **Default:** `1.0` (normalna brzina)
- **Primjeri:**
  ```typescript
  spawnRate: 0.5   // Sporije spawnanje (50% brzine)
  spawnRate: 1.0   // Normalna brzina
  spawnRate: 1.5   // Brže spawnanje (150% brzine)
  ```

#### `initialTiles` (number)
- **Opis:** Broj početnih tiles na boardu prije početka
- **Default:** Normalni broj (iz game logic)
- **Primjeri:**
  ```typescript
  initialTiles: 5   // 5 početnih tiles
  initialTiles: 10  // 10 početnih tiles
  initialTiles: 15  // 15 početnih tiles
  ```

---

### **4. Difficulty Settings** ⚡

#### `difficulty` (string)
- **Opis:** Difficulty level za board
- **Moguće vrijednosti:** `'easy'`, `'normal'`, `'hard'`, `'extreme'`
- **Default:** `'normal'`
- **Primjeri:**
  ```typescript
  difficulty: 'easy'     // Lako
  difficulty: 'normal'   // Normalno
  difficulty: 'hard'     // Teško
  difficulty: 'extreme'  // Ekstremno
  ```

---

### **5. Custom Functions** 🔧

#### `onBoardStart` (function)
- **Opis:** Callback funkcija koja se poziva kada board počne
- **Parametri:** `(boardNumber: number) => void`
- **Primjer:**
  ```typescript
  onBoardStart: (boardNumber) => {
    console.log(`🎯 Board ${boardNumber} started!`);
    // Custom logika ovdje
    // Npr. show special message, play sound, etc.
  }
  ```

#### `onBoardEnd` (function)
- **Opis:** Callback funkcija koja se poziva kada board završi
- **Parametri:** `(boardNumber: number) => void`
- **Primjer:**
  ```typescript
  onBoardEnd: (boardNumber) => {
    console.log(`🎯 Board ${boardNumber} ended!`);
    // Custom logika ovdje
    // Npr. cleanup, save stats, etc.
  }
  ```

#### `customSpawnLogic` (function)
- **Opis:** Custom spawn funkcija za board
- **Parametri:** `(boardNumber: number) => Promise<boolean>`
- **Primjer:**
  ```typescript
  customSpawnLogic: async (boardNumber) => {
    // Custom spawn logika
    // Return true ako je spawn uspješan
    return true;
  }
  ```

---

## 📝 Kako Dodati Pravila

### **Korak 1: Otvori fajl**

Otvori `src/modules/board-specific-rules.ts` u editoru.

### **Korak 2: Pronađi BOARD_RULES array**

Pronađi `BOARD_RULES` array (oko linije 16):

```typescript
const BOARD_RULES: BoardRule[] = [
  {
    boardNumber: 2,
    wildSpawnEnabled: false,
    wildMeterEnabled: false,
    allowedWildTypes: []
  },
  {
    boardNumber: 3,
    wildSpawnEnabled: true,
    wildMeterEnabled: true,
    allowedWildTypes: ['wild-beer']
  }
];
```

### **Korak 3: Dodaj novo pravilo**

Dodaj novi objekt u `BOARD_RULES` array:

```typescript
const BOARD_RULES: BoardRule[] = [
  // Postojeća pravila...
  {
    boardNumber: 5,  // Board broj
    maxMoves: 30,
    scoreMultiplier: 2.0,
    difficulty: 'hard',
    wildMeterFillRate: 0.5,
    allowedWildTypes: ['wild', 'wild-beer']
  }
];
```

### **Korak 4: Spremi i testiraj**

Spremi fajl i testiraj u igri.

---

## 🎯 Primjeri Board Pravila

### **Primjer 1: Board 2 - Wild Preloader Zaključan**

```typescript
{
  boardNumber: 2,
  wildSpawnEnabled: false,    // Wild tiles se NE spawnaju
  wildMeterEnabled: false,     // Wild meter se NE puni
  allowedWildTypes: []         // Nijedan wild type dozvoljen
}
```

**Rezultat:**
- ✅ Wild meter ostaje na 0
- ✅ Nijedan wild tile se ne spawna
- ✅ Wild preloader je "zaključan"

---

### **Primjer 2: Board 3 - Samo Wild-Beer**

```typescript
{
  boardNumber: 3,
  wildSpawnEnabled: true,      // Wild tiles se spawnaju
  wildMeterEnabled: true,       // Wild meter se puni
  allowedWildTypes: ['wild-beer']  // Samo wild-beer dozvoljen
}
```

**Rezultat:**
- ✅ Wild meter se puni normalno
- ✅ Wild tiles se spawnaju
- ✅ **Samo wild-beer** se spawna (ne wild-magnet, ne regular wild)

---

### **Primjer 3: Board 5 - Hard Mode**

```typescript
{
  boardNumber: 5,
  maxMoves: 30,                // Manje poteza (default je 50)
  scoreMultiplier: 2.0,        // Duplo više bodova
  difficulty: 'hard',
  wildMeterFillRate: 0.5,      // Sporije punjenje wild meter-a
  allowedWildTypes: ['wild', 'wild-beer']  // Wild i wild-beer (ne wild-magnet)
}
```

**Rezultat:**
- ✅ 30 poteza umjesto 50
- ✅ Duplo više bodova za sve akcije
- ✅ Sporije punjenje wild meter-a
- ✅ Wild i wild-beer dozvoljeni (wild-magnet nije)

---

### **Primjer 4: Board 10 - Easy Mode**

```typescript
{
  boardNumber: 10,
  maxMoves: 70,                // Više poteza
  scoreMultiplier: 1.5,        // 50% više bodova
  difficulty: 'easy',
  wildMeterFillRate: 2.0,      // Brže punjenje wild meter-a
  allowedWildTypes: ['wild', 'wild-beer', 'wild-magnet']  // Sve dozvoljeno
}
```

**Rezultat:**
- ✅ 70 poteza (lakše)
- ✅ 50% više bodova
- ✅ Brže punjenje wild meter-a
- ✅ Sve wild types dozvoljene

---

### **Primjer 5: Board 20 - Extreme Mode**

```typescript
{
  boardNumber: 20,
  maxMoves: 25,                // Jako malo poteza
  scoreMultiplier: 3.0,        // Tri puta više bodova
  difficulty: 'extreme',
  wildMeterFillRate: 0.3,      // Jako sporo punjenje
  allowedWildTypes: ['wild']   // Samo regular wild (nema wild-beer, nema wild-magnet)
}
```

**Rezultat:**
- ✅ Samo 25 poteza (ekstremno teško)
- ✅ Tri puta više bodova (nagrada za težinu)
- ✅ Jako sporo punjenje wild meter-a
- ✅ Samo regular wild (nema special wild tiles)

---

### **Primjer 6: Board 7 - Custom Logic**

```typescript
{
  boardNumber: 7,
  maxMoves: 40,
  scoreMultiplier: 1.2,
  difficulty: 'normal',
  onBoardStart: (boardNumber) => {
    console.log(`🎯 Board ${boardNumber} started - special event!`);
    // Custom logika: show message, play sound, etc.
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`Welcome to Board ${boardNumber}!`);
    }
  },
  onBoardEnd: (boardNumber) => {
    console.log(`🎯 Board ${boardNumber} ended - cleanup!`);
    // Custom logika: cleanup, save stats, etc.
  }
}
```

**Rezultat:**
- ✅ Custom message kada board počne
- ✅ Custom cleanup kada board završi
- ✅ 40 poteza, 20% više bodova

---

## 🔧 Napredne Funkcije

### **Kombiniranje Parametara**

Možeš kombinirati više parametara za kompleksnije boardove:

```typescript
{
  boardNumber: 15,
  // Wild settings
  wildSpawnEnabled: true,
  wildMeterEnabled: true,
  wildMeterFillRate: 1.5,
  allowedWildTypes: ['wild-beer', 'wild-magnet'],
  
  // Gameplay settings
  maxMoves: 35,
  scoreMultiplier: 2.5,
  comboMultiplier: 1.5,
  
  // Spawn settings
  spawnRate: 0.8,
  
  // Difficulty
  difficulty: 'hard',
  
  // Custom functions
  onBoardStart: (boardNumber) => {
    console.log(`🎯 Hard board ${boardNumber} started!`);
  }
}
```

---

## 📊 Trenutna Pravila (Default)

### **Board 1:**
- Nema pravila (koristi default vrijednosti)
- Wild spawn: enabled
- Wild meter: enabled
- All wild types: allowed
- Max moves: 50
- Score multiplier: 1.0

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

## 🚀 Quick Start

### **1. Dodaj Board 5 - Hard Mode:**

```typescript
// U BOARD_RULES array, dodaj:
{
  boardNumber: 5,
  maxMoves: 30,
  scoreMultiplier: 2.0,
  difficulty: 'hard',
  wildMeterFillRate: 0.5,
  allowedWildTypes: ['wild', 'wild-beer']
}
```

### **2. Dodaj Board 10 - Easy Mode:**

```typescript
{
  boardNumber: 10,
  maxMoves: 70,
  scoreMultiplier: 1.5,
  difficulty: 'easy',
  wildMeterFillRate: 2.0,
  allowedWildTypes: ['wild', 'wild-beer', 'wild-magnet']
}
```

### **3. Testiraj:**

1. Spremi fajl
2. Restart igre
3. Testiraj board 5 i board 10
4. Provjeri da li pravila rade kako treba

---

## ⚠️ Važne Napomene

### **1. Board Number Mora Biti Jedinstven**
- Svaki board može imati samo **jedno pravilo**
- Ako dodaš više pravila za isti board, zadnje će se koristiti

### **2. Default Vrijednosti**
- Ako ne postaviš parametar, koristi se **default vrijednost**
- Default vrijednosti su definirane u modulu

### **3. Wild Types Array**
- Ako je `allowedWildTypes: []` (prazan array), wild spawn je **disabled**
- Ako je `wildSpawnEnabled: false`, `allowedWildTypes` se ignorira

### **4. Multipliers**
- `scoreMultiplier: 1.0` = normalni bodovi
- `scoreMultiplier: 2.0` = duplo više bodova
- `scoreMultiplier: 0.5` = pola bodova

### **5. Fill Rate**
- `wildMeterFillRate: 1.0` = normalna brzina
- `wildMeterFillRate: 2.0` = brže punjenje (200%)
- `wildMeterFillRate: 0.5` = sporije punjenje (50%)

---

## 🔍 Debugging

### **Provjeri da li pravilo radi:**

1. **Dodaj console.log u `onBoardStart`:**
   ```typescript
   onBoardStart: (boardNumber) => {
     console.log(`🎯 Board ${boardNumber} started with custom rules!`);
   }
   ```

2. **Provjeri u browser console:**
   - Otvori Developer Tools (F12)
   - Provjeri console za logove

3. **Provjeri wild meter:**
   - Ako je `wildMeterEnabled: false`, wild meter bi trebao ostati na 0
   - Ako je `wildMeterFillRate: 0.5`, wild meter bi trebao puniti sporije

---

## 📚 API Reference

### **Funkcije za provjeru pravila:**

```typescript
import { 
  isWildSpawnEnabled,
  isWildMeterEnabled,
  getAllowedWildTypes,
  getMaxMoves,
  getScoreMultiplier,
  getComboMultiplier,
  getWildMeterFillRate,
  getSpawnRate,
  getDifficulty
} from './board-specific-rules';

// Provjeri da li je wild spawn enabled za board 5
const enabled = isWildSpawnEnabled(5);

// Dohvati max moves za board 5
const maxMoves = getMaxMoves(5, 50); // 50 je default ako nije postavljeno

// Dohvati score multiplier za board 5
const multiplier = getScoreMultiplier(5);
```

---

## 🎯 Best Practices

### **1. Počni s jednostavnim pravilima**
- Dodaj jedan parametar po boardu
- Testiraj prije nego dodaš više parametara

### **2. Koristi smislene kombinacije**
- Hard mode = manje poteza + više bodova
- Easy mode = više poteza + normalni bodovi

### **3. Dokumentiraj svoja pravila**
- Dodaj komentare u kod
- Objasni zašto si postavio određene vrijednosti

### **4. Testiraj sve boardove**
- Provjeri da li pravila rade kako treba
- Provjeri da li nema konflikata

---

## 📝 Checklist

Prije nego što spremiš promjene:

- [ ] Board number je jedinstven
- [ ] Svi parametri su ispravnog tipa
- [ ] Wild types array sadrži samo dozvoljene vrijednosti
- [ ] Multipliers su pozitivni brojevi
- [ ] Difficulty je jedna od dozvoljenih vrijednosti
- [ ] Testirao si u igri

---

## 🆘 Troubleshooting

### **Problem: Pravilo ne radi**

**Rješenje:**
1. Provjeri da li si spremio fajl
2. Provjeri da li si restartao igru
3. Provjeri console za error-e
4. Provjeri da li je board number ispravan

### **Problem: Wild meter se ne puni**

**Rješenje:**
1. Provjeri `wildMeterEnabled: true`
2. Provjeri `wildSpawnEnabled: true`
3. Provjeri da li postoji `allowedWildTypes` array

### **Problem: Wild tiles se ne spawnaju**

**Rješenje:**
1. Provjeri `wildSpawnEnabled: true`
2. Provjeri da `allowedWildTypes` nije prazan array
3. Provjeri da wild meter dosegne 1.0

---

## 📞 Support

Ako imaš pitanja ili problema:
1. Provjeri `BOARD_SPECIFIC_RULES_README.md` za API reference
2. Provjeri `BOARD_CUSTOMIZATION_GUIDE.md` za dodatne primjere
3. Provjeri console za error poruke

---

**Lokacija modula:** `src/modules/board-specific-rules.ts`  
**Datum ažuriranja:** 2024  
**Verzija:** v70

