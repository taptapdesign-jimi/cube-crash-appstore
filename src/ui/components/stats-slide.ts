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
  
  // 🔥 iPad FIX: Postaviti inline stilove PRIJE dodavanja u DOM
  const isIPad = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1024;
  if (isIPad) {
    const slideText = element.querySelector('.slide-text') as HTMLElement;
    const slideTagline = element.querySelector('.slide-tagline') as HTMLElement;
    const slideButton = element.querySelector('.slide-button') as HTMLElement;
    
    if (slideText) {
      slideText.style.transform = 'translateY(120px)';
      slideText.style.webkitTransform = 'translateY(120px)';
      slideText.style.transition = 'none';
      slideText.style.webkitTransition = 'none';
    }
    
    if (slideTagline) {
      slideTagline.style.transform = 'translateY(-12px)';
      slideTagline.style.webkitTransform = 'translateY(-12px)';
      slideTagline.style.transition = 'none';
      slideTagline.style.webkitTransition = 'none';
    }
    
    if (slideButton) {
      slideButton.style.transform = 'translateY(4px) scale(1)';
      slideButton.style.webkitTransform = 'translateY(4px) scale(1)';
      slideButton.style.transition = 'none';
      slideButton.style.webkitTransition = 'none';
      slideButton.style.marginTop = '0';
    }
  }
  
  container.appendChild(element);
}
