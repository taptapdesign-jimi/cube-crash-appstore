// public/src/main.js - OPTIMIZED VERSION
import { boot } from './modules/app.js';
import { gsap } from 'gsap';

// Initialize the optimized slider
let slider;

(async () => {
  try {
    if (document.readyState === 'loading') {
      await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }

    console.log('🚀 Initializing optimized CubeCrash...');

    const home = document.getElementById('home');
    const appHost = document.getElementById('app') || (()=>{ const d=document.createElement('div'); d.id='app'; document.body.appendChild(d); return d; })();

    // If query ?autoplay=1 is present, skip home and boot directly (useful for dev)
    const params = new URLSearchParams(location.search);
    const autoplay = params.get('autoplay') === '1';

    let _idleTweens = [];
    let currentSlide = 0; // 0=home, 1=stats
    let trackX = 0;       // current translateX of track
    let _idlePhase = 0;   // 0..1 fractional phase of idle (preserved across slides)
    let _idleWatch = null;

    function isIdleRunning(){
      try { return _idleTweens.some(t => t && t.isActive && t.isActive()); } catch { return false; }
    }
    function startIdleWatch(){
      try { clearInterval(_idleWatch); } catch {}
      _idleWatch = setInterval(() => {
        if (!isIdleRunning()) {
          try { startIdle(); } catch {}
        }
      }, 1500);
    }
    function stopIdleWatch(){ try { clearInterval(_idleWatch); } catch {}; _idleWatch = null; }
    const startIdle = () => {
      try {
        // Ensure continuous idle for ALL slides; don't duplicate tweens
        slides.forEach((s, i) => {
          const hero = s?.querySelector('.hero');
          const ell  = s?.querySelector('.ellipse-shadow');
          if (hero && !_idleTweens.some(t => t && t._ccTag === `h${i}`)) {
            try { gsap.set(hero, { transformOrigin: '50% 65%' }); } catch {}
            const ht = gsap.to(hero, {
              y: -3,
              scale: 0.95,
              duration: 1.5,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: -1
            });
            try { ht.totalProgress(_idlePhase || 0); } catch {}
            ht._ccTag = `h${i}`;
            _idleTweens.push(ht);
          }
          if (ell && !_idleTweens.some(t => t && t._ccTag === `e${i}`)) {
            try { gsap.set(ell, { transformOrigin: '50% 50%' }); } catch {}
            const et = gsap.to(ell, {
              scaleX: 1.05,
              scaleY: 0.95,
              duration: 1.5,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: -1,
              transformOrigin: '50% 50%'
            });
            try { et.totalProgress(_idlePhase || 0); } catch {}
            et._ccTag = `e${i}`;
            _idleTweens.push(et);
          }
        });
      } catch {}
    };
    const stopIdle = () => {
      try {
        const ref = _idleTweens?.find?.(t => t && typeof t.totalProgress === 'function');
        if (ref) {
          const tp = ref.totalProgress();
          if (typeof tp === 'number' && isFinite(tp)) _idlePhase = tp - Math.floor(tp);
        }
      } catch {}
      try { _idleTweens.forEach(t => t?.kill?.()); } catch {}
      _idleTweens.length = 0;
      // Ne diramo trenutni transform tijekom draga—izbjegava skokove
    };

    const startGame = async (whichBtn) => {
      whichBtn?.setAttribute('disabled','true');
      
      // Get current active slide for fade out animation
      const activeSlide = slides[currentSlide];
      const hero = activeSlide?.querySelector('.hero');
      const ellipse = activeSlide?.querySelector('.ellipse-shadow');
      const cta = activeSlide?.querySelector('.cta');
      
      console.log('🎭 Fade out debug:', {
        currentSlide,
        activeSlide: !!activeSlide,
        hero: !!hero,
        ellipse: !!ellipse,
        cta: !!cta,
        heroStyle: hero ? getComputedStyle(hero).display : 'null',
        ellipseStyle: ellipse ? getComputedStyle(ellipse).display : 'null',
        ctaStyle: cta ? getComputedStyle(cta).display : 'null'
      });
      
      // Stop all idle animations immediately
      stopIdle();
      
      // Simple mobile-friendly fade out animation - DISABLED TO AVOID CONFLICTS
      // const fadeOutTimeline = gsap.timeline();
      // fadeOutTimeline.play();
      
      // Start game immediately - no waiting
      console.log('🎭 Starting game immediately');
      
      // Add immediate visual feedback - FORCE WITH !important
      if (activeSlide) {
        console.log('🎭 Adding immediate visual feedback');
        
        // Force CSS animation with !important to override everything
        activeSlide.style.setProperty('transition', 'all 0.6s ease-out', 'important');
        activeSlide.style.setProperty('transform', 'scale(0.95)', 'important');
        activeSlide.style.setProperty('opacity', '0.9', 'important');
        
        console.log('🎭 Step 1 - scale 0.95, opacity 0.9');
        
        setTimeout(() => {
          activeSlide.style.setProperty('transform', 'scale(0.85)', 'important');
          activeSlide.style.setProperty('opacity', '0.7', 'important');
          console.log('🎭 Step 2 - scale 0.85, opacity 0.7');
        }, 200);
        
        setTimeout(() => {
          activeSlide.style.setProperty('transform', 'scale(0.7)', 'important');
          activeSlide.style.setProperty('opacity', '0.4', 'important');
          console.log('🎭 Step 3 - scale 0.7, opacity 0.4');
        }, 400);
        
        setTimeout(() => {
          activeSlide.style.setProperty('transform', 'scale(0.5)', 'important');
          activeSlide.style.setProperty('opacity', '0.1', 'important');
          console.log('🎭 Step 4 - scale 0.5, opacity 0.1');
        }, 600);
        
        setTimeout(() => {
          activeSlide.style.setProperty('transform', 'scale(0.3)', 'important');
          activeSlide.style.setProperty('opacity', '0', 'important');
          console.log('🎭 Step 5 - scale 0.3, opacity 0 - FINAL');
        }, 800);
        
        // Also animate individual elements
        const hero = activeSlide.querySelector('.hero');
        const heroWrap = activeSlide.querySelector('.hero-wrap');
        const copy = activeSlide.querySelector('.copy');
        const cta = activeSlide.querySelector('.cta');
        
        if (hero) {
          hero.style.setProperty('transition', 'all 0.5s ease-out', 'important');
          setTimeout(() => {
            hero.style.setProperty('transform', 'translate(-50%, -50%) scale(0.8) translateY(-20px)', 'important');
            hero.style.setProperty('opacity', '0', 'important');
            console.log('🎭 Hero animated');
          }, 100);
        }
        
        if (heroWrap) {
          heroWrap.style.setProperty('transition', 'all 0.5s ease-out', 'important');
          setTimeout(() => {
            heroWrap.style.setProperty('transform', 'scale(0.8) translateY(-30px)', 'important');
            heroWrap.style.setProperty('opacity', '0', 'important');
            console.log('🎭 HeroWrap animated');
          }, 150);
        }
        
        if (copy) {
          copy.style.setProperty('transition', 'all 0.5s ease-out', 'important');
          setTimeout(() => {
            copy.style.setProperty('transform', 'scale(0.9) translateY(30px)', 'important');
            copy.style.setProperty('opacity', '0', 'important');
            console.log('🎭 Copy animated');
          }, 200);
        }
        
        if (cta) {
          cta.style.setProperty('transition', 'all 0.4s ease-out', 'important');
          setTimeout(() => {
            cta.style.setProperty('transform', 'scale(0.8) translateY(20px)', 'important');
            cta.style.setProperty('opacity', '0', 'important');
            console.log('🎭 CTA animated');
          }, 250);
        }
      }
      
      appHost.removeAttribute('hidden');
      home?.setAttribute('hidden','true');
      
      // Start boot immediately
      console.log('🎭 Calling boot() now');
      boot(); // Start game right away
      
      // Simple exit animation for visual feedback - DISABLED TO AVOID CONFLICTS
      // Using only CSS animation above
      
      console.log('[CC] Simple fade out started, game running in parallel');
    };

    // Slide helpers
    const setActiveDot = (idx) => {
      navDots.forEach((b,i)=>{
        const active = i === idx;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
        b.tabIndex = active ? 0 : -1;
      });
    };
    const placeDots = () => {
      try {
        const nav = document.getElementById('home-nav');
        const activeSlide = slides[currentSlide];
        const btn = activeSlide?.querySelector('.copy .cta button');
        if (!nav || !btn) return;
        const r = btn.getBoundingClientRect();
        const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || 0;
        const dotH = Math.max(8, nav.offsetHeight || 8);
        const gap = 24; // fixed 24px below CTA
        const desiredTop = Math.round(r.bottom + gap);
        if (desiredTop + dotH > vh) {
          // Fallback: anchor to bottom with safe-area to keep visible on iPhone
          const bottom = 16; // 16px above home indicator
          nav.style.setProperty('--dots-bottom', `calc(env(safe-area-inset-bottom, 0px) + ${bottom}px)`);
          nav.style.setProperty('--dots-top', 'auto');
        } else {
          nav.style.setProperty('--dots-top', `${desiredTop}px`);
          nav.style.setProperty('--dots-bottom', 'auto');
        }
      } catch {}
    };
    const goToSlide = (idx) => {
      if (idx === currentSlide) return;
      const W = stage?.clientWidth || window.innerWidth || 320;
      // keep idle animations running during slide transition
      // snap current state
      try { gsap.killTweensOf(track); } catch {}
      try {
        const currX = Number(gsap.getProperty(track, 'x'));
        if (!Number.isNaN(currX)) trackX = currX;
      } catch {}
      // update logical state immediately so rapid swipes can chain across slides
      currentSlide = idx; setActiveDot(idx);
      const targetX = -idx * W; trackX = targetX;
      gsap.to(track, { x: targetX, duration: 0.26, ease: 'back.out(1.25)', onComplete: () => {
        slides.forEach((s,i)=>s.classList.toggle('active', i===idx));
        startIdle(); placeDots();
      }});
    };
    // attach events
    navDots.forEach((b)=> b.addEventListener('click', () => {
      const i = Number(b.dataset.index||0) || 0; goToSlide(i);
    }));
    window.addEventListener('resize', () => { placeDots(); });
    setActiveDot(0); placeDots();

    // drag area = cijeli overlay (ignoriramo gumb i dots)
    const dragArea = document.getElementById('home');
    if (dragArea) {
      let startX = 0, startY = 0, startTrackX = 0, dragging = false, dx = 0, W = 320;
      const applyDrag = (dx) => { gsap.set(track, { x: startTrackX + dx }); };
      const commit = (toIdx, dragDx) => {
        // keep idle animations running during slide transition
        // Kill existing tween and sync trackX so next drags start from real position
        try { gsap.killTweensOf(track); } catch {}
        try {
          const currX = Number(gsap.getProperty(track, 'x'));
          if (!Number.isNaN(currX)) trackX = currX;
        } catch {}
        // Update logical slide immediately so rapid swipes can chain (e.g., 3→2→1)
        currentSlide = toIdx; setActiveDot(toIdx);
        const targetX = -toIdx * W; trackX = targetX;
        gsap.to(track, { x: targetX, duration: 0.26, ease: 'back.out(1.25)', onComplete: () => {
          slides.forEach((s,i)=>s.classList.toggle('active', i===toIdx));
          startIdle(); placeDots();
        }});
      };
      const cancel = () => {
        gsap.to(track, { x: -currentSlide * W, duration: 0.22, ease: 'back.out(1.2)', onComplete: () => { startIdle(); } });
      };
      const onStart = (x, y, target) => {
        // ignoriraj klikove na CTA/dots
        try { if (target && (target.closest('#slides-stage .copy .cta button') || target.closest('#home-nav'))) return; } catch {}
        dragging = true; dx = 0; startX = x; startY = y; W = stage?.clientWidth || window.innerWidth || 320;
        // Stop any ongoing tween and sync start position with actual transform
        try { gsap.killTweensOf(track); } catch {}
        try {
          const currX = Number(gsap.getProperty(track, 'x'));
          if (!Number.isNaN(currX)) trackX = currX;
        } catch {}
        startTrackX = trackX;
      };
      const onMove  = (x, y) => {
        if (!dragging) return;
        const ddx = x - startX; const ddy = y - startY;
        if (Math.abs(ddx) < Math.abs(ddy)) return; // ignore vertical
        // edge resistance
        let mx = ddx;
        const atStart = currentSlide===0 && mx>0;
        const atEnd   = currentSlide===slides.length-1 && mx<0;
        if (atStart || atEnd) mx *= 0.35; // resistance at edges
        dx = mx;
        applyDrag(dx);
      };
      const onEnd   = (x, y) => {
        if (!dragging) return;
        dragging = false;
        const ddx = (x - startX);
        const threshold = Math.max(36, W * 0.12);
        if (Math.abs(ddx) >= threshold) {
          if (ddx < 0 && currentSlide < slides.length-1) commit(currentSlide+1, ddx);
          else if (ddx > 0 && currentSlide > 0) commit(currentSlide-1, ddx);
          else cancel();
        } else cancel();
      };
      // touch + pointer na cijelom overlayu
      dragArea.addEventListener('touchstart', e => { const t=e.touches[0]; onStart(t.clientX, t.clientY, e.target); }, { passive: true });
      dragArea.addEventListener('touchmove',  e => { const t=e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
      dragArea.addEventListener('touchend',   e => { const t=(e.changedTouches||[{}])[0]; onEnd(t.clientX||startX, t.clientY||startY); });
      dragArea.addEventListener('pointerdown', e => onStart(e.clientX, e.clientY, e.target));
      dragArea.addEventListener('pointermove', e => onMove(e.clientX, e.clientY));
      dragArea.addEventListener('pointerup',   e => onEnd(e.clientX, e.clientY));
      dragArea.addEventListener('pointercancel', () => { dragging=false; cancel(); });
    }

    if (autoplay) {
      await startGame(btnHome);
    } else {
      // CTA listeners
      btnHome?.addEventListener('click', async (e) => {
        if (currentSlide !== 0) return; // inactive
        try { await startGame(e.currentTarget); } catch (err) {
          console.error('[CC] boot failed:', err);
          e.currentTarget?.removeAttribute('disabled');
          appHost?.setAttribute('hidden','true'); home?.removeAttribute('hidden');
        }
      });
      btnStats?.addEventListener('click', () => { if (currentSlide===1) { try { window.location.hash = '#/stats'; } catch {} } });
      btnCollectibles?.addEventListener('click', () => { if (currentSlide===2) { try { window.location.hash = '#/collectibles'; } catch {} } });
    }

    // Populate simple stats if available
    try {
      const best = Number(localStorage.getItem('cc_best_score_v1')||0) || 0;
      const bestEl = document.getElementById('best-score'); if (bestEl) bestEl.textContent = String(best);
    } catch {}

    // Start idle hover animation on homepage
    if (!autoplay) { startIdle(); placeDots(); }
  } catch (e) {
    console.error('[CC] boot failed:', e);
  }
})();
