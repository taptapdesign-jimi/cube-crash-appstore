/**
 * Score Bottom Sheet
 * Shows high score stats and cubes cracked when user clicks on score area in HUD
 */

import { statsService } from '../services/stats-service';

let modal: HTMLElement | null = null;
let isVisible = false;

function createModal(): HTMLElement {
  const modalEl = document.createElement('div');
  modalEl.className = 'simple-bottom-sheet score-bottom-sheet';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'score-sheet-title');

  modalEl.innerHTML = `
    <div class="bottom-sheet-handle"></div>
    <h2 id="score-sheet-title" class="bottom-sheet-title">Score Stats</h2>
    <div class="score-stats-container">
      <!-- High Score -->
      <div class="stat-item">
        <div class="stat-icon">
          <img src="./assets/highscore-icon.png" alt="" aria-hidden="true">
        </div>
        <div class="stat-content">
          <div id="score-sheet-high-score" class="stat-value">0</div>
          <div class="stat-label">High score</div>
        </div>
      </div>
      
      <!-- Cubes Cracked -->
      <div class="stat-item">
        <div class="stat-icon">
          <img src="./assets/cubes-cracked.png" alt="" aria-hidden="true">
        </div>
        <div class="stat-content">
          <div id="score-sheet-cubes-cracked" class="stat-value">0</div>
          <div class="stat-label">Cubes cracked</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  return modalEl;
}

export function showScoreBottomSheet(): void {
  if (isVisible || (modal && modal.parentNode && !(modal as any)._closing)) {
    console.warn('⚠️ Score bottom sheet already open');
    return;
  }

  console.log('📊 Opening score bottom sheet');

  // Light haptic for opening bottom sheet
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('light');
  }

  if (!modal) {
    modal = createModal();
  }

  // Get fresh stats from service
  const stats = statsService.getStats();
  
  // Update values
  const highScoreEl = document.getElementById('score-sheet-high-score');
  const cubesCrackedEl = document.getElementById('score-sheet-cubes-cracked');
  
  if (highScoreEl) highScoreEl.textContent = stats.highScore.toString();
  if (cubesCrackedEl) cubesCrackedEl.textContent = stats.cubesCracked.toString();

  // Add overlay
  const overlay = document.createElement('div');
  overlay.id = 'score-sheet-overlay';
  overlay.className = 'bottom-sheet-overlay';
  overlay.onclick = () => hideScoreBottomSheet();
  document.body.appendChild(overlay);

  // Show modal with animation
  modal.style.transform = 'translateY(100%)';
  document.body.appendChild(modal);
  
  requestAnimationFrame(() => {
    if (modal) {
      modal.style.transition = 'transform 0.3s ease-out';
      modal.style.transform = 'translateY(0)';
    }
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease-out';
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
      });
    }
  });

  isVisible = true;
  
  // Close on outside click (with small delay to avoid capturing the click that opened it)
  setTimeout(() => {
    overlay.addEventListener('click', hideScoreBottomSheet);
  }, 200);
}

export function hideScoreBottomSheet(): void {
  const modalEl = modal;
  if (!modalEl || (modalEl as any)._closing) return;

  (modalEl as any)._closing = true;
  isVisible = false;

  console.log('📊 Closing score bottom sheet');

  // Medium haptic for closing
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('medium');
  }

  // Animate out
  modalEl.style.transition = 'transform 0.3s ease-in-out';
  modalEl.style.transform = 'translateY(100%)';

  // Remove overlay
  const overlay = document.getElementById('score-sheet-overlay');
  if (overlay) {
    overlay.style.transition = 'opacity 0.3s ease-in-out';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }

  // Remove modal after animation
  setTimeout(() => {
    if (modalEl && modalEl.parentNode) {
      modalEl.parentNode.removeChild(modalEl);
    }
    (modalEl as any)._closing = false;
  }, 300);
}

// Export to window for HUD access
if (typeof window !== 'undefined') {
  (window as any).showScoreBottomSheet = showScoreBottomSheet;
  (window as any).hideScoreBottomSheet = hideScoreBottomSheet;
}

