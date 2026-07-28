// @ts-nocheck
import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js';
import { gsap } from 'gsap';
import { getSpecialDiceVariantForTile, isSpecialDiceDirectWildLikeTile } from './special-dice-registry.ts';
import { shouldRenderWildStarOrbit } from './run-mode.ts';

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
  revealAt?: number;
  revealed?: boolean;
  introAnimating?: boolean;
}

interface WildStarSystem {
  tile: WildishTile;
  host: Container;
  container: Container;
  stars: OrbitingStar[];
  ticker: (() => void) | null;
  disposed: boolean;
  lastUpdateTime: number;
  updateIntervalMs: number;
  introBounce?: boolean;
  textureSources?: string[];
}

const STAR_TEXTURE_SOURCES = [
  './assets/small-star@3x.png',
  './assets/small-star@2x.png',
  './assets/small-star.png',
];

const systems = new WeakMap<WildishTile, WildStarSystem>();
const activeSystems = new Set<WildStarSystem>();
let sharedTicker: (() => void) | null = null;

const cachedTextures = new Map<string, Texture>();
const isDev = !!(import.meta as any)?.env?.DEV;
const debugLog = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

const MIN_BABY_STAR_COUNT = 1;
const MAX_BABY_STAR_COUNT = 3;
const BASE_RADIUS_FACTOR = 0.6;
const STAR_TARGET_SIZE = 56; // Maksimalna veličina zvijezdice u px
const ORBIT_SPEED = 0.04;
const DELTA_MIN = 0.55;
const DELTA_MAX = 2.0;

function getRandomBabyStarCount(): number {
  return MIN_BABY_STAR_COUNT + Math.floor(Math.random() * (MAX_BABY_STAR_COUNT - MIN_BABY_STAR_COUNT + 1));
}

function tileIsPureWild(tile: WildishTile | null | undefined): tile is WildishTile {
  if (!tile) return false;
  if (isSpecialDiceDirectWildLikeTile(tile)) return true;
  return tile.isWild === true || tile.isWildFace === true;
}

// Provjeri da li je asset registriran u resolveru (tiho, bez upozorenja)
function isAssetRegistered(source: string): boolean {
  try {
    // PixiJS 8 - provjeri da li resolver ima ključ
    if (Assets.resolver?.hasKey?.(source)) {
      return true;
    }
    // Također provjeri cache direktno (za već učitane assete)
    if (Assets.cache?.has?.(source)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Async loader za teksturu - koristi Assets.load() za pouzdano učitavanje
async function loadTextureAsync(source: string): Promise<Texture | null> {
  try {
    // Prvo provjeri da li je već u cache-u (tiho, bez Assets.get() upozorenja)
    const cachedTex = getTextureFromCache(source);
    if (cachedTex) {
      return cachedTex;
    }
    
    // Assets.load() automatski vraća iz cache-a ako je već učitano
    // Ne trebamo registrirati asset jer to radi asset-preloader
    const texture = await Assets.load(source);
    if (texture && texture instanceof Texture) {
      return texture;
    }
    return null;
  } catch {
    // Tiho ignoriraj greške - probat ćemo sljedeći source
    return null;
  }
}

function isTextureValid(texture: Texture | null): boolean {
  if (!texture) return false;
  const source = (texture as any).source ?? (texture as any).baseTexture;
  return !!source?.valid;
}

// Sinkroni fallback - koristi samo cache, bez upozorenja
function getTextureFromCache(source: string): Texture | null {
  try {
    // Provjeri da li je registriran prije nego pokušamo dohvatiti
    if (!isAssetRegistered(source)) {
      return null;
    }
    const texture = Assets.get(source);
    if (texture && texture instanceof Texture && isTextureValid(texture)) {
      return texture;
    }
    return null;
  } catch {
    return null;
  }
}

// Async verzija - koristi se za pouzdano učitavanje
function normalizeTextureSources(sources?: string[] | null): string[] {
  return Array.isArray(sources) && sources.length ? sources.filter(Boolean) : STAR_TEXTURE_SOURCES;
}

function getTextureCacheKey(sources: string[]): string {
  return sources.join('|');
}

function resolveTextureSources(tile?: WildishTile | null, opts: any = {}): string[] {
  const variantSources = getSpecialDiceVariantForTile(tile)?.orbitParticleSources;
  return normalizeTextureSources(opts?.particleSources || opts?.textureSources || variantSources);
}

async function ensureTextureAsync(sources = STAR_TEXTURE_SOURCES): Promise<Texture | null> {
  // Provjeri cache prvo
  const cacheKey = getTextureCacheKey(sources);
  const cachedTexture = cachedTextures.get(cacheKey) || null;
  if (cachedTexture && isTextureValid(cachedTexture)) {
    return cachedTexture;
  }
  
  // Pokušaj učitati async iz svakog izvora
  for (const source of sources) {
    const texture = await loadTextureAsync(source);
    if (texture) {
      cachedTextures.set(cacheKey, texture);
      return texture;
    }
  }
  
  return null;
}

// Sinkrona verzija - vraća samo ako je već u cache-u (tiho, bez upozorenja)
function ensureTextureSync(sources = STAR_TEXTURE_SOURCES): Texture | null {
  // Provjeri postojeći lokalni cache
  const cacheKey = getTextureCacheKey(sources);
  const cachedTexture = cachedTextures.get(cacheKey) || null;
  if (cachedTexture && isTextureValid(cachedTexture)) {
    return cachedTexture;
  }
  
  // Pokušaj sinkrono dohvatiti iz Assets cache-a (tiho)
  for (const source of sources) {
    const texture = getTextureFromCache(source);
    if (texture) {
      cachedTextures.set(cacheKey, texture);
      return texture;
    }
  }
  
  return null;
}

function clampDelta(delta: number): number {
  if (!Number.isFinite(delta)) return 1;
  if (delta < DELTA_MIN) return DELTA_MIN;
  if (delta > DELTA_MAX) return DELTA_MAX;
  return delta;
}

function computeHostMetrics(tile: WildishTile, host: Container) {
  let width = Math.max(1, tile.base?.width || (host as any).width || tile.width || 0);
  let height = Math.max(1, tile.base?.height || (host as any).height || tile.height || 0);

  if (width <= 2 || height <= 2) {
    try {
      const bounds = host.getBounds?.();
      if (bounds) {
        width = Math.max(width, bounds.width);
        height = Math.max(height, bounds.height);
      }
    } catch {}
  }

  width = Math.max(1, width || 96);
  height = Math.max(1, height || 96);
  return { width, height };
}

function createFallbackStar(): Graphics {
  const g = new Graphics();
  g.star(0, 0, 5, STAR_TARGET_SIZE * 0.5, STAR_TARGET_SIZE * 0.25).fill({ color: 0xFFE7B5, alpha: 1.0 });
  g.lineStyle(undefined);
  g.label = 'wild-baby-star-placeholder';
  g.alpha = 1.0;
  g.visible = true;
  g.renderable = true;
  debugLog(`🌟 Fallback star created: size=${STAR_TARGET_SIZE}, visible=${g.visible}, alpha=${g.alpha}`);
  return g;
}

function createStarSprite(texture: Texture, star: OrbitingStar): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.label = 'wild-baby-star';
  sprite.blendMode = 1;
  sprite.alpha = 1.0; // Full opacity
  sprite.visible = true; // FORSIRANO vidljivo
  sprite.renderable = true; // FORCE renderable

  const baseWidth = Math.max(1, sprite.texture?.width ?? STAR_TARGET_SIZE);
  const normalizer = STAR_TARGET_SIZE / baseWidth;
  star.scaleNormalizer = normalizer;
  sprite.scale.set(normalizer * star.baseScale);
  
  debugLog(`🌟 Sprite created: width=${baseWidth}, normalizer=${normalizer}, final scale=${normalizer * star.baseScale}, visible=${sprite.visible}, alpha=${sprite.alpha}, renderable=${sprite.renderable}`);

  return sprite;
}

function setupStars(system: WildStarSystem, texture: Texture, starCount = MAX_BABY_STAR_COUNT): void {
  system.container.removeChildren();
  system.stars = [];

  debugLog('🌟 Creating stars with texture:', texture, 'count:', starCount);

  for (let i = 0; i < starCount; i += 1) {
    const star: OrbitingStar = {
      sprite: null as unknown as Sprite | Graphics,
      angle: (Math.PI * 2 * i) / starCount,
      speed: 0.4 + Math.random() * 0.3, // Sporije brzine
      direction: i === 0 ? 1 : -1, // Prva u smjeru kazaljke, ostale suprotno
      orbitRadius: 0.6 + Math.random() * 0.17, // Povećano za 10%: maksimum 0.77 umjesto 0.7
      radiusJitter: 0.05 + Math.random() * 0.04,
      radiusJitterSpeed: 0.85 + Math.random() * 0.6,
      pulseSpeed: 1.1 + Math.random() * 0.3,
      pulsePhase: Math.random() * Math.PI * 2,
      baseScale: 0.90 + Math.random() * 0.15, // Random scale: 90% (10% manje) do 105% (5% veće) od maksimalne veličine
      rotationSpeed: 0.5 + Math.random() * 0.3, // Brzina oscilacije rotacije
      rotationPhase: Math.random() * Math.PI * 2, // Početna faza za rotaciju
      rotationAmplitude: (4 + Math.random() * 4) * (Math.PI / 180), // 4-8 stupnjeva u radijanima
      scaleNormalizer: 1,
      revealAt: system.introBounce ? performance.now() + i * 500 : 0,
      revealed: !system.introBounce,
      introAnimating: false,
    };

    // FORSIRANO koristimo samo teksturu - NEMA fallback-a!
    const display = createStarSprite(texture, star);
    if (system.introBounce) {
      display.alpha = 0;
      display.scale.set(star.scaleNormalizer * star.baseScale * 0.08);
    }
    star.sprite = display;
    system.stars.push(star);
    system.container.addChild(display);
    debugLog(`✅ Star ${i + 1} created with texture sprite`);
  }
  
  debugLog('✅ All stars created with texture!');
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

  const now = performance.now();
  const elapsed = now - system.lastUpdateTime;
  if (elapsed < system.updateIntervalMs) return;
  system.lastUpdateTime = now;

  const { width, height } = computeHostMetrics(tile, host);
  container.x = 0;
  container.y = 0;
  const baseRadius = Math.max(width, height) * BASE_RADIUS_FACTOR;
  const delta = clampDelta(elapsed / (1000 / 60));
  const time = now * 0.001;

  system.stars.forEach((star) => {
    star.sprite.visible = true;

    star.angle += star.speed * star.direction * delta * ORBIT_SPEED;

    const wobble = Math.sin(time * star.radiusJitterSpeed + star.pulsePhase) * star.radiusJitter;
    const radius = baseRadius * (star.orbitRadius + wobble);

    star.sprite.x = Math.cos(star.angle) * radius;
    star.sprite.y = Math.sin(star.angle) * radius;
    
    // Lagana oscilacija rotacije unutar 4-8 stupnjeva
    star.sprite.rotation = Math.sin(time * star.rotationSpeed + star.rotationPhase) * star.rotationAmplitude;

    const pulse = star.baseScale * (0.92 + Math.sin(time * star.pulseSpeed + star.pulsePhase) * 0.1);
    if (system.introBounce && !star.revealed) {
      if (now < (star.revealAt ?? 0)) {
        star.sprite.alpha = 0;
        star.sprite.scale.set(star.scaleNormalizer * star.baseScale * 0.08);
        return;
      }
      star.revealed = true;
      star.introAnimating = true;
      star.sprite.alpha = 1;
      gsap.killTweensOf(star.sprite.scale);
      star.sprite.scale.set(star.scaleNormalizer * star.baseScale * 0.12);
      gsap.timeline({
        onComplete: () => {
          star.introAnimating = false;
        },
      })
        .to(star.sprite.scale, {
          x: star.scaleNormalizer * star.baseScale * 1.26,
          y: star.scaleNormalizer * star.baseScale * 1.26,
          duration: 0.18,
          ease: 'back.out(3.4)',
        })
        .to(star.sprite.scale, {
          x: star.scaleNormalizer * star.baseScale * 0.86,
          y: star.scaleNormalizer * star.baseScale * 0.86,
          duration: 0.08,
          ease: 'power2.inOut',
        })
        .to(star.sprite.scale, {
          x: star.scaleNormalizer * star.baseScale,
          y: star.scaleNormalizer * star.baseScale,
          duration: 0.22,
          ease: 'elastic.out(1, 0.68)',
        });
      return;
    }

    star.sprite.alpha = 1.0;
    if (!star.introAnimating) {
      star.sprite.scale.set(star.scaleNormalizer * pulse);
    }
  });
}

function playOrbitIntro(container: Container): void {
  try {
    gsap.killTweensOf(container.scale);
    container.scale.set(0.35);
    gsap.timeline()
      .to(container.scale, { x: 1.18, y: 1.18, duration: 0.16, ease: 'back.out(3.2)' })
      .to(container.scale, { x: 0.92, y: 0.92, duration: 0.08, ease: 'power2.inOut' })
      .to(container.scale, { x: 1, y: 1, duration: 0.2, ease: 'elastic.out(1, 0.72)' });
  } catch {}
}

export function attachWildStarHalo(tile: WildishTile | null | undefined, opts: any = {}): void {
  if (!tileIsPureWild(tile)) return;
  if (getSpecialDiceVariantForTile(tile)?.idleOrbit === false) return;
  if (!shouldRenderWildStarOrbit()) {
    detachWildStarHalo(tile);
    return;
  }

  const existingSystem = systems.get(tile) || (tile as any)._wildStarSystem;
  if (existingSystem && !existingSystem.disposed && opts?.force !== true) {
    return;
  }

  detachWildStarHalo(tile);

  const host = (tile.rotG as Container) || tile;
  if (!host) return;
  const babyStarCount = getRandomBabyStarCount();
  const textureSources = resolveTextureSources(tile, opts);

  const container = new Container();
  container.label = 'wild-baby-star-orbit';
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
    lastUpdateTime: performance.now() - 1000 / 30,
    updateIntervalMs: 1000 / 30,
    introBounce: opts?.introBounce === true,
    textureSources,
  };

  systems.set(tile, system);
  (tile as any)._wildStarSystem = system;

  // Pomoćna funkcija za pokretanje sistema sa teksturom
  const startSystemWithTexture = (texture: Texture) => {
    if (system.disposed) return;
    if (!shouldRenderWildStarOrbit()) {
      detachWildStarHalo(tile);
      return;
    }
    
    setupStars(system, texture, babyStarCount);
    container.alpha = 1.0;
    container.visible = true;
    container.renderable = true;
    activeSystems.add(system);
    ensureSharedTicker();
  };
  
  // Pomoćna funkcija za fallback zvijezdice
  const startSystemWithFallback = () => {
    if (system.disposed) return;
    if (!shouldRenderWildStarOrbit()) {
      detachWildStarHalo(tile);
      return;
    }
    
    system.container.removeChildren();
    system.stars = [];
    for (let i = 0; i < babyStarCount; i += 1) {
      const star: OrbitingStar = {
        sprite: null as unknown as Sprite | Graphics,
        angle: (Math.PI * 2 * i) / babyStarCount,
        speed: 0.4 + Math.random() * 0.3,
        direction: i === 0 ? 1 : -1,
        orbitRadius: 0.6 + Math.random() * 0.17,
        radiusJitter: 0.05 + Math.random() * 0.04,
        radiusJitterSpeed: 0.85 + Math.random() * 0.6,
        pulseSpeed: 1.1 + Math.random() * 0.3,
        pulsePhase: Math.random() * Math.PI * 2,
        baseScale: 0.90 + Math.random() * 0.15,
        rotationSpeed: 0.5 + Math.random() * 0.3,
        rotationPhase: Math.random() * Math.PI * 2,
        rotationAmplitude: (4 + Math.random() * 4) * (Math.PI / 180),
        scaleNormalizer: 1,
        revealAt: system.introBounce ? performance.now() + i * 500 : 0,
        revealed: !system.introBounce,
        introAnimating: false,
      };
      const display = createFallbackStar();
      if (system.introBounce) {
        display.alpha = 0;
        display.scale.set(0.08);
      }
      star.sprite = display;
      system.stars.push(star);
      system.container.addChild(display);
    }
    container.alpha = 1.0;
    container.visible = true;
    container.renderable = true;
    activeSystems.add(system);
    ensureSharedTicker();
  };

  // Prvo pokušaj sinkrono dohvatiti iz cache-a (brzo, bez grešaka)
  const cachedTex = ensureTextureSync(textureSources);
  if (cachedTex) {
    startSystemWithTexture(cachedTex);
    return;
  }
  
  // Ako nije u cache-u, učitaj async (tiho, bez grešaka u konzoli)
  ensureTextureAsync(textureSources).then(texture => {
    if (system.disposed) return;
    
    if (texture) {
      startSystemWithTexture(texture);
    } else {
      // Fallback na grafičke zvijezdice
      startSystemWithFallback();
    }
  }).catch(() => {
    if (!system.disposed) {
      startSystemWithFallback();
    }
  });
}

export function detachWildStarHalo(tile: WildishTile | null | undefined): void {
  if (!tile) return;

  const system = systems.get(tile) || (tile as any)._wildStarSystem;
  if (!system) return;

  system.disposed = true;

  activeSystems.delete(system);
  removeSharedTickerIfIdle();

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

function ensureSharedTicker(): void {
  if (sharedTicker) return;
  sharedTicker = () => {
    if (!shouldRenderWildStarOrbit()) {
      Array.from(activeSystems).forEach((system) => detachWildStarHalo(system.tile));
      return;
    }
    activeSystems.forEach((system) => tickSystem(system));
  };
  gsap.ticker.add(sharedTicker);
}

function removeSharedTickerIfIdle(): void {
  if (!sharedTicker || activeSystems.size > 0) return;
  try { gsap.ticker.remove(sharedTicker); } catch {}
  sharedTicker = null;
}

export async function preloadWildStarTexture(): Promise<void> {
  // Async preload - tiho ignorira greške
  await ensureTextureAsync(STAR_TEXTURE_SOURCES).catch(() => {});
}
