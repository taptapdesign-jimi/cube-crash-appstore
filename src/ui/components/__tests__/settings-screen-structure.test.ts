jest.mock('../../../modules/first-play-tutorial.js', () => ({
  isFirstPlayTutorialForced: () => false,
  setFirstPlayTutorialDevEnabled: jest.fn(),
}));

jest.mock('../../../modules/special-dice-registry.js', () => ({
  SPECIAL_DICE_VARIANTS: {},
  getCoreWildTypeForSpecialDiceVariant: jest.fn(),
}));

import { HTMLBuilder } from '../html-builder.js';
import {
  createSettingsScreen,
  renderSettingsScreen,
  SETTINGS_DEVELOPER_TOOLS_ENABLED,
} from '../settings-screen.js';

describe('Settings screen structure', () => {
  beforeEach(() => {
    (window as Window & { _settings?: { spatialMotionEnabled: boolean } })._settings = {
      spatialMotionEnabled: true,
    };
  });

  afterEach(() => {
    delete (window as Window & { _settings?: unknown })._settings;
    document.body.innerHTML = '';
  });

  it('keeps the player-facing 3D Motion toggle in the main settings panel', () => {
    const screen = HTMLBuilder.createElement(createSettingsScreen({}));
    const mainPanel = screen.querySelector('.settings-main-scrollable');

    expect(mainPanel?.querySelector('#toggle-spatial-motion')).not.toBeNull();
    expect(mainPanel?.querySelector('.settings-dev-area')).toBeNull();
  });

  it('isolates every developer action behind the removable developer entry point', () => {
    expect(SETTINGS_DEVELOPER_TOOLS_ENABLED).toBe(true);
    const screen = HTMLBuilder.createElement(createSettingsScreen({}));
    const developerPanel = screen.querySelector<HTMLElement>('.settings-developer-scrollable');

    expect(screen.querySelector('#settings-dev-open-btn')).not.toBeNull();
    expect(developerPanel?.hidden).toBe(true);
    expect(developerPanel?.querySelector('.settings-dev-area')).not.toBeNull();
    expect(developerPanel?.querySelector('#settings-dev-last-merge-btn')).not.toBeNull();
  });

  it('keeps the developer navigation handler alive after app navigation resets the view', () => {
    renderSettingsScreen(document.body, {});
    const screen = document.getElementById('settings-screen') as HTMLElement;
    const mainPanel = screen.querySelector<HTMLElement>('.settings-main-scrollable');
    const developerPanel = screen.querySelector<HTMLElement>('.settings-developer-scrollable');
    const openButton = screen.querySelector<HTMLButtonElement>('#settings-dev-open-btn');

    window.dispatchEvent(new Event('cc-navigation'));
    openButton?.click();

    expect(screen.dataset.settingsView).toBe('developer');
    expect(mainPanel?.hidden).toBe(true);
    expect(developerPanel?.hidden).toBe(false);
    expect(screen.querySelector('.settings-title')?.textContent).toBe('Developer');

    (screen as HTMLElement & { _settingsCleanup?: () => void })._settingsCleanup?.();
  });
});
