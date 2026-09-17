import {
  acquireAnimatedSpecialArtworkLayer,
  getAnimatedSpecialArtworkCarrierForegroundRoot,
  getAnimatedSpecialArtworkSpawnedDieForegroundRoot,
  type AnimatedSpecialArtworkFrame,
} from './animated-special-artwork-layer.ts';

type SpawnForeground = {
  setFrame: (source: string) => void;
  release: () => void;
  handoffToCanvas: (renderer: any, startPresentation: () => void, onComplete?: () => void) => void;
};

// The carrier and its emitted die use adjacent DOM layers above Pixi's canvas.
// Stable per-source images keep either visual from jumping layers during load.
function createSpawnForeground(
  sprite: any,
  playbackSources: readonly string[],
  getRoot: () => HTMLDivElement | null,
  className: string,
): SpawnForeground {
  const images = new Map<string, HTMLImageElement>();
  let desiredSource = playbackSources[0] || '';
  let displayedSource = '';
  let displayedWidth = sprite.texture?.width || 1;
  let displayedHeight = sprite.texture?.height || 1;
  let released = false;
  let handingOff = false;
  let detachRenderObserver: (() => void) | null = null;
  let handoffComplete: (() => void) | undefined;

  const sync = (frame: AnimatedSpecialArtworkFrame) => {
    const desiredImage = images.get(desiredSource);
    if (desiredImage?.complete && desiredImage.naturalWidth > 0 && displayedSource !== desiredSource) {
      const previous = images.get(displayedSource);
      if (previous) previous.style.visibility = 'hidden';
      displayedSource = desiredSource;
    }
    // Pixi can finish decoding after the DOM image. Its new texture changes
    // local scale, so mirror dimensions must follow in that same sync. Keep
    // the previous ready frame's geometry while a different carrier frame loads.
    if (displayedSource && displayedSource === desiredSource) {
      displayedWidth = sprite.texture?.width || desiredImage?.naturalWidth || 1;
      displayedHeight = sprite.texture?.height || desiredImage?.naturalHeight || 1;
    }
    const image = images.get(displayedSource);
    if (!image || sprite.destroyed || !sprite.worldTransform || !image.parentElement
      || !frame.canvasRect.width || !frame.canvasRect.height) {
      if (image) image.style.visibility = 'hidden';
      if (!handingOff && !sprite.destroyed) sprite.renderable = true;
      return;
    }
    const transform = sprite.worldTransform;
    const sx = frame.canvasRect.width / Math.max(1, frame.screenWidth);
    const sy = frame.canvasRect.height / Math.max(1, frame.screenHeight);
    image.style.width = `${displayedWidth}px`;
    image.style.height = `${displayedHeight}px`;
    image.style.transform = `matrix(${transform.a * sx}, ${transform.b * sy}, ${transform.c * sx}, ${transform.d * sy}, ${
      frame.canvasRect.left - frame.rootRect.left + (transform.tx - transform.a * sprite.anchor.x * displayedWidth - transform.c * sprite.anchor.y * displayedHeight) * sx
    }, ${
      frame.canvasRect.top - frame.rootRect.top + (transform.ty - transform.b * sprite.anchor.x * displayedWidth - transform.d * sprite.anchor.y * displayedHeight) * sy
    })`;
    const worldAlpha = Number.isFinite(sprite.worldAlpha) ? sprite.worldAlpha : sprite.alpha;
    image.style.opacity = String(worldAlpha * frame.canvasOpacity);
    let visible = sprite.visible !== false;
    for (let ancestor = sprite.parent; ancestor && visible; ancestor = ancestor.parent) {
      visible = ancestor.visible !== false;
    }
    image.style.visibility = visible ? 'visible' : 'hidden';
    if (!handingOff) sprite.renderable = false;
  };

  const lease = acquireAnimatedSpecialArtworkLayer(sync);
  const parent = lease && getRoot();
  if (!lease || !parent) {
    lease?.release();
    return { setFrame: () => {}, release: () => {}, handoffToCanvas: (_renderer, start, done) => { start(); done?.(); } };
  }
  for (const source of new Set(playbackSources)) {
    const image = new Image();
    image.className = className;
    image.alt = '';
    image.draggable = false;
    image.setAttribute('aria-hidden', 'true');
    Object.assign(image.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '1px',
      height: '1px',
      transformOrigin: '0 0',
      pointerEvents: 'none',
      visibility: 'hidden',
    });
    images.set(source, image);
    parent.appendChild(image);
    image.onload = () => { if (!released) lease.requestSync(); };
    image.onerror = () => { if (!released) lease.requestSync(); };
    image.src = source;
  }
  lease.requestSync();

  const release = () => {
    if (released) return;
    released = true;
    detachRenderObserver?.();
    detachRenderObserver = null;
    for (const image of images.values()) {
      image.onload = null;
      image.onerror = null;
      image.remove();
    }
    images.clear();
    // Once handed to idle, renderability belongs to its replacement artwork.
    if (!handingOff && !sprite.destroyed) sprite.renderable = true;
    lease.release();
    handoffComplete?.();
    handoffComplete = undefined;
  };

  return {
    setFrame: (source) => {
      if (released || !images.has(source)) return;
      desiredSource = source;
      lease.requestSync();
    },
    release,
    handoffToCanvas: (renderer, startPresentation, onComplete) => {
      if (released || handingOff) return;
      handingOff = true;
      handoffComplete = onComplete;
      if (!sprite.destroyed) sprite.renderable = true;
      // Start idle only after restoring its fallback. Pending media/phase loads
      // keep that same fallback visible; ready idle may now suppress it itself.
      try { startPresentation(); } catch {}
      const runners = renderer?.runners;
      if (!runners?.prerender?.add || !runners?.postrender?.add) {
        release();
      } else {
        let paintedOptions: any = null;
        const observer = {
          prerender: (options: any) => {
            paintedOptions = null;
            if (sprite.destroyed || !sprite.parent) { release(); return; }
            if (options.target !== renderer.view?.renderTarget) return;
            for (let ancestor = sprite; ancestor; ancestor = ancestor.parent) {
              if (ancestor.visible === false) return;
              if (ancestor === options.container) { paintedOptions = options; return; }
            }
          },
          postrender: (options: any) => {
            // Ignore offscreen renders and a render already underway when the
            // transfer began. The replacement must have entered this paint.
            if (paintedOptions === options) release();
          },
          destroy: release,
        };
        detachRenderObserver = () => {
          runners.prerender.remove(observer);
          runners.postrender.remove(observer);
          runners.destroy?.remove(observer);
        };
        runners.prerender.add(observer);
        runners.postrender.add(observer);
        runners.destroy?.add(observer);
      }
    },
  };
}

export function createCarrierForeground(sprite: any, playbackSources: readonly string[]): SpawnForeground {
  return createSpawnForeground(
    sprite,
    playbackSources,
    getAnimatedSpecialArtworkCarrierForegroundRoot,
    'cc-wild-spawn-carrier-foreground',
  );
}

export function createSpawnedDieForeground(sprite: any, source: string): SpawnForeground {
  return createSpawnForeground(
    sprite,
    [source],
    getAnimatedSpecialArtworkSpawnedDieForegroundRoot,
    'cc-wild-spawn-die-foreground',
  );
}
