// Navigation Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';
import {
  ARCADE_SLIDE_INDEX,
  DEFAULT_HOMEPAGE_SLIDE_INDEX,
  JOURNEY_SLIDE_INDEX,
  SETTINGS_SLIDE_INDEX,
} from '../../modules/homepage-slide-order.js';
import {
  playNavigationIconSounds,
  preloadNavigationIconSounds,
} from '../../modules/navigation-icon-sound.js';

export interface NavigationConfig {
  currentSlide?: number;
  onSlideChange?: (slideIndex: number) => void;
}

export function createNavigation(config: NavigationConfig = {}): HTMLElementConfig {
  const { currentSlide = DEFAULT_HOMEPAGE_SLIDE_INDEX, onSlideChange } = config;
  preloadNavigationIconSounds();

  return {
    tag: 'div',
    id: 'independent-nav',
    className: 'independent-nav',
    children: [
      {
        tag: 'div',
        className: 'independent-nav-content',
        children: [
          {
            tag: 'div',
            className: 'independent-nav-divider',
          },
      {
        tag: 'div',
        className: 'independent-nav-buttons',
        children: [
          createNavButton(JOURNEY_SLIDE_INDEX, 'Journey', './assets/nav/stats-nav.png', currentSlide === JOURNEY_SLIDE_INDEX, onSlideChange),
          createNavButton(ARCADE_SLIDE_INDEX, 'Arcade', './assets/nav/cube-nav.png', currentSlide === ARCADE_SLIDE_INDEX, onSlideChange),
          createNavButton(SETTINGS_SLIDE_INDEX, 'Settings', './assets/nav/settings-nav.png', currentSlide === SETTINGS_SLIDE_INDEX, onSlideChange),
        ],
      },
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
  const children: HTMLElementConfig[] = [
    {
      tag: 'span',
      className: 'nav-icon-motion',
      children: [
        {
          tag: 'span',
          className: 'nav-icon-visual',
          children: [
            {
              tag: 'img',
              attributes: {
                src: iconSrc,
                alt: '',
                loading: 'eager',
                fetchpriority: 'high',
                draggable: 'false',
                'aria-hidden': 'true',
              },
            },
          ],
        },
      ],
    },
  ];

  return {
    tag: 'button',
    className: `independent-nav-button${isActive ? ' active' : ''}`,
    attributes: {
      type: 'button',
      'data-slide': slideIndex.toString(),
      'aria-label': label,
    },
    children,
    eventListeners: {
      pointerdown: () => playNavigationIconSounds(),
      ...(onSlideChange ? { click: () => onSlideChange(slideIndex) } : {}),
    },
  };
}

export function renderNavigation(container: HTMLElement, config: NavigationConfig = {}): void {
  const navConfig = createNavigation(config);
  const element = HTMLBuilder.createElement(navConfig);
  container.appendChild(element);
}
