// Launch Screen Module
// Handles the initial launch sequence with taptapdesign logo → stack to six logo → app

import { gsap } from 'gsap';
import { logger } from '../core/logger.js';

interface LaunchScreenElements {
  container: HTMLElement | null;
  taptapContainer: HTMLElement | null;
  taptapLogo: HTMLImageElement | null;
  stackContainer: HTMLElement | null;
  stackLogo: HTMLImageElement | null;
  smokeShards: HTMLImageElement | null;
}

class LaunchScreen {
  private elements: LaunchScreenElements;
  private isActive: boolean = false;
  
  // Public getter for isActive
  get active(): boolean {
    return this.isActive;
  }

  constructor() {
    this.elements = {
      container: null,
      taptapContainer: null,
      taptapLogo: null,
      stackContainer: null,
      stackLogo: null,
      smokeShards: null
    };
  }

  /**
   * Initialize launch screen - creates DOM structure
   */
  init(): void {
    // 🔥 CRITICAL: If container already exists (created in launch-screen-init.ts), just cache it
    const existingContainer = document.getElementById('launch-screen');
    if (existingContainer) {
      // Container already exists - just cache the elements
      this.elements.container = existingContainer as HTMLElement;
      this.elements.taptapContainer = existingContainer.querySelector('.launch-logo-taptap') as HTMLElement;
      this.elements.taptapLogo = existingContainer.querySelector('#launch-logo-taptap') as HTMLImageElement;
      this.elements.stackContainer = existingContainer.querySelector('.launch-logo-stack') as HTMLElement;
      this.elements.stackLogo = existingContainer.querySelector('#launch-logo-stack') as HTMLImageElement;
      this.elements.smokeShards = existingContainer.querySelector('#launch-smoke-shards') as HTMLImageElement;
      logger.info('✅ Launch screen elements cached from existing DOM');
      return;
    }
    
    if (this.elements.container) {
      logger.warn('⚠️ Launch screen already initialized');
      return;
    }

    // 🔥 SENIOR PRINCIPAL: Single source of truth for background
    // Set #F9F9F9 immediately and synchronously - this is the ONLY place that sets initial background
    // CSS already has #F9F9F9 as fallback, but we enforce it here to prevent any race conditions
    this.setBackground('#F9F9F9');

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
      background: #F9F9F9;
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

    // Phase 1: Taptapdesign logo container
    const taptapContainer = document.createElement('div');
    taptapContainer.className = 'launch-logo-taptap';
    taptapContainer.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 1;
      visibility: visible;
    `;

    const taptapLogo = document.createElement('img');
    taptapLogo.id = 'launch-logo-taptap';
    taptapLogo.src = './assets/taptapdesign.png';
    taptapLogo.alt = 'TapTap Design';
    taptapLogo.loading = 'eager';
    taptapLogo.style.cssText = `
      width: 344px;
      height: auto;
      display: block;
      margin: 0 auto;
    `;

    taptapContainer.appendChild(taptapLogo);
    content.appendChild(taptapContainer);

    // Phase 2: Stack to six logo container
    const stackContainer = document.createElement('div');
    stackContainer.className = 'launch-logo-stack';
    stackContainer.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      display: none;
      align-items: center;
      justify-content: center;
      opacity: 0;
    `;

    // Smoke and shards background
    const smokeShards = document.createElement('img');
    smokeShards.id = 'launch-smoke-shards';
    smokeShards.src = './assets/logo addons/smokeandshards.png';
    smokeShards.alt = '';
    smokeShards.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.6);
      width: 400px;
      height: auto;
      opacity: 1.0;
      z-index: 1;
      pointer-events: none;
    `;

    // Stack to six logo
    const stackLogo = document.createElement('img');
    stackLogo.id = 'launch-logo-stack';
    stackLogo.src = './assets/logo-cube-crash.png';
    stackLogo.alt = 'CubeCrash';
    stackLogo.style.cssText = `
      width: 248px;
      height: auto;
      display: block;
      margin: 0 auto;
      position: relative;
      z-index: 2;
      opacity: 0;
    `;

    stackContainer.appendChild(smokeShards);
    stackContainer.appendChild(stackLogo);
    content.appendChild(stackContainer);

    container.appendChild(content);
    document.body.appendChild(container);

    // Cache elements
    this.elements = {
      container,
      taptapContainer,
      taptapLogo,
      stackContainer,
      stackLogo,
      smokeShards
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
    console.log('🚀 Starting launch sequence...');
    logger.info('🚀 Starting launch sequence...');

    const { container, taptapContainer, taptapLogo, stackContainer, stackLogo, smokeShards } = this.elements;

    // 🔥 CRITICAL: Log all elements to debug
    console.log('🔍 Launch screen elements check:', {
      container: !!container,
      taptapContainer: !!taptapContainer,
      taptapLogo: !!taptapLogo,
      stackContainer: !!stackContainer,
      stackLogo: !!stackLogo,
      smokeShards: !!smokeShards
    });
    logger.info('🔍 Launch screen elements check:', {
      container: !!container,
      taptapContainer: !!taptapContainer,
      taptapLogo: !!taptapLogo,
      stackContainer: !!stackContainer,
      stackLogo: !!stackLogo,
      smokeShards: !!smokeShards
    });

    if (!taptapContainer || !taptapLogo || !stackContainer || !stackLogo || !smokeShards) {
      console.error('❌ Launch screen elements missing:', {
        taptapContainer: !taptapContainer,
        taptapLogo: !taptapLogo,
        stackContainer: !stackContainer,
        stackLogo: !stackLogo,
        smokeShards: !smokeShards
      });
      logger.error('❌ Launch screen elements missing:', {
        taptapContainer: !taptapContainer,
        taptapLogo: !taptapLogo,
        stackContainer: !stackContainer,
        stackLogo: !stackLogo,
        smokeShards: !smokeShards
      });
      this.isActive = false;
      return;
    }

    // 🔥 OPTIMIZATION: Show taptap logo IMMEDIATELY (don't wait for image load)
    // Set opacity to 1 immediately so user sees it right away
    taptapContainer.style.opacity = '1';
    taptapContainer.style.visibility = 'visible';
    console.log('🎬 Phase 1: Taptapdesign logo shown immediately');
    logger.info('🎬 Phase 1: Taptapdesign logo shown immediately');
    
    // Wait for image in background (non-blocking)
    this.waitForImages([taptapLogo], 1000).catch(() => {
      logger.warn('⚠️ Taptap logo image load timeout - continuing anyway');
    });

    // PHASE 1: Show taptap logo for 2 seconds max (user requested 2 seconds for taptap)
    // Logo is already visible, just wait
    logger.info('⏳ Phase 1: Waiting 2 seconds for taptap logo...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    logger.info('✅ Phase 1: 2 seconds elapsed, starting fade out');

    // Fade out taptapdesign (fast fade out)
    logger.info('🎬 Phase 1: Fading out taptapdesign logo');
    await new Promise<void>((resolve) => {
      gsap.to(taptapContainer, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          // 🔥 CRITICAL: Hide and remove from DOM to prevent ghost images
          taptapContainer.style.display = 'none';
          taptapContainer.style.visibility = 'hidden';
          taptapContainer.style.pointerEvents = 'none';
          // Remove from DOM completely
          if (taptapContainer.parentElement) {
            taptapContainer.parentElement.removeChild(taptapContainer);
          }
          logger.info('✅ Phase 1: Taptapdesign logo faded out and removed');
          resolve();
        }
      });
    });

    // PHASE 2: Fade in gradient background + stack to six logo + smokeclouds
    logger.info('🎬 Phase 2: Starting - Fading in gradient + stack to six logo + smokeclouds');
    
    // 🔥 SENIOR PRINCIPAL: Single source of truth - set background ONLY here, in Phase 2
    // Keep the original stack-to-six gradient, then overlay paper texture at 60% opacity
    const gradientBg = 'linear-gradient(180deg, #f3eee8 0%, #fcecdf 60%, #fcecdf 100%)';
    const paperOverlayAlpha = 0.4; // 1 - 0.6
    const paperBg = `linear-gradient(rgba(243,238,232,${paperOverlayAlpha}), rgba(243,238,232,${paperOverlayAlpha})), url('./assets/paper-bg.png') center/100% 100% no-repeat, ${gradientBg}`;
    this.setBackground(paperBg);
    
    // 🔥 CRITICAL: Ensure container has 100% opacity and high z-index to cover everything
    if (container) {
      container.style.opacity = '1';
      container.style.visibility = 'visible';
      container.style.zIndex = '10000';
      container.style.background = paperBg; // Set directly on container too
    }
    
    // Show stack container IMMEDIATELY (don't wait for images)
    // 🔥 CRITICAL: Override any inline styles that might hide the stack container
    // Use setProperty with !important to override inline styles from index.html
    if (!stackContainer) {
      logger.error('❌ Stack container not found!');
      return;
    }
    
    if (!stackLogo) {
      logger.error('❌ Stack logo not found!');
      return;
    }
    
    if (!smokeShards) {
      logger.error('❌ Smoke shards not found!');
      return;
    }
    
    // 🔥 CRITICAL: Use setProperty with !important to override inline styles
    stackContainer.style.setProperty('display', 'flex', 'important');
    stackContainer.style.setProperty('opacity', '1', 'important');
    stackContainer.style.setProperty('visibility', 'visible', 'important');
    stackContainer.style.setProperty('position', 'absolute', 'important');
    stackContainer.style.setProperty('width', '100%', 'important');
    stackContainer.style.setProperty('height', '100%', 'important');
    stackContainer.style.setProperty('align-items', 'center', 'important');
    stackContainer.style.setProperty('justify-content', 'center', 'important');
    stackContainer.style.setProperty('z-index', '1', 'important');
    
    smokeShards.style.setProperty('opacity', '1.0', 'important');
    smokeShards.style.setProperty('visibility', 'visible', 'important');
    smokeShards.style.setProperty('display', 'block', 'important');
    
    stackLogo.style.setProperty('opacity', '1', 'important');
    stackLogo.style.setProperty('visibility', 'visible', 'important');
    stackLogo.style.setProperty('display', 'block', 'important');
    
    logger.info('🎬 Phase 2: Stack to six logo shown immediately');
    logger.info('🔍 Stack container verification:', {
      containerExists: !!stackContainer,
      logoExists: !!stackLogo,
      smokeShardsExists: !!smokeShards,
      display: window.getComputedStyle(stackContainer).display,
      opacity: window.getComputedStyle(stackContainer).opacity,
      visibility: window.getComputedStyle(stackContainer).visibility,
      stackLogoOpacity: window.getComputedStyle(stackLogo).opacity,
      smokeShardsOpacity: window.getComputedStyle(smokeShards).opacity
    });
    
    // Wait for images in background (non-blocking)
    this.waitForImages([stackLogo, smokeShards], 1000).catch(() => {
      logger.warn('⚠️ Stack logo images load timeout - continuing anyway');
    });

    // 🔥 PRODUCTION READY iOS APP STORE: Preload critical homepage slider images DURING Phase 2
    // Launch screen Phase 2 lasts 2.5 seconds - perfect time to preload critical images
    // This ensures homepage slider images are ALWAYS ready when homepage appears
    logger.info('🔥 PRODUCTION READY: Starting critical image preloading during Phase 2 (stack to six)...');
    const criticalImagePreloadPromise = (async () => {
      try {
        const { preloadAllStartupImages } = await import('../utils/comprehensive-image-preloader.js');
        // Start preloading - this will load critical images BLOCKING
        await preloadAllStartupImages();
        logger.info('✅ Critical images preloaded during Phase 2');
      } catch (error) {
        logger.warn('⚠️ Critical image preloading failed during Phase 2 (non-critical):', error);
      }
    })();

    // Show for 2.5 seconds (user requested 2.5 seconds for stack to six)
    // 🔥 CRITICAL: Wait for BOTH 2.5 seconds AND critical image preloading (whichever finishes first)
    // This ensures we don't delay launch screen unnecessarily, but also don't show homepage without images
    await Promise.race([
      new Promise(resolve => setTimeout(resolve, 2500)), // Minimum 2.5 seconds
      criticalImagePreloadPromise.catch(() => {}) // Or until critical images are loaded
    ]);
    
    logger.info('✅ Phase 2 complete - critical images preloaded (or timeout reached)');

    // PHASE 3: Scale down all images to 0% and fade out
    logger.info('🎬 Phase 3: Scaling down all images to 0%');
    
    // 🔥 CRITICAL: Set container background to gradient BEFORE fade out to prevent white flash
    // Container currently has #F9F9F9, but we need gradient to match body/html
    const preservedGradient = 'linear-gradient(180deg, #f3eee8 0%, #fcecdf 60%, #fcecdf 100%)';
    const preservedPaperBg = `linear-gradient(rgba(243,238,232,0.4), rgba(243,238,232,0.4)), url('./assets/paper-bg.png') center/100% 100% no-repeat, ${preservedGradient}`;
    container.style.background = preservedPaperBg;
    logger.info('✅ Phase 3: Container background set to paper + gradient before fade out');
    
    // 🔥 CRITICAL: Ensure gradient background stays visible on body, html, and #global-bg
    // Do this BEFORE fade out to prevent any white flash
    if (document.body) {
      document.body.style.setProperty('background', preservedPaperBg, 'important');
      document.body.style.setProperty('background-color', '#f3eee8', 'important');
      document.body.style.setProperty('background-image', preservedPaperBg, 'important');
    }
    if (document.documentElement) {
      document.documentElement.style.setProperty('background', preservedPaperBg, 'important');
      document.documentElement.style.setProperty('background-color', '#f3eee8', 'important');
      document.documentElement.style.setProperty('background-image', preservedPaperBg, 'important');
    }
    const globalBg = document.getElementById('global-bg');
    if (globalBg) {
      (globalBg as HTMLElement).style.setProperty('background', preservedPaperBg, 'important');
    }
    logger.info('✅ Phase 3: Paper+gradient background explicitly set on body/html/#global-bg BEFORE fade out');
    
    await new Promise<void>((resolve) => {
      gsap.to([stackLogo, smokeShards, stackContainer], {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          // 🔥 CRITICAL: Hide and remove from DOM to prevent ghost images
          stackContainer.style.display = 'none';
          stackContainer.style.visibility = 'hidden';
          stackContainer.style.pointerEvents = 'none';
          stackLogo.style.display = 'none';
          stackLogo.style.visibility = 'hidden';
          smokeShards.style.display = 'none';
          smokeShards.style.visibility = 'hidden';
          // Remove from DOM completely
          if (stackContainer.parentElement) {
            stackContainer.parentElement.removeChild(stackContainer);
          }
          logger.info('✅ Phase 3: All images scaled down and removed');
          resolve();
        }
      });

      // Also fade out container (but NOT the background - gradient stays!)
      // Only fade out the container's opacity, don't touch background
      // 🔥 CRITICAL: Container background is already set to gradient above
      gsap.to(container, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
      // 🔥 CRITICAL: Ensure container background stays as paper+gradient
      container.style.background = preservedPaperBg;
      logger.info('✅ Phase 3: Launch screen faded out (paper+gradient preserved on container)');
          
          // 🔥 CRITICAL: Hide launch screen container completely
          this.hide();
          
          // 🔥 CRITICAL: Remove container from DOM completely so main.ts can detect it's gone
          this.remove();
          console.log('✅ Launch screen container removed from DOM');
          logger.info('✅ Launch screen container removed from DOM');
          
          // 🔥 CRITICAL: Set isActive to false FIRST, before calling onComplete
          // This ensures main.ts can detect that launch screen is complete
          this.isActive = false;
          console.log('✅ Launch sequence completed - isActive set to false, ready for homepage enter animation');
          logger.info('✅ Launch sequence completed - isActive set to false, ready for homepage enter animation');
          
          // 🔥 CRITICAL: Call completion callback AFTER everything is done (including scale down and fade out)
          // This ensures homepage enter animation starts only after launch screen is completely gone
          if (onComplete) {
            logger.info('✅ Calling onComplete callback...');
            onComplete();
            logger.info('✅ onComplete callback executed');
          } else {
            logger.warn('⚠️ No onComplete callback provided');
          }
        }
      });
    });

    // 🔥 CRITICAL: Gradient is already set in Phase 2, no need to set it again here
    // Just remove boot class if it exists
    try {
      if (document.documentElement) {
        document.documentElement.classList.remove('boot');
      }
      if (document.body) {
        document.body.classList.remove('boot');
      }
      logger.info('✅ Boot class removed after launch screen completion (gradient already set in Phase 2)');
    } catch(e) {
      logger.warn('⚠️ Failed to remove boot class:', e);
    }
  }

  /**
   * Hide launch screen
   */
  hide(): void {
    if (this.elements.container) {
      // 🔥 CRITICAL: Don't reset background when hiding - gradient must stay!
      // Only hide the container, but preserve its gradient background
      this.elements.container.style.display = 'none';
      this.elements.container.style.visibility = 'hidden';
      // Ensure background is still gradient (not white)
      const preservedGradient = 'linear-gradient(180deg, #f3eee8 0%, rgba(252, 236, 223, 0.92) 60%, #fcecdf 100%)';
      this.elements.container.style.background = preservedGradient;
      logger.info('✅ Launch screen hidden (gradient background preserved)');
    }
  }

  /**
   * Remove launch screen from DOM
   */
  remove(): void {
    if (this.elements.container && this.elements.container.parentElement) {
      this.elements.container.parentElement.removeChild(this.elements.container);
      this.elements.container = null;
    }
  }

  /**
   * Set background color - SINGLE SOURCE OF TRUTH
   * This is the ONLY function that sets background, ensuring no conflicts
   */
  private setBackground(colorOrGradient: string): void {
    try {
      logger.info('🎨 launch-screen.setBackground() called:', colorOrGradient.substring(0, 50) + '...');
      
      // Set on container with 100% opacity
      if (this.elements.container) {
        this.elements.container.style.background = colorOrGradient;
        this.elements.container.style.opacity = '1';
        this.elements.container.style.visibility = 'visible';
        this.elements.container.style.zIndex = '10000';
        logger.info('✅ Launch screen container background set with 100% opacity');
      }
      
      // Set on body and html using GSAP (no !important to avoid conflicts)
      if (document.body && gsap) {
        gsap.killTweensOf(document.body);
        document.body.style.transition = 'none';
        gsap.set(document.body, { background: colorOrGradient });
        logger.info('✅ Body gradient set via GSAP in launch-screen');
      } else if (document.body) {
        document.body.style.background = colorOrGradient;
        logger.info('✅ Body gradient set directly (GSAP not available)');
      }
      
      if (document.documentElement) {
        document.documentElement.style.background = colorOrGradient;
        logger.info('✅ HTML gradient set directly');
      }
      
      // Set on #global-bg - create if it doesn't exist
      let globalBg = document.getElementById('global-bg');
      if (!globalBg) {
        logger.info('🔧 Creating #global-bg element in launch-screen (not found in DOM)');
        globalBg = document.createElement('div');
        globalBg.id = 'global-bg';
        globalBg.style.position = 'fixed';
        globalBg.style.top = 'calc(-1 * env(safe-area-inset-top, 0px))';
        globalBg.style.bottom = 'calc(-1 * env(safe-area-inset-bottom, 0px))';
        globalBg.style.left = '-12vw';
        globalBg.style.right = '-12vw';
        globalBg.style.pointerEvents = 'none';
        globalBg.style.zIndex = '-1'; // 🔥 CRITICAL: Behind content, not in front
        // Insert at the beginning of body
        if (document.body.firstChild) {
          document.body.insertBefore(globalBg, document.body.firstChild);
        } else {
          document.body.appendChild(globalBg);
        }
        logger.info('✅ #global-bg element created and inserted into DOM in launch-screen');
      }
      
      if (globalBg && gsap) {
        gsap.killTweensOf(globalBg);
        (globalBg as HTMLElement).style.transition = 'none';
        gsap.set(globalBg, { background: colorOrGradient });
        (globalBg as HTMLElement).style.zIndex = '-1'; // 🔥 CRITICAL: Behind content
        (globalBg as HTMLElement).style.pointerEvents = 'none';
        logger.info('✅ #global-bg gradient set via GSAP in launch-screen');
      } else if (globalBg) {
        (globalBg as HTMLElement).style.background = colorOrGradient;
        (globalBg as HTMLElement).style.zIndex = '-1'; // 🔥 CRITICAL: Behind content
        (globalBg as HTMLElement).style.pointerEvents = 'none';
        logger.info('✅ #global-bg gradient set directly (GSAP not available)');
      }
      
      // 🔥 DEBUG: Check actual background values after setting
      setTimeout(() => {
        const bodyBg = document.body ? window.getComputedStyle(document.body).background : 'N/A';
        const htmlBg = document.documentElement ? window.getComputedStyle(document.documentElement).background : 'N/A';
        const globalBgComputed = globalBg ? window.getComputedStyle(globalBg as HTMLElement).background : 'N/A';
        logger.info('🔍 [launch-screen] Computed backgrounds after setting:', {
          body: bodyBg.substring(0, 80),
          html: htmlBg.substring(0, 80),
          globalBg: globalBgComputed.substring(0, 80)
        });
      }, 100);
    } catch(e) {
      logger.warn('⚠️ Failed to set background:', e);
    }
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

      if (total === 0) {
        resolve();
        return;
      }

      const checkComplete = () => {
        if (resolved) return;
        loadedCount++;
        if (loadedCount === total) {
          resolved = true;
          logger.info(`✅ All ${total} launch images loaded`);
          resolve();
        }
      };

      // Set timeout if provided
      let timeoutId: NodeJS.Timeout | null = null;
      if (timeoutMs && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            logger.warn(`⚠️ Image loading timeout after ${timeoutMs}ms - continuing anyway`);
            resolve();
          }
        }, timeoutMs);
      }

      images.forEach((img) => {
        if (img.complete) {
          checkComplete();
        } else {
          img.onload = () => {
            checkComplete();
            if (timeoutId) clearTimeout(timeoutId);
          };
          img.onerror = () => {
            logger.warn(`⚠️ Failed to load image: ${img.src}`);
            checkComplete(); // Continue even if image fails
            if (timeoutId) clearTimeout(timeoutId);
          };
        }
      });
    });
  }
}

// Export singleton instance
export const launchScreen = new LaunchScreen();

