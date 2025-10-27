// Stats Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

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

// Function to update stats values dynamically
export function updateStatsValues(): void {
  console.log('📊 Updating stats values...');
  
  // Get all stats from localStorage
  const highScoreStr = localStorage.getItem('cc_best_score_v1');
  const highScore = highScoreStr ? parseInt(highScoreStr, 10) || 0 : 0;
  console.log('📊 highScore from localStorage:', highScoreStr, 'parsed:', highScore);
  
  const highestBoardStr = localStorage.getItem('cc_highest_board');
  const highestBoard = highestBoardStr ? parseInt(highestBoardStr, 10) || 0 : 0;
  console.log('📊 highestBoard from localStorage:', highestBoardStr, 'parsed:', highestBoard);
  
  const timePlayedStr = localStorage.getItem('cc_time_played');
  const timePlayed = timePlayedStr ? parseInt(timePlayedStr, 10) || 0 : 0;
  console.log('📊 timePlayed from localStorage:', timePlayedStr, 'parsed:', timePlayed);
  
  const cubesCrackedStr = localStorage.getItem('cc_cubes_cracked');
  const cubesCracked = cubesCrackedStr ? parseInt(cubesCrackedStr, 10) || 0 : 0;
  console.log('📊 cubesCracked from localStorage:', cubesCrackedStr, 'parsed:', cubesCracked);
  
  const longestComboStr = localStorage.getItem('cc_longest_combo');
  const longestCombo = longestComboStr ? parseInt(longestComboStr, 10) || 0 : 0;
  console.log('📊 longestCombo from localStorage:', longestComboStr, 'parsed:', longestCombo);
  
  const helpersUsedStr = localStorage.getItem('cc_helpers_used');
  const helpersUsed = helpersUsedStr ? parseInt(helpersUsedStr, 10) || 0 : 0;
  console.log('📊 helpersUsed from localStorage:', helpersUsedStr, 'parsed:', helpersUsed);
  
  const collectiblesStr = localStorage.getItem('cc_collectibles_unlocked');
  const collectiblesUnlocked = collectiblesStr ? parseInt(collectiblesStr, 10) || 0 : 0;
  console.log('📊 collectiblesUnlocked from localStorage:', collectiblesStr, 'parsed:', collectiblesUnlocked);
  
  // Update high score
  const highScoreElement = document.getElementById('high-score');
  if (highScoreElement) {
    highScoreElement.textContent = highScore.toString();
  }
  
  // Update cubes cracked
  const cubesCrackedElement = document.getElementById('cubes-cracked');
  if (cubesCrackedElement) {
    cubesCrackedElement.textContent = cubesCracked.toString();
  }
  
  // Update highest board
  const highestBoardElement = document.getElementById('highest-board');
  if (highestBoardElement) {
    highestBoardElement.textContent = highestBoard.toString();
  }
  
  // Update longest combo
  const longestComboElement = document.getElementById('longest-combo');
  if (longestComboElement) {
    longestComboElement.textContent = longestCombo.toString();
  }
  
  // Update helpers used
  const helpersUsedElement = document.getElementById('helpers-used');
  if (helpersUsedElement) {
    helpersUsedElement.textContent = helpersUsed.toString();
  }
  
  // Update time played
  const timePlayedElement = document.getElementById('time-played');
  if (timePlayedElement) {
    const hours = Math.floor(timePlayed / 3600);
    const minutes = Math.floor((timePlayed % 3600) / 60);
    const seconds = timePlayed % 60;
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timePlayedElement.textContent = formattedTime;
  }
  
  // Update collectibles unlocked
  const collectiblesElement = document.getElementById('collectibles-unlocked');
  if (collectiblesElement) {
    collectiblesElement.textContent = `${collectiblesUnlocked}/20`;
  }
  
  console.log('📊 Stats values updated successfully');
}

const DEFAULT_STATS: StatItem[] = [
  { id: 'high-score', icon: './assets/highscore-icon.png', value: '0', label: 'High score', valueId: 'high-score' },
  { id: 'cubes-cracked', icon: './assets/cubes-cracked.png', value: '0', label: 'Cubes cracked', valueId: 'cubes-cracked' },
  { id: 'highest-board', icon: './assets/clean-board.png', value: '0', label: 'Highest board', valueId: 'highest-board' },
  { id: 'longest-combo', icon: './assets/combo-stats.png', value: '0', label: 'Longest combo', valueId: 'longest-combo' },
  { id: 'helpers-used', icon: './assets/wild-stats.png', value: '0', label: 'Helpers used', valueId: 'helpers-used' },
  { id: 'time-played', icon: './assets/time-icon.png', value: '00:00:00', label: 'Time played', valueId: 'time-played' },
  { id: 'collectibles-unlocked', icon: './assets/collectible-stats.png', value: '0/20', label: 'Collectibles unlocked', valueId: 'collectibles-unlocked' },
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
  const {
    stats = DEFAULT_STATS,
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
                      click: () => {
                        if (confirm('Reset all stats to 0? (This is a dev feature)')) {
                          try {
                            const resetAllStats = (window as any).resetAllStats;
                            if (typeof resetAllStats === 'function') {
                              resetAllStats();
                              updateStatsValues();
                              console.log('🔄 Stats reset successfully');
                            }
                          } catch (error) {
                            console.error('❌ Failed to reset stats:', error);
                          }
                        }
                      },
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
