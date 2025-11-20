// UI Bootstrapper
// Dynamically composes the DOM for screens/slides before managers initialize

import { renderHomeSlide } from './components/home-slide.js';
import { renderStatsSlide } from './components/stats-slide.js';
import { renderCollectiblesSlide } from './components/collectibles-slide.js';
import { renderSettingsSlide } from './components/settings-slide.js';
import { renderStatsScreen } from './components/stats-screen.js';
import {
  renderCollectiblesScreen,
  createCollectiblesDetailModal,
} from './components/collectibles-screen.js';
import { renderSettingsScreen } from './components/settings-screen.js';
import { renderMenuModal } from './components/menu-modal.js';
import { renderNavigation, updateNavBadge } from './components/navigation.js';
import { createLoadingScreen } from './components/loading-screen.js';
import { HTMLBuilder } from './components/html-builder.js';
import { logger } from '../core/logger.js';

const BOOTSTRAP_FLAG = '__cube_crash_ui_bootstrapped__';

function bootstrapUI() {
  console.log('🚀 bootstrapUI called');
  console.log('Document readyState:', document.readyState);
  console.log('Body exists:', !!document.body);
  
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

  renderLoading(uiRoot);
  renderHome(uiRoot);
  renderGameContainer(uiRoot);
  renderStats(uiRoot);
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
    const raw = localStorage.getItem('pending_collectible_flips_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        (window as any).__pendingCollectibleFlips = parsed;
        updateNavBadge(parsed.length);
        console.log('✅ Badge initialized with', parsed.length, 'pending collectibles');
      }
    }
  } catch (error) {
    console.warn('Failed to load pending collectible flips:', error);
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
    
    if (document.readyState === 'complete') {
      console.log('✅ Document complete, calling bootstrapUI immediately');
      bootstrapUI();
      resolve();
    } else {
      console.log('⏳ Waiting for window.load event...');
      window.addEventListener('load', () => {
        console.log('✅ window.load fired, calling bootstrapUI');
        bootstrapUI();
        resolve();
      });
      
      // Fallback: Also listen for DOMContentLoaded
      if (document.readyState === 'loading') {
        console.log('⏳ Also listening for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', () => {
          console.log('✅ DOMContentLoaded fired, calling bootstrapUI');
          bootstrapUI();
          resolve();
        });
      }
    }
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

function renderLoading(root: HTMLElement): void {
  if (document.getElementById('loading-screen')) {
    console.log('⚠️ Loading screen already exists');
    return;
  }
  console.log('🔧 Creating loading screen...');
  const loadingElement = HTMLBuilder.createElement(createLoadingScreen());
  root.appendChild(loadingElement);
  console.log('✅ Loading screen created and appended to root');
  console.log('Loading screen element:', loadingElement);
  console.log('Loading screen hidden?', loadingElement.hidden);
  console.log('Loading screen display:', loadingElement.style.display);
  console.log('Loading screen getComputedStyle:', window.getComputedStyle(loadingElement).display);
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
  shardsGoreLjevo.loading = 'lazy';
  logoWrapper.appendChild(shardsGoreLjevo);

  // Shards gore desno - above logo, top right, close to logo
  const shardsGoreDesno = document.createElement('img');
  shardsGoreDesno.id = 'logo-shards-gore-desno';
  shardsGoreDesno.className = 'logo-addon logo-shards-gore-desno';
  shardsGoreDesno.src = './assets/logo addons/shards gore desno.png';
  shardsGoreDesno.alt = '';
  shardsGoreDesno.loading = 'lazy';
  logoWrapper.appendChild(shardsGoreDesno);

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
  renderCollectiblesSlide(sliderWrapper, { slideIndex: 2 });
  renderSettingsSlide(sliderWrapper, { slideIndex: 3 });
}

function renderGameContainer(root: HTMLElement): void {
  if (document.getElementById('app')) return;
  const app = document.createElement('div');
  app.id = 'app';
  app.hidden = true;
  root.appendChild(app);
}

function renderStats(root: HTMLElement): void {
  if (document.getElementById('stats-screen')) return;
  renderStatsScreen(root, {
    showResetButton: false,
  });
}

function renderCollectibles(root: HTMLElement): void {
  if (document.getElementById('collectibles-screen')) return;
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
