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
    if (this.elements.container) {
      logger.warn('⚠️ Launch screen already initialized');
      return;
    }

    // 🔥 SENIOR PRINCIPAL: Single source of truth for background
    // Set #FAFAFA immediately and synchronously - this is the ONLY place that sets initial background
    // CSS already has #FAFAFA as fallback, but we enforce it here to prevent any race conditions
    this.setBackground('#FAFAFA');

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
      background: #FAFAFA;
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
      opacity: 0;
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
    if (this.isActive) {
      logger.warn('⚠️ Launch screen already active');
      return;
    }

    if (!this.elements.container) {
      logger.error('❌ Launch screen not initialized');
      return;
    }

    this.isActive = true;
    logger.info('🚀 Starting launch sequence...');

    const { container, taptapContainer, taptapLogo, stackContainer, stackLogo, smokeShards } = this.elements;

    if (!taptapContainer || !taptapLogo || !stackContainer || !stackLogo || !smokeShards) {
      logger.error('❌ Launch screen elements missing');
      return;
    }

    // Wait for images to load
    await this.waitForImages([taptapLogo, stackLogo, smokeShards]);

    // PHASE 1: Fade in taptapdesign logo (300ms) → show for 2 seconds → fade out (300ms)
    logger.info('🎬 Phase 1: Fading in taptapdesign logo');
    await new Promise<void>((resolve) => {
      gsap.to(taptapContainer, {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
        onComplete: () => {
          logger.info('✅ Phase 1: Taptapdesign logo faded in');
          resolve();
        }
      });
    });

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fade out taptapdesign
    logger.info('🎬 Phase 1: Fading out taptapdesign logo');
    await new Promise<void>((resolve) => {
      gsap.to(taptapContainer, {
        opacity: 0,
        duration: 0.3,
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

    // PHASE 2: Fade in gradient background + stack to six logo + smokeclouds (300ms) → show for 2 seconds
    logger.info('🎬 Phase 2: Fading in gradient + stack to six logo + smokeclouds');
    
    // 🔥 SENIOR PRINCIPAL: Single source of truth - set gradient ONLY here, in Phase 2
    // This is the ONLY place gradient is set - no CSS, no other JavaScript
    const gradientBg = 'linear-gradient(180deg, #f3eee8 0%, rgba(252, 236, 223, 0.92) 60%, #fcecdf 100%)';
    this.setBackground(gradientBg);
    
    // Show stack container
    stackContainer.style.display = 'flex';
    smokeShards.style.opacity = '1.0';

    // Fade in stack logo and smoke shards
    await new Promise<void>((resolve) => {
      gsap.to([stackLogo, stackContainer], {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
        onComplete: () => {
          logger.info('✅ Phase 2: Stack to six logo and smokeclouds faded in');
          resolve();
        }
      });
    });

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // PHASE 3: Scale down all images to 0% and fade out
    logger.info('🎬 Phase 3: Scaling down all images to 0%');
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

      // Also fade out container
      gsap.to(container, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          logger.info('✅ Phase 3: Launch screen faded out');
        }
      });
    });

    // Hide launch screen
    this.hide();

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

    // Call completion callback
    if (onComplete) {
      onComplete();
    }

    this.isActive = false;
    logger.info('✅ Launch sequence completed');
  }

  /**
   * Hide launch screen
   */
  hide(): void {
    if (this.elements.container) {
      this.elements.container.style.display = 'none';
      this.elements.container.style.visibility = 'hidden';
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
      
      // Set on container
      if (this.elements.container) {
        this.elements.container.style.background = colorOrGradient;
        logger.info('✅ Launch screen container background set');
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
   * Wait for images to load
   */
  private waitForImages(images: HTMLImageElement[]): Promise<void> {
    return new Promise((resolve) => {
      let loadedCount = 0;
      const total = images.length;

      if (total === 0) {
        resolve();
        return;
      }

      const checkComplete = () => {
        loadedCount++;
        if (loadedCount === total) {
          logger.info(`✅ All ${total} launch images loaded`);
          resolve();
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkComplete();
        } else {
          img.onload = checkComplete;
          img.onerror = () => {
            logger.warn(`⚠️ Failed to load image: ${img.src}`);
            checkComplete(); // Continue even if image fails
          };
        }
      });
    });
  }
}

// Export singleton instance
export const launchScreen = new LaunchScreen();

