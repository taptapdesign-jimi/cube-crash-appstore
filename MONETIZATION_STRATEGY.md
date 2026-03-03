# 💰 Monetizacija Strategija - Cube Crash

## 🎯 Preporuka: **Kombinirani pristup**

### **OPCIJA 1: Shop tab (NAJBOlje) ⭐⭐⭐**

**Struktura:**
```
Home → Navigation:
  - Play
  - Stats
  - Collectibles (postojeći)
  - Shop (NOVI) ← IAP proizvodi ovdje
  - Settings
```

**Zašto je ovo najbolje:**
- ✅ **Jasna separacija** - Collectibles su za achievemente, Shop je za kupnju
- ✅ **Lako za razumjeti** - Korisnici znaju gdje kupiti
- ✅ **Skalabilno** - Možeš dodati više proizvoda bez miješanja s collectibles
- ✅ **Profesionalno** - Standardni pristup u mobile igrama

**Shop sadržaj:**
- Extra moves (10, 20, 50)
- Wild tiles (single, pack of 3)
- Remove ads
- Premium collectibles (exclusive kartice koje se mogu samo kupiti)
- Bundles (moves + wild tiles + collectibles)

---

### **OPCIJA 2: Shop unutar Collectibles ⭐⭐**

**Struktura:**
```
Collectibles Screen:
  - Tabs: "My Collection" | "Shop" ← Shop tab unutar collectibles
```

**Zašto:**
- ✅ **Sve na jednom mjestu** - Collectibles i shop zajedno
- ⚠️ **Može biti zbunjujuće** - Achievement collectibles vs. paid collectibles
- ⚠️ **Manje skalabilno** - Teško dodati više shop kategorija

**Kada koristiti:**
- Ako želiš **premium collectibles** koje se mogu samo kupiti
- Ako želiš **"unlock collectible"** kao IAP proizvod

---

### **OPCIJA 3: Rename Collectibles → "Collection & Shop" ⭐**

**Struktura:**
```
Home → Navigation:
  - Play
  - Stats
  - Collection & Shop (renamed) ← Collectibles + IAP
  - Settings
```

**Zašto:**
- ⚠️ **Može biti zbunjujuće** - Achievement vs. paid items
- ⚠️ **Manje profesionalno** - Nije standardni pristup

---

## 🎮 ŠTO PRODAVATI? (Preporuke)

### **TIER 1: Najjednostavniji (za početak)**

1. **Extra Moves** - $0.99
   - 10 dodatnih poteza
   - Consumable
   - **Zašto:** Najjednostavniji za implementirati, jasna vrijednost

2. **Wild Tile Spawn** - $1.99
   - Spawnaj random wild tile (star, juice, magnet)
   - Consumable
   - **Zašto:** Korisno, satisfying, lako za implementirati

3. **Remove Ads** - $2.99
   - Ukloni sve reklame zauvijek
   - Non-consumable
   - **Zašto:** Standardni IAP, dobar revenue

---

### **TIER 2: Srednji (nakon početka)**

4. **Extra Moves Pack** - $1.99
   - 20 dodatnih poteza (bolja vrijednost)
   - Consumable

5. **Wild Tile Pack** - $3.99
   - 3 wild tiles (bolja vrijednost)
   - Consumable

6. **Premium Pack** - $4.99
   - 10 moves + 2 wild tiles + 1 exclusive collectible
   - Consumable
   - **Zašto:** Bundle = više vrijednosti = više revenue

---

### **TIER 3: Napredno (nakon što vidiš što radi)**

7. **Premium Collectibles** - $1.99 - $4.99
   - Exclusive kartice koje se mogu samo kupiti
   - Non-consumable
   - **Zašto:** Collectors će kupiti, dobar long-term revenue

8. **Subscription** - $4.99/mjesec
   - Unlimited moves
   - No ads
   - Exclusive wild tiles
   - Premium collectibles
   - **Zašto:** Najbolji long-term revenue

---

## 📊 PREPORUČENA STRUKTURA

### **Finalna preporuka: Shop Tab (Opcija 1)**

```
Home Screen
  ↓
Navigation Bar:
  - Play
  - Stats  
  - Collectibles (achievements, unlocked cards)
  - Shop (NEW) ← IAP proizvodi
  - Settings
```

**Shop Screen sadržaj:**

```
┌─────────────────────────┐
│        SHOP            │
├─────────────────────────┤
│                        │
│  💪 POWER-UPS          │
│  ┌──────────────┐      │
│  │ Extra Moves  │ $0.99│
│  │ (10 moves)   │      │
│  └──────────────┘      │
│  ┌──────────────┐      │
│  │ Wild Tile    │ $1.99│
│  │ (1 spawn)    │      │
│  └──────────────┘      │
│                        │
│  🎁 BUNDLES            │
│  ┌──────────────┐      │
│  │ Premium Pack │ $4.99│
│  │ (10+2+1)     │      │
│  └──────────────┘      │
│                        │
│  ⭐ PREMIUM            │
│  ┌──────────────┐      │
│  │ Remove Ads   │ $2.99│
│  │ (Forever)    │      │
│  └──────────────┘      │
│                        │
│  [Restore Purchases]   │
└─────────────────────────┘
```

---

## 🎨 UI/UX PREPORUKE

### **Shop Tab Design:**

1. **Ikonica:** 💰 ili 🛒 ili ⭐
2. **Lokacija:** Između Collectibles i Settings
3. **Badge:** Prikaži badge ako imaš "sale" ili "new" proizvode
4. **Animacije:** Smooth transitions, satisfying purchase feedback

### **Collectibles vs. Shop:**

| Collectibles | Shop |
|--------------|------|
| Achievement-based | Purchase-based |
| Unlocked through gameplay | Unlocked through IAP |
| Free | Paid |
| "My Collection" | "Buy Items" |
| Show progress | Show prices |

---

## 💡 KREATIVNE IDEJE ZA PROIZVODE

### **1. Premium Collectibles (Exclusive)**
- Kartice koje se mogu **samo kupiti**
- Ne mogu se unlockati kroz gameplay
- **Primjer:** "Golden Cube", "Diamond Cube", "Rainbow Cube"
- **Cijena:** $1.99 - $4.99

### **2. Time-based Power-ups**
- "Double Score for 1 hour" - $0.99
- "Unlimited Moves for 30 minutes" - $1.99
- **Zašto:** Consumable, lako za implementirati

### **3. Visual Customizations**
- Custom tile skins - $0.99
- Custom board themes - $1.99
- **Zašto:** Non-consumable, dobar long-term revenue

### **4. Gameplay Modifiers**
- "Start with Wild Tile" - $0.99
- "Extra Combo Time" - $0.99
- **Zašto:** Consumable, dodaje varijaciju

---

## ✅ FINALNA PREPORUKA

### **Za početak:**

1. **Kreiraj Shop tab** (Opcija 1)
2. **3 jednostavna proizvoda:**
   - Extra Moves (10) - $0.99
   - Wild Tile Spawn - $1.99
   - Remove Ads - $2.99
3. **Integriraj s postojećim collectibles** - Premium collectibles u Shop-u

### **Nakon testiranja:**

4. **Dodaj više proizvoda** (packs, bundles)
5. **Dodaj premium collectibles** (exclusive kartice)
6. **Dodaj subscription** (ako vidiš da ima potražnje)

---

## 📝 IMPLEMENTACIJA CHECKLIST

- [ ] Odluči strukturu (Shop tab vs. unutar Collectibles)
- [ ] Dizajniraj Shop UI (slično Collectibles screen-u)
- [ ] Odaberi 3 proizvoda za početak
- [ ] Kreiraj IAP proizvode u App Store Connect
- [ ] Implementiraj IAP service
- [ ] Integriraj s igrom (extra moves, wild tiles)
- [ ] Testiraj na real device
- [ ] Submit za review

---

**Vrijeme implementacije:** ~2-3 sata (s Shop tab-om)  
**Težina:** ⭐⭐ (Lako)  
**Revenue potencijal:** $15-300/mjesec (ovisno o downloads)

