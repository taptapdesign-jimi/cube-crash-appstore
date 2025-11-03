// Settings Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

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
}

