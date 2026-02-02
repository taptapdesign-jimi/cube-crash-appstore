// @ts-nocheck
// src/modules/board-specific-rules.ts
// Board-specific rules and modifications for different levels
// Modular system for controlling wild tile spawning, difficulty, and special mechanics per board

import { logger } from '../core/logger.js';

export interface BoardRule {
  boardNumber: number;
  
  // Wild tile settings
  wildSpawnEnabled?: boolean;
  allowedWildTypes?: ('wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt')[];
  wildMeterEnabled?: boolean; // If false, wild meter won't fill
  wildMeterFillRate?: number; // Multiplier for wild meter fill rate (default: 1.0)
  
  // Gameplay settings
  maxMoves?: number; // Override default MOVES_MAX for this board
  scoreMultiplier?: number; // Score multiplier for this board (default: 1.0)
  comboMultiplier?: number; // Combo multiplier for this board (default: 1.0)
  
  // Spawn settings
  spawnRate?: number; // Spawn rate modifier (default: 1.0)
  initialTiles?: number; // Number of initial tiles on board (default: normal)
  
  // Difficulty settings
  difficulty?: 'easy' | 'normal' | 'hard' | 'extreme';
  
  // Custom functions
  customSpawnLogic?: (boardNumber: number) => Promise<boolean>; // Custom spawn function
  onBoardStart?: (boardNumber: number) => void; // Called when board starts
  onBoardEnd?: (boardNumber: number) => void; // Called when board ends
}

// Board-specific rules configuration
const BOARD_RULES: BoardRule[] = [
  {
    boardNumber: 2,
    wildSpawnEnabled: true, // Enable wild spawning
    wildMeterEnabled: true, // Enable wild meter
    wildMeterFillRate: 1.0, // 🔥 USER REQUEST: Ista brzina kao board 1 (originalna brzina)
    allowedWildTypes: ['wild', 'wild-beer', 'wild-magnet', 'wild-tnt'] // Svi wild types dostupni
  },
  {
    boardNumber: 3,
    wildSpawnEnabled: true,
    wildMeterEnabled: true,
    allowedWildTypes: ['wild-beer'], // Only wild-beer allowed
    customSpawnLogic: async (boardNumber: number) => {
      // Custom logic for board 3 - only spawn wild-beer
      logger.info(`🎯 Board ${boardNumber}: Custom spawn logic - only wild-beer allowed`);
      return true; // Return true to use custom logic
    }
  }
];

class BoardSpecificRules {
  private rules: Map<number, BoardRule> = new Map();
  private currentBoard: number = 1;

  constructor() {
    // Load all rules into map for fast lookup
    BOARD_RULES.forEach(rule => {
      this.rules.set(rule.boardNumber, rule);
    });
    logger.info('🎯 Board-specific rules loaded:', Array.from(this.rules.keys()));
  }

  /**
   * Set current board number
   */
  setCurrentBoard(boardNumber: number): void {
    this.currentBoard = boardNumber;
    logger.info(`🎯 Board-specific rules: Current board set to ${boardNumber}`);
  }

  /**
   * Get rule for current board
   */
  getCurrentRule(): BoardRule | null {
    return this.rules.get(this.currentBoard) || null;
  }

  /**
   * Get rule for specific board
   */
  getRule(boardNumber: number): BoardRule | null {
    return this.rules.get(boardNumber) || null;
  }

  /**
   * Check if wild spawning is enabled for current board
   */
  isWildSpawnEnabled(boardNumber?: number): boolean {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    
    if (!rule) {
      // Default: wild spawning enabled
      return true;
    }
    
    return rule.wildSpawnEnabled !== false;
  }

  /**
   * Check if wild meter is enabled for current board
   */
  isWildMeterEnabled(boardNumber?: number): boolean {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    
    if (!rule) {
      // Default: wild meter enabled
      return true;
    }
    
    return rule.wildMeterEnabled !== false;
  }

  /**
   * Get allowed wild types for current board
   */
  getAllowedWildTypes(boardNumber?: number): ('wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt')[] {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    
    if (!rule || !rule.allowedWildTypes) {
      // Default: all wild types allowed (including wild-tnt from Explosion Pack)
      return ['wild', 'wild-beer', 'wild-magnet', 'wild-tnt'];
    }
    
    return rule.allowedWildTypes;
  }

  /**
   * Check if specific wild type is allowed for current board
   */
  isWildTypeAllowed(wildType: 'wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt', boardNumber?: number): boolean {
    const allowed = this.getAllowedWildTypes(boardNumber);
    return allowed.includes(wildType);
  }

  /**
   * Filter wild type based on board rules
   * Returns the allowed wild type or null if not allowed
   */
  filterWildType(
    preferredType: 'wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt',
    boardNumber?: number
  ): 'wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt' | null {
    const board = boardNumber ?? this.currentBoard;
    const allowed = this.getAllowedWildTypes(board);
    
    // If preferred type is allowed, use it
    if (allowed.includes(preferredType)) {
      return preferredType;
    }
    
    // If no allowed types, return null (should not spawn)
    if (allowed.length === 0) {
      return null;
    }
    
    // Return first allowed type as fallback
    return allowed[0];
  }

  /**
   * Get custom spawn logic for current board
   */
  getCustomSpawnLogic(boardNumber?: number): ((boardNumber: number) => Promise<boolean>) | null {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    return rule?.customSpawnLogic || null;
  }

  /**
   * Add or update a board rule
   */
  addRule(rule: BoardRule): void {
    this.rules.set(rule.boardNumber, rule);
    logger.info(`🎯 Board-specific rules: Rule added/updated for board ${rule.boardNumber}`);
  }

  /**
   * Remove a board rule (revert to default)
   */
  removeRule(boardNumber: number): void {
    this.rules.delete(boardNumber);
    logger.info(`🎯 Board-specific rules: Rule removed for board ${boardNumber}`);
  }

  /**
   * Get all configured board numbers
   */
  getConfiguredBoards(): number[] {
    return Array.from(this.rules.keys()).sort((a, b) => a - b);
  }

  /**
   * Get max moves for current board (or default if not set)
   */
  getMaxMoves(boardNumber?: number, defaultMoves: number = 50): number {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    return rule?.maxMoves ?? defaultMoves;
  }

  /**
   * Get score multiplier for current board
   */
  getScoreMultiplier(boardNumber?: number): number {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    return rule?.scoreMultiplier ?? 1.0;
  }

  /**
   * Get combo multiplier for current board
   */
  getComboMultiplier(boardNumber?: number): number {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    return rule?.comboMultiplier ?? 1.0;
  }

  /**
   * Get wild meter fill rate multiplier for current board
   */
  getWildMeterFillRate(boardNumber?: number): number {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    return rule?.wildMeterFillRate ?? 1.0;
  }

  /**
   * Get spawn rate modifier for current board
   */
  getSpawnRate(boardNumber?: number): number {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    return rule?.spawnRate ?? 1.0;
  }

  /**
   * Get difficulty for current board
   */
  getDifficulty(boardNumber?: number): 'easy' | 'normal' | 'hard' | 'extreme' {
    const board = boardNumber ?? this.currentBoard;
    const rule = this.rules.get(board);
    return rule?.difficulty ?? 'normal';
  }

  /**
   * Call onBoardStart callback if exists
   */
  triggerOnBoardStart(boardNumber: number): void {
    const rule = this.rules.get(boardNumber);
    if (rule?.onBoardStart) {
      try {
        rule.onBoardStart(boardNumber);
        logger.info(`🎯 Board ${boardNumber}: onBoardStart callback executed`);
      } catch (error) {
        logger.error(`❌ Board ${boardNumber}: onBoardStart callback failed:`, error);
      }
    }
  }

  /**
   * Call onBoardEnd callback if exists
   */
  triggerOnBoardEnd(boardNumber: number): void {
    const rule = this.rules.get(boardNumber);
    if (rule?.onBoardEnd) {
      try {
        rule.onBoardEnd(boardNumber);
        logger.info(`🎯 Board ${boardNumber}: onBoardEnd callback executed`);
      } catch (error) {
        logger.error(`❌ Board ${boardNumber}: onBoardEnd callback failed:`, error);
      }
    }
  }
}

// Export singleton instance
export const boardSpecificRules = new BoardSpecificRules();

// Export helper functions for easy access
export function isWildSpawnEnabled(boardNumber?: number): boolean {
  return boardSpecificRules.isWildSpawnEnabled(boardNumber);
}

export function isWildMeterEnabled(boardNumber?: number): boolean {
  return boardSpecificRules.isWildMeterEnabled(boardNumber);
}

export function getAllowedWildTypes(boardNumber?: number): ('wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt')[] {
  return boardSpecificRules.getAllowedWildTypes(boardNumber);
}

export function isWildTypeAllowed(wildType: 'wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt', boardNumber?: number): boolean {
  return boardSpecificRules.isWildTypeAllowed(wildType, boardNumber);
}

export function filterWildType(
  preferredType: 'wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt',
  boardNumber?: number
): 'wild' | 'wild-beer' | 'wild-magnet' | 'wild-tnt' | null {
  return boardSpecificRules.filterWildType(preferredType, boardNumber);
}

export function getWildMeterFillRate(boardNumber?: number): number {
  return boardSpecificRules.getWildMeterFillRate(boardNumber);
}

