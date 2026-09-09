// @ts-nocheck
// Launch Screen Module
// Handles the initial Stack to Six preload sequence.

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';
import { getOriginalGsapTo } from './drag-core.js';
import { waitForCriticalStartupReadiness } from '../utils/startup-readiness.js';
import { applyAppPaperBackground } from '../utils/app-paper-background.js';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.js';

// 🔥 CRITICAL FIX: Use original GSAP functions to prevent infinite recursion
const trackTween = (target: any, vars: any) => {
  const origTo = getOriginalGsapTo();
  return animationManager.trackExternalTween(origTo(target, vars));
};

let priorityPaperBgLoadPromise: Promise<void> | null = null;
const STUDIO_LOGO_URL = new URL('../../assets/logo addons/taplogo.png', import.meta.url).href;
const studioCharacterModules = import.meta.glob([
  '../../assets/logo addons/lik-*.png',
  '../../assets/logo addons/lik-game.svg',
  '../../assets/logo addons/lik-gitara.svg',
  '../../assets/logo addons/lik-pas-SVG.svg',
  '../../assets/logo addons/lik-cvijet.svg',
  '../../assets/logo addons/lik-kauc.svg',
  '../../assets/logo addons/lik-board.svg',
  '../../assets/logo addons/lik slikanje.svg',
  '../../assets/logo addons/lik-laptop.svg',
  '../../assets/logo addons/lik-nogomet.svg',
  '../../assets/logo addons/lik-speceraj.svg',
  '../../assets/logo addons/pas novine.svg',
  '!../../assets/logo addons/lik-*@2x.png',
  '!../../assets/logo addons/lik-game.png',
  '!../../assets/logo addons/lik-gitara.png',
  '!../../assets/logo addons/lik-pas.png',
  '!../../assets/logo addons/lik-cvijet.png',
  '!../../assets/logo addons/lik-kauc.png',
  '!../../assets/logo addons/lik-laptop.png',
  '!../../assets/logo addons/lik-nogomet.png',
  '!../../assets/logo addons/lik-speceraj.png',
  '!../../assets/logo addons/lik slikanje.png',
  '!../../assets/logo addons/lik-lajna.png',
  '!../../assets/logo addons/lik-board.png',
  '!../../assets/logo addons/lik-dron.png',
  '!../../assets/logo addons/lik-klizanje.png',
  '!../../assets/logo addons/lik-vrt.png',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const STUDIO_CHARACTER_ENTRIES = Object.entries(studioCharacterModules);
const requestedDevStudioCharacter = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('ccIntroCharacter')
  : null;
const requestedBuildStudioCharacter = import.meta.env.VITE_CC_FORCE_INTRO_CHARACTER?.trim() || null;
const requestedStudioCharacter = requestedDevStudioCharacter || requestedBuildStudioCharacter;
const forcedStudioCharacterEntry = requestedStudioCharacter
  ? STUDIO_CHARACTER_ENTRIES.find(([characterPath]) => characterPath.endsWith(`/${requestedStudioCharacter}`))
  : undefined;
const selectedStudioCharacterEntry = forcedStudioCharacterEntry || STUDIO_CHARACTER_ENTRIES[
  Math.floor(Math.random() * STUDIO_CHARACTER_ENTRIES.length)
] || [
  '../../assets/logo addons/lik-game.svg',
  new URL('../../assets/logo addons/lik-game.svg', import.meta.url).href,
];
const [selectedStudioCharacterPath, selectedStudioCharacterSvgUrl] = selectedStudioCharacterEntry;
const MOBILE_ANIMATION_PROXIES = [
  ['/lik-game.svg', new URL('../../assets/logo addons/optimized/lik-game-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-game-mobile-hevc.mov', import.meta.url).href],
  ['/lik-gitara.svg', new URL('../../assets/logo addons/optimized/lik-gitara-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-gitara-mobile-hevc.mov', import.meta.url).href],
  ['/lik-pas-SVG.svg', new URL('../../assets/logo addons/optimized/lik-pas-SVG-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-pas-SVG-mobile-hevc.mov', import.meta.url).href],
  ['/lik-cvijet.svg', new URL('../../assets/logo addons/optimized/lik-cvijet-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-cvijet-mobile-hevc.mov', import.meta.url).href],
  ['/lik-kauc.svg', new URL('../../assets/logo addons/optimized/lik-kauc-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-kauc-mobile-hevc.mov', import.meta.url).href],
  ['/lik-board.svg', new URL('../../assets/logo addons/optimized/lik-board-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-board-mobile-hevc.mov', import.meta.url).href],
  ['/lik slikanje.svg', new URL('../../assets/logo addons/optimized/lik-slikanje-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-slikanje-mobile-hevc.mov', import.meta.url).href],
  ['/lik-laptop.svg', new URL('../../assets/logo addons/optimized/lik-laptop-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-laptop-mobile-hevc.mov', import.meta.url).href],
  ['/lik-nogomet.svg', new URL('../../assets/logo addons/optimized/lik-nogomet-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-nogomet-mobile-hevc.mov', import.meta.url).href],
  ['/lik-speceraj.svg', new URL('../../assets/logo addons/optimized/lik-speceraj-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/lik-speceraj-mobile-hevc.mov', import.meta.url).href],
  ['/pas novine.svg', new URL('../../assets/logo addons/optimized/pas-novine-mobile.webp', import.meta.url).href, new URL('../../assets/logo addons/optimized/pas-novine-mobile-hevc.mov', import.meta.url).href],
] as const;
const selectedStudioCharacterMobileProxy = MOBILE_ANIMATION_PROXIES.find(
  ([sourceSuffix]) => selectedStudioCharacterPath.endsWith(sourceSuffix),
);
const selectedStudioCharacterMobileAnimationUrl = selectedStudioCharacterMobileProxy?.[1];
const selectedStudioCharacterMobileVideoUrl = selectedStudioCharacterMobileProxy?.[2];
const forceMobileAnimationProxyInDev = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('ccIntroMobileProxy') === '1';
const selectedStudioCharacterUsesMobileAnimationProxy =
  Boolean(selectedStudioCharacterMobileAnimationUrl) &&
  (MOBILE_RUNTIME_PROFILE.isMobileDevice || forceMobileAnimationProxyInDev);
const selectedStudioCharacterUsesMobileVideoProxy =
  Boolean(selectedStudioCharacterMobileVideoUrl) &&
  (MOBILE_RUNTIME_PROFILE.isMobileDevice || forceMobileAnimationProxyInDev);
const selectedStudioCharacterUrl = selectedStudioCharacterUsesMobileVideoProxy
  ? selectedStudioCharacterMobileVideoUrl!
  : selectedStudioCharacterUsesMobileAnimationProxy
    ? selectedStudioCharacterMobileAnimationUrl!
    : selectedStudioCharacterSvgUrl;
const selectedStudioCharacterHasOwnMotion =
  selectedStudioCharacterPath.endsWith('/lik-game.svg') ||
  selectedStudioCharacterPath.endsWith('/lik-gitara.svg') ||
  selectedStudioCharacterPath.endsWith('/lik-pas-SVG.svg') ||
  selectedStudioCharacterPath.endsWith('/lik-cvijet.svg') ||
  selectedStudioCharacterPath.endsWith('/lik-kauc.svg') ||
  selectedStudioCharacterPath.endsWith('/lik-board.svg') ||
  selectedStudioCharacterPath.endsWith('/lik slikanje.svg') ||
  selectedStudioCharacterPath.endsWith('/lik-laptop.svg') ||
  selectedStudioCharacterPath.endsWith('/lik-nogomet.svg') ||
  selectedStudioCharacterPath.endsWith('/lik-speceraj.svg') ||
  selectedStudioCharacterPath.endsWith('/pas novine.svg');
interface StudioCharacterPresentation {
  restScale: number;
  offsetX: number;
  offsetY: number;
  transformOrigin: string;
}

const DEFAULT_STUDIO_CHARACTER_PRESENTATION: StudioCharacterPresentation = {
  restScale: 1,
  offsetX: 0,
  offsetY: 0,
  transformOrigin: 'center center',
};
const STUDIO_CHARACTER_PRESENTATIONS = [
  ['/lik-kauc.svg', { restScale: 1.1475, offsetX: 0, offsetY: 40, transformOrigin: 'center center' }],
  ['/lik-gitara.svg', { restScale: 1.1, offsetX: 0, offsetY: 16, transformOrigin: 'center center' }],
  ['/lik slikanje.svg', { restScale: 1.08, offsetX: 20, offsetY: 10, transformOrigin: 'center center' }],
  ['/lik-cvijet.svg', { restScale: 1.08, offsetX: 0, offsetY: 8, transformOrigin: 'center center' }],
  ['/lik-board.svg', { restScale: 1.04, offsetX: 0, offsetY: 16, transformOrigin: 'center center' }],
  ['/lik-game.svg', { restScale: 1.08, offsetX: 0, offsetY: 0, transformOrigin: 'center center' }],
  ['/lik-laptop.svg', { restScale: 1.452, offsetX: 0, offsetY: 8, transformOrigin: 'center center' }],
  ['/lik-pas-SVG.svg', { restScale: 1.12, offsetX: 0, offsetY: 0, transformOrigin: 'center top' }],
  ['/lik-speceraj.svg', { restScale: 1.21, offsetX: 0, offsetY: 20, transformOrigin: 'center center' }],
  ['/lik-nogomet.svg', { restScale: 1.1, offsetX: 0, offsetY: 0, transformOrigin: 'center center' }],
  ['/pas novine.svg', { restScale: 1.1, offsetX: 0, offsetY: 16, transformOrigin: 'center center' }],
] as const satisfies ReadonlyArray<readonly [string, StudioCharacterPresentation]>;
const selectedStudioCharacterPresentation = STUDIO_CHARACTER_PRESENTATIONS.find(
  ([sourceSuffix]) => selectedStudioCharacterPath.endsWith(sourceSuffix),
)?.[1] || DEFAULT_STUDIO_CHARACTER_PRESENTATION;
const selectedStudioCharacterRestScale = selectedStudioCharacterPresentation.restScale;
const selectedStudioCharacterInitialScale = Number((0.82 * selectedStudioCharacterRestScale).toFixed(4));

function applySelectedStudioCharacterSource(studioCharacter: HTMLImageElement): void {
  const selectedImageUrl = selectedStudioCharacterUsesMobileAnimationProxy
    ? selectedStudioCharacterMobileAnimationUrl!
    : selectedStudioCharacterSvgUrl;
  studioCharacter.dataset.launchMotionSource = selectedStudioCharacterUsesMobileAnimationProxy
    ? 'animated-webp'
    : 'svg';
  studioCharacter.onerror = selectedStudioCharacterUsesMobileAnimationProxy
    ? () => {
        logger.warn('⚠️ Mobile intro animation proxy failed; restoring authored SVG');
        studioCharacter.onerror = null;
        studioCharacter.dataset.launchMotionSource = 'svg-fallback';
        studioCharacter.src = selectedStudioCharacterSvgUrl;
      }
    : null;
  studioCharacter.src = selectedImageUrl;
}

function applySelectedStudioCharacterClasses(studioCharacter: HTMLElement): void {
  studioCharacter.style.setProperty('--launch-character-initial-scale', String(selectedStudioCharacterInitialScale));
  studioCharacter.style.setProperty('--launch-character-offset-x', `${selectedStudioCharacterPresentation.offsetX}px`);
  studioCharacter.style.setProperty('--launch-character-offset-y', `${selectedStudioCharacterPresentation.offsetY}px`);
  studioCharacter.style.setProperty('--launch-character-transform-origin', selectedStudioCharacterPresentation.transformOrigin);
}

function applySelectedStudioCharacterVideoSource(studioCharacter: HTMLVideoElement): void {
  const fallbackUrl = selectedStudioCharacterMobileAnimationUrl || selectedStudioCharacterSvgUrl;
  let fellBack = false;
  const useImageFallback = () => {
    if (fellBack) return;
    fellBack = true;
    logger.warn('⚠️ HEVC-alpha intro proxy failed; restoring animated image proxy');
    studioCharacter.dataset.launchMotionSource = 'animated-webp-fallback';
    studioCharacter.pause();
    studioCharacter.removeAttribute('src');
    studioCharacter.style.backgroundImage = `url("${fallbackUrl}")`;
    studioCharacter.style.backgroundPosition = 'center';
    studioCharacter.style.backgroundRepeat = 'no-repeat';
    studioCharacter.style.backgroundSize = 'contain';
  };

  studioCharacter.dataset.launchMotionSource = 'hevc-alpha';
  studioCharacter.muted = true;
  studioCharacter.defaultMuted = true;
  studioCharacter.autoplay = true;
  studioCharacter.loop = true;
  studioCharacter.playsInline = true;
  studioCharacter.preload = 'auto';
  studioCharacter.disablePictureInPicture = true;
  studioCharacter.setAttribute('muted', '');
  studioCharacter.setAttribute('playsinline', '');
  studioCharacter.setAttribute('webkit-playsinline', '');
  studioCharacter.setAttribute('aria-hidden', 'true');
  studioCharacter.addEventListener('error', useImageFallback, { once: true });
  studioCharacter.addEventListener('playing', () => {
    studioCharacter.style.backgroundImage = '';
  }, { once: true });
  studioCharacter.src = selectedStudioCharacterMobileVideoUrl!;
  studioCharacter.load();
}

type StudioCharacterElement = HTMLImageElement | HTMLVideoElement;

function applySelectedStudioCharacterMedia(studioCharacter: StudioCharacterElement): void {
  applySelectedStudioCharacterClasses(studioCharacter);
  if (studioCharacter instanceof HTMLVideoElement) {
    applySelectedStudioCharacterVideoSource(studioCharacter);
    return;
  }
  applySelectedStudioCharacterSource(studioCharacter);
}

interface LaunchScreenElements {
  container: HTMLElement | null;
  studioPresentsContainer: HTMLElement | null;
  studioLogoUnit: HTMLElement | null;
  studioLogo: HTMLImageElement | null;
  studioLogoSheen: HTMLImageElement | null;
  studioCharacter: StudioCharacterElement | null;
}

class LaunchScreen {
  private elements: LaunchScreenElements;
  private isActive: boolean = false;
  private runAbortController: AbortController | null = null;
  // 🔥 FIX: Track event listener cleanup functions
  private eventCleanups: Array<() => void> = [];
  
  // Public getter for isActive
  get active(): boolean {
    return this.isActive;
  }

  constructor() {
    this.elements = {
      container: null,
      studioPresentsContainer: null,
      studioLogoUnit: null,
      studioLogo: null,
      studioLogoSheen: null,
      studioCharacter: null
    };
  }

  /**
   * Priority preload for paper background texture.
   * Must start before other heavy launch preloads while the paper surface is visible.
   */
  private preloadPriorityPaperBg(timeoutMs = 2000): Promise<void> {
    if (priorityPaperBgLoadPromise) return priorityPaperBgLoadPromise;

    priorityPaperBgLoadPromise = new Promise<void>((resolve) => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let img: HTMLImageElement | null = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (img) {
          img.onload = null;
          img.onerror = null;
          img = null;
        }
        resolve();
      };

      try {
        img = new Image();
        img.decoding = 'async';
        img.loading = 'eager';
        try { (img as any).fetchPriority = 'high'; } catch {}
        img.onload = () => {
          logger.info('✅ Priority paper background loaded (paper-bg.png)');
          finish();
        };
        img.onerror = () => {
          logger.warn('⚠️ Priority paper background failed to load (continuing)');
          finish();
        };
        img.src = './assets/paper-bg.png';
      } catch {
        finish();
      }

      timeoutId = setTimeout(() => {
        if (!finished) {
          logger.warn('⚠️ Priority paper background preload timeout (continuing)');
        }
        finish();
      }, timeoutMs);
    });

    return priorityPaperBgLoadPromise;
  }

  private isCurrentRun(container: HTMLElement): boolean {
    return this.isActive &&
      this.elements.container === container &&
      container.isConnected;
  }

  private waitForRun(promise: Promise<unknown>, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false);
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      };
      const onAbort = () => finish(false);
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        () => finish(true),
        (error) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          reject(error);
        }
      );
    });
  }

  /**
   * Initialize launch screen - creates DOM structure
   */
  init(): void {
    // Body is the single viewport-relative paper owner throughout startup.
    applyAppPaperBackground();

    // The inline HTML owns the first frame; cache it when present.
    const existingContainer = document.getElementById('launch-screen');
    if (existingContainer) {
      // Container already exists - just cache the elements
      this.elements.container = existingContainer as HTMLElement;
      this.elements.studioPresentsContainer = existingContainer.querySelector('.launch-studio-presents') as HTMLElement;
      this.elements.studioLogoUnit = existingContainer.querySelector('#launch-studio-logo-unit') as HTMLElement;
      this.elements.studioLogo = existingContainer.querySelector('#launch-studio-logo') as HTMLImageElement;
      this.elements.studioLogoSheen = existingContainer.querySelector('#launch-studio-logo-sheen') as HTMLImageElement;
      const existingStudioCharacter = existingContainer.querySelector('#launch-studio-character') as StudioCharacterElement | null;
      if (selectedStudioCharacterUsesMobileVideoProxy && !(existingStudioCharacter instanceof HTMLVideoElement)) {
        const studioCharacterVideo = document.createElement('video');
        studioCharacterVideo.id = 'launch-studio-character';
        studioCharacterVideo.className = 'launch-studio-character';
        existingStudioCharacter?.replaceWith(studioCharacterVideo);
        this.elements.studioCharacter = studioCharacterVideo;
      } else {
        this.elements.studioCharacter = existingStudioCharacter;
      }
      if (this.elements.studioLogo) {
        this.elements.studioLogo.src = STUDIO_LOGO_URL;
      }
      if (this.elements.studioLogoSheen) {
        this.elements.studioLogoSheen.src = STUDIO_LOGO_URL;
      }
      if (this.elements.studioCharacter) {
        applySelectedStudioCharacterMedia(this.elements.studioCharacter);
      }
      
      // 🔥 PREMIUM: Disable drag and long press on existing images
      this.disableImageDrag(this.elements.studioLogo);
      this.disableImageDrag(this.elements.studioLogoSheen);
      this.disableImageDrag(this.elements.studioCharacter);
      
      logger.info('✅ Launch screen elements cached from existing DOM');
      return;
    }
    
    if (this.elements.container) {
      logger.warn('⚠️ Launch screen already initialized');
      return;
    }

    // Create launch screen container
    const container = document.createElement('div');
    container.id = 'launch-screen';
    container.className = 'launch-screen';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      opacity: 1;
      visibility: visible;
    `;

    // Create content wrapper
    const content = document.createElement('div');
    content.className = 'launch-content';
    content.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const studioPresentsContainer = document.createElement('div');
    studioPresentsContainer.className = 'launch-studio-presents';
    studioPresentsContainer.style.cssText = `
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: visible;
    `;

    const studioLogoUnit = document.createElement('div');
    studioLogoUnit.id = 'launch-studio-logo-unit';
    studioLogoUnit.className = 'launch-studio-logo-unit';

    const studioLogo = document.createElement('img');
    studioLogo.id = 'launch-studio-logo';
    studioLogo.className = 'launch-studio-logo-art';
    studioLogo.src = STUDIO_LOGO_URL;
    studioLogo.alt = 'TapTap Design';
    studioLogo.loading = 'eager';
    studioLogo.draggable = false;
    this.disableImageDrag(studioLogo);

    const studioLogoSheen = studioLogo.cloneNode(false) as HTMLImageElement;
    studioLogoSheen.id = 'launch-studio-logo-sheen';
    studioLogoSheen.className = 'launch-studio-logo-art launch-studio-logo-sheen';
    studioLogoSheen.alt = '';
    studioLogoSheen.setAttribute('aria-hidden', 'true');
    this.disableImageDrag(studioLogoSheen);

    const presentsLabel = document.createElement('span');
    presentsLabel.className = 'launch-studio-presents-label';
    presentsLabel.textContent = 'PRESENTS';

    const studioCharacter = document.createElement(
      selectedStudioCharacterUsesMobileVideoProxy ? 'video' : 'img'
    ) as StudioCharacterElement;
    studioCharacter.id = 'launch-studio-character';
    studioCharacter.className = 'launch-studio-character';
    applySelectedStudioCharacterMedia(studioCharacter);
    if (studioCharacter instanceof HTMLImageElement) {
      studioCharacter.alt = '';
      studioCharacter.loading = 'eager';
    }
    studioCharacter.draggable = false;
    this.disableImageDrag(studioCharacter);

    const studioComposition = document.createElement('div');
    studioComposition.className = 'launch-studio-composition';
    studioLogoUnit.append(studioLogo, studioLogoSheen, presentsLabel);
    studioComposition.append(studioLogoUnit, studioCharacter);
    studioPresentsContainer.appendChild(studioComposition);
    content.appendChild(studioPresentsContainer);

    container.appendChild(content);
    document.body.appendChild(container);

    // Cache elements
    this.elements = {
      container,
      studioPresentsContainer,
      studioLogoUnit,
      studioLogo,
      studioLogoSheen,
      studioCharacter
    };

    logger.info('✅ Launch screen initialized');
  }

  /**
   * Start launch sequence
   * @param onComplete Callback when launch sequence completes
   */
  async start(onComplete?: () => void): Promise<void> {
    console.log('🔍 launchScreen.start() called', {
      isActive: this.isActive,
      hasContainer: !!this.elements.container,
      hasOnComplete: !!onComplete
    });
    logger.info('🔍 launchScreen.start() called', {
      isActive: this.isActive,
      hasContainer: !!this.elements.container,
      hasOnComplete: !!onComplete
    });
    
    if (this.isActive) {
      console.warn('⚠️ Launch screen already active - returning early');
      logger.warn('⚠️ Launch screen already active - returning early');
      return;
    }

    if (!this.elements.container) {
      console.error('❌ Launch screen not initialized - container missing');
      logger.error('❌ Launch screen not initialized - container missing');
      return;
    }

    this.isActive = true;
    this.runAbortController?.abort();
    const runAbortController = new AbortController();
    this.runAbortController = runAbortController;
    const runSignal = runAbortController.signal;
    console.log('🚀 Starting launch sequence...');
    logger.info('🚀 Starting launch sequence...');
    logger.info('🎲 Random studio character selected', selectedStudioCharacterUrl);

    // 🔥 PRIORITY: Start paper texture preload first, before other launch tasks.
    // This runs while the paper launch surface is displayed.
    const priorityPaperLoad = this.preloadPriorityPaperBg();

    // Start the one global theme with the studio intro; it continues through gameplay.
    try {
      const { startSoundtrack } = await import('./soundtrack-manager.js');
      startSoundtrack();
    } catch (e) {
      logger.warn('🔊 Soundtrack start failed:', e);
    }

    const { container, studioPresentsContainer, studioLogoUnit, studioLogo, studioLogoSheen, studioCharacter } = this.elements;

    // 🔥 CRITICAL: Log all elements to debug
    console.log('🔍 Launch screen elements check:', {
      container: !!container,
      studioPresentsContainer: !!studioPresentsContainer,
      studioLogoUnit: !!studioLogoUnit,
      studioLogo: !!studioLogo,
      studioLogoSheen: !!studioLogoSheen,
      studioCharacter: !!studioCharacter
    });
    logger.info('🔍 Launch screen elements check:', {
      container: !!container,
      studioPresentsContainer: !!studioPresentsContainer,
      studioLogoUnit: !!studioLogoUnit,
      studioLogo: !!studioLogo,
      studioLogoSheen: !!studioLogoSheen,
      studioCharacter: !!studioCharacter
    });

    if (!studioPresentsContainer || !studioLogoUnit || !studioLogo || !studioLogoSheen || !studioCharacter) {
      console.error('❌ Launch screen elements missing:', {
        studioPresentsContainer: !studioPresentsContainer,
        studioLogoUnit: !studioLogoUnit,
        studioLogo: !studioLogo,
        studioLogoSheen: !studioLogoSheen,
        studioCharacter: !studioCharacter
      });
      logger.error('❌ Launch screen elements missing:', {
        studioPresentsContainer: !studioPresentsContainer,
        studioLogoUnit: !studioLogoUnit,
        studioLogo: !studioLogo,
        studioLogoSheen: !studioLogoSheen,
        studioCharacter: !studioCharacter
      });
      this.isActive = false;
      return;
    }

    const launchStyle = getComputedStyle(container);
    const characterComplete = studioCharacter instanceof HTMLVideoElement
      ? studioCharacter.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
        studioCharacter.dataset.launchMotionSource === 'animated-webp-fallback'
      : studioCharacter.complete;
    const characterNaturalWidth = studioCharacter instanceof HTMLVideoElement
      ? studioCharacter.videoWidth
      : studioCharacter.naturalWidth;
    if (studioCharacter instanceof HTMLVideoElement) {
      studioCharacter.play().catch((error) => {
        logger.warn('⚠️ HEVC-alpha intro autoplay did not start immediately:', error);
      });
    }
    console.info('[CC_STARTUP_BG] phase=studio-presents', {
      background: launchStyle.background,
      backgroundColor: launchStyle.backgroundColor,
      backgroundImage: launchStyle.backgroundImage,
      paperComplete: priorityPaperBgLoadPromise !== null,
      logoComplete: studioLogo.complete,
      logoNaturalWidth: studioLogo.naturalWidth,
      characterComplete,
      characterNaturalWidth,
    });
    try {
      (window as any).webkit?.messageHandlers?.consoleLog?.postMessage?.({
        level: 'info',
        message: `[CC_STARTUP_BG] ${JSON.stringify({
          phase: 'studio-presents',
          backgroundColor: launchStyle.backgroundColor,
          backgroundImage: launchStyle.backgroundImage,
          logoComplete: studioLogo.complete,
          logoNaturalWidth: studioLogo.naturalWidth,
          characterComplete,
          characterNaturalWidth,
        })}`,
      });
    } catch {}
    const launchImagesReady = this.waitForMedia([studioLogo, studioLogoSheen, studioCharacter], 1800).catch(() => {
      logger.warn('⚠️ Studio intro media load timeout - continuing anyway');
    });

    const launchImagesCompleted = await this.waitForRun(Promise.all([
      priorityPaperLoad.catch(() => {}),
      launchImagesReady
    ]), runSignal);
    if (!launchImagesCompleted || !this.isCurrentRun(container)) return;

    // Begin actual homepage asset work behind the studio intro.
    logger.info('🔥 Starting critical image preloading behind studio intro...');
    const backgroundCriticalImagePreloadPromise = (async () => {
      try {
        const { preloadAllStartupImages } = await import('../utils/comprehensive-image-preloader.js');
        await preloadAllStartupImages();
        logger.info('✅ Critical images preloaded behind studio intro');
      } catch (error) {
        logger.warn('⚠️ Critical image preloading failed softly behind studio intro:', error);
      }
    })();
    backgroundCriticalImagePreloadPromise.catch(() => {});
    const criticalStartupReadinessPromise = waitForCriticalStartupReadiness({
      reason: 'studio-intro-preloader',
      timeoutMs: 3500,
    });

    studioPresentsContainer.style.setProperty('opacity', '1');
    const idleSheenTimer = window.setTimeout(() => {
      studioLogoSheen.classList.add('is-idle-active');
      logger.info('✨ Studio intro idle sheen activated');
    }, 200);
    this.eventCleanups.push(() => window.clearTimeout(idleSheenTimer));

    const logoEnterPromise = new Promise<void>((resolve) => {
      trackTween(studioLogoUnit, {
        opacity: 1,
        scale: 1,
        duration: 0.45,
        ease: 'power2.inOut',
        onComplete: resolve,
        onInterrupt: resolve
      });
    });

    const characterEnterPromise = new Promise<void>((resolve) => {
      const characterEnterTimer = window.setTimeout(() => {
        trackTween(studioCharacter, {
          opacity: 1,
          scale: selectedStudioCharacterRestScale,
          duration: 0.55,
          ease: 'back.out(1.8)',
          onComplete: resolve,
          onInterrupt: resolve
        });
      }, 150);
      this.eventCleanups.push(() => {
        window.clearTimeout(characterEnterTimer);
        resolve();
      });
    });
    const enterCompleted = await this.waitForRun(
      Promise.all([logoEnterPromise, characterEnterPromise]),
      runSignal
    );
    if (!enterCompleted || !this.isCurrentRun(container)) return;

    const idleRotation = 0.7 + Math.random() * 0.55;
    const idleDirection = Math.random() < 0.5 ? -1 : 1;
    const idleBreathScale = 1.008 + Math.random() * 0.012;
    const idleHalfDuration = 0.9 + Math.random() * 0.35;
    const characterIdleTween = selectedStudioCharacterHasOwnMotion ? null : trackTween(studioCharacter, {
      keyframes: [
        {
          rotation: -idleRotation * idleDirection,
          scale: 1.004,
          duration: idleHalfDuration,
          ease: 'sine.inOut'
        },
        {
          rotation: idleRotation * idleDirection,
          scale: idleBreathScale,
          duration: idleHalfDuration * 2,
          ease: 'sine.inOut'
        },
        {
          rotation: 0,
          scale: 1,
          duration: idleHalfDuration,
          ease: 'sine.inOut'
        }
      ],
      repeat: -1
    });
    if (selectedStudioCharacterHasOwnMotion) {
      logger.info('🎭 Studio character uses authored SVG motion');
    } else {
      logger.info('🎭 Studio character gentle idle started', {
        rotationDegrees: Number(idleRotation.toFixed(2)),
        breathScale: Number(idleBreathScale.toFixed(3)),
        firstDirection: idleDirection < 0 ? 'counterclockwise' : 'clockwise'
      });
    }

    // Keep the intro visible for its hero moment while bounded critical readiness
    // runs in parallel. Remaining route preloads continue safely in the background.
    const preloadCompleted = await this.waitForRun(Promise.all([
      new Promise(resolve => setTimeout(resolve, 2800)),
      criticalStartupReadinessPromise
    ]), runSignal);
    if (!preloadCompleted || !this.isCurrentRun(container)) return;

    studioLogoSheen.classList.remove('is-idle-active');
    characterIdleTween?.kill?.();
    logger.info('✅ Studio intro preload complete - homepage readiness satisfied');
    
    // Reassert the one shared surface before exit; the launch layer stays clear.
    applyAppPaperBackground();
    container.style.background = 'transparent';

    const characterExitPromise = new Promise<void>((resolve) => {
      trackTween(studioCharacter, {
        scale: 0,
        duration: 0.65,
        ease: 'back.in(2.2)',
        force3D: true,
        onInterrupt: resolve,
        onComplete: () => {
          // Keep the zero-scale child in the centered flex layout until the
          // complete composition exits; display:none here recenters the logo
          // mid-flight and visually reads as a duplicated second exit.
          logger.info('✅ Studio character exit complete');
          resolve();
        }
      });
    });

    const logoExitPromise = new Promise<void>((resolve) => {
      const logoExitTimer = window.setTimeout(() => {
        trackTween(studioLogoUnit, {
          scale: 0,
          duration: 0.65,
          ease: 'back.in(2.2)',
          force3D: true,
          onInterrupt: resolve,
          onComplete: () => {
            logger.info('✅ Studio logo exit complete');
            resolve();
          }
        });
      }, 180);
      this.eventCleanups.push(() => {
        window.clearTimeout(logoExitTimer);
        resolve();
      });
    });

    const exitCompleted = await this.waitForRun(
      Promise.all([characterExitPromise, logoExitPromise]),
      runSignal
    );
    if (!exitCompleted || !this.isCurrentRun(container)) return;
    studioPresentsContainer.style.display = 'none';

    this.hide();
    this.remove();
    console.log('✅ Launch screen container removed from DOM');
    logger.info('✅ Launch screen container removed from DOM');

    this.isActive = false;
    if (this.runAbortController === runAbortController) {
      this.runAbortController = null;
    }
    console.log('✅ Launch sequence completed - isActive set to false, ready for homepage enter animation');
    logger.info('✅ Launch sequence completed - isActive set to false, ready for homepage enter animation');

    if (onComplete) {
      logger.info('✅ Calling onComplete callback...');
      onComplete();
      logger.info('✅ onComplete callback executed');
    } else {
      logger.warn('⚠️ No onComplete callback provided');
    }

    // The paper gradient is already set; do not reset it here.
    // Just remove boot class if it exists
    try {
      if (document.documentElement) {
        document.documentElement.classList.remove('boot');
      }
      if (document.body) {
        document.body.classList.remove('boot');
        document.body.classList.remove('cc-launch-boot-active');
      }
      logger.info('✅ Boot class removed after launch screen completion');
    } catch(e) {
      logger.warn('⚠️ Failed to remove boot class:', e);
    }
  }

  /**
   * Hide launch screen
   */
  hide(): void {
    if (this.elements.container) {
      this.elements.container.style.display = 'none';
      this.elements.container.style.visibility = 'hidden';
      this.elements.container.style.background = 'transparent';
      logger.info('✅ Launch screen hidden; shared paper surface preserved');
    }
  }

  /**
   * Abort any in-flight launch lifecycle and run the same complete cleanup
   * used by the successful path. Safe to call repeatedly.
   */
  dispose(reason = 'launch-dispose'): void {
    logger.warn('🧹 Disposing launch screen', 'launch-screen', { reason });
    this.isActive = false;
    this.runAbortController?.abort();
    this.runAbortController = null;
    try {
      this.elements.studioLogoSheen?.classList.remove('is-idle-active');
    } catch {}
    this.remove();
    try {
      document.documentElement?.classList.remove('boot');
      document.body?.classList.remove('boot');
      document.body?.classList.remove('cc-launch-boot-active');
    } catch {}
  }

  /**
   * Remove launch screen from DOM
   */
  remove(): void {
    // 🔥 FIX: Remove all event listeners first
    this.eventCleanups.forEach(cleanup => {
      try { cleanup(); } catch {}
    });
    this.eventCleanups = [];
    
    // 🔥 FIX: Kill GSAP animations on all launch screen elements to prevent memory leaks
    const elementsToKill = [
      this.elements.container,
      this.elements.studioPresentsContainer,
      this.elements.studioLogoUnit,
      this.elements.studioLogo,
      this.elements.studioLogoSheen,
      this.elements.studioCharacter
    ].filter(Boolean);
    
    if (elementsToKill.length > 0) {
      gsap.killTweensOf(elementsToKill);
    }

    if (this.elements.studioCharacter instanceof HTMLVideoElement) {
      this.elements.studioCharacter.pause();
      this.elements.studioCharacter.removeAttribute('src');
      this.elements.studioCharacter.load();
    }
    
    if (this.elements.container && this.elements.container.parentElement) {
      this.elements.container.parentElement.removeChild(this.elements.container);
    }
    
    // 🔥 FIX: Clear all element references to allow garbage collection
    this.elements.container = null;
    this.elements.studioPresentsContainer = null;
    this.elements.studioLogoUnit = null;
    this.elements.studioLogo = null;
    this.elements.studioLogoSheen = null;
    this.elements.studioCharacter = null;
  }

  /**
   * Disable image dragging and long press (premium app behavior)
   * @param img Image element to disable drag on
   */
  private disableImageDrag(img: HTMLElement | null): void {
    if (!img) return;
    
    img.draggable = false;
    img.style.userSelect = 'none';
    img.style.webkitUserSelect = 'none';
    img.style.mozUserSelect = 'none';
    img.style.msUserSelect = 'none';
    img.style.webkitUserDrag = 'none';
    img.style.webkitTouchCallout = 'none';
    
    // Prevent drag and context menu events
    // 🔥 FIX: Store handlers for cleanup
    const handlers = {
      dragstart: (e: Event) => e.preventDefault(),
      contextmenu: (e: Event) => e.preventDefault(),
      selectstart: (e: Event) => e.preventDefault(),
      touchstart: (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }
    };
    
    img.addEventListener('dragstart', handlers.dragstart);
    img.addEventListener('contextmenu', handlers.contextmenu);
    img.addEventListener('selectstart', handlers.selectstart);
    img.addEventListener('touchstart', handlers.touchstart, { passive: false });
    
    // Store cleanup function
    this.eventCleanups.push(() => {
      img.removeEventListener('dragstart', handlers.dragstart);
      img.removeEventListener('contextmenu', handlers.contextmenu);
      img.removeEventListener('selectstart', handlers.selectstart);
      img.removeEventListener('touchstart', handlers.touchstart);
    });
  }

  /**
   * Wait for launch images/video to load (with optional timeout)
   * @param media Array of image or video elements to wait for
   * @param timeoutMs Maximum time to wait in milliseconds (default: no timeout)
   */
  private waitForMedia(media: Array<HTMLImageElement | HTMLVideoElement>, timeoutMs?: number): Promise<void> {
    return new Promise((resolve) => {
      let loadedCount = 0;
      const total = media.length;
      let resolved = false;
      const cleanups: Array<() => void> = [];
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      if (total === 0) {
        resolve();
        return;
      }

      const finish = (message?: string) => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        cleanups.forEach(cleanup => {
          try { cleanup(); } catch {}
        });
        if (message) logger.warn(message);
        resolve();
      };

      const checkComplete = () => {
        if (resolved) return;
        loadedCount++;
        if (loadedCount === total) {
          logger.info(`✅ All ${total} launch media elements loaded`);
          finish();
        }
      };

      // Set timeout if provided
      if (timeoutMs && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          finish(`⚠️ Media loading timeout after ${timeoutMs}ms - continuing anyway`);
        }, timeoutMs);
      }

      media.forEach((item) => {
        if (item instanceof HTMLVideoElement) {
          const markVideoLoaded = () => checkComplete();
          const markVideoFailed = () => {
            logger.warn(`⚠️ Failed to load launch video: ${item.currentSrc || item.src}`);
            checkComplete();
          };
          if (
            item.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
            item.dataset.launchMotionSource === 'animated-webp-fallback'
          ) {
            markVideoLoaded();
            return;
          }
          item.addEventListener('loadeddata', markVideoLoaded, { once: true });
          item.addEventListener('error', markVideoFailed, { once: true });
          cleanups.push(() => {
            item.removeEventListener('loadeddata', markVideoLoaded);
            item.removeEventListener('error', markVideoFailed);
          });
          return;
        }

        const img = item;
        const markLoaded = () => {
          if (typeof img.decode === 'function' && img.naturalWidth > 0) {
            img.decode().catch(() => {}).finally(checkComplete);
            return;
          }
          checkComplete();
        };
        const markFailed = () => {
          logger.warn(`⚠️ Failed to load image: ${img.src}`);
          checkComplete(); // Continue even if image fails
        };

        if (img.complete) {
          if (img.naturalWidth > 0) {
            markLoaded();
          } else {
            markFailed();
          }
          return;
        }

        img.addEventListener('load', markLoaded, { once: true });
        img.addEventListener('error', markFailed, { once: true });
        cleanups.push(() => {
          img.removeEventListener('load', markLoaded);
          img.removeEventListener('error', markFailed);
        });
      });
    });
  }
}

// Export singleton instance
export const launchScreen = new LaunchScreen();
