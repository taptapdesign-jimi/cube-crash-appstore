# Memory Leak & Animation Cleanup Assessment - v57

## Pregled
Provjera cleanup logike za animacije, memory management i save funkcionalnost kada se board završi i pokrene clean board flow.

---

## ✅ Što radi dobro

### 1. Wild Animacije Cleanup
- **Lokacija**: `app-core.ts:4530-4545` (`removeTile` funkcija)
- **Status**: ✅ **RADI DOBRO**
- Killuje sve wild animacije prije destroy:
  - `stopWildIdle`
  - `stopWildShimmer`
  - `stopWildStars`
  - `stopWildJuiceBubbles`
  - `stopMagnetIdleParticles`
- Killuje GSAP tweens: `gsap.killTweensOf(t)`, `gsap.killTweensOf(t.scale)`, `gsap.killTweensOf(t.rotG)`

### 2. Memory Manager Cleanup
- **Lokacija**: `app-core.ts:149-156` (`triggerCleanBoardFlow`)
- **Status**: ✅ **RADI DOBRO**
- Poziva `memoryManager.performCleanup()` prije board transitiona
- Ovo je dobar pristup za memory management

### 3. Endgame Flow Cleanup
- **Lokacija**: `endgame-flow.ts:138-200`
- **Status**: ✅ **RADI DOBRO**
- Killuje sve GSAP tweens: `gsap.killTweensOf('*')`
- Killuje delayed calls i graphics objekte
- Clearuje timeouts i intervals
- Agresivniji cleanup za board 10+ i 20+

### 4. Cleanup Game Function
- **Lokacija**: `app-core.ts:5055-5065`
- **Status**: ✅ **RADI DOBRO**
- Killuje wild animacije prije destroy tiles
- Clearuje tiles i grid

### 5. Save Game State
- **Lokacija**: `app-core.ts:5131-5216` (`saveGameState`)
- **Status**: ✅ **RADI DOBRO**
- Savea se nakon merge-a (`debouncedSaveGameState`)
- Savea se nakon wild spawn-a
- Savea se nakon board 2+ starta
- **PROBLEM**: Ne savea se eksplicitno nakon clean board flow završetka

---

## ⚠️ Identificirani problemi

### 1. **KRITIČAN**: `rebuildBoard()` ne killuje wild animacije prije destroy
- **Lokacija**: `app-core.ts:1292`
- **Problem**: 
  ```typescript
  tiles.forEach(t=>t.destroy({children:true, texture:false, textureSource:false}));
  ```
  - Destroyuje tiles bez killanja wild animacija prije toga
  - Može ostaviti "ghost" animacije koje se nastavljaju izvoditi
- **Rješenje**: Dodati cleanup wild animacija prije destroy:
  ```typescript
  tiles.forEach(t => {
    try { stopWildIdle?.(t); } catch {}
    try { stopWildShimmer?.(t); } catch {}
    try { stopWildStars?.(t); } catch {}
    try { stopWildJuiceBubbles?.(t); } catch {}
    try { stopMagnetIdleParticles?.(t); } catch {}
    try { gsap.killTweensOf(t); gsap.killTweensOf(t.scale); gsap.killTweensOf(t.rotG); } catch {}
    t.destroy({children:true, texture:false, textureSource:false});
  });
  ```

### 2. **SREDNJI**: `requestAnimationFrame` callbacks se ne cleanupaju
- **Lokacija**: `clean-board-modal.ts:444-459`, `clean-board-modal.ts:472-487`
- **Problem**: 
  - `requestAnimationFrame(tick)` se poziva ali se ne cancelira ako se modal zatvori prije završetka
  - Može dovesti do memory leakova i ghost animacija
- **Rješenje**: 
  - Trackovati `requestAnimationFrame` ID-ove
  - Cancelirati ih u cleanup funkciji

### 3. **SREDNJI**: `setTimeout` u clean-board-modal se trackuje ali se ne cleanupaju svi
- **Lokacija**: `clean-board-modal.ts:38-48`
- **Status**: ✅ Djelomično radi (trackuje se u `_modalTimeouts`)
- **Problem**: Neki `setTimeout` pozivi možda nisu trackovani
- **Rješenje**: Provjeriti da li se svi `setTimeout` pozivi trackuju

### 4. **NISKI**: Save game state se ne poziva eksplicitno nakon clean board flow
- **Lokacija**: `endgame-flow.ts` (nakon clean board modal)
- **Problem**: Save se poziva prije clean board flow, ali ne i nakon što se score ažurira u modalu
- **Rješenje**: Dodati `saveGameState()` poziv nakon što se clean board modal zatvori i score je finaliziran

### 5. **NISKI**: Graphics objekti (shards, bubbles) možda se ne cleanupaju dovoljno agresivno
- **Lokacija**: `fx.js` (woodShardsAtTile, startWildJuiceBubbles)
- **Status**: ✅ Djelomično radi (auto-destroy nakon TTL)
- **Problem**: Ako se board završi prije nego što TTL istekne, objekti mogu ostati
- **Rješenje**: Provjeriti da li se svi Graphics objekti cleanupaju u cleanup funkcijama

---

## 📋 Preporuke za optimizaciju

### Prioritet 1 (KRITIČAN)
1. **Popraviti `rebuildBoard()` cleanup** - dodati wild animacije cleanup prije destroy

### Prioritet 2 (SREDNJI)
2. **Trackovati i cleanupati `requestAnimationFrame` callbacks** u clean-board-modal
3. **Provjeriti da li se svi `setTimeout` pozivi trackuju** u clean-board-modal

### Prioritet 3 (NISKI)
4. **Dodati `saveGameState()` poziv nakon clean board flow** kada je score finaliziran
5. **Provjeriti cleanup Graphics objekata** (shards, bubbles) kada se board završi

---

## 🔍 Dodatne provjere

### Provjeriti:
1. ✅ Wild animacije se killaju u `removeTile` - **RADI**
2. ✅ Memory manager cleanup se poziva - **RADI**
3. ✅ GSAP tweens se killaju u endgame flow - **RADI**
4. ⚠️ `rebuildBoard()` cleanup - **TREBA POPRAVITI**
5. ⚠️ `requestAnimationFrame` cleanup - **TREBA DODATI**
6. ✅ Save game state - **RADI, ali može biti bolje**

---

## 🎯 Zaključak

**Status**: **Dobro optimizirano, ali ima prostora za poboljšanja**

**Glavni problemi**:
1. `rebuildBoard()` ne killuje wild animacije prije destroy (KRITIČAN)
2. `requestAnimationFrame` callbacks se ne cleanupaju (SREDNJI)
3. Save game state se ne poziva eksplicitno nakon clean board flow (NISKI)

**Preporuka**: Popraviti prioritet 1 i 2 probleme za optimalan memory management.

