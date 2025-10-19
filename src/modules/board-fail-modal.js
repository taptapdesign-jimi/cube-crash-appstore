// public/src/modules/board-fail-modal.js
// Game-over overlay when the board isn't fully cleared

const HEADLINES = [
  'Oops!', 'Bummer!', 'Ahh Noo!', 'Almost!', 'So Close!', 'Whoops!', 'Uh Oh!',
  'Missed It!', 'Darn!', 'Not Quite!', 'Retry Time!', 'Oh Snap!', 'Melted down!',
  'Ouch!', 'Fail!', 'Next Try!', 'Argh!', 'No Luck!', 'Oof!', 'Nearly!',
  'Shoot!', 'Try Again!', 'Whoa There!', 'Not Today!', 'Gah!', 'So Near!',
  'Drat!', 'Aw Man!', 'Dang!', 'One More!', 'That Hurt!'
];

const OVERLAY_ID = 'cc-board-fail-overlay';

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)] || list[0];
}

function removeExisting() {
  try {
    const prev = document.getElementById(OVERLAY_ID);
    prev?.remove?.();
  } catch {}
}

export function showBoardFailModal({ score = 0, boardNumber = 1 } = {}) {
  return new Promise(resolve => {
    // CRITICAL FIX: Clear saved game state immediately when fail screen is shown
    // This prevents the user from being able to "continue" a failed game
    try {
      // Set flag to prevent future saves
      window._gameHasEnded = true;
      
      localStorage.removeItem('cc_saved_game');
      localStorage.removeItem('cubeCrash_gameState');
      console.log('✅ board-fail-modal: Cleared both saved game states and set gameHasEnded flag');
    } catch (error) {
      console.warn('⚠️ board-fail-modal: Failed to clear saved game state:', error);
    }
    
    removeExisting();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'padding:48px 24px',
      'background:#f5f5f5',
      'z-index:10000000000000',
      'opacity:0',
      'transition:opacity 0.25s ease'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'background:transparent',
      'border-radius:40px',
      'padding:40px 32px',
      'text-align:center',
      'font-family:"LTCrow", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      'transform:scale(0.9)',
      'transition:transform .34s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease',
      'opacity:0',
      'max-width:min(340px,88vw)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:40px'
    ].join(';');

    const infoStack = document.createElement('div');
    infoStack.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:32px;width:100%;';

    const hero = document.createElement('img');
    hero.src = './assets/melted-dice.png';
    hero.alt = 'Melted dice';
    hero.style.cssText = 'width:min(240px,70vw);height:auto;display:block;margin:0 auto;';
    hero.onerror = () => {
      hero.style.cssText = 'width:min(220px,60vw);height:min(220px,60vw);border-radius:28px;background:rgba(215,122,83,0.3);display:block;margin:0 auto;';
    };

    const textCluster = document.createElement('div');
    textCluster.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;';

    const title = document.createElement('div');
    title.textContent = pickRandom(HEADLINES);
    title.style.cssText = 'color:#D78157;font-weight:800;font-size:40px;line-height:1;margin:0;';

    const scoreLabel = document.createElement('div');
    scoreLabel.textContent = 'Your score';
    scoreLabel.style.cssText = 'color:#b69077;font-weight:600;font-size:20px;line-height:1.2;margin:0;letter-spacing:0.02em;';

    const scoreValue = document.createElement('div');
    scoreValue.textContent = Math.max(0, Math.floor(score || 0)).toString();
    scoreValue.style.cssText = 'color:#E77449;font-weight:800;font-size:64px;line-height:1;margin:0;';

    const boardStatus = document.createElement('div');
    boardStatus.textContent = `Board #${Math.max(1, boardNumber | 0)} not cleared`;
    boardStatus.style.cssText = 'color:#b69077;font-weight:600;font-size:20px;line-height:1.2;margin:0;letter-spacing:0.02em;';

    textCluster.appendChild(title);
    textCluster.appendChild(scoreLabel);
    textCluster.appendChild(scoreValue);
    textCluster.appendChild(boardStatus);

    infoStack.appendChild(hero);
    infoStack.appendChild(textCluster);

    // Responsive width logic
    const isMobile = window.innerWidth <= 428;
    const isIPad = window.innerWidth >= 768 && window.innerWidth <= 1024;
    const buttonWidth = (isMobile || isIPad) ? '249px' : '310px';
    const containerWidth = (isMobile || isIPad) ? '249px' : '310px';

    const buttons = document.createElement('div');
    buttons.style.cssText = `width:${containerWidth};max-width:80vw;display:flex;flex-direction:column;gap:16px;`;

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.textContent = 'Play Again';
    continueBtn.className = 'restart-btn bottom-sheet-cta';
    continueBtn.style.width = '100%';
    continueBtn.style.maxWidth = buttonWidth;
    continueBtn.style.whiteSpace = 'nowrap';

    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.textContent = 'Exit';
    exitBtn.className = 'exit-btn bottom-sheet-cta';
    exitBtn.style.width = '100%';
    exitBtn.style.maxWidth = buttonWidth;
    exitBtn.style.whiteSpace = 'nowrap';

    buttons.appendChild(continueBtn);
    buttons.appendChild(exitBtn);

    card.appendChild(infoStack);
    card.appendChild(buttons);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const resolveAndCleanup = (action) => {
      try { window.removeEventListener('keydown', onKey); } catch {}
      
      // CRITICAL FIX: Update high score before resolving
      if (typeof window.updateHighScore === 'function') {
        try {
          window.updateHighScore(score);
          console.log('✅ board-fail-modal: window.updateHighScore called with score:', score);
        } catch (error) {
          console.warn('⚠️ board-fail-modal: Failed to call window.updateHighScore:', error);
        }
      }
      
      // DIRECT FUNCTION CALLS like bottom sheet
      if (action === 'retry') {
        console.log('🎮 Play Again clicked - calling window.CC.restart directly');
        if (window.CC && window.CC.restart) {
          try {
            window.CC.restart();
            console.log('✅ window.CC.restart called from board-fail-modal');
          } catch (error) {
            console.warn('⚠️ window.CC.restart failed:', error);
          }
        }
      } else if (action === 'menu') {
        console.log('🚪 Exit clicked - calling window.exitToMenu directly');
        if (window.exitToMenu) {
          try {
            window.exitToMenu();
            console.log('✅ window.exitToMenu called from board-fail-modal');
          } catch (error) {
            console.warn('⚠️ window.exitToMenu failed:', error);
          }
        }
      }
      
      overlay.style.opacity = '0';
      card.style.transform = 'scale(0.88)';
      card.style.opacity = '0';
      setTimeout(() => { try { overlay.remove(); } catch {}; resolve({ action }); }, 220);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resolveAndCleanup('menu');
      }
    };
    window.addEventListener('keydown', onKey);

    // Add button press handling for proper UX with "cancel on drag off" logic
    const addButtonPressHandling = (btn, action) => {
      let touchStarted = false;
      let touchStartedOnButton = false;
      
      const handleTouchStart = (e) => {
        touchStarted = true;
        touchStartedOnButton = btn.contains(e.target);
        if (touchStartedOnButton) {
          btn.style.transform = 'scale(0.80)';
          btn.style.transition = 'transform 0.35s ease';
        }
      };
      
      const handleTouchMove = (e) => {
        if (touchStarted && touchStartedOnButton) {
          // Check if touch moved outside button
          const touch = e.touches[0];
          const rect = btn.getBoundingClientRect();
          const isOutside = touch.clientX < rect.left || touch.clientX > rect.right || 
                           touch.clientY < rect.top || touch.clientY > rect.bottom;
          
          if (isOutside) {
            // Cancel the touch - reset button
            btn.style.transform = 'scale(1)';
            btn.style.transition = 'transform 0.35s ease';
            touchStartedOnButton = false;
          }
        }
      };
      
      const handleTouchEnd = (e) => {
        if (touchStarted && touchStartedOnButton) {
          // Only trigger if touch ended on button
          const touch = e.changedTouches[0];
          const rect = btn.getBoundingClientRect();
          const isOnButton = touch.clientX >= rect.left && touch.clientX <= rect.right && 
                            touch.clientY >= rect.top && touch.clientY <= rect.bottom;
          
          if (isOnButton) {
            action();
          }
        }
        
        // Reset button
        btn.style.transform = 'scale(1)';
        btn.style.transition = 'transform 0.35s ease';
        touchStarted = false;
        touchStartedOnButton = false;
      };
      
      const handleMouseDown = (e) => {
        if (btn.contains(e.target)) {
          btn.style.transform = 'scale(0.80)';
          btn.style.transition = 'transform 0.35s ease';
        }
      };
      
      const handleMouseUp = (e) => {
        if (btn.contains(e.target)) {
          btn.style.transform = 'scale(1)';
          btn.style.transition = 'transform 0.35s ease';
        }
      };
      
      const handleMouseLeave = () => {
        btn.style.transform = 'scale(1)';
        btn.style.transition = 'transform 0.35s ease';
      };
      
      // Add event listeners
      btn.addEventListener('touchstart', handleTouchStart, { passive: true });
      btn.addEventListener('touchmove', handleTouchMove, { passive: true });
      btn.addEventListener('touchend', handleTouchEnd, { passive: true });
      btn.addEventListener('mousedown', handleMouseDown);
      btn.addEventListener('mouseup', handleMouseUp);
      btn.addEventListener('mouseleave', handleMouseLeave);
    };

    addButtonPressHandling(continueBtn, () => resolveAndCleanup('retry'));
    addButtonPressHandling(exitBtn, () => resolveAndCleanup('menu'));

    const animatedNodes = [];
    const prep = (el, dy = 0, scale = 0.72) => {
      el.style.opacity = '0';
      el.style.transform = `translateY(${dy}px) scale(${scale})`;
      el.style.transition = 'none';
      animatedNodes.push(el);
    };

    prep(hero, -25, 0.7);
    prep(title, -20, 0.75);
    prep(scoreLabel, -16, 0.8);
    prep(scoreValue, -12, 0.85);
    prep(boardStatus, -8, 0.82);
    prep(continueBtn, 16, 0.7);
    prep(exitBtn, 20, 0.7);

    overlay.style.opacity = '1';
    card.style.opacity = '1';
    card.style.transform = 'scale(1)';

    requestAnimationFrame(() => {
      const trans = 'opacity 0.55s cubic-bezier(0.68, -0.6, 0.32, 1.4), transform 0.55s cubic-bezier(0.68, -0.6, 0.32, 1.4)';
      [hero, title, scoreLabel, scoreValue, boardStatus, continueBtn, exitBtn].forEach(el => {
        el.style.transition = trans;
      });

      const schedule = (el, delay) => {
        setTimeout(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0) scale(1)';
        }, delay);
      };

      schedule(hero, 120);
      schedule(title, 240);
      schedule(scoreLabel, 360);
      schedule(scoreValue, 480);
      schedule(boardStatus, 620);
      schedule(continueBtn, 840);
      schedule(exitBtn, 1020);

      const finalScore = Math.max(0, Math.floor(score || 0));
      const runScoreSpin = () => {
        const duration = 1100;
        const digits = Math.max(3, finalScore.toString().length);
        const wobbleBase = Math.pow(10, Math.max(digits - 2, 0));
        const start = performance.now();

        const tick = (now) => {
          const elapsed = now - start;
          const p = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          const wobble = Math.floor((Math.random() - 0.5) * wobbleBase * 6 * (1 - ease) * 0.8);
          const value = Math.max(0, finalScore + wobble);
          scoreValue.textContent = value.toString();
          if (p < 1) {
            requestAnimationFrame(tick);
          } else {
            scoreValue.textContent = finalScore.toString();
          }
        };

        requestAnimationFrame(tick);
      };

      setTimeout(runScoreSpin, 700);
    });
  });
}
