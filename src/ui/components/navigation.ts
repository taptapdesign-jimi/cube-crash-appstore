// Navigation Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';
import { SETTINGS_SLIDE_INDEX, SHOP_MODULE_ENABLED, SHOP_MODULE_SLIDE_INDEX } from '../../modules/shop-module.js';

// Journey nav badge module: kept in code for later restore, currently hidden by request.
const JOURNEY_NAV_BADGE_ENABLED = false;

// 🔥 FIX: Track navigation timeouts for cleanup
const activeNavTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

/**
 * Cleanup all navigation timeouts
 */
export function cleanupNavigationTimeouts(): void {
  activeNavTimeouts.forEach(timeout => {
    try { clearTimeout(timeout); } catch {}
  });
  activeNavTimeouts.clear();
}

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
          SHOP_MODULE_ENABLED ? createNavButton(SHOP_MODULE_SLIDE_INDEX, 'Shop', './assets/nav/collectibles-nav.png', currentSlide === SHOP_MODULE_SLIDE_INDEX, onSlideChange) : null,
          createNavButton(SETTINGS_SLIDE_INDEX, 'Settings', './assets/nav/settings-nav.png', currentSlide === SETTINGS_SLIDE_INDEX, onSlideChange),
        ].filter((child): child is HTMLElementConfig => child !== null),
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
  if (JOURNEY_NAV_BADGE_ENABLED && slideIndex === 1 && badgeCount !== undefined && badgeCount > 0) {
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

  // 🔒 Restore Journey badge if it existed before navigation was rebuilt
  const lastJourneyBadge = (window as any).__ccJourneyBadgeCount;
  const persistedBadge = readPersistedBadge();
  const restoreCount = Math.max(
    Number.isFinite(lastJourneyBadge) ? lastJourneyBadge : 0,
    persistedBadge
  );
  if (JOURNEY_NAV_BADGE_ENABLED && restoreCount > 0) {
    updateNavBadge(restoreCount, 1);
  }
}

// Persist last badge count so we can restore after nav transitions/rebuilds
let lastJourneyBadgeCount = 0;
const BADGE_STORAGE_KEY = 'journey_badge_count_v109';

const readPersistedBadge = (): number => {
  try {
    const raw = localStorage.getItem(BADGE_STORAGE_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const writePersistedBadge = (count: number): void => {
  try {
    if (count > 0) {
      localStorage.setItem(BADGE_STORAGE_KEY, String(count));
    } else {
      localStorage.removeItem(BADGE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors (private browsing, etc.)
  }
};

// Options to control badge overwrite behaviour
type UpdateNavBadgeOptions = {
  forceReset?: boolean; // when true, allow overwriting an existing badge with 0
};

// ✅ SIMPLIFIED: Helper to get current badge count from all sources
function getCurrentBadgeCount(slideIndex: number): number {
  const navButton = document.querySelector(`.independent-nav-button[data-slide="${slideIndex}"]`) as HTMLElement;
  const domBadgeCount = navButton
    ? parseInt(navButton.querySelector('.nav-badge-text')?.textContent || '0', 10)
    : 0;
  const storedBadge = (window as any).__ccJourneyBadgeCount ?? lastJourneyBadgeCount ?? 0;
  const persistedBadge = readPersistedBadge();
  return Math.max(storedBadge, persistedBadge, domBadgeCount);
}

// ✅ SIMPLIFIED: Helper to check if exit animation is active
function isExitAnimationActive(): boolean {
  return typeof (window as any).__ccIsAnimatingSliderExit === 'function' 
    ? (window as any).__ccIsAnimatingSliderExit() 
    : false;
}

export function updateNavBadge(count: number, slideIndex: number = 1, opts: UpdateNavBadgeOptions = {}): void {
  // 🔥 USER REQUEST: Badge ONLY on Journey icon (slideIndex 1, stats-nav.png), nowhere else
  if (slideIndex !== 1) {
    console.log(`⚠️ updateNavBadge called with slideIndex ${slideIndex} - ignoring (badge only on Journey/slideIndex 1)`);
    return;
  }

  if (!JOURNEY_NAV_BADGE_ENABLED) {
    const currentCount = getCurrentBadgeCount(slideIndex);
    const preservedCount = Math.max(Number.isFinite(count) ? count : 0, currentCount);
    lastJourneyBadgeCount = preservedCount;
    (window as any).__ccJourneyBadgeCount = preservedCount;
    writePersistedBadge(preservedCount);

    const navButton = document.querySelector(`.independent-nav-button[data-slide="${slideIndex}"]`) as HTMLElement | null;
    navButton?.querySelector('.nav-badge')?.remove();
    return;
  }
  
  const slideName = 'Journey';
  const ariaLabel = `${count} new journey boards`;
  const forceReset = opts.forceReset === true;
  
  // ✅ SIMPLIFIED: Get current badge count from all sources
  const currentCount = getCurrentBadgeCount(slideIndex);
  
  // ✅ SIMPLIFIED: Preserve existing badge if trying to clear without force
  if (count <= 0 && currentCount > 0 && !forceReset) {
    lastJourneyBadgeCount = currentCount;
    (window as any).__ccJourneyBadgeCount = currentCount;
    writePersistedBadge(currentCount);
    console.log(`⏳ Preserving existing Journey badge (${currentCount}) - skip reset (forceReset=false)`);
    return;
  }

  // ✅ SIMPLIFIED: Update stored values
  lastJourneyBadgeCount = count;
  (window as any).__ccJourneyBadgeCount = count;
  writePersistedBadge(count > 0 || forceReset ? count : 0);
  
  // ✅ SIMPLIFIED: Get nav button (with single retry if not found)
  const navButton = document.querySelector(`.independent-nav-button[data-slide="${slideIndex}"]`) as HTMLElement;
  if (!navButton) {
    console.warn(`⚠️ Nav button not found for slide ${slideIndex} - retrying in 100ms...`);
    // 🔥 FIX: Track timeout for cleanup
    const retryTimeout = setTimeout(() => {
      activeNavTimeouts.delete(retryTimeout);
      updateNavBadge(count, slideIndex, opts);
    }, 100);
    activeNavTimeouts.add(retryTimeout);
    return;
  }
  
  const existingBadge = navButton.querySelector('.nav-badge');
  
  if (count > 0) {
    // ✅ SIMPLIFIED: Update or create badge
    if (existingBadge) {
      const badgeText = existingBadge.querySelector('.nav-badge-text');
      if (badgeText) badgeText.textContent = count.toString();
      existingBadge.setAttribute('aria-label', ariaLabel);
      existingBadge.classList.remove('animate-exit', 'animate-reset');
      existingBadge.style.display = 'flex';
      existingBadge.style.visibility = 'visible';
      existingBadge.style.opacity = '1';
      console.log(`✅ ${slideName} badge updated to`, count);
    } else {
      const badge = document.createElement('div');
      badge.className = 'nav-badge';
      badge.setAttribute('aria-label', ariaLabel);
      const badgeText = document.createElement('span');
      badgeText.className = 'nav-badge-text';
      badgeText.textContent = count.toString();
      badge.appendChild(badgeText);
      navButton.appendChild(badge);
      badge.style.display = 'flex';
      badge.style.visibility = 'visible';
      badge.style.opacity = '1';
      console.log(`✅ ${slideName} badge created with`, count);
    }
  } else {
    // ✅ SIMPLIFIED: Remove badge with animation check
    if (!existingBadge) return;
    
    // Check if exit animation is active
    if (isExitAnimationActive() || existingBadge.classList.contains('animate-exit')) {
      console.log(`⏳ ${slideName} badge is animating - will be removed after animation completes`);
      return;
    }

    // ✅ SIMPLIFIED: Single timeout for exit animation check and removal
    // 🔥 FIX: Track timeout for cleanup
    const exitCheckTimeout = setTimeout(() => {
      activeNavTimeouts.delete(exitCheckTimeout);
      
      if (isExitAnimationActive()) {
        console.log(`⏳ ${slideName} badge removal deferred - exit animation now active`);
        return;
      }

      const badgeNow = navButton.querySelector('.nav-badge');
      if (!badgeNow) return;

      // Trigger exit animation
      badgeNow.classList.remove('animate-exit', 'animate-enter', 'animate-enter-initial', 'animate-reset');
      void badgeNow.offsetHeight; // force reflow
      badgeNow.classList.add('animate-exit');

      // Remove after animation completes
      // 🔥 FIX: Track timeout for cleanup
      const removeTimeout = setTimeout(() => {
        activeNavTimeouts.delete(removeTimeout);
        const finalBadge = navButton.querySelector('.nav-badge');
        if (finalBadge && finalBadge.classList.contains('animate-exit')) {
          finalBadge.remove();
          console.log(`✅ ${slideName} badge removed after exit animation`);
        }
      }, 820); // matches exit animation duration
      activeNavTimeouts.add(removeTimeout);
    }, 60); // small delay to check exit animation
    activeNavTimeouts.add(exitCheckTimeout);
  }
}
