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
                  srcset: [
                    './assets/crash-cubes-homepage.png 1x',
                    './assets/crash-cubes-homepage@2x.png 2x',
                    './assets/crash-cubes-homepage@3x.png 3x',
                  ].join(', '),
                  sizes: '(max-width: 500px) 90vw, 320px',
                  alt: 'Crashed cubes',
                  loading: 'eager',
                  fetchpriority: 'high',
                  decoding: 'async',
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
                text: 'Merge dice, clear boards',
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
  
  // 🔥 iPad FIX: Postaviti inline stilove PRIJE dodavanja u DOM
  // Ovo osigurava da se elementi ne pomiču sa dna ekrana na finalnu poziciju
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
