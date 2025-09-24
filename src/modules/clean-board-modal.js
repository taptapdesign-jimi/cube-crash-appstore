// public/src/modules/clean-board-modal.js
// DOM-based overlay (design-first), Board cleared + bonus + Continue

// Keep CSS-based pop-in like homepage slide 1

const HEADLINES = [
  'Clean Board!','Full Sweep!','Mega Boom!','Max Bonus!','Big Bang!','Blast Off!','Ultra Win!','Score Blast!','Boom Bonus!','Grand Slam!','Bye Blocks!','All Gone!','Dust Off!','Kaboom!','Whoosh!','Big Poof!','Zap Zap!','Wiped Out!','Squeaky Clean!','Hero Clear!','Star Power!','Epic Sweep!','Total Win!','Full Strike!','Pure Magic!','Max Combo!','Level Wipe!','Super Glory!','Victory!','Big Boom!','Next Level!','Star Clear!','Super Wipe!','Clean Shot!','Wild Win!','Top Play!','Epic Win!','You Rock!','Mega Clear!','New Best!','Max Smash!','Big Score!','High Five!','Good Game!','Cool Shot!','You Rule!','Pro Hero!','Sharp Mind!','Jackpot!','Outstanding!','Incredible!','Fantastic!','Brilliant!','Excellent!','Amazing!','Terrific!','Wonderful!','Superb!','Marvelous!'
];

function pickHeadline(){
  if (!HEADLINES.length) return 'Clean Board';
  const idx = Math.floor(Math.random() * HEADLINES.length);
  return HEADLINES[idx] || 'Clean Board';
}

export async function showCleanBoardModal({ app, stage, getScore, setScore, animateScore, updateHUD, bonus = 500, scoreCap = 999999, boardNumber = 1 } = {}) {
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
      'padding:40px 32px 36px 32px',
      'text-align:center',
      'font-family:"LTCrow", system-ui, -apple-system, sans-serif',
      'transform:scale(0.9)',
      'transition:transform .34s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease',
      'opacity:0',
      'max-width: min(340px, 88vw)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:28px'
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

    // Title
    const title = document.createElement('div');
    title.textContent = pickHeadline();
    title.style.cssText = 'color:#B07F69;font-weight:800;font-size:40px;line-height:1;margin:0 0 32px 0;';

    // "Your score" label
    const scoreLabel = document.createElement('div');
    scoreLabel.textContent = 'Your score';
    scoreLabel.style.cssText = 'color:#A47C67;font-weight:600;font-size:20px;line-height:1.2;margin:-32px 0 8px 0;';

    // Main score display (casino-style spinning)
    const mainScore = document.createElement('div');
    mainScore.textContent = '0';
    mainScore.style.cssText = 'color:#E77449;font-weight:800;font-size:60px;line-height:1;margin:0 0 8px 0;';

    // Bonus score display (initially hidden)
    const bonusScore = document.createElement('div');
    bonusScore.textContent = '+500 Bonus score';
    bonusScore.style.cssText = 'color:#E77449;font-weight:600;font-size:24px;line-height:1;margin:0 0 8px 0;opacity:0;transform:scale(0.8);';

    // Board cleared text (initially hidden)
    const boardCleared = document.createElement('div');
    boardCleared.textContent = `Board #${boardNumber} cleared`;
    boardCleared.style.cssText = 'color:#A47C67;font-weight:600;font-size:20px;line-height:1.2;margin:0 0 8px 0;opacity:0;transform:scale(0.8);';

    // CTA (initially hidden)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Continue';
    btn.className = 'squishy squishy-cc menu-btn-primary';
    btn.style.width = '100%';
    btn.style.maxWidth = '248px';
    btn.style.opacity = '0';
    btn.style.transform = 'scale(0.8)';

    card.appendChild(hero);
    card.appendChild(title);
    card.appendChild(scoreLabel);
    card.appendChild(mainScore);
    card.appendChild(bonusScore);
    card.appendChild(boardCleared);
    card.appendChild(btn);
    el.appendChild(card);
    document.body.appendChild(el);

    // Get current score for casino animation
    const currentScore = typeof getScore === 'function' ? (getScore()|0) : 0;
    const finalScore = Math.min(scoreCap, currentScore + (bonus|0));
    
    // Set initial score
    mainScore.textContent = currentScore.toString();

    // Prepare initial pop-in states
    const setInit = (el, dy) => {
      el.style.opacity = '0';
      el.style.transform = `scale(0) translateY(${dy}px)`;
      el.style.transition = 'none';
    };
    setInit(hero, -25);
    setInit(title, -20);
    setInit(scoreLabel, -15);
    setInit(mainScore, -10);

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

      // SEQUENCE 1: Initial elements pop-in
      setTimeout(() => { 
        hero.style.opacity = '1'; 
        hero.style.transform = 'scale(1) translateY(0)'; 
      }, 100);
      setTimeout(() => { 
        title.style.opacity = '1'; 
        title.style.transform = 'scale(1) translateY(0)'; 
      }, 200);
      setTimeout(() => { 
        scoreLabel.style.opacity = '1';   
        scoreLabel.style.transform = 'scale(1) translateY(0)'; 
      }, 300);
      setTimeout(() => { 
        mainScore.style.opacity = '1';   
        mainScore.style.transform = 'scale(1) translateY(0)'; 
      }, 400);

      // SEQUENCE 2: Casino-style score spinning animation
      setTimeout(() => {
        const casinoSpin = (element, startValue, endValue, duration = 2000) => {
          const t0 = performance.now();
          const diff = endValue - startValue;
          
          const tick = (now) => {
            const p = Math.min((now - t0) / duration, 1);
            
            // Casino-style easing with multiple speed changes
            let ease;
            if (p < 0.3) {
              // Fast initial spin
              ease = p / 0.3 * 0.7;
            } else if (p < 0.7) {
              // Slow down in middle
              ease = 0.7 + (p - 0.3) / 0.4 * 0.2;
            } else {
              // Final slow approach
              ease = 0.9 + (p - 0.7) / 0.3 * 0.1;
            }
            
            const cur = Math.floor(startValue + diff * ease);
            element.textContent = cur.toString();
            
            if (p < 1) {
              requestAnimationFrame(tick);
            } else {
              element.textContent = endValue.toString();
            }
          };
          requestAnimationFrame(tick);
        };
        
        casinoSpin(mainScore, currentScore, finalScore, 2500);
      }, 800);

      // SEQUENCE 3: +500 Bonus score pop-in
      setTimeout(() => {
        bonusScore.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.5s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        bonusScore.style.opacity = '1';
        bonusScore.style.transform = 'scale(1) translateY(0)';
      }, 1200);

      // SEQUENCE 4: Simultaneous score counting + bonus counting down
      setTimeout(() => {
        // Score counting up (already done by casino spin, but ensure it's at final value)
        mainScore.textContent = finalScore.toString();
        
        // Bonus counting down to 0
        const bonusCountdown = (element, startValue, endValue, duration = 1500) => {
          const t0 = performance.now();
          const diff = endValue - startValue;
          
          const tick = (now) => {
            const p = Math.min((now - t0) / duration, 1);
            const easeOutCubic = 1 - Math.pow(1 - p, 3);
            const cur = Math.floor(startValue + diff * easeOutCubic);
            element.textContent = `+${cur} Bonus score`;
            
            if (p < 1) {
              requestAnimationFrame(tick);
            } else {
              element.textContent = `+${endValue} Bonus score`;
            }
          };
          requestAnimationFrame(tick);
        };
        
        bonusCountdown(bonusScore, bonus, 0, 1500);
      }, 2000);

      // SEQUENCE 5: Replace bonus with "Board #X cleared" text
      setTimeout(() => {
        // Hide bonus score
        bonusScore.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        bonusScore.style.opacity = '0';
        bonusScore.style.transform = 'scale(0.8) translateY(-10px)';
        
        // Show board cleared text
        setTimeout(() => {
          boardCleared.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.5s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
          boardCleared.style.opacity = '1';
          boardCleared.style.transform = 'scale(1) translateY(0)';
        }, 300);
      }, 3500);

      // SEQUENCE 6: Continue button pop-in
      setTimeout(() => {
        btn.style.transition = 'opacity 0.5s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.5s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
        btn.style.opacity = '1';
        btn.style.transform = 'scale(1) translateY(0)';
      }, 4200);
    });

    // Continue
    btn.addEventListener('click', () => {
      btn.disabled = true;
      const exitTrans = 'opacity 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      const exitOffsets = [-22, -18, -14, -10, -6, -4, -2];
      const exitScale = [0, 0.08, -0.04, 0.05, -0.02, 0.03, -0.01];
      const nodes = [hero, title, scoreLabel, mainScore, bonusScore, boardCleared, btn];
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
          setScore(next); updateHUD?.();
        }
        try { window.updateHighScore?.(next); } catch {}
      } catch {}
      setTimeout(() => { try { el.remove(); } catch {}; resolve({ action: 'continue' }); }, collapseDuration + 220);
    });
  });
}
