# 🔍 ANALIZA .js vs .ts FAJLOVA

## 📋 SAŽETAK

Pronađeno je **nekoliko parova** `.js` i `.ts` fajlova:

1. **`app-board.js`** vs **`app-board.ts`**
2. **`spawn-helpers.js`** vs **`spawn-helpers.ts`**
3. **`install-drag.js`** vs **`install-drag.ts`**

---

## 📊 DETALJNA ANALIZA

### 1. `app-board.js` vs `app-board.ts`

#### `app-board.js` (KORISTI SE) ✅
- **Koristi se u**: `app-core.ts`, `app-merge.ts`, `app-boot.ts`
- **Funkcije**: `sweetPopIn`, `sweetPopOut`, `rebuildBoard`, `resetBoardContainer`
- **Status**: ✅ **AKTIVAN** - koristi se u projektu

#### `app-board.ts` (NE KORISTI SE) ❌
- **Koristi se u**: NIGDJE
- **Funkcije**: `sweetPopIn`, `rebuildBoard` (ali NEMA `sweetPopOut`!)
- **Status**: ❌ **NEISKORIŠTEN** - možda stara verzija ili work in progress

**Problem**: `app-board.ts` nema `sweetPopOut` funkciju koja se koristi u projektu!

**Rješenje**: **OBRISATI** `app-board.ts` - nije kompletna verzija

---

### 2. `spawn-helpers.js` vs `spawn-helpers.ts`

#### `spawn-helpers.js` (KORISTI SE) ✅
- **Koristi se u**: `app-core.ts`
- **Funkcije**: `spawnBounce`, `openEmpties`, itd.
- **Status**: ✅ **AKTIVAN** - koristi se u projektu

#### `spawn-helpers.ts` (NE KORISTI SE) ❌
- **Koristi se u**: NIGDJE
- **Funkcije**: Iste funkcije, ali TypeScript verzija
- **Status**: ❌ **NEISKORIŠTEN** - možda stara verzija ili work in progress

**Rješenje**: **OBRISATI** `spawn-helpers.ts` - nije se koristi

---

### 3. `install-drag.js` vs `install-drag.ts`

#### `install-drag.js` (KORISTI SE) ✅
- **Koristi se u**: `app-core.ts`, `app-boot.ts`
- **Funkcije**: `installDrag`
- **Status**: ✅ **AKTIVAN** - koristi se u projektu

#### `install-drag.ts` (NE KORISTI SE) ❌
- **Koristi se u**: NIGDJE
- **Funkcije**: Iste funkcije, ali TypeScript verzija
- **Status**: ❌ **NEISKORIŠTEN** - možda stara verzija ili work in progress

**Rješenje**: **OBRISATI** `install-drag.ts` - nije se koristi

---

### 4. `hud-helpers.js` (SAMO .js)

#### `hud-helpers.js` (KORISTI SE) ✅
- **Koristi se u**: `app-core.ts`, `app-merge.ts`, `main.ts`
- **Status**: ✅ **AKTIVAN** - koristi se u projektu
- **Nema .ts verziju** - OK

---

### 5. `fx-helpers.js` (SAMO .js)

#### `fx-helpers.js` (KORISTI SE) ✅
- **Koristi se u**: `app-core.ts`
- **Status**: ✅ **AKTIVAN** - koristi se u projektu
- **Nema .ts verziju** - OK

---

## ✅ PREPORUKE

### Prioritet 1 (VISOK):
1. **OBRISATI** `app-board.ts` - nema `sweetPopOut`, nije kompletna
2. **OBRISATI** `spawn-helpers.ts` - nije se koristi
3. **OBRISATI** `install-drag.ts` - nije se koristi

### Ukupno za brisanje:
- **`app-board.ts`** - ~284 linija
- **`spawn-helpers.ts`** - ~203 linija
- **`install-drag.ts`** - ~? linija

**Ukupno**: ~500+ linija mrtvog koda

---

## 🎯 AKCIJA

**Trenutno stanje**: 
- ✅ Identificirani problemi
- ⏳ Čeka implementaciju

**Sljedeći korak**: 
- Obrisati neiskorištene .ts verzije

