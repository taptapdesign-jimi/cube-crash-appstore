// @ts-nocheck
// Launch Screen Module
// Handles the initial Stack to Six preload sequence.

import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { logger } from '../core/logger.js';
import { getOriginalGsapTo } from './drag-core.js';
import { waitForCriticalStartupReadiness } from '../utils/startup-readiness.js';
import { applyAppPaperBackground } from '../utils/app-paper-background.js';

// 🔥 CRITICAL FIX: Use original GSAP functions to prevent infinite recursion
const trackTween = (target: any, vars: any) => {
  const origTo = getOriginalGsapTo();
  return animationManager.trackExternalTween(origTo(target, vars));
};

let priorityPaperBgLoadPromise: Promise<void> | null = null;
const STUDIO_LOGO_URL = new URL('../../assets/logo addons/taplogo.png', import.meta.url).href;
const studioCharacterModules = import.meta.glob([
  '../../assets/logo addons/lik-*.png',
  '../../assets/logo addons/lik slikanje.png',
  '!../../assets/logo addons/lik-*@2x.png',
  '!../../assets/logo addons/lik-board.png',
  '!../../assets/logo addons/lik-dron.png',
  '!../../assets/logo addons/lik-klizanje.png',
  '!../../assets/logo addons/lik-vrt.png',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const STUDIO_CHARACTER_URLS = Object.values(studioCharacterModules);
const selectedStudioCharacterUrl = STUDIO_CHARACTER_URLS[
  Math.floor(Math.random() * STUDIO_CHARACTER_URLS.length)
] || new URL('../../assets/logo addons/lik-game.png', import.meta.url).href;

interface LaunchScreenElements {
  container: HTMLElement | null;
  studioPresentsContainer: HTMLElement | null;
  studioLogoUnit: HTMLElement | null;
  studioLogo: HTMLImageElement | null;
  studioLogoSheen: HTMLImageElement | null;
  studioCharacter: HTMLImageElement | null;
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
      this.elements.studioCharacter = existingContainer.querySelector('#launch-studio-character') as HTMLImageElement;
      if (this.elements.studioLogo) {
        this.elements.studioLogo.src = STUDIO_LOGO_URL;
      }
      if (this.elements.studioLogoSheen) {
        this.elements.studioLogoSheen.src = STUDIO_LOGO_URL;
      }
      if (this.elements.studioCharacter) {
        this.elements.studioCharacter.src = selectedStudioCharacterUrl;
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

    const studioCharacter = document.createElement('img');
    studioCharacter.id = 'launch-studio-character';
    studioCharacter.className = 'launch-studio-character';
    studioCharacter.src = selectedStudioCharacterUrl;
    studioCharacter.alt = '';
    studioCharacter.loading = 'eager';
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

    // Start soundtrack with the studio intro (fades out when board game starts).
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
    console.info('[CC_STARTUP_BG] phase=studio-presents', {
      background: launchStyle.background,
      backgroundColor: launchStyle.backgroundColor,
      backgroundImage: launchStyle.backgroundImage,
      paperComplete: priorityPaperBgLoadPromise !== null,
      logoComplete: studioLogo.complete,
      logoNaturalWidth: studioLogo.naturalWidth,
      characterComplete: studioCharacter.complete,
      characterNaturalWidth: studioCharacter.naturalWidth,
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
          characterComplete: studioCharacter.complete,
          characterNaturalWidth: studioCharacter.naturalWidth,
        })}`,
      });
    } catch {}
    const launchImagesReady = this.waitForImages([studioLogo, studioLogoSheen, studioCharacter], 1800).catch(() => {
      logger.warn('⚠️ Studio intro image load timeout - continuing anyway');
    });

    const launchImagesCompleted = await this.waitForRun(Promise.all([
      priorityPaperLoad.catch(() => {}),
      launchImagesReady
    ]), runSignal);
    if (!launchImagesCompleted || !this.isCurrentRun(container)) return;

    // Begin actual homepage asset work behind the studio intro.
    logger.info('🔥 Starting critical image preloading behind studio intro...');
    const criticalImagePreloadPromise = (async () => {
      try {
        const { preloadAllStartupImages } = await import('../utils/comprehensive-image-preloader.js');
        await preloadAllStartupImages();
        logger.info('✅ Critical images preloaded behind studio intro');
      } catch (error) {
        logger.warn('⚠️ Critical image preloading failed softly behind studio intro:', error);
      }
    })();

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
          scale: 1,
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
    const characterIdleTween = trackTween(studioCharacter, {
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
    logger.info('🎭 Studio character gentle idle started', {
      rotationDegrees: Number(idleRotation.toFixed(2)),
      breathScale: Number(idleBreathScale.toFixed(3)),
      firstDirection: idleDirection < 0 ? 'counterclockwise' : 'clockwise'
    });

    // Keep the intro visible for its hero moment and for all critical preload work.
    const preloadCompleted = await this.waitForRun(Promise.all([
      new Promise(resolve => setTimeout(resolve, 2800)),
      criticalImagePreloadPromise.catch(() => {})
    ]), runSignal);
    if (!preloadCompleted || !this.isCurrentRun(container)) return;

    const readinessCompleted = await this.waitForRun(waitForCriticalStartupReadiness({
      reason: 'studio-intro-preloader',
      timeoutMs: 10000,
    }), runSignal);
    if (!readinessCompleted || !this.isCurrentRun(container)) return;

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
  private disableImageDrag(img: HTMLImageElement | null): void {
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
   * Wait for images to load (with optional timeout)
   * @param images Array of image elements to wait for
   * @param timeoutMs Maximum time to wait in milliseconds (default: no timeout)
   */
  private waitForImages(images: HTMLImageElement[], timeoutMs?: number): Promise<void> {
    return new Promise((resolve) => {
      let loadedCount = 0;
      const total = images.length;
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
          logger.info(`✅ All ${total} launch images loaded`);
          finish();
        }
      };

      // Set timeout if provided
      if (timeoutMs && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          finish(`⚠️ Image loading timeout after ${timeoutMs}ms - continuing anyway`);
        }, timeoutMs);
      }

      images.forEach((img) => {
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
