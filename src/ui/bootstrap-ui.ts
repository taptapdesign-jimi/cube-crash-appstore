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
import { renderMenuModal } from './components/menu-modal.js';
import { renderNavigation } from './components/navigation.js';
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

  const logo = document.createElement('img');
  logo.id = 'home-logo';
  logo.src = './assets/logo-cube-crash.png';
  logo.alt = 'CubeCrash';
  logo.loading = 'eager';
  logo.setAttribute('fetchpriority', 'high');

  const sliderContainer = document.createElement('div');
  sliderContainer.id = 'slider-container';

  const sliderViewport = document.createElement('div');
  sliderViewport.className = 'slider-viewport';

  const sliderWrapper = document.createElement('div');
  sliderWrapper.id = 'slider-wrapper';

  sliderViewport.appendChild(sliderWrapper);
  sliderContainer.appendChild(sliderViewport);

  content.appendChild(logo);
  content.appendChild(sliderContainer);
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
  if (document.getElementById('collectibles-screen')) {
    console.log('⚠️ collectibles-screen already exists, skipping render');
    return;
  }
  console.log('🎁 Rendering collectibles screen into root:', root);
  renderCollectiblesScreen(root, { showDebugControls: false });
  console.log('✅ Collectibles screen rendered');
  const screen = document.getElementById('collectibles-screen');
  console.log('🎁 Verify collectibles-screen exists:', !!screen);
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
  modalElement.classList.add('hidden');
  modalElement.style.display = 'none';
  root.appendChild(modalElement);
}

function renderNav(root: HTMLElement): void {
  if (document.getElementById('independent-nav')) return;
  renderNavigation(root, { currentSlide: 0 });
}
