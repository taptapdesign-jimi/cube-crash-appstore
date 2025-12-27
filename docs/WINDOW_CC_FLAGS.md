# 📋 Window.__cc Flags Dokumentacija

**Datum:** 2025-12-27  
**Verzija:** v111

---

## 📊 Pregled

Ukupno: **16 window.__cc flags** korišćenih za global state management i koordinaciju između modula.

---

## 🏷️ Lista Flag-ova

### 1. `__ccCameFromDetailModal`
**Tip:** `boolean`  
**Svrha:** Označava da je korisnik došao iz detail modal-a  
**Korišćenje:**
- Postavlja se: `main.ts` - kada se otvori detail modal
- Čita se: `main.ts` - pri exit-u da se vrati na detail modal
- Briše se: `main.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccCameFromDetailModal = true;
```

---

### 2. `__ccCameFromHomepage`
**Tip:** `boolean`  
**Svrha:** Označava da je korisnik došao sa homepage-a  
**Korišćenje:**
- Postavlja se: `main.ts` - kada se otvori igra sa homepage-a
- Čita se: `main.ts` - pri exit-u da se vrati na homepage
- Briše se: `main.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccCameFromHomepage = true;
localStorage.setItem('__ccCameFromHomepage', 'true');
```

---

### 3. `__ccCameFromJourney`
**Tip:** `boolean`  
**Svrha:** Označava da je korisnik došao iz Journey screen-a  
**Korišćenje:**
- Postavlja se: `main.ts` - kada se otvori igra iz Journey screen-a
- Čita se: `main.ts`, `app-core.ts` - pri exit-u da se vrati na Journey
- Briše se: `main.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccCameFromJourney = true;
localStorage.setItem('__ccCameFromJourney', 'true');
```

---

### 4. `__ccDetailModalBoardId`
**Tip:** `number`  
**Svrha:** Čuva ID board-a za koji je otvoren detail modal  
**Korišćenje:**
- Postavlja se: `main.ts` - kada se otvori detail modal
- Čita se: `main.ts` - pri exit-u da se vrati na correct board
- Briše se: `main.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccDetailModalBoardId = boardId;
```

---

### 5. `__ccInterimCardInViewport`
**Tip:** `boolean`  
**Svrha:** Označava da je interim card u viewport-u  
**Korišćenje:**
- Postavlja se: `journey-boards-manager.ts` - kada interim card uđe u viewport
- Čita se: `journey-boards-manager.ts` - za scroll behavior
- Briše se: Automatski kada interim card izađe iz viewport-a

**Primjer:**
```typescript
(window as any).__ccInterimCardInViewport = true;
```

---

### 6. `__ccIsAnimatingSliderEnter`
**Tip:** `function(): boolean`  
**Svrha:** Funkcija koja vraća da li se slider enter animacija izvršava  
**Korišćenje:**
- Postavlja se: `slider-manager.ts` - kada se pokrene enter animacija
- Čita se: `navigation.ts` - za badge logiku
- Briše se: Automatski kada animacija završi

**Primjer:**
```typescript
(window as any).__ccIsAnimatingSliderEnter = () => isAnimating;
```

---

### 7. `__ccIsAnimatingSliderExit`
**Tip:** `function(): boolean`  
**Svrha:** Funkcija koja vraća da li se slider exit animacija izvršava  
**Korišćenje:**
- Postavlja se: `slider-manager.ts` - kada se pokrene exit animacija
- Čita se: `navigation.ts` - za badge logiku
- Briše se: Automatski kada animacija završi

**Primjer:**
```typescript
(window as any).__ccIsAnimatingSliderExit = () => isAnimating;
```

---

### 8. `__ccIsHidingCollectibles`
**Tip:** `boolean`  
**Svrha:** Označava da se collectibles sakrivaju  
**Korišćenje:**
- Postavlja se: `collectibles-manager.ts` - kada se pokrene hide animacija
- Čita se: `collectibles-manager.ts` - za animaciju logiku
- Briše se: Automatski kada animacija završi

**Primjer:**
```typescript
(window as any).__ccIsHidingCollectibles = true;
```

---

### 9. `__ccJourneyBadgeCount`
**Tip:** `number`  
**Svrha:** Čuva broj novih Journey board-ova za badge prikaz  
**Korišćenje:**
- Postavlja se: `navigation.ts` - kada se ažurira badge count
- Čita se: `navigation.ts` - za prikaz badge-a
- Persistira se: `localStorage` - za persistence između sesija

**Primjer:**
```typescript
(window as any).__ccJourneyBadgeCount = count;
```

---

### 10. `__ccJourneyExitMode`
**Tip:** `string`  
**Svrha:** Označava način exit-a iz Journey screen-a  
**Korišćenje:**
- Postavlja se: `journey-boards-manager.ts` - kada se izlazi iz Journey
- Čita se: `main.ts` - za exit behavior
- Briše se: `main.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccJourneyExitMode = 'exit';
```

---

### 11. `__ccPreserveScore`
**Tip:** `boolean`  
**Svrha:** Označava da se score treba sačuvati prije restart-a  
**Korišćenje:**
- Postavlja se: `app-core.ts` - kada se score treba sačuvati
- Čita se: `app-core.ts`, `app-boot.ts` - pri restart-u
- Briše se: `app-core.ts`, `app-boot.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccPreserveScore = true;
```

---

### 12. `__ccResumeScore`
**Tip:** `number`  
**Svrha:** Čuva score za resume nakon restart-a  
**Korišćenje:**
- Postavlja se: `app-core.ts` - kada se score treba sačuvati
- Čita se: `app-core.ts`, `app-boot.ts` - pri resume-u
- Briše se: `app-core.ts`, `app-boot.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccResumeScore = score;
```

---

### 13. `__ccSkipRebuildBoard`
**Tip:** `boolean`  
**Svrha:** Označava da se board ne treba rebuild-ovati (koristi se za load saved state)  
**Korišćenje:**
- Postavlja se: `app-core.ts` - kada se load-uje saved state
- Čita se: `app-boot.ts` - pri startLevel-u
- Briše se: `app-core.ts`, `app-boot.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccSkipRebuildBoard = true;
```

---

### 14. `__ccStartAtLevel`
**Tip:** `number`  
**Svrha:** Označava na kojem board-u treba početi igra  
**Korišćenje:**
- Postavlja se: `main.ts` - kada se pokrene igra sa specifičnog board-a
- Čita se: `app-core.ts` - pri boot-u
- Briše se: `app-core.ts`, `main.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccStartAtLevel = boardId;
```

---

### 15. `__ccTriggerHudDrop`
**Tip:** `boolean`  
**Svrha:** Označava da se treba pokrenuti HUD drop animacija  
**Korišćenje:**
- Postavlja se: `main.ts` - kada se pokrene igra sa Journey
- Čita se: `app-core.ts` - pri sweetPopIn-u
- Briše se: `app-core.ts`, `main.ts` - nakon što se koristi

**Primjer:**
```typescript
(window as any).__ccTriggerHudDrop = true;
```

---

### 16. `__ccUiJourneyTransitioning`
**Tip:** `boolean`  
**Svrha:** Označava da se UI Journey transition izvršava  
**Korišćenje:**
- Postavlja se: `ui-manager.ts` - kada se pokrene Journey transition
- Čita se: `ui-manager.ts` - za transition logiku
- Briše se: Automatski kada transition završi

**Primjer:**
```typescript
(window as any).__ccUiJourneyTransitioning = true;
```

---

## 🔍 Korišćenje po Fajlovima

### `app-core.ts`
- `__ccCameFromJourney` - čita se
- `__ccResumeScore` - postavlja se, čita se, briše se
- `__ccPreserveScore` - postavlja se, čita se, briše se
- `__ccSkipRebuildBoard` - postavlja se, čita se, briše se
- `__ccStartAtLevel` - čita se, briše se
- `__ccTriggerHudDrop` - čita se, briše se

### `app-boot.ts`
- `__ccResumeScore` - čita se, briše se
- `__ccPreserveScore` - čita se, briše se
- `__ccSkipRebuildBoard` - čita se, briše se

### `main.ts`
- `__ccCameFromDetailModal` - postavlja se, čita se, briše se
- `__ccCameFromHomepage` - postavlja se, čita se, briše se
- `__ccCameFromJourney` - postavlja se, čita se, briše se
- `__ccDetailModalBoardId` - postavlja se, čita se, briše se
- `__ccStartAtLevel` - postavlja se, čita se, briše se
- `__ccTriggerHudDrop` - postavlja se, čita se, briše se

### `navigation.ts`
- `__ccJourneyBadgeCount` - postavlja se, čita se
- `__ccIsAnimatingSliderEnter` - čita se
- `__ccIsAnimatingSliderExit` - čita se

### `journey-boards-manager.ts`
- `__ccInterimCardInViewport` - postavlja se, čita se
- `__ccJourneyExitMode` - postavlja se

### `ui-manager.ts`
- `__ccUiJourneyTransitioning` - postavlja se, čita se

### `collectibles-manager.ts`
- `__ccIsHidingCollectibles` - postavlja se, čita se

### `slider-manager.ts`
- `__ccIsAnimatingSliderEnter` - postavlja se
- `__ccIsAnimatingSliderExit` - postavlja se

---

## ⚠️ Best Practices

### 1. Uvek briši flag nakon korišćenja
```typescript
// ❌ LOŠE
(window as any).__ccStartAtLevel = boardId;
// Zaboravljeno: delete (window as any).__ccStartAtLevel;

// ✅ DOBRO
(window as any).__ccStartAtLevel = boardId;
// ... koristi flag ...
delete (window as any).__ccStartAtLevel;
```

### 2. Proveri da li flag postoji pre korišćenja
```typescript
// ❌ LOŠE
const boardId = (window as any).__ccStartAtLevel;

// ✅ DOBRO
const boardId = Number((window as any).__ccStartAtLevel);
if (boardId && boardId > 0) {
  // koristi boardId
}
```

### 3. Koristi localStorage za persistence kada je potrebno
```typescript
// ✅ DOBRO - za flags koji trebaju persistence
(window as any).__ccCameFromJourney = true;
localStorage.setItem('__ccCameFromJourney', 'true');
```

---

## 🔄 Refaktoring Preporuke

### Kratkoročno:
1. ✅ Dokumentovati sve flags (ZAVRŠENO)
2. ⚠️ Dodati TypeScript tipove za window.__cc flags
3. ⚠️ Kreirati helper funkcije za postavljanje/brisanje flags

### Dugoročno:
4. ⚠️ Kreirati StateManager klasu za centralizovani state management
5. ⚠️ Zamijeniti window.__cc flags sa proper state management sistemom

---

**Datum:** 2025-12-27  
**Verzija:** v111  
**Status:** Dokumentovano ✅


