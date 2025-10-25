// Game State Service - Centralized state management
import { eventBus, EVENTS } from '../core/event-bus.js';
import { logger } from '../core/logger.js';
import type { Container, Application } from 'pixi.js';

export type EventBusLike = Pick<typeof eventBus, 'on' | 'emit' | 'clear'>;
export type LoggerLike = Pick<typeof logger, 'info' | 'warn' | 'error'>;

// Deep equality check (replaces brittle JSON.stringify)
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return false;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (let key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

// Modern deep clone using structuredClone (browser native, handles Maps/Sets/circular refs)
// Fallback to JSON serialization for older browsers
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Use native structuredClone if available (Chrome 98+, Safari 15.4+, Firefox 94+)
  if (typeof structuredClone !== 'undefined') {
    try {
      return structuredClone(obj);
    } catch (error) {
      // Fallback for objects that can't be cloned (e.g., functions, symbols)
      logger.warn('structuredClone failed, using fallback:', String(error));
    }
  }

  // Fallback for older browsers or special cases
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

// Tile interface
export interface Tile {
  id: string;
  value: number;
  x: number;
  y: number;
  locked: boolean;
  special?: string;
  destroy?: (opts?: { children?: boolean }) => void;
}

export interface GameStateData {
  homepageReady: boolean;
  isGameActive: boolean;
  isPaused: boolean;
  score: number;
  highScore: number;
  level: number;
  moves: number;
  maxMoves: number;
  boardNumber: number;
  tiles: Tile[];
  board: Container | null;
  stage: Container | null;
  app: Application | null;
}

// Listener entry with metadata
interface ListenerEntry {
  callback: (value: unknown) => void;
  key: keyof GameStateData;
  id: string;
}

export class GameStateService {
  private state: GameStateData;
  private listeners: Map<string, ListenerEntry> = new Map();
  private listenerCounter: number = 0;
  private bus: EventBusLike;
  private log: LoggerLike;

  constructor(
    bus: EventBusLike = eventBus,
    log: LoggerLike = logger
  ) {
    this.bus = bus;
    this.log = log;
    this.state = {
      homepageReady: false,
      isGameActive: false,
      isPaused: false,
      score: 0,
      highScore: 0,
      level: 1,
      moves: 0,
      maxMoves: 10,
      boardNumber: 1,
      tiles: [],
      board: null,
      stage: null,
      app: null,
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.bus.on(EVENTS.GAME_START, () => {
      this.setState({ isGameActive: true, isPaused: false });
    });

    this.bus.on(EVENTS.GAME_PAUSE, () => {
      this.setState({ isPaused: true });
    });

    this.bus.on(EVENTS.GAME_RESUME, () => {
      this.setState({ isPaused: false });
    });

    this.bus.on(EVENTS.GAME_END, () => {
      this.setState({ isGameActive: false, isPaused: false });
    });

    this.bus.on(EVENTS.SCORE_UPDATE, (score: number) => {
      this.setState({ score });
      if (score > this.state.highScore) {
        this.setState({ highScore: score });
        this.bus.emit(EVENTS.SCORE_HIGH_SCORE, score);
      }
    });
  }

  getState(): GameStateData {
    return deepClone(this.state);
  }

  get<K extends keyof GameStateData>(key: K): GameStateData[K] {
    return deepClone(this.state[key]);
  }

  setState(updates: Partial<GameStateData>): void {
    if (!updates || Object.keys(updates).length === 0) {
      return;
    }

    const oldState = deepClone(this.state);
    const nextState = deepClone(this.state);
    const changedKeys: Array<keyof GameStateData> = [];

    (Object.keys(updates) as Array<keyof GameStateData>).forEach(key => {
      const incomingValue = updates[key];
      const clonedValue = deepClone(incomingValue as GameStateData[typeof key]);
      const hasChanged = !deepEqual(clonedValue, nextState[key]);

      if (hasChanged) {
        nextState[key] = clonedValue as GameStateData[typeof key];
        changedKeys.push(key);
      }
    });

    if (changedKeys.length === 0) {
      return;
    }

    this.state = nextState;

    // Only notify listeners of actual changes
    changedKeys.forEach(key => {
      this.notifyListeners(key, this.state[key]);
    });

    this.bus.emit('state:changed', deepClone(this.state), oldState);
  }

  set<K extends keyof GameStateData>(key: K, value: GameStateData[K]): void {
    this.setState({ [key]: value } as Partial<GameStateData>);
  }

  setMultiple(updates: Partial<GameStateData>): void {
    this.setState(updates);
  }

  subscribe<K extends keyof GameStateData>(
    key: K, 
    callback: (value: GameStateData[K]) => void
  ): () => void {
    // Unique listener ID to prevent collisions
    const listenerId = `listener_${this.listenerCounter++}_${Date.now()}_${Math.random()}`;
    
    const entry: ListenerEntry = {
      callback: callback as (value: unknown) => void,
      key,
      id: listenerId
    };
    
    this.listeners.set(listenerId, entry);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listenerId);
    };
  }

  private notifyListeners<K extends keyof GameStateData>(
    key: K, 
    value: GameStateData[K]
  ): void {
    // Only notify listeners subscribed to this specific key (no collision with startsWith)
    this.listeners.forEach((entry) => {
      if (entry.key === key) {
        try {
          entry.callback(value);
        } catch (error) {
          this.log.error(`Error in state listener for ${String(key)}:`, String(error));
        }
      }
    });
  }

  reset(): void {
    this.state = deepClone({
      homepageReady: false,
      isGameActive: false,
      isPaused: false,
      score: 0,
      highScore: this.state.highScore, // Keep high score
      level: 1,
      moves: 0,
      maxMoves: 10,
      boardNumber: 1,
      tiles: [],
      board: null,
      stage: null,
      app: null,
    });
    
    eventBus.emit('state:reset', deepClone(this.state));
  }

  destroy(): void {
    this.listeners.clear();
    this.bus.clear();
  }
}

export const gameStateService = new GameStateService();
