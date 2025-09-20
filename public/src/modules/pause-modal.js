import { pauseGame, resumeGame, restart } from './app.js';
import { gsap } from 'gsap';

let overlay = null;


function ensureOverlay(){
  if (overlay) {
    overlay.remove();
    overlay = null;
  }

  const el = document.createElement('div');
  el.id = 'pause-overlay';
  el.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 99999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    backdrop-filter: blur(12px) !important;
  `;
  
  el.innerHTML = `
    <div class="pause-card">
      <div class="pause-actions">
        <button class="pause-modal-btn pause-modal-btn-white" data-action="unpause">Unpause</button>
        <button class="pause-modal-btn pause-modal-btn-white" data-action="restart">Restart</button>
        <button class="pause-modal-btn pause-modal-btn-orange" data-action="exit">Exit to menu</button>
        <button class="pause-modal-btn pause-modal-btn-white" data-action="dev-clean-board">Board cleared (test)</button>
        <button class="pause-modal-btn pause-modal-btn-white" data-action="test-board-cleared">Test Board Cleared +500</button>
      </div>
    </div>`;
  
  document.body.appendChild(el);
  overlay = el;
  return el;
}

export function hidePauseModal(){ 
  console.log('🎭 MODAL CLOSE: hidePauseModal called');
  if (overlay) {
    overlay.classList.remove('show');
    const card = overlay.querySelector('.pause-card');
    if (card) {
      gsap.to(card, {
        scale: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => {
          if (overlay) overlay.remove();
          overlay = null;
          console.log('🎭 MODAL CLOSE: Overlay removed');
        }
      });
    } else {
      overlay.remove();
      overlay = null;
      console.log('🎭 MODAL CLOSE: Overlay removed directly');
    }
  }
}

export function showPauseModal({ onUnpause, onRestart, onExit } = {}){
  console.log('showPauseModal called with params:', { onUnpause, onRestart, onExit });
  
  
  const el = ensureOverlay();
  console.log('Overlay created:', el);
  
  const card = el.querySelector('.pause-card');
  if (card) {
    console.log('Card found:', card);
    
    // FORCE CARD VISIBLE - override the scale(0) from HTML
    card.style.cssText = card.style.cssText.replace('transform: scale(0) !important', 'transform: scale(1) !important');
    card.style.transform = 'scale(1) !important';
    card.style.zIndex = '100000001 !important';
    card.style.display = 'block !important';
    card.style.visibility = 'visible !important';
    card.style.opacity = '1 !important';
    
    // CSS hover effects will work automatically - no JavaScript needed!
    
    console.log('Card should be visible now - transform:', card.style.transform);
  } else {
    console.log('Card not found!');
  }

  const close = () => { 
    console.log('🎭 MODAL CLOSE: close() called');
    
    // Force immediate removal as fallback
    const forceRemove = () => {
      if (el) {
        el.remove();
      }
      overlay = null;
      console.log('🎭 MODAL CLOSE: Modal removed');
    };
    
    // Also call hidePauseModal as backup
    hidePauseModal();
    
    // Check if GSAP is available
    if (typeof gsap === 'undefined') {
      forceRemove();
      return;
    }
    
    // Try GSAP animation first
    try {
      gsap.to(el, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          forceRemove();
        }
      });
      
      // Fallback timeout in case GSAP fails
      setTimeout(() => {
        forceRemove();
      }, 500);
      
    } catch (error) {
      forceRemove();
    }
  };
  
  const onClick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.action || '';
    
    if (act === 'unpause') { 
      console.log('🎭 UNPAUSE: Starting animation...');
      
      if (overlay) {
        const card = overlay.querySelector('.pause-card');
        if (card) {
          console.log('🎭 UNPAUSE: Card found, starting animation...');
          
          // Force initial state
          card.style.transform = 'scale(1)';
          card.style.opacity = '1';
          
          // Start animation immediately
          setTimeout(() => {
            console.log('🎭 UNPAUSE: Animation started - scaling down...');
            card.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            card.style.transform = 'scale(0)';
            card.style.opacity = '0';
          }, 10);
          
          // After animation, resume game
          setTimeout(() => {
            console.log('🎭 UNPAUSE: Animation completed - resuming game...');
            
            try { 
              onUnpause?.(); 
              console.log('🎭 UNPAUSE: Game resumed successfully');
            } catch (error) {
              console.error('🎭 UNPAUSE: Error resuming game:', error);
            }
            
            // Remove overlay
            if (overlay) {
              overlay.remove();
              overlay = null;
              console.log('🎭 UNPAUSE: Overlay removed - unpause complete');
            }
          }, 450);
          
        } else {
          console.log('🎭 UNPAUSE: No card found, using direct unpause...');
          try { 
            await onUnpause?.(); 
            console.log('🎭 UNPAUSE: Game resumed successfully (no card fallback)');
          } catch (error) {
            console.error('🎭 UNPAUSE: Error resuming game (no card fallback):', error);
          }
          if (overlay) {
            overlay.remove();
            overlay = null;
          }
        }
      } else {
        console.log('🎭 UNPAUSE: No overlay found, using direct unpause...');
        try { 
          await onUnpause?.(); 
          console.log('🎭 UNPAUSE: Game resumed successfully (no overlay fallback)');
        } catch (error) {
          console.error('🎭 UNPAUSE: Error resuming game (no overlay fallback):', error);
        }
      }
    }
    if (act === 'dev-clean-board') {
      // Close modal first
      close();
      setTimeout(async () => {
        try {
          const CC = window.CC || {};
          
          if (!CC.app || !CC.stage) {
            console.error('❌ Missing CC.app or CC.stage');
            return;
          }
          
          // Ensure PIXI is running so overlay renders
          try { resumeGame(); } catch {}
          try { CC.hideGameUI?.(); } catch {}
          
          const { showCleanBoardModal } = await import('./clean-board-modal.js');
          
          await showCleanBoardModal({
            app: CC.app,
            stage: CC.stage,
            getScore: () => (CC.getScore ? CC.getScore() : 0),
            animateScore: (v,d)=> CC.animateScoreTo ? CC.animateScoreTo(v,d) : null,
            updateHUD: () => CC.updateHUD ? CC.updateHUD() : null,
            bonus: 500
          });
          
          if (typeof CC.nextLevel === 'function') CC.nextLevel();
        } catch (err) {
          console.error('❌ Board cleared error:', err);
        }
      }, 10);
      return;
    }
    if (act === 'test-board-cleared') {
      // Close modal first
      close();
      setTimeout(async () => {
        try {
          const CC = window.CC || {};
          
          if (!CC.app || !CC.stage) {
            console.error('❌ Missing CC.app or CC.stage');
            return;
          }
          
          // Ensure PIXI is running so overlay renders
          try { resumeGame(); } catch {}
          try { CC.hideGameUI?.(); } catch {}
          
          const { showCleanBoardModal } = await import('./clean-board-modal.js');
          
          await showCleanBoardModal({
            app: CC.app,
            stage: CC.stage,
            getScore: () => (CC.getScore ? CC.getScore() : 0),
            setScore: (v) => { if (CC.setScore) CC.setScore(v); },
            animateScore: (v,d)=> CC.animateScoreTo ? CC.animateScoreTo(v,d) : null,
            updateHUD: () => CC.updateHUD ? CC.updateHUD() : null,
            bonus: 500
          });
          
          if (typeof CC.nextLevel === 'function') CC.nextLevel();
        } catch (err) {
          console.error('❌ Test board cleared error:', err);
        }
      }, 10);
      return;
    }
    if (act === 'restart') { 
      console.log('🎭 RESTART: Starting animation...');
      
      if (overlay) {
        const card = overlay.querySelector('.pause-card');
        if (card) {
          console.log('🎭 RESTART: Card found, starting animation...');
          
          // Force initial state
          card.style.transform = 'scale(1)';
          card.style.opacity = '1';
          
          // Start animation immediately
          setTimeout(() => {
            console.log('🎭 RESTART: Animation started - scaling down...');
            card.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            card.style.transform = 'scale(0)';
            card.style.opacity = '0';
          }, 10);
          
          // After animation, restart game
          setTimeout(() => {
            console.log('🎭 RESTART: Animation completed - restarting game...');
            
            try { 
              onRestart?.(); 
              console.log('🎭 RESTART: Game restarted successfully');
            } catch (error) {
              console.error('🎭 RESTART: Error restarting game:', error);
            }
            
            // Remove overlay
            if (overlay) {
              overlay.remove();
              overlay = null;
              console.log('🎭 RESTART: Overlay removed - restart complete');
            }
          }, 450);
          
        } else {
          console.log('🎭 RESTART: No card found, using direct restart...');
          try { 
            await onRestart?.(); 
            console.log('🎭 RESTART: Game restarted successfully (no card fallback)');
          } catch (error) {
            console.error('🎭 RESTART: Error restarting game (no card fallback):', error);
          }
          if (overlay) {
            overlay.remove();
            overlay = null;
          }
        }
      } else {
        console.log('🎭 RESTART: No overlay found, using direct restart...');
        try { 
          await onRestart?.(); 
          console.log('🎭 RESTART: Game restarted successfully (no overlay fallback)');
        } catch (error) {
          console.error('🎭 RESTART: Error restarting game (no overlay fallback):', error);
        }
      }
    }
    if (act === 'exit') {
      console.log('🎭 EXIT: Starting animation...');
      
      if (overlay) {
        const card = overlay.querySelector('.pause-card');
        if (card) {
          console.log('🎭 EXIT: Card found, starting animation...');
          
          // Force initial state
          card.style.transform = 'scale(1)';
          card.style.opacity = '1';
          
          // Start animation immediately
          setTimeout(() => {
            console.log('🎭 EXIT: Animation started - scaling down...');
            card.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            card.style.transform = 'scale(0)';
            card.style.opacity = '0';
          }, 10);
          
          // After animation, execute exit logic
          setTimeout(() => {
            console.log('🎭 EXIT: Animation completed - executing exit logic...');
            
            try {
              onExit?.();
              console.log('🎭 EXIT: onExit completed - homepage should be visible');
            } catch (error) {
              console.error('🎭 EXIT: onExit error:', error);
            }
            
            // Remove overlay
            if (overlay) {
              overlay.remove();
              overlay = null;
              console.log('🎭 EXIT: Overlay removed - exit complete');
            }
          }, 450);
          
        } else {
          console.log('🎭 EXIT: No card found, using direct exit...');
          try {
            onExit?.();
            console.log('🎭 EXIT: onExit completed (no card fallback)');
          } catch (error) {
            console.error('🎭 EXIT: onExit error (no card fallback):', error);
          }
          if (overlay) {
            overlay.remove();
            overlay = null;
          }
        }
      } else {
        console.log('🎭 EXIT: No overlay found, using direct exit...');
        try {
          onExit?.();
          console.log('🎭 EXIT: onExit completed (no overlay fallback)');
        } catch (error) {
          console.error('🎭 EXIT: onExit error (no overlay fallback):', error);
        }
      }
    }
  };

  const onBackdrop = (e) => { 
    if (e.target.classList.contains('pause-backdrop')) { 
      console.log('🎭 MODAL CLOSE: Backdrop clicked - resuming game...');
      try { 
        onUnpause?.(); 
        console.log('🎭 MODAL CLOSE: Game resumed via backdrop');
      } catch (error) {
        console.error('🎭 MODAL CLOSE: Error resuming game via backdrop:', error);
      }
      close(); 
    } 
  };

  el.addEventListener('click', onClick);
  el.addEventListener('click', onBackdrop);
  console.log('🎭 Event listeners added to modal element');
}
