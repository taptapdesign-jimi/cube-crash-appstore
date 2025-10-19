// public/src/modules/stars-modal.js
import { Container, Text, Graphics } from 'pixi.js';
import { gsap } from 'gsap';

export async function showStarsModal({ app, stage, board, score }) {
  return new Promise(resolve => {
    const LAYER_NAME = 'cc-stars-modal';
    let layer = stage.children?.find?.(c => c && c.label === LAYER_NAME);
    if (!layer || layer.destroyed) {
      layer = new Container();
      layer.label = LAYER_NAME;
      layer.zIndex = 16000;
      stage.addChild(layer); try { stage.sortChildren(); } catch {}
    }
    gsap.killTweensOf(layer, true);
    layer.removeChildren(); layer.visible = true; layer.alpha = 0;
    gsap.to(layer, { alpha: 1, duration: 0.25 });

    // Title
    const title = new Text({
      text: 'Level complete',
      style: { fontFamily:'LTCrow', fontWeight:'800', fill: 0x8a6e57 }
    });
    title.anchor.set(0.5,0);

    // Subtitle
    const subtitle = new Text({
      text: `Score ${score}`,
      style: { fontFamily:'LTCrow', fontWeight:'500', fill: 0x725B4C }
    });
    subtitle.anchor.set(0.5,0);

    // CTA button
    const btn = (() => {
      const g = new Graphics();
      const t = new Text({ text:'continue', style:{ fontFamily:'LTCrow', fontWeight:'800', fill: 0xFFFFFF } });
      t.anchor.set(0.5);
      const b = new Container(); b.addChild(g, t);
      b.eventMode='static'; b.cursor='pointer';
      b.onpointerdown = ()=> { 
        // CRITICAL FIX: Update high score before resolving
        if (typeof window.updateHighScore === 'function') {
          try {
            window.updateHighScore(score);
            console.log('✅ stars-modal: window.updateHighScore called with score:', score);
          } catch (error) {
            console.warn('⚠️ stars-modal: Failed to call window.updateHighScore:', error);
          }
        }
        
        // CRITICAL FIX: Clear saved game state when level is completed
        // This prevents the user from being able to "continue" after level completion
        try {
          localStorage.removeItem('cc_saved_game');
          localStorage.removeItem('cubeCrash_gameState');
          console.log('✅ stars-modal: Cleared both saved game states after level completion');
        } catch (error) {
          console.warn('⚠️ stars-modal: Failed to clear saved game state:', error);
        }
        resolve({ action:'continue' }); cleanup(); 
      };
      let touchStarted = false;
      let touchStartedOnButton = false;
      
      b.on('pointerover', ()=> gsap.to(b.scale, { x:1.00, y:1.00, duration:0.35, ease: "power2.out" }));
      b.on('pointerout',  ()=> gsap.to(b.scale, { x:1.00, y:1.00, duration:0.35, ease: "power2.out" }));
      
      b.on('pointerdown', (e) => {
        touchStarted = true;
        touchStartedOnButton = true;
        gsap.to(b.scale, { x:0.80, y:0.80, duration:0.35, ease: "power2.out" });
      });
      
      b.on('globalpointermove', (e) => {
        if (touchStarted && touchStartedOnButton) {
          // Check if touch moved outside button
          const bounds = b.getBounds();
          const isOutside = e.global.x < bounds.x || e.global.x > bounds.x + bounds.width || 
                           e.global.y < bounds.y || e.global.y > bounds.y + bounds.height;
          
          if (isOutside) {
            // Cancel the touch - reset button
            gsap.to(b.scale, { x:1.00, y:1.00, duration:0.35, ease: "power2.out" });
            touchStartedOnButton = false;
          }
        }
      });
      
      b.on('pointerup', (e) => {
        if (touchStarted && touchStartedOnButton) {
          // Only trigger if touch ended on button
          const bounds = b.getBounds();
          const isOnButton = e.global.x >= bounds.x && e.global.x <= bounds.x + bounds.width && 
                            e.global.y >= bounds.y && e.global.y <= bounds.y + bounds.height;
          
          if (isOnButton) {
            // Trigger the original action
            if (typeof window.updateHighScore === 'function') {
              try {
                window.updateHighScore(score);
                console.log('✅ stars-modal: window.updateHighScore called with score:', score);
              } catch (error) {
                console.warn('⚠️ stars-modal: Failed to call window.updateHighScore:', error);
              }
            }
            resolve({ action:'continue' }); cleanup();
          }
        }
        
        // Reset button
        gsap.to(b.scale, { x:1.00, y:1.00, duration:0.35, ease: "power2.out" });
        touchStarted = false;
        touchStartedOnButton = false;
      });
      return b;
    })();

    layer.addChild(title, subtitle, btn);

    function position() {
      const vw = app.renderer.width, vh = app.renderer.height;
      const COL_W = Math.min(318, vw - 32);
      const colScale = COL_W / 318;
      const cx = vw/2;

      const H  = Math.round(40 * colScale);
      const P  = Math.round(16 * colScale);
      const SP16 = Math.round(16 * colScale);
      const SP64 = Math.round(64 * colScale);

      title.style.fontSize = H;
      subtitle.style.fontSize = P;

      title.x = cx; title.y = 100;
      subtitle.x = cx; subtitle.y = title.y + H + SP16;

      // Button
      const padX = Math.round(64 * colScale);
      const padY = Math.round(24 * colScale);
      const rad  = Math.round(16 * colScale);
      const g = btn.children[0]; const t = btn.children[1];
      t.style.fontSize = Math.round(24 * colScale);
      const btnW = Math.max(200 * colScale, t.width + padX * 2);
      const btnH = Math.max(48 * colScale, t.height + padY * 2);
      g.clear(); g.roundRect(-btnW/2, -btnH/2, btnW, btnH, rad).fill(0xB88C73);
      btn.x = cx; btn.y = subtitle.y + P + SP64;
    }
    position();
    const onResize = () => position();
    window.addEventListener('resize', onResize);

    function cleanup() {
      try { window.removeEventListener('resize', onResize); } catch {}
      try { layer.removeChildren(); } catch {}
      try { stage.removeChild(layer); } catch {}
    }
  });
}