import {
  acquireAnimatedSpecialArtworkLayer,
  getAnimatedSpecialArtworkCarrierForegroundRoot,
  getAnimatedSpecialArtworkSpawnedDieForegroundRoot,
  type AnimatedSpecialArtworkFrame,
} from './animated-special-artwork-layer.ts';

type SpawnForeground = {
  setFrame: (source: string) => void;
  release: () => void;
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

  const sync = (frame: AnimatedSpecialArtworkFrame) => {
    const desiredImage = images.get(desiredSource);
    if (desiredImage?.complete && desiredImage.naturalWidth > 0 && displayedSource !== desiredSource) {
      const previous = images.get(displayedSource);
      if (previous) previous.style.visibility = 'hidden';
      displayedSource = desiredSource;
      displayedWidth = sprite.texture?.width || desiredImage.naturalWidth;
      displayedHeight = sprite.texture?.height || desiredImage.naturalHeight;
    }
    const image = images.get(displayedSource);
    if (!image || sprite.destroyed || !sprite.worldTransform || !image.parentElement
      || !frame.canvasRect.width || !frame.canvasRect.height) {
      if (image) image.style.visibility = 'hidden';
      if (!sprite.destroyed) sprite.renderable = true;
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
    sprite.renderable = false;
  };

  const lease = acquireAnimatedSpecialArtworkLayer(sync);
  const parent = lease && getRoot();
  if (!lease || !parent) {
    lease?.release();
    return { setFrame: () => {}, release: () => {} };
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

  return {
    setFrame: (source) => {
      if (released || !images.has(source)) return;
      desiredSource = source;
      lease.requestSync();
    },
    release: () => {
      if (released) return;
      released = true;
      for (const image of images.values()) {
        image.onload = null;
        image.onerror = null;
        image.remove();
      }
      images.clear();
      if (!sprite.destroyed) sprite.renderable = true;
      lease.release();
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
