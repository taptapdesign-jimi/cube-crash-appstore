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
                className: 'hero-image hero-image-cta',
                attributes: {
                  src: './assets/journey-map-homepage.png',
                  alt: 'Journey Map',
                  'data-hero-cta': 'journey',
                  role: 'button',
                  tabindex: '0',
                  'aria-label': 'View Journey',
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
      slideText.style.transform = 'translateY(64px)';
      slideText.style.webkitTransform = 'translateY(64px)';
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
      // 🔥 v103 approach: Don't set ANY inline styles on iPad - let CSS handle everything
      // CSS will set the correct transform via animate-enter-initial/animate-enter classes
      slideButton.style.marginTop = '0';
      // Don't clear transform - let CSS handle it completely
    }
  }
  
  // 🔥 FIX: Postavi CTA button u animate-enter-initial stanje PRIJE dodavanja u DOM
  // Ovo osigurava da se CTA button ne vidi prije nego što se animacija pokrene
  const slideButton = element.querySelector('.slide-button') as HTMLElement;
  const slideText = element.querySelector('.slide-text') as HTMLElement;
  const slideTagline = element.querySelector('.slide-tagline') as HTMLElement;
  
  if (slideButton) {
    // 🔥 CHROME FIX: Osigurati da je CTA button vidljiv na Chrome-u (ne samo iPad)
    // Na Chrome-u, neaktivni slide-ovi također trebaju imati vidljive CTA button-e
    const isActiveSlide = config.isActive || config.slideIndex === 0; // Slide 0 (home) je defaultno aktivni
    
    if (!isActiveSlide) {
      // Za neaktivne slide-ove, NE dodavati animate-enter-initial, već odmah postaviti display
      // Ovo osigurava da su CTA buttoni vidljivi na Chrome-u kada se slide aktivira
      slideButton.style.display = 'flex';
      slideButton.style.visibility = 'visible';
      slideButton.style.opacity = '1';
      slideButton.style.transform = 'translateY(0px) scale(1)';
      slideButton.style.webkitTransform = 'translateY(0px) scale(1)';
      slideButton.style.transition = 'none';
      slideButton.style.webkitTransition = 'none';
    } else {
      // Za aktivni slide, dodati animate-enter-initial klasu (animacija će se pokrenuti)
      slideButton.classList.add('animate-enter-initial');
    }
  }
  if (slideText) {
    slideText.classList.add('animate-enter-initial');
  }
  // 🔥 FIX: Tagline NE treba animate-enter-initial klasu - treba biti vidljiv odmah
  // Animacija će se pokrenuti samo za aktivni slide u startEnterAnimationSequence
  if (slideTagline) {
    // Ne dodavati animate-enter-initial - tagline treba biti vidljiv odmah
    (slideTagline as HTMLElement).style.display = 'block';
    (slideTagline as HTMLElement).style.visibility = 'visible';
    (slideTagline as HTMLElement).style.opacity = '1';
  }
  
  container.appendChild(element);
}
