// Settings Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';
import { gsap } from 'gsap';

export interface SettingsScreenConfig {
  onBack?: () => void;
  onToggleGameSounds?: (enabled: boolean) => void;
  onToggleVibration?: (enabled: boolean) => void;
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
  const { onBack, onToggleGameSounds, onToggleVibration } = config;

  // Load saved settings from localStorage
  const savedSettings = (window as any)._settings || {};
  const gameSoundsEnabled = savedSettings.gameSoundsEnabled || false;
  const hapticsEnabled = savedSettings.hapticsEnabled !== undefined ? savedSettings.hapticsEnabled : true;

  const gameSoundsToggle: SettingToggle = {
    id: 'game-sounds',
    status: gameSoundsEnabled ? 'ON' : 'OFF',
    label: 'Game sounds',
    description: 'Game sounds',
    onToggle: onToggleGameSounds,
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
              {
                tag: 'div',
                className: 'settings-divider',
              },
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
  
  // Setup footer explosion animation after render
  const footerText = element.querySelector('.settings-footer-text') as HTMLElement;
  if (footerText) {
    footerText.addEventListener('click', () => {
      triggerFooterExplosion(footerText);
      // Easter egg: unlock legendary card 26 (legendary06)
      unlockLegendaryCard26();
    });
  }
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
  
  // Create smoke container (keep existing smoke animation)
  const smokeContainer = document.createElement('div');
  smokeContainer.className = 'footer-explosion-smoke';
  smokeContainer.style.position = 'fixed';
  smokeContainer.style.left = `${centerX}px`;
  smokeContainer.style.top = `${centerY}px`;
  smokeContainer.style.width = '0';
  smokeContainer.style.height = '0';
  smokeContainer.style.pointerEvents = 'none';
  smokeContainer.style.zIndex = '10000';
  document.body.appendChild(smokeContainer);
  
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
  
  for (let i = 0; i < shardCount; i++) {
    const shard = document.createElement('div');
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
    
    // Animate shard (similar to game's animation)
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    const rotation = Math.random() * 360;
    
    gsap.to(shard, {
      x: targetX,
      y: targetY,
      rotation: rotation,
      opacity: 1,
      duration: 0.3 + Math.random() * 0.2,
      ease: 'power2.out',
    });
    
    gsap.to(shard, {
      opacity: 0,
      scale: 0,
      duration: 0.4 + Math.random() * 0.2,
      delay: 0.3,
      ease: 'power2.in',
    });
  }
  
  // Cleanup shards container after animation
  gsap.delayedCall(1.2, () => {
    try {
      shardsContainer.remove();
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
  });
  
  console.log('🔥 Wild-magnet shards animation triggered at footer position');
  
  // Create smoke bubbles (white, like in game - smokeBubblesAtTile style)
  // Based on smokeBubblesAtTile: white circles/ellipses, no blur, blend mode 'add'
  const smokeCount = 20;
  for (let i = 0; i < smokeCount; i++) {
    const smoke = document.createElement('div');
    smoke.className = 'footer-smoke';
    
    // Random size: 12-36px (similar to game's BASE_R to MAX_R range)
    const baseSize = 12 + Math.random() * 24;
    const size = baseSize;
    
    // Random shape: circle or ellipse (like in game)
    const isEllipse = Math.random() > 0.5;
    const aspectRatio = isEllipse ? (0.6 + Math.random() * 0.8) : 1; // 0.6-1.4 for ellipse
    const width = size;
    const height = size * aspectRatio;
    
    // Random angle and distance
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 70;
    
    // White color with random alpha (0.7-1.0 range, like game's bubbleAlpha variation)
    const randomAlpha = 0.7 + Math.random() * 0.3;
    
    smoke.style.width = `${width}px`;
    smoke.style.height = `${height}px`;
    smoke.style.backgroundColor = `rgba(255, 255, 255, ${randomAlpha})`;
    smoke.style.borderRadius = '50%';
    smoke.style.position = 'absolute';
    smoke.style.left = '0';
    smoke.style.top = '0';
    smoke.style.mixBlendMode = 'screen'; // Similar to 'add' blend mode
    smoke.style.opacity = '0';
    
    // Random rotation for ellipses
    if (isEllipse) {
      smoke.style.transform = `rotate(${Math.random() * 360}deg)`;
    }
    
    smokeContainer.appendChild(smoke);
    
    // Animate smoke (fade in, move out, fade out - like game)
    const tIn = 0.02 + Math.random() * 0.02;
    const tRun = 0.16 + Math.random() * 0.12;
    const tHold = 0.02 + Math.random() * 0.03;
    const tOut = 0.08 + Math.random() * 0.06;
    
    const startScale = 0.65 + Math.random() * 0.25;
    gsap.set(smoke, { scale: startScale });
    
    gsap.to(smoke, {
      opacity: randomAlpha,
      duration: tIn,
      ease: 'power2.out',
    });
    
    gsap.to(smoke, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 20,
      scale: 1.0 + Math.random() * 0.3,
      duration: tRun,
      ease: 'sine.out',
    });
    
    gsap.to(smoke, {
      opacity: 0,
      scale: 1.2 + Math.random() * 0.4,
      duration: tOut,
      delay: tHold,
      ease: 'power1.in',
    });
  }
  
  // Add halo effect (white circle, like in game)
  const halo = document.createElement('div');
  halo.className = 'footer-smoke-halo';
  const haloSize = 60;
  halo.style.width = `${haloSize}px`;
  halo.style.height = `${haloSize}px`;
  halo.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  halo.style.borderRadius = '50%';
  halo.style.position = 'absolute';
  halo.style.left = '0';
  halo.style.top = '0';
  halo.style.transform = 'translate(-50%, -50%)';
  halo.style.opacity = '0';
  smokeContainer.appendChild(halo);
  
  gsap.to(halo, {
    opacity: 0.22,
    scale: 1.2,
    duration: 0.08,
    ease: 'power2.out',
  });
  
  gsap.to(halo, {
    opacity: 0,
    scale: 1.5,
    duration: 0.28,
    delay: 0.18,
    ease: 'power2.in',
  });
  
  // Screen shake - shake the settings screen (50% reduced)
  const settingsScreen = document.getElementById('settings-screen');
  if (settingsScreen) {
    const shakeStrength = 15; // 50% reduced: 30 * 0.5 = 15
    const shakeDuration = 0.5;
    const shakeSteps = 20;
    
    const shakeTimeline = gsap.timeline();
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
  
  // Cleanup
  gsap.delayedCall(1.2, () => {
    try {
      shardsContainer.remove();
      smokeContainer.remove();
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
  });
  
  // Haptic feedback
  if (typeof (window as any).triggerHapticImpact === 'function') {
    (window as any).triggerHapticImpact('heavy');
  }
}

