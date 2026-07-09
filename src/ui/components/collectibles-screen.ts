// Journey Screen Component
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
    id: 'journey-screen',
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
                    id: 'journey-boards-container',
                    className: 'journey-boards-container',
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
                  {
                    tag: 'h1',
                    id: 'detail-title',
                    className: 'detail-title',
                    text: '',
                  },
                  {
                    tag: 'div',
                    className: 'detail-header-spacer',
                    attributes: {
                      'aria-hidden': 'true',
                    },
                  },
                ],
              },
              {
                tag: 'div',
                className: 'detail-title-underline',
                children: [
                  {
                    tag: 'img',
                    className: 'detail-shadow-image',
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
            className: 'detail-swipeable-container',
            children: [
              // Section 1: Stats + Card (both visible, horizontal layout)
              {
                tag: 'div',
                className: 'detail-section detail-section-stats-card',
                id: 'detail-section-stats-card',
                children: [
                  // Stats (left)
                  {
                    tag: 'div',
                    className: 'detail-section-stats',
                    children: [
                      {
                        tag: 'div',
                        className: 'detail-stats-list',
                        children: [
                          {
                            tag: 'div',
                            className: 'detail-stat-item',
                            children: [
                          {
                            tag: 'div',
                            className: 'detail-stat-icon',
                            children: [
                              {
                                tag: 'img',
                                attributes: {
                                  src: './assets/stats-trophy.png',
                                  alt: 'High score',
                                  'aria-hidden': 'true',
                                },
                              },
                            ],
                          },
                          {
                            tag: 'div',
                            className: 'detail-stat-content',
                            children: [
                              {
                                tag: 'div',
                                id: 'detail-stat-highscore-value',
                                className: 'detail-stat-value',
                                text: '0',
                              },
                              {
                                tag: 'div',
                                className: 'detail-stat-label',
                                text: 'High score',
                              },
                            ],
                          },
                        ],
                      },
                      {
                        tag: 'div',
                        className: 'detail-stat-divider',
                      },
                      {
                        tag: 'div',
                        className: 'detail-stat-item',
                        children: [
                          {
                            tag: 'div',
                            className: 'detail-stat-icon',
                            children: [
                              {
                                tag: 'img',
                                attributes: {
                                  src: './assets/combo-stats.png',
                                  alt: 'Longest combo',
                                  'aria-hidden': 'true',
                                },
                              },
                            ],
                          },
                          {
                            tag: 'div',
                            className: 'detail-stat-content',
                            children: [
                              {
                                tag: 'div',
                                id: 'detail-stat-combo-value',
                                className: 'detail-stat-value',
                                text: '0',
                              },
                              {
                                tag: 'div',
                                className: 'detail-stat-label',
                                text: 'Longest combo',
                              },
                            ],
                          },
                        ],
                      },
                      {
                        tag: 'div',
                        className: 'detail-stat-divider',
                      },
                      {
                        tag: 'div',
                        className: 'detail-stat-item',
                        children: [
                              {
                                tag: 'div',
                                className: 'detail-stat-icon',
                                children: [
                                  {
                                    tag: 'img',
                                    attributes: {
                                      src: './assets/cubes-cracked.png',
                                      alt: 'Cubes cracked',
                                      'aria-hidden': 'true',
                                    },
                                  },
                                ],
                              },
                              {
                                tag: 'div',
                                className: 'detail-stat-content',
                                children: [
                                  {
                                    tag: 'div',
                                    id: 'detail-stat-cubes-value',
                                    className: 'detail-stat-value',
                                    text: '0',
                                  },
                                  {
                                    tag: 'div',
                                    className: 'detail-stat-label',
                                    text: 'Cubes cracked',
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  // Card (middle)
                  {
                    tag: 'div',
                    className: 'detail-section-card',
                    id: 'detail-section-card',
                    children: [
                      {
                        tag: 'div',
                        id: 'detail-card-image',
                        className: 'detail-image',
                      },
                    ],
                  },
                  // Text (right, 200px from card)
                  {
                    tag: 'p',
                    id: 'detail-card-description',
                    className: 'detail-description',
                    text: 'Clean a board in less than 2 minutes',
                  },
                ],
              },
              // Section 2: Buttons (swipe to see)
              {
                tag: 'div',
                className: 'detail-section detail-section-description',
                id: 'detail-section-description',
                children: [
                  {
                    tag: 'button',
                    id: 'detail-play-board-btn',
                    className: 'detail-play-board-button primary-button',
                    attributes: {
                      type: 'button',
                      style: 'display: none;', // Hidden by default, shown for interim Journey boards
                    },
                    text: 'Play',
                  },
                  {
                    tag: 'button',
                    id: 'detail-continue-board-btn',
                    className: 'detail-continue-board-button primary-button',
                    attributes: {
                      type: 'button',
                      style: 'display: none;', // Hidden by default, shown for interim Journey boards
                    },
                    text: 'Continue',
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
