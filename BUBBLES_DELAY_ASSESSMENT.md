# Assessment: Zašto postoji delay u animaciji mjehurića nakon merge 6 wild-juice

## Problem
Mjehurići se ne vide odmah kada se napravi merge 6 wild-juice sa običnom kockicom. Postoji delay od ~1 sekunde.

## Root Cause Analysis

### 1. Timing Issue - Poziv bubbles animacije je prekasno
**Lokacija:** `src/modules/app-core.ts`, linija ~3473

**Problem:**
- `createWildJuiceBubblesExplosion` se poziva tek kada se pozove `woodShardsAtTile`
- Ali `woodShardsAtTile` se poziva tek nakon svih provjera u `effSum === 6` bloku:
  - Last merge detection (linija 2324-2578)
  - Wild-magnet pull logic (linija 2361-2418)
  - Active tiles counting (linija 2334-2358)
  - Can merge together check (linija 2510-2518)
  - Last merge flag setting (linija 2556-2578)
  - Haptic feedback (linija 2610-2623)
  - Wild-magnet tile finding (linija 2642-2673)

**Rezultat:** Delay od ~500ms-1000ms između trenutka kada se merge 6 detektira i kada se bubbles animacija pokrene.

### 2. Funkcija `createWildJuiceBubblesExplosion` ima dodatni delay
**Lokacija:** `src/modules/fx.js`, linija 1279-1653

**Problem:**
- Funkcija koristi GSAP ticker za spawnanje mjehurića
- Prvi batch mjehurića se spawna tek kada ticker počne raditi
- Iako postoji "initial batch" spawn (linija 1586-1608), on se spawna tek nakon što se funkcija pozove

**Rezultat:** Dodatni delay od ~16-33ms (1-2 frame-a) prije nego što se mjehurići vide.

## Workaround Ideja

### Rješenje 1: Premjestiti poziv bubbles animacije na sam početak `effSum === 6` bloka
**Prednosti:**
- Mjehurići će se pokrenuti odmah kada se merge 6 detektira
- Prije svih provjera i logike
- Korisnik će vidjeti mjehuriće istovremeno s početkom merge 6 procesa

**Implementacija:**
1. Premjestiti poziv `createWildJuiceBubblesExplosion` na liniju ~2318 (odmah nakon `if (effSum === 6){`)
2. Provjeriti da li je wild-juice merge PRIJE nego što se pozove funkcija
3. Koristiti `src` i `dst` tile-ove koji su još uvijek dostupni

### Rješenje 2: Spawnati prvi batch mjehurića SINHRONO prije ticker-a
**Prednosti:**
- Mjehurići će biti vidljivi odmah, bez čekanja na ticker
- Korisnik će vidjeti mjehuriće prije nego što se animacija zapravo pokrene

**Implementacija:**
1. U `createWildJuiceBubblesExplosion`, spawnati prvi batch mjehurića SINHRONO (bez ticker-a)
2. Postaviti ih na poziciju gdje će biti vidljivi odmah
3. Zatim pokrenuti ticker za ostatak mjehurića

### Rješenje 3: Kombinirati oba pristupa
**Prednosti:**
- Maksimalna brzina - mjehurići se vide odmah
- Najbolje korisničko iskustvo

**Implementacija:**
1. Premjestiti poziv na početak `effSum === 6` bloka
2. Spawnati prvi batch sinhrono
3. Pokrenuti ticker za ostatak

## Preporučeno Rješenje

**Rješenje 3 (Kombinirano)** - najbolje korisničko iskustvo:
1. Premjestiti poziv `createWildJuiceBubblesExplosion` na sam početak `effSum === 6` bloka
2. Spawnati prvi batch mjehurića sinhrono (bez ticker-a) za instant vidljivost
3. Pokrenuti ticker za ostatak mjehurića

## Test Plan

1. Napraviti merge 6 wild-juice sa običnom kockicom
2. Provjeriti da li se mjehurići vide ODMAH (bez delay-a)
3. Provjeriti da li se mjehurići vide PRIJE shards animacije
4. Provjeriti da li animacija teče glatko bez lag-a




