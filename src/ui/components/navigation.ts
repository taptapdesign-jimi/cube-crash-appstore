// Navigation Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface NavigationConfig {
  currentSlide?: number;
  onSlideChange?: (slideIndex: number) => void;
}

export function createNavigation(config: NavigationConfig = {}): HTMLElementConfig {
  const { currentSlide = 0, onSlideChange } = config;

  return {
    tag: 'div',
    id: 'independent-nav',
    className: 'independent-nav',
    children: [
      {
        tag: 'div',
        className: 'independent-nav-divider',
      },
      {
        tag: 'div',
        className: 'independent-nav-buttons',
        children: [
          createNavButton(0, 'Home', './assets/nav/cube-nav.png', currentSlide === 0, onSlideChange),
          createNavButton(1, 'Stats', './assets/nav/stats-nav.png', currentSlide === 1, onSlideChange),
          createNavButton(2, 'Collectibles', './assets/nav/collectibles-nav.png', currentSlide === 2, onSlideChange),
          createNavButton(3, 'Settings', './assets/nav/settings-nav.png', currentSlide === 3, onSlideChange),
        ],
      },
    ],
  };
}

function createNavButton(
  slideIndex: number,
  label: string,
  iconSrc: string,
  isActive: boolean,
  onSlideChange?: (slideIndex: number) => void
): HTMLElementConfig {
  return {
    tag: 'button',
    className: `independent-nav-button${isActive ? ' active' : ''}`,
    attributes: {
      type: 'button',
      'data-slide': slideIndex.toString(),
      'aria-label': label,
    },
    children: [
      {
        tag: 'img',
        attributes: {
          src: iconSrc,
          alt: '',
          loading: 'lazy',
          draggable: 'false',
          'aria-hidden': 'true',
        },
      },
    ],
    eventListeners: onSlideChange ? {
      click: () => onSlideChange(slideIndex),
    } : undefined,
  };
}

export function renderNavigation(container: HTMLElement, config: NavigationConfig = {}): void {
  const navConfig = createNavigation(config);
  const element = HTMLBuilder.createElement(navConfig);
  container.appendChild(element);
}
