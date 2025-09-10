// public/src/modules/hud-helpers.js
import { Container, Graphics, Text, Rectangle } from 'pixi.js';
import { gsap } from 'gsap';
import { pauseGame, resumeGame, restart } from './app.js';
import { showPauseModal } from './pause-modal.js';
import { HUD_H, COLS, ROWS, TILE, GAP } from './constants.js';

// Local boardSize function (same as in app.js)
function boardSize(){ return { w: COLS*TILE + (COLS-1)*GAP, h: ROWS*TILE + (ROWS-1)*GAP }; }

/* ---------------- Wild loader core (flicker-free, 8px) ---------------- */
function makeWildLoader({ width, color = 0xD59477, trackColor = 0xEADFD6 }) {
  const view = new Container();
  view.label = 'wild-loader';

  const H = 8;                         // fiksna visina
  const R = H / 2;

  // track
  const track = new Graphics();
  track.roundRect(0, 0, width, H, R).fill(trackColor);
  view.addChild(track);

  // fill
  const fill = new Graphics();
  fill.roundRect(0, 0, width, H, R).fill(color);
  view.addChild(fill);

  // mask – ravni gornji rub (bez sine vala), poravnan na piksel
  const mask = new Graphics();
  view.addChild(mask);
  fill.mask = mask;

  let progress = 0;
  let running = false;
  let barWidth = width;
  let headX = 0; // current head position in local coords

  const redrawMask = () => {
    const w = Math.max(0, Math.min(barWidth, Math.round(barWidth * progress)));
    headX = w;
    view._headX = headX; // expose for debug/extern if needed
    mask.clear();
    // Blagi “nudge” −0.5 px uklanja optičku crticu na gornjoj ivici
    mask.roundRect(0, -0.5, w, H + 1, R).fill(0xffffff);
  };

  const tick = (dt) => { 
    if (!running) return;
    redrawMask(); 
  };

  const api = {
    view,
    setWidth: (w) => {
      barWidth = Math.max(24, Math.round(w));
      track.clear().roundRect(0, 0, barWidth, H, R).fill(trackColor);
      fill.clear().roundRect(0, 0, barWidth, H, R).fill(color);
      redrawMask();
    },
    setProgress: (t, animate = false) => { 
      const newProgress = Math.max(0, Math.min(1, t || 0)); 
      const was = progress; 

      if (newProgress > was) {
        // shake fill on start of fill
        try {
          gsap.fromTo(fill, { x: fill.x - 2 }, { x: fill.x, duration: 0.2, ease: "elastic.out(1, 0.6)" });
        } catch (e) {}
      }

      if (!animate) {
        progress = newProgress; redrawMask(); return;
      }
      const o = { p: progress };
      gsap.to(o, {
        p: newProgress, duration: 1.60, ease: 'elastic.out(1, 0.72)', // sporiji, zaigraniji elastic
        onUpdate: () => { progress = o.p; redrawMask(); }
      });
    },
    charge: () => {}, // noop since bubbles removed
    start: () => { if (running) return; running = true; gsap.ticker.add(tick); },
    stop:  () => { if (!running) return; running = false; gsap.ticker.remove(tick); },
  };

  redrawMask();
  return api;
}

/* ---------------- Public helper for old callers ---------------- */
export function createWildLoaderFX({ width = 100, parent = null } = {}) {
  const fx = makeWildLoader({ width });
  if (parent) parent.addChild(fx.view);
  // kompaktna kompatibilnost s prijašnjim API-jem
  return {
    container: fx.view,  
    spawnBubble: () => {},
    redrawMask: () => fx.setProgress, // noop kompat
    ...fx,
  };
}

/* ---------------- Minimal HUD the app.js expects ---------------- */
let HUD_ROOT = null;
let movesText, scoreText, comboText; 
let comboWrap; // wrapper for jitter
let wild;
let __comboJitterTl = null;
let __comboBumpTl = null;
let __shakeTl = null;        // drives shake amplitude during bump/deflate
let __lastComboVal = 0;
let __shakeMul = 1.0;        // global multiplier sampled by jitter
let __scoreTweening = false;
let __movesTweening = false;
let __prevScore = 0;
let __prevMoves = 0;

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
  
  // Force HUD to be positioned below notch on mobile devices
  const isMobile = vw < 768 || vh > vw;
  if (isMobile) {
    // On mobile, position HUD below the notch/safe area - 20px higher (converted to percentage)
    const cssVars = getComputedStyle(document.documentElement);
    const SAT = parseFloat(cssVars.getPropertyValue('--sat')) || 0;
    const baseTop = Math.max(44, SAT + 8); // Minimum 44px below notch, or 8px below safe area
    // Add 20px higher, converted to percentage
    const additionalPixels = 20;
    const percentageAdjustment = additionalPixels / baseTop; // Convert 20px to percentage
    top = Math.round(baseTop * (1 - percentageAdjustment)); // Move up by calculated percentage
    console.log('📱 Mobile device detected - HUD positioned 20px higher at:', top, 'px (base:', baseTop, 'px, adjustment:', (percentageAdjustment * 100).toFixed(1) + '%, SAT:', SAT, 'px)');
  } else {
    // On desktop, use the calculated top position
    console.log('🖥️ Desktop device - using calculated top position:', top);
  }

  const SIDE = 24;            // bočni odmak
  const yLabel = top + 0;     // red s labelima
  const yValue = top + 20;    // red s vrijednostima
  const valueRowH = Math.max(movesText.height, scoreText.height, comboText.height);
  const barGap    = Math.round(vh * 0.02); // 2% gap below the numbers
  const barY      = yValue + valueRowH + barGap; 

  // labeli
  // (renderamo ih jednom; pozicioniranje brojeva ispod)
  if (!HUD_ROOT._labels) {
    const lblStyle = { fontFamily: 'LTCrow', fontSize: 16, fill: 0x735C4C, fontWeight: '700' };
    const m = new Text({ text: 'Moves', style: lblStyle });
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

  // poravnanja — Moves lijevo (broj), Score sredina, Combo desno
  // center values under their labels (using anchors)
  movesText.x = leftCenter;
  scoreText.x = midCenter;
  if (comboWrap){ comboWrap.x = rightCenter; comboWrap.y = yValue; }
  // keep text at origin within wrapper
  comboText.x = 0; comboText.y = 0;
  movesText.y = yValue; scoreText.y = yValue;

  const barW = Math.max(120, vw - SIDE * 2);
  wild.view.x = SIDE;
  wild.view.y = barY;
  wild.setWidth(barW);
  
  // Ensure HUD is properly positioned
  if (HUD_ROOT) {
    HUD_ROOT.zIndex = 10_000;
    HUD_ROOT.sortableChildren = true;
    HUD_ROOT.y = top; // Update HUD_ROOT position to match elements
    console.log('🎯 HUD_ROOT.y updated to:', HUD_ROOT.y, 'top:', top);
    
    // Verify HUD is above board
    if (HUD_ROOT.y < 0) {
      console.warn('⚠️ HUD is positioned above screen!', HUD_ROOT.y);
    }
  } else {
    console.warn('⚠️ HUD_ROOT not found in layout function!');
  }
}

export function initHUD({ stage, app, top = 8 }) { 
  // očisti stari root ako postoji i skini stari resize listener
  try { if (HUD_ROOT && HUD_ROOT._onResize) window.removeEventListener('resize', HUD_ROOT._onResize); } catch {}
  // očisti stari root ako postoji
  try { if (HUD_ROOT && HUD_ROOT.parent) HUD_ROOT.parent.removeChild(HUD_ROOT); } catch {}
  HUD_ROOT = new Container();
  HUD_ROOT.label = 'HUD_ROOT';
  HUD_ROOT.zIndex = 10_000;
  HUD_ROOT.sortableChildren = true;
  stage.addChild(HUD_ROOT);

  // vrijednosti
  const valMoves = { fontFamily: 'LTCrow', fontSize: 24, fill: 0xAD8775, fontWeight: '700' };
  const valMain  = { fontFamily: 'LTCrow', fontSize: 24, fill: 0xAD8775, fontWeight: '700' };
  const valCombo = { fontFamily: 'LTCrow', fontSize: 24, fill: 0xD69478, fontWeight: '700' };

  movesText = new Text({ text: '0', style: valMoves });
  scoreText = new Text({ text: '0', style: valMain  });
  comboText = new Text({ text: 'x0', style: valCombo });

  movesText.anchor.set(0.5, 0);
  scoreText.anchor.set(0.5, 0);
  comboText.anchor.set(0.5, 0);

  // add texts; wrap combo for independent jitter
  comboWrap = new Container();
  comboWrap.addChild(comboText);
  HUD_ROOT.addChild(movesText, scoreText, comboWrap);
  // ensure combo is drawn above wild bar if overlapping
  try { movesText.zIndex = 10; scoreText.zIndex = 10; comboWrap.zIndex = 100; } catch {}

  // wild bar
  wild = makeWildLoader({ width: 200 });
  HUD_ROOT.addChild(wild.view);
  try { wild.view.zIndex = 0; } catch {}
  wild.start();

  // inicijalni layout + resize listener
  layout({ app, top });
  const onResize = () => layout({ app, top });
  HUD_ROOT._onResize = onResize;
  window.addEventListener('resize', onResize);

  // Gentle elastic HUD drop-in animation
  if (!HUD_ROOT._animated) {
    HUD_ROOT.alpha = 0;
    HUD_ROOT.y = top - 80; // Start above screen
    gsap.to(HUD_ROOT, {
      alpha: 1,
      y: top,
      duration: 0.8,
      ease: 'elastic.out(1, 0.6)',
      onComplete: () => {
        HUD_ROOT._animated = true;
        HUD_ROOT.y = top;
      }
    });
  } else {
    // Already animated, just set final position
    HUD_ROOT.alpha = 1;
    HUD_ROOT.y = top;
  }

  // Add pause modal on HUD click - only HUD area (moves, score, combo, wild preloader)
  HUD_ROOT.interactive = true;
  HUD_ROOT.cursor = 'pointer';
  // HUD clickable area covers moves, score, combo, and wild preloader (approximately 80px height)
  HUD_ROOT.hitArea = new Rectangle(0, 0, 1000, 80); // Clickable area covers entire HUD area
  HUD_ROOT.on('pointerdown', (e) => {
    console.log('HUD clicked!', e);
    e.stopPropagation();
    
    console.log('Calling pauseGame...');
    pauseGame();
    console.log('Calling showPauseModal...');
    showPauseModal({
      onUnpause: async () => { 
        console.log('🎭 onUnpause called');
        try { resumeGame(); } catch {} 
      },
      onRestart: async () => { 
        console.log('🎭 onRestart called');
        try { 
          restart(); 
          // Layout will be called automatically by restartGame() in app.js
          console.log('🎭 Restart completed - layout will be called by restartGame()');
          resumeGame(); 
        } catch (error) {
          console.error('🎭 Error during restart:', error);
        }
      },
      onExit: async () => {
        console.log('🎭 EXIT TO MENU - SIMPLE APPROACH');

        try {
          // Use simple global exit function
          if (window.exitToMenu) {
            window.exitToMenu();
            console.log('✅ Exit to menu completed');
            return true;
          } else {
            console.error('❌ window.exitToMenu not found!');
            return false;
          }
          
        } catch (error) {
          console.error('❌ Error in onExit:', error);
          return false;
        }
      }
    });
  });
}

export function updateHUD({ score, moves, combo }) {
  if (!HUD_ROOT) return;
  if (typeof moves === 'number') {
    const mv = moves|0;
    if (movesText && String(mv) !== movesText.text) {
      movesText.text = String(mv);
      if (!__movesTweening) bounceText(movesText, { peak: 1.32, back: 1.10, up: 0.10, down: 0.24 });
      __prevMoves = mv;
    }
  }
  if (typeof score === 'number') {
    const sc = score|0;
    if (scoreText && String(sc) !== scoreText.text) {
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
export function setMoves(v){ if (movesText) movesText.text = String(v|0); }
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
export function bumpCombo(){
  if (!comboText) return;
  startComboFX();
  // Stop current deflate but continue from current scale for smoothness
  try { __comboBumpTl?.kill?.(); } catch {}
  try { __shakeTl?.kill?.(); } catch {}
  const sx = comboText.scale?.x || 1;
  const sy = comboText.scale?.y || 1;
  const cur = Math.max(sx, sy);
  const PEAK = 2.76;               // target peak
  const upDur = Math.max(0.08, 0.14 - (cur - 1) * 0.05); // a bit faster if already large
  __comboBumpTl = gsap.timeline();
  __comboBumpTl
    // inflate quickly to peak
    .to(comboText.scale, { x: PEAK, y: PEAK, duration: upDur, ease: 'back.out(3)' }, 0)
    // one continuous deflate back to 1.0 (smooth, no hard steps)
    .to(comboText.scale, { x: 1.0, y: 1.0, duration: 1.80, ease: 'power2.out' }, '>-0.01');

  // Boost shake while inflating, then gradually relax during deflate
  const sh = { k: __shakeMul };
  __shakeTl = gsap.timeline({ onUpdate: () => { __shakeMul = sh.k; } });
  __shakeTl
    .to(sh, { k: 2.4, duration: upDur * 0.9, ease: 'power2.out' }, 0)
    .to(sh, { k: 1.4, duration: 0.90, ease: 'sine.out' }, '>-0.02')
    .to(sh, { k: 1.1, duration: 0.90, ease: 'sine.out' }, '>');
}

/* bridge for app.js → update progress bar */
export function updateProgressBar(ratio, animate = false){
  if (!wild) return;
  // pri povećanju progressa digni "energiju" pa će kratko prštati
  const prev = wild._lastP ?? 0;
  if (ratio > prev) wild.charge(0.8);
  wild._lastP = ratio;
  wild.setProgress(ratio, animate);
}

/* Reset wild loader to 0 */
export function resetWildLoader(){
  console.log('🔄 resetWildLoader called, wild exists:', !!wild);
  if (!wild) {
    console.log('⚠️ Wild loader not found, cannot reset');
    return;
  }
  console.log('🔄 Resetting wild loader from', wild._lastP, 'to 0');
  wild._lastP = 0;
  wild.setProgress(0, false); // Reset immediately without animation
  console.log('✅ Wild loader reset to 0');
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

/* --- Moves animation helper (same feel as score) --- */
export function animateMoves({ movesRef, setMoves, updateHUD, gsap }, toValue, duration = 0.5) {
  const from = ((+movesRef() || 0) | 0);
  const to   = ((+toValue   || 0) | 0);
  if (to === from) { setMoves(to); updateHUD?.({ moves: to }); return; }
  const proxy = { v: from };
  // small pop at start
  bounceText(movesText, { peak: 1.18, back: 1.06, up: 0.10, down: 0.24 });
  gsap.to(proxy, {
    v: to, duration: duration || 0.5, ease: 'power2.out',
    onUpdate: () => { const val = Math.round(proxy.v); setMoves(val); try { updateHUD?.({ moves: val }); } catch {} },
  });
}
