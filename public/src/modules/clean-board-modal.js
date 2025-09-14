// public/src/modules/clean-board-modal.js
// DOM-based overlay (design-first), Board cleared + bonus + Continue

// Keep CSS-based pop-in like homepage slide 1

export async function showCleanBoardModal({ app, stage, getScore, setScore, animateScore, updateHUD, bonus = 500, scoreCap = 999999 } = {}) {
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
      'background:#fff0', // keep pure background look
      'border-radius:40px',
      'padding:0',
      'text-align:center',
      'font-family:"LTCrow", system-ui, -apple-system, sans-serif',
      'transform:scale(0.86)',
      'transition:transform .34s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .14s ease',
      'opacity:0'
    ].join(';');

    // Hero
    const hero = document.createElement('img');
    hero.alt = 'Board cleared';
    hero.src = './assets/clean-board.png';
    hero.style.cssText = 'width:min(260px,46vw);height:auto;display:block;margin:0 auto 24px auto;transform:scale(0.92);';
    
    // Add error handling for image
    hero.onerror = () => {
      // Fallback to a simple div
      hero.style.cssText = 'width:min(260px,46vw);height:min(260px,46vw);background:#4CAF50;border-radius:20px;display:block;margin:0 auto 24px auto;transform:scale(0.92);';
    };

    // Title
    const title = document.createElement('div');
    title.textContent = 'Board cleared';
    title.style.cssText = 'color:#A68C7D;font-weight:800;font-size:40px;line-height:1;margin:0 auto 24px auto;';

    // +500 (rolling number like stats)
    const val = document.createElement('div');
    val.className = 'stat-value';
    val.textContent = '+0';
    val.style.cssText = 'color:#E77449;font-weight:800;font-size:60px;line-height:1;margin:0 auto 15px auto;';

    // Bonus points
    const sub = document.createElement('div');
    sub.textContent = 'Bonus points';
    sub.style.cssText = 'color:#725B4C;font-weight:600;font-size:20px;margin:0 auto 28px auto;';

    // CTA
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Continue';
    btn.style.cssText = [
      'appearance:none','-webkit-appearance:none',
      'background:#D87A53','color:#fff','border:none',
      'border-radius:40px','padding:16px 64px','font-weight:800','font-size:24px',
      'box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 0 0 #C86C49, 0 6px 0 0 #B35E3F, 0 10px 0 0 #9E5237',
      'cursor:pointer'
    ].join(';');
    btn.onpointerover = () => { btn.style.transform = 'translateY(3px)'; };
    btn.onpointerout  = () => { btn.style.transform = 'translateY(0)'; };

    card.appendChild(hero);
    card.appendChild(title);
    card.appendChild(val);
    card.appendChild(sub);
    card.appendChild(btn);
    el.appendChild(card);
    document.body.appendChild(el);

    // Prepare initial pop-in states like homepage slide 1 (CSS transitions)
    const items = [title, val, sub, btn];
    const setInit = (el, dy) => {
      el.style.opacity = '0';
      el.style.transform = `scale(0) translateY(${dy}px)`;
      el.style.transition = 'none';
    };
    setInit(hero, -25);
    setInit(title, -20);
    setInit(val, -15);
    setInit(sub, -10);
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
      val.style.transition = trans;
      sub.style.transition = trans;
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
        val.style.opacity = '1';   
        val.style.transform   = 'scale(1) translateY(0)'; 
      }, 300);
      setTimeout(() => { 
        sub.style.opacity = '1';   
        sub.style.transform   = 'scale(1) translateY(0)'; 
      }, 400);
      setTimeout(() => { 
        btn.style.opacity = '1';   
        btn.style.transform   = 'scale(1) translateY(0)'; 
      }, 500);

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
      }, 400);
    });

    // Continue
    btn.addEventListener('click', () => {
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

      el.style.opacity = '0';
      card.style.transform = 'scale(0.96)';
      setTimeout(() => { try { el.remove(); } catch {}; resolve({ action: 'continue' }); }, 220);
    });
  });
}
