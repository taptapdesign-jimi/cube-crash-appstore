import { logger } from '../core/logger.js';
// collectibles-data.ts
// Data management for collectibles system

logger.info('🎁 Collectibles Data module loaded');

// Type definitions
export interface CollectibleCard {
  id: string;
  name: string;
  description: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  event: string;
  unlocked: boolean;
  imagePath?: string;
}

export interface CollectiblesData {
  common: CollectibleCard[];
  legendary: CollectibleCard[];
}

export interface UnlockOptions {
  render?: boolean;
  silent?: boolean;
}

export interface UnlockMeta {
  source: 'event' | 'number';
  eventName?: string;
}

// Collectibles data
export const COLLECTIBLES_DATA: CollectiblesData = {
  common: [
    {
      id: 'common-1',
      name: 'Basic Cube',
      description: 'A simple cube found in the wild',
      rarity: 'Common',
      event: 'first-game',
      unlocked: false,
      imagePath: '/images/collectibles/common-1.png'
    },
    {
      id: 'common-2',
      name: 'Shiny Cube',
      description: 'A cube that sparkles in the light',
      rarity: 'Common',
      event: 'score-100',
      unlocked: false,
      imagePath: '/images/collectibles/common-2.png'
    },
    {
      id: 'common-3',
      name: 'Colorful Cube',
      description: 'A cube with vibrant colors',
      rarity: 'Common',
      event: 'level-5',
      unlocked: false,
      imagePath: '/images/collectibles/common-3.png'
    },
    {
      id: 'common-4',
      name: 'Glowing Cube',
      description: 'A cube that glows softly',
      rarity: 'Common',
      event: 'combo-10',
      unlocked: false,
      imagePath: '/images/collectibles/common-4.png'
    },
    {
      id: 'common-5',
      name: 'Crystal Cube',
      description: 'A cube made of pure crystal',
      rarity: 'Common',
      event: 'wild-merge',
      unlocked: false,
      imagePath: '/images/collectibles/common-5.png'
    }
  ],
  legendary: [
    {
      id: 'legendary-1',
      name: 'Golden Cube',
      description: 'A cube made of pure gold',
      rarity: 'Legendary',
      event: 'score-1000',
      unlocked: false,
      imagePath: '/images/collectibles/legendary-1.png'
    },
    {
      id: 'legendary-2',
      name: 'Diamond Cube',
      description: 'A cube cut from a single diamond',
      rarity: 'Legendary',
      event: 'level-20',
      unlocked: false,
      imagePath: '/images/collectibles/legendary-2.png'
    },
    {
      id: 'legendary-3',
      name: 'Cosmic Cube',
      description: 'A cube from another dimension',
      rarity: 'Legendary',
      event: 'perfect-game',
      unlocked: false,
      imagePath: '/images/collectibles/legendary-3.png'
    },
    {
      id: 'legendary-4',
      name: 'Time Cube',
      description: 'A cube that exists outside of time',
      rarity: 'Legendary',
      event: 'speed-run',
      unlocked: false,
      imagePath: '/images/collectibles/legendary-4.png'
    },
    {
      id: 'legendary-5',
      name: 'Infinity Cube',
      description: 'A cube with infinite possibilities',
      rarity: 'Legendary',
      event: 'mastery',
      unlocked: false,
      imagePath: '/images/collectibles/legendary-5.png'
    }
  ]
};

// Event definitions
export const COLLECTIBLE_EVENTS = {
  'first-game': 'Play your first game',
  'score-100': 'Score 100 points',
  'score-500': 'Score 500 points',
  'score-1000': 'Score 1000 points',
  'level-5': 'Reach level 5',
  'level-10': 'Reach level 10',
  'level-20': 'Reach level 20',
  'combo-5': 'Get a 5x combo',
  'combo-10': 'Get a 10x combo',
  'combo-20': 'Get a 20x combo',
  'wild-merge': 'Merge with a wild cube',
  'perfect-game': 'Complete a game without mistakes',
  'speed-run': 'Complete a level in under 30 seconds',
  'mastery': 'Master all game mechanics'
};

// Rarity colors
export const RARITY_COLORS = {
  'Common': 0x888888,
  'Rare': 0x4CAF50,
  'Epic': 0x2196F3,
  'Legendary': 0xFF9800
};

// Rarity names
export const RARITY_NAMES = {
  'Common': 'Common',
  'Rare': 'Rare',
  'Epic': 'Epic',
  'Legendary': 'Legendary'
};

// Helper functions
export function getCollectibleById(id: string): CollectibleCard | null {
  const allCollectibles = [...COLLECTIBLES_DATA.common, ...COLLECTIBLES_DATA.legendary];
  return allCollectibles.find(card => card.id === id) || null;
}

export function getCollectiblesByRarity(rarity: string): CollectibleCard[] {
  const allCollectibles = [...COLLECTIBLES_DATA.common, ...COLLECTIBLES_DATA.legendary];
  return allCollectibles.filter(card => card.rarity === rarity);
}

export function getUnlockedCollectibles(): CollectibleCard[] {
  const allCollectibles = [...COLLECTIBLES_DATA.common, ...COLLECTIBLES_DATA.legendary];
  return allCollectibles.filter(card => card.unlocked);
}

export function getLockedCollectibles(): CollectibleCard[] {
  const allCollectibles = [...COLLECTIBLES_DATA.common, ...COLLECTIBLES_DATA.legendary];
  return allCollectibles.filter(card => !card.unlocked);
}

export function getCollectiblesByEvent(event: string): CollectibleCard[] {
  const allCollectibles = [...COLLECTIBLES_DATA.common, ...COLLECTIBLES_DATA.legendary];
  return allCollectibles.filter(card => card.event === event);
}

// All functions are already exported individually above
