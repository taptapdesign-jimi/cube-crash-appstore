# Wild TNT – procjena handlanja animacije i cleanup-a (0–100%)

## Sažetak ocjene: **82%**

Dobro napravljeno: animacija, pooling, tracking i većina cleanup putova. Manji nedostaci: nema eksplicitnog TNT cleanup-a u `cleanupGame`, te potencijalni edge caseovi ako korisnik izađe tijekom boom bonusa.

---

## 1. TNT sprite + BOOM animacija (`tnt-animation.ts`)

| Aspekt | Ocjena | Napomena |
|--------|--------|----------|
| **Cleanup funkcija** | ✅ 100% | `cleanup()` ubija: master timeline, extraTimelines, spriteBounceTweensRef, boomBounceTimelinesRef; za svaki frame: gsap.killTweensOf(img/wrap) + domElementPool.release; overlay: killTweensOf + removeChild; postavlja refs na null. |
| **DOM pooling** | ✅ 100% | Wrapperi i slike dolaze iz `domElementPool.acquire()`, vraćaju se u `cleanup()` s `release()`. |
| **Tracking** | ✅ 100% | Svi timelini kroz `trackTimeline()` → `animationManager.activeTimelines`. Kad se pozove `animationManager.killAll()`, svi se ubijaju. |
| **onComplete / onKill** | ✅ 100% | Master timeline ima `onComplete` i `onKill` – oba pozivaju `cleanup()`. Završetak ili kill dovode do čišćenja. |
| **Eksplicitni TNT cleanup u app-core** | ⚠️ 70% | `cleanupGame()` ne poziva `stopTntAnimation()`. Cleanup se oslanja na to da `killAllGsapTweensCommon` → `animationManager.killAll()` ubije TNT timeline → `onKill` → `cleanup()`. Ako bi timeline iz nekog razloga bio izvan managera ili onKill ne bi pozvao cleanup, overlay bi mogao ostati. Preporuka: u `cleanupGame()` dodati `stopTntAnimation()` (već exportan iz tnt-animation) za garantirani cleanup. |

**Prosječno za modul:** ~94%.

---

## 2. TNT idle (particles + shake) (`fx.ts`)

| Aspekt | Ocjena | Napomena |
|--------|--------|----------|
| **stopTntIdleParticles** | ✅ 100% | `clearAppInterval(_tntIdleParticlesInterval)`; za svaki particle: gsap.killTweensOf, removeChild, __globalGraphicsObjects.delete, graphicsPool.release; `_tntIdleParticles = null` prije iteracije (izbjegava race). |
| **stopTntIdleShake** | ✅ 100% | Ubija `_tntShakeCurrentTl`, `_tntShakeTl`, sve u `_tntShakeDelayedCalls` + briše iz `__globalDelayedCalls`. |
| **startTntIdleShake** | ✅ 100% | Delayed callovi idu u `trackDelayedCall` i u `__globalDelayedCalls` → `killAllDelayedCalls()` ih ubija. |
| **Pozivanje pri uklanjanju tilea** | ✅ 100% | `removeTile()` i tile cleanup pozivaju `stopTntIdleParticles` i `stopTntIdleShake`. |

**Prosječno za TNT idle:** 100%.

---

## 3. Tile blast (kockice odlaze / return) (`app-core.ts`)

| Aspekt | Ocjena | Napomena |
|--------|--------|----------|
| **Return delay** | ✅ 100% | `trackDelayedCall(0.4, () => { ... return tiles ... })` – tracked, `animationManager.killAll()` ga ubija. |
| **Wobble tweens** | ✅ 100% | Wobble je `gsap.to(tile, { ... repeat: -1 })`. `killAllGsapTweensCommon` radi `gsap.killTweensOf(tile)` za sve tileove – wobble se ubija. |
| **blastReturnHandles** | ✅ 100% | Lokalna varijabla u callbacku merge 6; nema globalnog leak. |

**Prosječno za tile blast:** 100%.

---

## 4. TNT boom bonus (break 4 tiles) (`app-core.ts`)

| Aspekt | Ocjena | Napomena |
|--------|--------|----------|
| **Poziv bonusa** | ✅ 100% | `trackDelayedCall(0.4 + 0.359, () => runTntBoomBonusBreak2Tiles(...))` – tracked. |
| **Stagger (doBreak)** | ✅ 100% | `trackDelayedCall(delay, doBreak)` – svi u animation manageru. |
| **Guards u doBreak** | ✅ 100% | `if (!tile || tile.destroyed || !board || !STATE?.tiles) return` – ne radi ništa ako je igra već u cleanupu. |
| **removeTile** | ✅ 100% | Na početku `if (!t || t.destroyed) return` – ne dira već uklonjene tileove. |
| **Shards / smoke** | ✅ 95% | `regularMerge6ShardsTemplated` koristi pool + setTimeout TTL cleanup; `smokeBubblesAtTile` ima svoj TTL. Ako se igra zatvori prije TTL-a, layer je child boarda – board se destroya u cleanupu. Mali rizik: setTimeout i dalje može fireati; u fx.ts cleanup sharda je u try/catch i provjerava parent. |

**Prosječno za boom bonus:** ~99%.

---

## 5. Ukupni cleanup putovi (exit / restart)

| Put | TNT relevantno | Ocjena |
|-----|----------------|--------|
| **cleanupGame()** | killAllGsapTweensCommon → animationManager.killAll() → TNT timeline kill → onKill → cleanup(). Nema eksplicitnog stopTntAnimation(). | ⚠️ 85% |
| **restartGame()** | killAllGsapTweensCommon(tiles, 'restart', { clearTimeline: true }) – isto ubija TNT timeline. | ✅ 100% |
| **cleanupFxForBoardReset()** | killAllDelayedCalls, destroyAllGraphicsObjects, star/bubbles cleanup. Ne poziva TNT cleanup – TNT se oslanja na GSAP kill. | ⚠️ 80% |

---

## 6. Memory leak rizici (kratko)

- **Nizak:** TNT overlay ostane u DOM-u samo ako timeline nije u manageru ili onKill ne pozove cleanup – trenutno je timeline tracked, pa je rizik mali.
- **Nizak:** Boom bonus delayed callovi – svi tracked; ako igra ode u cleanup, killAll ih ubija; doBreak ima guarde.
- **Vrlo nizak:** TNT idle – intervali i delayed callovi se čiste putem clearAppInterval i __globalDelayedCalls; tile cleanup poziva stop funkcije.

---

## 7. Preporuke za podizanje ocjene (prema 95%+)

1. **Eksplicitni TNT cleanup u cleanupGame**  
   U `cleanupGame()` (npr. neposredno prije ili nakon `killAllGsapTweensCommon`) dodati:
   - `import { stopTntAnimation } from './tnt-animation.ts';`
   - `try { stopTntAnimation?.(); } catch {}`  
   Time se osigurava uklanjanje overlay-a i release pool elemenata čak i ako GSAP/onKill putem zakaže.

2. **Opcionalno: TNT u cleanupFxForBoardReset**  
   Ako se `cleanupFxForBoardReset` koristi u scenarijima gdje se ne poziva `killAllGsapTweensCommon`, razmotriti poziv `stopTntAnimation()` i tamo (ovisno o flowu).

3. **Dokumentirati** da se TNT cleanup oslanja na: (a) onComplete/onKill master timelina, (b) animationManager.killAll() pri exit/restart – i da je `stopTntAnimation()` namijenjen za eksplicitni cleanup kad god se game state briše.

---

## 8. Konačna ocjena po kategoriji

| Kategorija | Ocjena |
|------------|--------|
| TNT animacija (sprite + BOOM) | 94% |
| TNT idle (particles + shake) | 100% |
| Tile blast + return | 100% |
| Boom bonus (4 tiles) | 99% |
| Integracija u game cleanup (exit/restart) | 85% |

**Ukupno (ponderirano): 82%** – solidno, s jasnim koracima za 95%+ (eksplicitni TNT cleanup u cleanupGame i eventualno u cleanupFxForBoardReset).
