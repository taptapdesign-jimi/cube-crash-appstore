# DEV LOG snapshots (iz transkripta)

Izvuceni podaci iz DEV LOG-a: **prvi snapshot**, **zadnji snapshot** i **snapshot kad se pozove "clean board"**.

---

## 1. Prvi snapshot (nakon "Auto-log started", na početku sesije)

| Metrika | Vrijednost |
|--------|------------|
| **cleanup stats** | `{ timeouts: 1, animationFrames: 0, intervals: 0, listeners: 6 }` |
| **stage** | `hasStage: true`, `stageVisible: true`, **stageChildren: 3** |
| **board** | `hasBoard: true`, `boardVisible: true`, **boardChildren: 47** |
| **tiles** | **count: 45**, **active: 14** |
| **renderer** | `hasRenderer: true`, **textureCount: 15** |
| **assets cache** | **cacheSize: 3** |
| **gsap** | **tweens: 205** |
| **memoryManager** | `textureCount: 0`, `objectCount: 0`, `eventListenerCount: 0`, `cleanupCallbackCount: 0`, **memoryUsage: 130** (MB) |
| **performance.memory** | **usedJSHeapSize: 136633223**, **totalJSHeapSize: 141354311**, **jsHeapSizeLimit: 4294967296** |

*(used ≈ 130 MB, total ≈ 135 MB, limit ≈ 4 GB)*

---

## 2. Zadnji snapshot (prije "Auto-log finished")

| Metrika | Vrijednost |
|--------|------------|
| **cleanup stats** | `{ timeouts: 2, animationFrames: 0, intervals: 1, listeners: 6 }` |
| **stage** | **stageChildren: 4** |
| **board** | `boardVisible: false`, **boardChildren: 3** |
| **tiles** | **count: 1**, **active: 0** |
| **renderer** | **textureCount: 34** |
| **assets cache** | **cacheSize: 3** |
| **gsap** | **tweens: 10** |
| **memoryManager** | **memoryUsage: 178** (MB) |
| **performance.memory** | **usedJSHeapSize: 186788252**, **totalJSHeapSize: 246589616**, **jsHeapSizeLimit: 4294967296** |

*(used ≈ 178 MB, total ≈ 246 MB, limit ≈ 4 GB)*

---

## 3. Snapshot kad se pozove "clean board"

U transkriptu je **snapshot u trenutku clean board flow-a** upravo onaj gdje je board skriven, ostao je 1 tile (merge-6), a modal je vidljiv. To odgovara **zadnjem snapshotu** (točka 2) ili neposredno prije njega:

**Snapshot odmah nakon triggerCleanBoardFlow / tijekom clean board modala:**

| Metrika | Vrijednost |
|--------|------------|
| **cleanup stats** | `{ timeouts: 2, animationFrames: 0, intervals: 1, listeners: 6 }` |
| **stage** | **stageChildren: 4** |
| **board** | `boardVisible: false`, **boardChildren: 3** |
| **tiles** | **count: 1**, **active: 0** |
| **renderer** | **textureCount: 34** |
| **assets cache** | **cacheSize: 3** |
| **gsap** | **tweens: 10** (nakon čišćenja animacija) |
| **memoryManager** | **memoryUsage: 169–178** (MB) |
| **performance.memory** | **used: ~177–186 MB**, **total: ~239–246 MB**, **limit: 4294967296** |

Dakle, **"clean board" snapshot** = stanje kad je:
- `triggerCleanBoardFlow` pozvan (board se sakrio, modal se prikazuje),
- `boardChildren: 3`, `tiles.count: 1`, `tiles.active: 0`, `boardVisible: false`,
- GSAP tweens pali na ~10 nakon cleanupa.

---

## Sažetak (prvi vs zadnji / clean board)

| | Prvi | Zadnji / clean board |
|---|------|----------------------|
| **stageChildren** | 3 | 4 |
| **boardChildren** | 47 | 3 |
| **tiles count** | 45 | 1 |
| **tiles active** | 14 | 0 |
| **renderer textureCount** | 15 | 34 |
| **assets cacheSize** | 3 | 3 |
| **gsap tweens** | 205 | 10 |
| **memoryManager memoryUsage (MB)** | 130 | 178 |
| **performance.memory used (bytes)** | 136633223 | 186788252 |
| **performance.memory total (bytes)** | 141354311 | 246589616 |
| **performance.memory limit (bytes)** | 4294967296 | 4294967296 |

U kodu je u `app-core.ts` u `triggerCleanBoardFlow` dodan **eksplicitni DEV LOG snapshot** s prefiksom `🧪 DEV LOG (clean board):` tako da svaki sljedeći run ima jasan snapshot u trenutku poziva "clean board".
