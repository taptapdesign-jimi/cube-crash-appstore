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
    className: 'hidden',
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
                    text: 'Collectibles',
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
              },
            ],
          },
          // Scrollable content
          {
            tag: 'div',
            className: 'collectibles-scrollable',
            children: [
              // Common section
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
                        text: 'COMMON',
                      },
                      {
                        tag: 'span',
                        id: 'common-counter',
                        className: 'collectibles-counter',
                        text: '0/20',
                      },
                    ],
                  },
                  {
                    tag: 'div',
                    id: 'common-cards',
                    className: 'collectibles-grid',
                  },
                ],
              },
              // Legendary section
              {
                tag: 'section',
                className: 'collectibles-section',
                children: [
                  {
                    tag: 'div',
                    className: 'collectibles-divider legend-divider',
                  },
                  {
                    tag: 'div',
                    className: 'collectibles-section-header',
                    children: [
                      {
                        tag: 'h2',
                        className: 'collectibles-section-title',
                        text: 'LEGENDARY',
                      },
                      {
                        tag: 'span',
                        id: 'legendary-counter',
                        className: 'collectibles-counter',
                        text: '0/5',
                      },
                    ],
                  },
                  {
                    tag: 'div',
                    id: 'legendary-cards',
                    className: 'collectibles-grid',
                  },
                ],
              },
            ],
          },
          ...(showDebugControls
            ? [
                {
                  tag: 'div',
                  className: 'collectibles-debug-controls',
                  children: [
                    {
                      tag: 'button',
                      id: 'collectibles-unlock-btn',
                      className: 'debug-btn collectibles-debug-btn',
                      text: '🧪 Unlock Collectible',
                      attributes: { type: 'button' },
                      eventListeners: onUnlock ? { click: onUnlock } : undefined,
                    },
                    {
                      tag: 'button',
                      id: 'collectibles-hide-btn',
                      className: 'debug-btn collectibles-debug-btn',
                      text: '🧪 Hide Collectible',
                      attributes: { type: 'button' },
                      eventListeners: onHide ? { click: onHide } : undefined,
                    },
                  ],
                },
              ]
            : []),
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
    className: 'screen modal hidden',
    children: [
      {
        tag: 'div',
        className: 'modal-content',
        children: [
          {
            tag: 'div',
            className: 'detail-top-bar',
            children: [
              {
                tag: 'div',
                id: 'detail-card-number',
                className: 'card-number-display',
                text: '05',
              },
              {
                tag: 'button',
                id: 'detail-close-btn',
                className: 'close-btn',
                attributes: {
                  type: 'button',
                  'aria-label': 'Close collectible details',
                },
                children: [
                  {
                    tag: 'img',
                    attributes: {
                      src: 'assets/close-button.png',
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
            className: 'detail-divider',
          },
          {
            tag: 'div',
            className: 'card-detail-content',
            children: [
              {
                tag: 'div',
                className: 'card-image-container',
                children: [
                  {
                    tag: 'div',
                    id: 'detail-card-image',
                    className: 'card-image',
                  },
                ],
              },
              {
                tag: 'div',
                className: 'card-description-container',
                children: [
                  {
                    tag: 'div',
                    className: 'description-divider',
                  },
                  {
                    tag: 'p',
                    id: 'detail-card-description',
                    className: 'card-description',
                    text: 'Clean a board in less than 2 minutes',
                  },
                ],
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
