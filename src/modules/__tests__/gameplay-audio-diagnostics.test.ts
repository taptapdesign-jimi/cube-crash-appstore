import {
  captureGameplayAudioDiagnosticRequest, drainGameplayAudioDiagnostics,
  gameplayAudioDiagnosticNow, recordGameplayAudioDiagnostic,
  resetGameplayAudioDiagnosticsForTests, setGameplayAudioDiagnosticContextProvider,
  withGameplayAudioDiagnosticCaller,
} from '../gameplay-audio-diagnostics';

const detail = { kind: 'request' as const, source: './test.wav', operation: 'preload' as const, result: 'hit' as const, activeVoices: 0, pendingVoices: 0, pendingLoads: 0 };

afterEach(() => {
  delete (window as any).__ccPerformanceDiagnostics;
  resetGameplayAudioDiagnosticsForTests();
  jest.restoreAllMocks();
});

test('normal production collects nothing and never reads time or route context', () => {
  const provider = jest.fn();
  const clock = jest.spyOn(performance, 'now');
  setGameplayAudioDiagnosticContextProvider(provider);
  expect(captureGameplayAudioDiagnosticRequest('test')).toBeNull();
  expect(gameplayAudioDiagnosticNow()).toBeNull();
  recordGameplayAudioDiagnostic(detail);
  expect(withGameplayAudioDiagnosticCaller('test', () => 42)).toBe(42);
  expect(drainGameplayAudioDiagnostics()).toBeNull();
  expect(clock).not.toHaveBeenCalled();
  expect(provider).not.toHaveBeenCalled();
});

test('ring retains latest 256 records in order, reports overflow and preserves cumulative summary after drain', () => {
  (window as any).__ccPerformanceDiagnostics = true;
  for (let index = 0; index < 300; index++) recordGameplayAudioDiagnostic({ ...detail, source: `./${index}.wav` });
  const result = drainGameplayAudioDiagnostics({ includeEvents: true })!;
  expect(result).toMatchObject({ capacity: 256, overwritten: 44, overwrittenSinceDrain: 44, sequence: 300, summary: { requests: 300, hits: 300 } });
  expect(result.events).toHaveLength(256);
  expect(result.events[0]).toMatchObject({ sequence: 45, source: './44.wav' });
  expect(result.events[255]).toMatchObject({ sequence: 300, source: './299.wav' });
  expect(drainGameplayAudioDiagnostics({ includeEvents: true })).toMatchObject({ overwritten: 44, overwrittenSinceDrain: 0, events: [], summary: { requests: 300 } });
});

test('async events retain the requesting route/generation alongside the current route, and scopes restore after exceptions', () => {
  (window as any).__ccPerformanceDiagnostics = true;
  let boardNumber = 16;
  setGameplayAudioDiagnosticContextProvider(() => ({ route: 'board-journey', boardNumber, entryGeneration: boardNumber, runGeneration: 4 }));
  const request = withGameplayAudioDiagnosticCaller('drop-special', () => captureGameplayAudioDiagnosticRequest('preload'));
  boardNumber = 25;
  recordGameplayAudioDiagnostic({ ...detail, kind: 'decode-complete', bytes: 512, decodeMs: 12 }, request);
  expect(drainGameplayAudioDiagnostics({ includeEvents: true })!.events[0]).toMatchObject({
    context: { boardNumber: 25 }, request: { caller: 'drop-special', context: { boardNumber: 16, entryGeneration: 16 } },
  });
  expect(() => withGameplayAudioDiagnosticCaller('throws', () => { throw Error('expected'); })).toThrow();
  expect(captureGameplayAudioDiagnosticRequest('voice:ordinary')?.caller).toBe('voice:ordinary');
});

test('compact drain clears the ring and reports its size without native event payloads', () => {
  (window as any).__ccPerformanceDiagnostics = true;
  recordGameplayAudioDiagnostic(detail);
  recordGameplayAudioDiagnostic({ ...detail, source: './second.wav' });

  const compact = drainGameplayAudioDiagnostics()!;
  expect(compact).toMatchObject({ drainedEventCount: 2, sequence: 2, summary: { requests: 2 } });
  expect(compact).not.toHaveProperty('events');
  expect(drainGameplayAudioDiagnostics()).toMatchObject({ drainedEventCount: 0, sequence: 2 });
});

test('compact drain retains bounded per-source decode and eviction attribution, then clears the delta', () => {
  (window as any).__ccPerformanceDiagnostics = true;
  recordGameplayAudioDiagnostic({ ...detail, source: './hot.wav', result: 'miss' });
  recordGameplayAudioDiagnostic({ ...detail, kind: 'decode-complete', source: './hot.wav', bytes: 4096, decodeMs: 7 });
  recordGameplayAudioDiagnostic({ ...detail, kind: 'evict', source: './hot.wav', reason: 'budget', bytes: 4096 });
  for (let index = 0; index < 20; index++) {
    recordGameplayAudioDiagnostic({ ...detail, source: `./cold-${index}.wav`, result: 'miss' });
  }

  const compact = drainGameplayAudioDiagnostics()!;
  expect(compact.hotSources).toHaveLength(12);
  expect(compact.hotSources[0]).toMatchObject({
    source: './hot.wav', requests: 1, misses: 1, decodes: 1,
    decodedBytes: 4096, decodeWallMs: 7, evictions: 1, evictedBytes: 4096,
  });
  expect(compact.evictionsByReason).toEqual({
    budget: 1,
    'os-pressure': 0,
    'loop-replaced': 0,
    'transition-idle-release': 0,
  });
  expect(drainGameplayAudioDiagnostics()).toMatchObject({
    hotSources: [],
    evictionsByReason: {
      budget: 0,
      'os-pressure': 0,
      'loop-replaced': 0,
      'transition-idle-release': 0,
    },
  });
});
