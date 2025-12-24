# 📊 Journey Board Stats Implementation Plan

## 🎯 Zahtevi

1. **Odvojeni score po board-u** - svaki board kreće od 0, nema akumulacije
2. **Detail page - High Score i Longest Combo** - prikazati stats ispod badge-a
3. **High score tracking po board-u** - svaki board pamti svoj best score i longest combo
4. **Floating Play button** - narančasti CTA button 40px od dna

---

## 📋 Implementation Plan

### 1. Odvojeni Score po Board-u (Reset Score na 0)

#### **Problem**: 
Trenutno se score akumulira kroz board-ove (board 1 → board 2 → board 3).

#### **Rješenje**:
Reset score na 0 pri startu svakog board-a.

#### **Promjene**:

##### `src/modules/app-core.ts` - `startLevel()` funkcija
```typescript
// Linija ~2138-2141
// PRIJE:
if (resumeScore !== undefined) {
  score = resumeScore;
} else if (n === 1) {
  score = 0;
}
// If n > 1 and no overrides, keep current score (continuing game)

// POSLIJE:
// 🔥 JOURNEY BOARDS: Always reset score to 0 for each board (no accumulation)
score = 0;
console.log(`🎯 startLevel: Reset score to 0 for board ${n}`);
```

##### `src/modules/app-boot.ts` - `startLevel()` funkcija
```typescript
// Linija ~113-140
// PRIJE:
const resumeScore = Number((window as any).__ccResumeScore);
const preservedScore = (window as any).__ccPreserveScore;
if (Number.isFinite(resumeScore)) {
  STATE.score = Math.max(0, resumeScore | 0);
  // ... preserve score logic
} else if (typeof preservedScore === 'number' && preservedScore > 0) {
  STATE.score = preservedScore;
  // ... preserve score logic
} else {
  STATE.score = 0;
}

// POSLIJE:
// 🔥 JOURNEY BOARDS: Always reset score to 0 (no accumulation between boards)
STATE.score = 0;
if (typeof (window as any).syncScoreToCore === 'function') {
  (window as any).syncScoreToCore(0);
}
console.log(`🎯 startLevel (app-boot): Reset score to 0 for board ${n}`);
```

##### `src/modules/journey-boards-manager.ts` - `continueFromInterimBoard()`
```typescript
// Linija ~2168
// PRIJE:
score: savedScore, // 🔥 USER REQUEST: Preserve score even for fresh board

// POSLIJE:
score: 0, // 🔥 JOURNEY BOARDS: Always start from 0 (no accumulation)
```

#### **Procjena složenosti**: ⭐⭐ (2/5) - Srednje jednostavno
#### **Trajanje**: ~30 minuta

---

### 2. Per-Board Stats Service (High Score i Longest Combo)

#### **Problem**: 
Trenutno postoji samo globalni high score, nema per-board tracking-a.

#### **Rješenje**:
Kreirati novi servis za tracking stats-a po board-u.

#### **Novi file**: `src/services/board-stats-service.ts`

```typescript
// Per-board stats tracking service
interface BoardStats {
  highScore: number;
  longestCombo: number;
  timesPlayed: number;
  lastPlayed: number; // timestamp
}

interface AllBoardStats {
  [boardId: number]: BoardStats;
}

const STORAGE_KEY = 'cc_board_stats_v1';

class BoardStatsService {
  private stats: AllBoardStats = {};

  constructor() {
    this.loadStats();
  }

  private loadStats(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.stats = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load board stats:', error);
      this.stats = {};
    }
  }

  private saveStats(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch (error) {
      console.error('Failed to save board stats:', error);
    }
  }

  // Get stats for specific board
  public getBoardStats(boardId: number): BoardStats {
    return this.stats[boardId] || {
      highScore: 0,
      longestCombo: 0,
      timesPlayed: 0,
      lastPlayed: 0
    };
  }

  // Update high score for board (only if higher)
  public updateBoardHighScore(boardId: number, score: number): boolean {
    const current = this.getBoardStats(boardId);
    if (score > current.highScore) {
      this.stats[boardId] = {
        ...current,
        highScore: score,
        lastPlayed: Date.now()
      };
      this.saveStats();
      return true; // New high score!
    }
    return false;
  }

  // Update longest combo for board (only if longer)
  public updateBoardLongestCombo(boardId: number, combo: number): boolean {
    const current = this.getBoardStats(boardId);
    if (combo > current.longestCombo) {
      this.stats[boardId] = {
        ...current,
        longestCombo: combo,
        lastPlayed: Date.now()
      };
      this.saveStats();
      return true; // New longest combo!
    }
    return false;
  }

  // Increment times played for board
  public incrementBoardTimesPlayed(boardId: number): void {
    const current = this.getBoardStats(boardId);
    this.stats[boardId] = {
      ...current,
      timesPlayed: current.timesPlayed + 1,
      lastPlayed: Date.now()
    };
    this.saveStats();
  }
}

export const boardStatsService = new BoardStatsService();
```

#### **Integration Points**:

1. **Update High Score** - u `cleanupGame()` ili `exitToMenu()`:
```typescript
// src/main.ts ili src/modules/app-core.ts
const boardNumber = STATE.boardNumber || 1;
const currentScore = STATE.score || 0;
const isNewHighScore = boardStatsService.updateBoardHighScore(boardNumber, currentScore);
if (isNewHighScore) {
  console.log(`🏆 New high score for board ${boardNumber}: ${currentScore}`);
}
```

2. **Update Longest Combo** - u merge logic-u:
```typescript
// src/modules/app-merge.ts ili gdje se računa combo
const boardNumber = STATE.boardNumber || 1;
const currentCombo = comboCount || 0;
boardStatsService.updateBoardLongestCombo(boardNumber, currentCombo);
```

3. **Increment Times Played** - u `startLevel()`:
```typescript
// src/modules/app-core.ts
boardStatsService.incrementBoardTimesPlayed(n);
```

#### **Procjena složenosti**: ⭐⭐⭐ (3/5) - Srednje
#### **Trajanje**: ~1-2 sata

---

### 3. Detail Page - Stats Display (High Score i Longest Combo)

#### **Problem**: 
Detail modal prikazuje samo badge i card info, nema stats-a.

#### **Rješenje**:
Dodati stats display ispod badge-a, formatiran kao Stats screen.

#### **Promjene**:

##### `src/collectibles-manager.ts` - `showCardDetail()` metoda

Dodati stats display nakon badge-a (linija ~1200-1300):

```typescript
// ... existing badge code ...

// 🔥 NEW: Board stats display (High Score i Longest Combo)
if (category === 'common') {
  const boardId = number; // Card number = Board number
  const boardStats = boardStatsService.getBoardStats(boardId);
  
  const statsContainer = document.createElement('div');
  statsContainer.className = 'board-stats-container';
  statsContainer.innerHTML = `
    <div class="board-stat">
      <span class="board-stat-label">High Score</span>
      <span class="board-stat-value">${boardStats.highScore.toLocaleString()}</span>
    </div>
    <div class="board-stat">
      <span class="board-stat-label">Longest Combo</span>
      <span class="board-stat-value">${boardStats.longestCombo}</span>
    </div>
  `;
  detailContent.appendChild(statsContainer);
}

// ... rest of detail modal content ...
```

##### `src/collectibles-screen.css` - Stats Container Styles

Dodati na kraj file-a:

```css
/* Board Stats Display in Detail Modal */
.board-stats-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(154, 139, 122, 0.2);
}

.board-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.board-stat-label {
  font-family: 'Red Hat Display', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: #9A8B7A;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.board-stat-value {
  font-family: 'Red Hat Display', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #2C1810;
}

/* Responsive */
@media (max-width: 768px) {
  .board-stat-label {
    font-size: 14px;
  }
  .board-stat-value {
    font-size: 20px;
  }
}
```

#### **Procjena složenosti**: ⭐⭐⭐ (3/5) - Srednje
#### **Trajanje**: ~1 sat

---

### 4. Floating Play Button na Detail Screen

#### **Problem**: 
Detail modal nema Play button, samo Close (X).

#### **Rješenje**:
Dodati floating CTA button 40px od dna, isti style kao homepage slider CTA.

#### **Promjene**:

##### `src/collectibles-manager.ts` - `showCardDetail()` metoda

Dodati Play button nakon stats display-a:

```typescript
// ... existing stats display code ...

// 🔥 NEW: Floating Play button (only for common boards)
if (category === 'common') {
  const boardId = number;
  const playButton = document.createElement('button');
  playButton.className = 'board-detail-play-button';
  playButton.innerHTML = `
    <span>Play Board ${boardId}</span>
  `;
  
  playButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Play haptic feedback
    try {
      if ((window as any).playHaptic) {
        (window as any).playHaptic('light');
      }
    } catch {}
    
    // Close detail modal with exit animation
    await this.closeDetailModalWithExitAnimation(detailModal);
    
    // Close Journey screen with exit animation
    const { animateCollectiblesScreenExit } = await import('./ui/collectibles-animations.js');
    await animateCollectiblesScreenExit();
    
    // Start board from Journey
    if (typeof (window as any).startNewRunFromJourney === 'function') {
      await (window as any).startNewRunFromJourney(boardId, true);
    }
  });
  
  detailContent.appendChild(playButton);
}

// ... rest of detail modal content ...
```

##### `src/collectibles-screen.css` - Play Button Styles

Dodati na kraj file-a:

```css
/* Floating Play Button in Detail Modal */
.board-detail-play-button {
  position: fixed;
  bottom: calc(40px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 80px); /* Same width as homepage slider CTA */
  max-width: 400px;
  height: 56px;
  
  /* Primary CTA Style (Orange) */
  background: linear-gradient(180deg, #FF8C42 0%, #FF6B35 100%);
  border: none;
  border-radius: 28px;
  box-shadow: 0px 4px 12px rgba(255, 107, 53, 0.4);
  
  font-family: 'Red Hat Display', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #FFFFFF;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  cursor: pointer;
  z-index: 1001;
  
  transition: all 0.2s ease;
}

.board-detail-play-button:hover {
  transform: translateX(-50%) scale(1.02);
  box-shadow: 0px 6px 16px rgba(255, 107, 53, 0.5);
}

.board-detail-play-button:active {
  transform: translateX(-50%) scale(0.98);
  box-shadow: 0px 2px 8px rgba(255, 107, 53, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .board-detail-play-button {
    width: calc(100% - 48px);
    height: 52px;
    font-size: 16px;
  }
}

/* iOS Safe Area Adjustment */
@supports (padding: max(0px)) {
  .board-detail-play-button {
    bottom: max(40px, calc(40px + env(safe-area-inset-bottom, 0px)));
  }
}
```

#### **Procjena složenosti**: ⭐⭐⭐ (3/5) - Srednje
#### **Trajanje**: ~1 sat

---

## 📊 Ukupna Procjena

| Task | Složenost | Trajanje | Prioritet |
|------|-----------|----------|-----------|
| 1. Odvojeni Score po Board-u | ⭐⭐ (2/5) | ~30 min | 🔥 Visok |
| 2. Per-Board Stats Service | ⭐⭐⭐ (3/5) | ~1-2h | 🔥 Visok |
| 3. Stats Display u Detail Page | ⭐⭐⭐ (3/5) | ~1h | ⭐ Srednji |
| 4. Floating Play Button | ⭐⭐⭐ (3/5) | ~1h | ⭐ Srednji |

**Ukupno trajanje**: ~3.5-4.5 sata

**Ukupna složenost**: ⭐⭐⭐ (3/5) - Srednje

---

## 🎯 Redoslijed Implementacije

1. **Task 1**: Odvojeni Score po Board-u (najbrže, najviši prioritet)
2. **Task 2**: Per-Board Stats Service (potreban za Task 3)
3. **Task 3**: Stats Display u Detail Page (ovisi o Task 2)
4. **Task 4**: Floating Play Button (može se raditi neovisno)

---

## ⚠️ Potencijalni Problemi

### 1. Score Reset - Edge Cases
- **Problem**: Ako user klikne "Continue" nakon izlaska iz board-a, score bi trebao biti 0
- **Rješenje**: Provjeriti sve "Continue" flow-ove i osigurati da se score resetuje

### 2. High Score Update Timing
- **Problem**: Kada se high score update-uje? Pri izlasku iz board-a ili pri završetku?
- **Rješenje**: Update-ovati pri završetku board-a (board win) i pri izlasku (exit)

### 3. Longest Combo Tracking
- **Problem**: Gdje se trenutno računa combo?
- **Rješenje**: Pronaći combo logic i dodati board stats update

### 4. Play Button - Modal Overlap
- **Problem**: Play button može biti ispod detail modal content-a
- **Rješenje**: Dodati padding-bottom na detail modal content da se ne preklapa s button-om

---

## 🧪 Testing Checklist

- [ ] Score se resetuje na 0 pri startu svakog board-a
- [ ] Score se ne akumulira kroz board-ove
- [ ] High score se pravilno update-uje za svaki board
- [ ] Longest combo se pravilno track-uje za svaki board
- [ ] Stats se prikazuju u detail page-u
- [ ] Play button je vidljiv i funkcionalan
- [ ] Play button otvara odgovarajući board
- [ ] Play button je iste širine kao homepage CTA
- [ ] Play button je 40px od dna ekrana
- [ ] Stats se čuvaju i učitavaju iz localStorage-a

---

## 📝 Notes

- Stats display je **samo za common boards** (board 1-20), ne za legendary collectibles
- Play button je **samo za common boards**, ne za legendary collectibles
- High score i longest combo se track-uju **per-board**, ne globalno
- Score se **uvijek resetuje na 0** pri startu board-a, nema akumulacije

---

## ✅ Zaključak

**Plan je spreman za implementaciju!**

Sve promjene su jasno definirane s tačnim lokacijama u kodu. Implementacija bi trebala trajati ~3.5-4.5 sata za sve 4 task-a.

Da li da krenem s implementacijom?

