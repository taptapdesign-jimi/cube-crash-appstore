// Stats Slide Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface SlideConfig {
  slideIndex: number;
  isActive?: boolean;
  onButtonClick?: () => void;
}

export function createStatsSlide(config: SlideConfig): HTMLElementConfig {
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
                  src: './assets/stats-trophy.png',
                  alt: 'Trophy',
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
                html: 'See your best score<br/>and other stats',
              },
              {
                tag: 'button',
                id: 'btn-stats',
                className: 'primary-button',
                text: 'Stats',
                attributes: {
                  type: 'button',
                  'aria-label': 'View Stats',
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

export function renderStatsSlide(
  container: HTMLElement,
  config: SlideConfig
): void {
  const slideConfig = createStatsSlide(config);
  const element = HTMLBuilder.createElement(slideConfig);
  container.appendChild(element);
}
