// Collectibles Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface CollectiblesScreenConfig {
  onBack?: () => void;
  onUnlock?: () => void;
  onHide?: () => void;
  showDebugControls?: boolean;
}

export function createCollectiblesScreen(config: CollectiblesScreenConfig = {}): HTMLElementConfig {
  const { onBack, onUnlock, onHide, showDebugControls = false } = config;

  return {
    tag: 'div',
    id: 'collectibles-screen',
    className: 'hidden journey-screen',
    children: [
      {
        tag: 'div',
        className: 'collectibles-shell',
        children: [
          // Header
          {
            tag: 'div',
            className: 'collectibles-header',
            children: [
              {
                tag: 'div',
                className: 'collectibles-header-top',
                children: [
                  {
                    tag: 'button',
                    id: 'collectibles-back',
                    className: 'collectibles-back-button tap-scale',
                    attributes: {
                      type: 'button',
                      'aria-label': 'Back to slider',
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
                    className: 'collectibles-title',
                    id: 'collectibles-title',
                    text: 'Journey',
                  },
                  {
                    tag: 'div',
                    className: 'collectibles-header-spacer',
                  },
                ],
              },
              {
                tag: 'div',
                className: 'collectibles-title-underline',
                children: [
                  {
                    tag: 'img',
                    className: 'collectibles-shadow-image',
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
          // Scrollable content
          {
            tag: 'div',
            className: 'collectibles-scrollable',
            children: [
              // Boards section
              {
                tag: 'section',
                className: 'collectibles-section',
                children: [
                  {
                    tag: 'div',
                    className: 'collectibles-section-header',
                    children: [
                      {
                        tag: 'h2',
                        className: 'collectibles-section-title',
                        text: 'Boards',
                      },
                      {
                        tag: 'span',
                        id: 'boards-counter',
                        className: 'collectibles-counter',
                        text: '09/25',
                      },
                    ],
                  },
                  {
                    tag: 'div',
                    id: 'journey-boards-container',
                    className: 'journey-boards-container',
                  },
                ],
              },
            ],
          },
        ],
      },
      // 🔥 Floating buttons - DIRECTLY in journey-screen, outside collectibles-shell
      // This ensures they're on the same level as cards and can have highest z-index
      {
        tag: 'div',
        className: 'journey-floating-buttons-container',
        children: [
          {
            tag: 'button',
            id: 'journey-unlock-btn',
            className: 'journey-floating-btn',
            text: 'Show Card',
            attributes: { type: 'button' },
          },
          {
            tag: 'button',
            id: 'journey-hide-btn',
            className: 'journey-floating-btn',
            text: 'Hide Card',
            attributes: { type: 'button' },
          },
        ],
      },
    ],
  };
}

export function renderCollectiblesScreen(container: HTMLElement, config: CollectiblesScreenConfig = {}): void {
  const screenConfig = createCollectiblesScreen(config);
  const element = HTMLBuilder.createElement(screenConfig);
  container.appendChild(element);
}

// Collectibles Detail Modal
export function createCollectiblesDetailModal(): HTMLElementConfig {
  return {
    tag: 'div',
    id: 'collectibles-detail-modal',
    attributes: { hidden: 'true' },
    children: [
      {
        tag: 'div',
        className: 'detail-content',
        children: [
          {
            tag: 'div',
            className: 'detail-header',
            children: [
              {
                tag: 'div',
                className: 'detail-header-top',
                children: [
              {
                tag: 'button',
                id: 'detail-close-btn',
                    className: 'detail-close-button tap-scale',
                attributes: {
                  type: 'button',
                  'aria-label': 'Close collectible details',
                },
                children: [
                  {
                    tag: 'img',
                    attributes: {
                          src: './assets/close-icon.png',
                      alt: '',
                      'aria-hidden': 'true',
                    },
                  },
                ],
              },
            ],
              },
            ],
          },
          {
            tag: 'div',
            className: 'detail-scrollable',
                children: [
                  {
                    tag: 'div',
                    id: 'detail-card-image',
                className: 'detail-image',
              },
              {
                tag: 'div',
                className: 'detail-rarity-badge-container',
                children: [
                  {
                    tag: 'div',
                    className: 'detail-divider-left',
                  },
                  {
                    tag: 'div',
                    id: 'detail-rarity-badge',
                    className: 'detail-rarity-badge',
                    text: 'COMMON',
                  },
                  {
                    tag: 'div',
                    className: 'detail-divider-right',
                  },
                ],
              },
              {
                tag: 'p',
                id: 'detail-card-description',
                className: 'detail-description',
                text: 'Clean a board in less than 2 minutes',
              },
            ],
          },
        ],
      },
    ],
  };
}

export function renderCollectiblesDetailModal(container: HTMLElement): void {
  const modalConfig = createCollectiblesDetailModal();
  const element = HTMLBuilder.createElement(modalConfig);
  container.appendChild(element);
}
