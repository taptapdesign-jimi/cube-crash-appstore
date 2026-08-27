// Settings Screen Component
import { gsap } from 'gsap';
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';
import { isFirstPlayTutorialForced, setFirstPlayTutorialDevEnabled } from '../../modules/first-play-tutorial.js';
import { SPECIAL_DICE_VARIANTS, getCoreWildTypeForSpecialDiceVariant } from '../../modules/special-dice-registry.js';
import { formatGameplayProgressLabel } from '../../modules/gameplay-terminology.ts';
import { scheduleSpatialMotionPermissionIntroForNextLaunch } from '../../modules/spatial-motion-permission-modal.js';
import { closePrivacyPolicyModal, showPrivacyPolicyModal } from './privacy-policy-modal.js';

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

// Single App Store release switch: set to false to remove the entry point and
// developer panel from the rendered Settings tree.
export const SETTINGS_DEVELOPER_TOOLS_ENABLED = true;

type LastMergeWildChoice = {
  id: string;
  label: string;
  kind: 'core' | 'variant';
  coreWildType?: 'wild' | 'wild-juice' | 'wild-magnet' | 'wild-tnt';
  variantId?: string;
};

const CORE_LAST_MERGE_WILD_CHOICES: LastMergeWildChoice[] = [
  { id: 'core-wild', label: 'Wild Star', kind: 'core', coreWildType: 'wild' },
  { id: 'core-juice', label: 'Juice', kind: 'core', coreWildType: 'wild-juice' },
  { id: 'core-magnet', label: 'Magnet', kind: 'core', coreWildType: 'wild-magnet' },
  { id: 'core-tnt', label: 'TNT', kind: 'core', coreWildType: 'wild-tnt' },
];

function getLastMergeWildChoices(): LastMergeWildChoice[] {
  const variantChoices = Object.values(SPECIAL_DICE_VARIANTS).map((variant) => ({
    id: `variant-${variant.id}`,
    label: variant.id
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    kind: 'variant' as const,
    variantId: variant.id,
    coreWildType: getCoreWildTypeForSpecialDiceVariant(variant) || undefined,
  }));
  return [...CORE_LAST_MERGE_WILD_CHOICES, ...variantChoices];
}

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

function getCurrentDevBoardNumber(): number {
  const rawBoardNumber = (window as any).STATE?.boardNumber || (window as any).__ccStartAtLevel || 1;
  const boardNumber = Number(rawBoardNumber);
  return Number.isFinite(boardNumber) && boardNumber >= 1 && boardNumber <= 16 ? boardNumber : 1;
}

function triggerSettingsDevHaptic(): void {
  try {
    if (typeof (window as any).triggerHapticSelection === 'function') {
      (window as any).triggerHapticSelection();
    }
  } catch {}
}

async function showNewCardDevScreen(): Promise<void> {
  triggerSettingsDevHaptic();
  const boardNumber = getCurrentDevBoardNumber();
  const paddedBoardNumber = String(boardNumber).padStart(2, '0');

  try {
    const [{ journeyBoardsManager }, { showJourneyNewCardScreen }] = await Promise.all([
      import('../../modules/journey-boards-manager.js'),
      import('../../modules/journey-new-card-screen.js'),
    ]);
    const board = journeyBoardsManager.getBoardById?.(boardNumber);
    await showJourneyNewCardScreen({
      boardNumber,
      cardImagePath: board?.imagePath || `./assets/colelctibles/common/${paddedBoardNumber}.png`,
      cardName: board?.name || formatGameplayProgressLabel('journey', boardNumber),
    });
  } catch (error) {
    console.error('❌ Failed to show Settings New Card dev screen:', error);
    alert('New Card dev screen is not available right now.');
  }
}

async function showNewDiceDevScreen(): Promise<void> {
  triggerSettingsDevHaptic();

  try {
    const { showJourneySpecialDiceScreen } = await import('../../modules/journey-special-dice-screen.js');
    await showJourneySpecialDiceScreen({ diceType: 'juice' });
  } catch (error) {
    console.error('❌ Failed to show Settings New Dice dev screen:', error);
    alert('New Dice dev screen is not available right now.');
  }
}

function hideSettingsForDevGameFlow(): void {
  const settingsScreen = document.getElementById('settings-screen') as HTMLElement | null;
  if (settingsScreen) {
    gsap.killTweensOf([settingsScreen, ...Array.from(settingsScreen.querySelectorAll('*'))]);
    settingsScreen.setAttribute('aria-hidden', 'true');
    settingsScreen.setAttribute('hidden', 'true');
    settingsScreen.style.display = 'none';
    settingsScreen.style.opacity = '0';
  }

  try {
    const uiManager = (window as any).uiManager;
    if (uiManager && typeof uiManager.showApp === 'function') {
      uiManager.showApp();
    }
  } catch {}
}

async function ensureLastMergeDevGameReady(): Promise<any> {
  let cc = window.CC;
  if (cc && typeof cc.devLastMergeTntScene === 'function') {
    return cc;
  }

  try {
    (window as any).__ccStartAtLevel = (window as any).STATE?.boardNumber || (window as any).__ccStartAtLevel || 1;
    (window as any).__ccTriggerHudDrop = true;
    (window as any).__ccCameFromJourney = true;
    (window as any).__ccCameFromHomepage = false;

    const [{ boot, layoutBoard }] = await Promise.all([
      import('../../modules/app-core.js'),
    ]);

    await boot();
    try {
      const uiManager = (window as any).uiManager;
      if (uiManager && typeof uiManager.showApp === 'function') {
        uiManager.showApp();
      }
    } catch {}
    await layoutBoard();

    delete (window as any).__ccStartAtLevel;
    delete (window as any).__ccTriggerHudDrop;

    cc = window.CC;
  } catch (error) {
    delete (window as any).__ccStartAtLevel;
    delete (window as any).__ccTriggerHudDrop;
    throw error;
  }

  if (!cc || typeof cc.devLastMergeTntScene !== 'function') {
    throw new Error('CC.devLastMergeTntScene is not available after boot');
  }

  return cc;
}

async function showCleanBoardDevFlow(): Promise<void> {
  triggerSettingsDevHaptic();
  hideSettingsForDevGameFlow();

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  try {
    const cc = window.CC;
    if (cc && typeof cc.showCleanBoardOverlay === 'function') {
      await cc.showCleanBoardOverlay();
      return;
    }

    const { showCleanBoardModal } = await import('../../modules/clean-board-modal.js');
    const boardNumber = getCurrentDevBoardNumber();
    await showCleanBoardModal({
      app: cc?.app,
      stage: cc?.stage,
      getScore: typeof cc?.getScore === 'function' ? cc.getScore : undefined,
      setScore: typeof cc?.setScore === 'function' ? cc.setScore : undefined,
      animateScore: typeof cc?.animateScoreTo === 'function' ? cc.animateScoreTo : undefined,
      updateHUD: typeof cc?.updateHUD === 'function' ? cc.updateHUD : undefined,
      bonus: 500 + (boardNumber - 1) * 200,
      scoreCap: 999999,
      boardNumber,
      devMode: true,
    });
  } catch (error) {
    console.error('❌ Failed to show Settings Clean Board dev flow:', error);
    alert('Clean Stage dev flow is not available right now.');
  }
}

async function runLastMergeDevScene(choice: LastMergeWildChoice): Promise<void> {
  triggerSettingsDevHaptic();
  hideSettingsForDevGameFlow();

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  try {
    const cc = await ensureLastMergeDevGameReady();
    await cc.devLastMergeTntScene({
      coreWildType: choice.coreWildType,
      variantId: choice.variantId,
      label: choice.label,
    });
  } catch (error) {
    console.error('❌ Failed to open Settings LAST MERGE dev scene:', error);
    alert('LAST MERGE dev scene is not available right now.');
  }
}

function showLastMergeDevPicker(): void {
  triggerSettingsDevHaptic();

  const choices = getLastMergeWildChoices();
  let selectedChoice: LastMergeWildChoice = choices.find((choice) => choice.coreWildType === 'wild-tnt') || choices[0];

  const overlay = document.createElement('div');
  overlay.className = 'card-picker-overlay last-merge-picker-overlay';
  overlay.style.cssText = `
    position: fixed !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, 0.5) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 9999999999 !important;
    backdrop-filter: blur(4px) !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
  `;

  const modal = document.createElement('div');
  modal.className = 'card-picker-modal last-merge-picker-modal';
  modal.style.cssText = `
    background: url('../../assets/modals/paper.png');
    background-size: cover;
    background-position: center;
    border-radius: 24px;
    padding: 24px;
    max-width: 90vw;
    width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  `;

  const title = document.createElement('h3');
  title.textContent = 'Last Merge';
  title.style.cssText = `
    font-size: 24px;
    font-weight: 800;
    color: #ad8775;
    margin: 0 0 20px 0;
    text-align: center;
  `;

  const grid = document.createElement('div');
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  `;

  const buttons: HTMLButtonElement[] = [];
  const applySelectedState = () => {
    buttons.forEach((button) => {
      const selected = button.dataset.choiceId === selectedChoice.id;
      button.style.background = selected ? '#e8734a' : '#f3eee8';
      button.style.borderColor = selected ? '#e8734a' : '#e0e0e0';
      button.style.color = selected ? 'white' : '#333';
    });
  };

  choices.forEach((choice) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = choice.label;
    btn.dataset.choiceId = choice.id;
    btn.style.cssText = `
      background: #f3eee8;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 14px 10px;
      font-size: 16px;
      font-weight: 700;
      color: #333;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 52px;
    `;
    btn.addEventListener('click', () => {
      selectedChoice = choice;
      applySelectedState();
    });
    buttons.push(btn);
    grid.appendChild(btn);
  });

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 12px;
  `;

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.textContent = 'OK';
  okBtn.style.cssText = `
    flex: 1;
    background: #e8734a;
    border: none;
    border-radius: 12px;
    padding: 12px;
    font-size: 16px;
    font-weight: 700;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Cancel';
  closeBtn.style.cssText = `
    flex: 1;
    background: #e0e0e0;
    border: none;
    border-radius: 12px;
    padding: 12px;
    font-size: 16px;
    font-weight: 700;
    color: #666;
    cursor: pointer;
    transition: all 0.2s ease;
  `;

  let closed = false;
  const handleClose = () => {
    if (closed) return;
    closed = true;
    overlay.removeEventListener('click', handleOverlayClick);
    overlay.removeEventListener('touchend', handleOverlayTouchend);
    buttons.forEach((button) => button.replaceWith(button.cloneNode(true)));
    try {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    } catch {}
  };

  const handleOverlayClick = (event: Event) => {
    if (event.target === overlay) handleClose();
  };

  const handleOverlayTouchend = (event: TouchEvent) => {
    if (event.target === overlay) {
      event.preventDefault();
      handleClose();
    }
  };

  okBtn.addEventListener('click', () => {
    const choice = selectedChoice;
    handleClose();
    void runLastMergeDevScene(choice);
  });
  closeBtn.addEventListener('click', handleClose);

  modal.appendChild(title);
  modal.appendChild(grid);
  buttonContainer.appendChild(okBtn);
  buttonContainer.appendChild(closeBtn);
  modal.appendChild(buttonContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  void overlay.offsetHeight;

  overlay.addEventListener('click', handleOverlayClick);
  overlay.addEventListener('touchend', handleOverlayTouchend);
  applySelectedState();
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

function createSettingsDevActionButton(id: string, text: string, classSuffix: string, onClick: () => void | Promise<void>): HTMLElementConfig {
  return {
    tag: 'button',
    id,
    className: `settings-dev-button settings-dev-button-${classSuffix} tap-scale`,
    text,
    attributes: {
      type: 'button',
      'aria-label': text,
    },
    eventListeners: {
      click: (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        void onClick();
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

function createSpatialIntroResetButton(): HTMLElementConfig {
  const applyReadyState = (button: HTMLElement) => {
    button.textContent = '3D Intro Ready';
    button.classList.add('is-active');
    button.setAttribute('aria-label', '3D intro will show on next relaunch');
  };

  return createSettingsDevActionButton(
    'settings-dev-reset-spatial-intro-btn',
    'Reset 3D Intro',
    'spatial-intro',
    () => {
      triggerSettingsDevHaptic();
      const button = document.getElementById('settings-dev-reset-spatial-intro-btn');
      if (scheduleSpatialMotionPermissionIntroForNextLaunch()) {
        if (button) applyReadyState(button);
        return;
      }
      alert('3D intro could not be prepared.');
    },
  );
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
          createDevButton('settings-dev-reset-board-btn', 'Reset Stage', 'reset'),
          createSettingsDevActionButton('settings-dev-new-card-btn', 'New Card', 'new-card', showNewCardDevScreen),
          createSettingsDevActionButton('settings-dev-new-dice-btn', 'New Dice', 'new-dice', showNewDiceDevScreen),
          createSettingsDevActionButton('settings-dev-clean-board-btn', 'Clean Stage', 'clean-board', showCleanBoardDevFlow),
          createSettingsDevActionButton('settings-dev-last-merge-btn', 'LAST MERGE', 'last-merge', showLastMergeDevPicker),
          createSpatialIntroResetButton(),
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
  const { onToggleGameSounds, onToggleVibration, onToggleMusic } = config;

  // Load saved settings from localStorage
  const savedSettings = (window as any)._settings || {};
  const gameSoundsEnabled = savedSettings.gameSoundsEnabled || false;
  const hapticsEnabled = savedSettings.hapticsEnabled !== undefined ? savedSettings.hapticsEnabled : true;
  const musicEnabled = savedSettings.musicEnabled !== false;
  const spatialMotionEnabled = savedSettings.spatialMotionEnabled !== false;

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

  const spatialMotionToggle: SettingToggle = {
    id: 'spatial-motion',
    status: spatialMotionEnabled ? 'ON' : 'OFF',
    label: '3D Motion',
    description: '3D Motion',
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
                  },
                  {
                    tag: 'h1',
                    className: 'settings-title',
                    text: 'Settings',
                  },
                  ...(SETTINGS_DEVELOPER_TOOLS_ENABLED ? [{
                    tag: 'button',
                    id: 'settings-dev-open-btn',
                    className: 'settings-dev-open-button tap-scale',
                    attributes: {
                      type: 'button',
                      'aria-label': 'Open developer settings',
                    },
                    children: [{
                      tag: 'img',
                      attributes: {
                        src: './assets/nav/settings-nav.png',
                        alt: '',
                        'aria-hidden': 'true',
                      },
                    }],
                  }] : [{
                    tag: 'div',
                    className: 'settings-header-spacer',
                  }]),
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
            className: 'settings-scrollable settings-main-scrollable',
            children: [
              createSettingsToggle(gameSoundsToggle),
              { tag: 'div', className: 'settings-divider' },
              createSettingsToggle(musicToggle),
              { tag: 'div', className: 'settings-divider' },
              createSettingsToggle(vibrationToggle),
              { tag: 'div', className: 'settings-divider' },
              createSettingsToggle(spatialMotionToggle),
            ],
          },
          ...(SETTINGS_DEVELOPER_TOOLS_ENABLED ? [{
            tag: 'div',
            className: 'settings-scrollable settings-developer-scrollable',
            attributes: {
              hidden: 'true',
              'aria-hidden': 'true',
            },
            children: [createSettingsDevArea()],
          }] : []),
          {
            tag: 'div',
            className: 'settings-footer',
            children: [
              {
                tag: 'div',
                className: 'settings-footer-text',
                html: '<span class="settings-version">v1.0</span>Made with ❤️ in Croatia<br/>by Tap Tap Design',
              },
              {
                tag: 'button',
                id: 'settings-privacy-policy-link',
                className: 'settings-privacy-policy-link',
                text: 'Privacy Policy',
                attributes: {
                  type: 'button',
                  'aria-haspopup': 'dialog',
                  'aria-controls': 'settings-privacy-policy-modal',
                },
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

  const setSettingsView = (view: 'main' | 'developer') => {
    const developerView = view === 'developer' && SETTINGS_DEVELOPER_TOOLS_ENABLED;
    const mainPanel = element.querySelector('.settings-main-scrollable') as HTMLElement | null;
    const developerPanel = element.querySelector('.settings-developer-scrollable') as HTMLElement | null;
    const title = element.querySelector('.settings-title') as HTMLElement | null;
    const devOpenButton = element.querySelector('#settings-dev-open-btn') as HTMLButtonElement | null;
    const backButton = element.querySelector('#settings-back-btn') as HTMLButtonElement | null;

    element.dataset.settingsView = developerView ? 'developer' : 'main';
    element.classList.toggle('settings-developer-view-active', developerView);
    if (mainPanel) {
      mainPanel.hidden = developerView;
      mainPanel.setAttribute('aria-hidden', developerView ? 'true' : 'false');
    }
    if (developerPanel) {
      developerPanel.hidden = !developerView;
      developerPanel.setAttribute('aria-hidden', developerView ? 'false' : 'true');
      if (developerView) developerPanel.scrollTop = 0;
    }
    if (title) title.textContent = developerView ? 'Developer' : 'Settings';
    if (devOpenButton) devOpenButton.hidden = developerView;
    if (backButton) {
      backButton.setAttribute('aria-label', developerView ? 'Back to settings' : 'Go back to home');
    }
  };
  setSettingsView('main');
  
  // 🔥 DIFFERENT APPROACH: Use event delegation on settings screen container
  // This ensures back button works even if element is recreated or not found during init
  const clickHandler = (e: Event) => {
    const targetNode = e.target as Node | null;
    const target = (targetNode && targetNode.nodeType === Node.ELEMENT_NODE
      ? (targetNode as Element)
      : targetNode?.parentElement) as Element | null;
    if (!target) return;
    const privacyPolicyLink = target.closest('#settings-privacy-policy-link');
    if (privacyPolicyLink) {
      e.preventDefault();
      e.stopPropagation();
      showPrivacyPolicyModal();
      return;
    }
    const devOpenButton = target.closest('#settings-dev-open-btn, .settings-dev-open-button');
    if (devOpenButton && SETTINGS_DEVELOPER_TOOLS_ENABLED) {
      e.preventDefault();
      e.stopPropagation();
      playSoftCartoonBounce((devOpenButton.querySelector('img') as HTMLElement | null) || (devOpenButton as HTMLElement));
      setSettingsView('developer');
      return;
    }
    const backBtn = target.closest('#settings-back-btn, .settings-back-button');
    if (backBtn) {
      e.preventDefault();
      e.stopPropagation();
      (e as any).stopImmediatePropagation?.();

      if (element.dataset.settingsView === 'developer') {
        playSoftCartoonBounce((backBtn.querySelector('img') as HTMLElement | null) || (backBtn as HTMLElement));
        setSettingsView('main');
        return;
      }
      
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

  // Settings stays mounted for the app lifetime. Navigation may reset its local
  // sub-view, but must not dispose the persistent click/change ownership.
  const navigationResetHandler = () => {
    closePrivacyPolicyModal({ immediate: true });
    setSettingsView('main');
  };
  window.addEventListener('cc-navigation', navigationResetHandler);

  console.log('✅ Settings back button and Music toggle handlers attached via event delegation');

  // 🔥 FIX: Store cleanup function on element for proper memory management
  (element as any)._settingsCleanup = () => {
    closePrivacyPolicyModal({ immediate: true });
    setSettingsView('main');
    element.removeEventListener('click', clickHandler);
    element.removeEventListener('change', changeHandler);
    element.removeEventListener('pointerdown', toggleBounceHandler, true);
    element.removeEventListener('touchstart', toggleBounceHandler, true);
    element.removeEventListener('click', toggleBounceHandler, true);
    window.removeEventListener('cc-navigation', navigationResetHandler);
    console.log('✅ Settings screen event listeners cleaned up');
  };
}
