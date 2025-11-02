# 🎮 Kako Testirati Igru - Objašnjeno Jednostavno

## 🧩 Što je "Testiranje"?

Testiranje = igranje igre da vidimo radi li dobro!

Kao kad testiraš bicikl prije nego što odeš na ceste - proveravaš kočnice, zvono, svjetla...

## 🎯 Kako Ja (AI) Mogu Testirati?

Ja **NEMOGU** stvarno igrati igru kao čovjek! ❌

Ali mogu:
1. ✅ Pregledati kod - "gledam" što kaže kod
2. ✅ Proveriti logiku - vidim da li ima greške u razmišljanju
3. ✅ Nalaziti probleme - tražim stvari koje "ne štima"

**Problem:** Ja ne vidim animacije, ne osjećam lag, ne mogu klikati mišem!

## 🤖 Što je "Automatsko Testiranje"?

To je kao robot koji igra igru umjesto tebe!

### Što robot radi:
1. **Klikne** na "Play" dugme
2. **Čeka** da se igra učitava
3. **Klikne** na kockice
4. **Proverava** da li se desi ono što treba

### Primjer automatskog testa:

```javascript
// Robot kaže:
1. Klikni "Play"
2. Sačekaj 2 sekunde
3. Klikni na kockicu na poziciji (2, 3)
4. Proveri: da li se kockica pomjerila? ✅ ili ❌
5. Ako ❌ → ZOVI PROGRAMERA! 🚨
```

## 👨‍💻 Što Ti Možeš Napraviti (Testiranje Ručno)

Ti si NAJBOLJI tester jer znaš kako igra treba da izgleda!

### 🎮 Test Plan (Plan Testiranja)

#### Test 1: Nova Igra
```
1. Otvori igru u browseru
2. Klikni "Play"
3. Da li se igra učitala? ✅ ili ❌
```

#### Test 2: Save Progress
```
1. Otvori igru
2. Napravi par poteza (pomeri kockice)
3. Klikni "Exit" (izadji)
4. Ponovo klikni "Play"
5. Da li vidiš "Continue" opciju? ✅ ili ❌
6. Klikni "Continue"
7. Da li se vratio tvoj progress? ✅ ili ❌
```

#### Test 3: Exit i Continue
```
1. Igraj igru do score 20
2. Klikni "Exit"
3. Klikni "Play" → "Continue"
4. Da li je tvoj score 20? ✅ ili ❌
```

#### Test 4: Restart
```
1. Igraj igru
2. Klikni "Restart"
3. Da li je score sada 0? ✅ ili ❌
4. Da li je ploča prazna? ✅ ili ❌
```

#### Test 5: Animacije
```
1. Klikni "Play"
2. Gledaj kako kockice "skaču" (spawn animacija)
3. Da li su glatke (nema zastoja)? ✅ ili ❌
4. Klikni "Exit"
5. Gledaj kako kockice "napustljaju" ploču (exit animacija)
6. Da li izgleda dobro? ✅ ili ❌
```

#### Test 6: iPad/Mobile
```
1. Promijeni veličinu browsera (ili otvori na iPadu)
2. Da li je ploča pravilno velika? ✅ ili ❌
3. Da li se HUD prikazuje korektno? ✅ ili ❌
```

## 📱 Testiranje u Xcode

Xcode ima **EKSKLUZIVNE** stvari koje browser ne može!

### Xcode može da:
1. **Vidi memory (memoriju)** - koliko memorije koristi igra
2. **Vidi crash logs** - čim se nešto pokvari
3. **Testira na PRAVOM iPhonu/iPadu** - točan doživljaj
4. **Merí performanse** - FPS (koliko slika po sekundi)
5. **Vidi bateriju** - koliko baterije troši

### Kako testirati u Xcode:

#### Korak 1: Otvori Xcode
```
1. Otici u folder: /Users/user/cube-crash/ios
2. Click dvaput na: App.xcworkspace
3. Xcode će se otvoriti
```

#### Korak 2: Priključi iPhone/iPad
```
1. Priključi svoj iPhone USB kablom
2. Klikni na ime tvojeg iPhonea (gore lijevo u Xcode)
3. Učitat će se tvoj iPhone kao simulator
```

#### Korak 3: Pokreni igru na iPhoneu
```
1. Klikni veliki "Play" dugme (▶️) u Xcode-u
2. Xcode će poslati igru na tvoj iPhone
3. Igra će se otvoriti na tvoj iPhone-u
```

#### Korak 4: Gledaj Logove (Šta se dešava iza kulisa)
```
1. Na dnu Xcode-a vidiš "Console" (komandna linija)
2. SVE što se dešava prikazuje se tamo
3. Vidiš: 💾 Game saved! ✅ ili ❌ ERROR: something broke
```

#### Korak 5: Testiraj Memory
```
1. U Xcode-u, klikni na "Debug Memory Graph" dugme
2. Vidiš koliko memorije igra koristi
3. Ako ide preko 500 MB → PROBLEM! 🚨
```

### Što da Tražiš u Xcode Console:

#### ✅ DOBRO:
```
✅ Game saved!
✅ Board exit animation completed
✅ Tiles spawned
✅ HUD dropped
```

#### ❌ LOŠE:
```
❌ ERROR: Cannot read property
❌ FATAL: TypeError
❌ WARNING: Memory leak detected
❌ ERROR: ReferenceError
```

## 🤖 Automatsko Testiranje (Što Mogu Dodati)

Mogu dodati "robote" koji automatski testiraju, ali:

### Problemi sa automatskim testiranjem:
1. Ne mogu "vidjeti" kako igra **izgleda**
2. Ne mogu osjetiti da li je **glatka** (animacije)
3. Mogu testirati samo **logiku** (što je kod)

### Što mogu automatski testirati:
```javascript
// Test: Da li save radi?
test('save game state', () => {
  const game = new Game();
  game.score = 50;
  game.save();
  const loadedGame = game.load();
  expect(loadedGame.score).toBe(50); // Trebalo bi biti 50!
});
```

### Što ne mogu automatski testirati:
```
❌ Da li animacije izgledaju dobro?
❌ Da li je font pravilno veliki?
❌ Da li je boja pravilna?
❌ Da li se osjeća glatko na prstima?
```

## 📋 Moj Plan: Testiranje za v7

### Faza 1: Ručno Testiranje (TI) ✅
1. Testiraj svu funkcionalnost iz test plana gore
2. Piši sve što ne radi kako treba
3. Šalji mi screene i logove iz Xcode

### Faza 2: Xcode Profiling (TI + Xcode) ✅
1. Otvori Xcode
2. Pokreni igru na fizičkom uređaju
3. Gledaj memory graf
4. Piši koliko memorije koristi

### Faza 3: Automatsko Testiranje (JA) 🚧
1. Dodajem unit testove za:
   - Save/Load logiku ✅
   - Game state management ✅
   - Score calculations ✅
2. Pokrećem: `npm test` 
3. Vidiš rezultate

### Faza 4: Performance Test (TI + Xcode) 🚧
1. U Xcode, klikni na "Profile" dugme
2. Izaberi "Time Profiler"
3. Igraj igru 5 minuta
4. Gledaj koji dio je spor

## 🎯 Što Je NAJBOLJE Testiranje?

**1. TI testiraš KORISNIČKO ISKUSTVO** - najvažnije! 👑
- Da li je zabavno?
- Da li je glatko?
- Da li izgleda dobro?

**2. XCODE testira TEHNIČKE STVARI** 
- Memory leaks
- Performance
- Crashevi

**3. AUTOMATSKI TESTOVI testiraju LOGIKU**
- Da li kod radi kako treba
- Da li edge cases rade

## 🚀 Kako Da Počnem Sada?

### Korak 1: Testiraj Osnovne Stvari
```
✅ Otvori igru u browseru
✅ Klikni Play
✅ Napravi par poteza
✅ Exit
✅ Continue
✅ Videćeš da li radi
```

### Korak 2: Otvori Xcode
```
✅ Git clone projekat
✅ cd ios && open App.xcworkspace
✅ Priključi iPhone
✅ Klikni Play u Xcode
✅ Gledaj console logove
```

### Korak 3: Javi Mi Sve Što Ne Radi
```
✅ Piši: "Score se ne čuva"
✅ Piši: "Animacija laguje"
✅ Šalji screenshot
✅ Šalji Xcode logove
```

## 📊 Rezime

| Što | Ko Testira | Kako |
|-----|-----------|------|
| Izgled i animacije | 👨‍💻 TI | Ručno klikati |
| Memory i performanse | 📱 XCODE | Profiliranje |
| Logika koda | 🤖 AUTOMATSKI | Unit testovi |
| UX (korisničko iskustvo) | 👑 TI | Igraj i osjeti |

**Najbolji tester = TI!** Ja mogu pomoći sa automatskim testovima, ali samo TI može reći da li je igra DOBRA! 🎮

