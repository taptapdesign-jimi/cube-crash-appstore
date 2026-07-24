// UI Bootstrapper
// Dynamically composes the DOM for screens/slides before managers initialize

import { renderHomeSlide } from './components/home-slide.js';
import { renderStatsSlide } from './components/stats-slide.js';
import { renderCollectiblesSlide } from './components/collectibles-slide.js';
import { renderSettingsSlide } from './components/settings-slide.js';
import {
  renderCollectiblesScreen,
  createCollectiblesDetailModal,
} from './components/collectibles-screen.js';
import { renderSettingsScreen } from './components/settings-screen.js';
import { renderMenuModal } from './components/menu-modal.js';
import { renderNavigation, updateNavBadge } from './components/navigation.js';
import { HTMLBuilder } from './components/html-builder.js';
import { logger } from '../core/logger.js';
import { SETTINGS_SLIDE_INDEX, SHOP_MODULE_ENABLED, SHOP_MODULE_SLIDE_INDEX } from '../modules/shop-module.js';
// Note: preloadCriticalAssets removed - startup preloading is orchestrated in main.ts

const BOOTSTRAP_FLAG = '__cube_crash_ui_bootstrapped__';

function bootstrapUI() {
  console.log('🚀 bootstrapUI called');
  console.log('Document readyState:', document.readyState);
  console.log('Body exists:', !!document.body);

  // Note: Asset preloading is handled in main.ts. No duplicate preloading here.
  
  const windowRef = window as Record<string, unknown>;
  if (windowRef[BOOTSTRAP_FLAG]) {
    console.log('⚠️ UI already bootstrapped');
    logger.info('⚠️ UI already bootstrapped');
    return;
  }
  
  console.log('🔧 Creating UI roots...');
  const uiRoot = ensureRoot('ui-root');
  const navRoot = ensureRoot('nav-root');
  console.log('✅ UI roots created:', uiRoot, navRoot);
  console.log('UI root element:', uiRoot);
  console.log('UI root exists:', !!uiRoot);
  console.log('UI root in document:', document.getElementById('ui-root'));

  // Clear existing injected markup to avoid duplicates during HMR
  uiRoot.innerHTML = '';
  navRoot.innerHTML = '';

  renderHome(uiRoot);
  renderGameContainer(uiRoot);
  // 🔥 REMOVED: Stats screen no longer exists
  renderCollectibles(uiRoot);
  renderSettings(uiRoot);
  renderMenu(uiRoot);
  renderCollectiblesModal(uiRoot);
  // Render navigation directly in body (not in navRoot)
  const bodyNav = document.getElementById('body-nav-root') || (() => {
    const el = document.createElement('div');
    el.id = 'body-nav-root';
    document.body.appendChild(el);
    return el;
  })();
  renderNav(bodyNav);
  
  // Expose updateNavBadge globally
  (window as any).updateNavBadge = updateNavBadge;
  
  // Initialize badge count on load from localStorage
  try {
    // 🔥 USER REQUEST: Badge ONLY on Journey icon (stats-nav.png), not on Collectibles
    // Initialize pending collectibles list but don't show badge
    const raw = localStorage.getItem('pending_collectible_flips_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        (window as any).__pendingCollectibleFlips = parsed;
        // No badge for Collectibles - badge only on Journey icon
      }
    }
    
    // 🗺️ Initialize journey badge from journey_last_viewed_count
    // This ensures badge is correctly restored after hard exit
    // Badge shows on Journey icon (stats-nav.png, slideIndex 1) ONLY
    import('../modules/journey-boards-manager.js').then(({ journeyBoardsManager }) => {
      try {
        const newlyUnlockedCount = journeyBoardsManager.getNewlyUnlockedCount();
        updateNavBadge(newlyUnlockedCount, 1); // slideIndex 1 = Journey (stats-nav.png)
        console.log('✅ Journey badge initialized with', newlyUnlockedCount, 'newly unlocked boards');
      } catch (error) {
        console.warn('⚠️ Failed to initialize journey badge on startup:', error);
      }
    }).catch((error) => {
      console.warn('⚠️ Failed to import journey boards manager on startup:', error);
    });
  } catch (error) {
    console.warn('Failed to load badge counts from localStorage:', error);
  }

  windowRef[BOOTSTRAP_FLAG] = true;
  logger.info('✅ UI bootstrap completed');
}

// Export a promise that resolves when bootstrap is complete
export const bootstrapReady = new Promise<void>((resolve) => {
  console.log('⏳ bootstrapReady Promise created');
  console.log('Document readyState:', document.readyState);
  
  function waitForReady() {
    console.log('⏳ waitForReady called, readyState:', document.readyState);
    
    // Start as soon as DOM is parsed (interactive) to avoid waiting for full window load
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      console.log('✅ Document ready/interactive, calling bootstrapUI immediately');
      
      // The inline index bootstrap already owns the launch-screen lifecycle.
      bootstrapUI();
      resolve();
      return;
    }

    // If still loading, run on DOMContentLoaded (earliest safe hook)
    console.log('⏳ Waiting for DOMContentLoaded (document still loading)...');
    const onReady = () => {
      console.log('✅ DOMContentLoaded fired, calling bootstrapUI');
      bootstrapUI();
      resolve();
    };
    document.addEventListener('DOMContentLoaded', onReady, { once: true });

    // Fallback: window load if DOMContentLoaded somehow missed
    window.addEventListener('load', () => {
      console.log('✅ window.load fired (fallback), calling bootstrapUI');
      bootstrapUI();
      resolve();
    }, { once: true });
  }
  
  // Start immediately if already loaded, otherwise wait
  waitForReady();
});

function ensureRoot(id: string): HTMLElement {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('div');
    element.id = id;
    document.body.appendChild(element);
  }
  return element;
}

function renderHome(root: HTMLElement): void {
  if (document.getElementById('home')) return;

  const home = document.createElement('div');
  home.id = 'home';
  home.hidden = true;
  home.style.display = 'none';

  const content = document.createElement('div');
  content.className = 'content';

  // Logo wrapper
  const logoWrapper = document.createElement('div');
  logoWrapper.id = 'home-logo-wrapper';
  logoWrapper.className = 'home-logo-wrapper';

  // Shards gore ljevo - above logo, top left
  const shardsGoreLjevo = document.createElement('img');
  shardsGoreLjevo.id = 'logo-shards-gore-ljevo';
  shardsGoreLjevo.className = 'logo-addon logo-shards-gore-ljevo';
  shardsGoreLjevo.src = './assets/logo addons/gore ljevo shards.png';
  shardsGoreLjevo.alt = '';
  shardsGoreLjevo.loading = 'eager'; // 🔥 OPTIMIZATION: Changed from 'lazy' to 'eager' - shards are preloaded
  shardsGoreLjevo.setAttribute('fetchpriority', 'high');
  logoWrapper.appendChild(shardsGoreLjevo);

  // Shards gore desno - above logo, top right, close to logo
  const shardsGoreDesno = document.createElement('img');
  shardsGoreDesno.id = 'logo-shards-gore-desno';
  shardsGoreDesno.className = 'logo-addon logo-shards-gore-desno';
  shardsGoreDesno.src = './assets/logo addons/shards gore desno.png';
  shardsGoreDesno.alt = '';
  shardsGoreDesno.loading = 'eager'; // 🔥 OPTIMIZATION: Changed from 'lazy' to 'eager' - shards are preloaded
  shardsGoreDesno.setAttribute('fetchpriority', 'high');
  logoWrapper.appendChild(shardsGoreDesno);

  // Shards dole ljevi - below logo, bottom left
  const shardsDoleLjevi = document.createElement('img');
  shardsDoleLjevi.id = 'logo-shards-dole-ljevi';
  shardsDoleLjevi.className = 'logo-addon logo-shards-dole-ljevi';
  shardsDoleLjevi.src = './assets/logo addons/dole ljevi shards.png';
  shardsDoleLjevi.alt = '';
  shardsDoleLjevi.loading = 'eager';
  shardsDoleLjevi.setAttribute('fetchpriority', 'high');
  logoWrapper.appendChild(shardsDoleLjevi);

  // Shards dole desni - below logo, bottom right
  const shardsDoleDesni = document.createElement('img');
  shardsDoleDesni.id = 'logo-shards-dole-desni';
  shardsDoleDesni.className = 'logo-addon logo-shards-dole-desni';
  shardsDoleDesni.src = './assets/logo addons/dole ljevi shards.png';
  shardsDoleDesni.alt = '';
  shardsDoleDesni.loading = 'eager';
  shardsDoleDesni.setAttribute('fetchpriority', 'high');
  logoWrapper.appendChild(shardsDoleDesni);

  // Main logo
  const logo = document.createElement('img');
  logo.id = 'home-logo';
  logo.src = './assets/logo-cube-crash.png';
  logo.alt = 'CubeCrash';
  logo.loading = 'eager';
  logo.setAttribute('fetchpriority', 'high');
  logoWrapper.appendChild(logo);

  const sliderContainer = document.createElement('div');
  sliderContainer.id = 'slider-container';

  const sliderViewport = document.createElement('div');
  sliderViewport.className = 'slider-viewport';

  const sliderWrapper = document.createElement('div');
  sliderWrapper.id = 'slider-wrapper';

  sliderViewport.appendChild(sliderWrapper);
  sliderContainer.appendChild(sliderViewport);

  content.appendChild(logoWrapper);
  content.appendChild(sliderContainer);
  
  // Create fixed shadow BELOW Play button (like logo - always visible)
  // Base position: 120px (safe area) + 76px (offset) = 196px
  // Donji shadow: shadow height = 49px - spušteno 40px (32px + 8px)
  const fixedShadowBottom = document.createElement('img');
  fixedShadowBottom.id = 'home-fixed-shadow-bottom';
  fixedShadowBottom.src = './assets/home-shadow.png';
  fixedShadowBottom.alt = '';
  fixedShadowBottom.setAttribute('aria-hidden', 'true');
  fixedShadowBottom.style.cssText = `
    position: fixed;
    left: 0;
    right: 0;
    width: 100%;
    bottom: calc(120px + 76px - 24px - 49px - 34px - 8px);
    height: 49px;
    object-fit: contain;
    pointer-events: none;
    z-index: 100;
    opacity: 0.55;
  `;
  
  home.appendChild(fixedShadowBottom);
  home.appendChild(content);
  root.appendChild(home);

  renderHomeSlide(sliderWrapper, { slideIndex: 0, isActive: true });
  renderStatsSlide(sliderWrapper, { slideIndex: 1 });
  if (SHOP_MODULE_ENABLED) {
    renderCollectiblesSlide(sliderWrapper, { slideIndex: SHOP_MODULE_SLIDE_INDEX, isShopModuleEnabled: true });
  }
  renderSettingsSlide(sliderWrapper, { slideIndex: SETTINGS_SLIDE_INDEX });
}

function renderGameContainer(root: HTMLElement): void {
  if (document.getElementById('app')) return;
  const app = document.createElement('div');
  app.id = 'app';
  app.hidden = true;
  root.appendChild(app);
}

function renderCollectibles(root: HTMLElement): void {
  if (document.getElementById('journey-screen')) return;
  renderCollectiblesScreen(root, { showDebugControls: true });
}

function renderSettings(root: HTMLElement): void {
  if (document.getElementById('settings-screen')) return;
  renderSettingsScreen(root, {});
}

function renderMenu(root: HTMLElement): void {
  if (document.getElementById('menu-screen')) return;
  renderMenuModal(root);
}

function renderCollectiblesModal(root: HTMLElement): void {
  if (document.getElementById('collectibles-detail-modal')) return;
  const modalElement = HTMLBuilder.createElement(createCollectiblesDetailModal());
  modalElement.setAttribute('role', 'dialog');
  modalElement.setAttribute('aria-modal', 'true');
  modalElement.setAttribute('aria-labelledby', 'detail-card-number');
  modalElement.setAttribute('aria-hidden', 'true');
  root.appendChild(modalElement);
}

function renderNav(root: HTMLElement): void {
  if (document.getElementById('independent-nav')) return;
  renderNavigation(root, { currentSlide: 0 });
}
