// Stats Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';
import { statsService } from '../../services/stats-service.js';

// Keep track of subscription for cleanup
let statsSubscription: (() => void) | null = null;

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
  
  // Update all stat elements
  const updateElement = (id: string, value: string | number) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value.toString();
      console.log(`✅ Updated ${id}:`, value);
    } else {
      console.error(`❌ Element not found: ${id}`);
    }
  };
  
  updateElement('high-score', stats.highScore);
  updateElement('cubes-cracked', stats.cubesCracked);
  updateElement('highest-board', stats.highestBoard);
  updateElement('longest-combo', stats.longestCombo);
  updateElement('helpers-used', stats.helpersUsed);
  updateElement('time-played', formatTime(stats.timePlayed));
  updateElement('collectibles-unlocked', `${stats.collectiblesUnlocked}/20`);
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
    { id: 'collectibles-unlocked', icon: './assets/collectible-stats.png', value: `${stats.collectiblesUnlocked}/20`, label: 'Collectibles unlocked', valueId: 'collectibles-unlocked' },
  ];
}

const DEFAULT_STATS: StatItem[] = getStatsFromService();

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
