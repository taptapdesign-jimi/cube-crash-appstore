// Home Slide Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface SlideConfig {
  slideIndex: number;
  isActive?: boolean;
  onButtonClick?: () => void;
}

export function createHomeSlide(config: SlideConfig): HTMLElementConfig {
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
                id: 'slider-parallax-image',
                className: 'hero-image slider-parallax-image',
                attributes: {
                  src: './assets/crash-cubes-homepage.png',
                  alt: 'Crashed cubes',
                  loading: 'eager',
                  fetchpriority: 'high',
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
                html: 'Stack and crash the cubes<br/>to get the required number',
              },
              {
                tag: 'button',
                id: 'btn-home',
                className: 'slide-button tap-scale menu-btn-primary',
                text: 'Play',
                attributes: {
                  type: 'button',
                  'aria-label': 'Play Game',
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

export function renderHomeSlide(
  container: HTMLElement,
  config: SlideConfig
): void {
  const slideConfig = createHomeSlide(config);
  const element = HTMLBuilder.createElement(slideConfig);
  container.appendChild(element);
}
