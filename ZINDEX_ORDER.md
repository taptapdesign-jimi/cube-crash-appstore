# zIndex Poredak Animacijskih Elemenata (Merge 6)

## Poredak (od najvišeg do najnižeg):

### 1. **Flash** (innerFlashAtTile)
- **zIndex**: `10001` (NAJVIŠI)
- **Funkcija**: Bijeli flash efekat pri merge 6
- **Lokacija**: `fx.js:574`

### 2. **Multiplier** (showMultiplierTile)
- **zIndex**: `10000`
- **Funkcija**: Smedi krug sa "×2", "×3" itd.
- **Lokacija**: `fx.js:641`

### 3. **Glass Crack** (glassCrackAtTile)
- **zIndex**: `9995`
- **Funkcija**: Bijele crack linije (wild merges)
- **Lokacija**: `fx.js:57`

### 4. **Debug Circle** (trenutno - za debug)
- **zIndex**: `9995`
- **Funkcija**: Crveni krug za testiranje (može se ukloniti)
- **Lokacija**: `fx.js:258`

### 5. **Shards** (woodShardsAtTile)
- **Regular merge 6**: `zIndex = 9993` (behind: false)
- **Wild mode**: `zIndex = tileZ - 0.002` (iza smoke/flash)
- **Behind mode**: `zIndex = tileZ - 0.001`
- **Funkcija**: Smedi/crveni/žuti shardovi koji lete van
- **Lokacija**: `fx.js:245-250`

### 6. **Smoke** (smokeBubblesAtTile)
- **zIndex**: `9990` (default) ili `tileZ - 0.001` (ako behind: true)
- **Funkcija**: Bijeli dim/oblačići
- **Lokacija**: `fx.js:724`

---

## Problem sa Regular Merge 6 Shardovima

**Trenutno stanje:**
- Regular merge 6 shardovi koriste `zIndex = 9993`
- To je **ispod** multiplikatora (10000) i glass crack (9995)
- To je **iznad** smoke (9990)

**Problem:**
- Shardovi nisu vidljivi na regular merge 6
- Debug circle (9995) bi trebao biti vidljiv ako je layer pozicioniran ispravno

**Mogući uzroci:**
1. Layer nije dodat u board pravilno
2. Shardovi se animiraju ali nestaju previše brzo
3. Alpha/opacity problem
4. Render problem (PixiJS v8+)

---

## Preporuka

Za regular merge 6 shardove, trebali bi biti na `zIndex = 9993`, što je:
- ✅ Ispod multiplikatora (10000) - DOBRO
- ✅ Ispod glass crack (9995) - DOBRO  
- ✅ Iznad smoke (9990) - DOBRO

Ali možda trebaju biti **viši** da budu vidljivi? Probaj:
- `zIndex = 9996` (između glass crack i multiplier)
- Ili `zIndex = 9997` (jako blizu multiplier-a)

