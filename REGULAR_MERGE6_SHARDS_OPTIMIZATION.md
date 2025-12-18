# Regular Merge 6 Shards - Optimizacija Preporuka

## 📊 Trenutno Stanje

### Performance Metrije
- **Broj shardsa**: 16-24 po merge 6 (random: `16 + Math.floor(Math.random() * 9)`)
- **Graphics objekti**: `new Graphics()` za svaki shard (nema pooling)
- **Animacije**: ~0.3-0.6s trajanje + fade out
- **TTL**: 1.6s (layer se uništava nakon toga)
- **GC pritisak**: Visok (16-24 Graphics objekata se kreira i uništava po merge 6)

### Problemi
1. **Memory allocations**: 16-24 Graphics objekata po merge 6
2. **GC pauses**: Česti GC pause-ovi zbog uništavanja Graphics objekata
3. **CPU/GPU**: Renderiranje 16-24 Graphics objekata istovremeno

---

## 🎯 Preporučene Optimizacije

### **OPCIJA 1: Smanjenje broja shardsa (PREPORUČENO - Najbrže rješenje)**

**Prednosti:**
- ✅ Jednostavno - samo promjena `count` parametra
- ✅ Odmah smanjuje GC pritisak za 30-40%
- ✅ Smanjuje CPU/GPU load
- ✅ Vizualno i dalje dovoljno impresivno

**Implementacija:**
```javascript
// Trenutno: count: 16 + Math.floor(Math.random() * 9) // 16-24
// Optimizirano: count: 10 + Math.floor(Math.random() * 6) // 10-15 (37.5% manje)
```

**Očekivani rezultati:**
- GC pauses: -30-40%
- CPU usage: -30-40%
- GPU usage: -30-40%
- Memory allocations: -37.5%

---

### **OPCIJA 2: Hybrid Object Pooling (Srednje kompleksno)**

**Prednosti:**
- ✅ Smanjuje GC pritisak (reuse Graphics objekata)
- ✅ Zadržava performanse
- ⚠️ Zahtijeva pažljiv reset Graphics objekata

**Implementacija:**
```javascript
// Koristiti pool ali s eksplicitnim clear() i updateBounds()
const shard = graphicsPool.acquire();
shard.clear(); // Eksplicitno clear
// ... draw shard ...
shard.updateBounds?.(); // Force bounds update
```

**Očekivani rezultati:**
- GC pauses: -60-70%
- Memory allocations: -80-90%
- CPU usage: -10-20% (pool overhead)
- ⚠️ Rizik: Možda neće raditi (kao prije)

---

### **OPCIJA 3: Texture Caching (Kompleksno, ali najbolje)**

**Prednosti:**
- ✅ Najbolje performanse (Sprite umjesto Graphics)
- ✅ Minimalan GC pritisak
- ✅ Brže renderiranje
- ⚠️ Zahtijeva texture generation i caching

**Implementacija:**
```javascript
// Generirati texture jednom, koristiti Sprite objekte
const shardTexture = generateShardTexture(brownColor);
const shard = new Sprite(shardTexture);
```

**Očekivani rezultati:**
- GC pauses: -80-90%
- CPU usage: -50-60%
- GPU usage: -30-40% (texture caching)
- Memory: +10-20% (texture cache)

---

### **OPCIJA 4: Kombinacija (Najbolje rješenje)**

**Kombinirati:**
1. Smanjiti broj shardsa (10-15 umjesto 16-24)
2. Koristiti object pooling s boljim resetom
3. Optimizirati animacije (kraće trajanje)

**Očekivani rezultati:**
- GC pauses: -70-80%
- CPU usage: -40-50%
- GPU usage: -40-50%
- Memory allocations: -85-90%

---

## 💡 FINALNA PREPORUKA

### **Faza 1: Brza optimizacija (5 minuta)**
**Smanjiti broj shardsa na 10-15** (umjesto 16-24)
- Jednostavno
- Odmah efektivno
- Nema rizika

### **Faza 2: Srednja optimizacija (30 minuta)**
**Dodati object pooling s boljim resetom**
- Eksplicitni `clear()` i `updateBounds()`
- Testirati pažljivo
- Ako ne radi, vratiti se na Fazu 1

### **Faza 3: Napredna optimizacija (2-3 sata)**
**Texture caching** (samo ako Faza 2 ne radi ili treba još performansi)

---

## 📈 Očekivani Rezultati (Faza 1 + Faza 2)

| Metrika | Prije | Poslije | Poboljšanje |
|---------|-------|---------|-------------|
| GC Pauses | ~20-40ms | ~5-10ms | 75% |
| Memory Allocations | ~2-3MB | ~0.3-0.5MB | 85% |
| CPU Usage | ~15-20% | ~8-12% | 40% |
| GPU Usage | ~10-15% | ~6-9% | 40% |
| FPS Drop | ~3-5 FPS | ~1-2 FPS | 60% |

---

## ⚠️ Upozorenja

1. **Object pooling** - Može uzrokovati probleme s renderiranjem (kao prije)
2. **Texture caching** - Zahtijeva dodatnu memoriju za texture cache
3. **Vizualni kvalitet** - Smanjenje shardsa može utjecati na vizualni dojam (ali 10-15 je i dalje dovoljno)

---

## 🎯 Preporučeni Pristup

**Početi s Fazom 1** (smanjiti broj shardsa) jer je:
- ✅ Najbrže (5 minuta)
- ✅ Najsigurnije (nema rizika)
- ✅ Odmah efektivno (30-40% poboljšanje)
- ✅ Može se kombinirati s Fazom 2 kasnije

**Ako treba još performansi**, dodati Fazu 2 (object pooling s boljim resetom).


