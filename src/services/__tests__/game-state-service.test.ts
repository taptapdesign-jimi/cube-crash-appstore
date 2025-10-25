import { GameStateService } from '../game-state-service.js';
import type { EventBusLike, LoggerLike } from '../game-state-service.js';

type MockBus = EventBusLike & {
  on: jest.Mock;
  emit: jest.Mock;
  clear: jest.Mock;
};

type MockLogger = LoggerLike & {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

const createMockBus = (): MockBus => ({
  on: jest.fn(),
  emit: jest.fn(),
  clear: jest.fn(),
});

const createMockLogger = (): MockLogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createService = (): {
  service: GameStateService;
  bus: MockBus;
  logger: MockLogger;
} => {
  const bus = createMockBus();
  const logger = createMockLogger();
  const service = new GameStateService(bus, logger);
  return { service, bus, logger };
};

describe('GameStateService', () => {
  it('notifies subscribers only when a value actually changes', () => {
    const { service } = createService();
    const handler = jest.fn();
    service.subscribe('score', handler);

    service.setState({ score: 10 });
    service.setState({ score: 10 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith(10);
  });

  it('emits global state changes when updates occur', () => {
    const { service, bus } = createService();

    service.setState({ score: 42 });

    expect(bus.emit).toHaveBeenCalledWith(
      'state:changed',
      expect.objectContaining({ score: 42 }),
      expect.objectContaining({ score: 0 })
    );
  });

  it('returns defensive copies from getState and get', () => {
    const { service } = createService();

    const snapshot = service.getState();
    snapshot.score = 9999;

    expect(service.get('score')).toBe(0);

    const tiles = [
      { id: '1', value: 2, x: 0, y: 0, locked: false },
    ];
    service.setState({ tiles });
    tiles[0].value = 8;

    const storedTiles = service.get('tiles');
    expect(storedTiles[0].value).toBe(2);
  });

  it('supports unsubscribing from updates', () => {
    const { service } = createService();
    const handler = jest.fn();
    const unsubscribe = service.subscribe('moves', handler);

    unsubscribe();
    service.setState({ moves: 3 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('reset keeps high score but clears volatile state', () => {
    const { service } = createService();
    service.setState({ score: 120, highScore: 500, moves: 7, isGameActive: true });

    service.reset();

    expect(service.get('highScore')).toBe(500);
    expect(service.get('score')).toBe(0);
    expect(service.get('moves')).toBe(0);
    expect(service.get('isGameActive')).toBe(false);
  });
});
