// Settings Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

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
                id: 'settings-footer-haptic',
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
    const targetNode = e.target as Node | null;
    const target = (targetNode && targetNode.nodeType === Node.ELEMENT_NODE
      ? (targetNode as Element)
      : targetNode?.parentElement) as Element | null;
    if (!target) return;
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

  // Safety: cleanup on in-app navigation
  const navCleanupHandler = () => {
    try { (element as any)._settingsCleanup?.(); } catch {}
  };
  window.addEventListener('cc-navigation', navCleanupHandler);

  console.log('✅ Settings back button and Music toggle handlers attached via event delegation');

  // Footer text: haptic-only behavior, hard iOS-safe listeners
  const footerText = element.querySelector('.settings-footer-text') as HTMLElement | null;
  let lastFooterHapticAt = 0;
  const footerHapticHandler = () => {
    const now = Date.now();
    if (now - lastFooterHapticAt < 120) return; // prevent duplicate trigger from multi events
    lastFooterHapticAt = now;
    console.log('📳 Settings footer haptic event fired');
    triggerSettingsForceHapticImpact('medium');
  };
  if (footerText) {
    footerText.addEventListener('touchstart', footerHapticHandler, { passive: true });
    footerText.addEventListener('pointerdown', footerHapticHandler);
    footerText.addEventListener('mousedown', footerHapticHandler);
    footerText.addEventListener('click', footerHapticHandler);
  }

  // Extra-safe capture path: if any layer intercepts bubbling, capture still fires.
  const footerCaptureHandler = (e: Event) => {
    const targetNode = e.target as Node | null;
    const target = (targetNode && targetNode.nodeType === Node.ELEMENT_NODE
      ? (targetNode as Element)
      : targetNode?.parentElement) as Element | null;
    if (!target) return;
    if (target.closest('#settings-footer-haptic, .settings-footer-text')) {
      footerHapticHandler();
    }
  };
  element.addEventListener('touchstart', footerCaptureHandler, true);
  element.addEventListener('pointerdown', footerCaptureHandler, true);
  element.addEventListener('click', footerCaptureHandler, true);

  // 🔥 FIX: Store cleanup function on element for proper memory management
  (element as any)._settingsCleanup = () => {
    element.removeEventListener('click', clickHandler);
    element.removeEventListener('change', changeHandler);
    window.removeEventListener('cc-navigation', navCleanupHandler);
    if (footerText) {
      footerText.removeEventListener('touchstart', footerHapticHandler);
      footerText.removeEventListener('pointerdown', footerHapticHandler);
      footerText.removeEventListener('mousedown', footerHapticHandler);
      footerText.removeEventListener('click', footerHapticHandler);
    }
    element.removeEventListener('touchstart', footerCaptureHandler, true);
    element.removeEventListener('pointerdown', footerCaptureHandler, true);
    element.removeEventListener('click', footerCaptureHandler, true);
    console.log('✅ Settings screen event listeners cleaned up');
  };
}

function triggerSettingsForceHapticImpact(style: 'light' | 'medium' | 'heavy'): void {
  let triggered = false;
  try {
    // Bypass _settings.hapticsEnabled guard intentionally for Settings interactions
    // so user always gets tactile feedback while configuring haptics.
    if (
      (window as any).webkit &&
      (window as any).webkit.messageHandlers &&
      (window as any).webkit.messageHandlers.hapticImpact
    ) {
      try {
        (window as any).webkit.messageHandlers.hapticImpact.postMessage({ style });
        triggered = true;
      } catch {}
    }
    if (!triggered && typeof (window as any).triggerHapticImpact === 'function') {
      (window as any).triggerHapticImpact(style);
      triggered = true;
    }
    if (!triggered && navigator.vibrate) {
      const duration = style === 'heavy' ? 70 : style === 'light' ? 30 : 50;
      navigator.vibrate(duration);
      triggered = true;
    }
  } catch {}
}
