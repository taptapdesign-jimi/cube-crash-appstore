// public/src/modules/hud-helpers.js
import { Container, Graphics, Text } from 'pixi.js';
import { gsap } from 'gsap';

/* ---------------- Wild loader core (flicker-free, 8px) ---------------- */
function makeWildLoader({ width, color = 0xD59477, trackColor = 0xEADFD6 }) {
  const view = new Container();
  view.name = 'wild-loader';

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
let wild;

function layout({ app, top }) { 
  if (!HUD_ROOT) return;
  const vw = app.renderer.width;
  const vh = app.renderer.height;

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
  comboText.x = rightCenter;
  movesText.y = scoreText.y = comboText.y = yValue;

  const barW = Math.max(120, vw - SIDE * 2);
  wild.view.x = SIDE;
  wild.view.y = barY;
  wild.setWidth(barW);
}

export function initHUD({ stage, app, top = 8 }) { 
  // očisti stari root ako postoji i skini stari resize listener
  try { if (HUD_ROOT && HUD_ROOT._onResize) window.removeEventListener('resize', HUD_ROOT._onResize); } catch {}
  // očisti stari root ako postoji
  try { if (HUD_ROOT && HUD_ROOT.parent) HUD_ROOT.parent.removeChild(HUD_ROOT); } catch {}
  HUD_ROOT = new Container();
  HUD_ROOT.name = 'HUD_ROOT';
  HUD_ROOT.zIndex = 10_000;
  stage.addChild(HUD_ROOT);

  // vrijednosti
  const valMoves = { fontFamily: 'LTCrow', fontSize: 24, fill: 0xD69478, fontWeight: '700' };
  const valMain  = { fontFamily: 'LTCrow', fontSize: 24, fill: 0xAD8775, fontWeight: '700' };

  movesText = new Text({ text: '0', style: valMoves });
  scoreText = new Text({ text: '0', style: valMain  });
  comboText = new Text({ text: 'x0', style: valMain });

  movesText.anchor.set(0.5, 0);
  scoreText.anchor.set(0.5, 0);
  comboText.anchor.set(0.5, 0);

  HUD_ROOT.addChild(movesText, scoreText, comboText);

  // wild bar
  wild = makeWildLoader({ width: 200 });
  HUD_ROOT.addChild(wild.view);
  wild.start();

  // inicijalni layout + resize listener
  layout({ app, top });
  const onResize = () => layout({ app, top });
  HUD_ROOT._onResize = onResize;
  window.addEventListener('resize', onResize);
}

export function updateHUD({ score, moves, combo }) {
  if (!HUD_ROOT) return;
  if (typeof moves === 'number') movesText.text = String(moves);
  if (typeof score === 'number') scoreText.text = String(score);
  if (typeof combo === 'number') comboText.text = `x${combo|0}`;
}

export function setScore(v){ if (scoreText) scoreText.text = String(v|0); }
export function setMoves(v){ if (movesText) movesText.text = String(v|0); }
export function setCombo(v){ if (comboText) comboText.text = `x${v|0}`; }
export function resetCombo(){ if (comboText) comboText.text = 'x0'; }
export function bumpCombo(){
  if (!comboText) return;
  gsap.fromTo(comboText.scale, { x: 1.0, y: 1.0 }, { x: 1.12, y: 1.12, duration: 0.10, ease: 'power2.out', yoyo: true, repeat: 1 });
}

/* bridge for app.js → update progress bar */
export function updateProgressBar(ratio, animate = false){
  if (!wild) return;
  // pri povećanju progressa digni “energiju” pa će kratko prštati
  const prev = wild._lastP ?? 0;
  if (ratio > prev) wild.charge(0.8);
  wild._lastP = ratio;
  wild.setProgress(ratio, animate);
}

/* --- Score animation helper (compat) --- */
export function animateScore({ scoreRef, setScore, updateHUD, SCORE_CAP, gsap }, toValue, duration = 0.4) {
  const from = Math.min(SCORE_CAP, (+scoreRef() || 0) | 0);
  const to   = Math.min(SCORE_CAP, (+toValue   || 0) | 0);
  if (to === from) { setScore(to); updateHUD?.(); return; }
  const proxy = { v: from };
  gsap.to(proxy, {
    v: to, duration: duration || 0.4, ease: 'power1.out',
    onUpdate: () => { const val = Math.round(proxy.v); setScore(val); try { updateHUD?.(); } catch {} }
  });
}
