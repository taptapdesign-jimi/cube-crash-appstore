# 🔍 KAKO PROVJERITI FRAME DROP U DEVTOOLS

## 📊 METODA 1: Console Helper Funkcije (NAJLAKŠE)

### **Nakon što bubbles animacija počne, u DevTools Console stavi:**

```javascript
// 1. Provjeri trenutno stanje
getBubbleStats()

// 2. Pokreni monitoring (svakih 500ms)
monitorBubbles(500)

// 3. Zaustavi monitoring
stopBubbleMonitor()
```

### **Što ćeš vidjeti:**
```
💧 Bubbles: 83/125 spawned, 83 active, 83 visible, FPS: 58.2
💧 Bubbles: 125/125 spawned, 125 active, 125 visible, FPS: 45.3
💧 Bubbles: 125/125 spawned, 98 active, 98 visible, FPS: 52.1
```

---

## 📊 METODA 2: Performance Tab (NAJTOČNIJE)

### **Koraci:**
1. **Otvori DevTools** (F12 ili Cmd+Option+I)
2. **Idi na Performance tab**
3. **Klikni Record** (●)
4. **Trigger bubbles animaciju** (merge 6 wild-beer)
5. **Čekaj 3-4 sekunde** (dovoljno za cijelu animaciju)
6. **Stop Record** (■)
7. **Analiziraj rezultate**

### **Što gledati:**
- **FPS graf** - trebao bi biti ~60fps, ako padne ispod 30fps → frame drop
- **Frame Rate** - provjeri da li je konstantan
- **Main thread** - provjeri da li ima dugih blokada (crveni blokovi)
- **Timeline** - provjeri da li ima frame drop-a nakon 1 sekunde

---

## 📊 METODA 3: Rendering Tab (VIZUALNO)

### **Koraci:**
1. **Otvori DevTools** (F12)
2. **Idi na Rendering tab** (ako ga nema, klikni "..." → More tools → Rendering)
3. **Enable "Frame Rendering Stats"**
4. **Trigger bubbles animaciju**
5. **Gledaj FPS counter** u gornjem desnom kutu

### **Što gledati:**
- **FPS counter** - trebao bi biti ~60fps
- **Frame time** - trebao bi biti ~16ms (60fps)
- **Ako FPS padne ispod 30fps** → frame drop

---

## 📊 METODA 4: Console Logging (REAL-TIME)

### **U DevTools Console stavi:**

```javascript
// Pokreni monitoring s detaljnim logovima
let frameCount = 0;
let lastTime = performance.now();
let frameDrops = 0;

const monitor = setInterval(() => {
  frameCount++;
  const now = performance.now();
  const elapsed = now - lastTime;
  const fps = (1000 / elapsed).toFixed(1);
  
  if (fps < 30) {
    frameDrops++;
    console.warn(`⚠️ FRAME DROP: FPS=${fps}, Frame time=${elapsed.toFixed(1)}ms`);
  } else {
    console.log(`✅ FPS: ${fps}, Frame time: ${elapsed.toFixed(1)}ms`);
  }
  
  lastTime = now;
  
  // Provjeri bubbles stats
  const stats = getBubbleStats();
  console.log(`💧 Bubbles: ${stats.spawned}/${stats.total}, Active: ${stats.active}, Visible: ${stats.visible}`);
}, 100); // Svakih 100ms

// Zaustavi nakon 5 sekundi
setTimeout(() => {
  clearInterval(monitor);
  console.log(`📊 Total frame drops: ${frameDrops}`);
}, 5000);
```

---

## 📊 METODA 5: Performance API (PROGRAMATSKI)

### **U DevTools Console stavi:**

```javascript
// Mjeri frame rate tokom animacije
let frameTimes = [];
let lastFrameTime = performance.now();

function measureFrame() {
  const now = performance.now();
  const frameTime = now - lastFrameTime;
  frameTimes.push(frameTime);
  lastFrameTime = now;
  
  requestAnimationFrame(measureFrame);
}

// Pokreni mjerenje
requestAnimationFrame(measureFrame);

// Nakon 5 sekundi, analiziraj
setTimeout(() => {
  cancelAnimationFrame(measureFrame);
  
  const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const avgFps = (1000 / avgFrameTime).toFixed(1);
  const minFps = (1000 / Math.max(...frameTimes)).toFixed(1);
  const maxFps = (1000 / Math.min(...frameTimes)).toFixed(1);
  const drops = frameTimes.filter(t => t > 33.33).length; // >33ms = <30fps
  
  console.log(`📊 Frame Analysis:`);
  console.log(`   Average FPS: ${avgFps}`);
  console.log(`   Min FPS: ${minFps}`);
  console.log(`   Max FPS: ${maxFps}`);
  console.log(`   Frame drops (<30fps): ${drops}/${frameTimes.length} (${(drops/frameTimes.length*100).toFixed(1)}%)`);
  
  // Provjeri nakon 1 sekunde
  const after1s = frameTimes.slice(60, 120); // Frames 60-120 (nakon 1s)
  const avgAfter1s = after1s.reduce((a, b) => a + b, 0) / after1s.length;
  const fpsAfter1s = (1000 / avgAfter1s).toFixed(1);
  console.log(`   FPS after 1s: ${fpsAfter1s}`);
  
  frameTimes = [];
}, 5000);
```

---

## 🎯 PREPORUČENI NAČIN

### **Za brzu provjeru:**
```javascript
// U DevTools Console
monitorBubbles(500)
```

### **Za detaljnu analizu:**
1. **Performance Tab** - snimi animaciju
2. **Provjeri FPS graf** - traži padove ispod 30fps
3. **Provjeri nakon 1 sekunde** - gledaj da li FPS pada

---

## 📊 ŠTO TRAŽITI

### **DOBRO (Nema frame drop-a):**
- ✅ FPS: 55-60fps konstantno
- ✅ Frame time: 16-18ms
- ✅ Nema crvenih blokova u Performance tabu
- ✅ Smooth animacija

### **LOŠE (Ima frame drop-a):**
- ⚠️ FPS: <30fps nakon 1 sekunde
- ⚠️ Frame time: >33ms
- ⚠️ Crveni blokovi u Performance tabu
- ⚠️ Lag/stuttering u animaciji

---

## 🔥 BRUTALNO ISKRENO

**Najlakše:**
```javascript
monitorBubbles(500)
```

**Najtočnije:**
- Performance Tab → Record → Analiziraj FPS graf

**Najbrže:**
- Rendering Tab → Frame Rendering Stats → Gledaj FPS counter

**Preporuka:** Koristi `monitorBubbles(500)` za brzu provjeru, a Performance Tab za detaljnu analizu.

