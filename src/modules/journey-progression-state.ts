// @ts-nocheck
/**
 * Journey Progression State Manager
 * 
 * Manages state for Journey progression:
 * - highestUnlockedBoardId: Highest board unlocked from Journey
 * - lastOpenedBoardId: Last board the player opened from Journey screen
 * - currentRunState: Snapshot of in-progress game for that board, or null
 * 
 * 🔥 FIX v142: Also manages navigation state (replaces window.__cc* flags)
 * - cameFromJourney: User came to game from Journey screen
 * - cameFromDetailModal: User came from detail modal
 * - detailModalBoardId: Board ID from detail modal
 * - returningFromDetailModal: User is returning from detail modal
 */

const STORAGE_KEY_HIGHEST_UNLOCKED = 'journey_highest_unlocked_board_id';
const STORAGE_KEY_LAST_OPENED = 'journey_last_opened_board_id';
const STORAGE_KEY_CURRENT_RUN = 'journey_current_run_state';

interface CurrentRunState {
  boardId: number;
  inProgress: boolean;
  score: number;
  timestamp: number;
}

// 🔥 FIX: Navigation state (replaces window.__cc* flags)
interface NavigationState {
  cameFromJourney: boolean;
  cameFromDetailModal: boolean;
  detailModalBoardId: number | null;
  returningFromDetailModal: boolean;
}

class JourneyProgressionState {
  // 🔥 FIX: Navigation state (in-memory, no persistence needed)
  private _navState: NavigationState = {
    cameFromJourney: false,
    cameFromDetailModal: false,
    detailModalBoardId: null,
    returningFromDetailModal: false
  };

  // ========== NAVIGATION STATE (replaces window.__cc* flags) ==========
  
  /**
   * Get navigation state
   */
  getNavState(): NavigationState {
    // 🔥 BACKWARDS COMPAT: Also read from window flags if they exist
    const win = window as any;
    return {
      cameFromJourney: this._navState.cameFromJourney || win.__ccCameFromJourney === true,
      cameFromDetailModal: this._navState.cameFromDetailModal || win.__ccCameFromDetailModal === true,
      detailModalBoardId: this._navState.detailModalBoardId ?? win.__ccDetailModalBoardId ?? null,
      returningFromDetailModal: this._navState.returningFromDetailModal || win.__ccReturningFromDetailModal === true
    };
  }

  /**
   * Set that user came from Journey screen
   */
  setCameFromJourney(value: boolean): void {
    this._navState.cameFromJourney = value;
    // 🔥 BACKWARDS COMPAT: Also set window flag
    (window as any).__ccCameFromJourney = value;
    console.log(`🗺️ Journey nav: cameFromJourney = ${value}`);
  }

  /**
   * Set that user came from detail modal
   */
  setCameFromDetailModal(value: boolean, boardId?: number): void {
    this._navState.cameFromDetailModal = value;
    if (boardId !== undefined) {
      this._navState.detailModalBoardId = boardId;
      (window as any).__ccDetailModalBoardId = boardId;
    }
    // 🔥 BACKWARDS COMPAT: Also set window flag
    (window as any).__ccCameFromDetailModal = value;
    console.log(`🗺️ Journey nav: cameFromDetailModal = ${value}, boardId = ${boardId}`);
  }

  /**
   * Set returning from detail modal flag
   */
  setReturningFromDetailModal(value: boolean): void {
    this._navState.returningFromDetailModal = value;
    // 🔥 BACKWARDS COMPAT: Also set window flag
    (window as any).__ccReturningFromDetailModal = value;
    console.log(`🗺️ Journey nav: returningFromDetailModal = ${value}`);
  }

  /**
   * Clear all navigation state
   */
  clearNavState(): void {
    this._navState = {
      cameFromJourney: false,
      cameFromDetailModal: false,
      detailModalBoardId: null,
      returningFromDetailModal: false
    };
    // 🔥 BACKWARDS COMPAT: Also clear window flags
    const win = window as any;
    delete win.__ccCameFromJourney;
    delete win.__ccCameFromDetailModal;
    delete win.__ccDetailModalBoardId;
    delete win.__ccReturningFromDetailModal;
    console.log('🗺️ Journey nav: All navigation state cleared');
  }

  // ========== PROGRESSION STATE (localStorage) ==========

  /**
   * Get highest unlocked board ID from Journey
   */
  getHighestUnlockedBoardId(): number | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HIGHEST_UNLOCKED);
      if (saved) {
        const id = parseInt(saved, 10);
        return Number.isFinite(id) && id >= 1 ? id : null;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get highest unlocked board ID:', error);
    }
    return null;
  }

  /**
   * Set highest unlocked board ID
   */
  setHighestUnlockedBoardId(boardId: number): void {
    try {
      if (boardId >= 1 && Number.isFinite(boardId)) {
        const current = this.getHighestUnlockedBoardId();
        // Only update if new board is higher
        if (current === null || boardId > current) {
          localStorage.setItem(STORAGE_KEY_HIGHEST_UNLOCKED, boardId.toString());
          console.log(`🗺️ Journey: Highest unlocked board set to ${boardId}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to set highest unlocked board ID:', error);
    }
  }

  /**
   * Get last opened board ID from Journey screen
   */
  getLastOpenedBoardId(): number | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_OPENED);
      if (saved) {
        const id = parseInt(saved, 10);
        return Number.isFinite(id) && id >= 1 ? id : null;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get last opened board ID:', error);
    }
    return null;
  }

  /**
   * Set last opened board ID (when user taps a board from Journey)
   */
  setLastOpenedBoardId(boardId: number): void {
    try {
      if (boardId >= 1 && Number.isFinite(boardId)) {
        localStorage.setItem(STORAGE_KEY_LAST_OPENED, boardId.toString());
        console.log(`🗺️ Journey: Last opened board set to ${boardId}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to set last opened board ID:', error);
    }
  }

  /**
   * Get current run state (in-progress game snapshot)
   */
  getCurrentRunState(): CurrentRunState | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT_RUN);
      if (saved) {
        const state = JSON.parse(saved);
        // Match board save validity (7 days) so hard-exit + return still resumes
        const ageMs = Date.now() - (state.timestamp || 0);
        if (ageMs < 7 * 24 * 60 * 60 * 1000) {
          return state as CurrentRunState;
        } else {
          // State too old, clear it
          this.clearCurrentRunState();
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to get current run state:', error);
    }
    return null;
  }

  /**
   * Set current run state (when game starts)
   */
  setCurrentRunState(boardId: number, score: number = 0): void {
    try {
      if (boardId >= 1 && Number.isFinite(boardId)) {
        const state: CurrentRunState = {
          boardId,
          inProgress: true,
          score,
          timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY_CURRENT_RUN, JSON.stringify(state));
        console.log(`🗺️ Journey: Current run state set for board ${boardId}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to set current run state:', error);
    }
  }

  /**
   * Update current run state (e.g., score update)
   */
  updateCurrentRunState(updates: Partial<CurrentRunState>): void {
    try {
      const current = this.getCurrentRunState();
      if (current) {
        const updated: CurrentRunState = {
          ...current,
          ...updates,
          timestamp: Date.now() // Update timestamp on any change
        };
        localStorage.setItem(STORAGE_KEY_CURRENT_RUN, JSON.stringify(updated));
      }
    } catch (error) {
      console.warn('⚠️ Failed to update current run state:', error);
    }
  }

  /**
   * Clear current run state (when game ends - fail or success)
   */
  clearCurrentRunState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_RUN);
      console.log('🗺️ Journey: Current run state cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear current run state:', error);
    }
  }

  /**
   * Check if there is an active in-progress run
   */
  hasActiveRun(): boolean {
    const state = this.getCurrentRunState();
    return state !== null && state.inProgress === true;
  }

  /**
   * Reset all progression state (for New Game from Board 1)
   */
  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_LAST_OPENED);
      localStorage.removeItem(STORAGE_KEY_CURRENT_RUN);
      // Don't reset highestUnlockedBoardId - that should persist
      console.log('🗺️ Journey: Progression state reset (lastOpened and currentRun cleared)');
    } catch (error) {
      console.warn('⚠️ Failed to reset progression state:', error);
    }
  }

  /**
   * Sync with Journey boards manager to get highest unlocked board
   */
  syncHighestUnlockedFromJourney(): void {
    try {
      // Import journey boards manager to get highest unlocked
      import('./journey-boards-manager.js').then(({ journeyBoardsManager }) => {
        const unlockedBoards = journeyBoardsManager.getBoards().filter(b => b.unlocked);
        if (unlockedBoards.length > 0) {
          const highestId = Math.max(...unlockedBoards.map(b => b.id));
          this.setHighestUnlockedBoardId(highestId);
        }
      }).catch((error) => {
        console.warn('⚠️ Failed to sync highest unlocked from journey:', error);
      });
    } catch (error) {
      console.warn('⚠️ Failed to sync highest unlocked:', error);
    }
  }
}

// Export singleton instance
export const journeyProgressionState = new JourneyProgressionState();
