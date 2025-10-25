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

const DEFAULT_STATS: StatItem[] = [
  { id: 'high-score', icon: './assets/highscore-icon.png', value: '8975', label: 'High score', valueId: 'high-score' },
  { id: 'cubes-cracked', icon: './assets/cubes-cracked.png', value: '3441', label: 'Cubes cracked', valueId: 'cubes-cracked' },
  { id: 'highest-board', icon: './assets/clean-board.png', value: '0', label: 'Highest board', valueId: 'highest-board' },
  { id: 'longest-combo', icon: './assets/combo-stats.png', value: '12', label: 'Longest combo', valueId: 'longest-combo' },
  { id: 'helpers-used', icon: './assets/wild-stats.png', value: '1527', label: 'Helpers used', valueId: 'helpers-used' },
  { id: 'time-played', icon: './assets/time-icon.png', value: '00:00:00', label: 'Time played', valueId: 'time-played' },
  { id: 'collectibles-unlocked', icon: './assets/collectible-stats.png', value: '3/20', label: 'Collectibles unlocked', valueId: 'collectibles-unlocked' },
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
                    tag: 'div',
                    text: '', // Empty spacer
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
