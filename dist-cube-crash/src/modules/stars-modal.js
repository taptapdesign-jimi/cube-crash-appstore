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
      b.onpointerdown = ()=> { resolve({ action:'continue' }); cleanup(); };
      b.on('pointerover', ()=> gsap.to(b.scale, { x:1.04, y:1.04, duration:0.08 }));
      b.on('pointerout',  ()=> gsap.to(b.scale, { x:1.00, y:1.00, duration:0.08 }));
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