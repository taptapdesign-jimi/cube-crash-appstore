// Settings Screen Component
import { gsap } from 'gsap';
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';
import { isFirstPlayTutorialForced, setFirstPlayTutorialDevEnabled } from '../../modules/first-play-tutorial.js';

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

const SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS = 0;

function playSoftCartoonBounce(target: HTMLElement | null): void {
  if (!target) return;

  const switchEl = (target.closest('.settings-toggle-switch') || target) as HTMLElement;
  gsap.killTweensOf(switchEl);
  gsap.set(switchEl, {
    scale: 1,
    transformOrigin: '50% 50%',
    willChange: 'transform',
    force3D: true,
  });

  gsap.timeline({
    defaults: { overwrite: 'auto' },
    onComplete: () => {
      gsap.set(switchEl, { clearProps: 'scale,willChange,force3D' });
    },
  })
    .to(switchEl, {
      scale: 1.18,
      duration: 0.12,
      ease: 'back.out(2.2)',
      force3D: true,
    })
    .to(switchEl, {
      scale: 0.93,
      duration: 0.09,
      ease: 'power2.out',
      force3D: true,
    })
    .to(switchEl, {
      scale: 1,
      duration: 0.17,
      ease: 'back.out(1.9)',
      force3D: true,
    });
}

function getSettingsToggleTarget(event: Event): HTMLElement | null {
  const targetNode = event.target as Node | null;
  const target = (targetNode && targetNode.nodeType === Node.ELEMENT_NODE
    ? (targetNode as Element)
    : targetNode?.parentElement) as Element | null;
  const switchEl = target?.closest('.settings-toggle-switch') as HTMLElement | null;
  if (switchEl) return switchEl;
  // Tap on status / description (label.settings-toggle-left) — bounce the visible switch
  const left = target?.closest('.settings-toggle-left') as HTMLElement | null;
  if (left) {
    const header = left.closest('.settings-toggle-header');
    return (header?.querySelector('.settings-toggle-switch') as HTMLElement | null) || null;
  }
  return null;
}

function openJourneyDevPicker(action: 'show' | 'hide' | 'reset'): void {
  import('../../modules/journey-boards-manager.js')
    .then(({ journeyBoardsManager }) => {
      journeyBoardsManager.showBoardPickerModal(action);
    })
    .catch((error) => {
      console.error(`❌ Failed to open Journey dev ${action} picker:`, error);
      alert('Journey dev tools are not available right now.');
    });
}

function createDevButton(id: string, text: string, action: 'show' | 'hide' | 'reset'): HTMLElementConfig {
  return {
    tag: 'button',
    id,
    className: `settings-dev-button settings-dev-button-${action} tap-scale`,
    text,
    attributes: {
      type: 'button',
      'aria-label': text,
    },
    eventListeners: {
      click: (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        openJourneyDevPicker(action);
      },
    },
  };
}

function createFirstPlayDevButton(): HTMLElementConfig {
  const isEnabled = isFirstPlayTutorialForced();
  const applyState = (button: HTMLElement, enabled: boolean) => {
    button.textContent = enabled ? 'First Time Run ON' : 'First Time Run OFF';
    button.classList.toggle('is-active', enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  };

  return {
    tag: 'button',
    id: 'settings-dev-first-play-run-btn',
    className: `settings-dev-button settings-dev-button-first-play tap-scale${isEnabled ? ' is-active' : ''}`,
    text: isEnabled ? 'First Time Run ON' : 'First Time Run OFF',
    attributes: {
      type: 'button',
      'aria-label': 'Toggle First Time Run',
      'aria-pressed': isEnabled ? 'true' : 'false',
    },
    eventListeners: {
      click: (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const button = e.currentTarget as HTMLElement;
        setFirstPlayTutorialDevEnabled(true);
        applyState(button, true);
      },
    },
  };
}

function createSettingsDevArea(): HTMLElementConfig {
  return {
    tag: 'section',
    className: 'settings-dev-area',
    children: [
      {
        tag: 'div',
        className: 'settings-dev-header',
        children: [
          {
            tag: 'div',
            className: 'settings-dev-kicker',
            text: 'DEV',
          },
          {
            tag: 'p',
            className: 'settings-dev-description',
            text: 'Journey card tools',
          },
        ],
      },
      {
        tag: 'div',
        className: 'settings-dev-actions',
        children: [
          createDevButton('settings-dev-show-card-btn', 'Show Card', 'show'),
          createDevButton('settings-dev-hide-card-btn', 'Hide Card', 'hide'),
          createDevButton('settings-dev-reset-board-btn', 'Reset Board', 'reset'),
          createFirstPlayDevButton(),
        ],
      },
    ],
  };
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
            tag: 'label',
            className: 'settings-toggle-left',
            attributes: {
              for: toggleId,
              'aria-label': `Toggle ${toggle.label}`,
            },
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
              { tag: 'div', className: 'settings-divider settings-dev-divider' },
              createSettingsDevArea(),
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
      (e as any).stopImmediatePropagation?.();
      
      console.log('🔙 Settings back button clicked via event delegation');
      playSoftCartoonBounce((backBtn.querySelector('img') as HTMLElement | null) || (backBtn as HTMLElement));

      if ((backBtn as HTMLElement).getAttribute('data-settings-back-exit-pending') === 'true') {
        return;
      }

      (backBtn as HTMLElement).setAttribute('data-settings-back-exit-pending', 'true');
      
      // Call config.onBack if provided
      if (config.onBack) {
        const runBack = () => {
          try {
            config.onBack?.();
          } finally {
            window.setTimeout(() => {
              (backBtn as HTMLElement).removeAttribute('data-settings-back-exit-pending');
            }, 650);
          }
        };
        if (SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS > 0) {
          window.setTimeout(runBack, SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS);
        } else {
          runBack();
        }
        return;
      }
      
      // Otherwise, find UIManager instance and call method directly
      // Try multiple ways to access UIManager
      let uiManager = (window as any).uiManager;
      if (!uiManager) {
        // Try importing UIManager module
        const runImportBack = () => {
          import('../../modules/ui-manager.js').then((module) => {
            uiManager = module.default || (module as any).uiManager;
            if (uiManager && typeof uiManager.hideSettingsScreenWithAnimation === 'function') {
              console.log('✅ Calling uiManager.hideSettingsScreenWithAnimation() via import');
              uiManager.hideSettingsScreenWithAnimation();
            }
          }).catch(() => {
            console.warn('⚠️ Failed to import UIManager');
          }).finally(() => {
            window.setTimeout(() => {
              (backBtn as HTMLElement).removeAttribute('data-settings-back-exit-pending');
            }, 650);
          });
        };
        if (SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS > 0) {
          window.setTimeout(runImportBack, SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS);
        } else {
          runImportBack();
        }
      } else if (typeof uiManager.hideSettingsScreenWithAnimation === 'function') {
        const runWindowBack = () => {
          try {
            console.log('✅ Calling uiManager.hideSettingsScreenWithAnimation() from window');
            uiManager.hideSettingsScreenWithAnimation();
          } finally {
            window.setTimeout(() => {
              (backBtn as HTMLElement).removeAttribute('data-settings-back-exit-pending');
            }, 650);
          }
        };
        if (SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS > 0) {
          window.setTimeout(runWindowBack, SETTINGS_BACK_TAP_BOUNCE_EXIT_DELAY_MS);
        } else {
          runWindowBack();
        }
      } else {
        console.warn('⚠️ UIManager found but hideSettingsScreenWithAnimation method not available');
        (backBtn as HTMLElement).removeAttribute('data-settings-back-exit-pending');
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

  let lastToggleBounceAt = 0;
  let lastToggleBounceTarget: HTMLElement | null = null;
  const toggleBounceHandler = (e: Event) => {
    const toggleTarget = getSettingsToggleTarget(e);
    if (!toggleTarget) return;
    const now = Date.now();
    if (toggleTarget === lastToggleBounceTarget && now - lastToggleBounceAt < 140) return;
    lastToggleBounceTarget = toggleTarget;
    lastToggleBounceAt = now;
    playSoftCartoonBounce(toggleTarget);
  };
  element.addEventListener('pointerdown', toggleBounceHandler, true);
  element.addEventListener('touchstart', toggleBounceHandler, { capture: true, passive: true });
  element.addEventListener('click', toggleBounceHandler, true);

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
    element.removeEventListener('pointerdown', toggleBounceHandler, true);
    element.removeEventListener('touchstart', toggleBounceHandler, true);
    element.removeEventListener('click', toggleBounceHandler, true);
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
    if (typeof (window as any).triggerHapticImpact === 'function') {
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
