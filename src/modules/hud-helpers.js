// public/src/modules/hud-helpers.js
import { Container, Graphics, Text, Rectangle } from 'pixi.js';
import { gsap } from 'gsap';
import { pauseGame, resumeGame, restart } from './app-core.js';
// import { showPauseModal } from './pause-modal.js'; // Replaced with menu screen
import { HUD_H, COLS, ROWS, TILE, GAP } from './constants.js';

// Local boardSize function (same as in app.js)
function boardSize(){ return { w: COLS*TILE + (COLS-1)*GAP, h: ROWS*TILE + (ROWS-1)*GAP }; }

// Old makeWildLoader function removed - using new PIXI implementation below

/* ---------------- Minimal HUD the app.js expects ---------------- */
let HUD_ROOT = null;
let boardText, scoreText, comboText; 
let comboWrap; // wrapper for jitter
let wild;

// Unified container for PIXI HUD + DOM wild preloader
let unifiedHudContainer = null;

export function createUnifiedHudContainer() {
  console.log('🎯 Creating unified HUD container...');
  
  // Create the unified container
  unifiedHudContainer = document.createElement('div');
  unifiedHudContainer.setAttribute('data-unified-hud', '');
  unifiedHudContainer.style.cssText = `
    position: fixed;
    top: 0px;
    left: 0px;
    right: 0px;
    height: 140px;
    z-index: 2000;
    pointer-events: none;
    transform: translateY(-100%);
    transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;
  
  // Add to app container
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.appendChild(unifiedHudContainer);
    console.log('✅ Unified HUD container created and added to app');
  } else {
    document.body.appendChild(unifiedHudContainer);
    console.log('✅ Unified HUD container created and added to body (fallback)');
  }
  
  return unifiedHudContainer;
}

export function animateUnifiedHudDrop() {
  if (!unifiedHudContainer) return;
  
  console.log('🎯 Animating unified HUD drop...');
  unifiedHudContainer.style.transform = 'translateY(0%)';
  
  // Mark as dropped after animation
  setTimeout(() => {
    unifiedHudContainer.setAttribute('data-dropped', 'true');
    console.log('✅ Unified HUD dropped and marked as dropped');
  }, 800);
}

export function getUnifiedHudInfo() {
  if (!unifiedHudContainer) {
    return { y: 0, height: 0, parent: null, dropped: false };
  }
  
  const rect = unifiedHudContainer.getBoundingClientRect();
  const dropped = unifiedHudContainer.getAttribute('data-dropped') === 'true';
  
  return {
    y: rect.top,
    height: rect.height,
    parent: unifiedHudContainer.parentNode,
    dropped: dropped
  };
}

// Create PIXI wild meter
function makeWildLoader() {
  console.log('🎯 Creating PIXI wild meter...');
  
  const container = new Container();
  container.name = 'wildLoader';
  
  // Background bar
  const bg = new Graphics();
  bg.beginFill(0xEADFD6); // Light beige
  bg.drawRoundedRect(0, 0, 200, 8, 4);
  bg.endFill();
  
  // Progress fill - start with 0 width
  const fill = new Graphics();
  fill.beginFill(0xE7744A); // Orange
  fill.drawRoundedRect(0, 0, 0, 8, 4);
  fill.endFill();
  
  container.addChild(bg, fill);
  
  // Position relative to HUD
  container.x = 24;
  container.y = 60; // Below HUD values
  container.zIndex = 1000; // Below PIXI HUD
  
  // Store references
  container._bg = bg;
  container._fill = fill;
  container._maxWidth = 200;
  
  // Methods
  container.setProgress = (ratio, animate = false) => {
    const progress = Math.max(0, Math.min(1, ratio));
    const width = progress * container._maxWidth;
    
    console.log('🎯 PIXI Wild meter progress:', Math.round(progress * 100) + '%', 'width:', width);
    
    // Kill previous animation first
    if (container._currentAnimation) {
      container._currentAnimation.kill();
      container._currentAnimation = null;
      console.log('🎯 PIXI Wild meter: Previous animation killed');
    }
    
    if (animate) {
      // Use GSAP to animate the width by redrawing the fill
      const startWidth = container._fill.width || 0;
      container._currentAnimation = gsap.to({ width: startWidth }, {
        width: width,
        duration: 0.4,
        ease: 'power2.out',
        onUpdate: function() {
          // Redraw fill with current width
          container._fill.clear();
          container._fill.beginFill(0xE7744A);
          container._fill.drawRoundedRect(0, 0, this.targets()[0].width, 8, 4);
          container._fill.endFill();
        },
        onComplete: () => {
          container._currentAnimation = null;
          console.log('🎯 PIXI Animation complete - final width:', width);
        }
      });
      console.log('🎯 PIXI Wild meter: Animation started');
    } else {
      // Set width directly
      container._fill.clear();
      container._fill.beginFill(0xE7744A);
      container._fill.drawRoundedRect(0, 0, width, 8, 4);
      container._fill.endFill();
      console.log('🎯 PIXI Wild meter set directly to width:', width);
    }
  };
  
  container.setWidth = (width) => {
    container._maxWidth = width;
    // Redraw background with new width
    container._bg.clear();
    container._bg.beginFill(0xEADFD6);
    container._bg.drawRoundedRect(0, 0, width, 8, 4);
    container._bg.endFill();
    // Reset fill to 0 width
    container._fill.clear();
    container._fill.beginFill(0xE7744A);
    container._fill.drawRoundedRect(0, 0, 0, 8, 4);
    container._fill.endFill();
  };
  
  return {
    view: container,
    setProgress: container.setProgress,
    setWidth: container.setWidth
  };
}

export { wild };
let __comboJitterTl = null;
let __comboBumpTl = null;
let __shakeTl = null;        // drives shake amplitude during bump/deflate
let __lastComboVal = 0;
let __shakeMul = 1.0;        // global multiplier sampled by jitter
let __scoreTweening = false;
let __boardTweening = false;
let __prevScore = 0;
let __prevBoard = 0;

function bounceText(obj, { peak=1.28, back=1.06, up=0.10, down=0.24 } = {}){
  if (!obj) return;
  try { gsap.killTweensOf(obj.scale); } catch {}
  gsap.timeline()
    .to(obj.scale, { x: peak, y: peak, duration: up, ease: 'back.out(3)' }, 0)
    .to(obj.scale, { x: back, y: back, duration: down, ease: 'elastic.out(1,0.78)' }, '>-0.02');
}

function startComboFX(){
  if (!comboText) return;
  // keep a slightly enlarged base while active
  try { gsap.killTweensOf(comboText); } catch {}
  if (!__comboJitterTl){
    __comboJitterTl = gsap.timeline({ repeat: -1, repeatRefresh: true });
    const rot = () => (Math.random() * 0.144*__shakeMul - 0.072*__shakeMul); // scaled by shakeMul
    const d   = () => (0.14 + Math.random() * 0.12);
    const dx  = () => (0.036*__shakeMul + Math.random() * 0.084*__shakeMul);
    __comboJitterTl
      .to(comboWrap || comboText, { rotation: rot, duration: d, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
      .to((comboWrap && comboWrap.scale) ? comboWrap.scale : comboText.scale, { x: () => `+=${dx()}`, y: () => `+=${dx()}`, duration: d, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0);
  }
}
function stopComboFX(){
  if (__comboJitterTl){ try { __comboJitterTl.kill(); } catch {} __comboJitterTl = null; }
  if (!comboText) return;
  // elastic bounce back to rest
  try {
    gsap.to(comboWrap || comboText, { rotation: 0, duration: 0.25, ease: 'power2.out' });
    // sporiji, nježniji decay natrag na 1.0
    gsap.to(comboWrap ? comboWrap.scale : comboText.scale, { x: 1, y: 1, duration: 0.40, ease: 'power2.out' });
    gsap.to(comboText.scale, { x: 1, y: 1, duration: 1.40, ease: 'elastic.out(1,0.9)' });
    // reset shake multiplier smoothly
    try { __shakeTl?.kill?.(); } catch {}
    const sh = { k: __shakeMul };
    __shakeTl = gsap.to(sh, { k: 1.0, duration: 0.60, ease: 'power2.out', onUpdate: () => { __shakeMul = sh.k; } });
  } catch {}
}

export function layout({ app, top }) { 
  if (!HUD_ROOT) return;
  const vw = app.renderer.width;
  const vh = app.renderer.height;
  
  // Respect the provided top from app.js (safeTop already accounts for safe areas)
  const isMobile = vw < 768 || vh > vw;
  console.log(isMobile ? '📱 Mobile HUD top (safeTop):' : '🖥️ Desktop HUD top:', top);

  const SIDE = 24;            // bočni odmak
  // NOTE: yLabel/yValue are LOCAL to HUD_ROOT. HUD_ROOT.y is set to 'top'.
  const yLabel = 0;           // red s labelima (local)
  const yValue = 20;          // red s vrijednostima (local)
  
  console.log('🎯 HUD positioning:', { top, yLabel, yValue, vh, onePercent: Math.round(vh * 0.01) });
  // Use stable fontSize for spacing (avoids tiny drift from Text.height timing)
  const valueRowH = Math.max(
    boardText?.style?.fontSize || 24,
    scoreText?.style?.fontSize || 24,
    comboText?.style?.fontSize || 24
  );
  const barGap    = Math.round(vh * 0.02); // 2% gap below the numbers
  const barY      = yValue + valueRowH + barGap; 

  // labeli
  // (renderamo ih jednom; pozicioniranje brojeva ispod)
  if (!HUD_ROOT._labels) {
    const lblStyle = { fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif', fontSize: 16, fill: 0x735C4C, fontWeight: '700', fontStyle: 'normal' };
    const m = new Text({ text: 'Board', style: lblStyle });
    const s = new Text({ text: 'Score', style: lblStyle });
    const c = new Text({ text: 'Combo', style: lblStyle });
    m.anchor.set(0.5, 0);
    s.anchor.set(0.5, 0);
    c.anchor.set(0.5, 0);
    HUD_ROOT.addChild(m, s, c);
    HUD_ROOT._labels = { m, s, c };
  }
  const { m, s, c } = HUD_ROOT._labels;

  // pozicioniranje labela
  const leftCenter  = SIDE + m.width / 2;   // center of the left column
  const midCenter   = Math.round(vw / 2);   // center column
  const rightCenter = Math.round(vw - SIDE - c.width / 2); // center of the right column

  m.x = leftCenter;
  s.x = midCenter;
  c.x = rightCenter;
  m.y = s.y = c.y = yLabel;

  // poravnanja — Board lijevo (broj), Score sredina, Combo desno
  // center values under their labels (using anchors)
  boardText.x = leftCenter;
  scoreText.x = midCenter;
  if (comboWrap){ comboWrap.x = rightCenter; comboWrap.y = yValue; }
  // keep text at origin within wrapper
  comboText.x = 0; comboText.y = 0;
  boardText.y = yValue; scoreText.y = yValue;

  const barW = Math.max(120, vw - SIDE * 2);
  // Old wild loader disabled - using DOM wild meter instead
  // if (wild && wild.view) { ... }
  
  // Update PIXI wild meter position
  if (wild && wild.view) {
    const vw = app.renderer.width;
    const vh = app.renderer.height;
    const SIDE = 24;
    const barW = Math.max(120, vw - SIDE * 2);
    const yValue = 20;
    const valueRowH = Math.max(24, 24, 24);
    const barGap = Math.round(vh * 0.02);
    
    wild.view.x = SIDE;
    wild.view.y = yValue + valueRowH + barGap;
    wild.setWidth(barW);
    
    console.log('🎯 PIXI Wild meter positioned:', { x: SIDE, y: wild.view.y, width: barW });
  }
  
  // Ensure HUD is properly positioned
  if (HUD_ROOT) {
    HUD_ROOT.zIndex = 10_000;
    HUD_ROOT.sortableChildren = true;
    // If drop not yet played, don't force y to top — only update the stored drop target.
    if (HUD_ROOT._dropped) {
      HUD_ROOT.y = top;      // pin to final top when already dropped
      HUD_ROOT.alpha = 1;
    } else {
      HUD_ROOT._dropTop = top; // remember final top for later drop animation
      // keep current y (likely top-80/-120)
    }
    console.log('🎯 HUD layout:', { y: HUD_ROOT.y, dropTop: HUD_ROOT._dropTop, dropped: !!HUD_ROOT._dropped });
  } else {
    console.warn('⚠️ HUD_ROOT not found in layout function!');
  }
}

export function initHUD({ stage, app, top = 8, initialHide = false }) { 
  // očisti stari root ako postoji i skini stari resize listener
  try { if (HUD_ROOT && HUD_ROOT._onResize) window.removeEventListener('resize', HUD_ROOT._onResize); } catch {}
  // očisti stari root ako postoji
  try { if (HUD_ROOT && HUD_ROOT.parent) HUD_ROOT.parent.removeChild(HUD_ROOT); } catch {}
  HUD_ROOT = new Container();
  HUD_ROOT.label = 'HUD_ROOT';
  HUD_ROOT.zIndex = 10_000;
  HUD_ROOT.sortableChildren = true;
  stage.addChild(HUD_ROOT);

  // vrijednosti - Use system font stack for better App Store compatibility
  const valBoard = { fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif', fontSize: 24, fill: 0xAD8775, fontWeight: '700', fontStyle: 'normal' };
  const valMain  = { fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif', fontSize: 24, fill: 0xAD8775, fontWeight: '700', fontStyle: 'normal' };
  const valCombo = { fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif', fontSize: 24, fill: 0xE77449, fontWeight: '700', fontStyle: 'normal' }; // Same color as preloader

  boardText = new Text({ text: '#1', style: valBoard });
  scoreText = new Text({ text: '0', style: valMain  });
  comboText = new Text({ text: 'x0', style: valCombo });
  
  // Export combo text for animations
  window.comboText = comboText;

  boardText.anchor.set(0.5, 0);
  scoreText.anchor.set(0.5, 0);
  comboText.anchor.set(0.5, 0);

  // add texts; wrap combo for independent jitter
  comboWrap = new Container();
  comboWrap.addChild(comboText);
  HUD_ROOT.addChild(boardText, scoreText, comboWrap);
  // ensure combo is drawn above wild bar if overlapping
  try {
    boardText.zIndex = 10;
    scoreText.zIndex = 10;
    comboWrap.zIndex = 2000;
    comboText.zIndex = 2000;
    HUD_ROOT.sortChildren?.();
  } catch {}

  // Create PIXI wild meter
  console.log('🎯 Creating PIXI wild meter...');
  wild = makeWildLoader();
  if (wild && wild.view) {
    HUD_ROOT.addChild(wild.view);
    wild.setProgress(0, false); // Start at 0%
    console.log('✅ PIXI wild meter created and added to HUD');
  } else {
    console.warn('⚠️ Failed to create PIXI wild meter');
  }

  // inicijalni layout + resize listener
  layout({ app, top });
  const onResize = () => layout({ app, top });
  HUD_ROOT._onResize = onResize;
  window.addEventListener('resize', onResize);

  // Defer drop animation control to caller
  HUD_ROOT._dropTop = top;
  if (initialHide) {
    HUD_ROOT.alpha = 0;
    HUD_ROOT.y = top - 140; // start well above for visible drop-in
    HUD_ROOT._dropped = false;
  } else {
    HUD_ROOT.alpha = 1;
    HUD_ROOT.y = top;
    HUD_ROOT._dropped = true;
  }

  // Add pause modal on HUD click - only HUD area (moves, score, combo, wild preloader)
  HUD_ROOT.interactive = true;
  HUD_ROOT.cursor = 'pointer';
  // HUD clickable area covers moves, score, combo, and wild preloader (approximately 80px height)
  HUD_ROOT.hitArea = new Rectangle(0, 0, 1000, 80); // Clickable area covers entire HUD area
        HUD_ROOT.on('pointerdown', (e) => {
          e.stopPropagation();
          console.log('🎯 HUD CLICKED!');

          // Show End This Run modal instead of pause menu
          if (typeof window.showEndRunModalFromGame === 'function') {
            console.log('🎯 Calling showEndRunModalFromGame...');
            window.showEndRunModalFromGame();
          } else {
            console.log('🎯 showEndRunModalFromGame not available, using fallback');
            // Fallback to old behavior
            console.log('Calling pauseGame...');
            pauseGame();
            console.log('Calling showMenuScreen...');
            if (typeof window.showMenuScreen === 'function') {
              window.showMenuScreen();
              // Homepage image is static - no randomization needed
            } else {
              console.warn('showMenuScreen function not available');
            }
          }
        });
}

// Play the deferred drop once (used on first Play when board is ~50% populated)
export function playHudDrop({ duration = 0.8 } = {}){
  if (!HUD_ROOT) return;
  if (HUD_ROOT._dropped) return;
  const top = HUD_ROOT._dropTop ?? HUD_ROOT.y ?? 0;
  try { gsap.killTweensOf(HUD_ROOT); } catch {}
  
  // Animate PIXI HUD drop
  gsap.to(HUD_ROOT, {
    alpha: 1,
    y: top,
    duration: duration,
    ease: 'elastic.out(1, 0.6)',
    onComplete: () => { HUD_ROOT._dropped = true; HUD_ROOT.y = top; }
  });
  
  console.log('✅ PIXI HUD drop animation started');
}

export function updateHUD({ score, board, moves, combo }) {
  if (!HUD_ROOT) {
    console.warn('⚠️ HUD_ROOT is null, cannot update HUD');
    return;
  }
  
  if (!boardText || !scoreText || !comboText) {
    console.warn('⚠️ HUD text elements are null, cannot update HUD');
    return;
  }
  
  if (typeof board === 'number') {
    const bd = board|0;
    const formatted = `#${bd}`;
    if (formatted !== boardText.text) {
      boardText.text = formatted;
      if (!__boardTweening) bounceText(boardText, { peak: 1.32, back: 1.10, up: 0.10, down: 0.24 });
      __prevBoard = bd;
    }
  }
  if (typeof score === 'number') {
    const sc = score|0;
    if (String(sc) !== scoreText.text) {
      scoreText.text = String(sc);
      if (!__scoreTweening) bounceText(scoreText, { peak: 1.20, back: 1.06, up: 0.08, down: 0.20 });
      __prevScore = sc;
    }
  }
  if (typeof combo === 'number') {
    const v = combo|0;
    comboText.text = `x${v}`;
    if (v > 0) { startComboFX(); } else { stopComboFX(); }
    __lastComboVal = v;
  }
}

export function setScore(v){ if (scoreText) scoreText.text = String(v|0); }
export function setBoard(v){ if (boardText) boardText.text = `#${v|0}`; }
export function setCombo(v){
  const val = v|0;
  if (!comboText) return;
  comboText.text = `x${val}`;
  if (val > 0) startComboFX(); else stopComboFX();
  __lastComboVal = val;
}
export function resetCombo(){
  if (!comboText) return;
  comboText.text = 'x0';
  stopComboFX();
}
export function bumpCombo(opts = {}){
  if (!comboText) return;
  const kind = opts.kind || opts.type || 'stack'; // 'stack' | 'merge6'
  const cv = Number.isFinite(opts.combo) ? (opts.combo|0) : (__lastComboVal|0);

  // keep jitter running while combo is active
  startComboFX();

  // Stop current deflate/inflate but continue from current scale for smoothness
  try { __comboBumpTl?.kill?.(); } catch {}
  try { __shakeTl?.kill?.(); } catch {}

  const sx = comboText.scale?.x || 1;
  const sy = comboText.scale?.y || 1;
  const cur = Math.max(sx, sy);

  // Target peaks: stack (softer) vs merge6 (max balloon)
  // Increased by request: +25% for merge6, +10% for stack
  const PEAK_MAX   = 2.50; // was 2.00 → now 250% (24px -> 60px)
  const PEAK_STACK = 1.76; // was 1.60 → now ~176%
  const PEAK_CAP   = 3.20; // hard cap so it doesn't get absurd
  let peak = (kind === 'merge6') ? PEAK_MAX : PEAK_STACK;

  // Extra balloon if combo >= 10: +20% at 10, +2% per each step above 10, capped at +40%
  if (cv >= 10) {
    const over = Math.max(0, cv - 9);
    const bonusFactor = 1 + Math.min(0.40, 0.20 + (over - 1) * 0.02); // 10 -> +20%, 11 -> +22%, ... capped at +40%
    peak = Math.min(PEAK_CAP, peak * bonusFactor);
  }

  // Inflate a bit faster if already large so it snaps back to peak quickly
  const upDur = Math.max(0.08, 0.16 - (cur - 1) * 0.06);

  __comboBumpTl = gsap.timeline();
  __comboBumpTl
    // inflate quickly to peak
    .to(comboText.scale, { x: peak, y: peak, duration: upDur, ease: 'back.out(3)' }, 0)
    // slow, single deflate back to 1.0; keep it floating during the 2s combo window
    .to(comboText.scale, { x: 1.0, y: 1.0, duration: 2.10, ease: 'power2.out' }, '>-0.01');

  // Boost shake while inflating, then gradually relax during deflate
  const sh = { k: __shakeMul };
  __shakeTl = gsap.timeline({ onUpdate: () => { __shakeMul = sh.k; } });
  // If combo >= 10, double the shake strength for stronger impact
  const shakeExtra = (cv >= 10) ? 2.0 : 1.0;
  __shakeTl
    .to(sh, { k: ((kind === 'merge6') ? 2.6 : 2.0) * shakeExtra, duration: upDur * 0.9, ease: 'power2.out' }, 0)
    .to(sh, { k: 1.4, duration: 1.00, ease: 'sine.out' }, '>-0.02')
    .to(sh, { k: 1.1, duration: 0.90, ease: 'sine.out' }, '>');
}

/* COMPLETELY NEW LOGIC: Simple DOM-based wild meter positioned in HUD */
export function updateProgressBar(ratio, animate = false){
  console.log('🔥 PIXI LOGIC: updateProgressBar called with:', { ratio, animate });
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  
  if (wild && wild.setProgress) {
    wild.setProgress(clamped, animate);
    console.log('✅ PIXI LOGIC: Wild meter progress updated to', Math.round(clamped * 100) + '%');
  } else {
    console.warn('⚠️ PIXI LOGIC: Wild meter not available for progress update');
  }
}

// PIXI wild meter positioning is handled by HUD layout

/* PIXI RESET: Reset PIXI-based wild meter */
export function resetWildMeter(instant = true) {
  console.log('🔄 PIXI RESET: resetWildMeter called, instant:', instant);
  
  // Kill all GSAP animations for wild meter
  try {
    gsap.killTweensOf(wild?.view?._fill);
    gsap.killTweensOf({ width: 0 }); // Kill custom animation object
    if (wild?.view?._currentAnimation) {
      wild.view._currentAnimation.kill();
      wild.view._currentAnimation = null;
    }
    console.log('✅ PIXI RESET: All GSAP animations killed');
  } catch (e) {
    console.warn('⚠️ PIXI RESET: Error killing GSAP animations:', e);
  }
  
  if (wild && wild.setProgress) {
    wild.setProgress(0, !instant);
    console.log('✅ PIXI RESET: Wild meter reset to 0%');
  } else {
    console.warn('⚠️ PIXI RESET: Wild meter not available for reset');
  }
  
  console.log('✅ PIXI RESET: Wild meter completely reset');
}

/* Legacy function - now calls hard reset */
export function resetWildLoader(){
  console.log('🔄 resetWildLoader called, redirecting to resetWildMeter(true)');
  resetWildMeter(true);
}

/* Animate wild loader to 0 */
export function animateWildLoaderToZero(){
  console.log('🎬 Animating wild loader to 0');
  if (!wild) {
    console.log('⚠️ Wild loader not found for animation');
    return;
  }
  
  try {
    // DRASTIC APPROACH: Override the setProgress function to force 0
    const originalSetProgress = wild.setProgress;
    
    // Create a new setProgress that always sets to 0
    wild.setProgress = (t, animate = false) => {
      console.log('🔄 Override setProgress called with:', t, 'forcing to 0');
      
      // Force progress to 0 internally
      if (wild.view && wild.view.children) {
        const mask = wild.view.children.find(child => child.mask);
        if (mask && typeof mask.clear === 'function') {
          mask.clear();
          mask.roundRect(0, -0.5, 0, 8 + 1, 4).fill(0xffffff);
          console.log('🔄 Override: Mask cleared to 0');
        }
      }
      
      // Call original with 0
      originalSetProgress(0, false);
    };
    
    // Force call the overridden function
    wild.setProgress(0, false);
    
    // Restore original function after a delay
    setTimeout(() => {
      wild.setProgress = originalSetProgress;
      // Ensure wild loader is ready for normal operation
      if (wild.start) {
        wild.start();
      }
      console.log('🔄 Restored original setProgress function and started wild loader');
    }, 100);
    
    console.log('✅ Wild loader override reset to 0');
  } catch (error) {
    console.error('❌ Error animating wild loader to 0:', error);
  }
}

/* Force wild loader to 0 using GSAP animation */
export function forceWildLoaderToZero(){
  console.log('🎬 Force animating wild loader to 0');
  if (!wild) {
    console.log('⚠️ Wild loader not found for force animation');
    return;
  }
  
  try {
    // Use GSAP to animate the wild loader view itself
    if (wild.view && wild.view.children) {
      const mask = wild.view.children.find(child => child.mask);
      if (mask) {
        // Animate the mask width to 0
        gsap.to(mask, {
          width: 0,
          duration: 0.5,
          ease: "power2.out",
          onUpdate: () => {
            // Force redraw with 0 width
            mask.clear();
            mask.roundRect(0, -0.5, 0, 8 + 1, 4).fill(0xffffff);
          },
          onComplete: () => {
            console.log('✅ Wild loader force animation to 0 completed');
            // IMPORTANT: Reset the wild loader state so it can work normally again
            if (wild.setProgress) {
              wild.setProgress(0, false);
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Error force animating wild loader to 0:', error);
  }
}

/* Recreate wild loader completely */
export function recreateWildLoader(){
  console.log('🔄 Recreating wild loader completely');
  
  if (wild && wild.view) {
    try {
      wild.view.destroy({ children: true });
    } catch (e) {
      console.log('⚠️ Error destroying old wild loader:', e);
    }
  }
  
  // Wild loader is now created in initHUD
  console.log('✅ Wild loader reset completed');
}

/* --- Score animation helper (compat) --- */
export function animateScore({ scoreRef, setScore, updateHUD, SCORE_CAP, gsap }, toValue, duration = 0.5) {
  const from = Math.min(SCORE_CAP, (+scoreRef() || 0) | 0);
  const to   = Math.min(SCORE_CAP, (+toValue   || 0) | 0);
  if (to === from) { setScore(to); updateHUD?.({ score: to }); return; }
  const proxy = { v: from };
  __scoreTweening = true;
  // inflate score text slightly at start
  bounceText(scoreText, { peak: 1.18, back: 1.06, up: 0.10, down: 0.24 });
  gsap.to(proxy, {
    v: to, duration: duration || 0.5, ease: 'power2.out',
    onUpdate: () => { const val = Math.round(proxy.v); setScore(val); try { updateHUD?.({ score: val }); } catch {} },
    onComplete: () => { __scoreTweening = false; }
  });
}

/* --- Board animation helper (same feel as score) --- */
export function animateBoard({ boardRef, setBoard, updateHUD, gsap }, toValue, duration = 0.5) {
  const from = ((+boardRef() || 0) | 0);
  const to   = ((+toValue   || 0) | 0);
  if (to === from) { setBoard(to); updateHUD?.({ board: to }); return; }
  const proxy = { v: from };
  // small pop at start
  bounceText(boardText, { peak: 1.18, back: 1.06, up: 0.10, down: 0.24 });
  gsap.to(proxy, {
    v: to, duration: duration || 0.5, ease: 'power2.out',
    onUpdate: () => { const val = Math.round(proxy.v); setBoard(val); try { updateHUD?.({ board: val }); } catch {} },
  });
}

// HUD drop animation - elastic bounce from top of screen
export function animateHUDDrop() {
  if (!unifiedHudContainer) {
    console.warn('⚠️ Unified HUD container not found for drop animation');
    return;
  }
  
  console.log('🎯 Starting unified HUD drop animation');
  
  // Animate the unified container drop
  animateUnifiedHudDrop();
  
  // Also animate PIXI HUD for compatibility
  if (HUD_ROOT) {
    const originalY = HUD_ROOT.y;
    HUD_ROOT.y = -200;
    HUD_ROOT.alpha = 0;
    
    gsap.timeline()
      .to(HUD_ROOT, { 
        alpha: 1, 
        duration: 0.2, 
        ease: 'power2.out' 
      })
      .to(HUD_ROOT, { 
        y: originalY, 
        duration: 0.8, 
        ease: 'elastic.out(1, 0.6)' 
      }, 0.1);
  }
  
  console.log('✅ Unified HUD drop animation started');
}
