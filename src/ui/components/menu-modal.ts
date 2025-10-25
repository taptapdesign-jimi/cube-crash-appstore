// Menu Modal Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface MenuModalConfig {
  onRestart?: () => void;
  onExit?: () => void;
}

export function createMenuModal(config: MenuModalConfig = {}): HTMLElementConfig {
  const { onRestart, onExit } = config;

  return {
    tag: 'div',
    id: 'menu-screen',
    attributes: { hidden: 'true' },
    children: [
      {
        tag: 'div',
        className: 'menu-content',
        children: [
          {
            tag: 'h2',
            text: 'End This Run?',
          },
          {
            tag: 'div',
            className: 'warning-message',
            text: 'Think twice, your progress disappears once you leave.',
          },
          {
            tag: 'div',
            className: 'buttons-container',
            children: [
              {
                tag: 'button',
                id: 'menu-restart-action',
                className: 'modal-button restart-button',
                text: 'Restart',
                attributes: {
                  type: 'button',
                  'aria-label': 'Restart game',
                },
                eventListeners: onRestart ? { click: onRestart } : undefined,
              },
              {
                tag: 'button',
                id: 'menu-exit-btn',
                className: 'modal-button exit-button',
                text: 'Exit',
                attributes: {
                  type: 'button',
                  'aria-label': 'Exit to menu',
                },
                eventListeners: onExit ? { click: onExit } : undefined,
              },
            ],
          },
        ],
      },
    ],
  };
}

export function renderMenuModal(container: HTMLElement, config: MenuModalConfig = {}): void {
  const modalConfig = createMenuModal(config);
  const element = HTMLBuilder.createElement(modalConfig);
  container.appendChild(element);
}
