// Stats Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';
import { statsService } from '../../services/stats-service.js';
import { gsap } from 'gsap';

// Keep track of subscription for cleanup
let statsSubscription: (() => void) | null = null;

// 🔥 MEMORY LEAK FIX: Track all stat animation proxies for cleanup
const statAnimationProxies: Array<{ value: number }> = [];

// Handle reset stats with iOS-compatible approach
function handleResetStats(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
  console.log('🔄 Reset button triggered');
  
  // Direct reset without confirm dialog for iOS compatibility
  try {
    const resetAllStats = (window as any).resetAllStats;
    if (typeof resetAllStats === 'function') {
      resetAllStats();
      updateStatsValues();
      console.log('🔄 Stats reset successfully');
      // Show simple feedback
      alert('Stats reset to 0');
    } else {
      console.error('❌ resetAllStats function not found');
      alert('Error: Could not reset stats');
    }
  } catch (error) {
    console.error('❌ Failed to reset stats:', error);
    alert('Error resetting stats');
  }
}

export interface StatItem {
  id: string;
  icon: string;
  value: string;
  label: string;
  valueId: string;
}

export interface StatsScreenConfig {
  stats?: StatItem[];
  onBack?: () => void;
  onReset?: () => void;
  showResetButton?: boolean;
}

// Helper function to update stats display
function updateStatsDisplay(stats: any): void {
  console.log('📊 Updating stats display:', stats);
  
  // Helper to format time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 🔥 ANIMATION: Animate stat numbers from 0 to target value (same style as clean board)
  const updateElement = (id: string, value: string | number, animate: boolean = true) => {
    const element = document.getElementById(id);
    if (!element) {
      console.error(`❌ Element not found: ${id}`);
      return;
    }
    
    // Check if value is a number (for animation) or string (like time format or "0/26")
    const isNumeric = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value));
    
    if (!isNumeric || !animate) {
      // Non-numeric values (like time format "00:00:00" or "0/26") - set directly
      element.textContent = value.toString();
      console.log(`✅ Updated ${id}:`, value);
      return;
    }
    
    // Parse target value
    const targetValue = typeof value === 'number' ? value : parseInt(value, 10);
    
    // 🔥 CRITICAL: Always start from 0 for fresh animation every time
    // This ensures animation plays every time stats screen is opened
    const startValue = 0;
    
    if (startValue === targetValue) {
      element.textContent = targetValue.toString();
      return;
    }
    
    // 🔥 MEMORY LEAK FIX: Kill any existing animation on this element first
    // Find and kill existing proxy for this element
    const existingProxy = statAnimationProxies.find(p => {
      // Check if this proxy is being used for this element
      // We'll track this by storing element reference in proxy
      return (p as any).elementId === id;
    });
    
    if (existingProxy) {
      gsap.killTweensOf(existingProxy);
      const index = statAnimationProxies.indexOf(existingProxy);
      if (index > -1) statAnimationProxies.splice(index, 1);
    }
    
    // 🔥 CRITICAL: Set element to 0 immediately before starting animation
    element.textContent = '0';
    
    // Create new proxy for this animation
    const statProxy = { value: startValue };
    (statProxy as any).elementId = id; // Track which element this proxy is for
    statAnimationProxies.push(statProxy);
    
    // Calculate duration: minimum 0.8s, maximum 1.5s, based on difference
    const diff = Math.abs(targetValue - startValue);
    const duration = Math.min(1.5, Math.max(0.8, diff / 500));
    
    console.log(`🎯 Animating ${id} from ${startValue} to ${targetValue}, duration: ${duration}`);
    
    gsap.to(statProxy, {
      value: targetValue,
      duration: duration,
      ease: 'power2.out',
      onUpdate: () => {
        const rounded = Math.round(statProxy.value);
        element.textContent = rounded.toString();
      },
      onComplete: () => {
        element.textContent = targetValue.toString();
        console.log(`✅ Animation complete for ${id}: ${targetValue}`);
      }
    });
  };
  
  // 🔥 ANIMATION: Animate numeric stats from 0 to target value
  // Start all animations with small delay for staggered effect
  updateElement('high-score', stats.highScore, true);
  setTimeout(() => updateElement('cubes-cracked', stats.cubesCracked, true), 100);
  setTimeout(() => updateElement('highest-board', stats.highestBoard, true), 200);
  setTimeout(() => updateElement('longest-combo', stats.longestCombo, true), 300);
  setTimeout(() => updateElement('helpers-used', stats.helpersUsed, true), 400);
  // Time played and collectibles are formatted strings, so no animation
  updateElement('time-played', formatTime(stats.timePlayed), false);
  const totalCollectibles = 26;
  updateElement('collectibles-unlocked', `${stats.collectiblesUnlocked}/${totalCollectibles}`, false);
}

// Function to update stats values dynamically using stats service
export function updateStatsValues(): void {
  console.log('📊 updateStatsValues() called');
  
  // Get stats from centralized service
  const stats = statsService.getStats();
  console.log('📊 Current stats from service:', stats);
  
  // Update display
  updateStatsDisplay(stats);
  
  // Subscribe to changes for real-time updates
  if (!statsSubscription) {
    console.log('📡 Subscribing to stats updates...');
    statsSubscription = statsService.subscribe((updatedStats) => {
      console.log('📡 Stats changed! New values:', updatedStats);
      updateStatsDisplay(updatedStats);
    });
    console.log('✅ Subscribed to stats updates');
  }
}

// Cleanup subscription
export function cleanupStatsSubscription(): void {
  if (statsSubscription) {
    console.log('🧹 Unsubscribing from stats updates');
    statsSubscription();
    statsSubscription = null;
  }
}

// 🔥 MEMORY LEAK FIX: Cleanup all stat animations when stats screen is closed
export function cleanupStatsAnimations(): void {
  console.log('🧹 Cleaning up stats animations...');
  
  // Kill all GSAP animations on stat proxies
  statAnimationProxies.forEach(proxy => {
    try {
      gsap.killTweensOf(proxy);
    } catch (err) {
      // Ignore errors
    }
  });
  
  // Clear the array
  statAnimationProxies.length = 0;
  
  console.log('✅ Stats animations cleaned up');
}

// Function to get stats from service and return as StatItem[]
function getStatsFromService(): StatItem[] {
  const stats = statsService.getStats();
  
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return [
    { id: 'high-score', icon: './assets/highscore-icon.png', value: stats.highScore.toString(), label: 'High score', valueId: 'high-score' },
    { id: 'cubes-cracked', icon: './assets/cubes-cracked.png', value: stats.cubesCracked.toString(), label: 'Cubes cracked', valueId: 'cubes-cracked' },
    { id: 'highest-board', icon: './assets/clean-board.png', value: stats.highestBoard.toString(), label: 'Highest board', valueId: 'highest-board' },
    { id: 'longest-combo', icon: './assets/combo-stats.png', value: stats.longestCombo.toString(), label: 'Longest combo', valueId: 'longest-combo' },
    { id: 'helpers-used', icon: './assets/wild-stats.png', value: stats.helpersUsed.toString(), label: 'Helpers used', valueId: 'helpers-used' },
    { id: 'time-played', icon: './assets/time-icon.png', value: formatTime(stats.timePlayed), label: 'Time played', valueId: 'time-played' },
    // Calculate total collectibles (20 common + 6 legendary = 26)
    (() => {
      const totalCollectibles = 26;
      return { id: 'collectibles-unlocked', icon: './assets/collectible-stats.png', value: `${stats.collectiblesUnlocked}/${totalCollectibles}`, label: 'Collectibles unlocked', valueId: 'collectibles-unlocked' };
    })(),
  ];
}

// CRITICAL FIX: Don't call getStatsFromService() at module level
// This is called too early, before statsService is fully initialized
// Instead, use a getter function that's called when needed
function getDefaultStats(): StatItem[] {
  return getStatsFromService();
}

const DEFAULT_STATS: StatItem[] = [
  { id: 'high-score', icon: './assets/highscore-icon.png', value: '0', label: 'High score', valueId: 'high-score' },
  { id: 'cubes-cracked', icon: './assets/cubes-cracked.png', value: '0', label: 'Cubes cracked', valueId: 'cubes-cracked' },
  { id: 'highest-board', icon: './assets/clean-board.png', value: '0', label: 'Highest board', valueId: 'highest-board' },
  { id: 'longest-combo', icon: './assets/combo-stats.png', value: '0', label: 'Longest combo', valueId: 'longest-combo' },
  { id: 'helpers-used', icon: './assets/wild-stats.png', value: '0', label: 'Helpers used', valueId: 'helpers-used' },
  { id: 'time-played', icon: './assets/time-icon.png', value: '00:00:00', label: 'Time played', valueId: 'time-played' },
    { id: 'collectibles-unlocked', icon: './assets/collectible-stats.png', value: '0/26', label: 'Collectibles unlocked', valueId: 'collectibles-unlocked' },
];

function createStatItem(stat: StatItem): HTMLElementConfig {
  return {
    tag: 'div',
    className: 'stat-item',
    attributes: { role: 'listitem' },
    children: [
      {
        tag: 'div',
        className: 'stat-icon',
        attributes: { 'aria-hidden': 'true' },
        children: [
          {
            tag: 'img',
            attributes: {
              src: stat.icon,
              alt: '',
              'aria-hidden': 'true',
            },
          },
        ],
      },
      {
        tag: 'div',
        className: 'stat-content',
        children: [
          {
            tag: 'div',
            id: stat.valueId,
            className: 'stat-value',
            text: stat.value,
            attributes: { 'aria-label': `${stat.label} value` },
          },
          {
            tag: 'div',
            className: 'stat-label',
            text: stat.label,
          },
        ],
      },
    ],
  };
}

export function createStatsScreen(config: StatsScreenConfig): HTMLElementConfig {
  // ALWAYS get fresh stats from service when creating the screen
  const freshStats = getStatsFromService();
  console.log('🎯 createStatsScreen - fresh stats:', freshStats);
  
  const {
    stats = freshStats,
    onBack,
    onReset,
    showResetButton = true,
  } = config;

  const statItems: HTMLElementConfig[] = [];
  stats.forEach((stat, index) => {
    statItems.push(createStatItem(stat));
    if (index < stats.length - 1) {
      statItems.push({ tag: 'div', className: 'stat-divider' });
    }
  });

  if (showResetButton) {
    statItems.push({
      tag: 'button',
      id: 'stats-reset-btn',
      className: 'stats-reset-btn menu-btn-primary',
      text: 'Reset stats',
      attributes: {
        type: 'button',
        'aria-label': 'Reset stats',
      },
      eventListeners: onReset ? { click: onReset } : undefined,
    });
  }

  return {
    tag: 'div',
    id: 'stats-screen',
    attributes: { hidden: 'true' },
    children: [
      {
        tag: 'div',
        className: 'stats-content',
        children: [
          {
            tag: 'div',
            className: 'stats-header',
            children: [
              {
                tag: 'div',
                className: 'stats-header-top',
                children: [
                  {
                    tag: 'button',
                    id: 'stats-back-btn',
                    className: 'stats-back-button tap-scale',
                    attributes: {
                      type: 'button',
                      'aria-label': 'Go back to home',
                    },
                    children: [
                      {
                        tag: 'img',
                        attributes: {
                          src: './assets/chevron-back.png',
                          alt: '',
                          'aria-hidden': 'true',
                        },
                      },
                    ],
                    eventListeners: onBack ? { click: onBack } : undefined,
                  },
                  {
                    tag: 'h1',
                    className: 'stats-title',
                    text: 'Stats',
                  },
                  {
                    tag: 'button',
                    id: 'stats-reset-dev-btn',
                    className: 'stats-reset-dev-button tap-scale',
                    attributes: {
                      type: 'button',
                      'aria-label': 'Reset stats (dev)',
                      title: 'Reset all stats to 0 (dev)',
                    },
                    text: 'Reset',
                    eventListeners: {
                      click: (e: Event) => handleResetStats(e),
                      touchend: (e: Event) => handleResetStats(e),
                    },
                  },
                ],
              },
              {
                tag: 'div',
                className: 'stats-title-underline',
                children: [
                  {
                    tag: 'img',
                    className: 'stats-shadow-image',
                    attributes: {
                      src: './assets/divider-shadow.png',
                      alt: '',
                      'aria-hidden': 'true',
                    },
                  },
                ],
              },
            ],
          },
          {
            tag: 'div',
            className: 'stats-scrollable',
            children: statItems,
          },
        ],
      },
    ],
  };
}

export function renderStatsScreen(container: HTMLElement, config: StatsScreenConfig): void {
  const screenConfig = createStatsScreen(config);
  const element = HTMLBuilder.createElement(screenConfig);
  container.appendChild(element);
}
