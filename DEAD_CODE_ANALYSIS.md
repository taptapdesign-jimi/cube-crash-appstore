# 🔍 ANALIZA MRTVOG KODA I DUPLICIRANJA

## 📋 SAŽETAK

Pronađeno je **nekoliko problema** s mrtvim kodom i dupliciranjem:

1. **Neiskorištene datoteke**: 1 datoteka
2. **Duplicirane funkcije**: 5+ funkcija
3. **Duplicirani utility kod**: 3+ utility funkcije

---

## ❌ NEISKORIŠTENE DATOTEKE

### 1. `clean-board-animations.ts`
- **Status**: ❌ NIKAD SE NE KORISTI
- **Lokacija**: `src/modules/clean-board-animations.ts`
- **Problem**: Nema niti jednog importa u cijelom projektu
- **Rješenje**: **OBRISATI** datoteku (587 linija mrtvog koda)

```bash
# Provjera
grep -r "clean-board-animations" src/
# Rezultat: Samo sebe spominje
```

---

## 🔄 DUPLICIRANE FUNKCIJE

### 1. `formatScore()` - 2 verzije

#### a) `clean-board-modal.ts` (lokalna)
```typescript
const formatScore = (value: number): string => {
  const safe = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return safe.toString();
};
```

#### b) `hud-utils.ts` (export)
```typescript
export function formatScore(score: number): string {
  if (score >= 1000000) {
    return (score / 1000000).toFixed(1) + 'M';
  } else if (score >= 1000) {
    return (score / 1000).toFixed(1) + 'K';
  }
  return score.toString();
}
```

**Problem**: Različite implementacije!
- `clean-board-modal.ts` - jednostavna (bez K/M)
- `hud-utils.ts` - s K/M sufixima

**Rješenje**: 
- Koristiti `formatScore` iz `hud-utils.ts` u `clean-board-modal.ts`
- ILI kreirati `formatScoreSimple` ako treba bez K/M

---

### 2. `pickRandom()` - 3 verzije

#### a) `clean-board-modal.ts`
```typescript
const pickRandom = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];
```

#### b) `board-fail-modal.ts`
```typescript
function pickRandom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)] || list[0];
}
```

#### c) `clean-board-utils.ts` (export)
```typescript
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
```

**Problem**: Ista logika, 3 puta definirana!

**Rješenje**: 
- Koristiti `pickRandom` iz `clean-board-utils.ts` svugdje
- ILI kreirati zajednički utility modul

---

### 3. `getCurrentScore()` - 3 verzije

#### a) `clean-board-utils.ts`
```typescript
export function getCurrentScore(): number {
  if (modalParams.getScore) {
    return modalParams.getScore();
  }
  return 0;
}
```

#### b) `pause-utils.ts`
```typescript
export function getCurrentScore(): number {
  // ... implementacija
}
```

#### c) `end-run-utils.ts`
```typescript
export function getCurrentScore(): number {
  // ... implementacija
}
```

**Problem**: Ista funkcija, 3 puta definirana!

**Rješenje**: 
- Konsolidirati u jedan utility modul
- ILI koristiti zajednički `game-state.ts`

---

### 4. `layout()` - 5 verzija

#### a) `app-core.ts`
```typescript
export function layout(){
  // Board layout
}
```

#### b) `hud-helpers.js`
```typescript
export function layout({ app, top }) { 
  // HUD layout
}
```

#### c) `app-boot.ts`
```typescript
function layout(): void {
  // Boot layout
}
```

#### d) `hud-components.ts`
```typescript
export function layoutHUD({ app, top = 8 }: LayoutParams): void {
  // HUD components layout
}
```

#### e) `hud-core.ts`
```typescript
export function layout({ app, top = 8 }: LayoutParams): void {
  // HUD core layout
}
```

**Problem**: Različite funkcije, ali slične svrhe!

**Rješenje**: 
- ✅ **OK** - različite funkcije za različite svrhe
- Možda preimenovati za jasnoću (npr. `layoutBoard`, `layoutHUD`)

---

## 🔄 DUPLICIRANI UTILITY KOD

### 1. `clean-board-ui.ts` - možda neiskorištena?

**Status**: ⚠️ **PROVJERITI**
- Koristi se samo u `clean-board-utils.ts`
- Ali `clean-board-utils.ts` možda nije potreban

**Provjera potrebna**: 
- Da li se `clean-board-ui.ts` koristi negdje?
- Da li se `clean-board-utils.ts` koristi negdje?

---

### 2. Duplicirani `.js` i `.ts` fajlovi

#### a) `app-board.js` i `app-board.ts`
- **Status**: ⚠️ **PROVJERITI**
- Moguće da je `.js` stara verzija

#### b) `spawn-helpers.js` i `spawn-helpers.ts`
- **Status**: ⚠️ **PROVJERITI**
- Moguće da je `.js` stara verzija

**Rješenje**: 
- Provjeriti koja se verzija koristi
- Obrisati neiskorištenu

---

## 📊 STATISTIKA

### Neiskorištene datoteke:
- `clean-board-animations.ts` - **587 linija** ❌

### Duplicirane funkcije:
- `formatScore` - 2 verzije
- `pickRandom` - 3 verzije
- `getCurrentScore` - 3 verzije
- `layout` - 5 verzija (ali različite svrhe, OK)

### Ukupno mrtvog koda:
- **~587 linija** (samo `clean-board-animations.ts`)
- **~50-100 linija** (duplicirane funkcije)

---

## ✅ PREPORUKE

### Prioritet 1 (VISOK):
1. **OBRISATI** `clean-board-animations.ts` - nema importa
2. **Konsolidirati** `pickRandom()` - koristiti iz `clean-board-utils.ts`
3. **Konsolidirati** `formatScore()` - koristiti iz `hud-utils.ts` ili kreirati `formatScoreSimple`

### Prioritet 2 (SREDNJI):
4. **Konsolidirati** `getCurrentScore()` - koristiti zajednički utility
5. **Provjeriti** `clean-board-ui.ts` i `clean-board-utils.ts` - da li se koriste?

### Prioritet 3 (NIZAK):
6. **Provjeriti** `.js` vs `.ts` fajlove - obrisati stare verzije
7. **Preimenovati** `layout()` funkcije za jasnoću (opcionalno)

---

## 🎯 AKCIJA

**Trenutno stanje**: 
- ✅ Identificirani problemi
- ⏳ Čeka implementaciju

**Sljedeći korak**: 
- Implementirati preporuke prioriteta 1

