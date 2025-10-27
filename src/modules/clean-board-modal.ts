// public/src/modules/clean-board-modal.ts
// DOM-based overlay (design-first), Board cleared + bonus + Continue

// Keep CSS-based pop-in like homepage slide 1

const HEADLINES = [
  'Outstanding!', 'Amazing!', 'Excellent!', 'Fantastic!', 'Incredible!',
  'Perfect!', 'Brilliant!', 'Superb!', 'Awesome!', 'Spectacular!',
  'Magnificent!', 'Phenomenal!', 'Marvelous!', 'Exceptional!', 'Stellar!',
  'Remarkable!', 'Impressive!', 'Unbelievable!', 'Wonderful!', 'Fabulous!',
  'Sensational!', 'Terrific!', 'Splendid!', 'Exquisite!', 'Divine!',
  'Glorious!', 'Masterful!', 'Flawless!', 'Supreme!', 'Epic!'
];

interface ShowCleanBoardModalParams {
  app?: any;
  stage?: any;
  getScore?: () => number;
  setScore?: (score: number) => void;
  animateScore?: (score: number, duration?: number) => void;
  updateHUD?: () => void;
  bonus?: number;
  scoreCap?: number;
  boardNumber?: number;
}

const pickRandom = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];

// Confetti explosion effect from center of element
function createConfettiExplosion(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const colors = ['#E97A55', '#B07F69', '#E77449', '#F5A623', '#FF6B6B', '#4ECDC4', '#95E1D3'];
  const confettiCount = 30;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const angle = (Math.PI * 2 * i) / confettiCount;
    const velocity = 200 + Math.random() * 300;
    
    confetti.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: 8px;
      height: 8px;
      background: ${color};
      border-radius: 2px;
      pointer-events: none;
      z-index: 9999999999999;
      transform: rotate(${Math.random() * 360}deg);
    `;
    
    document.body.appendChild(confetti);
    
    const duration = 800 + Math.random() * 400;
    confetti.animate([
      { 
        transform: `translate(0, 0) rotate(${Math.random() * 360}deg)`,
        opacity: 1
      },
      {
        transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 300}px) rotate(${Math.random() * 720}deg)`,
        opacity: 0
      }
    ], {
      duration: duration,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    }).onfinish = () => confetti.remove();
  }
 realization

export async function showCleanBoardModal({ 
  app, 
  stage, 
  getScore, 
  setScore, 
  animateScore, 
  updateHUD, 
  bonus = 500, 
  scoreCap = 999999, 
  boardNumber = 1 
}: ShowCleanBoardModalParams = {}): Promise<{ action: string }> {
  return new Promise(async resolve => {
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
      'background:#f5f5f5',
      'z-index:10000000000000',
      'opacity:0',
      'transition:opacity .2s ease'
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
      'gap:40px'
    ].join(';');

    // Hero
    const hero = document.createElement('img');
    hero.alt = 'Board cleared';
    hero.src = './assets/clean-board.png';
    hero.style.cssText = 'width:min(240px,70vw);height:auto;display:block;margin:0 auto 0 auto;transform:scale(1);';

    // Add error handling for image
    hero.onerror = () => {
      // Fallback to a simple div
      hero.style.cssText = 'width:min(260px,46vw);height:min(260px,46vw);background:#4CAF50;border-radius:20px;display:block;margin:0 auto 24px auto;transform:scale(0.92);';
    };

    // Content stacks replicate design spacing (hero + text)
    const infoStack = document.createElement('div');
    infoStack.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:32px',
      'width:100%'
    ].join(';');

    const textCluster = document.createElement('div');
    textCluster.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:8px',
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

    // "Your score" label
    const scoreLabel = document.createElement('div');
    scoreLabel.textContent = 'Your score';
    scoreLabel.style.cssText = 'color:#b69077;font-weight:600;font-size:20px;line-height:1.2;margin:0;letter-spacing:0.02em;';

    // Main score display (casino-style spinning)
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

    const bonusWrapper = document.createElement('div');
    bonusWrapper.style.cssText = [
      'position:absolute',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:6px',
      'opacity:0',
      'transform:scale(0.75) translateY(-8px)',
      'width:100%'
    ].join(';');

    const bonusValue = document.createElement('div');
    bonusValue.textContent = `+${bonus}`;
    bonusValue.style.cssText = 'color:#E77449;font-weight:800;font-size:36px;line-height:1;';

    const bonusLabel = document.createElement('div');
    bonusLabel.textContent = 'Bonus score';
    bonusLabel.style.cssText = 'color:#c48a6d;font-weight:600;font-size:18px;line-height:1;letter-spacing:0.02em;';

    bonusWrapper.appendChild(bonusValue);
    bonusWrapper.appendChild(bonusLabel);

    // Board cleared text (initially hidden)
    const boardCleared = document.createElement('div');
    boardCleared.textContent = `Board #${boardNumber} cleared`;
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

    // CTA (initially hidden)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Continue';
    btn.className = 'continue-btn bottom-sheet-cta';
    // Responsive width logic
    const isMobile = window.innerWidth <= 428;
    const isIPad = window.innerWidth >= 768 && window.innerWidth <= 1024;
    const buttonWidth = (isMobile || isIPad) ? '249px' : '310px';
    
    btn.style.width = '100%';
    btn.style.maxWidth = buttonWidth;
    btn.style.opacity = '0';
    btn.style.transform = 'scale(0.8)';
    btn.style.marginTop = '0';
    // Mobile optimizations
    btn.style.webkitTapHighlightColor = 'transparent';
    btn.style.webkitTouchCallout = 'none';
    btn.style.webkitUserSelect = 'none';
    btn.style.userSelect = 'none';

    infoStack.appendChild(hero);
    textCluster.appendChild(title);
    textCluster.appendChild(scoreLabel);
    scoreGroup.appendChild(mainScore);
    scoreGroup.appendChild(statusSlot);
    textCluster.appendChild(scoreGroup);
    infoStack.appendChild(textCluster);
    card.appendChild(infoStack);
    statusSlot.appendChild(bonusWrapper);
    statusSlot.appendChild(boardCleared);
    card.appendChild(btn);
    el.appendChild(card);
    document.body.appendChild(el);

    // Score bookkeeping
    const rawCurrent = typeof getScore === 'function' ? (getScore()|0) : 0;
    const safeBonus = Math.max(0, bonus | 0);
    const currentScore = Math.max(0, rawCurrent);
    const finalScore = Math.min(scoreCap, currentScore + safeBonus);

    const formatScore = (value: number): string => {
      const safe = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
      return safe.toString();
    };

    mainScore.textContent = formatScore(currentScore);
    bonusValue.textContent = `+${formatScore(safeBonus)}`;

    // Prepare initial pop-in states
    const setInit = (element: HTMLElement, dy: number, scale = 0): void => {
      element.style.opacity = '0';
      element.style.transform = `scale(${scale}) translateY(${dy}px)`;
      element.style.transition = 'none';
    };
    setInit(hero, -25);
    setInit(title, -20);
    setInit(scoreLabel, -15);
    setInit(mainScore, -10);
    setInit(bonusWrapper, -6, 0.65);
    // CRITICAL: No initial scale for boardCleared - just opacity
    boardCleared.style.opacity = '0';
    boardCleared.style.transition = 'none';
    setInit(btn, 12, 0.7);

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

      const digits = Math.max(formatScore(finalScore).length, formatScore(currentScore).length);
      const toScoreText = (value: number) => formatScore(value);

      const runCasinoIntro = (): void => {
        const duration = 1100;
        const wobbleBase = Math.pow(10, Math.max(digits - 2, 0));
        const t0 = performance.now();

        const tick = (now: number) => {
          const elapsed = now - t0;
          const p = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          const wobbleStrength = (1 - ease) * 0.75;
          const wobble = Math.floor((Math.random() - 0.5) * wobbleBase * 6 * wobbleStrength);
          const value = Math.max(0, currentScore + wobble);
          mainScore.textContent = toScoreText(value);
          if (p < 1) {
            requestAnimationFrame(tick);
          } else {
            mainScore.textContent = toScoreText(currentScore);
          }
        };
        requestAnimationFrame(tick);
      };

      const transferBonus = (): void => {
        const duration = safeBonus > 0 ? 1400 : 800;
        const scoreDiff = finalScore - currentScore;
        const t0 = performance.now();
        mainScore.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        mainScore.style.transform = 'scale(1.08) translateY(0)';
        setTimeout(() => {
          mainScore.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
          mainScore.style.transform = 'scale(1) translateY(0)';
        }, 420);

        const tick = (now: number) => {
          const elapsed = now - t0;
          const p = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          const scoreValue = currentScore + scoreDiff * eased;
          const bonusLeft = Math.max(0, safeBonus - safeBonus * eased);
          mainScore.textContent = toScoreText(scoreValue);
          bonusValue.textContent = `+${formatScore(Math.round(bonusLeft))}`;
          if (p < 1) {
            requestAnimationFrame(tick);
          } else {
            mainScore.textContent = toScoreText(finalScore);
            bonusValue.textContent = '+0';
          }
        };
        requestAnimationFrame(tick);
      };

      // SEQUENCE 1: Initial elements pop-in WITH CONFETTI EXPLOSION
      setTimeout(() => {
        hero.style.opacity = '1';
        hero.style.transform = 'scale(1) translateY(0)';
        
        // CONFETTI EXPLOSION from hero image
        createConfettiExplosion(hero);
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
      }, 420);

      // SEQUENCE 2: Casino wobble to confirm current score
      setTimeout(runCasinoIntro, 650);

      // SEQUENCE 3: Bonus stack pop-in
      setTimeout(() => {
        bonusWrapper.style.transition = 'opacity 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.55s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        bonusWrapper.style.opacity = '1';
        bonusWrapper.style.transform = 'scale(1) translateY(0)';
      }, 1350);

      // SEQUENCE 4: Transfer bonus into score while draining to zero
      setTimeout(() => {
        if (safeBonus <= 0) {
          bonusValue.textContent = '+0';
          mainScore.textContent = toScoreText(finalScore);
          return;
        }
        transferBonus();
      }, 2150);

      // SEQUENCE 5: Swap bonus stack for "Board cleared" label
      setTimeout(() => {
        bonusWrapper.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        bonusWrapper.style.opacity = '0';
        bonusWrapper.style.transform = 'scale(0.8) translateY(-8px)';

        setTimeout(() => {
          bonusWrapper.style.visibility = 'hidden';
          bonusWrapper.style.display = 'none'; // iOS FIX: Completely remove from layout
          // SIMPLE transition - only opacity, NO transforms at all
          boardCleared.style.transition = 'opacity 0.4s ease';
          boardCleared.style.opacity = '1';
        }, 320);
      }, 3250);

      // SEQUENCE 6: Continue button pop-in
      setTimeout(() => {
        btn.style.transition = 'opacity 0.6s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.6s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        btn.style.opacity = '1';
        btn.style.transform = 'scale(1) translateY(0)';
      }, 3840);
    });

    // Add button press handling for proper UX
    const addButtonPressHandling = (button: HTMLButtonElement, action: () => void): void => {
      let touchStarted = false;
      let touchStartedOnButton = false;
      
      const handleTouchStart = (e: TouchEvent) => {
        touchStarted = true;
        touchStartedOnButton = button.contains(e.target as Node);
        if (touchStartedOnButton) {
          button.style.transform = 'scale(0.80)';
          button.style.transition = 'transform 0.35s ease';
        }
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        if (touchStarted && touchStartedOnButton) {
          // Check if touch moved outside button
          const touch = e.touches[0];
          const rect = button.getBoundingClientRect();
          const isOutside = touch.clientX < rect.left || touch.clientX > rect.right || 
                           touch.clientY < rect.top || touch.clientY > rect.bottom;
          
          if (isOutside) {
            // Cancel the touch - reset button
            button.style.transform = 'scale(1)';
            button.style.transition = 'transform 0.35s ease';
            touchStartedOnButton = false;
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
        
        // Reset button
        button.style.transform = 'scale(1)';
        button.style.transition = 'transform 0.35s ease';
        touchStarted = false;
        touchStartedOnButton = false;
      };
      
      const handleMouseDown = () => {
        touchStartedOnButton = true;
        button.style.transform = 'scale(0.80)';
        button.style.transition = 'transform 0.35s ease';
      };
      
      const handleMouseUp = (e: MouseEvent) => {
        if (touchStartedOnButton && button.contains(e.target as Node)) {
          action();
        }
        
        button.style.transform = 'scale(1)';
        button.style.transition = 'transform 0.35s ease';
        touchStartedOnButton = false;
      };
      
      const handleMouseLeave = () => {
        button.style.transform = 'scale(1)';
        button.style.transition = 'transform 0.35s ease';
        touchStartedOnButton = false;
      };
      
      // Add event listeners
      button.addEventListener('touchstart', handleTouchStart, { passive: true });
      button.addEventListener('touchmove', handleTouchMove, { passive: true });
      button.addEventListener('touchend', handleTouchEnd, { passive: true });
      button.addEventListener('mousedown', handleMouseDown);
      button.addEventListener('mouseup', handleMouseUp);
      button.addEventListener('mouseleave', handleMouseLeave);
    };

    // Continue
    addButtonPressHandling(btn, () => {
      btn.disabled = true;
      
      // CRITICAL: Reset boardCleared before exit animation - NO transforms at all
      boardCleared.style.transition = 'none';
      boardCleared.style.animation = 'none';
      boardCleared.style.transform = 'none';
      boardCleared.style.webkitTransform = 'none';
      
      // Also reset parent container
      statusSlot.style.transform = 'none';
      statusSlot.style.webkitTransform = 'none';
      
      // Also reset bonusWrapper in case it's visible
      bonusWrapper.style.transition = 'none';
      bonusWrapper.style.transform = 'scale(1) translateY(0)';
      
      // Force reflow to apply reset
      void boardCleared.offsetHeight;
      void statusSlot.offsetHeight;
      
      const exitTrans = 'opacity 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      const exitOffsets = [-22, -18, -14, -10, -6, -4, -2];
      const exitScale = [0, 0.08, -0.04, 0.05, -0.02, 0.03, -0.01];
      const nodes = [hero, title, scoreLabel, mainScore, statusSlot, boardCleared, btn];
      nodes.forEach((node) => { node.style.transition = exitTrans; });

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

      // bounce CTA collapse end for extra pop
      setTimeout(() => {
        btn.style.transition = 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)';
        btn.style.transform = 'scale(0.0)';
      }, nodes.length * 60 + 80);
      card.style.transition = 'transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      requestAnimationFrame(() => {
        card.style.transform = 'scale(0.86)';
      });
      const collapseDuration = nodes.length * 60 + 300;
      setTimeout(() => {
        card.style.transition = 'transform 0.30s ease, opacity 0.30s ease';
        card.style.opacity = '0';
        el.style.transition = 'opacity 0.30s ease';
        el.style.opacity = '0';
      }, collapseDuration);
      
      try {
        const cur = typeof getScore === 'function' ? (getScore()|0) : 0;
        const next = Math.min(scoreCap, cur + (bonus|0));
        if (typeof animateScore === 'function') {
          animateScore(next, 0.45);
        } else if (typeof setScore === 'function') {
          setScore(next);
          if (updateHUD) updateHUD();
        }
        try { (window as any).updateHighScore?.(next); } catch {}
      } catch {}
      
      // CRITICAL FIX: Clear saved game state when board is cleared
      // This prevents the user from being able to "continue" after board completion
      try {
        localStorage.removeItem('cc_saved_game');
        localStorage.removeItem('cubeCrash_gameState');
        console.log('✅ clean-board-modal: Cleared both saved game states after board completion');
      } catch (error) {
        console.warn('⚠️ clean-board-modal: Failed to clear saved game state:', error);
      }
      
      setTimeout(() => { 
        try { el.remove(); } catch {} 
        resolve({ action: 'continue' }); 
      }, collapseDuration + 220);
    });
  });
}