// Settings Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';
import { gsap } from 'gsap';
import animationManager from '../../modules/animation-manager.js';
import { domElementPool } from '../../modules/dom-element-pool.js';


const trackTimeline = (options: any = {}) => animationManager.trackExternalTimeline(gsap.timeline(options));

const trackDelayedCall = (delay: number, callback: (...args: any[]) => void, params?: any) =>
  animationManager.trackExternalTween(gsap.delayedCall(delay, callback, params));

const trackTween = (target: any, vars: any) => animationManager.trackExternalTween(gsap.to(target, vars));

export interface SettingsScreenConfig {
  onBack?: () => void;
  onToggleGameSounds?: (enabled: boolean) => void;
  onToggleVibration?: (enabled: boolean) => void;
  onToggleMusic?: (enabled: boolean) => void;
}

export interface SettingToggle {
  id: string;
  status: 'ON' | 'OFF';
  label: string;
  description: string;
  onToggle?: (enabled: boolean) => void;
}

function createSettingsToggle(toggle: SettingToggle): HTMLElementConfig {
  const toggleId = `toggle-${toggle.id}`;
  const statusId = `status-${toggle.id}`;
  const isOn = toggle.status === 'ON';
  
  return {
    tag: 'div',
    className: 'settings-toggle-container',
    children: [
      {
        tag: 'div',
        className: 'settings-toggle-header',
        children: [
          {
            tag: 'div',
            className: 'settings-toggle-left',
            children: [
              {
                tag: 'div',
                id: statusId,
                className: 'settings-toggle-status',
                text: toggle.status,
                attributes: {
                  'aria-label': `${toggle.label} status: ${toggle.status}`,
                },
              },
              {
                tag: 'p',
                className: 'settings-toggle-description',
                text: toggle.description,
              },
            ],
          },
          {
            tag: 'label',
            className: 'settings-toggle-switch',
            attributes: {
              'for': toggleId,
              'aria-label': `Toggle ${toggle.label}`,
            },
            children: [
              {
                tag: 'input',
                className: 'settings-toggle-input',
                attributes: {
                  type: 'checkbox',
                  id: toggleId,
                  checked: isOn ? 'checked' : undefined,
                  'aria-label': toggle.label,
                },
                eventListeners: toggle.onToggle ? {
                  change: (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    toggle.onToggle!(target.checked);
                  },
                } : undefined,
              },
              {
                tag: 'span',
                className: 'settings-toggle-slider',
              },
            ],
          },
        ],
      },
    ],
  };
}

export function createSettingsScreen(config: SettingsScreenConfig): HTMLElementConfig {
  const { onBack, onToggleGameSounds, onToggleVibration, onToggleMusic } = config;

  // Load saved settings from localStorage
  const savedSettings = (window as any)._settings || {};
  const gameSoundsEnabled = savedSettings.gameSoundsEnabled || false;
  const hapticsEnabled = savedSettings.hapticsEnabled !== undefined ? savedSettings.hapticsEnabled : true;
  const musicEnabled = savedSettings.musicEnabled !== false;

  const gameSoundsToggle: SettingToggle = {
    id: 'game-sounds',
    status: gameSoundsEnabled ? 'ON' : 'OFF',
    label: 'Game sounds',
    description: 'Game sounds',
    onToggle: onToggleGameSounds,
  };

  const musicToggle: SettingToggle = {
    id: 'music',
    status: musicEnabled ? 'ON' : 'OFF',
    label: 'Music',
    description: 'Music',
    onToggle: onToggleMusic,
  };

  const vibrationToggle: SettingToggle = {
    id: 'vibration',
    status: hapticsEnabled ? 'ON' : 'OFF',
    label: 'Vibration',
    description: 'Vibration',
    onToggle: onToggleVibration,
  };

  return {
    tag: 'div',
    id: 'settings-screen',
    attributes: { hidden: 'true' },
    children: [
      {
        tag: 'div',
        className: 'settings-content',
        children: [
          {
            tag: 'div',
            className: 'settings-header',
            children: [
              {
                tag: 'div',
                className: 'settings-header-top',
                children: [
                  {
                    tag: 'button',
                    id: 'settings-back-btn',
                    className: 'settings-back-button tap-scale',
                    attributes: {
                      type: 'button',
                      'aria-label': 'Go back to home',
                    },
                    children: [
                      {
                        tag: 'img',
                        attributes: {
                          src: './assets/chevron-back.png',
                          alt: '',
                          'aria-hidden': 'true',
                        },
                      },
                    ],
                    eventListeners: onBack ? { click: onBack } : undefined,
                  },
                  {
                    tag: 'h1',
                    className: 'settings-title',
                    text: 'Settings',
                  },
                  {
                    tag: 'div',
                    className: 'settings-header-spacer',
                  },
                ],
              },
              {
                tag: 'div',
                className: 'settings-title-underline',
                children: [
                  {
                    tag: 'img',
                    className: 'settings-shadow-image',
                    attributes: {
                      src: './assets/divider-shadow.png',
                      alt: '',
                      'aria-hidden': 'true',
                    },
                  },
                ],
              },
            ],
          },
          {
            tag: 'div',
            className: 'settings-scrollable',
            children: [
              createSettingsToggle(gameSoundsToggle),
              { tag: 'div', className: 'settings-divider' },
              createSettingsToggle(musicToggle),
              { tag: 'div', className: 'settings-divider' },
              createSettingsToggle(vibrationToggle),
            ],
          },
          {
            tag: 'div',
            className: 'settings-footer',
            children: [
              {
                tag: 'p',
                className: 'settings-footer-text',
                html: 'Made with ❤️ in Croatia<br/>by Tap Tap Design',
              },
            ],
          },
        ],
      },
    ],
  };
}

export function renderSettingsScreen(
  container: HTMLElement,
  config: SettingsScreenConfig
): void {
  const settingsConfig = createSettingsScreen(config);
  const element = HTMLBuilder.createElement(settingsConfig);
  container.appendChild(element);
  
  // 🔥 DIFFERENT APPROACH: Use event delegation on settings screen container
  // This ensures back button works even if element is recreated or not found during init
  const clickHandler = (e: Event) => {
    const target = e.target as HTMLElement;
    const backBtn = target.closest('#settings-back-btn, .settings-back-button');
    if (backBtn) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('🔙 Settings back button clicked via event delegation');
      
      // Call config.onBack if provided
      if (config.onBack) {
        config.onBack();
        return;
      }
      
      // Otherwise, find UIManager instance and call method directly
      // Try multiple ways to access UIManager
      let uiManager = (window as any).uiManager;
      if (!uiManager) {
        // Try importing UIManager module
        import('../../modules/ui-manager.js').then((module) => {
          uiManager = module.default || (module as any).uiManager;
          if (uiManager && typeof uiManager.hideSettingsScreenWithAnimation === 'function') {
            console.log('✅ Calling uiManager.hideSettingsScreenWithAnimation() via import');
            uiManager.hideSettingsScreenWithAnimation();
          }
        }).catch(() => {
          console.warn('⚠️ Failed to import UIManager');
        });
      } else if (typeof uiManager.hideSettingsScreenWithAnimation === 'function') {
        console.log('✅ Calling uiManager.hideSettingsScreenWithAnimation() from window');
        uiManager.hideSettingsScreenWithAnimation();
      } else {
        console.warn('⚠️ UIManager found but hideSettingsScreenWithAnimation method not available');
      }
    }
  };
  element.addEventListener('click', clickHandler);

  // 🎵 Music toggle: event delegation - direktno stop/start soundtrack
  const changeHandler = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (!target || target.id !== 'toggle-music') return;
    const enabled = target.checked;
    const statusEl = document.getElementById('status-music');
    if (statusEl) statusEl.textContent = enabled ? 'ON' : 'OFF';
    if ((window as any)._settings) (window as any)._settings.musicEnabled = enabled;
    if (typeof (window as any).saveSettings === 'function') {
      (window as any).saveSettings((window as any)._settings);
    }
    import('../../modules/soundtrack-manager.js').then((mod) => {
      if (enabled) mod.fadeInAndResume();
      else mod.stopSoundtrack();
    }).catch(() => {});
  };
  element.addEventListener('change', changeHandler);

  console.log('✅ Settings back button and Music toggle handlers attached via event delegation');

  // Setup footer explosion animation after render
  const footerText = element.querySelector('.settings-footer-text') as HTMLElement;
  let footerClickHandler: (() => void) | null = null;
  if (footerText) {
    footerClickHandler = () => {
      triggerFooterExplosion(footerText);
      // Easter egg: unlock legendary card 26 (legendary06)
      unlockLegendaryCard26();
    };
    footerText.addEventListener('click', footerClickHandler);
  }
  
  // 🔥 FIX: Store cleanup function on element for proper memory management
  (element as any)._settingsCleanup = () => {
    element.removeEventListener('click', clickHandler);
    element.removeEventListener('change', changeHandler);
    if (footerText && footerClickHandler) {
      footerText.removeEventListener('click', footerClickHandler);
    }
    console.log('✅ Settings screen event listeners cleaned up');
  };
}

/**
 * Easter egg: Unlock legendary card 26 (legendary06) when tapping "Made with ❤️" text
 */
function unlockLegendaryCard26(): void {
  try {
    // Check if card 26 is already unlocked
    const collectiblesState = localStorage.getItem('collectibles_state');
    if (collectiblesState) {
      const state = JSON.parse(collectiblesState);
      const legendary06 = state.legendary?.find((c: any) => c.id === 'legendary06');
      if (legendary06 && legendary06.unlocked) {
        console.log('✅ Card 26 already unlocked');
        return;
      }
    }
    
    // Unlock card 26
    console.log('🎉 Easter egg triggered! Unlocking legendary card 26...');
    if (typeof window !== 'undefined' && typeof (window as any).unlockCollectibleByNumber === 'function') {
      (window as any).unlockCollectibleByNumber(26).then(() => {
        console.log('✅ Legendary card 26 unlocked via easter egg!');
      }).catch((err: any) => {
        console.error('❌ Failed to unlock card 26:', err);
      });
    } else {
      console.warn('⚠️ unlockCollectibleByNumber not available');
    }
  } catch (err) {
    console.error('❌ Error checking/unlocking card 26:', err);
  }
}

function triggerFooterExplosion(element: HTMLElement): void {
  console.log('💥 Footer explosion triggered!');
  
  // Get element position
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // 🔥 USER REQUEST: Removed smoke animation, keeping only shards
  
  // 🔥 CRITICAL: Create HTML/CSS wild-magnet shards animation (rendered above settings screen)
  // Wild-magnet shards use red (#F26034) and brown (#D4A584) colors (50/50 mix)
  // Spread: 1.512 (40% wider than original 1.08)
  const shardsContainer = document.createElement('div');
  shardsContainer.className = 'footer-explosion-shards';
  shardsContainer.style.position = 'fixed';
  shardsContainer.style.left = `${centerX}px`;
  shardsContainer.style.top = `${centerY}px`;
  shardsContainer.style.width = '0';
  shardsContainer.style.height = '0';
  shardsContainer.style.pointerEvents = 'none';
  shardsContainer.style.zIndex = '20000'; // Above settings screen (z-index: 10000)
  document.body.appendChild(shardsContainer);
  
  // Wild-magnet colors: red (#F26034) and brown (#D4A584) - 50/50 mix
  const redColor = '#F26034';
  const brownColor = '#D4A584';
  const shardCount = 20;
  
  // Spread: 1.512 (40% wider than original 1.08)
  // Base distance calculation (similar to game's spread calculation)
  const baseDistance = 80;
  const spreadMultiplier = 1.512;
  const maxDistance = baseDistance * spreadMultiplier;
  
  // 🔥 MEMORY LEAK FIX: Track shards for cleanup
  const shards: HTMLElement[] = [];
  
  for (let i = 0; i < shardCount; i++) {
    // 🔥 OBJECT POOLING: Use pool instead of creating new div
    const shard = domElementPool.acquire();
    shard.className = 'footer-shard';
    
    // Random size (similar to game's base size calculation, 50% + 30% + 50% smaller = 82.5% smaller total)
    const baseSize = 8 + Math.random() * 12;
    const size = baseSize * 1.8 * 0.5 * 0.7 * 0.5; // 50% + 30% + 50% smaller = 0.175 of original (17.5%)
    
    // Random angle and distance (with 40% wider spread)
    const angle = (Math.PI * 2 * i) / shardCount + (Math.random() - 0.5) * 0.5;
    const distance = 30 + Math.random() * maxDistance;
    
    // 50/50 mix of red and brown (wild-magnet style)
    const color = Math.random() < 0.5 ? redColor : brownColor;
    
    shard.style.width = `${size}px`;
    shard.style.height = `${size * (0.8 + Math.random() * 1.4)}px`; // Irregular height
    shard.style.backgroundColor = color;
    shard.style.borderRadius = '2px';
    shard.style.position = 'absolute';
    shard.style.left = '0';
    shard.style.top = '0';
    shard.style.transformOrigin = 'center';
    shard.style.opacity = '0';
    shard.style.rotate = `${Math.random() * 360}deg`; // Random rotation
    
    shardsContainer.appendChild(shard);
    shards.push(shard);
    
    // Animate shard (similar to game's animation)
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    const rotation = Math.random() * 360;
    
    trackTween(shard, {
      x: targetX,
      y: targetY,
      rotation: rotation,
      opacity: 1,
      duration: 0.3 + Math.random() * 0.2,
      ease: 'power2.out',
    });
    
    trackTween(shard, {
      opacity: 0,
      scale: 0,
      duration: 0.4 + Math.random() * 0.2,
      delay: 0.3,
      ease: 'power2.in',
    });
  }
  
  console.log('🔥 Wild-magnet shards animation triggered at footer position');
  
  // 🔥 USER REQUEST: Removed smoke bubbles and halo effect, keeping only shards
  
  // Screen shake - shake the settings screen (50% reduced)
  const settingsScreen = document.getElementById('settings-screen');
  if (settingsScreen) {
    const shakeStrength = 15; // 50% reduced: 30 * 0.5 = 15
    const shakeDuration = 0.5;
    const shakeSteps = 20;
    
    const shakeTimeline = trackTimeline();
    for (let i = 0; i < shakeSteps; i++) {
      const progress = i / shakeSteps;
      const intensity = shakeStrength * (1 - progress);
      const shakeX = (Math.random() - 0.5) * intensity * 2;
      const shakeY = (Math.random() - 0.5) * intensity * 2;
      
      shakeTimeline.to(settingsScreen, {
        x: shakeX,
        y: shakeY,
        duration: shakeDuration / shakeSteps,
        ease: 'none',
      });
    }
    
    shakeTimeline.to(settingsScreen, {
      x: 0,
      y: 0,
      duration: 0.1,
      ease: 'power2.out',
    });
  }
  
  // 🔥 MEMORY LEAK FIX: Comprehensive cleanup - release all particles to pool after animation
  trackDelayedCall(1.2, () => {
    try {
      // Kill GSAP animations on all shards and release them to pool
      shards.forEach(shard => {
        try {
          gsap.killTweensOf(shard);
          domElementPool.release(shard);
        } catch (e) {
          console.warn('⚠️ Error releasing shard to pool:', e);
        }
      });
      shards.length = 0; // Clear array
      
      // 🔥 USER REQUEST: Removed smoke cleanup (smoke animation disabled)
      
      // Remove containers
      shardsContainer.remove();
      
      console.log('🧹 Footer explosion shards cleaned up and released to pool');
    } catch (e) {
      console.warn('⚠️ Cleanup error:', e);
    }
  });
  
  // Haptic feedback
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('heavy');
  }
}
