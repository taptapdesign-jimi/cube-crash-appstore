// Navigation Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface NavigationConfig {
  currentSlide?: number;
  onSlideChange?: (slideIndex: number) => void;
  badgeCount?: number; // Badge count for collectibles icon
}

export function createNavigation(config: NavigationConfig = {}): HTMLElementConfig {
  const { currentSlide = 0, onSlideChange, badgeCount } = config;

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
          createNavButton(0, 'Home', './assets/nav/cube-nav.png', currentSlide === 0, onSlideChange),
          createNavButton(1, 'Journey', './assets/nav/stats-nav.png', currentSlide === 1, onSlideChange),
          createNavButton(2, 'Collectibles', './assets/nav/collectibles-nav.png', currentSlide === 2, onSlideChange, badgeCount),
          createNavButton(3, 'Settings', './assets/nav/settings-nav.png', currentSlide === 3, onSlideChange),
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
  onSlideChange?: (slideIndex: number) => void,
  badgeCount?: number
): HTMLElementConfig {
  const children: HTMLElementConfig[] = [
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
  ];

  // Add badge for Collectibles icon (index 2) if badgeCount is set
  if (slideIndex === 2 && badgeCount !== undefined && badgeCount > 0) {
    children.push({
      tag: 'div',
      className: 'nav-badge',
      attributes: {
        'aria-label': `${badgeCount} new collectibles`,
      },
      children: [
        {
          tag: 'span',
          className: 'nav-badge-text',
          text: badgeCount.toString(),
        },
      ],
    });
  }

  return {
    tag: 'button',
    className: `independent-nav-button${isActive ? ' active' : ''}`,
    attributes: {
      type: 'button',
      'data-slide': slideIndex.toString(),
      'aria-label': label,
    },
    children,
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

export function updateNavBadge(count: number, slideIndex: number = 2): void {
  // slideIndex 1 = Journey, slideIndex 2 = Collectibles (default for backward compatibility)
  const slideName = slideIndex === 1 ? 'Journey' : 'Collectibles';
  const ariaLabel = slideIndex === 1 ? `${count} new journey boards` : `${count} new collectibles`;
  
  console.log(`🎁 updateNavBadge called with count: ${count}, slideIndex: ${slideIndex} (${slideName})`);
  const navButton = document.querySelector(`.independent-nav-button[data-slide="${slideIndex}"]`) as HTMLElement;
  if (!navButton) {
    console.warn(`⚠️ Nav button not found for slide ${slideIndex}`);
    return;
  }
  
  const existingBadge = navButton.querySelector('.nav-badge');
  
  if (count > 0) {
    // Update or create badge
    if (existingBadge) {
      const badgeText = existingBadge.querySelector('.nav-badge-text');
      if (badgeText) badgeText.textContent = count.toString();
      existingBadge.setAttribute('aria-label', ariaLabel);
      console.log(`✅ ${slideName} badge updated to`, count);
    } else {
      // Create new badge
      const badge = document.createElement('div');
      badge.className = 'nav-badge';
      badge.setAttribute('aria-label', ariaLabel);
      const badgeText = document.createElement('span');
      badgeText.className = 'nav-badge-text';
      badgeText.textContent = count.toString();
      badge.appendChild(badgeText);
      navButton.appendChild(badge);
      console.log(`✅ ${slideName} badge created with`, count);
    }
  } else {
    // Remove badge if count is 0 or less
    if (existingBadge) {
      existingBadge.remove();
      console.log(`✅ ${slideName} badge removed`);
    }
  }
}
