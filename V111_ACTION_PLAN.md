# 🎯 AKCIONI PLAN - v111 Poboljšanja

**Datum:** 2025-12-27  
**Verzija:** v111  
**Status:** Mrtvi kod uklonjen ✅

---

## 📊 TRENUTNO STANJE

### Uklonjeno:
- ✅ `checkGameOver` mrtvi kod (43 linije)
- ✅ Neiskorišćeni importi (2 linije)
- **Ukupno:** 45 linija mrtvog koda uklonjeno

### Preostali problemi:
- 🔴 `app-core.ts`: 8,635 linija (monolit)
- 🔴 `fx.js`: 6,490 linija
- 🟡 787 console.log poziva u app-core.ts
- 🟡 243 "as any" type assertions u app-core.ts
- 🟡 166 window.__cc global state poziva
- 🟡 End game redundancija

---

## 🎯 PRIORITETI ZA DALJE RADOVE

### PRIORITET 1: Brza poboljšanja (1-2 sata) ⚡

#### 1. Smanjiti console.log pozive
**Problem:**
- 787 console.log poziva u `app-core.ts`
- Može uticati na performance u production-u
- Zbunjuje debug output

**Rješenje:**
- Koristiti logger umjesto console.log
- Dodati log level (debug, info, warn, error)
- Disable debug logs u production-u

**Korist:**
- Čistiji debug output
- Bolje performance
- Profesionalniji kod

---

#### 2. Smanjiti "as any" type assertions
**Problem:**
- 243 "as any" u `app-core.ts`
- Gubi type safety
- Može uzrokovati runtime greške

**Rješenje:**
- Dodati proper TypeScript tipove
- Kreirati interfejse za tile, board, grid objekte
- Zamijeniti "as any" sa proper tipovima

**Korist:**
- Bolja type safety
- Manje runtime grešaka
- Bolji IDE support

---

#### 3. Dokumentovati window.__cc global state
**Problem:**
- 166 window.__cc poziva
- Teško pratiti global state
- Nema centralizovanog state managementa

**Rješenje:**
- Kreirati dokumentaciju za sve window.__cc flags
- Možda kreirati StateManager klasu
- Ili barem dokumentovati sve flags

**Korist:**
- Lakše razumijevanje koda
- Lakše debugovanje
- Bolja organizacija

---

### PRIORITET 2: Srednji refaktoring (2-4 sata) 🔧

#### 4. Konsolidirati end game provjere
**Problem:**
- 3-4 različite provjere na različitim mjestima
- Redundancija i timing problemi
- Potencijalni race conditions

**Rješenje:**
- Koristiti SAMO `endgame-checker.ts`
- Ukloniti duplikate iz `app-core.ts`
- Fix timing problema

**Korist:**
- Manje redundancije
- Jednostavnije održavanje
- Manje race conditions

---

#### 5. Izdvojiti helper funkcije iz app-core.ts
**Problem:**
- `app-core.ts` ima 56 funkcija
- Teško pronaći specifične funkcije
- Nema jasne organizacije

**Rješenje:**
- Izdvojiti utility funkcije u `app-core-utils.ts`
- Izdvojiti helper funkcije u `app-core-helpers.ts`
- Zadržati samo core logiku u `app-core.ts`

**Korist:**
- Lakše pronalaženje funkcija
- Bolja organizacija
- Lakše testiranje

---

### PRIORITET 3: Dugoročni refaktoring (1+ sedmica) 🏗️

#### 6. Refaktorisati app-core.ts u module
**Problem:**
- 8,635 linija u jednom fajlu
- Monolitni kod
- Teško održavanje

**Rješenje:**
- Podijeliti u module:
  - `game-core.ts` - osnovna game logika
  - `board-manager.ts` - board management
  - `tile-manager.ts` - tile management
  - `wild-meter.ts` - wild meter logika
  - `cleanup-manager.ts` - cleanup funkcije

**Korist:**
- Lakše održavanje
- Lakše testiranje
- Bolja organizacija

---

#### 7. Refaktorisati main.ts
**Problem:**
- 1,662 linija u entry point-u
- Previše logike u jednom fajlu

**Rješenje:**
- Izdvojiti u:
  - `app-initializer.ts` - initialization
  - `ui-coordinator.ts` - UI koordinacija
  - `exit-handler.ts` - exit logika

**Korist:**
- Čistiji entry point
- Bolja organizacija

---

## 🚀 PREPORUČENI REDOSLIJED

### Faza 1: Brza poboljšanja (SADA - 1-2 sata)
1. ✅ Ukloniti mrtvi kod (ZAVRŠENO)
2. ⚠️ Smanjiti console.log pozive (zamijeniti sa logger-om)
3. ⚠️ Dokumentovati window.__cc flags

### Faza 2: Type Safety (2-3 sata)
4. ⚠️ Smanjiti "as any" assertions
5. ⚠️ Dodati proper TypeScript tipove

### Faza 3: Refaktoring (1+ sedmica)
6. ⚠️ Konsolidirati end game provjere
7. ⚠️ Izdvojiti helper funkcije
8. ⚠️ Refaktorisati velike fajlove

---

## 📋 KONKRETNI KORACI ZA SADA

### Opcija A: Brza poboljšanja (1-2 sata)
1. Zamijeniti console.log sa logger-om u kritičnim funkcijama
2. Dokumentovati window.__cc flags
3. Dodati TypeScript tipove za najčešće korišćene objekte

### Opcija B: Type Safety (2-3 sata)
1. Kreirati interfejse za Tile, Board, Grid
2. Zamijeniti "as any" sa proper tipovima
3. Popraviti type safety u kritičnim funkcijama

### Opcija C: Refaktoring (1+ sedmica)
1. Izdvojiti utility funkcije iz app-core.ts
2. Konsolidirati end game provjere
3. Refaktorisati app-core.ts u module

---

## 🎯 PREPORUKA

**Za sada (1-2 sata):**
- ✅ Mrtvi kod uklonjen
- ⚠️ **Smanjiti console.log pozive** (zamijeniti sa logger-om)
- ⚠️ **Dokumentovati window.__cc flags** (kreirati dokumentaciju)

**Sledeći korak (2-3 sata):**
- ⚠️ **Smanjiti "as any" assertions** (dodati proper tipove)
- ⚠️ **Konsolidirati end game provjere** (ako je moguće)

**Dugoročno (1+ sedmica):**
- ⚠️ **Refaktorisati app-core.ts** (podijeliti u module)

---

## ✅ ŠTO MOŽEMO UČINITI SADA

### 1. Smanjiti console.log pozive
- Zamijeniti sa logger.debug/info/warn/error
- Dodati log level kontrolu
- Disable debug logs u production-u

### 2. Dokumentovati window.__cc flags
- Kreirati dokumentaciju sa svim flags
- Objasniti svrhu svakog flag-a
- Dodati primjere korišćenja

### 3. Dodati TypeScript tipove
- Kreirati interfejse za Tile, Board, Grid
- Zamijeniti najčešće "as any" sa proper tipovima
- Popraviti type safety u kritičnim funkcijama

---

**Koje opcije želiš da uradimo sada?**


