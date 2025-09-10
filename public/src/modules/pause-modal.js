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
    background: rgba(0,0,0,0.8) !important;
    backdrop-filter: blur(12px) !important;
  `;
  
  el.innerHTML = `
    <div class="pause-card">
      <div class="pause-actions">
        <button class="pause-modal-btn pause-modal-btn-white" data-action="unpause">Unpause</button>
        <button class="pause-modal-btn pause-modal-btn-white" data-action="restart">Restart</button>
        <button class="pause-modal-btn pause-modal-btn-orange" data-action="exit">Exit to menu</button>
      </div>
    </div>`;
  
  document.body.appendChild(el);
  overlay = el;
  console.log('Modal added to DOM, checking visibility...');
  console.log('Modal element:', el);
  console.log('Modal computed style:', window.getComputedStyle(el));
  console.log('Modal parent:', el.parentNode);
  return el;
}

export function hidePauseModal(){ 
  if (overlay) {
    overlay.classList.remove('show');
    // Exit animation
    const card = overlay.querySelector('.pause-card');
    if (card) {
      gsap.to(card, {
        scale: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => {
          if (overlay) overlay.remove();
          overlay = null;
        }
      });
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
    gsap.to(el, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        if (el) el.remove();
        overlay = null;
      }
    });
  };
  
  const onClick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.action || '';
    if (act === 'unpause') { try { await onUnpause?.(); } catch {} close(); }
    if (act === 'restart') { try { await onRestart?.(); } catch {} close(); }
    if (act === 'exit') {
      try {
        await onExit?.();
      } catch {}
      close();
    }
  };

  const onBackdrop = (e) => { 
    if (e.target.classList.contains('pause-backdrop')) { 
      try { onUnpause?.(); } catch {} 
      close(); 
    } 
  };

  el.addEventListener('click', onClick);
  el.addEventListener('click', onBackdrop);
}
