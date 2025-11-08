import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js';
import { gsap } from 'gsap';

type WildishTile = Container & {
  special?: string;
  rotG?: Container;
  base?: Container & { width?: number; height?: number };
  width?: number;
  height?: number;
  destroyed?: boolean;
  isWild?: boolean;
  isWildFace?: boolean;
  _wildStarSystem?: WildStarSystem | null;
};

interface OrbitingStar {
  sprite: Sprite | Graphics;
  angle: number;
  speed: number;
  direction: number; // -1 za suprotno od kazaljke, 1 za smjer kazaljke
  orbitRadius: number;
  radiusJitter: number;
  radiusJitterSpeed: number;
  pulseSpeed: number;
  pulsePhase: number;
  baseScale: number;
  rotationSpeed: number; // Brzina oscilacije rotacije
  rotationPhase: number; // Početna faza za rotaciju
  rotationAmplitude: number; // Amplituda rotacije (4-8 stupnjeva)
  scaleNormalizer: number;
}

interface WildStarSystem {
  tile: WildishTile;
  host: Container;
  container: Container;
  stars: OrbitingStar[];
  ticker: (() => void) | null;
  disposed: boolean;
}

const STAR_TEXTURE_SOURCES = [
  './assets/small-star@3x.png',
  './assets/small-star@2x.png',
  './assets/small-star.png',
];

const systems = new WeakMap<WildishTile, WildStarSystem>();

let cachedTexture: Texture | null = null;

const BABY_STAR_COUNT = 3;
const BASE_RADIUS_FACTOR = 0.6;
const STAR_TARGET_SIZE = 56; // Maksimalna veličina zvijezdice u px
const ORBIT_SPEED = 0.04;
const DELTA_MIN = 0.55;
const DELTA_MAX = 2.0;

function tileIsPureWild(tile: WildishTile | null | undefined): tile is WildishTile {
  if (!tile) return false;
  if (tile.special === 'wild-magnet') return false;
  if (tile.special === 'wild') return true;
  return tile.isWild === true || tile.isWildFace === true;
}

function loadTextureFromSource(source: string): Texture | null {
  console.log('🌟 Attempting to load star texture from:', source);
  try {
    // Prvo pokušaj Assets.get() - ako je već učitano
    let texture = Assets.get(source);
    if (texture && texture instanceof Texture) {
      console.log('✅ Got texture from Assets.get():', texture, 'width:', texture.width, 'height:', texture.height);
      return texture;
    }
    
    // Fallback na Texture.from() - direktno učitavanje
    texture = Texture.from(source);
    console.log('✅ Got texture from Texture.from():', texture, 'width:', texture.width, 'height:', texture.height);
    
    // Čekaj da se tekstura učita ako nije spremna
    if (texture && texture.baseTexture) {
      if (texture.baseTexture.valid) {
        console.log('✅ Texture is valid and ready!');
        return texture;
      } else {
        console.log('⏳ Texture not yet valid, but returning anyway - will load async');
        // Vratimo teksturu iako još nije valid - PIXI će je učitati asinkrono
        return texture;
      }
    }
    
    console.warn('⚠️ Could not create texture from:', source);
    return null;
  } catch (err) {
    console.error('❌ Failed to load texture from:', source, err);
    return null;
  }
}

function ensureTexture(): Texture | null {
  if (cachedTexture) {
    console.log('✅ Using cached texture');
    return cachedTexture;
  }

  console.log('🔄 Starting texture load from sources:', STAR_TEXTURE_SOURCES);
  for (let i = 0; i < STAR_TEXTURE_SOURCES.length; i++) {
    const source = STAR_TEXTURE_SOURCES[i];
    console.log(`🔄 Trying source ${i + 1}/${STAR_TEXTURE_SOURCES.length}:`, source);
    const texture = loadTextureFromSource(source);
    if (texture) {
      console.log('✅ Texture loaded and cached successfully!', texture);
      cachedTexture = texture;
      return texture;
    }
  }
  
  console.error('❌ All texture sources failed!');
  return null;
}

function clampDelta(delta: number): number {
  if (!Number.isFinite(delta)) return 1;
  if (delta < DELTA_MIN) return DELTA_MIN;
  if (delta > DELTA_MAX) return DELTA_MAX;
  return delta;
}

function computeHostMetrics(tile: WildishTile, host: Container) {
  const width = Math.max(1, tile.base?.width || (host as any).width || tile.width || 96);
  const height = Math.max(1, tile.base?.height || (host as any).height || tile.height || 96);
  return { width, height };
}

function createFallbackStar(): Graphics {
  const g = new Graphics();
  g.star(0, 0, 5, STAR_TARGET_SIZE * 0.5, STAR_TARGET_SIZE * 0.25).fill({ color: 0xFFE7B5, alpha: 1.0 });
  g.lineStyle(undefined);
  g.name = 'wild-baby-star-placeholder';
  g.alpha = 1.0;
  g.visible = true;
  g.renderable = true;
  console.log(`🌟 Fallback star created: size=${STAR_TARGET_SIZE}, visible=${g.visible}, alpha=${g.alpha}`);
  return g;
}

function createStarSprite(texture: Texture, star: OrbitingStar): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.name = 'wild-baby-star';
  sprite.blendMode = 1;
  sprite.alpha = 1.0; // Full opacity
  sprite.visible = true; // FORSIRANO vidljivo
  sprite.renderable = true; // FORCE renderable

  const baseWidth = Math.max(1, sprite.texture?.width ?? STAR_TARGET_SIZE);
  const normalizer = STAR_TARGET_SIZE / baseWidth;
  star.scaleNormalizer = normalizer;
  sprite.scale.set(normalizer * star.baseScale);
  
  console.log(`🌟 Sprite created: width=${baseWidth}, normalizer=${normalizer}, final scale=${normalizer * star.baseScale}, visible=${sprite.visible}, alpha=${sprite.alpha}, renderable=${sprite.renderable}`);

  return sprite;
}

function setupStars(system: WildStarSystem, texture: Texture): void {
  system.container.removeChildren();
  system.stars = [];

  console.log('🌟 Creating stars with texture:', texture);

  for (let i = 0; i < BABY_STAR_COUNT; i += 1) {
    const star: OrbitingStar = {
      sprite: null as unknown as Sprite | Graphics,
      angle: (Math.PI * 2 * i) / BABY_STAR_COUNT,
      speed: 0.4 + Math.random() * 0.3, // Sporije brzine
      direction: i === 0 ? 1 : -1, // Prva u smjeru kazaljke, ostale suprotno
      orbitRadius: 0.6 + Math.random() * 0.1,
      radiusJitter: 0.05 + Math.random() * 0.04,
      radiusJitterSpeed: 0.85 + Math.random() * 0.6,
      pulseSpeed: 1.1 + Math.random() * 0.3,
      pulsePhase: Math.random() * Math.PI * 2,
      baseScale: 0.90 + Math.random() * 0.15, // Random scale: 90% (10% manje) do 105% (5% veće) od maksimalne veličine
      rotationSpeed: 0.5 + Math.random() * 0.3, // Brzina oscilacije rotacije
      rotationPhase: Math.random() * Math.PI * 2, // Početna faza za rotaciju
      rotationAmplitude: (4 + Math.random() * 4) * (Math.PI / 180), // 4-8 stupnjeva u radijanima
      scaleNormalizer: 1,
    };

    // FORSIRANO koristimo samo teksturu - NEMA fallback-a!
    const display = createStarSprite(texture, star);
    star.sprite = display;
    system.stars.push(star);
    system.container.addChild(display);
    console.log(`✅ Star ${i + 1} created with texture sprite`);
  }
  
  console.log('✅ All stars created with texture!');
}

function upgradeStarsToTexture(system: WildStarSystem, texture: Texture): void {
  if (system.disposed) return;

  system.stars.forEach((star) => {
    if (star.sprite instanceof Sprite && star.sprite.texture === texture) return;

    const parent = star.sprite.parent || system.container;
    const { x, y, rotation, alpha } = star.sprite;

    let newSprite: Sprite;
    try {
      newSprite = createStarSprite(texture, star);
    } catch {
      return;
    }

    newSprite.position.set(x, y);
    newSprite.rotation = rotation;
    newSprite.alpha = 1.0; // Full opacity

    parent.addChild(newSprite);
    parent.removeChild(star.sprite);
    star.sprite.destroy?.();

    star.sprite = newSprite;
  });
}

function tickSystem(system: WildStarSystem): void {
  if (system.disposed) return;
  const { tile, host, container } = system;

  if (!tile || (tile as any).destroyed || !host.parent) {
    detachWildStarHalo(tile);
    return;
  }

  // FORCE visibility
  container.visible = true;
  container.alpha = 1.0;

  const { width, height } = computeHostMetrics(tile, host);
  container.x = 0;
  container.y = 0;
  const baseRadius = Math.max(width, height) * BASE_RADIUS_FACTOR;
  const delta = clampDelta(typeof gsap.ticker.deltaRatio === 'function' ? gsap.ticker.deltaRatio() : 1);
  const time = performance.now() * 0.001;

  system.stars.forEach((star) => {
    // FORCE visibility for each star
    star.sprite.visible = true;
    star.sprite.alpha = 1.0;

    star.angle += star.speed * star.direction * delta * ORBIT_SPEED;

    const wobble = Math.sin(time * star.radiusJitterSpeed + star.pulsePhase) * star.radiusJitter;
    const radius = baseRadius * (star.orbitRadius + wobble);

    star.sprite.x = Math.cos(star.angle) * radius;
    star.sprite.y = Math.sin(star.angle) * radius;
    
    // Lagana oscilacija rotacije unutar 4-8 stupnjeva
    star.sprite.rotation = Math.sin(time * star.rotationSpeed + star.rotationPhase) * star.rotationAmplitude;

    const pulse = star.baseScale * (0.92 + Math.sin(time * star.pulseSpeed + star.pulsePhase) * 0.1);
    star.sprite.scale.set(star.scaleNormalizer * pulse);
  });
}

export function attachWildStarHalo(tile: WildishTile | null | undefined): void {
  if (!tileIsPureWild(tile)) return;

  detachWildStarHalo(tile);

  const host = (tile.rotG as Container) || tile;
  if (!host) return;

  const container = new Container();
  container.name = 'wild-baby-star-orbit';
  container.sortableChildren = false;
  container.zIndex = 2600;
  container.alpha = 0; // Sakrij dok se tekstura ne učita
  container.visible = true; // FORSIRANO vidljivo
  container.renderable = true; // FORCE renderable

  try {
    host.sortableChildren = true;
    host.addChild(container);
    host.sortChildren?.();
  } catch {
    container.destroy?.();
    return;
  }

  const system: WildStarSystem = {
    tile,
    host,
    container,
    stars: [],
    ticker: null,
    disposed: false,
  };

  systems.set(tile, system);
  (tile as any)._wildStarSystem = system;

  // Učitaj teksturu direktno - jednostavnije i sigurnije
  console.log('🔄 Loading star texture...');
  const texture = ensureTexture();
  
  if (texture) {
    console.log('✅ Texture loaded successfully!', texture);
    console.log('✅ Texture dimensions:', texture.width, 'x', texture.height);
    console.log('✅ Texture valid:', texture.baseTexture?.valid);
    
    // Tekstura je spremna, sada kreiramo zvijezdice SA TEKSTUROM
    setupStars(system, texture);
    
    // FORCE visibility - prikaži container i provjeri da li su zvijezdice vidljive
    container.alpha = 1.0;
    container.visible = true;
    container.renderable = true;
    console.log('✅ Stars created and container shown!');
    console.log('✅ Container visible:', container.visible, 'alpha:', container.alpha, 'renderable:', container.renderable);
    console.log('✅ Container position:', container.x, container.y);
    console.log('✅ Container parent:', container.parent?.name || 'none');
    console.log('✅ Stars count:', system.stars.length);
    system.stars.forEach((star, i) => {
      star.sprite.visible = true;
      star.sprite.alpha = 1.0;
      star.sprite.renderable = true;
      console.log(`✅ Star ${i + 1}: visible=${star.sprite.visible}, alpha=${star.sprite.alpha}, scale=${star.sprite.scale.x}, position=(${star.sprite.x}, ${star.sprite.y})`);
    });
    
    // Pokreni animaciju
    const ticker = () => tickSystem(system);
    system.ticker = ticker;
    gsap.ticker.add(ticker);
  } else {
    console.error('❌ CRITICAL: Wild star texture failed to load!');
    console.error('❌ Tried sources:', STAR_TEXTURE_SOURCES);
    console.error('❌ Creating fallback stars anyway...');
    
    // Kreiraj fallback zvijezdice ako tekstura ne uspije
    system.container.removeChildren();
    system.stars = [];
    for (let i = 0; i < BABY_STAR_COUNT; i += 1) {
      const star: OrbitingStar = {
        sprite: null as unknown as Sprite | Graphics,
        angle: (Math.PI * 2 * i) / BABY_STAR_COUNT,
        speed: 0.4 + Math.random() * 0.3,
        direction: i === 0 ? 1 : -1, // Prva u smjeru kazaljke, ostale suprotno
        orbitRadius: 0.6 + Math.random() * 0.1,
        radiusJitter: 0.05 + Math.random() * 0.04,
        radiusJitterSpeed: 0.85 + Math.random() * 0.6,
        pulseSpeed: 1.1 + Math.random() * 0.3,
        pulsePhase: Math.random() * Math.PI * 2,
        baseScale: 0.90 + Math.random() * 0.15, // Random scale: 90% (10% manje) do 105% (5% veće) od maksimalne veličine
        rotationSpeed: 0.5 + Math.random() * 0.3,
        rotationPhase: Math.random() * Math.PI * 2,
        rotationAmplitude: (4 + Math.random() * 4) * (Math.PI / 180),
        scaleNormalizer: 1,
      };
      const display = createFallbackStar();
      star.sprite = display;
      system.stars.push(star);
      system.container.addChild(display);
    }
    container.alpha = 1.0;
    container.visible = true;
    container.renderable = true;
    
    const ticker = () => tickSystem(system);
    system.ticker = ticker;
    gsap.ticker.add(ticker);
  }
}

export function detachWildStarHalo(tile: WildishTile | null | undefined): void {
  if (!tile) return;

  const system = systems.get(tile) || (tile as any)._wildStarSystem;
  if (!system) return;

  system.disposed = true;

  if (system.ticker) {
    try { gsap.ticker.remove(system.ticker); } catch {}
    system.ticker = null;
  }

  system.stars.forEach((star) => {
    try { star.sprite.destroy?.(); } catch {}
  });
  system.stars = [];

  try {
    if (system.container.parent) {
      system.container.parent.removeChild(system.container);
    }
    system.container.destroy?.({ children: true });
  } catch {}

  systems.delete(tile);
  (tile as any)._wildStarSystem = null;
}

export function preloadWildStarTexture(): void {
  ensureTexture();
  // swallow preload errors silently
}
