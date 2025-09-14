// Level Complete Module
// Zaseban modul za rukovanje level complete logikom
// Može se pozvati nezavisno od glavne igre

import { gsap } from 'gsap';

/**
 * Proverava da li je board potpuno očišćen
 * @param {Array} tiles - Lista tile-ova na board-u
 * @returns {boolean} - true ako je board clean
 */
export function isBoardComplete(tiles) {
  if (!Array.isArray(tiles)) return false;
  
  // Board je complete ako su svi tile-ovi locked ili imaju value <= 0
  return tiles.every(tile => tile.locked || (tile.value || 0) <= 0);
}

/**
 * Proverava da li je board stuck (nema više mogućih merge-ova)
 * @param {Object} makeBoard - Board objekat sa anyMergePossible metodom
 * @param {Array} tiles - Lista tile-ova
 * @returns {boolean} - true ako je board stuck
 */
export function isBoardStuck(makeBoard, tiles) {
  if (!makeBoard?.anyMergePossible || !Array.isArray(tiles)) return false;
  return !makeBoard.anyMergePossible(tiles);
}

/**
 * Glavna funkcija za proveru level complete statusa
 * @param {Object} gameState - Stanje igre
 * @returns {Object} - Rezultat provere
 */
export function checkLevelComplete(gameState) {
  const {
    tiles = [],
    makeBoard,
    hasWildOnBoard = () => false,
    score = 0,
    level = 1,
    moves = 0
  } = gameState;

  const isComplete = isBoardComplete(tiles);
  const isStuck = isBoardStuck(makeBoard, tiles);
  const hasWild = hasWildOnBoard();

  // Level je complete ako je board clean ili stuck (bez wild tile-ova)
  const levelComplete = isComplete || (isStuck && !hasWild);

  return {
    levelComplete,
    isComplete,
    isStuck,
    hasWild,
    score,
    level,
    moves,
    reason: levelComplete ? (isComplete ? 'board_clean' : 'no_moves') : 'continue'
  };
}

/**
 * Prikazuje level complete modal
 * @param {Object} options - Opcije za modal
 * @returns {Promise<Object>} - Rezultat korisničke akcije
 */
export async function showLevelCompleteModal(options = {}) {
  const {
    app,
    stage,
    board,
    score = 0,
    level = 1,
    moves = 0,
    reason = 'board_clean',
    onContinue = null,
    onRestart = null,
    onQuit = null
  } = options;

  return new Promise((resolve) => {
    // Kreiranje modal kontejnera
    const modalContainer = createModalContainer();
    const modal = createModalContent({
      score,
      level,
      moves,
      reason,
      onContinue: () => {
        hideModal(modalContainer);
        onContinue?.();
        resolve({ action: 'continue' });
      },
      onRestart: () => {
        hideModal(modalContainer);
        onRestart?.();
        resolve({ action: 'restart' });
      },
      onQuit: () => {
        hideModal(modalContainer);
        onQuit?.();
        resolve({ action: 'quit' });
      }
    });

    modalContainer.appendChild(modal);
    document.body.appendChild(modalContainer);

    // Animacija pojavljivanja
    showModal(modalContainer);
  });
}

/**
 * Kreira modal kontejner
 */
function createModalContainer() {
  const container = document.createElement('div');
  container.id = 'level-complete-modal-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    pointer-events: none;
  `;
  return container;
}

/**
 * Kreira modal sadržaj
 */
function createModalContent({ score, level, moves, reason, onContinue, onRestart, onQuit }) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 20px;
    padding: 40px;
    text-align: center;
    color: white;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    transform: scale(0.8);
    transition: transform 0.3s ease;
  `;

  const title = reason === 'board_clean' ? '🎉 Level Complete!' : '😔 No More Moves';
  const subtitle = reason === 'board_clean' ? 'Board cleared successfully!' : 'Try again to improve your score!';

  modal.innerHTML = `
    <div style="margin-bottom: 30px;">
      <h1 style="font-size: 2.5em; margin: 0 0 10px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
        ${title}
      </h1>
      <p style="font-size: 1.2em; margin: 0; opacity: 0.9;">
        ${subtitle}
      </p>
    </div>

    <div style="background: rgba(255,255,255,0.1); border-radius: 15px; padding: 20px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-around; margin-bottom: 15px;">
        <div>
          <div style="font-size: 2em; font-weight: bold; color: #ffd700;">${score}</div>
          <div style="font-size: 0.9em; opacity: 0.8;">Score</div>
        </div>
        <div>
          <div style="font-size: 2em; font-weight: bold; color: #4ecdc4;">${level}</div>
          <div style="font-size: 0.9em; opacity: 0.8;">Level</div>
        </div>
        <div>
          <div style="font-size: 2em; font-weight: bold; color: #ff6b6b;">${moves}</div>
          <div style="font-size: 0.9em; opacity: 0.8;">Moves</div>
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
      <button id="continue-btn" style="
        background: rgba(255,255,255,0.2);
        border: 2px solid white;
        color: white;
        padding: 15px 25px;
        border-radius: 25px;
        font-size: 1.1em;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 120px;
      " onmouseover="this.style.background='white'; this.style.color='#667eea';" 
         onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.color='white';">
        Continue
      </button>
      
      <button id="restart-btn" style="
        background: rgba(255,255,255,0.2);
        border: 2px solid white;
        color: white;
        padding: 15px 25px;
        border-radius: 25px;
        font-size: 1.1em;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 120px;
      " onmouseover="this.style.background='white'; this.style.color='#667eea';" 
         onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.color='white';">
        Restart
      </button>
      
      <button id="quit-btn" style="
        background: rgba(255,255,255,0.2);
        border: 2px solid white;
        color: white;
        padding: 15px 25px;
        border-radius: 25px;
        font-size: 1.1em;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 120px;
      " onmouseover="this.style.background='white'; this.style.color='#667eea';" 
         onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.color='white';">
        Quit
      </button>
    </div>
  `;

  // Event listeners
  modal.querySelector('#continue-btn').addEventListener('click', onContinue);
  modal.querySelector('#restart-btn').addEventListener('click', onRestart);
  modal.querySelector('#quit-btn').addEventListener('click', onQuit);

  return modal;
}

/**
 * Prikazuje modal sa animacijom
 */
function showModal(container) {
  container.style.pointerEvents = 'auto';
  gsap.to(container, { opacity: 1, duration: 0.3 });
  gsap.to(container.querySelector('div'), { scale: 1, duration: 0.3, ease: 'back.out(1.7)' });
}

/**
 * Sakriva modal sa animacijom
 */
function hideModal(container) {
  gsap.to(container, { 
    opacity: 0, 
    duration: 0.3,
    onComplete: () => {
      container.remove();
    }
  });
  gsap.to(container.querySelector('div'), { scale: 0.8, duration: 0.3 });
}

/**
 * Glavna funkcija za rukovanje level complete flow-om
 * @param {Object} gameState - Stanje igre
 * @param {Object} options - Opcije za modal
 * @returns {Promise<Object>} - Rezultat korisničke akcije
 */
export async function handleLevelComplete(gameState, options = {}) {
  const result = checkLevelComplete(gameState);
  
  if (result.levelComplete) {
    console.log('🎉 Level Complete detected:', result);
    return await showLevelCompleteModal({
      ...options,
      score: result.score,
      level: result.level,
      moves: result.moves,
      reason: result.reason
    });
  }
  
  return { action: 'continue' };
}

/**
 * Utility funkcija za testiranje level complete logike
 * @param {Object} gameState - Stanje igre za testiranje
 */
export function testLevelComplete(gameState) {
  const result = checkLevelComplete(gameState);
  console.log('🧪 Level Complete Test:', result);
  return result;
}
