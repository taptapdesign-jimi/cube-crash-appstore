// Event Bus for loose coupling between modules
export type EventCallback = (...args: any[]) => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) return;
    
    const callbacks = this.events.get(event)!;
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events.has(event)) return;
    
    const callbacks = this.events.get(event)!;
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event callback for ${event}:`, error);
      }
    });
  }

  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  clear(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  getEventNames(): string[] {
    return Array.from(this.events.keys());
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Event types for type safety
export const EVENTS = {
  // Game state events
  GAME_START: 'game:start',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  GAME_END: 'game:end',
  GAME_RESTART: 'game:restart',
  
  // UI events
  UI_SHOW_HOMEPAGE: 'ui:show:homepage',
  UI_HIDE_HOMEPAGE: 'ui:hide:homepage',
  UI_SHOW_LOADING: 'ui:show:loading',
  UI_HIDE_LOADING: 'ui:hide:loading',
  UI_SHOW_MODAL: 'ui:show:modal',
  UI_HIDE_MODAL: 'ui:hide:modal',
  
  // Board events
  BOARD_UPDATE: 'board:update',
  BOARD_TILE_MERGE: 'board:tile:merge',
  BOARD_TILE_SPAWN: 'board:tile:spawn',
  BOARD_TILE_DESTROY: 'board:tile:destroy',
  
  // Score events
  SCORE_UPDATE: 'score:update',
  SCORE_HIGH_SCORE: 'score:high_score',
  
  // Slider events
  SLIDER_CHANGE: 'slider:change',
  SLIDER_NEXT: 'slider:next',
  SLIDER_PREV: 'slider:prev',
  
  // Asset events
  ASSET_LOADED: 'asset:loaded',
  ASSET_ERROR: 'asset:error',
  
  // Error events
  ERROR_OCCURRED: 'error:occurred',
  ERROR_RECOVERED: 'error:recovered',
} as const;

export type EventType = typeof EVENTS[keyof typeof EVENTS];
