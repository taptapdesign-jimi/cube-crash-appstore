# Kako da vidiš logove kad se igrica crasha 🐛

## Ljubazna verzija za početnika 😊

### Korak 1: Otvori Xcode
- U Terminalu napisi: `npx cap open ios`
- Xcode će se otvoriti sam

### Korak 2: Pokreni igru na mobitelu
- Na vrhu Xcode-a, pored "Play" (▶️), odaberi tvoj iPhone
- Klikni **Command + R** (ili Run gumb)
- Igrica će se pokrenuti na mobitelu

### Korak 3: Otvori Console
- U **dnu** Xcode-a su tabovi (lijeva strana)
- Klikni **"Console"** (ili **"All Output"**)
- Tu su logovi i greške

### Korak 4: Crashaj igru
- Na mobitelu klikni **"End This Run"** → **"Restart"**
- Pogledaj što se pojavi u Console-u

### Korak 5: Kopiraj error
- U Console-u se vidi crveni error
- Oznaci ga i **Command + C** (kopiraj)
- Ispošalji ga u chat

---

## Gde da tražiš logove? 📍

```
Xcode vrh
┌─────────────────────────────────────────────────┐
│ Product ▶️  iPhone 13  ▶️  Run (Command + R)   │
├─────────────────────────────────────────────────┤
│                                                 │
│           IGRICA IDE OVDE                       │
│          (video preview ili                    │
│         simulator/device window)               │
│                                                 │
├─────────────────────────────────────────────────┤
│ 🔍 Console  [All Output ▼]  Filter... 🔒      │  ← OVDE KLIKNI!
│ ┌───────────────────────────────────────────┐ │
│ │ ⚠️  [ERROR] TypeError: Cannot set...      │ │  ← OVDE SU ERRORS!
│ │ 🔄 RESTART GAME: Killing GSAP...          │ │
│ │ ✅ Tile GSAP animations killed             │ │
│ └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Alternativa: Web Inspector 📱🌐

Ako Xcode ne radi, možeš koristiti Safari Web Inspector:

### Mac + iPhone (isti WiFi):

1. **iPhone:** 
   - Settings → Safari → Advanced → Web Inspector (**ON**)

2. **Mac (Safari):**
   - Safari → Develop → [Tvoj iPhone] → localhost:5173
   - Otvorit će se console kao u Chrome

### Windows:
- Koristi Safari debugger preko Xcode simulacije
- Ili Chrome DevTools Remote Debugging za Android

---

## Što ako nema errora? 🤔

Ako Console nema ništa (crni tekst), onda:
1. Igrica se crash-ala **PRE** nego što je error stigao u console
2. Možda je **memory crash** (Xcode će pokazati "Terminated due to memory issue")

**Provjeri:**
- U Xcode-u, na **dnu**, tab **"Report Navigator"** (ikona lista)
- Tamo su crashovi (crveni znakovi)
- Klikni na crash i pogledaj **"Exception"** i **"Termination Reason"**

---

## Quick Commands (copy-paste)

```bash
# Otvori Xcode
npx cap open ios

# Pokreni grad
npm run build
npx cap sync ios

# Clean build (kad nešto ne radi)
# U Xcode: Cmd + Shift + K (Clean Build Folder)
```

---

## Važno pitanje: Da li se crash-a NA WEBU ILI SAMO NA MOBITELU?

### Ako crash-a i na webu:
```bash
# Pokreni dev server
npm run dev

# Otvori u Chrome
http://localhost:5173

# Otvori Developer Tools (F12 ili Cmd+Opt+I)
# Console tab → crash
```

### Ako crash-a SAMO na mobitelu:
- To znači da je **Capacitor/PIXI problem**
- Možda **memory leak** ili **native bridge** error
- Trebaš Xcode Console ili Safari Web Inspector

---

## Šalji mi ovaj screenshot:

1. Xcode je otvoren
2. Console tab je u fokusu
3. Igrica je crash-ana
4. Error je **vidljiv** na ekranu
5. **Screenshot** pošalji → ja ću pročitati error 🤓

---

## Bonus: Debug Alerts

Ako ne vidiš error, dodaj alert() kao backup:

```javascript
// U console-u iPhone Safari
window.addEventListener('error', (e) => {
  alert('ERROR: ' + e.message);
});

// Ili u kodu
try {
  // tvoj kod
} catch (e) {
  alert('CRASH: ' + e.message);
}
```

Alert će pasti na mobitelu → screenshot/opis → posalji mi.

---

## TL;DR

**Xcode Console je na dnu, tab "Console" ili "All Output". Crash → pogledaj tu. Error → screenshot ili copy/paste → posalji mi. 🎯**

