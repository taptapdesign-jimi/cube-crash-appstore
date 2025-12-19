// public/src/modules/hud-helpers.js
import { Container, Graphics, Text, Rectangle, Sprite, Assets } from 'pixi.js';
import { gsap } from 'gsap';
import { pauseGame, resumeGame, restart } from './app-core.js';
// import { showPauseModal } from './pause-modal.js'; // Replaced with menu screen
import { HUD_H, COLS, ROWS, TILE, GAP } from './constants.js';
import uiManager from './ui-manager.js';
import { smokeBubblesAtTile } from './fx.js';

let graphicsPool = null;
let __globalGraphicsObjects = null;

// Lazy load graphics pool to avoid circular dependency
function getGraphicsPool() {
  if (!graphicsPool) {
    // Fallback: create simple pool (object-pool.js might not be available)
    graphicsPool = {
      acquire: () => new Graphics(),
      release: () => {}
    };
    __globalGraphicsObjects = new Set();
    
    // Try to load object pool dynamically (if available)
    try {
      import('./object-pool.js').then((poolModule) => {
        if (poolModule && poolModule.graphicsPool) {
          graphicsPool = poolModule.graphicsPool;
          __globalGraphicsObjects = poolModule.__globalGraphicsObjects || new Set();
          console.log('✅ Graphics pool loaded from object-pool.js');
        }
      }).catch(() => {
        // Silently fail - use fallback pool
      });
    } catch (e) {
      // Silently fail - use fallback pool
    }
  }
  return graphicsPool;
}

// Local boardSize function (same as in app.js)
function boardSize(){ return { w: COLS*TILE + (COLS-1)*GAP, h: ROWS*TILE + (ROWS-1)*GAP }; }

// Old makeWildLoader function removed - using new PIXI implementation below

/* ---------------- Minimal HUD the app.js expects ---------------- */
let HUD_ROOT = null;
let boardText, scoreText, comboText, starText;
let comboXText = null; // "x" text reference for combo (14px)
let closeIconSprite = null; // Close icon sprite (replaces boardText)
let comboWrap; // wrapper for jitter
let wild;
let hudCloseButton = null;
let boardIndicator = null;
let boardIndicatorLabel = null;
let comboWobbleTween = null; // GSAP tween for combo icon wobble animation

// 🔥 CLEANUP: Function to kill all combo animations and prevent memory leaks
export function cleanupComboAnimations() {
  console.log('🧹 Cleaning up all combo animations...');
  
  try {
    // 1. Kill wobble animation
    if (comboWobbleTween) {
      try {
        comboWobbleTween.kill();
        comboWobbleTween = null;
      } catch (e) {
        console.warn('⚠️ Error killing comboWobbleTween:', e);
      }
    }
    
    // 2. Kill morph timeline on combo icon sprite
    if (HUD_ROOT && HUD_ROOT._hudElements && HUD_ROOT._hudElements.combo) {
      const combo = HUD_ROOT._hudElements.combo;
      const iconSprite = combo.iconSprite;
      
      if (iconSprite && !iconSprite.destroyed) {
        // Kill morph timeline
        if (iconSprite._morphTimeline) {
          try {
            iconSprite._morphTimeline.kill();
            iconSprite._morphTimeline.clear?.();
            iconSprite._morphTimeline = null;
          } catch (e) {
            console.warn('⚠️ Error killing morphTimeline:', e);
          }
        }
        
        // Kill all GSAP tweens on icon sprite
        try {
          gsap.killTweensOf(iconSprite);
          gsap.killTweensOf(iconSprite.scale);
          gsap.killTweensOf(iconSprite.rotation);
          gsap.killTweensOf(iconSprite.alpha);
        } catch (e) {
          console.warn('⚠️ Error killing tweens on iconSprite:', e);
        }
        
        // Reset rotation
        iconSprite.rotation = 0;
      }
    }
    
    // 3. Kill jitter timeline
    if (__comboJitterTl) {
      try {
        __comboJitterTl.kill();
        __comboJitterTl.clear?.();
        __comboJitterTl = null;
      } catch (e) {
        console.warn('⚠️ Error killing __comboJitterTl:', e);
      }
    }
    
    // 4. Kill bump timeline
    if (__comboBumpTl) {
      try {
        __comboBumpTl.kill();
        __comboBumpTl.clear?.();
        __comboBumpTl = null;
      } catch (e) {
        console.warn('⚠️ Error killing __comboBumpTl:', e);
      }
    }
    
    // 5. Kill shake timeline
    if (__shakeTl) {
      try {
        __shakeTl.kill();
        __shakeTl.clear?.();
        __shakeTl = null;
      } catch (e) {
        console.warn('⚠️ Error killing __shakeTl:', e);
      }
    }
    
    // 6. Kill all tweens on combo text and wrap
    if (comboText) {
      try {
        gsap.killTweensOf(comboText);
        gsap.killTweensOf(comboText.scale);
        gsap.killTweensOf(comboText.rotation);
      } catch (e) {
        console.warn('⚠️ Error killing tweens on comboText:', e);
      }
    }
    
    if (comboWrap) {
      try {
        gsap.killTweensOf(comboWrap);
        gsap.killTweensOf(comboWrap.scale);
        gsap.killTweensOf(comboWrap.rotation);
      } catch (e) {
        console.warn('⚠️ Error killing tweens on comboWrap:', e);
      }
    }
    
    // 7. Reset shake multiplier
    __shakeMul = 1.0;
    
    console.log('✅ All combo animations cleaned up');
  } catch (err) {
    console.error('❌ Error during combo animations cleanup:', err);
  }
}
const BOARD_INDICATOR_ANIM_OFFSET = 72;
const BOARD_INDICATOR_BOTTOM = 24;

function ensureBoardIndicator() {
  if (boardIndicator && document.body.contains(boardIndicator)) {
    return boardIndicator;
  }
  
  const container = document.createElement('div');
  container.id = 'hud-board-indicator';
  container.style.cssText = `
    position: fixed;
    bottom: ${BOARD_INDICATOR_BOTTOM}px;
    left: 50%;
    margin-left: -160px;
    width: 320px;
    height: 32px;
    display: flex;
    align-items: center;
    gap: 24px;
    z-index: 2500;
    pointer-events: none;
    font-family: 'LTCrow', 'Arial', sans-serif;
    transform: translateY(0);
    opacity: 1;
  `;
  
  const createLine = () => {
    const line = document.createElement('div');
    line.style.cssText = `
      flex: 1;
      height: 2px;
      background: #EDE0D5;
      border-radius: 999px;
    `;
    return line;
  };
  
  const label = document.createElement('div');
  label.id = 'hud-board-indicator-label';
  label.textContent = 'Board #1';
  label.style.cssText = `
    min-width: 135px;
    padding: 4px 12px;
    border-radius: 24px;
    background: transparent;
    border: 1px solid #E8D3C8;
    color: #AD8775;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-align: center;
    text-transform: none;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const leftLine = createLine();
  const rightLine = createLine();
  leftLine.style.zIndex = '1';
  rightLine.style.zIndex = '1';
  label.style.zIndex = '2';
  label.style.position = 'relative';
  
  container.appendChild(leftLine);
  container.appendChild(label);
  container.appendChild(rightLine);
  
  document.body.appendChild(container);
  gsap.set(container, { y: BOARD_INDICATOR_ANIM_OFFSET, opacity: 0 });
  container.setAttribute('data-state', 'hidden');
  boardIndicator = container;
  boardIndicatorLabel = label;
  return container;
}

function handleHUDClose() {
  try {
    uiManager.showHomepageWithAnimation();
  } catch (error) {
    console.warn('⚠️ HUD close animation failed, falling back to standard homepage', error);
    try {
      uiManager.showHomepage();
    } catch (fallbackError) {
      console.warn('⚠️ HUD close fallback failed:', fallbackError);
    }
  }
}

function applyCloseButtonStyles(button, useFixedPosition) {
  button.style.cssText = `
    position: ${useFixedPosition ? 'fixed' : 'absolute'};
    top: 28px;
    left: 24px;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    z-index: ${useFixedPosition ? 4000 : 10};
  `;
}

function ensureHUDCloseButton(parent = null) {
  const targetParent = parent || document.querySelector('[data-unified-hud]') || document.body;
  const useFixedPosition = !parent;
  
  if (!hudCloseButton) {
    const button = document.createElement('button');
    button.id = 'hud-close-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Close');
    applyCloseButtonStyles(button, useFixedPosition);
    
    button.addEventListener('click', () => handleHUDClose());
    button.addEventListener('pointerdown', () => {
      button.style.transform = 'scale(0.92)';
    });
    const resetScale = () => {
      button.style.transform = 'scale(1)';
    };
    button.addEventListener('pointerup', resetScale);
    button.addEventListener('pointerleave', resetScale);
    
    const icon = document.createElement('img');
    icon.src = './assets/close-icon.png';
    icon.srcset = './assets/close-icon.png 1x, ./assets/close-icon@2x.png 2x, ./assets/close-icon@3x.png 3x';
    icon.alt = 'Close';
    icon.style.cssText = `
      width: 32px;
      height: 32px;
      object-fit: contain;
      pointer-events: none;
    `;
    button.appendChild(icon);
    
    hudCloseButton = button;
  } else {
    applyCloseButtonStyles(hudCloseButton, useFixedPosition);
  }
  
  if (targetParent && hudCloseButton.parentElement !== targetParent) {
    targetParent.appendChild(hudCloseButton);
  }
  
  return hudCloseButton;
}

function updateBoardIndicatorValue(boardNumber) {
  if (!boardIndicatorLabel) {
    ensureBoardIndicator();
  }
  if (boardIndicatorLabel) {
    boardIndicatorLabel.textContent = `Board #${boardNumber}`;
  }
}

function animateBoardIndicatorEnter(duration = 0.8) {
  const indicator = ensureBoardIndicator();
  try { gsap.killTweensOf(indicator); } catch {}
  // CRITICAL: Make sure element is visible before animating
  if (indicator) {
    indicator.style.display = 'flex'; // Restore display (was set to 'none' on exit)
    indicator.setAttribute('data-state', 'entering');
  }
  gsap.set(indicator, { y: BOARD_INDICATOR_ANIM_OFFSET, opacity: 0 });
  gsap.to(indicator, {
    y: 0,
    opacity: 1,
    duration,
    ease: 'elastic.out(1, 0.6)',
    onComplete: () => {
      if (indicator) {
        indicator.setAttribute('data-state', 'visible');
      }
    }
  });
}

export function animateBoardIndicatorExit(duration = 0.3) {
  if (!boardIndicator || !document.body.contains(boardIndicator)) return;
  try { gsap.killTweensOf(boardIndicator); } catch {}
  // Use fixed 0.3s duration to match HUD exit speed, or use provided duration if it's faster
  const exitDuration = Math.min(0.3, duration || 0.3);
  gsap.to(boardIndicator, {
    y: BOARD_INDICATOR_ANIM_OFFSET,
    opacity: 0,
    duration: exitDuration,
    ease: 'power2.in',
    onComplete: () => {
      if (boardIndicator) {
        boardIndicator.setAttribute('data-state', 'hidden');
        // Hide element completely after animation
        boardIndicator.style.display = 'none';
      }
    }
  });
}

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
  
  ensureHUDCloseButton(unifiedHudContainer);
  ensureBoardIndicator();
  
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
  bg.drawRoundedRect(0, 0, 200, 10, 5); // Height: 10px, border radius: 5px
  bg.endFill();
  bg.zIndex = 0;
  
  // Decorative dashed line 2px above wild bar
  const dashLine = new Graphics();
  const drawDashLine = (width = 200) => {
    dashLine.clear();
    const dashLength = 6;
    const gapLength = 4;
    let currentX = 0;
    const lineY = -4;
    while (currentX < width) {
      dashLine.moveTo(currentX, lineY);
      const nextX = Math.min(currentX + dashLength, width);
      dashLine.lineTo(nextX, lineY);
      currentX = nextX + gapLength;
    }
    dashLine.stroke({
      color: 0xEAD7CD,
      width: 1,
      alignment: 0.5,
      cap: 'round'
    });
  };
  drawDashLine();
  dashLine.visible = false; // temporarily hide dashed line; retain for future styling tweaks
  dashLine.zIndex = 10_000;
  container.sortableChildren = true;
  
  // Progress fill - start with 0 width
  const fill = new Graphics();
  fill.beginFill(0xE7744A); // Orange
  fill.drawRoundedRect(0, 0, 0, 10, 5); // Height: 10px, border radius: 5px
  fill.endFill();
  fill.zIndex = 5000;
  
  container.addChild(bg, fill, dashLine);
  
  // Position relative to HUD
  container.x = 24;
  container.y = 52; // Below HUD values (moved up 8px from 60)
  container.zIndex = 1000; // Below PIXI HUD
  
  // Store references
  container._bg = bg;
  container._fill = fill;
  container._dashLine = dashLine;
  container._drawDashLine = drawDashLine;
  container._maxWidth = 200;
  
  // Methods
  container.setProgress = (ratio, animate = false) => {
    // CRITICAL: Check if _fill exists before using it
    if (!container._fill) {
      console.error('❌ HUD: container._fill is null! Cannot update progress.');
      return;
    }
    
    const progress = Math.max(0, Math.min(1, ratio));
    const width = progress * container._maxWidth;
    
    console.log('🎯 PIXI Wild meter progress:', Math.round(progress * 100) + '%', 'width:', width);
    
    // Kill previous animation and smoke interval first
    if (container._currentAnimation) {
      container._currentAnimation.kill();
      container._currentAnimation = null;
      console.log('🎯 PIXI Wild meter: Previous animation killed');
    }
    if (container._smokeInterval) {
      clearInterval(container._smokeInterval);
      container._smokeInterval = null;
    }
    
    if (animate) {
      // Use GSAP to animate the width by redrawing the fill
      const startWidth = container._fill.width || 0;
      
      // Start smoke effect during animation
      container._smokeInterval = setInterval(() => {
        if (!container || !container.parent) return;
        
        // Spawn smoke directly on the HUD stage (not board)
        const hudStage = container.parent;
        if (!hudStage) return;
        
        // Get global position of the fill's right edge
        const globalX = container.x + (container._fill.width || 0);
        const globalY = container.y + 5; // Middle of the bar (10px height / 2)
        
        // Create anonymous Graphics for smoke
        const smokeBubble = new Graphics();
        
        // Only orange smoke bubbles
        const color = 0xF86B3C;
        const alpha = 0.5; // Orange at 0.5 opacity
        
        // Increased by 100%: 3-6px radius (base 2-4px * 2)
        const radius = (2 + Math.random() * 2) * 2;
        
        smokeBubble.circle(0, 0, radius).fill({ color: color, alpha: alpha });
        
        // Position at the growing edge of the progress bar
        smokeBubble.x = globalX;
        smokeBubble.y = globalY;
        smokeBubble.zIndex = 2000; // Above the progress bar (which is z-index 1000)
        
        hudStage.addChild(smokeBubble);
        
        // Animate smoke: float up and fade out
        gsap.to(smokeBubble, {
          y: globalY - 15 - Math.random() * 10,
          x: globalX + (Math.random() - 0.5) * 10,
          alpha: 0,
          duration: 1.0 + Math.random() * 0.3, // 0.5s longer (was 0.5-0.8s, now 1.0-1.3s)
          ease: 'power1.out',
          onComplete: () => {
            if (smokeBubble && smokeBubble.parent) {
              smokeBubble.parent.removeChild(smokeBubble);
              smokeBubble.destroy();
            }
          }
        });
      }, 100); // Every 100ms during animation
      
      container._currentAnimation = gsap.to({ width: startWidth }, {
        width: width,
        duration: 0.4,
        ease: 'power2.out',
        onUpdate: function() {
          // Redraw fill with current width
          if (container._fill) {
            container._fill.clear();
            container._fill.beginFill(0xE7744A);
            container._fill.drawRoundedRect(0, 0, this.targets()[0].width, 10, 5); // Height: 10px, border radius: 5px
            container._fill.endFill();
          }
        },
        onComplete: () => {
          // Clear smoke interval when animation completes
          if (container._smokeInterval) {
            clearInterval(container._smokeInterval);
            container._smokeInterval = null;
          }
          container._currentAnimation = null;
          console.log('🎯 PIXI Animation complete - final width:', width);
        }
      });
      console.log('🎯 PIXI Wild meter: Animation started');
    } else {
      // Set width directly
      if (container._fill) {
        container._fill.clear();
        container._fill.beginFill(0xE7744A);
        container._fill.drawRoundedRect(0, 0, width, 10, 5); // Height: 10px, border radius: 5px
        container._fill.endFill();
        console.log('🎯 PIXI Wild meter set directly to width:', width);
      }
    }
  };
  
  container.setWidth = (width) => {
    // CRITICAL: Check if _bg and _fill exist before using them
    if (!container._bg || !container._fill) {
      console.error('❌ HUD: container._bg or _fill is null! Cannot set width.');
      return;
    }
    
    container._maxWidth = width;
    // Redraw background with new width
    container._bg.clear();
    container._bg.beginFill(0xEADFD6);
    container._bg.drawRoundedRect(0, 0, width, 10, 5); // Height: 10px, border radius: 5px
    container._bg.endFill();
    // Reset fill to 0 width
    container._fill.clear();
    container._fill.beginFill(0xE7744A);
    container._fill.drawRoundedRect(0, 0, 0, 10, 5); // Height: 10px, border radius: 5px
    container._fill.endFill();
    if (container._drawDashLine) {
      container._drawDashLine(width);
    }
  };
  
  return {
    view: container,
    setProgress: container.setProgress,
    setWidth: container.setWidth
  };
}

// wild is declared at line 17, no need to redeclare

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
  // 🔥 CLEANUP: Kill all combo animations before stopping
  cleanupComboAnimations();
  
  if (!comboText) return;
  // elastic bounce back to rest
  try {
    gsap.to(comboWrap || comboText, { rotation: 0, duration: 0.25, ease: 'power2.out' });
    // sporiji, nježniji decay natrag na 1.0
    gsap.to(comboWrap ? comboWrap.scale : comboText.scale, { x: 1, y: 1, duration: 0.40, ease: 'power2.out' });
    gsap.to(comboText.scale, { x: 1, y: 1, duration: 1.40, ease: 'elastic.out(1,0.9)' });
    // reset shake multiplier smoothly (but don't recreate if we just cleaned up)
    if (!__shakeTl) {
    const sh = { k: __shakeMul };
    __shakeTl = gsap.to(sh, { k: 1.0, duration: 0.60, ease: 'power2.out', onUpdate: () => { __shakeMul = sh.k; } });
    }
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
  // 🔥 NEW HUD: Hide all old labels (we now use icons)
  if (m) {
    m.visible = false;
    m.renderable = false;
  }
  if (s) {
    s.visible = false;
    s.renderable = false;
  }
  if (c) {
    c.visible = false;
    c.renderable = false;
  }

  // pozicioniranje labela
  const leftCenter  = SIDE + m.width / 2;   // center of the left column
  const midCenter   = Math.round(vw / 2);   // center column
  const rightCenter = Math.round(vw - SIDE - c.width / 2); // center of the right column

  m.x = leftCenter;
  s.x = midCenter;
  c.x = rightCenter;
  m.y = s.y = c.y = yLabel;

  // 🔥 NEW HUD DESIGN: Fixed positions from right to left
  // Layout: Combo (24px from right edge) → Coin (64px left) → Star (64px left)
  // - Close icon: left (existing position)
  // - Combo: 24px from right edge (desni rub elementa)
  // - Coin: 64px lijevo od lijevog ruba Combo
  // - Star: 64px lijevo od lijevog ruba Coin
  
  const hudHeight = 36;
  const hudY = yValue + (valueRowH - hudHeight) / 2; // Center vertically in value row
  const comboToCoinSpacing = 80; // 80px spacing from combo icon to coin element
  const coinToStarSpacing = 64; // 64px spacing from coin icon to star element
  // 🔥 USER REQUEST: 24px padding from right edge (calculated as percentage of screen width)
  // For iPhone 13 (390px width): 24px = 6.15% of screen width
  // We'll use fixed 24px but calculate it relative to screen width for consistency
  const comboRightPadding = 24; // 24px from right edge (like journey hearts margin-right)
  
  // Position close icon (left, existing position) - aligned with other HUD elements
  boardText.x = leftCenter;
  boardText.y = yValue;
  if (closeIconSprite) {
    closeIconSprite.x = leftCenter;
    closeIconSprite.y = yValue; // Aligned with other HUD elements (moved up 2px from previous position)
    closeIconSprite.visible = true;
  }
  
  // Position new HUD elements from right to left with fixed positions
  if (HUD_ROOT._hudElements) {
    const { star, coin, combo } = HUD_ROOT._hudElements;
    
    // 🔥 USER REQUEST: 24px padding from right edge (like journey hearts)
    // Journey hearts use: margin-right: var(--pad-right, 24px) which accounts for safe-area-inset-right
    // We'll use the same approach: rightEdge = vw - 24px padding
    const rightEdge = vw - comboRightPadding; // 24px padding from right edge
    
    // 🔥 FIXED POSITIONS: All elements (Combo, Coin, Star) have fixed positions with same spacing
    // Positions are calculated from right edge, not based on text width (non-responsive)
    
    // Combo - 12px left of wild preloader right edge (perfect alignment with offset)
    if (comboWrap && combo && combo.container) {
      // 🔥 USER REQUEST: Position combo 12px left of wild preloader right edge
      // Wild preloader: x = 24px, width = vw - 48px, so right edge = 24 + (vw - 48) = vw - 24px
      // Combo should be 12px left of wild preloader right edge = vw - 24px - 12px = vw - 36px
      // Combo container anchor is at center, so we need to calculate actual total width
      const iconWidth = combo.iconSprite ? combo.iconSprite.width * combo.iconSprite.scale.x : 28;
      const xTextWidth = combo.xText ? combo.xText.width : 0;
      const numberTextWidth = combo.text ? combo.text.width : 0;
      const spacing = 4;
      const totalWidth = iconWidth + spacing + xTextWidth + numberTextWidth;
      
      // Wild preloader right edge: vw - 24px (SIDE = 24px, barW = vw - 48px, so right = 24 + (vw - 48) = vw - 24)
      const wildPreloaderRightEdge = vw - 24;
      // Combo right edge should be 12px left of wild preloader right edge
      const comboRightEdge = wildPreloaderRightEdge - 12; // vw - 36px
      
      // Position combo so its right edge is 8px left of wild preloader right edge
      // comboWrap.x is center, so: comboWrap.x + totalWidth/2 = comboRightEdge
      comboWrap.x = comboRightEdge - totalWidth / 2;
      comboWrap.y = yValue;
      
      console.log('🎯 Combo positioned 12px left of wild preloader:', { 
        wildRightEdge: wildPreloaderRightEdge, 
        comboRightEdge: comboRightEdge,
        comboCenter: comboWrap.x, 
        actualComboRightEdge: comboWrap.x + totalWidth / 2,
        totalWidth 
      });
    }
    
    // Coin - 80px left of Combo ICON (not center) - fixed position (same spacing as before)
    if (coin && coin.container) {
      // Calculate combo center position
      const estimatedComboWidth = 62;
      const comboCenterX = rightEdge - estimatedComboWidth / 2;
      
      // Combo icon is at: comboCenterX - (estimatedComboWidth / 2) + (iconWidth / 2)
      // Icon width is 28px, so icon left edge is at comboCenterX - estimatedComboWidth/2
      // Icon center is at comboCenterX - estimatedComboWidth/2 + 14 (half of 28px)
      const comboIconLeftEdge = comboCenterX - estimatedComboWidth / 2;
      
      // Coin center is 80px left of combo icon left edge
      // Since coin container anchor is at center, we need to position it correctly
      coin.container.x = comboIconLeftEdge - comboToCoinSpacing;
      coin.container.y = yValue;
    }
    
    // Star - 64px left of Coin ICON (not center) - fixed position (same spacing as before)
    if (star && star.container) {
      // Calculate combo and coin positions
      const estimatedComboWidth = 62;
      const comboCenterX = rightEdge - estimatedComboWidth / 2;
      const comboIconLeftEdge = comboCenterX - estimatedComboWidth / 2;
      const coinCenterX = comboIconLeftEdge - comboToCoinSpacing;
      
      // Coin icon left edge (coin icon is 28px, so left edge is coinCenterX - 14)
      const coinIconLeftEdge = coinCenterX - 14; // Half of 28px icon
      
      // Star center is 64px left of coin icon left edge, then 16px more to the left
      star.container.x = coinIconLeftEdge - coinToStarSpacing - 16;
      star.container.y = yValue;
    }
  } else {
    // Fallback to old positioning if new elements not created yet
  scoreText.x = midCenter;
  scoreText.y = yValue;
    if (comboWrap) {
      comboWrap.x = rightCenter;
      comboWrap.y = yValue;
    }
    comboText.x = 0;
    comboText.y = 0;
  }

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
    wild.view.y = yValue + valueRowH + barGap - 8; // Moved up 8px
    wild.setWidth(barW);
    
    console.log('🎯 PIXI Wild meter positioned:', { x: SIDE, y: wild.view.y, width: barW });
  }
  
  // 🔥 USER REQUEST: Position X button (top left corner) within HUD
  // Must be 24px from left edge of SCREEN (not HUD container)
  // SIMPLE SOLUTION: Use absolute screen coordinates, then convert to HUD-relative
  if (HUD_ROOT._xButton) {
    const xButton = HUD_ROOT._xButton;
    const screenLeftPadding = 24; // 24px from left edge of SCREEN
    const xTopPadding = 2; // Move down 2px from yValue
    
    // 🔥 CRITICAL FIX: Get actual HUD_ROOT position on screen
    const hudRootX = HUD_ROOT.x || 0;
    const hudRootY = HUD_ROOT.y || top;
    
    // Calculate X position: screen position - HUD_ROOT position = relative position
    // We want X button at screen x=24, so: xButton.x = 24 - HUD_ROOT.x
    xButton.x = screenLeftPadding - hudRootX;
    
    // Y position: yValue is local to HUD_ROOT (starts at 0), add padding
    xButton.y = yValue + xTopPadding;
    
    // 🔥 VERIFY: Calculate actual screen position
    const actualScreenX = hudRootX + xButton.x;
    const actualScreenY = hudRootY + xButton.y;
    
    console.log('🎯 X button positioned (24px from screen left):', { 
      xButtonX: xButton.x, 
      xButtonY: xButton.y,
      hudRootX: hudRootX,
      hudRootY: hudRootY,
      screenX: screenLeftPadding,
      actualScreenX: actualScreenX,
      actualScreenY: actualScreenY,
      yValue: yValue,
      expectedScreenX: 24,
      isCorrect: Math.abs(actualScreenX - 24) < 1 // Should be exactly 24px
    });
    
    // 🔥 WARNING: If position is wrong, log error
    if (Math.abs(actualScreenX - 24) >= 1) {
      console.error('❌ X button position is WRONG! Expected 24px from left, got:', actualScreenX);
    }
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
  // Store stage visibility for later restoration
  const stageWasVisible = stage?.visible ?? true;
  
  // očisti stari root ako postoji i skini stari resize listener
  try { if (HUD_ROOT && HUD_ROOT._onResize) window.removeEventListener('resize', HUD_ROOT._onResize); } catch {}
  // 🔥 CRITICAL: DESTROY old HUD_ROOT completely (MEMORY LEAK FIX)
  try { 
    if (HUD_ROOT && !HUD_ROOT.destroyed) {
      console.log('🧹 Destroying old HUD_ROOT with', HUD_ROOT.children?.length ?? 0, 'children');
      // 🔥 CRITICAL: Hide old HUD immediately to prevent 1-frame flash
      try { HUD_ROOT.alpha = 0; } catch {}
      try { HUD_ROOT.visible = false; } catch {}
      // Remove from parent first
      if (HUD_ROOT.parent) {
        try { HUD_ROOT.parent.removeChild(HUD_ROOT); } catch {}
      }
      // Kill any active tweens on HUD_ROOT
      try { gsap.killTweensOf(HUD_ROOT); } catch {}
      // Destroy HUD_ROOT and all its children (Graphics, Sprites, etc.)
      try { HUD_ROOT.destroy({ children: true, texture: false, textureSource: false }); } catch {}
      console.log('✅ Old HUD_ROOT destroyed');
    }
    // 🔥 CRITICAL: Always clear HUD_ROOT reference
    HUD_ROOT = null;
  } catch (error) {
    console.warn('⚠️ Failed to destroy old HUD_ROOT:', error);
    HUD_ROOT = null; // Clear reference anyway
  }
  // 🔥 CRITICAL: Clear smoke interval if it exists (MEMORY LEAK FIX)
  if (wild?.view?._smokeInterval) {
    console.log('🧹 Clearing wild meter smoke interval');
    clearInterval(wild.view._smokeInterval);
    wild.view._smokeInterval = null;
  }
  
  // 🔥 CRITICAL: Kill any active animations (MEMORY LEAK FIX)
  if (wild?.view?._currentAnimation) {
    console.log('🧹 Killing wild meter animation');
    wild.view._currentAnimation.kill();
    wild.view._currentAnimation = null;
  }
  
  // Clear references
  closeIconSprite = null;
  boardText = null;
  scoreText = null;
  comboText = null;
  comboWrap = null;
  wild = null;
  
  HUD_ROOT = new Container();
  HUD_ROOT.label = 'HUD_ROOT';
  HUD_ROOT.zIndex = 10_000;
  HUD_ROOT.sortableChildren = true;
  HUD_ROOT.visible = true; // 🔥 CRITICAL: Ensure HUD is visible
  
  // 🔥 CRITICAL: Apply initialHide IMMEDIATELY to prevent 1-frame "HUD residue" flash on entry
  // (iPhone often paints once before the later initialHide block runs)
  HUD_ROOT._dropTop = top;
  if (initialHide) {
    HUD_ROOT.alpha = 0;
    HUD_ROOT.y = top - 140;
    HUD_ROOT._dropped = false;
  } else {
    HUD_ROOT.alpha = 1;
    HUD_ROOT.y = top;
    HUD_ROOT._dropped = true;
  }
  
  // 🔥 CRITICAL FIX: Do NOT add HUD_ROOT to stage if initialHide is true!
  // This prevents ANY possibility of flash - HUD will be added in playHudDrop()
  if (initialHide) {
    // Store stage reference for later - will add to stage in playHudDrop()
    HUD_ROOT._stage = stage;
    HUD_ROOT._stageWasVisible = stageWasVisible;
    // Restore stage visibility NOW since HUD is not on stage yet
    stage.visible = stageWasVisible;
    console.log('🎯 HUD_ROOT created but NOT added to stage - will add in playHudDrop()');
  } else {
    // Normal path: add to stage immediately
    stage.addChild(HUD_ROOT);
    console.log('✅ HUD_ROOT created and added to stage');
  }

  // vrijednosti - Use system font stack for better App Store compatibility
  const valMain  = { fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif', fontSize: 24, fill: 0xAD8775, fontWeight: '700', fontStyle: 'normal' };
  const valCombo = { fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif', fontSize: 24, fill: 0xE77449, fontWeight: '700', fontStyle: 'normal' }; // Same color as preloader

  // Create close icon sprite instead of board text
  try {
    let closeIconTexture = null;
    try {
      closeIconTexture = Assets.get('./assets/close-icon.png');
    } catch (e) {
      // Asset might not be loaded yet, will load asynchronously
    }
    
    if (closeIconTexture) {
      // Create container for icon + circle
      const closeButtonContainer = new Container();
      closeButtonContainer.eventMode = 'static';
      closeButtonContainer.cursor = 'pointer';
      
      // Create dashed circle (44px diameter with 2px stroke, 6px dash + 6px gap, 10px from icon)
      const circle = new Graphics();
      const radius = 22;
      const dashLength = 6;
      const gapLength = 6;
      const circumference = 2 * Math.PI * radius;
      const totalSegment = dashLength + gapLength;
      const dashCount = Math.floor(circumference / totalSegment);
      
      for (let i = 0; i < dashCount; i++) {
        // Calculate angles for this dash
        const startAngle = (i * totalSegment / circumference) * 2 * Math.PI;
        const endAngle = startAngle + (dashLength / circumference) * 2 * Math.PI;
        
        // Calculate start and end points
        const startX = Math.cos(startAngle) * radius;
        const startY = Math.sin(startAngle) * radius;
        const endX = Math.cos(endAngle) * radius;
        const endY = Math.sin(endAngle) * radius;
        
        // Draw arc segment
        circle.moveTo(startX, startY);
        circle.arc(0, 0, radius, startAngle, endAngle);
      }
      circle.stroke({ width: 2, color: 0xE8D4C7 }); // 2px stroke, light beige color
      closeButtonContainer.addChild(circle);
      
      // Create icon sprite (24px) centered in the circle
      const iconSprite = new Sprite(closeIconTexture);
      iconSprite.anchor.set(0.5, 0.5);
      const iconSize = 24;
      if (iconSprite.width > 0 && iconSprite.height > 0) {
        const scale = iconSize / Math.max(iconSprite.width, iconSprite.height);
        iconSprite.scale.set(scale);
      }
      iconSprite.alpha = 0.8;
      closeButtonContainer.addChild(iconSprite);
      
      // Store reference to container (not just sprite)
      closeIconSprite = closeButtonContainer;
      
      // Add interactive behavior
      closeButtonContainer.on('pointertap', () => handleHUDClose());
      closeButtonContainer.on('pointerdown', () => {
        closeButtonContainer.scale.set(0.92);
      });
      closeButtonContainer.on('pointerup', () => {
        closeButtonContainer.scale.set(1);
      });
      closeButtonContainer.on('pointerleave', () => {
        closeButtonContainer.scale.set(1);
      });
      
      HUD_ROOT.addChild(closeButtonContainer);
      console.log('✅ Close icon with circle created and added');
    } else {
      console.warn('⚠️ Close icon texture not found, trying to load...');
      // Try loading it asynchronously
      Assets.load('./assets/close-icon.png').then((tex) => {
        if (tex && HUD_ROOT) {
          // Create container for icon + circle
          const closeButtonContainer = new Container();
          closeButtonContainer.eventMode = 'static';
          closeButtonContainer.cursor = 'pointer';
          
          // Create dashed circle (44px diameter with 2px stroke, 6px dash + 6px gap, 10px from icon)
          const circle = new Graphics();
          const radius = 22;
          const dashLength = 6;
          const gapLength = 6;
          const circumference = 2 * Math.PI * radius;
          const totalSegment = dashLength + gapLength;
          const dashCount = Math.floor(circumference / totalSegment);
          
          for (let i = 0; i < dashCount; i++) {
            // Calculate angles for this dash
            const startAngle = (i * totalSegment / circumference) * 2 * Math.PI;
            const endAngle = startAngle + (dashLength / circumference) * 2 * Math.PI;
            
            // Calculate start and end points
            const startX = Math.cos(startAngle) * radius;
            const startY = Math.sin(startAngle) * radius;
            const endX = Math.cos(endAngle) * radius;
            const endY = Math.sin(endAngle) * radius;
            
            // Draw arc segment
            circle.moveTo(startX, startY);
            circle.arc(0, 0, radius, startAngle, endAngle);
          }
          circle.stroke({ width: 2, color: 0xE8D4C7 }); // 2px stroke, light beige color
          closeButtonContainer.addChild(circle);
          
          // Create icon sprite (24px) centered in the circle
          const iconSprite = new Sprite(tex);
          iconSprite.anchor.set(0.5, 0.5);
          const iconSize = 24;
          if (iconSprite.width > 0 && iconSprite.height > 0) {
            const scale = iconSize / Math.max(iconSprite.width, iconSprite.height);
            iconSprite.scale.set(scale);
          }
          iconSprite.alpha = 0.8;
          closeButtonContainer.addChild(iconSprite);
  
          // Store reference
          closeIconSprite = closeButtonContainer;
          
          // Add interactive behavior
          closeButtonContainer.on('pointertap', () => handleHUDClose());
          closeButtonContainer.on('pointerdown', () => {
            closeButtonContainer.scale.set(0.92);
          });
          closeButtonContainer.on('pointerup', () => {
            closeButtonContainer.scale.set(1);
          });
          closeButtonContainer.on('pointerleave', () => {
            closeButtonContainer.scale.set(1);
          });
          
          HUD_ROOT.addChild(closeButtonContainer);
          layout({ app, top });
          console.log('✅ Close icon with circle loaded and added');
        }
      }).catch((err) => {
        console.error('❌ Failed to load close icon:', err);
      });
    }
  } catch (error) {
    console.error('❌ Error creating close icon sprite:', error);
  }

  // Create dummy boardText for compatibility (hidden)
  boardText = new Text({ text: '#1', style: { fontSize: 24, fill: 0xAD8775 } });
  boardText.visible = false;
  boardText.renderable = false;

  // 🔥 NEW HUD DESIGN: Create HUD elements with icons (star-hud, score-hud, combo-hud)
  // Layout based on SwiftUI design:
  // - Left (offset -112): score-hud.png + score number (from assets/hud/)
  // - Right (offset 108): star-hud.png + currency number (or energy "X0") (from assets/hud/)
  // - Left (offset -4.50): combo-hud.png + combo number (from assets/hud/)
  
  // Create containers for each HUD element
  const createHudElement = (iconPath, textValue, textStyle) => {
    const container = new Container();
    container.eventMode = 'none';
    
    // Load icon sprite (transparent background - no bg rectangle)
    let iconSprite = null;
    try {
      const iconTexture = Assets.get(iconPath);
      if (iconTexture) {
        iconSprite = new Sprite(iconTexture);
        iconSprite.anchor.set(0.5, 0.5);
        
        // 🔥 USER REQUEST: star-hud.png should have height 28px with aspect ratio preserved
        if (iconPath.includes('star-hud.png') || iconPath.includes('hud/star-hud.png')) {
          const targetHeight = 28;
          if (iconSprite.width > 0 && iconSprite.height > 0) {
            // Scale based on height to maintain aspect ratio
            const scale = targetHeight / iconSprite.height;
            iconSprite.scale.set(scale);
            console.log('⭐ star-hud.png scaled to height 28px, width:', iconSprite.width * scale, 'px (aspect ratio preserved)');
          }
        } else {
          // Other icons: scale to 28x28 (max dimension)
          const targetSize = 28;
          if (iconSprite.width > 0 && iconSprite.height > 0) {
            const scale = targetSize / Math.max(iconSprite.width, iconSprite.height);
            iconSprite.scale.set(scale);
          }
        }
        container.addChild(iconSprite);
      }
    } catch (e) {
      console.warn(`⚠️ Failed to load icon ${iconPath}, will try async:`, e);
      // Try async load
      Assets.load(iconPath).then((tex) => {
        if (tex && container && !container.destroyed) {
          iconSprite = new Sprite(tex);
          iconSprite.anchor.set(0.5, 0.5);
          
          // 🔥 USER REQUEST: star-hud.png should have height 28px with aspect ratio preserved
          if (iconPath.includes('star-hud.png') || iconPath.includes('hud/star-hud.png')) {
            const targetHeight = 28;
            if (iconSprite.width > 0 && iconSprite.height > 0) {
              // Scale based on height to maintain aspect ratio
              const scale = targetHeight / iconSprite.height;
              iconSprite.scale.set(scale);
              console.log('⭐ star-hud.png scaled to height 28px, width:', iconSprite.width * scale, 'px (aspect ratio preserved)');
            }
          } else {
            // Other icons: scale to 28x28 (max dimension)
            const targetSize = 28;
            if (iconSprite.width > 0 && iconSprite.height > 0) {
              const scale = targetSize / Math.max(iconSprite.width, iconSprite.height);
              iconSprite.scale.set(scale);
            }
          }
          container.addChildAt(iconSprite, 0);
        }
      }).catch((err) => {
        console.error(`❌ Failed to load icon ${iconPath}:`, err);
      });
    }
    
    // 🔥 NO BACKGROUND: PNG icons have transparent background, no bg rectangle needed
    
    // Create text
    const text = new Text({ text: textValue, style: textStyle });
    text.anchor.set(0, 0.5); // Left-align text (anchor at left center for proper positioning)
    // Position text to the right of icon (spacing: 6px for better visibility, same as other HUD icons)
    // 🔥 FIX: Ensure score-hud has same spacing as other HUD icons (star-hud, combo-hud)
    const spacing = 6; // Standard spacing for all HUD icons (increased from 4px for better visibility)
    if (iconSprite) {
      text.x = (iconSprite.width * iconSprite.scale.x) / 2 + spacing;
    } else {
      text.x = 14 + spacing; // Half of 28px + spacing
    }
    text.y = 0;
    container.addChild(text);
    
    return { container, text, iconSprite };
  };
  
  // Create HUD elements
  // 🔥 NEW ORDER: Close → Star → Coin → Combo
  // 1. Star (currency) - second (after close)
  const starHud = createHudElement('./assets/hud/star-hud.png', '0', {
    fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif',
    fontSize: 18,
    fill: 0xB58573, // Color(red: 0.71, green: 0.52, blue: 0.45)
    fontWeight: 'bold',
    fontStyle: 'normal'
  });
  
  // 2. Coin (score) - third - using score-hud.png instead of coin-hud.png
  const coinHud = createHudElement('./assets/hud/score-hud.png', '0', {
    fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif',
    fontSize: 18, // Changed from 20 to 18
    fill: 0xB58573, // Color(red: 0.71, green: 0.52, blue: 0.45)
    fontWeight: 'bold',
    fontStyle: 'normal'
  });
  
  // 3. Combo - fourth (last)
  // Create combo with separate "x" (14px) and number (18px) text objects
  const comboContainer = new Container();
  comboContainer.eventMode = 'none';
  
  // Load combo icon sprite
  let comboIconSprite = null;
  try {
    const comboIconTexture = Assets.get('./assets/hud/combo-hud.png');
    if (comboIconTexture) {
      comboIconSprite = new Sprite(comboIconTexture);
      comboIconSprite.anchor.set(0.5, 0.5);
      const targetSize = 28;
      if (comboIconSprite.width > 0 && comboIconSprite.height > 0) {
        const scale = targetSize / Math.max(comboIconSprite.width, comboIconSprite.height);
        comboIconSprite.scale.set(scale);
      }
      comboContainer.addChild(comboIconSprite);
    }
  } catch (e) {
    console.warn('⚠️ Failed to load combo icon, will try async:', e);
    Assets.load('./assets/hud/combo-hud.png').then((tex) => {
      if (tex && comboContainer && !comboContainer.destroyed) {
        comboIconSprite = new Sprite(tex);
        comboIconSprite.anchor.set(0.5, 0.5);
        const targetSize = 28;
        if (comboIconSprite.width > 0 && comboIconSprite.height > 0) {
          const scale = targetSize / Math.max(comboIconSprite.width, comboIconSprite.height);
          comboIconSprite.scale.set(scale);
        }
        comboContainer.addChildAt(comboIconSprite, 0);
      }
    }).catch((err) => {
      console.error('❌ Failed to load combo icon:', err);
    });
  }
  
  // Create "x" text (14px) - use local variable name to avoid conflict
  const comboXTextLocal = new Text({ 
    text: 'x', 
    style: {
      fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif',
      fontSize: 14,
      fill: 0xE77449, // Color #E77449
      fontWeight: 'bold',
      fontStyle: 'normal'
    }
  });
  comboXTextLocal.anchor.set(0, 0.5);
  if (comboIconSprite) {
    comboXTextLocal.x = (comboIconSprite.width * comboIconSprite.scale.x) / 2 + 4;
  } else {
    comboXTextLocal.x = 14 + 4;
  }
  comboXTextLocal.y = 0;
  comboContainer.addChild(comboXTextLocal);
  
  // Create number text (18px)
  const comboNumberText = new Text({ 
    text: '0', 
    style: {
      fontFamily: 'LTCrow, system-ui, -apple-system, sans-serif',
      fontSize: 18, // All numbers are 18px
      fill: 0xE77449, // Color #E77449
      fontWeight: 'bold',
      fontStyle: 'normal'
    }
  });
  comboNumberText.anchor.set(0, 0.5);
  // Position number text right after "x" text
  comboNumberText.x = comboXTextLocal.x + comboXTextLocal.width;
  comboNumberText.y = 0;
  comboContainer.addChild(comboNumberText);
  
  const comboHud = {
    container: comboContainer,
    text: comboNumberText, // Store number text as main text reference (18px)
    xText: comboXTextLocal, // Store "x" text separately (14px)
    iconSprite: comboIconSprite,
    originalIconPath: './assets/hud/combo-hud.png', // Store original icon path (0-4)
    extraIconPath: './assets/hud/extra-combo-hud.png', // Store extra icon path (5-9)
    megaIconPath: './assets/hud/mega-combo-hud.png', // Store mega icon path (10+)
    currentIconType: 'normal' // Track current icon: 'normal', 'extra', or 'mega'
  };
  
  // Store references
  scoreText = coinHud.text; // Use coin text for score
  comboText = comboHud.text; // Use combo number text (18px)
  comboXText = comboHud.xText; // Store "x" text reference (14px) - use global variable
  starText = starHud.text; // Currency/energy text
  
  // Export combo text for animations
  window.comboText = comboText;

  // Create wrapper for combo (for jitter animation)
  comboWrap = new Container();
  comboWrap.addChild(comboHud.container);
  
  // Add all HUD elements to root in order: Close → Star → Coin → Combo
  HUD_ROOT.addChild(
    boardText,
    starHud.container,   // Star (currency) - second
    coinHud.container,   // Coin (score) - third
    comboWrap            // Combo - fourth
  );
  
  // Store references for layout
  HUD_ROOT._hudElements = {
    star: starHud,
    coin: coinHud,
    combo: comboHud
  };
  
  // Add close icon sprite if it was created synchronously
  if (closeIconSprite && closeIconSprite.parent !== HUD_ROOT) {
    HUD_ROOT.addChild(closeIconSprite);
    console.log('✅ Close icon sprite added to HUD_ROOT');
  }
  
  // ensure combo is drawn above wild bar if overlapping
  try {
    boardText.zIndex = 10;
    if (closeIconSprite) closeIconSprite.zIndex = 10;
    if (HUD_ROOT._hudElements) {
      const { star, coin, combo } = HUD_ROOT._hudElements;
      if (coin && coin.container) coin.container.zIndex = 10;
      if (star && star.container) star.container.zIndex = 10;
      if (combo && combo.container) combo.container.zIndex = 2000;
    }
    if (scoreText) scoreText.zIndex = 10;
    if (comboWrap) comboWrap.zIndex = 2000;
    if (comboText) comboText.zIndex = 2000;
    HUD_ROOT.sortChildren?.();
  } catch {}
  
  // 🔥 NEW HUD: Export function to update currency/energy (for future use)
  if (starText) {
    window.setCurrency = (value) => {
      if (starText) {
        starText.text = String(value|0);
      }
    };
  }
  
  // 🔥 Export HUD functions to window for stars-collector module
  if (typeof window !== 'undefined') {
    window.HUD = window.HUD || {};
    window.HUD.bounceStarIcon = bounceStarIcon;
    window.HUD.getStarHudPosition = getStarHudPosition;
    window.HUD.setStarsCount = setStarsCount;
    window.HUD.cleanupComboAnimations = cleanupComboAnimations; // 🔥 Export cleanup function
    // 🔥 CRITICAL FIX: Export HUD_ROOT to window for access from app-core.ts
    // This allows app-core.ts to access HUD_ROOT even though it's a local variable in this module
    window.HUD_ROOT = HUD_ROOT;
    console.log('✅ HUD functions exported to window.HUD');
    console.log('✅ HUD_ROOT exported to window.HUD_ROOT');
  }
  
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
  // (initialHide state already applied above to avoid first-frame flash)
  
  // 🔥 CRITICAL FIX: Always export HUD_ROOT to window after initialization
  // This ensures app-core.ts can access it even if initHUD is called multiple times
  if (typeof window !== 'undefined') {
    window.HUD_ROOT = HUD_ROOT;
    console.log('✅ HUD_ROOT exported to window.HUD_ROOT after initialization');
  }

  // 🔥 USER REQUEST: Remove HUD-wide click event - only X button and score area should be clickable
  // HUD_ROOT no longer has global click handler
  HUD_ROOT.interactive = false;
  HUD_ROOT.cursor = 'default';
  
  // 🔥 USER REQUEST: Add X button (top left) for end run modal with rounded dotted area
  const xButton = new Container();
  xButton.interactive = true;
  xButton.cursor = 'pointer';
  xButton.eventMode = 'static';
  
  // Create rounded dotted circle background (visual feedback for touch area)
  const touchAreaSize = 44; // 44px touch area (iOS standard)
  const radius = touchAreaSize / 2; // 22px radius
  
  // 🔥 DEBUG: Red container with 60% opacity to visualize clickable area
  // CRITICAL: All elements must be centered at (0,0) within xButton container
  const debugBg = new Graphics();
  debugBg.circle(0, 0, radius); // Center at (0,0)
  debugBg.fill({ color: 0xFF0000, alpha: 0.6 }); // Red, 60% opacity
  xButton.addChild(debugBg);
  
  // Draw dotted circle border (dashed effect using multiple small arcs)
  const circleBg = new Graphics();
  circleBg.lineStyle(2, 0xB58573, 0.5); // Brown color, 50% opacity, 2px thick
  const numDots = 16; // Number of dots in circle
  const dotAngle = (Math.PI * 2) / numDots;
  
  // Draw dots around circle - all centered at (0,0)
  for (let i = 0; i < numDots; i++) {
    const angle = i * dotAngle;
    const x1 = Math.cos(angle) * radius;
    const y1 = Math.sin(angle) * radius;
    const x2 = Math.cos(angle + dotAngle * 0.6) * radius;
    const y2 = Math.sin(angle + dotAngle * 0.6) * radius;
    // Draw small line segment for each dot
    circleBg.moveTo(x1, y1);
    circleBg.lineTo(x2, y2);
  }
  xButton.addChild(circleBg);
  
  // Create X icon using Graphics (simple X shape) - centered at (0,0) in circle
  const xGraphics = new Graphics();
  xGraphics.lineStyle(3, 0xB58573, 1); // Brown color, 3px thick
  const xSize = 20;
  // X centered at (0,0)
  xGraphics.moveTo(-xSize/2, -xSize/2);
  xGraphics.lineTo(xSize/2, xSize/2);
  xGraphics.moveTo(xSize/2, -xSize/2);
  xGraphics.lineTo(-xSize/2, xSize/2);
  xButton.addChild(xGraphics);
  
  // 🔥 CRITICAL: Touch area must be exactly where X is (centered on button)
  // hitArea is relative to container's local coordinates (0,0 is center)
  // Rectangle from (-22, -22) to (22, 22) = 44x44px centered at (0,0)
  xButton.hitArea = new Rectangle(-touchAreaSize/2, -touchAreaSize/2, touchAreaSize, touchAreaSize);
  
  // 🔥 CRITICAL: Set pivot point to center (0,0) to ensure all children are centered
  xButton.pivot.set(0, 0);
  
  console.log('🎯 X Button created:', {
    touchAreaSize,
    hitArea: { x: -touchAreaSize/2, y: -touchAreaSize/2, width: touchAreaSize, height: touchAreaSize },
    interactive: xButton.interactive,
    eventMode: xButton.eventMode
  });
  
  // Position X button (top left, will be positioned in layout())
  xButton.x = 0; // Will be set in layout()
  xButton.y = 0; // Will be set in layout()
  xButton._isXButton = true; // Mark for layout positioning
  HUD_ROOT.addChild(xButton);
  
  // X button click handler - show end run modal
  // 🔥 USER REQUEST: X button (far left) opens end game bottom sheet when tapped
  xButton.on('pointerdown', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('🎯 X BUTTON CLICKED - Opening End Run bottom sheet');
    
    // Light haptic feedback
    if (typeof window.triggerHapticImpact === 'function') {
      window.triggerHapticImpact('light');
    }
    
    // Show End This Run bottom sheet
    if (typeof window.showEndRunModalFromGame === 'function') {
      console.log('✅ Calling showEndRunModalFromGame()');
      window.showEndRunModalFromGame();
    } else {
      console.error('❌ showEndRunModalFromGame function not available!');
    }
  });
  
  // Also handle pointerup for better touch support
  xButton.on('pointerup', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  
  // Handle pointertap (combination of pointerdown + pointerup)
  xButton.on('pointertap', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('🎯 X BUTTON TAPPED - Opening End Run bottom sheet');
    
    // Light haptic feedback
    if (typeof window.triggerHapticImpact === 'function') {
      window.triggerHapticImpact('light');
    }
    
    // Show End This Run bottom sheet
    if (typeof window.showEndRunModalFromGame === 'function') {
      window.showEndRunModalFromGame();
    }
  });
  
  // 🔥 USER REQUEST: Add click handler to score area (coinHud) for score bottom sheet
  if (coinHud && coinHud.container) {
    coinHud.container.interactive = true;
    coinHud.container.cursor = 'pointer';
    coinHud.container.eventMode = 'static';
    
    coinHud.container.on('pointerdown', (e) => {
      e.stopPropagation();
      console.log('📊 SCORE AREA CLICKED - Opening score bottom sheet');
      
      // Light haptic
      if (typeof window.triggerHapticImpact === 'function') {
        window.triggerHapticImpact('light');
      }
      
      // Show score bottom sheet
      if (typeof window.showScoreBottomSheet === 'function') {
        window.showScoreBottomSheet();
      }
    });
  }
  
  // Store X button reference for layout
  HUD_ROOT._xButton = xButton;
}

// Play the deferred drop once (used on first Play when board is ~50% populated)
export function playHudDrop({ duration = 0.8, forceRestart = false } = {}){
  if (!HUD_ROOT) {
    console.warn('⚠️ playHudDrop: HUD_ROOT is null, cannot play drop animation');
    return;
  }
  
  // 🔥 CRITICAL FIX: Add HUD_ROOT to stage NOW if it wasn't added yet (initialHide path)
  if (!HUD_ROOT.parent && HUD_ROOT._stage) {
    HUD_ROOT._stage.addChild(HUD_ROOT);
    console.log('✅ HUD_ROOT added to stage (was deferred from initHUD)');
  }
  
  // 🔥 CRITICAL FIX: Restore stage visibility NOW that HUD is ready to drop
  // Stage was hidden in initHUD() to prevent flash
  if (HUD_ROOT.parent && !HUD_ROOT.parent.visible) {
    HUD_ROOT.parent.visible = true;
    console.log('🎯 Stage visibility restored for HUD drop');
  }
  
  const top = HUD_ROOT._dropTop ?? 44;
  
  // 🔥 NEW: Force restart drop animation (used for interim entry so it always replays)
  if (forceRestart) {
    try { gsap.killTweensOf(HUD_ROOT); } catch {}
    HUD_ROOT._dropped = false;
    HUD_ROOT.visible = true;
    HUD_ROOT.alpha = 0;
    HUD_ROOT.y = top - 140;
  }
  
  // 🔥 CRITICAL FIX: If HUD is already dropped, ensure it's visible and positioned correctly
  if (!forceRestart && HUD_ROOT._dropped) {
    const top = HUD_ROOT._dropTop ?? HUD_ROOT.y ?? 44;
    HUD_ROOT.y = top;
    HUD_ROOT.alpha = 1;
    HUD_ROOT.visible = true;
    console.log('✅ HUD already dropped - ensuring visibility');
    return;
  }
  
  try { gsap.killTweensOf(HUD_ROOT); } catch {}
  
  // 🔥 CRITICAL FIX: Ensure HUD is visible before animation
  HUD_ROOT.visible = true;
  
  // Animate PIXI HUD drop
  gsap.to(HUD_ROOT, {
    alpha: 1,
    y: top,
    duration: duration,
    ease: 'elastic.out(1, 0.6)',
    onComplete: () => { 
      if (HUD_ROOT) {
        HUD_ROOT._dropped = true; 
        HUD_ROOT.y = top;
        HUD_ROOT.alpha = 1;
        HUD_ROOT.visible = true;
        console.log('✅ HUD drop animation completed');
      }
    },
    onUpdate: function() {
      // Safety check during animation
      if (!HUD_ROOT || !HUD_ROOT.parent) {
        console.warn('⚠️ playHudDrop: HUD_ROOT destroyed during animation, killing tween');
        this.kill();
      }
    }
  });
  
  console.log('✅ PIXI HUD drop animation started');
  
  // 🔥 CRITICAL FIX: Ensure board indicator animation is triggered
  try {
    animateBoardIndicatorEnter(duration);
  } catch (e) {
    console.warn('⚠️ Failed to trigger board indicator animation:', e);
  }
}

// Helper function to cleanup all smoke bubbles before exit
export function cleanupSmokeBubbles() {
  try {
    // Find wild container and kill its smoke interval
    if (wild && wild.view) {
      const wildContainer = wild.view;
      if (wildContainer._smokeInterval) {
        clearInterval(wildContainer._smokeInterval);
        wildContainer._smokeInterval = null;
        console.log('✅ Killed wild meter smoke interval');
      }
    }
    
    // Kill all smoke bubble GSAP animations on HUD stage
    if (HUD_ROOT && HUD_ROOT.parent && HUD_ROOT.parent.children) {
      const hudStage = HUD_ROOT.parent;
      let removedCount = 0;
      hudStage.children.forEach(child => {
        // Check if it's a smoke bubble (has zIndex 2000 or is Graphics with small size)
        if (child && child.zIndex === 2000) {
          try {
            gsap.killTweensOf(child);
            if (child.parent) {
              child.parent.removeChild(child);
            }
            child.destroy();
            removedCount++;
          } catch (e) {
            // Ignore errors
          }
        }
      });
      if (removedCount > 0) {
        console.log(`✅ Removed ${removedCount} smoke bubbles`);
      }
    }
    console.log('✅ All smoke bubbles cleaned up');
  } catch (e) {
    console.warn('⚠️ Error cleaning up smoke bubbles:', e);
  }
}

// Play HUD rise animation - exact reverse of playHudDrop
export function playHudRise({ duration = 0.3 } = {}){
  if (!HUD_ROOT) {
    console.warn('⚠️ playHudRise: HUD_ROOT is null, skipping animation');
    // Wait 0.1s after HUD would have started, then animate board indicator
    setTimeout(() => {
      animateBoardIndicatorExit(0.3);
    }, 100);
    return;
  }
  
  // Safety: double-check HUD_ROOT is still valid
  try {
    const top = HUD_ROOT._dropTop ?? HUD_ROOT.y ?? 0;
    
    // CRITICAL: Kill all smoke bubbles and intervals before exit
    cleanupSmokeBubbles();
    
    // 🔥 CLEANUP: Kill all combo animations before exit
    cleanupComboAnimations();
    
    // Kill any existing tweens
    try { gsap.killTweensOf(HUD_ROOT); } catch {}
    
    // Use fixed 0.3s duration for faster exit animation
    const exitDuration = 0.3;
    
    // Animate PIXI HUD rise (reverse of drop) - faster exit
    gsap.to(HUD_ROOT, {
      alpha: 0,  // fade out
      y: -top * 2,  // rise above screen
      duration: exitDuration,
      ease: 'power2.in',  // faster, simpler ease for exit
      onComplete: () => { 
        // Safety check in callback - HUD_ROOT might be destroyed during animation
        if (HUD_ROOT) {
          HUD_ROOT._dropped = false; 
          HUD_ROOT.y = -top * 2; 
        }
      },
      onUpdate: function() {
        // Safety check during animation - if HUD_ROOT is destroyed, kill this tween
        if (!HUD_ROOT || !HUD_ROOT.parent) {
          console.warn('⚠️ playHudRise: HUD_ROOT destroyed during animation, killing tween');
          this.kill();
        }
      }
    });
    
    console.log('✅ PIXI HUD rise animation started');
    
    // Wait 0.1s after HUD animation starts, then animate board indicator with 0.3s duration
    setTimeout(() => {
      animateBoardIndicatorExit(0.3);
    }, 100);
  } catch (error) {
    console.error('❌ playHudRise failed:', error);
    // Even on error, try to animate board indicator after delay
    setTimeout(() => {
      animateBoardIndicatorExit(0.3);
    }, 100);
  }
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
    updateBoardIndicatorValue(bd);
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
    // 🔥 NEW HUD: Update combo number text (18px) - "x" stays constant (14px)
    if (comboText) {
      comboText.text = String(v);
      // Update number text position relative to "x" text if it exists
      if (comboXText && comboText.parent) {
        comboText.x = comboXText.x + comboXText.width;
      }
    }
    
    // 🔥 COMBO ICON SWAP: Swap icon to extra-combo-hud.png when combo >= 10
    updateComboIcon(v);
    
    // 🔥 COMBO WOBBLE: Start wobble animation when combo >= 10
    updateComboWobble(v);
    
    // 🔥 CONTAIN COMBO: Adjust combo position and scale to keep it within viewport
    if (HUD_ROOT && HUD_ROOT._hudElements && HUD_ROOT._hudElements.combo && comboWrap) {
      const comboEl = HUD_ROOT._hudElements.combo;
      const comboContainer = comboEl.container;
      
      if (comboContainer && comboContainer.parent && comboWrap.parent) {
        // Get screen width from app renderer or window
        const app = comboContainer.parent.parent?.app || (typeof window !== 'undefined' && window.STATE?.app);
        const screenWidth = app?.renderer?.width || (typeof window !== 'undefined' ? window.innerWidth : 800);
        // 🔥 USER REQUEST: 24px padding from right edge (like journey hearts)
        // Journey hearts use: margin-right: var(--pad-right, 24px) which accounts for safe-area-inset-right
        // We'll use the same approach: rightEdge = screenWidth - 24px padding
        const comboRightPadding = 24; // 24px from right edge
        const rightEdge = screenWidth - comboRightPadding; // 24px padding from right edge
        
        // Calculate total combo width (icon + spacing + "x" + number)
        const iconWidth = comboEl.iconSprite ? comboEl.iconSprite.width * comboEl.iconSprite.scale.x : 28;
        const xTextWidth = comboEl.xText ? comboEl.xText.width : 0;
        const numberTextWidth = comboEl.text ? comboEl.text.width : 0;
        const spacing = 4;
        const totalWidth = iconWidth + spacing + xTextWidth + numberTextWidth;
        
        // 🔥 USER REQUEST: Position combo 12px left of wild preloader right edge
        // Wild preloader: x = 24px (SIDE), width = screenWidth - 48px, so right edge = 24 + (screenWidth - 48) = screenWidth - 24px
        const SIDE = 24;
        const wildPreloaderRightEdge = screenWidth - SIDE; // vw - 24px
        // Combo right edge should be 12px left of wild preloader right edge
        const comboRightEdge = wildPreloaderRightEdge - 12; // vw - 36px
        
        // Position combo so its right edge is 8px left of wild preloader right edge
        // comboWrap.x is center, so: comboWrap.x + totalWidth/2 = comboRightEdge
        comboWrap.x = comboRightEdge - totalWidth / 2;
        
        // Also scale down if still too wide after moving
        const maxAllowedWidth = screenWidth - 40; // No padding, just 40px margin for safety
        if (totalWidth > maxAllowedWidth && maxAllowedWidth > 0) {
          const scale = maxAllowedWidth / totalWidth;
          comboContainer.scale.set(Math.min(1, scale));
        } else {
          comboContainer.scale.set(1);
        }
      }
    }
    
    if (v > 0) { startComboFX(); } else { stopComboFX(); }
    __lastComboVal = v;
  }
}

// 🔥 ANIMATION: Animate score counting from current to target value
let __scoreProxy = null;
let __scoreTween = null;

export function setScore(v, animate = true){ 
  if (!scoreText) return;
  
  const targetScore = v|0;
  const currentText = scoreText.text || '0';
  const currentScore = parseInt(currentText.replace(/[^0-9]/g, '') || '0', 10) || 0;
  
  // If already at target, just set it directly
  if (currentScore === targetScore) {
    scoreText.text = String(targetScore);
    return;
  }
  
  // If animation is already in progress (from animateScore), just update directly
  // This prevents double animation when animateScore calls setScore in onUpdate
  if (__scoreTweening || !animate) {
    scoreText.text = String(targetScore);
    return;
  }
  
  // Kill any existing animation
  if (__scoreTween) {
    gsap.killTweensOf(__scoreProxy);
    __scoreTween = null;
  }
  
  // Create proxy object for animation
  if (!__scoreProxy) {
    __scoreProxy = { value: currentScore };
  } else {
    __scoreProxy.value = currentScore;
  }
  
  // Calculate duration based on difference
  const diff = Math.abs(targetScore - currentScore);
  const duration = Math.min(1.2, Math.max(0.6, diff / 1000));
  
  // Animate score counting
  __scoreTween = gsap.to(__scoreProxy, {
    value: targetScore,
    duration: duration,
    ease: 'power2.out',
    onUpdate: () => {
      const rounded = Math.round(__scoreProxy.value);
      scoreText.text = String(rounded);
    },
    onComplete: () => {
      scoreText.text = String(targetScore);
      __scoreTween = null;
    }
  });
}
export function setBoard(v){
  const val = v|0;
  if (boardText) boardText.text = `#${val}`;
  updateBoardIndicatorValue(val);
}
// 🔥 COMBO ICON SWAP: Function to swap combo icon based on combo value
// Three levels:
// - 0-4: combo-hud.png (normal)
// - 5-9: extra-combo-hud.png (extra)
// - 10+: mega-combo-hud.png (mega)
function updateComboIcon(comboValue) {
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.combo) {
    console.warn('⚠️ updateComboIcon: HUD elements not ready');
    return;
  }
  
  const combo = HUD_ROOT._hudElements.combo;
  const iconSprite = combo.iconSprite;
  
  if (!iconSprite || iconSprite.destroyed) {
    console.warn('⚠️ updateComboIcon: Icon sprite not available');
    return;
  }
  
  // Determine which icon to use based on combo value
  let targetIconType = 'normal';
  let targetIconPath = './assets/hud/combo-hud.png';
  
  if (comboValue >= 10) {
    targetIconType = 'mega';
    targetIconPath = './assets/hud/mega-combo-hud.png';
  } else if (comboValue >= 5) {
    targetIconType = 'extra';
    targetIconPath = './assets/extra-combo-hud.png';
  } else {
    targetIconType = 'normal';
    targetIconPath = './assets/hud/combo-hud.png';
  }
  
  const currentIconType = combo.currentIconType || 'normal';
  
  console.log(`💧 updateComboIcon: combo=${comboValue}, targetIcon=${targetIconType}, currentIcon=${currentIconType}`);
  
  // Only swap if needed
  if (targetIconType !== currentIconType) {
    console.log(`💧 Switching to ${targetIconPath}...`);
    const loadIcon = async () => {
      try {
        // 🔥 CRITICAL: Store current sprite properties before swapping
        const currentVisible = iconSprite.visible;
        const currentAlpha = iconSprite.alpha;
        const currentScaleX = iconSprite.scale.x;
        const currentScaleY = iconSprite.scale.y;
        const currentAnchorX = iconSprite.anchor?.x ?? 0.5;
        const currentAnchorY = iconSprite.anchor?.y ?? 0.5;
        
        // Try to get texture (might already be loaded)
        let texture = null;
        try {
          texture = Assets.get(targetIconPath);
          if (!texture) {
            console.log(`💧 ${targetIconPath} not in cache (Assets.get returned null), loading...`);
            texture = await Assets.load(targetIconPath);
          } else {
            console.log(`💧 ${targetIconPath} found in cache`);
          }
        } catch (e) {
          // Texture not in cache, load it
          console.log(`💧 ${targetIconPath} not in cache (error), loading...`, e);
          try {
            texture = await Assets.load(targetIconPath);
          } catch (loadError) {
            console.error(`❌ Failed to load ${targetIconPath}:`, loadError);
            // 🔥 CRITICAL: Fallback to previous icon if loading fails
            console.warn(`⚠️ Falling back to previous icon type: ${currentIconType}`);
            return; // Exit early if texture loading fails
          }
        }
        
        // 🔥 CRITICAL: Double-check texture is valid
        if (!texture) {
          console.error(`❌ Texture ${targetIconPath} is null or undefined after loading attempt!`);
          return; // Exit early if texture is invalid
        }
        
        if (texture && iconSprite && !iconSprite.destroyed) {
          // 🔥 CRITICAL: Store target size (same as initial combo icon size)
          const targetSize = 28; // Same as initial combo icon size
          
          // 🔥 USER REQUEST: Smooth morph animation with ease in/out
          // Kill any existing animations on this sprite
          try {
            gsap.killTweensOf(iconSprite);
            gsap.killTweensOf(iconSprite.scale);
            if (iconSprite._morphTimeline) {
              try {
                iconSprite._morphTimeline.kill();
              } catch {}
            }
          } catch {}
          
          // Calculate new scale for target texture
          let newScale = currentScaleX || 1;
          if (texture && texture.width > 0 && texture.height > 0) {
            newScale = targetSize / Math.max(texture.width, texture.height);
            console.log(`💧 New scale calculated for ${targetIconType} icon: ${newScale} (texture size: ${texture.width}x${texture.height})`);
          }
          
          // Store current scale before animation
          const oldScaleX = iconSprite.scale.x;
          const oldScaleY = iconSprite.scale.y;
          
          // 🔥 USER REQUEST: Fast morph transition (cross-fade, no fade out)
          // Direct texture swap with quick scale animation for smooth morph effect
          const morphDuration = 0.15; // 🔥 Faster: 150ms (reduced from 300ms)
          const morphTimeline = gsap.timeline({
            onComplete: () => {
              // Update icon type after animation completes
              combo.currentIconType = targetIconType;
              
              // Clean up timeline reference
              try {
                if (iconSprite) {
                  iconSprite._morphTimeline = null;
                }
              } catch {}
              
              console.log(`✅ Combo icon morph animation completed (combo ${comboValue}, type: ${targetIconType})`);
            }
          });
          
          // Store timeline for cleanup
          iconSprite._morphTimeline = morphTimeline;
          
          // 🔥 USER REQUEST: Direct morph (no fade out) - swap texture immediately and animate scale
          // Step 1: Swap texture immediately (no fade out)
          if (iconSprite && !iconSprite.destroyed) {
            iconSprite.texture = texture;
            
            // Preserve anchor
            if (iconSprite.anchor) {
              iconSprite.anchor.set(currentAnchorX, currentAnchorY);
            }
            
            // Set initial scale (slightly smaller for pop-in effect)
            iconSprite.scale.set(newScale * 0.9, newScale * 0.9);
            iconSprite.alpha = 1; // Ensure visible immediately
          }
          
          // Step 2: Quick scale up animation (morph effect) - fast and smooth
          morphTimeline.to(iconSprite, {
            scaleX: newScale,
            scaleY: newScale,
            duration: morphDuration, // 150ms - fast morph
            ease: 'power2.out' // Smooth ease out for natural feel
          });
          
          // Ensure sprite remains visible
          iconSprite.visible = true;
          
          // Preserve anchor
          if (iconSprite.anchor) {
            iconSprite.anchor.set(currentAnchorX, currentAnchorY);
          }
          
          // 🔥 CRITICAL: Ensure sprite is in container and visible
          if (!iconSprite.parent) {
            console.warn('⚠️ Icon sprite lost parent container, attempting to re-add...');
            if (combo.container && !combo.container.destroyed) {
              combo.container.addChildAt(iconSprite, 0);
              console.log('✅ Icon sprite re-added to container');
            }
          }
          
          // 🔥 CRITICAL: Ensure container is also visible
          if (combo.container) {
            combo.container.visible = true;
            combo.container.alpha = 1;
          }
          
          // 🔥 CRITICAL: Don't update currentIconType yet - wait for animation to complete
          // This is now set in morphTimeline.onComplete callback
          console.log(`✅ Combo icon morph animation started: ${currentIconType} -> ${targetIconType} (combo ${comboValue})`);
          console.log(`✅ Animation timeline created with duration: ${morphDuration}s`);
        } else {
          console.warn(`⚠️ Failed to get ${targetIconPath} texture or sprite destroyed`);
          if (!iconSprite || iconSprite.destroyed) {
            console.error(`❌ Icon sprite was destroyed during texture swap!`);
          } else if (!texture) {
            console.error(`❌ Texture ${targetIconPath} is null or undefined!`);
          }
        }
      } catch (err) {
        console.error(`❌ Failed to load ${targetIconPath}:`, err);
        // 🔥 CRITICAL: Ensure sprite remains visible even if loading fails
        if (iconSprite && !iconSprite.destroyed) {
          iconSprite.visible = true;
          iconSprite.alpha = 1;
        }
      }
    };
    
    loadIcon();
  }
}


// 🔥 COMBO WOBBLE: Function to start/stop wobble animation on combo icon
function updateComboWobble(comboValue) {
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.combo) return;
  
  const combo = HUD_ROOT._hudElements.combo;
  const iconSprite = combo.iconSprite;
  
  if (!iconSprite || iconSprite.destroyed) return;
  
  const shouldWobble = comboValue >= 10;
  
  // Kill existing wobble animation
  if (comboWobbleTween) {
    comboWobbleTween.kill();
    comboWobbleTween = null;
    // Reset rotation
    iconSprite.rotation = 0;
  }
  
  if (shouldWobble) {
    // Start continuous wobble animation
    comboWobbleTween = gsap.to(iconSprite, {
      rotation: 0.15, // ~8.6 degrees
      duration: 0.3,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: -1 // Infinite repeat
    });
    console.log('💧 Combo icon wobble animation started (combo >= 10)');
  }
}

export function setCombo(v){
  const val = v|0;
  if (!comboText) return;
  // 🔥 NEW HUD: Update combo number text (18px) - "x" stays constant (14px)
  comboText.text = String(val);
  // Update number text position relative to "x" text if it exists
  if (comboXText && comboText.parent) {
    comboText.x = comboXText.x + comboXText.width;
  }
  
  // 🔥 COMBO ICON SWAP: Swap icon to extra-combo-hud.png when combo >= 10
  updateComboIcon(val);
  
  // 🔥 COMBO WOBBLE: Start wobble animation when combo >= 10
  updateComboWobble(val);
  
  // 🔥 CONTAIN COMBO: Adjust combo position and scale to keep it within viewport
  if (HUD_ROOT && HUD_ROOT._hudElements && HUD_ROOT._hudElements.combo && comboWrap) {
    const combo = HUD_ROOT._hudElements.combo;
    const comboContainer = combo.container;
    
    if (comboContainer && comboContainer.parent && comboWrap.parent) {
      // Get screen width from app renderer or window
      const app = comboContainer.parent.parent?.app || (typeof window !== 'undefined' && window.STATE?.app);
      const screenWidth = app?.renderer?.width || (typeof window !== 'undefined' ? window.innerWidth : 800);
      // 🔥 USER REQUEST: 24px padding from right edge (like journey hearts)
      // Journey hearts use: margin-right: var(--pad-right, 24px) which accounts for safe-area-inset-right
      // We'll use the same approach: rightEdge = screenWidth - 24px padding
      const comboRightPadding = 24; // 24px from right edge
      const rightEdge = screenWidth - comboRightPadding; // 24px padding from right edge
      
      // Calculate total combo width (icon + spacing + "x" + number)
      const iconWidth = combo.iconSprite ? combo.iconSprite.width * combo.iconSprite.scale.x : 28;
      const xTextWidth = combo.xText ? combo.xText.width : 0;
      const numberTextWidth = combo.text ? combo.text.width : 0;
      const spacing = 4;
      const totalWidth = iconWidth + spacing + xTextWidth + numberTextWidth;
      
      // 🔥 USER REQUEST: Position combo 12px left of wild preloader right edge
      // Wild preloader: x = 24px (SIDE), width = screenWidth - 48px, so right edge = 24 + (screenWidth - 48) = screenWidth - 24px
      const SIDE = 24;
      const wildPreloaderRightEdge = screenWidth - SIDE; // vw - 24px
      // Combo right edge should be 12px left of wild preloader right edge
      const comboRightEdge = wildPreloaderRightEdge - 12; // vw - 36px
      
      // Position combo so its right edge is 12px left of wild preloader right edge
      // comboWrap.x is center, so: comboWrap.x + totalWidth/2 = comboRightEdge
      comboWrap.x = comboRightEdge - totalWidth / 2;
      
      console.log('🎯 Combo positioned 12px left of wild preloader:', { 
        wildRightEdge: wildPreloaderRightEdge, 
        comboRightEdge: comboRightEdge,
        comboCenter: comboWrap.x, 
        actualComboRightEdge: comboWrap.x + totalWidth / 2,
        totalWidth 
      });
      
      // Also scale down if still too wide after moving
      const maxAllowedWidth = screenWidth - 40; // No padding, just 40px margin for safety
      if (totalWidth > maxAllowedWidth && maxAllowedWidth > 0) {
        const scale = maxAllowedWidth / totalWidth;
        comboContainer.scale.set(Math.min(1, scale));
        console.log(`💧 Combo scaled to ${(scale * 100).toFixed(1)}% to fit on screen`);
      } else {
        comboContainer.scale.set(1);
      }
    }
  }
  
  if (val > 0) startComboFX(); else stopComboFX();
  __lastComboVal = val;
}
export function resetCombo(){
  if (!comboText) return;
  // 🔥 NEW HUD: Update combo number text (18px) - "x" stays constant (14px)
  comboText.text = '0';
  // Update number text position relative to "x" text if it exists
  if (comboXText && comboText.parent) {
    comboText.x = comboXText.x + comboXText.width;
  }
  
  // 🔥 CLEANUP: Kill all combo animations before resetting
  cleanupComboAnimations();
  
  // 🔥 COMBO ICON SWAP: Reset to normal icon when combo resets
  updateComboIcon(0);
  
  // 🔥 COMBO WOBBLE: Stop wobble animation when combo resets
  updateComboWobble(0);
  
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
  // For merge6: reduced shake strength (0.65 = 50% of 1.3) and faster animation (40% faster = 60% duration)
  const isMerge6 = (kind === 'merge6');
  const shakeStrength = isMerge6 ? 0.65 : 2.0;
  const shakeDuration = isMerge6 ? upDur * 0.54 : upDur * 0.9; // 40% faster for merge6
  const relaxDuration1 = isMerge6 ? 0.60 : 1.00; // 40% faster
  const relaxDuration2 = isMerge6 ? 0.54 : 0.90; // 40% faster
  __shakeTl
    .to(sh, { k: shakeStrength * shakeExtra, duration: shakeDuration, ease: 'power2.out' }, 0)
    .to(sh, { k: 1.4, duration: relaxDuration1, ease: 'sine.out' }, '>-0.02')
    .to(sh, { k: 1.1, duration: relaxDuration2, ease: 'sine.out' }, '>');
}

/* COMPLETELY NEW LOGIC: Simple DOM-based wild meter positioned in HUD */
export function updateProgressBar(ratio, animate = false){
  console.log('🔥 PIXI LOGIC: updateProgressBar called with:', { ratio, animate });
  
  // CRITICAL: Check if wild exists
  if (!wild) {
    console.warn('⚠️ PIXI LOGIC: Wild meter not initialized yet');
    return;
  }
  
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  
  if (wild.setProgress) {
    try {
      wild.setProgress(clamped, animate);
      console.log('✅ PIXI LOGIC: Wild meter progress updated to', Math.round(clamped * 100) + '%');
    } catch (error) {
      console.error('❌ PIXI LOGIC: Error updating wild meter:', error);
    }
  } else {
    console.warn('⚠️ PIXI LOGIC: wild.setProgress is not available');
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

/**
 * Get star HUD icon position in screen coordinates
 */
export function getStarHudPosition() {
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.star) {
    return null;
  }
  
  const starElement = HUD_ROOT._hudElements.star;
  if (!starElement.container) {
    return null;
  }
  
  // Get global position (screen coordinates)
  const globalPos = starElement.container.getGlobalPosition();
  return {
    x: globalPos.x,
    y: globalPos.y
  };
}

/**
 * Bounce animation on star HUD icon (like stack merge bounce)
 */
export function bounceStarIcon(onComplete) {
  console.log('⭐ bounceStarIcon called, has callback:', !!onComplete);
  
  if (!HUD_ROOT || !HUD_ROOT._hudElements || !HUD_ROOT._hudElements.star) {
    console.warn('⚠️ bounceStarIcon: HUD_ROOT or star element not found');
    if (onComplete && typeof onComplete === 'function') {
      onComplete();
    }
    return;
  }
  
  const starElement = HUD_ROOT._hudElements.star;
  if (!starElement.container) {
    console.warn('⚠️ bounceStarIcon: star container not found');
    if (onComplete && typeof onComplete === 'function') {
      onComplete();
    }
    return;
  }
  
  // Pop in/out animation: scale up 30% then return to original (like stacking tile animation)
  // Triggered every time star count increases (n → n+1)
  // CRITICAL: Kill previous animation to ensure clean start for each bounce
  try {
    gsap.killTweensOf(starElement.container.scale);
    if (starElement.container._bounceTimeline) {
      try {
        starElement.container._bounceTimeline.kill();
      } catch {}
    }
  } catch {}
  
  console.log('⭐ Starting bounce animation (scale 30%)');
  
  const tl = gsap.timeline({
    onComplete: () => {
      console.log('✅ Bounce animation timeline completed, calling callback');
      // Clean up timeline reference
      try {
        if (starElement.container) {
          starElement.container._bounceTimeline = null;
        }
      } catch {}
      
      // Call onComplete callback when animation finishes
      if (onComplete && typeof onComplete === 'function') {
        try {
          onComplete();
          console.log('✅ Bounce callback executed');
        } catch (err) {
          console.error('❌ Error in bounce callback:', err);
        }
      } else {
        console.warn('⚠️ No callback provided or callback is not a function');
      }
    }
  });
  
  // Store timeline reference for cleanup
  starElement.container._bounceTimeline = tl;
  
  // Pop in: scale up 30% (1.3x)
  tl.to(starElement.container.scale, { 
    x: 1.30, 
    y: 1.30, 
    duration: 0.08, 
    ease: 'power2.out' 
  });
  // Pop out: return to original size immediately
  tl.to(starElement.container.scale, { 
    x: 1.00, 
    y: 1.00, 
    duration: 0.15, 
    ease: 'back.out(1.7)' 
  });
  
  console.log('⭐ Star icon bounce animation triggered');
}

/**
 * Set stars count and update HUD display
 */
export function setStarsCount(count) {
  if (!starText) {
    console.warn('⚠️ starText not available, cannot set stars count');
    return;
  }
  
  const starsCount = Math.max(0, Math.floor(count || 0));
  starText.text = String(starsCount);
  console.log('⭐ Stars count updated to:', starsCount);
}
