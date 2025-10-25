// Board Service - Centralized board management
import { eventBus, EVENTS } from '../core/event-bus.js';
import { logger } from '../core/logger.js';
import type { Container } from 'pixi.js';

export interface TileData {
  id: string;
  value: number;
  x: number;
  y: number;
  locked: boolean;
  special?: string;
}

export interface PIXITile {
  id: string;
  value: number;
  x: number;
  y: number;
  locked: boolean;
  special?: string;
  destroy?: () => void;
  update?: () => void;
}

export interface BoardServiceInterface {
  createTile(tileData: TileData): PIXITile;
  destroyTile(tileId: string): void;
  mergeTiles(tile1Id: string, tile2Id: string): void;
  spawnTile(tileData: TileData): void;
  updateBoard(): void;
  getTiles(): TileData[];
  getTile(tileId: string): TileData | null;
}

class BoardService implements BoardServiceInterface {
  private tiles: Map<string, TileData> = new Map();
  private board: Container | null = null;
  private stage: Container | null = null;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.on(EVENTS.BOARD_TILE_MERGE, (tile1Id: string, tile2Id: string) => {
      this.mergeTiles(tile1Id, tile2Id);
    });

    eventBus.on(EVENTS.BOARD_TILE_DESTROY, (tileId: string) => {
      this.destroyTile(tileId);
    });

    eventBus.on(EVENTS.BOARD_UPDATE, () => {
      this.updateBoard();
    });
  }

  init(board: Container, stage: Container): void {
    this.board = board;
    this.stage = stage;
    logger.info('✅ Board Service initialized');
  }

  setBoard(board: Container): void {
    this.board = board;
  }

  setStage(stage: Container): void {
    this.stage = stage;
  }

  createTile(tileData: TileData): PIXITile {
    if (!this.board || !this.stage) {
      throw new Error('Board Service not initialized');
    }

    try {
      // Create tile using PIXI.js
      const tile = this.createPIXITile(tileData);
      
      // Store tile data
      this.tiles.set(tileData.id, tileData);
      
      // Add to board
      this.board.addChild(tile);
      
      // Emit event
      eventBus.emit(EVENTS.BOARD_TILE_SPAWN, tileData);
      
      return tile;
    } catch (error) {
      logger.error('❌ Failed to create tile:', String(error));
      throw error;
    }
  }

  private createPIXITile(tileData: TileData): PIXITile {
    // This would create actual PIXI.js tile
    // For now, return a mock object
    return {
      id: tileData.id,
      value: tileData.value,
      x: tileData.x,
      y: tileData.y,
      locked: tileData.locked,
      special: tileData.special,
      destroy: () => {
        this.tiles.delete(tileData.id);
      },
    };
  }

  destroyTile(tileId: string): void {
    const tileData = this.tiles.get(tileId);
    if (!tileData) return;

    try {
      // Find and destroy PIXI tile
      const tile = this.findPIXITile(tileId);
      if (tile && tile.destroy) {
        tile.destroy();
      }

      // Remove from tiles map
      this.tiles.delete(tileId);
      
      // Emit event
      eventBus.emit(EVENTS.BOARD_TILE_DESTROY, tileId);
    } catch (error) {
      logger.error('❌ Failed to destroy tile:', String(error));
    }
  }

  private findPIXITile(tileId: string): PIXITile | null {
    // This would find the actual PIXI tile
    // For now, return null
    return null;
  }

  mergeTiles(tile1Id: string, tile2Id: string): void {
    const tile1 = this.tiles.get(tile1Id);
    const tile2 = this.tiles.get(tile2Id);
    
    if (!tile1 || !tile2) return;

    try {
      // Perform merge logic
      const mergedValue = tile1.value + tile2.value;
      const mergedTile: TileData = {
        id: `${tile1Id}_${tile2Id}_${Date.now()}`,
        value: mergedValue,
        x: (tile1.x + tile2.x) / 2,
        y: (tile1.y + tile2.y) / 2,
        locked: false,
      };

      // Destroy original tiles
      this.destroyTile(tile1Id);
      this.destroyTile(tile2Id);

      // Create merged tile
      this.createTile(mergedTile);
      
      // Emit event
      eventBus.emit(EVENTS.BOARD_TILE_MERGE, tile1Id, tile2Id, mergedTile);
    } catch (error) {
      logger.error('❌ Failed to merge tiles:', String(error));
    }
  }

  spawnTile(tileData: TileData): void {
    this.createTile(tileData);
  }

  updateBoard(): void {
    if (!this.board) return;

    try {
      // Update board display
      this.board.children.forEach((child) => {
        if ('update' in child && typeof child.update === 'function') {
          (child as PIXITile).update!();
        }
      });
      
      // Emit event
      eventBus.emit(EVENTS.BOARD_UPDATE);
    } catch (error) {
      logger.error('❌ Failed to update board:', String(error));
    }
  }

  getTiles(): TileData[] {
    return Array.from(this.tiles.values());
  }

  getTile(tileId: string): TileData | null {
    return this.tiles.get(tileId) || null;
  }

  destroy(): void {
    this.tiles.clear();
    this.board = null;
    this.stage = null;
    eventBus.clear();
  }
}

export const boardService = new BoardService();
