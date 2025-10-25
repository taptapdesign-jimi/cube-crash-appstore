// Collectibles Slide Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface SlideConfig {
  slideIndex: number;
  isActive?: boolean;
  onButtonClick?: () => void;
}

export function createCollectiblesSlide(config: SlideConfig): HTMLElementConfig {
  const { slideIndex, isActive = false, onButtonClick } = config;

  return {
    tag: 'div',
    className: `slider-slide${isActive ? ' active' : ''}`,
    attributes: {
      'data-slide': slideIndex.toString(),
    },
    children: [
      {
        tag: 'div',
        className: 'slide-content',
        children: [
          {
            tag: 'div',
            className: 'hero-container',
            children: [
              {
                tag: 'img',
                className: 'hero-image',
                attributes: {
                  src: './assets/collectibles-box.png',
                  alt: 'Collectibles box',
                },
              },
              {
                tag: 'div',
                className: 'hero-shadow',
              },
            ],
          },
          {
            tag: 'div',
            className: 'slide-text',
            children: [
              {
                tag: 'p',
                className: 'slide-tagline',
                html: 'Collect special rewards<br/>and earn bragging rights',
              },
              {
                tag: 'button',
                id: 'btn-collectibles',
                className: 'slide-button tap-scale menu-btn-primary',
                text: 'Collectibles',
                attributes: {
                  type: 'button',
                  'aria-label': 'View Collectibles',
                },
                eventListeners: onButtonClick ? { click: onButtonClick } : undefined,
              },
            ],
          },
        ],
      },
    ],
  };
}

export function renderCollectiblesSlide(
  container: HTMLElement,
  config: SlideConfig
): void {
  const slideConfig = createCollectiblesSlide(config);
  const element = HTMLBuilder.createElement(slideConfig);
  container.appendChild(element);
}
