// public/src/modules/clean-board-modal.ts
// DOM-based overlay (design-first), Board cleared + bonus + Continue

// Keep CSS-based pop-in like homepage slide 1

import { gsap } from 'gsap';
import { createConfettiExplosion } from './confetti-system.js';
import { statsService } from '../services/stats-service.js';
import { boardStatsService } from '../services/board-stats-service.js';
import { pickRandom } from './clean-board-utils.js';
import { formatScoreSimple } from './hud-utils.js';

const HEADLINES = [
  'Outstanding!', 'Amazing!', 'Excellent!', 'Fantastic!', 'Incredible!',
  'Perfect!', 'Brilliant!', 'Superb!', 'Awesome!', 'Spectacular!',
  'Magnificent!', 'Phenomenal!', 'Marvelous!', 'Exceptional!', 'Stellar!',
  'Remarkable!', 'Impressive!', 'Unbelievable!', 'Wonderful!', 'Fabulous!',
  'Sensational!', 'Terrific!', 'Splendid!', 'Exquisite!', 'Divine!',
  'Glorious!', 'Masterful!', 'Flawless!', 'Supreme!', 'Epic!',
  'Legendary!', 'Radiant!', 'Majestic!', 'Unstoppable!', 'Victorious!',
  'Triumphant!', 'Dominant!', 'Epicness!', 'Powerful!', 'Heroic!',
  'Gorgeous!', 'Sparkling!', 'Blazing!', 'Vibrant!', 'Shining!',
  'Golden!', 'Prime!', 'Royal!', 'Ace!', 'Infinite!',
  'Titanic!', 'Grand!', 'Mythic!', 'Immortal!', 'Mega!',
  'Ultra!', 'Primeval!', 'Booming!'
];

interface ShowCleanBoardModalParams {
  app?: any;
  stage?: any;
  getScore?: () => number;
  setScore?: (score: number) => void;
  animateScore?: (score: number, duration?: number) => void;
  updateHUD?: () => void;
  bonus?: number; // Legacy support - if provided, split into combo (50%) and efficiency (50%)
  comboBonus?: number; // 🎯 NEW: Combo bonus (combo count × 50)
  efficiencyBonus?: number; // 🎯 NEW: Efficiency bonus (stack + efficiency + special + clean)
  scoreCap?: number;
  boardNumber?: number;
  forcedStars?: number;
}

// 🔥 REFACTORED: Koristimo pickRandom iz clean-board-utils.ts umjesto lokalne verzije

// 🔥 MEMORY LEAK FIX: Track all timeouts for cleanup
const _modalTimeouts: Set<NodeJS.Timeout> = new Set();
// 🔥 MEMORY LEAK FIX: Track all requestAnimationFrame callbacks for cleanup
const _modalAnimationFrames: Set<number> = new Set();

function trackTimeout(callback: () => void, delay: number): NodeJS.Timeout {
  const timeout = setTimeout(() => {
    callback();
    _modalTimeouts.delete(timeout);
  }, delay);
  _modalTimeouts.add(timeout);
  return timeout;
}

function trackAnimationFrame(callback: FrameRequestCallback): number {
  const rafId = requestAnimationFrame((now: number) => {
    callback(now);
    _modalAnimationFrames.delete(rafId);
  });
  _modalAnimationFrames.add(rafId);
  return rafId;
}

export function clearAllModalTimeouts() {
  console.log(`🧹 Clearing ${_modalTimeouts.size} pending timeouts from clean-board-modal`);
  _modalTimeouts.forEach(timeout => clearTimeout(timeout));
  _modalTimeouts.clear();
}

export function clearAllModalAnimationFrames() {
  console.log(`🧹 Clearing ${_modalAnimationFrames.size} pending animation frames from clean-board-modal`);
  _modalAnimationFrames.forEach(rafId => cancelAnimationFrame(rafId));
  _modalAnimationFrames.clear();
}

export async function showCleanBoardModal({
  app, 
  stage, 
  getScore, 
  setScore, 
  animateScore, 
  updateHUD, 
  bonus = 500, // Legacy support - if provided, split into combo (50%) and efficiency (50%)
  comboBonus, // NEW: Combo bonus (combo count × 50)
  efficiencyBonus, // NEW: Efficiency bonus (stack + efficiency + special + clean)
  scoreCap = 999999, 
  boardNumber = 1,
  forcedStars
}: ShowCleanBoardModalParams = {}): Promise<{ action: string }> {
  return new Promise(async resolve => {
    // 🌟 Add CSS animations for star breathing
    if (!document.getElementById('clean-board-star-animations')) {
      const style = document.createElement('style');
      style.id = 'clean-board-star-animations';
      style.textContent = `
        /* 🌟 Breathing animation for filled stars (inhale/exhale like lungs) - 25% stronger! */
        @keyframes starBreathing {
          0%, 100% {
            transform: scale(0.88); /* Shrink by 12% (inhale) */
          }
          50% {
            transform: scale(1.25); /* Expand by 25% (exhale) - much more dramatic! */
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // 🎯 NEW: Calculate 2-step bonus system
    // Get longest combo for this board
    const boardStats = boardStatsService?.getBoardStats?.(boardNumber) || {};
    const longestCombo = boardStats.longestCombo || 0;
    
    // Calculate combo bonus: longestCombo × 50
    const calculatedComboBonus = longestCombo * 50;
    
    // If comboBonus/efficiencyBonus not provided, calculate them
    // Combo: Always use calculated value (longestCombo × 50)
    // Efficiency: Use legacy bonus if not provided explicitly
    const safeComboBonus = Math.max(0, (comboBonus !== undefined ? comboBonus : calculatedComboBonus) | 0);
    const safeEfficiencyBonus = Math.max(0, (efficiencyBonus !== undefined ? efficiencyBonus : (bonus || 500)) | 0);
    const totalBonus = safeComboBonus + safeEfficiencyBonus;
    
    console.log('🎯 Bonus calculation:', {
      longestCombo,
      calculatedComboBonus,
      finalComboBonus: safeComboBonus,
      efficiencyBonus: safeEfficiencyBonus,
      totalBonus
    });
    
    // Calculate score values
    const rawCurrent = typeof getScore === 'function' ? (getScore()|0) : 0;
    const currentScore = Math.max(0, rawCurrent);
    const scoreAfterCombo = Math.min(scoreCap, currentScore + safeComboBonus);
    const finalScore = Math.min(scoreCap, scoreAfterCombo + safeEfficiencyBonus);
    
    // Get previous best score (board-specific first, then legacy/global fallback)
    const getBestScore = (): number => {
      try {
        const boardStats = boardStatsService?.getBoardStats?.(boardNumber);
        const boardHighScore = boardStats?.highScore;
        if (Number.isFinite(boardHighScore)) {
          return boardHighScore | 0;
        }
      } catch (boardError) {
        console.warn('⚠️ Failed to read board high score:', boardError);
      }

      try {
        if (statsService && typeof statsService.getStats === 'function') {
          const stats = statsService.getStats();
          const highScore = stats?.highScore;
          if (Number.isFinite(highScore)) {
            return highScore | 0;
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to read high score from statsService:', error);
      }
      try {
        const legacy = localStorage.getItem('cc_best_score_v1');
        if (legacy) {
          return parseInt(legacy, 10) || 0;
        }
      } catch (legacyError) {
        console.warn('⚠️ Failed to read legacy high score key:', legacyError);
      }
      return 0;
    };
    const previousBestScore = getBestScore();
    const highScoreJustUpdated = typeof statsService?.wasHighScoreJustUpdated === 'function'
      ? statsService.wasHighScoreJustUpdated(finalScore)
      : false;
    // Use final score (includes bonus) against board-specific high score
    const isNewHighScore = finalScore > previousBestScore || highScoreJustUpdated;
    
    console.log('🏆 High score check:', {
      currentScore,
      comboBonus: safeComboBonus,
      efficiencyBonus: safeEfficiencyBonus,
      totalBonus,
      previousBestScore,
      finalScore,
      isNewHighScore
    });
    
    const overlayId = 'cc-clean-board-overlay';
    const old = document.getElementById(overlayId);
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = overlayId;
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:#f3eee8',
      'z-index:10000000000000',
      'opacity:0',
      'transition:opacity .2s ease',
      'overflow:visible' // Allow particles to float freely
    ].join(';');

    // Card
    const card = document.createElement('div');
    card.style.cssText = [
      'background:transparent',
      'border-radius:40px',
      'padding:40px 32px',
      'text-align:center',
      'font-family:"LTCrow", system-ui, -apple-system, sans-serif',
      'transform:scale(0.9)',
      'transition:transform .34s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease',
      'opacity:0',
      'max-width:min(340px,88vw)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:40px',
      'overflow:visible' // Allow particles to float freely
    ].join(';');

    // 🌟 NEW: Stars Container (3 stars: empty + filled on top based on score)
    const starsContainer = document.createElement('div');
    starsContainer.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:16px', // 🌟 16px razmak između zvjezdica
      'width:min(280px,80vw)',
      'height:auto',
      'margin:0 auto',
      'overflow:visible' // Allow particles to float outside container
    ].join(';');
    
    // 🌟 NEW: Calculate number of stars based on FINAL score (after BOTH bonuses!)
    const computedStars = finalScore < 1000 ? 1 : finalScore < 3000 ? 2 : 3;
    const numStars = Number.isFinite(forcedStars)
      ? Math.min(3, Math.max(1, forcedStars as number))
      : computedStars;
    console.log(`🌟 Base Score: ${currentScore}, Combo: +${safeComboBonus}, Efficiency: +${safeEfficiencyBonus}, Final: ${finalScore}, Stars: ${numStars}`);
    
    // Create 3 star containers (each has empty star + filled star on top)
    const starElements: Array<{ 
      container: HTMLElement; 
      emptyImg: HTMLImageElement; 
      filledImg: HTMLImageElement;
    }> = [];
    
    for (let i = 0; i < 3; i++) {
      // Star container (holds both empty and filled)
      const starContainer = document.createElement('div');
      
      // 🌟 NEW: Apply rotation and position based on star index
      // Left star (i=0): -8° rotation
      // Middle star (i=1): translateY -16px (16px higher than left/right)
      // Right star (i=2): +8° rotation
      let transformStyle = '';
      if (i === 0) {
        transformStyle = 'rotate(-8deg)'; // Left: counter-clockwise
      } else if (i === 1) {
        transformStyle = 'translateY(-16px)'; // Middle: 16px higher (8 + 8 = 16px)
      } else if (i === 2) {
        transformStyle = 'rotate(8deg)'; // Right: clockwise
      }
      
      starContainer.style.cssText = [
        'position:relative',
        'width:clamp(60px, 20vw, 90px)',
        'height:clamp(60px, 20vw, 90px)',
        'flex-shrink:0',
        `transform:${transformStyle}`,
        'overflow:visible' // Allow particles to float outside star bounds
      ].join(';');
      
      // Empty star (always visible, background layer)
      const emptyStar = document.createElement('img');
      emptyStar.src = './assets/modals/star-empty.png';
      emptyStar.alt = 'Empty star';
      emptyStar.style.cssText = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        'object-fit:contain',
        'z-index:1'
      ].join(';');
      
      // Filled star (on top, hidden initially, will bounce in)
      const filledStar = document.createElement('img');
      filledStar.src = './assets/modals/star.png';
      filledStar.alt = 'Filled star';
      filledStar.style.cssText = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        'object-fit:contain',
        'z-index:2',
        'opacity:0',
        'transform:scale(0)',
        'transition:none'
      ].join(';');
      
      starContainer.appendChild(emptyStar); // z:1 - back
      starContainer.appendChild(filledStar); // z:2 - front
      starsContainer.appendChild(starContainer);
      
      starElements.push({
        container: starContainer,
        emptyImg: emptyStar,
        filledImg: filledStar
      });
    }
    
    // Use starsContainer as hero for animation purposes
    const hero = starsContainer;

    // Content stacks replicate design spacing (hero + text)
    const infoStack = document.createElement('div');
    infoStack.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:48px', // 🌟 48px spacing between stars and title (56 - 8 = 48px)
      'width:100%',
      'overflow:visible' // Allow particles to float outside
    ].join(';');

    const textCluster = document.createElement('div');
    textCluster.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:16px',
      'width:100%'
    ].join(';');

    const scoreGroup = document.createElement('div');
    scoreGroup.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:8px',
      'width:100%'
    ].join(';');

    // Title (random headline)
    const title = document.createElement('div');
    title.textContent = pickRandom(HEADLINES);
    title.style.cssText = 'color:#B07F69;font-weight:800;font-size:40px;line-height:1;margin:0;';

    // "Your score" label (or "NEW Highscore" if new high score)
    const scoreLabel = document.createElement('div');
    scoreLabel.style.cssText = 'color:#b69077;font-weight:600;font-size:20px;line-height:1.2;margin:0;letter-spacing:0.02em;';
    
    // Set label text based on whether it's a new high score
    if (isNewHighScore) {
      scoreLabel.innerHTML = '<span style="color:#E97A55;font-weight:900;font-size:20px;letter-spacing:0.02em;">NEW</span> <span>Highscore</span>';
    } else {
      scoreLabel.textContent = 'Your score';
    }

    // Main score display (simple text, no flip animation)
    const mainScore = document.createElement('div');
    mainScore.textContent = '0';
    mainScore.style.cssText = 'color:#E77449;font-weight:800;font-size:64px;line-height:1;margin:0;';

    // Bonus + cleared status share the same visual slot
    // iOS FIX: Use absolute positioning instead of grid to prevent rotation bug
    const statusSlot = document.createElement('div');
    statusSlot.style.cssText = [
      'position:relative',
      'width:100%',
      'min-height:52px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'transform: none',
      'animation: none',
      '-webkit-transform: none'
    ].join(';');

    // 🎯 NEW: Combo Bonus Wrapper (shows first)
    const comboWrapper = document.createElement('div');
    comboWrapper.style.cssText = [
      'position:absolute',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:6px',
      'opacity:0',
      'transform:scale(0.75) translateY(-8px)',
      'width:100%'
    ].join(';');

    const comboValue = document.createElement('div');
    comboValue.textContent = `+${safeComboBonus}`;
    comboValue.style.cssText = 'color:#E77449;font-weight:800;font-size:36px;line-height:1;';

    const comboLabel = document.createElement('div');
    comboLabel.textContent = longestCombo > 0 ? `Combo x${longestCombo}` : 'Combo bonus';
    comboLabel.style.cssText = 'color:#c48a6d;font-weight:600;font-size:18px;line-height:1;letter-spacing:0.02em;';

    comboWrapper.appendChild(comboValue);
    comboWrapper.appendChild(comboLabel);

    // 🎯 NEW: Efficiency Bonus Wrapper (shows second)
    const efficiencyWrapper = document.createElement('div');
    efficiencyWrapper.style.cssText = [
      'position:absolute',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:6px',
      'opacity:0',
      'transform:scale(0.75) translateY(-8px)',
      'width:100%'
    ].join(';');

    const efficiencyValue = document.createElement('div');
    efficiencyValue.textContent = `+${safeEfficiencyBonus}`;
    efficiencyValue.style.cssText = 'color:#E77449;font-weight:800;font-size:36px;line-height:1;';

    const efficiencyLabel = document.createElement('div');
    efficiencyLabel.textContent = 'Efficiency';
    efficiencyLabel.style.cssText = 'color:#c48a6d;font-weight:600;font-size:18px;line-height:1;letter-spacing:0.02em;';

    efficiencyWrapper.appendChild(efficiencyValue);
    efficiencyWrapper.appendChild(efficiencyLabel);

    // Board cleared text (initially hidden)
    const boardCleared = document.createElement('div');
    const boardNumberLabel = boardNumber.toString().padStart(2, '0');
    boardCleared.textContent = `Board ${boardNumberLabel} cleared`;
    // SIMPLE: Just text, no transforms, no animations
    boardCleared.style.position = 'absolute';
    boardCleared.style.color = '#b69077';
    boardCleared.style.fontWeight = '600';
    boardCleared.style.fontSize = '20px';
    boardCleared.style.lineHeight = '1.2';
    boardCleared.style.margin = '0';
    boardCleared.style.opacity = '0';
    boardCleared.style.letterSpacing = '0.02em';
    boardCleared.style.width = '100%';
    boardCleared.style.textAlign = 'center';

    // 🔥 NEW LOGIC: Check if user came from interim board or regular board (detail modal)
    const isFromInterimBoard = (window as any).__ccFromInterimBoard === true;
    console.log(`🎯 Clean board modal: isFromInterimBoard = ${isFromInterimBoard}`);
    
    // Responsive width logic
    const isMobile = window.innerWidth <= 428;
    const isIPad = window.innerWidth >= 768 && window.innerWidth <= 1024;
    const buttonWidth = (isMobile || isIPad) ? '249px' : '310px';
    
    // 🔥 NEW: Create button container (for 1 or 2 buttons)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `width:${buttonWidth};max-width:80vw;display:flex;flex-direction:column;gap:16px;`;
    
    // 🔥 NEW: Primary button (either "Continue" for interim or "Play Again" for regular)
    const primaryBtn = document.createElement('button');
    primaryBtn.type = 'button';
    primaryBtn.textContent = isFromInterimBoard ? 'Continue' : 'Play Again';
    primaryBtn.className = 'restart-btn primary-button bottom-sheet-cta';
    primaryBtn.style.width = '100%';
    primaryBtn.style.maxWidth = buttonWidth;
    primaryBtn.style.whiteSpace = 'nowrap';
    
    // 🔥 NEW: Secondary button (only for regular boards - "Exit")
    let secondaryBtn: HTMLButtonElement | null = null;
    if (!isFromInterimBoard) {
      secondaryBtn = document.createElement('button');
      secondaryBtn.type = 'button';
      secondaryBtn.textContent = 'Exit';
      secondaryBtn.className = 'exit-btn bottom-sheet-cta';
      secondaryBtn.style.width = '100%';
      secondaryBtn.style.maxWidth = buttonWidth;
      secondaryBtn.style.whiteSpace = 'nowrap';
    }
    
    // Add buttons to container
    buttonContainer.appendChild(primaryBtn);
    if (secondaryBtn) {
      buttonContainer.appendChild(secondaryBtn);
    }
    
    // Keep reference to primaryBtn for existing code (was "btn")
    const btn = primaryBtn;

    // 🔥 NEW: Outer stack to isolate buttons from card scaling
    const outerStack = document.createElement('div');
    outerStack.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:18px',
      'position:relative'
    ].join(';');

    // 🎯 PURE CSS APPROACH - JavaScript only adds/removes classes
    // All animations handled by CSS classes in style.css
    const buttonStaggerMs = 350; // Delay between Play Again and Exit button appearance

    // Set button to hidden state (before animation)
    const setButtonInitialState = (button: HTMLButtonElement) => {
      button.classList.add('clean-board-button-hidden');
    };

    // Animate button in (bounce entrance)
    const animateButtonIn = (button: HTMLButtonElement) => {
      button.removeAttribute('data-clean-board-exiting');
      button.classList.remove('clean-board-button-hidden');
      button.classList.add('clean-board-button-visible');
    };

    const buttonExitDurationMs = 650; // CSS animate-exit duration

    // Animate button out (scale to 0 exit)
    const animateButtonExit = (button: HTMLButtonElement) => {
      button.disabled = true;
      button.blur();
      
      // Remove animation classes
      button.classList.remove(
        'clean-board-button-hidden',
        'clean-board-button-visible',
        'clean-board-button-exit'
      );
      
      // Force reflow with clean state
      button.style.transition = 'none';
      button.style.transform = 'scale(1)';
      void button.offsetHeight;
      
      // Apply CSS exit animation
      requestAnimationFrame(() => {
        button.style.transition = '';
        button.style.transform = '';
        button.classList.add('animate-exit');
      });
    };


    infoStack.appendChild(hero);
    textCluster.appendChild(title);
    textCluster.appendChild(scoreLabel);
    scoreGroup.appendChild(mainScore);
    scoreGroup.appendChild(statusSlot);
    textCluster.appendChild(scoreGroup);
    infoStack.appendChild(textCluster);
    card.appendChild(infoStack);
    statusSlot.appendChild(comboWrapper);
    statusSlot.appendChild(efficiencyWrapper);
    statusSlot.appendChild(boardCleared);
    outerStack.appendChild(card);
    outerStack.appendChild(buttonContainer);
    el.appendChild(outerStack);
    document.body.appendChild(el);

    // Score bookkeeping (already calculated above for high score check)

    const formatScore = (value: number): string => {
      const safe = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
      return safe.toString();
    };

    // 🔥 ANIMATION: Start with 0, will animate to currentScore
    mainScore.textContent = '0';
    comboValue.textContent = `+${formatScoreSimple(safeComboBonus)}`;
    efficiencyValue.textContent = `+${formatScoreSimple(safeEfficiencyBonus)}`;

    // Prepare initial pop-in states
    const setInit = (element: HTMLElement, dy: number, scale = 0): void => {
      element.style.opacity = '0';
      element.style.transform = `scale(${scale}) translateY(${dy}px)`;
      element.style.transition = 'none';
    };
    
    // 🌟 NEW: Set initial state for all elements (including stars container)
    setInit(hero, -25, 0); // Stars container
    setInit(title, -20);
    setInit(scoreLabel, -15);
    setInit(mainScore, -10);
    setInit(comboWrapper, -6, 0.65); // First bonus
    setInit(efficiencyWrapper, -6, 0.65); // Second bonus
    // CRITICAL: No initial scale for boardCleared - just opacity
    boardCleared.style.opacity = '0';
    boardCleared.style.transition = 'none';
    
    // 🎯 PURE CSS: Set BOTH buttons to hidden state (CSS handles all animations)
    setButtonInitialState(primaryBtn);
    if (secondaryBtn) {
      setButtonInitialState(secondaryBtn);
    }
    
    // Show modal and card immediately
    el.style.opacity = '1';
    card.style.opacity = '1';
    card.style.transform = 'scale(1)';
    
    // Wait for next frame to ensure elements are rendered
    requestAnimationFrame(() => {
      const trans = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      hero.style.transition = trans;
      title.style.transition = trans;
      scoreLabel.style.transition = trans;
      mainScore.style.transition = trans;

      // 🔥 ANIMATION: Animate score counting from 0 to target value
      const updateScore = (newScore: number, animate: boolean = true): void => {
        if (!animate) {
          mainScore.textContent = formatScoreSimple(newScore);
          return;
        }
        
        // Get current displayed value - parse from textContent
        const currentText = mainScore.textContent || '0';
        // Remove all non-numeric characters and parse
        const cleanedText = currentText.replace(/[^0-9]/g, '');
        const currentDisplayed = cleanedText ? parseInt(cleanedText, 10) : 0;
        const targetScore = Math.max(0, Math.floor(newScore));
        
        console.log('🎯 updateScore called:', { 
          currentText, 
          cleanedText, 
          currentDisplayed, 
          targetScore, 
          newScore 
        });
        
        if (currentDisplayed === targetScore) {
          mainScore.textContent = formatScoreSimple(targetScore);
          return;
        }
        
        // Kill any existing animation on scoreProxy object
        let scoreProxy = { value: currentDisplayed };
        gsap.killTweensOf(scoreProxy);
        
        // Reset proxy to current value
        scoreProxy.value = currentDisplayed;
        
        // Calculate duration: minimum 0.8s, maximum 1.5s, based on difference
        const diff = Math.abs(targetScore - currentDisplayed);
        const duration = Math.min(1.5, Math.max(0.8, diff / 500)); // Slower for better visibility
        
        console.log('🎯 Starting score animation:', { 
          from: currentDisplayed, 
          to: targetScore, 
          duration, 
          diff 
        });
        
        const scoreTween = gsap.to(scoreProxy, {
          value: targetScore,
          duration: duration,
          ease: 'power2.out',
          onUpdate: () => {
            const rounded = Math.round(scoreProxy.value);
            const formatted = formatScoreSimple(rounded);
            mainScore.textContent = formatted;
            console.log('🔄 Score update:', rounded, '->', formatted);
          },
          onComplete: () => {
            mainScore.textContent = formatScoreSimple(targetScore);
            console.log('✅ Score animation complete:', targetScore);
          }
        });
        activeGSAPTweens.push(scoreTween);
      };

      // 🎯 NEW: Transfer Combo Bonus (Step 1)
      const transferComboBonus = (): void => {
        const durationMs = safeComboBonus > 0 ? 1400 : 800;
        const durationSec = durationMs / 1000;
        mainScore.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        mainScore.style.transform = 'scale(1.08) translateY(0)';
        setTimeout(() => {
          mainScore.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
          mainScore.style.transform = 'scale(1) translateY(0)';
        }, 420);

        // 🔥 ANIMATION: Animate score from current to scoreAfterCombo
        updateScore(scoreAfterCombo, true);

        // Animate combo bonus countdown separately
        const comboProxy = { value: safeComboBonus };
        const comboTween = gsap.to(comboProxy, {
          value: 0,
          duration: durationSec,
          ease: 'power2.out',
          onUpdate: () => {
            comboValue.textContent = `+${formatScoreSimple(Math.round(comboProxy.value))}`;
          },
          onComplete: () => {
            comboValue.textContent = '+0';
          }
        });
        activeGSAPTweens.push(comboTween);
      };

      // 🎯 NEW: Transfer Efficiency Bonus (Step 2)
      const transferEfficiencyBonus = (): void => {
        const durationMs = safeEfficiencyBonus > 0 ? 1400 : 800;
        const durationSec = durationMs / 1000;
        mainScore.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        mainScore.style.transform = 'scale(1.08) translateY(0)';
        setTimeout(() => {
          mainScore.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
          mainScore.style.transform = 'scale(1) translateY(0)';
        }, 420);

        // 🔥 ANIMATION: Animate score from scoreAfterCombo to finalScore
        updateScore(finalScore, true);

        // Animate efficiency bonus countdown separately
        const efficiencyProxy = { value: safeEfficiencyBonus };
        const efficiencyTween = gsap.to(efficiencyProxy, {
          value: 0,
          duration: durationSec,
          ease: 'power2.out',
          onUpdate: () => {
            efficiencyValue.textContent = `+${formatScoreSimple(Math.round(efficiencyProxy.value))}`;
          },
          onComplete: () => {
            efficiencyValue.textContent = '+0';
          }
        });
        activeGSAPTweens.push(efficiencyTween);
      };

      {
        // SEQUENCE 1: Initial elements pop-in WITH CONFETTI EXPLOSION
        // Start confetti 400ms earlier (immediately, no delay)
        createConfettiExplosion(hero);
        
        setTimeout(() => {
          // 🌟 Hero is now stars container, animate it in
          console.log('🌟 Animating stars container (hero) to visible');
          hero.style.transition = trans;
          hero.style.opacity = '1';
          hero.style.transform = 'scale(1) translateY(0)';
          console.log('🌟 Hero styles set:', { opacity: hero.style.opacity, transform: hero.style.transform });
          
          // 🌟 NEW: Animate stars filling in with bounce effect (like hearts)
          // Delay 500ms after hero appears, then fill stars one by one (left → middle → right)
          setTimeout(() => {
            starElements.forEach((star, index) => {
              // Only fill stars that were earned (numStars)
              if (index < numStars) {
                setTimeout(() => {
                  const { filledImg, emptyImg } = star;
                  
                  // 🌟 Hide empty star when filled star appears (no background visibility when pulsing)
                  emptyImg.style.opacity = '0';
                  emptyImg.style.transition = 'opacity 0.2s ease';
                  
                  // 🌟 Stronger bounce animation using GSAP (scale 0 → 1.4 → 0.88 with springy bounce)
                  // Set initial state
                  gsap.set(filledImg, {
                    scale: 0,
                    opacity: 1,
                    transformOrigin: 'center center'
                  });
                  
                  // Create bounce timeline
                  const bounceTl = gsap.timeline();
                  
                  // 🎾 TRAMPOLIN BOUNCE: Scale 0 → 0.88 sa jako elastic/springy easing
                  // elastic.out(amplitude, period) - manji period = više bounces (trampolin efekt!)
                  // 🔥 END at scale 0.88 to match breathing animation START (seamless transition!)
                  bounceTl.to(filledImg, {
                    scale: 0.88, // 🔥 Match breathing animation start (scale(0.88) at 0%)
                    duration: 1.2, // Duže trajanje za više bounce-ova (trampolin!)
                    ease: 'elastic.out(1.5, 0.4)' // Jači elastic za više bouncy "boing boing" efekt!
                    // amplitude 1.5 = jak overshoot
                    // period 0.4 = više oscillacija (bouncy trampolin!)
                  });
                  
                  // 🌟 After bounce completes at scale(0.88), SEAMLESSLY start breathing animation
                  // Breathing starts at scale(0.88) → NO JUMP, perfectly fluid!
                  bounceTl.call(() => {
                    // Breathing/pulsating animation (inhale/exhale like lungs)
                    // Starts at 0.88 (current scale) → 1.25 → 0.88 loop
                    filledImg.style.animation = 'starBreathing 2.5s ease-in-out infinite';
                  });
                  
                  // Track timeline for cleanup
                  starBounceTimelines.push(bounceTl);
                  
                  console.log(`🌟 Star ${index + 1} filled with TRAMPOLIN BOUNCY bounce! (0 → 0.88 elastic springy → seamless breathing, delay: ${index * 500}ms)`);
                }, index * 500); // 🌟 500ms delay between each star (left → middle → right)
              }
            });
          }, 500); // 🌟 Start filling stars 500ms after hero appears
        }, 100);
        setTimeout(() => {
          title.style.opacity = '1';
          title.style.transform = 'scale(1) translateY(0)';
        }, 220);
        setTimeout(() => {
          scoreLabel.style.opacity = '1';
          scoreLabel.style.transform = 'scale(1) translateY(0)';
        }, 320);
        setTimeout(() => {
          mainScore.style.opacity = '1';
          mainScore.style.transform = 'scale(1) translateY(0)';
          // 🔥 ANIMATION: Start counting from 0 to currentScore when score appears
          // Add small delay to ensure element is fully visible before animation starts
          setTimeout(() => {
            console.log('🎯 Starting initial score animation from 0 to', currentScore);
            updateScore(currentScore, true);
          }, 50); // Small delay to ensure element is rendered
        }, 420);

        // SEQUENCE 2: Score already displayed (no animation needed)

        // 🎯 SEQUENCE 3: Combo Bonus pop-in
        setTimeout(() => {
          comboWrapper.style.transition = 'opacity 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          comboWrapper.style.opacity = '1';
          comboWrapper.style.transform = 'scale(1) translateY(0)';
        }, 1350);

        // 🎯 SEQUENCE 4: Transfer Combo Bonus into score (draining to zero)
        setTimeout(() => {
          if (safeComboBonus <= 0) {
            comboValue.textContent = '+0';
            updateScore(scoreAfterCombo, true);
          } else {
            transferComboBonus();
          }
        }, 2150);

        // 🎯 SEQUENCE 5: Hide Combo, show Efficiency Bonus
        setTimeout(() => {
          // Hide combo bonus
          comboWrapper.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          comboWrapper.style.opacity = '0';
          comboWrapper.style.transform = 'scale(0.8) translateY(-8px)';

          setTimeout(() => {
            comboWrapper.style.visibility = 'hidden';
            comboWrapper.style.display = 'none';
            
            // Show efficiency bonus
            efficiencyWrapper.style.transition = 'opacity 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
            efficiencyWrapper.style.opacity = '1';
            efficiencyWrapper.style.transform = 'scale(1) translateY(0)';
          }, 320);
        }, 3650);

        // 🎯 SEQUENCE 6: Transfer Efficiency Bonus into score (draining to zero)
        setTimeout(() => {
          if (safeEfficiencyBonus <= 0) {
            efficiencyValue.textContent = '+0';
            updateScore(finalScore, true);
          } else {
            transferEfficiencyBonus();
          }
        }, 4600);

        // 🎯 SEQUENCE 7: Hide Efficiency, show "Board cleared" label
        setTimeout(() => {
          efficiencyWrapper.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          efficiencyWrapper.style.opacity = '0';
          efficiencyWrapper.style.transform = 'scale(0.8) translateY(-8px)';

          setTimeout(() => {
            efficiencyWrapper.style.visibility = 'hidden';
            efficiencyWrapper.style.display = 'none';
            // SIMPLE transition - only opacity, NO transforms at all
            boardCleared.style.transition = 'opacity 0.4s ease';
            boardCleared.style.opacity = '1';
          }, 320);
        }, 6100);

        // 🎯 SEQUENCE 8: Button(s) pop-in (sequential bounce - Play Again first, then Exit)
        // Buttons appear AFTER "Board cleared" (6100ms + 320ms + 200ms = 6620ms)
        setTimeout(() => {
          // PRIMARY BUTTON (Play Again) - bounce in immediately
          animateButtonIn(primaryBtn);
          
          // SECONDARY BUTTON (Exit) - bounce in 350ms after Play Again (sekvencijalno)
          if (secondaryBtn) {
            setTimeout(() => {
              animateButtonIn(secondaryBtn);
            }, buttonStaggerMs); // 350ms delay between buttons
          }
        }, 6620); // After boardCleared (6100 + 320 + 200)
      }
    }); // Close requestAnimationFrame from line 431

    // 🔥 MEMORY LEAK FIX: Track button event listeners for cleanup
    const buttonEventListeners: Array<{ 
      button: HTMLButtonElement; 
      handlers: Array<{ event: string; handler: EventListener; options?: any }> 
    }> = [];
    
    // 🌟 Track star bounce animations for cleanup
    const starBounceTimelines: Array<gsap.core.Timeline> = [];
    
    // 🔥 Track all GSAP tweens for cleanup (score, combo, efficiency animations)
    const activeGSAPTweens: Array<gsap.core.Tween> = [];
    
    // 🔥 CLEANUP: Kill all GSAP tweens (score, combo, efficiency animations)
    const killAllGSAPTweens = () => {
      activeGSAPTweens.forEach(tween => {
        try {
          tween.kill();
        } catch (e) {}
      });
      activeGSAPTweens.length = 0;
      
      // Also kill tweens on all DOM elements
      try {
        gsap.killTweensOf([hero, title, scoreLabel, mainScore, statusSlot, boardCleared, card]);
      } catch (e) {}
      
      console.log('✅ All GSAP tweens killed!');
    };
    
    // 🌟 CLEANUP: Stop all star animations and breathing
    const stopAllStarAnimations = () => {
      // Kill all star bounce timelines
      starBounceTimelines.forEach(tl => {
        try {
          tl.kill();
        } catch (e) {}
      });
      starBounceTimelines.length = 0;
      
      // Stop breathing animations and reset star states
      starElements.forEach(({ filledImg, emptyImg }) => {
        if (filledImg) {
          try {
            filledImg.style.animation = 'none';
            gsap.killTweensOf(filledImg);
          } catch (e) {}
        }
        // Reset empty star visibility (in case cleanup happens mid-animation)
        if (emptyImg) {
          try {
            emptyImg.style.opacity = '1';
          } catch (e) {}
        }
      });
      
      console.log('✅ All star animations cleaned up!');
    };
    
    // 🔥 CLEANUP: Remove CSS style tag
    const removeStyleTag = () => {
      try {
        const styleTag = document.getElementById('clean-board-star-animations');
        if (styleTag) {
          styleTag.remove();
          console.log('✅ CSS style tag removed!');
        }
      } catch (e) {
        console.warn('⚠️ Failed to remove CSS style tag:', e);
      }
    };
    
    // Add button press handling for proper UX
    const addButtonPressHandling = (button: HTMLButtonElement, action: () => void): void => {
      let touchStarted = false;
      let touchStartedOnButton = false;
      
      const handleTouchStart = (e: TouchEvent) => {
        touchStarted = true;
        touchStartedOnButton = button.contains(e.target as Node);
        // 🔥 REMOVED inline styles - CSS :active handles scale(0.80)
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        if (touchStarted && touchStartedOnButton) {
          // Check if touch moved outside button
          const touch = e.touches[0];
          const rect = button.getBoundingClientRect();
          const isOutside = touch.clientX < rect.left || touch.clientX > rect.right || 
                           touch.clientY < rect.top || touch.clientY > rect.bottom;
          
          if (isOutside) {
            // Cancel the touch
            touchStartedOnButton = false;
            // 🔥 REMOVED inline style reset - CSS handles it
          }
        }
      };
      
      const handleTouchEnd = (e: TouchEvent) => {
        if (touchStarted && touchStartedOnButton) {
          // Only trigger if touch ended on button
          const touch = e.changedTouches[0];
          const rect = button.getBoundingClientRect();
          const isOnButton = touch.clientX >= rect.left && touch.clientX <= rect.right && 
                            touch.clientY >= rect.top && touch.clientY <= rect.bottom;
          
          if (isOnButton) {
            action();
          }
        }
        
        // 🔥 REMOVED inline style reset - CSS handles it
        touchStarted = false;
        touchStartedOnButton = false;
      };
      
      const handleMouseDown = () => {
        touchStartedOnButton = true;
        // 🔥 REMOVED inline styles - CSS :active handles scale(0.80)
      };
      
      const handleMouseUp = (e: MouseEvent) => {
        if (touchStartedOnButton && button.contains(e.target as Node)) {
          action();
        }
        
        // 🔥 REMOVED inline style reset - CSS handles it
        touchStartedOnButton = false;
      };
      
      const handleMouseLeave = () => {
        // 🔥 REMOVED inline style reset - CSS handles it
        touchStartedOnButton = false;
      };
      
      // Add event listeners
      button.addEventListener('touchstart', handleTouchStart, { passive: true });
      button.addEventListener('touchmove', handleTouchMove, { passive: true });
      button.addEventListener('touchend', handleTouchEnd, { passive: true });
      button.addEventListener('mousedown', handleMouseDown);
      button.addEventListener('mouseup', handleMouseUp);
      button.addEventListener('mouseleave', handleMouseLeave);
      
      // 🔥 MEMORY LEAK FIX: Track listeners for cleanup
      buttonEventListeners.push({
        button,
        handlers: [
          { event: 'touchstart', handler: handleTouchStart as EventListener, options: { passive: true } },
          { event: 'touchmove', handler: handleTouchMove as EventListener, options: { passive: true } },
          { event: 'touchend', handler: handleTouchEnd as EventListener, options: { passive: true } },
          { event: 'mousedown', handler: handleMouseDown as EventListener },
          { event: 'mouseup', handler: handleMouseUp as EventListener },
          { event: 'mouseleave', handler: handleMouseLeave as EventListener }
        ]
      });
    };
    
    // 🔥 MEMORY LEAK FIX: Cleanup function to remove all event listeners
    const cleanupButtonListeners = () => {
      buttonEventListeners.forEach(({ button, handlers }) => {
        handlers.forEach(({ event, handler, options }) => {
          try {
            button.removeEventListener(event, handler, options);
          } catch (e) {
            console.warn(`⚠️ Failed to remove ${event} listener:`, e);
          }
        });
      });
      buttonEventListeners.length = 0;
      console.log('✅ All button event listeners removed');
    };

    // 🔥 NEW: Primary button handler (Continue for interim, Play Again for regular)
    addButtonPressHandling(primaryBtn, async () => {
      // Haptic for primary button
      if (typeof (window as any).triggerHapticSelection === 'function') {
        (window as any).triggerHapticSelection();
      }
      
      primaryBtn.disabled = true;
      if (secondaryBtn) secondaryBtn.disabled = true;
      
      // 🔥 Mark overlay as exiting to neutralize :active styles
      el.setAttribute('data-clean-board-exiting', 'true');

      // 🔥 CRITICAL: Stop ALL background animations IMMEDIATELY for smooth exit
      // This prevents choppy exit animation caused by ongoing GSAP tweens and star animations
      killAllGSAPTweens(); // Kill score/combo/efficiency animations
      stopAllStarAnimations(); // Stop star bounce and breathing
      clearAllModalTimeouts(); // Clear all pending timeouts
      clearAllModalAnimationFrames(); // Clear all animation frames
      
      // CRITICAL: Reset boardCleared before exit animation - NO transforms at all
      boardCleared.style.transition = 'none';
      boardCleared.style.animation = 'none';
      boardCleared.style.transform = 'none';
      boardCleared.style.webkitTransform = 'none';
      
      // Also reset parent container
      statusSlot.style.transform = 'none';
      statusSlot.style.webkitTransform = 'none';
      
      // 🎯 Also reset bonus wrappers in case they're visible
      comboWrapper.style.transition = 'none';
      comboWrapper.style.transform = 'scale(1) translateY(0)';
      efficiencyWrapper.style.transition = 'none';
      efficiencyWrapper.style.transform = 'scale(1) translateY(0)';
      
      // Force reflow to apply reset
      void boardCleared.offsetHeight;
      void statusSlot.offsetHeight;
      
      // Buttons are outside the card, so card scale won't move them
      
      const exitTrans = 'opacity 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      const exitOffsets = [-22, -18, -14, -10, -6, -4, -2];
      const exitScale = [0, 0.08, -0.04, 0.05, -0.02, 0.03, -0.01];
        // 🎯 Regular elements (NOT buttons - they use CSS class animate-exit like homepage slider)
        const nodes = [hero, title, scoreLabel, mainScore, statusSlot, boardCleared];
        nodes.forEach((node) => { node.style.transition = exitTrans; });
 
        // 🎯 BUTTONS: Animate INDIVIDUALLY (not as container)
        // 🔥 USER REQUEST: Animate clicked button FIRST, then other button with 300ms delay
        // Primary button (Play Again/Continue) was clicked - animate it FIRST
        animateButtonExit(primaryBtn);
        
        // Exit button animates AFTER Play Again starts (500ms faster than before)
        if (secondaryBtn) {
          setTimeout(() => {
            animateButtonExit(secondaryBtn);
          }, 200); // 🔥 USER REQUEST: 500ms faster (was 700ms, now 200ms)
        }
 
        requestAnimationFrame(() => {
        nodes.forEach((node, idx) => {
          const delay = idx * 60;
          setTimeout(() => {
            const extra = exitScale[idx] || 0;
            node.style.opacity = '0';
            node.style.transform = `scale(${0.0 + extra}) translateY(${exitOffsets[idx]}px)`;
          }, delay);
        });
      });
      // 🔥 FIX: Delay card scale animation until AFTER buttons start animating
      // This prevents buttons from moving up with card scale
      setTimeout(() => {
        card.style.transition = 'transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        requestAnimationFrame(() => {
          card.style.transform = 'scale(0.86)';
        });
      }, 400); // Delay card scale until buttons are mid-animation
      // 🎯 Calculate duration: buttons need FULL 400ms to animate to scale(0) (FASTER exit)
      // Give EXTRA time to ensure button animation completes BEFORE card fadeout
      const buttonExitDuration = buttonExitDurationMs;
      const extraBuffer = 200;
      const buttonDelay = 200; // 🔥 USER REQUEST: 500ms faster (was 700ms, now 200ms)
      const collapseDuration = secondaryBtn 
        ? nodes.length * 60 + buttonDelay + buttonExitDuration + extraBuffer  // With Exit button: 360 + 200 + 650 + 200 = 1410ms
        : nodes.length * 60 + buttonExitDuration + extraBuffer;               // Without Exit button: 360 + 650 + 200 = 1210ms
      setTimeout(() => {
        card.style.transition = 'transform 0.30s ease, opacity 0.30s ease';
        card.style.opacity = '0';
        el.style.transition = 'opacity 0.30s ease';
        el.style.opacity = '0';
      }, collapseDuration);
      
      // CRITICAL: Update score with bonus when Continue is clicked
      try {
        const cur = typeof getScore === 'function' ? (getScore()|0) : 0;
        const next = Math.min(scoreCap, cur + (bonus|0));
        console.log('💾 clean-board-modal: Setting final score on Continue:', cur, '+', bonus, '=', next);
        if (typeof animateScore === 'function') {
          animateScore(next, 0.45);
        } else if (typeof setScore === 'function') {
          setScore(next);
          if (updateHUD) updateHUD();
        }
        try { (window as any).updateHighScore?.(next); } catch {}
        
        // Update high score with FINAL score (including bonuses) in board-stats-service
        try {
          boardStatsService.updateBoardHighScore(boardNumber, finalScore);
          console.log(`✅ clean-board-modal: Updated high score for board ${boardNumber}: ${finalScore} on Continue`);
        } catch (error) {
          console.warn(`⚠️ clean-board-modal: Failed to update high score on Continue:`, error);
        }
        
        // Also update global high score
        try {
          statsService.updateHighScore(finalScore);
          console.log(`✅ clean-board-modal: Updated global high score: ${finalScore} on Continue`);
        } catch (error) {
          console.warn(`⚠️ clean-board-modal: Failed to update global high score on Continue:`, error);
        }
        
        // SIMPLE: Clear completed board state (user clicked Continue, normal flow)
        localStorage.removeItem('cc_board_completed');
        
        // 🔥 USER REQUEST FIX: Clear board-specific saved state when continuing to next board
        // This ensures "Play" button shows instead of "Continue" when returning to completed board
        // Without this, user sees "Continue" + ghost placeholders on completed boards
        try {
          const { clearBoardSaveState } = await import('../utils/board-save-utils.js');
          clearBoardSaveState(boardNumber);
          console.log(`✅ clean-board-modal: Cleared board-specific saved state for board ${boardNumber} on Continue`);
        } catch (clearError) {
          console.warn(`⚠️ clean-board-modal: Failed to clear board saved state:`, clearError);
        }
      } catch {}
      
      
      // 🎯 CRITICAL: Set flag to prevent saveGameState() from re-saving after clean board
      // Clean board = completed board, we already cleared save state, don't re-save it!
      (window as any).__ccBoardJustCompleted = true;
      console.log('🎯 clean-board-modal: Set __ccBoardJustCompleted flag to prevent re-saving after clean board (Continue)');
      
      // 🔥 MEMORY LEAK FIX: Final cleanup before resolving (animations already stopped at button click)
      cleanupButtonListeners(); // Remove all button event listeners
      
      trackTimeout(() => { 
        try { el.remove(); } catch {}
        removeStyleTag(); // Remove CSS style tag
        
        // 🔥 GRACEFUL CLEANUP: Stop new confetti spawns but let existing animations finish
        // This allows confetti to continue animating after primary button is clicked
        try {
          import('./confetti-system.js').then(confettiModule => {
            if (confettiModule && typeof confettiModule.stopConfettiSpawns === 'function') {
              confettiModule.stopConfettiSpawns();
            }
          }).catch(() => {
            // Ignore import errors
          });
        } catch (e) {
          // Ignore errors
        }
        
        // 🔥 NEW: Return action based on which button was clicked
        const action = isFromInterimBoard ? 'continue' : 'play-again';
        console.log(`✅ clean-board-modal: Resolving with action: ${action}`);
        resolve({ action }); 
      }, collapseDuration + 220);
    });
    
    // 🔥 NEW: Exit button handler (only for regular boards, not interim)
    if (secondaryBtn) {
      addButtonPressHandling(secondaryBtn, async () => {
        // Haptic for exit button
        if (typeof (window as any).triggerHapticSelection === 'function') {
          (window as any).triggerHapticSelection();
        }
        
        primaryBtn.disabled = true;
        secondaryBtn.disabled = true;
        
        // 🔥 Mark overlay as exiting to neutralize :active styles
        el.setAttribute('data-clean-board-exiting', 'true');

        // 🔥 CRITICAL: Stop ALL background animations IMMEDIATELY for smooth exit
        // This prevents choppy exit animation caused by ongoing GSAP tweens and star animations
        killAllGSAPTweens(); // Kill score/combo/efficiency animations
        stopAllStarAnimations(); // Stop star bounce and breathing
        clearAllModalTimeouts(); // Clear all pending timeouts
        clearAllModalAnimationFrames(); // Clear all animation frames
        
        // Same exit animation as primary button
        // CRITICAL: Reset boardCleared before exit animation - NO transforms at all
        boardCleared.style.transition = 'none';
        boardCleared.style.animation = 'none';
        boardCleared.style.transform = 'none';
        boardCleared.style.webkitTransform = 'none';
        
        // Also reset parent container
        statusSlot.style.transform = 'none';
        statusSlot.style.webkitTransform = 'none';
        
        // 🎯 Also reset bonus wrappers in case they're visible
        comboWrapper.style.transition = 'none';
        comboWrapper.style.transform = 'scale(1) translateY(0)';
        efficiencyWrapper.style.transition = 'none';
        efficiencyWrapper.style.transform = 'scale(1) translateY(0)';
        
        // Force reflow to apply reset
        void boardCleared.offsetHeight;
        void statusSlot.offsetHeight;
        
        // Buttons are outside the card, so card scale won't move them
        
        const exitTrans = 'opacity 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        const exitOffsets = [-22, -18, -14, -10, -6, -4, -2];
        const exitScale = [0, 0.08, -0.04, 0.05, -0.02, 0.03, -0.01];
        // 🎯 Regular elements (NOT buttons - they use CSS class animate-exit like homepage slider)
        const nodes = [hero, title, scoreLabel, mainScore, statusSlot, boardCleared];
        nodes.forEach((node) => { node.style.transition = exitTrans; });
 
        // 🎯 BUTTONS: Animate INDIVIDUALLY (not as container)
        // 🔥 USER REQUEST: Animate clicked button FIRST, then other button with 300ms delay
        // Exit button was clicked - animate it FIRST
        animateButtonExit(secondaryBtn);
        
        // Play Again button animates AFTER Exit starts (500ms faster than before)
        setTimeout(() => {
          animateButtonExit(primaryBtn);
        }, 200); // 🔥 USER REQUEST: 500ms faster (was 700ms, now 200ms)

        requestAnimationFrame(() => {
          nodes.forEach((node, idx) => {
            const delay = idx * 60;
            setTimeout(() => {
              const extra = exitScale[idx] || 0;
              node.style.opacity = '0';
              node.style.transform = `scale(${0.0 + extra}) translateY(${exitOffsets[idx]}px)`;
            }, delay);
          });
        });
        // 🔥 FIX: Delay card scale animation until AFTER buttons start animating
        // This prevents buttons from moving up with card scale
        setTimeout(() => {
          card.style.transition = 'transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          requestAnimationFrame(() => {
            card.style.transform = 'scale(0.86)';
          });
        }, 400); // Delay card scale until buttons are mid-animation
        // 🎯 Calculate duration: buttons need FULL 400ms to animate to scale(0) (FASTER exit)
        // Give EXTRA time to ensure button animation completes BEFORE card fadeout
        const buttonExitDuration = buttonExitDurationMs;
        const extraBuffer = 200;
        const buttonDelay = 200; // 🔥 USER REQUEST: 500ms faster (was 700ms, now 200ms)
        const collapseDuration = secondaryBtn 
          ? nodes.length * 60 + buttonDelay + buttonExitDuration + extraBuffer  // With Exit button: 360 + 200 + 650 + 200 = 1410ms
          : nodes.length * 60 + buttonExitDuration + extraBuffer;               // Without Exit button: 360 + 650 + 200 = 1210ms
        setTimeout(() => {
          card.style.transition = 'transform 0.30s ease, opacity 0.30s ease';
          card.style.opacity = '0';
          el.style.transition = 'opacity 0.30s ease';
          el.style.opacity = '0';
        }, collapseDuration);
        
        // 🔥 EXIT FIX: Clear board save state to show "Play" instead of "Continue" on next entry
        // Also update high score in board-stats-service
        console.log('🚪 clean-board-modal: Exit button clicked - clearing save state and updating high score');
        
        try {
          // Clear board-specific saved state (so "Play" shows instead of "Continue")
          const { clearBoardSaveState, hasSavedStateForBoard, getBoardSaveKey } = await import('../utils/board-save-utils.js');
          
          // 🔍 DEBUG: Check state BEFORE clearing
          const hadSaveBefore = hasSavedStateForBoard(boardNumber);
          const saveKey = getBoardSaveKey(boardNumber);
          console.log(`🔍 clean-board-modal Exit: Board ${boardNumber} saved state BEFORE clear:`, hadSaveBefore, `(key: ${saveKey})`);
          
          // Clear board save state
          clearBoardSaveState(boardNumber);
          console.log(`✅ clean-board-modal: Cleared board-specific saved state for board ${boardNumber} on Exit`);
          
          // 🔍 DEBUG: Verify state AFTER clearing
          const hasSaveAfter = hasSavedStateForBoard(boardNumber);
          console.log(`🔍 clean-board-modal Exit: Board ${boardNumber} saved state AFTER clear:`, hasSaveAfter);
          
          if (hasSaveAfter) {
            console.error(`❌ CRITICAL: Board ${boardNumber} STILL has saved state after clearing! Key: ${saveKey}`);
          } else {
            console.log(`✅ VERIFIED: Board ${boardNumber} save state successfully cleared`);
          }
        } catch (clearError) {
          console.warn(`⚠️ clean-board-modal: Failed to clear board saved state on Exit:`, clearError);
        }
        
        // Update high score with FINAL score (including bonuses)
        try {
          boardStatsService.updateBoardHighScore(boardNumber, finalScore);
          console.log(`✅ clean-board-modal: Updated high score for board ${boardNumber}: ${finalScore}`);
        } catch (error) {
          console.warn(`⚠️ clean-board-modal: Failed to update high score on Exit:`, error);
        }
        
        // Also update global high score
        try {
          statsService.updateHighScore(finalScore);
          console.log(`✅ clean-board-modal: Updated global high score: ${finalScore}`);
        } catch (error) {
          console.warn(`⚠️ clean-board-modal: Failed to update global high score on Exit:`, error);
        }
        
        // 🔥 MEMORY LEAK FIX: Final cleanup before resolving (animations already stopped at button click)
        cleanupButtonListeners(); // Remove all button event listeners
        
        // 🎯 CRITICAL: Set flag to prevent saveGameState() from re-saving after clean board
        // Clean board = completed board, we already cleared save state, don't re-save it!
        (window as any).__ccBoardJustCompleted = true;
        console.log('🎯 clean-board-modal: Set __ccBoardJustCompleted flag to prevent re-saving after clean board');
        
        // 🎯 SEAMLESS EXIT: Resolve immediately after exit animation starts (don't wait for it to finish)
        // This allows detail modal enter animation to start while clean board is still exiting
        // Clean board modal will continue exit animation in background and remove itself when done
        trackTimeout(() => { 
          console.log(`✅ clean-board-modal: Resolving with action: exit (seamless - exit animation continues in background)`);
          resolve({ action: 'exit' }); 
        }, 150); // 🎯 Resolve after 150ms (exit animation starts, detail modal can begin enter animation)
        
        // 🧹 CLEANUP: Remove modal after full exit animation completes (in background)
        trackTimeout(() => { 
          try { el.remove(); } catch {}
          removeStyleTag(); // Remove CSS style tag
          
          // Stop confetti spawns
          try {
            import('./confetti-system.js').then(confettiModule => {
              if (confettiModule && typeof confettiModule.stopConfettiSpawns === 'function') {
                confettiModule.stopConfettiSpawns();
              }
            }).catch(() => {});
          } catch (e) {}
          
          console.log(`🧹 clean-board-modal: Cleanup complete after exit animation finished`);
        }, collapseDuration + 110); // Clean up after full exit animation
      });
    }
  });
}
