// Navigation Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export interface NavigationConfig {
  currentSlide?: number;
  onSlideChange?: (slideIndex: number) => void;
  badgeCount?: number; // Badge count for collectibles icon (slideIndex 2)
  journeyBadgeCount?: number; // Badge count for journey icon (slideIndex 1)
}

export function createNavigation(config: NavigationConfig = {}): HTMLElementConfig {
  const { currentSlide = 0, onSlideChange, badgeCount, journeyBadgeCount } = config;

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
          createNavButton(1, 'Journey', './assets/nav/stats-nav.png', currentSlide === 1, onSlideChange, journeyBadgeCount),
          createNavButton(2, 'Collectibles', './assets/nav/collectibles-nav.png', currentSlide === 2, onSlideChange),
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

  // 🔥 USER REQUEST: Badge ONLY on Journey icon (index 1, stats-nav.png), nowhere else
  // Badge shows count of newly unlocked journey boards that user hasn't viewed yet
  if (slideIndex === 1 && badgeCount !== undefined && badgeCount > 0) {
    children.push({
      tag: 'div',
      className: 'nav-badge',
      attributes: {
        'aria-label': `${badgeCount} new journey boards`,
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

export function updateNavBadge(count: number, slideIndex: number = 1): void {
  // 🔥 USER REQUEST: Badge ONLY on Journey icon (slideIndex 1, stats-nav.png), nowhere else
  // Ignore all other slideIndex values
  if (slideIndex !== 1) {
    console.log(`⚠️ updateNavBadge called with slideIndex ${slideIndex} - ignoring (badge only on Journey/slideIndex 1)`);
    return;
  }
  
  const slideName = 'Journey';
  const ariaLabel = `${count} new journey boards`;
  
  console.log(`🎁 updateNavBadge called with count: ${count}, slideIndex: ${slideIndex} (${slideName})`);
  
  // 🔥 FIX: If nav button doesn't exist yet, retry after a short delay
  // This handles cases where updateNavBadge is called before navigation is fully rendered
  const navButton = document.querySelector(`.independent-nav-button[data-slide="${slideIndex}"]`) as HTMLElement;
  if (!navButton) {
    console.warn(`⚠️ Nav button not found for slide ${slideIndex} - retrying in 100ms...`);
    setTimeout(() => {
      updateNavBadge(count, slideIndex);
    }, 100);
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
