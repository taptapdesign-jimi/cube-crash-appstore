// Critical image preloader with Cache Storage priming and decode
const CACHE_NAME = 'cube-crash-assets-v1';

const CRITICAL_IMAGES: string[] = [
  // Homepage hero + logo and shards
  './assets/crash-cubes-homepage.png',
  './assets/crash-cubes-homepage@2x.png',
  './assets/crash-cubes-homepage@3x.png',
  './assets/logo-cube-crash.png',
  './assets/logo-cube-crash@2x.png',
  './assets/logo-cube-crash@3x.png',
  './assets/logo addons/gore ljevo shards.png',
  './assets/logo addons/shards gore desno.png',
  './assets/home-shadow.png',
  './assets/home-shadow@2x.png',
  './assets/home-shadow@3x.png',

  // Slide hero art (ALL slider images must be cached)
  './assets/stats-trophy.png',
  './assets/stats-trophy@2x.png',
  './assets/stats-trophy@3x.png',
  './assets/collectibles-box.png',
  './assets/collectibles-box@2x.png',
  './assets/collectibles-box@3x.png',
  './assets/settings-slider.png',
  './assets/settings-slider@2x.png',
  './assets/settings-slider@3x.png',

  // Nav icons
  './assets/nav/cube-nav.png',
  './assets/nav/stats-nav.png',
  './assets/nav/collectibles-nav.png',
  './assets/nav/settings-nav.png',

  // Core gameplay visuals
  './assets/tile.png',
  './assets/tile_numbers.png',
  './assets/tile_numbers2.png',
  './assets/tile_numbers3.png',
  './assets/tile_numbers4.png',
  './assets/wild.png',
  './assets/wild-magnet.png',
  './assets/wild-beer.png',
  './assets/mystery-box.png',
  './assets/gold-coin.png'
];

let preloadPromise: Promise<void> | null = null;

async function cacheImage(url: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url, { ignoreSearch: true });
    // If already cached, skip fetch (faster)
    if (cached) {
      return;
    }
    // Use 'force-cache' to check browser cache first, then fetch if needed
    const resp = await fetch(url, { cache: 'force-cache' });
    if (resp.ok) {
      await cache.put(url, resp.clone());
    }
  } catch (error) {
    console.warn('⚠️ preload cache miss:', url, error);
  }
}

function decodeImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    // Check if image is already loaded in browser cache
    const img = new Image();
    img.loading = 'eager';
    (img as any).decoding = 'async';
    
    // If image is already complete (cached), resolve immediately
    if (img.complete) {
      resolve();
      return;
    }
    
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't block on errors
    img.src = url;
  });
}

export function preloadCriticalAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  const tasks = CRITICAL_IMAGES.map(async (url) => {
    await Promise.all([cacheImage(url), decodeImage(url)]);
  });

  preloadPromise = Promise.all(tasks)
    .then(() => {
      console.log('✅ Critical assets preloaded and cached');
    })
    .catch((error) => {
      console.warn('⚠️ Critical assets preload failed:', error);
    });

  return preloadPromise;
}
