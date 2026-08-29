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
  afterEach(() => {
    delete (window as Window & { _settings?: unknown })._settings;
    document.body.innerHTML = '';
  });

  it('does not expose removed device-motion controls', () => {
    const screen = HTMLBuilder.createElement(createSettingsScreen({}));
    const mainPanel = screen.querySelector('.settings-main-scrollable');

    expect(mainPanel?.querySelector('#toggle-spatial-motion')).toBeNull();
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
    expect(developerPanel?.querySelector('#settings-dev-reset-spatial-intro-btn')).toBeNull();
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

  it('keeps the footer credit/version static and adds only the Privacy Policy action', () => {
    const screen = HTMLBuilder.createElement(createSettingsScreen({}));
    expect(screen.querySelector('#settings-footer-haptic')).toBeNull();
    expect(screen.querySelector('.settings-footer-text')?.tagName).toBe('DIV');
    expect(screen.querySelector('.settings-version')?.textContent).toBe('Version: 1.0');
    expect(screen.querySelector('.settings-footer-text')?.firstElementChild?.classList.contains('settings-footer-credit')).toBe(true);
    expect(screen.querySelector('.settings-footer-text')?.lastElementChild?.classList.contains('settings-version')).toBe(true);
    expect(screen.querySelector('.settings-footer-credit')?.textContent).toContain('Made with');
    expect(screen.querySelector<HTMLButtonElement>('#settings-privacy-policy-link')?.textContent).toBe('Privacy Policy');
    expect(screen.querySelector('#settings-privacy-policy-link')?.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('opens one Privacy modal on the shared End Game presentation contract and removes it on navigation', () => {
    renderSettingsScreen(document.body, {});
    const screen = document.getElementById('settings-screen') as HTMLElement;

    screen.querySelector<HTMLButtonElement>('#settings-privacy-policy-link')?.click();
    screen.querySelector<HTMLButtonElement>('#settings-privacy-policy-link')?.click();

    const modals = document.querySelectorAll('#settings-privacy-policy-modal');
    expect(modals).toHaveLength(1);
    expect(modals[0].getAttribute('role')).toBe('dialog');
    expect(modals[0].classList.contains('cc-gameplay-modal-stage')).toBe(true);
    expect(modals[0].querySelector('.cc-gameplay-modal-bounce-shell')).not.toBeNull();
    expect(modals[0].querySelector('.cc-gameplay-modal-flip-shell')).not.toBeNull();
    expect(modals[0].querySelector('.cc-gameplay-modal-idle-shell')).not.toBeNull();
    expect(modals[0].querySelector('.cc-gameplay-modal-touch-tilt-shell')).not.toBeNull();
    expect(modals[0].querySelector('.cc-gameplay-modal-pose-shell')).not.toBeNull();
    expect(modals[0].querySelector('.cc-gameplay-modal-paper-shell')).not.toBeNull();
    expect(modals[0].querySelector('.cc-gameplay-modal-title')?.textContent).toBe('Privacy Policy');
    const scrollRegion = modals[0].querySelector<HTMLElement>('.settings-privacy-policy-scroll');
    expect(scrollRegion).not.toBeNull();
    expect(scrollRegion?.getAttribute('role')).toBe('region');
    expect(scrollRegion?.getAttribute('tabindex')).toBe('0');
    expect(scrollRegion?.hasAttribute('data-modal-drag-ignore')).toBe(true);
    expect(scrollRegion?.contains(modals[0].querySelector('.cc-gameplay-modal-title'))).toBe(false);
    expect(modals[0].querySelector('.settings-privacy-policy-scroll-track')?.getAttribute('aria-hidden')).toBe('true');
    expect(modals[0].querySelector('.settings-privacy-policy-scroll-thumb')).not.toBeNull();
    expect(modals[0].querySelector('.gameplay-sheet-close')).not.toBeNull();
    expect(modals[0].textContent).toContain('does not collect, transmit, sell, or share personal data');
    expect(modals[0].textContent).toContain('stored only on your device');
    expect(modals[0].textContent).toContain('does not use accounts, advertising, analytics, or in-app purchases');
    expect(modals[0].querySelector('.settings-privacy-policy-online-link')?.textContent).toBe('Read Privacy Policy');
    expect(scrollRegion?.contains(modals[0].querySelector('.settings-privacy-policy-online-link'))).toBe(true);

    window.dispatchEvent(new Event('cc-navigation'));
    expect(document.getElementById('settings-privacy-policy-modal')).toBeNull();

    (screen as HTMLElement & { _settingsCleanup?: () => void })._settingsCleanup?.();
  });
});
