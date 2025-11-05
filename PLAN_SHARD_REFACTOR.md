# 🔥 PLAN: Refaktoriranje Shard Logike za Merge 6

## 📊 Trenutno stanje - problemi

### 1. **Raspršena logika**
- `woodShardsAtTile` u `fx.js` provjerava `tile.special === 'wild-magnet'` **NAKON** merge animacije
- `tile.special` može biti `undefined` ili modificiran nakon merge animacije
- Provjera se temelji na `opts.wildMagnet` ali ne razlikuje wild od wild-magnet

### 2. **Nekonzistentni pozivi**
- `app-core.ts` linija 1999: prosljeđuje `wild: true, wildMagnet: wasWildMagnet` ✅
- `app-core.ts` linija 2015: prosljeđuje `wild: true, wildMagnet: wasWildMagnet` ❌ (trebalo bi biti `wild: false` za obični merge 6)
- `app-merge.ts` linija 615-616: prosljeđuje `wild: true` **BEZ** `wildMagnet` ❌
- `app-merge.ts` linija 649: nema `wild` ni `wildMagnet` (obični merge 6) ✅

### 3. **Logika boja**
- Trenutno u `fx.js`:
  - Wild-magnet → 50/50 crveno/smede
  - Sve ostalo → smede
- **Trebalo bi biti:**
  - Wild (ne wild-magnet) → žuto (#FFCB47)
  - Wild-magnet → crveno (#F26034)
  - Obični merge 6 → smede (#D4A584)

## 🎯 Plan refaktoriranja

### **Opcija A: Centralna funkcija + Wrapper** (RECOMMENDED)
**Confidence Level: 95%**

#### Koraci:
1. **Kreiraj `getMerge6ShardConfig(src, dst)` funkciju** u `fx.js`:
   ```javascript
   function getMerge6ShardConfig(src, dst) {
     // Provjeri src i dst PRIJE merge animacije (snapshot)
     const srcSpecial = src?.special;
     const dstSpecial = dst?.special;
     
     const isWildMagnet = srcSpecial === 'wild-magnet' || dstSpecial === 'wild-magnet';
     const isWildOnly = (srcSpecial === 'wild' || dstSpecial === 'wild') && !isWildMagnet;
     const isNormalMerge = !isWildMagnet && !isWildOnly;
     
     return {
       isWildMagnet,
       isWildOnly,
       isNormalMerge,
       wild: isWildMagnet || isWildOnly,
       wildMagnet: isWildMagnet,
       // Boje za shardove
       shardColor: isWildOnly ? 0xFFCB47 : (isWildMagnet ? 0xF26034 : 0xD4A584)
     };
   }
   ```

2. **Kreiraj `spawnMerge6Shards(board, tile, src, dst, baseOpts)` wrapper funkciju**:
   ```javascript
   export function spawnMerge6Shards(board, tile, src, dst, baseOpts = {}) {
     if (!board || !tile || !src || !dst) return;
     
     const config = getMerge6ShardConfig(src, dst);
     
     // Merge config s baseOpts
     const finalOpts = {
       ...baseOpts,
       wild: config.wild,
       wildMagnet: config.wildMagnet,
       enhanced: baseOpts.enhanced ?? true,
     };
     
     // Pozovi woodShardsAtTile s pravilnim parametrima
     woodShardsAtTile(board, tile, finalOpts);
   }
   ```

3. **Ažuriraj `woodShardsAtTile` u `fx.js`**:
   - Dodaj logiku za žutu boju za wild-only
   - Provjeri `opts.wild === true && opts.wildMagnet === false` → žuta
   - Provjeri `opts.wildMagnet === true` → crvena
   - Inače → smeda

4. **Zamijeni sve pozive u `app-core.ts` i `app-merge.ts`**:
   - Umjesto: `woodShardsAtTile(board, dst, { wild: true, wildMagnet: wasWildMagnet, ... })`
   - Koristi: `spawnMerge6Shards(board, dst, src, dst, { count: 30, intensity: 1.9, ... })`

#### Prednosti:
- ✅ Centralna logika - samo jedan mjesto gdje se određuje tip merga
- ✅ Snapshot `src` i `dst` PRIJE merge animacije - sigurno
- ✅ Jednostavno za debug - sve logike na jednom mjestu
- ✅ Lako za proširenje - dodaj nove tipove merga u config funkciju

#### Nedostaci:
- ⚠️ Treba mijenjati pozive u 2 datoteke (`app-core.ts`, `app-merge.ts`)

---

### **Opcija B: Poboljšaj `woodShardsAtTile` da prima `src` i `dst`**
**Confidence Level: 85%**

#### Koraci:
1. **Modificiraj `woodShardsAtTile` signature**:
   ```javascript
   export function woodShardsAtTile(board, tile, opts = {}, src = null, dst = null) {
     // Ako su src i dst proslijeđeni, koristi ih za detekciju tipa merga
     if (src && dst) {
       const config = getMerge6ShardConfig(src, dst);
       opts.wild = config.wild;
       opts.wildMagnet = config.wildMagnet;
     }
     // ... ostatak logike
   }
   ```

2. **Ažuriraj pozive** da prosljeđuju `src` i `dst`

#### Prednosti:
- ✅ Manje promjena u pozivima
- ✅ Još uvijek centralna logika

#### Nedostaci:
- ⚠️ Signature promjena može breakati postojeće pozive
- ⚠️ Manje eksplicitno - lako zaboraviti proslijediti `src` i `dst`

---

### **Opcija C: Samo poboljšaj logiku u `woodShardsAtTile` s boljim parametrima**
**Confidence Level: 70%**

#### Koraci:
1. **Poboljšaj `woodShardsAtTile`** da provjerava `opts.wild` i `opts.wildMagnet` eksplicitno
2. **Ažuriraj sve pozive** da konzistentno prosljeđuju parametre

#### Prednosti:
- ✅ Minimalne promjene

#### Nedostaci:
- ⚠️ Još uvijek ovisi o pravilnom prosljeđivanju parametara
- ⚠️ Nema centralnu logiku za određivanje tipa merga
- ⚠️ Lako se može zaboraviti proslijediti parametre

---

## 🎯 PREPORUČENI PLAN: **Opcija A**

### Implementacija:

1. **Kreiraj `getMerge6ShardConfig` funkciju** u `fx.js`
2. **Kreiraj `spawnMerge6Shards` wrapper funkciju** u `fx.js`
3. **Ažuriraj `woodShardsAtTile`** da podržava žutu boju za wild-only
4. **Zamijeni pozive u `app-core.ts`** (2 mjesta)
5. **Zamijeni pozive u `app-merge.ts`** (3 mjesta)

### Testiranje:
- ✅ Wild merge 6 → žuti shardovi
- ✅ Wild-magnet merge 6 → crveni shardovi
- ✅ Obični merge 6 → smedi shardovi
- ✅ Pulled tiles merge 6 → smedi shardovi (trebalo bi biti)

---

## 📝 Confidence Level: **95%**

**Razlozi:**
- Plan je jasan i direktan
- Centralna logika rješava problem snapshot-a
- Jednostavno za debug i održavanje
- Lako za proširenje u budućnosti
- Minimalan rizik - samo wrapper funkcija oko postojećeg koda

