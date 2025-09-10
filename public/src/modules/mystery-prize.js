// public/src/modules/mystery-prize.js
// Crate → tap → coin → copy swap → collect → fly-to-corner → cleanup

import { Assets, Container, Graphics, Text, Texture, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import * as CONSTS from './constants.js';

// fallback putanje ako constants.js ne izveze (defanzivno)
const ASSET_MYSTERY = CONSTS.ASSET_MYSTERY || '/assets/mistery-box.png';
const ASSET_COIN    = CONSTS.ASSET_COIN    || '/assets/gold-coin.png';

export async function showMysteryPrize(ctx) {
  const { app, stage, board, TILE = 128 } = ctx;

  // osiguraj da su asseti učitani (idempotentno)
  try { await Assets.load([ASSET_MYSTERY, ASSET_COIN]); } catch {}

  // sakrij ploču dok je overlay gore
  const prevBoardVisible = board?.visible !== false;
  if (board) board.visible = false;

  // pripremi overlay
  const LAYER_NAME = 'cc-mystery-layer';
  let layer = stage.children?.find?.(c => c && c.label === LAYER_NAME);
  if (!layer || layer.destroyed) {
    layer = new Container();
    layer.label = LAYER_NAME;
    layer.zIndex = 15000;
    stage.addChild(layer);
    try { stage.sortChildren(); } catch {}
  }
  gsap.killTweensOf(layer, true);
  try { layer.removeChildren(); } catch {}
  layer.visible = true; layer.alpha = 0;
  gsap.to(layer, { alpha: 1, duration: 0.20 });

  const vw = app.renderer.width, vh = app.renderer.height;
  const cx = vw / 2, cy = vh / 2;

  // naslov i podnaslov
  const title = new Text({
    text: 'Mystery prize',
    style: { fontFamily: 'LTCrow', fontWeight: '800', fontSize: Math.round(TILE * 0.45), fill: 0x8a6e57 }
  });
  title.anchor.set(0.5); title.x = cx; title.y = Math.max(TILE * 0.6, cy - TILE * 2.0);
  layer.addChild(title);

  const subtitle = new Text({
    text: 'Tap to open!',
    style: { fontFamily: 'LTCrow', fontWeight: '600', fontSize: Math.round(TILE * 0.22), fill: 0x8a6e57, }
  });
  subtitle.anchor.set(0.5); subtitle.x = cx; subtitle.y = Math.max(TILE * 1.1, cy - TILE * 1.4);
  layer.addChild(subtitle);

  // crate i coin (coin iste širine kao crate)
  const crateTex = Assets.get(ASSET_MYSTERY) || Texture.from(ASSET_MYSTERY);
  const baseW    = (crateTex.width || (crateTex.orig && crateTex.orig.width) || 512);
  const targetW  = Math.min(TILE * 2.2, Math.min(vw, vh) * 0.38);
  const scale    = targetW / baseW;

  const crate = new Sprite(crateTex); crate.anchor.set(0.5); crate.x = cx; crate.y = cy; crate.scale.set(scale);
  layer.addChild(crate);

  const coinTex = Assets.get(ASSET_COIN) || Texture.from(ASSET_COIN);
  const coin    = new Sprite(coinTex); coin.anchor.set(0.5); coin.x = cx; coin.y = cy + TILE * 0.05; coin.scale.set(scale); coin.alpha = 0;
  layer.addChild(coin);

  // tap to open
  await new Promise(resolveOpen => {
    layer.eventMode = 'static'; layer.cursor = 'pointer';
    layer.onpointerdown = () => {
      layer.onpointerdown = null;
      const tl = gsap.timeline();
      tl.to(crate, { rotation: 0.10, duration: 0.10 })
        .to(crate, { rotation: -0.10, duration: 0.12 })
        .to(crate, { rotation: 0, duration: 0.12 })
        .to(crate, { alpha: 0, duration: 0.16 }, '-=0.06')
        .add(() => {
          crate.visible = false;
          gsap.timeline()
            .fromTo(coin,       { alpha: 0 },       { alpha: 1, duration: 0.08 })
            .fromTo(coin.scale, { x: 0.98, y: 0.98 }, { x: 1.02, y: 1.02, duration: 0.18, ease: 'power3.out' }) // micro bounce ≤2%
            .to(coin.scale,     { x: 1.00, y: 1.00, duration: 0.14, ease: 'sine.out', onComplete: resolveOpen });
        });
    };
  });

  // copy swap
  title.text = 'Golden coin';
  try { layer.removeChild(subtitle); } catch {}
  const body = new Text({
    text: 'collect coins by opening your mystery\nprizes after clearing the board. Use them\nto upgrade your game',
    style: { fontFamily: 'LTCrow', fontWeight: '500', fontSize: Math.round(TILE * 0.20), fill: 0x8a6e57, align: 'center', leading: 6 }
  });
  body.anchor.set(0.5); body.x = cx; body.y = title.y + TILE * 0.75;
  layer.addChild(body);

  // collect gumb
  const btn = (() => {
    const g = new Graphics();
    const padX = Math.max(140, Math.min(vw, vh) * 0.30);
    const padY = Math.max(20,  TILE * 0.28);
    const r    = Math.round(TILE * 0.22);
    g.roundRect(-padX, -padY, padX * 2, padY * 2, r).fill(0xB88C73);
    const t = new Text({ text: 'collect', style: { fontFamily: 'LTCrow', fontWeight: '700', fontSize: Math.round(TILE * 0.28), fill: 0xFFFFFF } });
    t.anchor.set(0.5);
    const btn = new Container(); btn.addChild(g, t);
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.onpointerdown = () => btn.emit('click');
    btn.on('pointerover', () => gsap.to(btn.scale, { x: 1.04, y: 1.04, duration: 0.08 }));
    btn.on('pointerout',  () => gsap.to(btn.scale, { x: 1.00, y: 1.00, duration: 0.08 }));
    return btn;
  })();
  btn.x = cx; btn.y = cy + TILE * 1.75;
  layer.addChild(btn);

  // click → coin odleti gore desno → overlay fade → cleanup
  await new Promise(resolve => {
    btn.on('click', () => {
      const targetX = app.renderer.width - TILE * 0.8;
      const targetY = TILE * 0.8;
      gsap.timeline({ onComplete: resolve })
        .to(coin, { x: targetX, y: targetY, scaleX: 0.10, scaleY: 0.10, duration: 0.75, ease: 'power2.in' })
        .to(layer, { alpha: 0, duration: 0.20 }, '-=0.30');
    });
  });

  // cleanup & vrati ploču
  try { layer.removeChildren(); } catch {}
  try { stage.removeChild(layer); } catch {}
  if (board) board.visible = prevBoardVisible;
}