# Smoke Trail Particles - Breakdown

## Kako se handla smoke trail particles za različite tipove pločica

| Tip Pločice | Funkcija | Object Pooling | Metoda | Detalji |
|------------|----------|----------------|---------|---------|
| **Obične pločice** (regular tiles) | `dragSmokeTrail()` | ❌ **NE** | `new Graphics()` | Koristi `new Graphics()` za svaki particle. Nema pooling. |
| **Wild Beer** | `magicSparklesAtTile()` | ✅ **DA** | `graphicsPool.acquire()` | Koristi object pooling. Particles se reusaju iz pool-a. |
| **Wild Zvjezdica** (wild star) | `magicSparklesAtTile()` | ✅ **DA** | `graphicsPool.acquire()` | Koristi object pooling. Particles se reusaju iz pool-a. |
| **Wild Magnet** | `magicSparklesAtTile()` | ✅ **DA** | `graphicsPool.acquire()` | Koristi object pooling. Particles se reusaju iz pool-a. |

## Detalji implementacije

### Obične pločice (Regular Tiles)
- **Funkcija**: `dragSmokeTrail(board, tile, tileSize, strength, opts)`
- **Metoda**: `new Graphics()` - svaki particle je novi Graphics objekt
- **Lokacija**: `src/modules/fx.js:4789`
- **Razlog**: Nema pooling - svaki particle se kreira novi

### Wild Beer
- **Funkcija**: `magicSparklesAtTile(board, tile, opts)`
- **Metoda**: `graphicsPool.acquire()` - particles se uzimaju iz pool-a
- **Lokacija**: `src/modules/fx.js:857`
- **Cleanup**: `graphicsPool.release(shard)` nakon animacije
- **Razlog**: Object pooling za bolju performansu

### Wild Zvjezdica (Wild Star)
- **Funkcija**: `magicSparklesAtTile(board, tile, opts)`
- **Metoda**: `graphicsPool.acquire()` - particles se uzimaju iz pool-a
- **Lokacija**: `src/modules/fx.js:857`
- **Cleanup**: `graphicsPool.release(shard)` nakon animacije
- **Razlog**: Object pooling za bolju performansu

### Wild Magnet
- **Funkcija**: `magicSparklesAtTile(board, tile, opts)`
- **Metoda**: `graphicsPool.acquire()` - particles se uzimaju iz pool-a
- **Lokacija**: `src/modules/fx.js:857`
- **Cleanup**: `graphicsPool.release(shard)` nakon animacije
- **Razlog**: Object pooling za bolju performansu

## Zaključak

- **Obične pločice**: ❌ Nema pooling - koristi `new Graphics()`
- **Wild tiles** (beer, star, magnet): ✅ Ima pooling - koristi `graphicsPool.acquire()`

