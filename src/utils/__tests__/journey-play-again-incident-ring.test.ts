import {
  beginJourneyPlayAgainIncidentCycle,
  dumpJourneyPlayAgainIncidentRing,
  JOURNEY_PLAY_AGAIN_INCIDENT_RING_MAX_ENTRIES,
  recordJourneyPlayAgainIncident,
  resetJourneyPlayAgainIncidentRingForTests,
} from '../journey-play-again-incident-ring';

describe('Journey Play Again incident ring', () => {
  beforeEach(() => {
    resetJourneyPlayAgainIncidentRingForTests();
    document.body.innerHTML = '<canvas></canvas><div class="clean-board-overlay"></div>';
    (window as any).STATE = {
      boardNumber: 2,
      tiles: [{ destroyed: false }, { destroyed: true }],
      grid: [[{ destroyed: false }, { destroyed: true }]],
      board: { visible: true, children: [1, 2] },
      stage: { visible: true, children: [1, 2, 3] },
      app: { ticker: { started: true, count: 4 } },
    };
    (window as any).CC = {};
  });

  afterEach(() => {
    delete (window as any).STATE;
    delete (window as any).CC;
  });

  test('persists lifecycle state and increments cycles', () => {
    expect(beginJourneyPlayAgainIncidentCycle({ boardId: 2 })).toBe(1);
    recordJourneyPlayAgainIncident('after-cleanup');
    expect(beginJourneyPlayAgainIncidentCycle({ boardId: 2 })).toBe(2);

    const entries = dumpJourneyPlayAgainIncidentRing();
    expect(entries.map((entry) => entry.cycle)).toEqual([1, 1, 2]);
    expect(entries[0].state).toMatchObject({
      boardNumber: 2,
      tiles: { total: 2, alive: 1, destroyed: 1, unique: 2 },
      grid: { occupied: 2, unique: 2, destroyedRefs: 1 },
      board: { children: 2 },
      stage: { children: 3 },
      pixiTicker: { started: true, count: 4 },
      overlays: 1,
      canvases: 1,
    });
  });

  test('retains only the bounded newest entries', () => {
    for (let index = 0; index < JOURNEY_PLAY_AGAIN_INCIDENT_RING_MAX_ENTRIES + 7; index += 1) {
      recordJourneyPlayAgainIncident(`phase-${index}`);
    }
    const entries = dumpJourneyPlayAgainIncidentRing();
    expect(entries).toHaveLength(JOURNEY_PLAY_AGAIN_INCIDENT_RING_MAX_ENTRIES);
    expect(entries[0].phase).toBe('phase-7');
  });

  test('never throws when storage is unavailable', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordJourneyPlayAgainIncident('storage-failure')).not.toThrow();
    setItem.mockRestore();
  });
});
