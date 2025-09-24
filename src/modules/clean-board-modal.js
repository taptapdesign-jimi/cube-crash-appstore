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

    const subtitle = document.createElement('div');
    subtitle.textContent = `Board ${boardNumber} bonus points`;
    subtitle.style.cssText = 'color:#A47C67;font-weight:600;font-size:20px;line-height:1.2;margin:-32px 0 8px 0;';

    // +500 (rolling number like stats)
    const val = document.createElement('div');
    val.className = 'stat-value';
    val.textContent = '+0';
    val.style.cssText = 'color:#E77449;font-weight:800;font-size:60px;line-height:1;margin:0 0 8px 0;';

    // CTA
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Continue';
    btn.className = 'squishy squishy-cc menu-btn-primary';
    btn.style.width = '100%';
    btn.style.maxWidth = '248px';

    card.appendChild(hero);
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(val);
    card.appendChild(btn);
    el.appendChild(card);
    document.body.appendChild(el);

    // Prepare initial pop-in states like homepage slide 1 (CSS transitions)
    const setInit = (el, dy) => {
      el.style.opacity = '0';
      el.style.transform = `scale(0) translateY(${dy}px)`;
      el.style.transition = 'none';
    };
    setInit(hero, -25);
    setInit(title, -20);
    setInit(subtitle, -15);
    setInit(val, -10);
    setInit(btn, -5);

    // Show modal and card immediately
    el.style.opacity = '1';
    card.style.opacity = '1';
    card.style.transform = 'scale(1)';
    
    // Wait for next frame to ensure elements are rendered
    requestAnimationFrame(() => {
      // identical easing and duration as slide 1
      const trans = 'opacity 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.65s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      hero.style.transition = trans;
      title.style.transition = trans;
      subtitle.style.transition = trans;
      val.style.transition = trans;
      btn.style.transition = trans;

      // Staggered reveal with proper timing
      setTimeout(() => { 
        hero.style.opacity = '1'; 
        hero.style.transform = 'scale(1) translateY(0)'; 
      }, 100);
      setTimeout(() => { 
        title.style.opacity = '1'; 
        title.style.transform = 'scale(1) translateY(0)'; 
      }, 200);
      setTimeout(() => { 
        subtitle.style.opacity = '1';   
        subtitle.style.transform   = 'scale(1) translateY(0)'; 
      }, 300);
      setTimeout(() => { 
        val.style.opacity = '1';   
        val.style.transform   = 'scale(1) translateY(0)'; 
      }, 380);
      setTimeout(() => { 
        btn.style.opacity = '1';   
        btn.style.transform   = 'scale(1) translateY(0)'; 
      }, 460);

      // Rolling number animation (same logic as stats animateNumber)
      const animateNumber = (element, targetValue, duration = 1000) => {
        const parse = (t) => parseInt(String(t).replace(/[^0-9]/g,'')) || 0;
        const startValue = parse(element.textContent);
        const diff = targetValue - startValue;
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min((now - t0) / duration, 1);
          const easeOutCubic = 1 - Math.pow(1 - p, 3);
          const cur = Math.floor(startValue + diff * easeOutCubic);
          element.textContent = `+${cur}`;
          if (p < 1) requestAnimationFrame(tick); else {
            element.textContent = `+${targetValue}`;
            element.classList.add('animating');
            setTimeout(() => element.classList.remove('animating'), 300);
          }
        };
        requestAnimationFrame(tick);
      };
      // Start roll to bonus after it pops in
      setTimeout(() => {
        animateNumber(val, bonus, 900);
      }, 380);
    });

    // Continue
    btn.addEventListener('click', () => {
      btn.disabled = true;
      const exitTrans = 'opacity 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8), transform 0.58s cubic-bezier(0.68, -0.8, 0.265, 1.8)';
      const exitOffsets = [-22, -18, -14, -10, -6];
      const exitScale = [0, 0.08, -0.04, 0.05, -0.02];
      const nodes = [hero, title, subtitle, val, btn];
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
