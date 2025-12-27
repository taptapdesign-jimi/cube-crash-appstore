# 🐛 Debugging Guide - Kako Debugovati sa Optimizovanim Logger-om

**Datum:** 2025-12-27  
**Verzija:** v111

---

## 🎯 Problem

Nakon optimizacije logger-a, default log level je `WARN` (samo warnings i errors).  
Kako debugovati probleme ako trebam vidjeti INFO i DEBUG logove?

---

## ✅ Rješenje: Logger Control API

Logger je sada dostupan kroz `window.__ccLogger` API za lako debugovanje!

---

## 🚀 Kako Koristiti

### 1. Privremeno Uključiti Sve Logove

**U browser konzoli:**
```javascript
// Prikaži sve logove (DEBUG level)
window.__ccLogger.showAll();
```

**Ili:**
```javascript
// Postavi log level
window.__ccLogger.setLevel('DEBUG'); // ili 'INFO', 'WARN', 'ERROR'
```

---

### 2. Kopirati Console Log

**Opcija A: Automatski kopirati u clipboard**
```javascript
// Kopira sve logove u clipboard (formatirano)
window.__ccLogger.exportLogs();
```

**Opcija B: Prikazati u konzoli**
```javascript
// Dobij logove kao tekst
const logs = window.__ccLogger.exportLogs();
console.log(logs);
```

**Opcija C: Dobij kao array**
```javascript
// Dobij logove kao array objekata
const logs = window.__ccLogger.getLogs();
console.table(logs); // Prikaži kao tabelu
```

---

### 3. Debug Scenariji

#### Scenario 1: Debug Asset Loading
```javascript
// 1. Uključi DEBUG logove
window.__ccLogger.setLevel('DEBUG');

// 2. Osvježi stranicu ili pokreni akciju

// 3. Kopiraj logove
window.__ccLogger.exportLogs();

// 4. Vrati na WARN level
window.__ccLogger.showWarnings();
```

#### Scenario 2: Debug Journey Badge
```javascript
// 1. Uključi INFO logove (samo važne, ne sve DEBUG)
window.__ccLogger.setLevel('INFO');

// 2. Klikni na Journey tab

// 3. Kopiraj logove
const logs = window.__ccLogger.exportLogs();
console.log(logs);

// 4. Vrati na WARN
window.__ccLogger.showWarnings();
```

#### Scenario 3: Debug Animacije
```javascript
// 1. Uključi DEBUG logove
window.__ccLogger.showAll();

// 2. Pokreni animaciju (npr. bounce)

// 3. Kopiraj logove
window.__ccLogger.exportLogs();

// 4. Vrati na WARN
window.__ccLogger.showWarnings();
```

---

## 📋 Logger API Reference

### `window.__ccLogger.setLevel(level)`
Postavi log level:
- `'DEBUG'` - prikaži sve logove
- `'INFO'` - prikaži INFO, WARN, ERROR
- `'WARN'` - prikaži samo WARN i ERROR (default)
- `'ERROR'` - prikaži samo ERROR
- `'FATAL'` - prikaži samo FATAL

**Primjer:**
```javascript
window.__ccLogger.setLevel('INFO');
```

---

### `window.__ccLogger.getLevel()`
Vrati trenutni log level.

**Primjer:**
```javascript
const level = window.__ccLogger.getLevel();
console.log(`Current level: ${level}`); // "WARN"
```

---

### `window.__ccLogger.showAll()`
Prikaži sve logove (DEBUG level).

**Primjer:**
```javascript
window.__ccLogger.showAll();
```

---

### `window.__ccLogger.showWarnings()`
Prikaži samo warnings i errors (WARN level - default).

**Primjer:**
```javascript
window.__ccLogger.showWarnings();
```

---

### `window.__ccLogger.exportLogs()`
Kopiraj sve logove u clipboard (formatirano).

**Primjer:**
```javascript
window.__ccLogger.exportLogs();
// Logovi su sada u clipboard-u, možeš ih paste-ati gdje hoćeš
```

**Format:**
```
[INFO] 2025-12-27T12:43:59.272Z [CubeCrash] ✅ UI bootstrap completed
[WARN] 2025-12-27T12:43:59.303Z [CubeCrash] 🔊 Assets.addParser not available
[DEBUG] 2025-12-27T12:43:59.305Z [app-core] 🧹 Clearing 5 pending timeouts
```

---

### `window.__ccLogger.getLogs()`
Vrati logove kao array objekata.

**Primjer:**
```javascript
const logs = window.__ccLogger.getLogs();
console.table(logs); // Prikaži kao tabelu
console.log(logs[0]); // Prvi log entry
```

**Format:**
```javascript
[
  {
    timestamp: "2025-12-27T12:43:59.272Z",
    level: 1, // LogLevel.INFO
    message: "✅ UI bootstrap completed",
    context: "CubeCrash",
    data: undefined
  },
  // ...
]
```

---

### `window.__ccLogger.clear()`
Obriši sve logove.

**Primjer:**
```javascript
window.__ccLogger.clear();
```

---

## 🎯 Best Practices

### 1. Debug Workflow
```javascript
// 1. Uključi verbose logove
window.__ccLogger.showAll();

// 2. Reproduciraj problem

// 3. Kopiraj logove
const logs = window.__ccLogger.exportLogs();

// 4. Vrati na default
window.__ccLogger.showWarnings();
```

### 2. Fokusirano Debugovanje
```javascript
// Umjesto svega, fokusiraj se na specifičan modul
window.__ccLogger.setLevel('INFO'); // Samo važne logove

// Ili koristi browser filter:
// U DevTools Console, filter: "app-core" ili "journey"
```

### 3. Export za AI/Support
```javascript
// Kopiraj logove za AI analizu
const logs = window.__ccLogger.exportLogs();
// Paste u chat sa AI-om ili support ticket
```

---

## 🔍 Browser DevTools Tips

### Filter Logs u Console
1. Otvori DevTools (F12)
2. Idi na Console tab
3. U filter box, unesi:
   - `app-core` - samo app-core logove
   - `journey` - samo journey logove
   - `WARN` - samo warnings
   - `ERROR` - samo errors

### Export Console History
1. Desni klik na console
2. "Save as..." - sačuvaj console history
3. Ili koristi `window.__ccLogger.exportLogs()`

---

## 📊 Log Level Comparison

| Level | Prikazuje | Kada Koristiti |
|-------|-----------|----------------|
| **DEBUG** | Sve logove | Detaljno debugovanje, sve verbose info |
| **INFO** | INFO, WARN, ERROR | Normalno debugovanje, važne informacije |
| **WARN** | WARN, ERROR | Production default, samo problemi |
| **ERROR** | ERROR, FATAL | Samo kritične greške |
| **FATAL** | FATAL | Samo fatalne greške |

---

## 🎯 Primjeri

### Primjer 1: Debug Asset Loading Problem
```javascript
// 1. Uključi DEBUG
window.__ccLogger.showAll();

// 2. Osvježi stranicu
location.reload();

// 3. Sačekaj da se učita

// 4. Kopiraj logove
const logs = window.__ccLogger.exportLogs();
console.log('=== ASSET LOADING LOGS ===');
console.log(logs);

// 5. Vrati na default
window.__ccLogger.showWarnings();
```

### Primjer 2: Debug Journey Badge Problem
```javascript
// 1. Uključi INFO (samo važne, ne sve)
window.__ccLogger.setLevel('INFO');

// 2. Klikni na Journey tab
// (badge se ažurira)

// 3. Kopiraj logove
window.__ccLogger.exportLogs();

// 4. Vrati na default
window.__ccLogger.showWarnings();
```

### Primjer 3: Debug Animation Problem
```javascript
// 1. Uključi DEBUG
window.__ccLogger.showAll();

// 2. Pokreni animaciju (npr. bounce)

// 3. Sačekaj nekoliko sekundi

// 4. Kopiraj logove
const logs = window.__ccLogger.exportLogs();

// 5. Filtriraj samo animation logove
const animationLogs = logs.split('\n').filter(line => 
  line.includes('Bounce') || line.includes('Animation')
);
console.log(animationLogs.join('\n'));

// 6. Vrati na default
window.__ccLogger.showWarnings();
```

---

## ✅ Zaključak

**Sada možeš:**
- ✅ Privremeno uključiti verbose logove kada ti trebaju
- ✅ Lako kopirati console log za AI/support
- ✅ Fokusirano debugovati specifične module
- ✅ Vratiti na čistu konzolu kada ne trebaš verbose logove

**Workflow:**
1. `window.__ccLogger.showAll()` - uključi verbose
2. Reproduciraj problem
3. `window.__ccLogger.exportLogs()` - kopiraj logove
4. `window.__ccLogger.showWarnings()` - vrati na default

---

**Datum:** 2025-12-27  
**Verzija:** v111  
**Status:** ✅ Ready za debugging


