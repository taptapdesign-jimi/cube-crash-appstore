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
                  src: './assets/journey-map-homepage.png',
                  alt: 'Journey Map',
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
                text: 'Chart your journey',
              },
              {
                tag: 'button',
                id: 'btn-journey',
                className: 'slide-button tap-scale menu-btn-primary',
                text: 'Journey',
                attributes: {
                  type: 'button',
                  'aria-label': 'View Journey',
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
