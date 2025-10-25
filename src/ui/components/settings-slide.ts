// Settings Slide Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface SlideConfig {
  slideIndex: number;
  isActive?: boolean;
  onButtonClick?: () => void;
}

export function createSettingsSlide(config: SlideConfig): HTMLElementConfig {
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
                  src: './assets/settings-slider.png',
                  alt: 'Settings slider',
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
                html: 'Customize the game<br/>just the way you like.',
              },
              {
                tag: 'button',
                id: 'btn-settings',
                className: 'slide-button tap-scale menu-btn-primary',
                text: 'Settings',
                attributes: {
                  type: 'button',
                  'aria-label': 'Open Settings',
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

export function renderSettingsSlide(
  container: HTMLElement,
  config: SlideConfig
): void {
  const slideConfig = createSettingsSlide(config);
  const element = HTMLBuilder.createElement(slideConfig);
  container.appendChild(element);
}
