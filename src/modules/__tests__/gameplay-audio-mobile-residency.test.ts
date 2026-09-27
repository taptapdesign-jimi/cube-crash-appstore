import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getDecodedGameplayAudioStats,
  getDecodedGameplaySoundsState,
  playDecodedGameplaySound,
  preloadDecodedGameplaySounds,
  releaseIdleDecodedGameplayAudio,
  resetDecodedGameplayAudioForTests,
  stopDecodedGameplayVoice,
} from '../gameplay-audio-buffer-player';
import {
  JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE,
} from '../journey-forest-gameplay-sound';
import { ORDINARY_STACK_SOUND_SOURCE, preloadOrdinaryStackSound } from '../ordinary-stack-sound';
import { JOURNEY_FOREST_AMBIENT_SOUND_SOURCES } from '../journey-forest-ambient-sound';
import { preloadBarrelMerge6Sounds } from '../barrel-merge6-sound';
import { preloadFlowerMerge6Sounds } from '../flower-merge6-sound';
import { preloadRegularMerge6Sounds, REGULAR_MERGE6_SOUND_SOURCE, REGULAR_MERGE6_CRASH_SOUND_SOURCE, REGULAR_MERGE6_BOOM_SOUND_SOURCE, REGULAR_MERGE6_STACK_SOUND_SOURCE } from '../regular-merge6-sound';
import { playWildStarMerge6Sound, preloadWildStarMerge6Sound, stopWildStarMerge6Sound, WILD_STAR_MERGE6_SOUND_SOURCE, WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE, WILD_STAR_MERGE6_STAR1_SOUND_SOURCE, WILD_STAR_MERGE6_STAR2_SOUND_SOURCE, WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE } from '../wild-star-merge6-sound';
import { HONEY_FIRST_MERGE_SOUND_SOURCES, HONEY_PULL_MERGE_SOUND_SOURCES, HONEY_POST_MERGE_SOUND_SOURCES, playHoneyFirstMergeSounds, playHoneyPullMergeSounds, playHoneyPostMergeSounds, preloadHoneyMerge6Sounds, stopHoneyMerge6Sounds } from '../honey-merge6-sound';
import { ARCADE_ROUND_FIRST_DIGIT_SOUND_SOURCE, ARCADE_ROUND_SECOND_DIGIT_SOUND_SOURCE, ARCADE_ROUND_EXIT_SOUND_SOURCE, playArcadeRoundDigitSound, playArcadeRoundExitSound, playBoardTransitionDigitSound, playBoardTransitionExitSound, preloadArcadeRoundDigitSounds, preloadBoardTransitionDigitSounds, stopArcadeRoundDigitSounds, stopBoardTransitionDigitSounds } from '../arcade-round-digit-sound';
import { preloadGameplayPickupSound } from '../gameplay-pickup-sound';
import { preloadWildSpecialMerge6PoofSounds } from '../wild-special-merge6-poof-sound';
import { preloadNoMovesSound } from '../no-moves-sound';
import { preloadWildSpecialLandingSound } from '../wild-special-landing-sound';
import { preloadEligibleSpecialSounds } from '../special-sound-warmup';
import { preloadCleanBoardSounds } from '../clean-board-sound';
import { preloadJourneyBackpackSounds } from '../journey-backpack-sound';
import { preloadJourneyCardEntryFlipSounds } from '../journey-card-entry-flip-sound';
import { preloadCtaActivationSounds } from '../cta-activation-sound';
import { SPECIAL_DICE_VARIANTS } from '../special-dice-registry';
import { drainGameplayAudioDiagnostics, resetGameplayAudioDiagnosticsForTests, withGameplayAudioDiagnosticCaller } from '../gameplay-audio-diagnostics';
import { getThermalAudioIsolationStats, resetThermalAudioIsolationForTests, setThermalAudioSuppressed } from '../../utils/thermal-audio-isolation';

jest.mock('../thermal-gameplay-audio-cleanup', () => ({ stopThermalGameplayAudioFallbacks: jest.fn(async () => {}) }));

jest.mock('../mobile-runtime-profile', () => ({ MOBILE_RUNTIME_PROFILE: { isMobileDevice: true } }));

const MiB = 1024 * 1024;
const metadataCache = new Map<string, { duration: number; channels: number }>();
function readAudioMetadata(source: string): { duration: number; channels: number } {
  const cached = metadataCache.get(source);
  if (cached) return cached;
  const bytes = fs.readFileSync(path.resolve(process.cwd(), source));
  if (source.endsWith('.mp3')) {
    // Read actual MPEG Layer III frames, including encoder padding. This is a
    // conservative encoded-frame duration; no platform media command is needed.
    let offset = bytes.toString('ascii', 0, 3) === 'ID3'
      ? 10 + ((bytes[6] & 127) << 21) + ((bytes[7] & 127) << 14) + ((bytes[8] & 127) << 7) + (bytes[9] & 127)
      : 0;
    let duration = 0;
    let channels = 0;
    while (offset + 4 <= bytes.length) {
      const version = (bytes[offset + 1] >> 3) & 3;
      const layer = (bytes[offset + 1] >> 1) & 3;
      const rateIndex = (bytes[offset + 2] >> 2) & 3;
      const bitrateIndex = bytes[offset + 2] >> 4;
      if (bytes[offset] !== 255 || (bytes[offset + 1] & 224) !== 224
        || version === 1 || layer !== 1 || rateIndex === 3 || bitrateIndex === 0 || bitrateIndex === 15) {
        offset++;
        continue;
      }
      const rate = [44100, 48000, 32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
      const bitrate = (version === 3
        ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
        : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[bitrateIndex] * 1000;
      const frameBytes = Math.floor((version === 3 ? 144 : 72) * bitrate / rate) + ((bytes[offset + 2] >> 1) & 1);
      if (offset + frameBytes > bytes.length) break;
      duration += (version === 3 ? 1152 : 576) / rate;
      channels = bytes[offset + 3] >> 6 === 3 ? 1 : 2;
      offset += frameBytes;
    }
    if (!duration || !channels) throw new Error(`Invalid MP3: ${source}`);
    const metadata = { duration, channels };
    metadataCache.set(source, metadata);
    return metadata;
  }
  let channels = 0;
  let sampleRate = 0;
  let blockAlign = 0;
  let dataBytes = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const tag = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (tag === 'fmt ') {
      channels = bytes.readUInt16LE(offset + 10);
      sampleRate = bytes.readUInt32LE(offset + 12);
      blockAlign = bytes.readUInt16LE(offset + 20);
    }
    if (tag === 'data') dataBytes = size;
    offset += 8 + size + size % 2;
  }
  if (!channels || !sampleRate || !blockAlign || !dataBytes) throw new Error(`Invalid WAV: ${source}`);
  const metadata = { duration: dataBytes / blockAlign / sampleRate, channels };
  metadataCache.set(source, metadata);
  return metadata;
}

class AudioParamMock {
  value = 1;
  setValueAtTime = jest.fn();
  cancelScheduledValues = jest.fn();
  linearRampToValueAtTime = jest.fn();
}

class AudioContextMock {
  static sampleRate = 48000;
  static instances: AudioContextMock[] = [];
  static syntheticBytes = new Map<string, number>();
  readonly sampleRate = AudioContextMock.sampleRate;
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {};
  sources: Array<{ stop: jest.Mock; start: jest.Mock; onended: (() => void) | null }> = [];
  resume = jest.fn(async () => {});
  close = jest.fn(async () => {});
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  decodeAudioData = jest.fn(async (input: ArrayBuffer) => {
    const source = (input as unknown as { source: string }).source;
    const synthetic = AudioContextMock.syntheticBytes.get(source);
    if (synthetic) return { length: synthetic / 8, numberOfChannels: 2, duration: synthetic / 8 / this.sampleRate };
    const metadata = readAudioMetadata(source);
    return { length: Math.ceil(metadata.duration * this.sampleRate), numberOfChannels: metadata.channels, duration: metadata.duration };
  });
  constructor() { AudioContextMock.instances.push(this); }
  createGain() { return { gain: new AudioParamMock(), connect: jest.fn(), disconnect: jest.fn() }; }
  createBufferSource() {
    const source = { playbackRate: new AudioParamMock(), connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(), onended: null };
    this.sources.push(source);
    return source;
  }
}

async function flush(): Promise<void> {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

// Exercise the general decoded-cache long-loop policy directly. Production
// mobile Journey ambience uses media; its transport contract has its own suite.
function preloadDecodedForestFixture(_context?: unknown): boolean {
  return preloadDecodedGameplaySounds([JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE], { loop: true });
}
function playDecodedForestFixture(_context?: unknown): boolean {
  return playDecodedGameplaySound(JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE, { voiceId: 'forest-fixture', volume: 0.54, loop: true }) !== 'unavailable';
}
function stopDecodedForestFixture(): void {
  stopDecodedGameplayVoice('forest-fixture');
}

const playbackCases = [
  ...[WILD_STAR_MERGE6_SOUND_SOURCE, WILD_STAR_MERGE6_ALTERNATE_SOUND_SOURCE, WILD_STAR_MERGE6_STAR1_SOUND_SOURCE, WILD_STAR_MERGE6_STAR2_SOUND_SOURCE].map((source, index) => ({
    name: `Star variant ${index + 1}`, prepare: preloadWildStarMerge6Sound,
    play: () => { jest.spyOn(Math, 'random').mockReturnValue(index / 4); return playWildStarMerge6Sound(); },
    stop: stopWildStarMerge6Sound,
    expected: [REGULAR_MERGE6_SOUND_SOURCE, REGULAR_MERGE6_CRASH_SOUND_SOURCE, REGULAR_MERGE6_BOOM_SOUND_SOURCE, REGULAR_MERGE6_STACK_SOUND_SOURCE, source, WILD_STAR_MERGE6_SPARKLE_SOUND_SOURCE],
  })),
  ...[
    { name: 'Honey first merge', play: playHoneyFirstMergeSounds, expected: HONEY_FIRST_MERGE_SOUND_SOURCES },
    { name: 'Honey pull merge', play: playHoneyPullMergeSounds, expected: HONEY_PULL_MERGE_SOUND_SOURCES },
    { name: 'Honey finale', play: playHoneyPostMergeSounds, expected: HONEY_POST_MERGE_SOUND_SOURCES },
  ].map(testCase => ({ ...testCase, prepare: preloadHoneyMerge6Sounds, stop: stopHoneyMerge6Sounds })),
  ...[
    { name: 'Arcade', digit: playArcadeRoundDigitSound, exit: playArcadeRoundExitSound, prepare: preloadArcadeRoundDigitSounds, stop: stopArcadeRoundDigitSounds },
    { name: 'Journey transition', digit: playBoardTransitionDigitSound, exit: playBoardTransitionExitSound, prepare: preloadBoardTransitionDigitSounds, stop: stopBoardTransitionDigitSounds },
  ].flatMap(owner => [
    { name: `${owner.name} first digit`, play: () => owner.digit(0), expected: [ARCADE_ROUND_FIRST_DIGIT_SOUND_SOURCE] },
    { name: `${owner.name} second digit`, play: () => owner.digit(1), expected: [ARCADE_ROUND_SECOND_DIGIT_SOUND_SOURCE] },
    { name: `${owner.name} exit`, play: owner.exit, expected: [ARCADE_ROUND_EXIT_SOUND_SOURCE] },
  ].map(testCase => ({ ...testCase, prepare: owner.prepare, stop: owner.stop }))),
];

describe('mobile decoded audio residency with authored audio metadata', () => {
  const originalContext = window.AudioContext;
  const originalFetch = global.fetch;
  beforeEach(() => {
    resetThermalAudioIsolationForTests();
    resetGameplayAudioDiagnosticsForTests();
    delete (window as any).__ccPerformanceDiagnostics;
    delete (window as any).__ccThermalIsolation;
    resetDecodedGameplayAudioForTests();
    AudioContextMock.instances = [];
    AudioContextMock.sampleRate = 48000;
    AudioContextMock.syntheticBytes.clear();
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock });
    (window as any)._settings = { gameSoundsEnabled: true };
    global.fetch = jest.fn(async (input) => ({
      ok: true,
      arrayBuffer: async () => ({ source: `.${decodeURIComponent(new URL(String(input)).pathname)}` }),
    })) as jest.Mock;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    resetThermalAudioIsolationForTests();
    delete (window as any).__ccPerformanceDiagnostics;
    delete (window as any).__ccThermalIsolation;
    resetDecodedGameplayAudioForTests();
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalContext });
    global.fetch = originalFetch;
    delete (window as any)._settings;
  });

  test.each(playbackCases)('$name redecodes only the selected cues after pressure and reuses them on repeat', async ({ prepare, play, stop, expected }) => {
    expect(prepare()).toBe(true);
    await flush();
    releaseIdleDecodedGameplayAudio();
    expect(getDecodedGameplayAudioStats().decodedBuffers).toBe(0);
    const context = AudioContextMock.instances[0];
    context.decodeAudioData.mockClear();
    (global.fetch as jest.Mock).mockClear();

    for (let repeat = 0; repeat < 3; repeat++) {
      expect(play()).toBe(true);
      await flush();
      stop();
    }

    const fetched = (global.fetch as jest.Mock).mock.calls.map(([input]) => `.${decodeURIComponent(new URL(String(input)).pathname)}`);
    expect(fetched.sort()).toEqual(expected.map(source => decodeURIComponent(source)).sort());
    expect(context.decodeAudioData).toHaveBeenCalledTimes(expected.length);
    expect(getDecodedGameplayAudioStats()).toMatchObject({ redecodedBuffers: expected.length, activeVoices: 0, pendingVoiceStarts: 0 });
  });

  test.each([44100, 48000])('retains the actual Forest loop and repeated ordinary SFX across seven retries at %i Hz', async (sampleRate) => {
    AudioContextMock.sampleRate = sampleRate;
    const forest = { boardNumber: 3, isArcade: false };
    expect(preloadDecodedForestFixture(forest)).toBe(true);
    preloadDecodedGameplaySounds([ORDINARY_STACK_SOUND_SOURCE]);
    await flush();
    const before = getDecodedGameplayAudioStats();
    expect(before.decodedBuffers).toBe(2);
    expect(before.effectBudgetBytes).toBe(16 * MiB);
    expect(before.residentLoopBytes).toBeGreaterThan(29 * MiB);
    expect(before.residentLoopBytes).toBeLessThan(33 * MiB);
    const loopMetadata = readAudioMetadata(JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE);
    expect(before.residentLoopBytes).toBe(Math.ceil(loopMetadata.duration * sampleRate) * loopMetadata.channels * 4);
    expect(before.sampleRate).toBe(sampleRate);
    for (let retry = 0; retry < 7; retry++) {
      preloadDecodedForestFixture(forest);
      expect(playDecodedForestFixture(forest)).toBe(true);
      for (let merge = 0; merge < 5; merge++) {
        expect(playDecodedGameplaySound(ORDINARY_STACK_SOUND_SOURCE, { voiceId: 'ordinary', volume: 0.4 })).toBe('played');
        stopDecodedGameplayVoice('ordinary');
      }
      stopDecodedForestFixture();
      await flush();
    }
    expect(AudioContextMock.instances).toHaveLength(1);
    expect(AudioContextMock.instances[0].decodeAudioData).toHaveBeenCalledTimes(2);
    expect(getDecodedGameplayAudioStats()).toMatchObject({ evictedBuffers: 0, redecodedBuffers: 0, activeVoices: 0 });
  });

  test.each([
    { family: 'Barrel', preloadFamily: preloadBarrelMerge6Sounds, sampleRate: 44100 },
    { family: 'Barrel', preloadFamily: preloadBarrelMerge6Sounds, sampleRate: 48000 },
    { family: 'Flower', preloadFamily: preloadFlowerMerge6Sounds, sampleRate: 44100 },
    { family: 'Flower', preloadFamily: preloadFlowerMerge6Sounds, sampleRate: 48000 },
  ])('retains the complete $family package plus ordinary board cues beside Forest at $sampleRate Hz', async ({ preloadFamily, sampleRate }) => {
    AudioContextMock.sampleRate = sampleRate;
    const forest = { boardNumber: 3, isArcade: false };
    const prepareEffects = (): void => {
      expect(preloadFamily()).toBe(true);
      preloadRegularMerge6Sounds();
      preloadOrdinaryStackSound();
      preloadGameplayPickupSound();
      preloadWildSpecialMerge6PoofSounds();
      preloadNoMovesSound();
      preloadWildSpecialLandingSound();
    };
    preloadDecodedForestFixture(forest);
    prepareEffects();
    await flush();
    const sources = (global.fetch as jest.Mock).mock.calls.map(([input]) => `.${decodeURIComponent(new URL(String(input)).pathname)}`);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources.length).toBeGreaterThan(20);
    const prepared = getDecodedGameplayAudioStats();
    expect(prepared.decodedBuffers).toBe(sources.length);
    expect(prepared.decodedBytes - prepared.residentLoopBytes).toBeLessThan(16 * MiB);
    expect(prepared.evictedBuffers).toBe(0);
    for (let retry = 0; retry < 5; retry++) {
      preloadDecodedForestFixture(forest);
      prepareEffects();
      expect(playDecodedForestFixture(forest)).toBe(true);
      // Exercise every source admitted by the real feature preload owners.
      // Voice timing/mixing stays covered by each feature's authored-cue tests.
      const effects = sources.filter((source) => source !== JOURNEY_FOREST_GAMEPLAY_SOUND_SOURCE);
      effects.forEach((source, index) => {
        expect(playDecodedGameplaySound(source, { voiceId: `package-${index}`, volume: 0.4 })).toBe('played');
      });
      effects.forEach((_, index) => { stopDecodedGameplayVoice(`package-${index}`); });
      stopDecodedForestFixture();
      await flush();
    }
    expect(AudioContextMock.instances).toHaveLength(1);
    expect(AudioContextMock.instances[0].decodeAudioData).toHaveBeenCalledTimes(sources.length);
    expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: sources.length, evictedBuffers: 0, redecodedBuffers: 0, activeVoices: 0 });
  });

  test('does not reserve a loop of 24 MiB or less after the effects reserve changes', async () => {
    AudioContextMock.syntheticBytes.set('./medium-loop.wav', 24 * MiB);
    preloadDecodedGameplaySounds(['./medium-loop.wav'], { loop: true });
    await flush();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ residentLoopBytes: 0, effectBudgetBytes: 32 * MiB, decodedBytes: 24 * MiB });
  });

  const beachFamilies = [
    { family: 'Star', tile: { special: 'wild' } },
    { family: 'Fish', tile: { special: 'wild', _ccSpecialDiceVariant: 'fish' } },
    { family: 'Ball', tile: { special: 'wild-tnt', _ccSpecialDiceVariant: 'beach-ball' } },
    { family: 'Bottle', tile: { special: 'wild-magnet', _ccSpecialDiceVariant: 'bottle' } },
    { family: 'Juice', tile: { special: 'wild-juice' } },
  ];
  const prepareBeachCommonAndResult = (): void => {
    preloadRegularMerge6Sounds();
    preloadOrdinaryStackSound();
    preloadGameplayPickupSound();
    preloadWildSpecialMerge6PoofSounds();
    preloadNoMovesSound();
    preloadWildSpecialLandingSound();
    preloadBoardTransitionDigitSounds();
    preloadJourneyBackpackSounds();
    preloadJourneyCardEntryFlipSounds();
    preloadCtaActivationSounds();
    preloadCleanBoardSounds();
  };

  test.each(beachFamilies.flatMap(owner => [44100, 48000].map(sampleRate => ({ ...owner, sampleRate }))))(
    'reuses the full Beach $family family with common and Clean Board cues at $sampleRate Hz',
    async ({ tile, sampleRate }) => {
      AudioContextMock.sampleRate = sampleRate;
      const prepare = (): void => {
        prepareBeachCommonAndResult();
        preloadEligibleSpecialSounds({ boardNumber: 12, isArcade: false, tiles: [tile] });
      };
      prepare();
      await flush();
      // Keep URL escaping for playback/state queries: authored Star filenames
      // contain a literal #, which is only decoded when reading asset bytes.
      const sources = (global.fetch as jest.Mock).mock.calls.map(([input]) => String(input));
      expect(sources.length).toBeGreaterThan(20);
      expect(new Set(sources).size).toBe(sources.length);
      expect(getDecodedGameplayAudioStats().decodedBytes).toBeLessThan(32 * MiB);
      for (let visit = 0; visit < 4; visit++) {
        prepare();
        expect(getDecodedGameplaySoundsState(sources)).toBe('ready');
        await flush();
      }
      expect(AudioContextMock.instances[0].decodeAudioData).toHaveBeenCalledTimes(sources.length);
      expect(getDecodedGameplayAudioStats()).toMatchObject({
        decodedBuffers: sources.length, evictedBuffers: 0, redecodedBuffers: 0,
        activeVoices: 0, pendingBuffers: 0, residentLoopBytes: 0,
      });
    },
  );

  test.each([44100, 48000])('bounds an accumulated five-family Beach and result working set at %s Hz', async sampleRate => {
    AudioContextMock.sampleRate = sampleRate;
    prepareBeachCommonAndResult();
    await flush();
    for (const { tile } of beachFamilies) {
      preloadEligibleSpecialSounds({ boardNumber: 12, isArcade: false, tiles: [tile] });
      await flush();
    }
    const sources = new Set<string>((global.fetch as jest.Mock).mock.calls.map(([input]) => `.${decodeURIComponent(new URL(String(input)).pathname)}`));
    const fullSetBytes = [...sources].reduce((sum, source) => {
      const metadata = readAudioMetadata(source);
      return sum + Math.ceil(metadata.duration * sampleRate) * metadata.channels * 4;
    }, 0);
    // These legitimately requested packages exceed the fixed budget. Eviction
    // counts alone must not be treated as proof of duplicate or wrong-family
    // preparation, nor "fixed" by retaining every family without a bound.
    expect(fullSetBytes).toBeGreaterThan(32 * MiB);
    expect(getDecodedGameplayAudioStats().evictedBuffers).toBeGreaterThan(0);
    expect(getDecodedGameplayAudioStats().decodedBytes).toBeLessThanOrEqual(32 * MiB);
    expect(getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: 0, pendingBuffers: 0, failedBuffers: 0 });
  });

  test('preparing a partly resident package keeps its existing members ahead of unrelated older data', async () => {
    for (const [source, bytes] of [['./a.wav', 6 * MiB], ['./other-family.wav', 24 * MiB], ['./b.wav', 6 * MiB]] as const) AudioContextMock.syntheticBytes.set(source, bytes);
    preloadDecodedGameplaySounds(['./a.wav']); await flush();
    preloadDecodedGameplaySounds(['./other-family.wav']); await flush();
    preloadDecodedGameplaySounds(['./a.wav', './b.wav']); await flush();
    expect(getDecodedGameplaySoundsState(['./a.wav', './b.wav'])).toBe('ready');
    expect(AudioContextMock.instances[0].decodeAudioData).toHaveBeenCalledTimes(3);
    expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBytes: 12 * MiB, redecodedBuffers: 0, evictedBuffers: 1 });
  });

  test('opt-in real cache events identify source, scoped caller, decode bytes/time and pressure eviction', async () => {
    (window as any).__ccPerformanceDiagnostics = true;
    withGameplayAudioDiagnosticCaller('entry-special', () => preloadDecodedGameplaySounds([ORDINARY_STACK_SOUND_SOURCE]));
    await flush();
    preloadDecodedGameplaySounds([ORDINARY_STACK_SOUND_SOURCE]);
    releaseIdleDecodedGameplayAudio();
    const trace = drainGameplayAudioDiagnostics({ includeEvents: true })!;
    expect(trace.summary).toMatchObject({ requests: 2, misses: 1, hits: 1, decodes: 1, evictions: 1 });
    expect(trace.events.find(event => event.kind === 'decode-complete')).toMatchObject({
      source: expect.stringContaining('/wood.wav'), bytes: expect.any(Number), decodeMs: expect.any(Number), request: { caller: 'entry-special' },
    });
    expect(trace.events.find(event => event.kind === 'evict')).toMatchObject({ reason: 'os-pressure', lastUseSequence: expect.any(Number), lastUseAtMs: expect.any(Number) });
  });

  test('diagnostic isolation gates before context, fetch and fallback; disabling waits for an ordinary request', async () => {
    (window as any).__ccThermalIsolation = true;
    expect(setThermalAudioSuppressed(true)).toBe(true);
    const stopped = jest.fn();
    expect(preloadDecodedForestFixture({ boardNumber: 3, isArcade: false })).toBe(true);
    expect(getDecodedGameplaySoundsState([ORDINARY_STACK_SOUND_SOURCE])).toBe('ready');
    expect(playDecodedGameplaySound(ORDINARY_STACK_SOUND_SOURCE, { voiceId: 'silent', volume: 1, onStopped: stopped })).toBe('played');
    expect(stopped).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(AudioContextMock.instances).toHaveLength(0);
    expect(getThermalAudioIsolationStats()).toMatchObject({ isolationEnabled: true, suppressed: { 'sfx-preload': 1, 'sfx-state': 1, 'sfx-play': 1 } });
    setThermalAudioSuppressed(false);
    await flush();
    expect(AudioContextMock.instances).toHaveLength(0);
    preloadDecodedGameplaySounds([ORDINARY_STACK_SOUND_SOURCE]); await flush();
    expect(AudioContextMock.instances).toHaveLength(1);
  });

  test('isolation retires active voices and refuses decode after an old fetch completes', async () => {
    (window as any).__ccThermalIsolation = true;
    playDecodedGameplaySound(ORDINARY_STACK_SOUND_SOURCE, { voiceId: 'active', volume: 1 }); await flush();
    let finishFetch!: () => void;
    (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishFetch = () => resolve({ ok: true, arrayBuffer: async () => ({ source: './late.wav' }) }); }));
    preloadDecodedGameplaySounds(['./late.wav']);
    const context = AudioContextMock.instances[0];
    setThermalAudioSuppressed(true);
    expect(context.sources[0].stop).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledTimes(1);
    finishFetch(); await flush();
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 0, activeVoices: 0, pendingVoiceStarts: 0, isolationPendingLoads: 0, isolationPendingDecodes: 0 });
  });

  test('an already started decoder is reported draining and its late result cannot repopulate or play', async () => {
    (window as any).__ccThermalIsolation = true;
    (window as any).__ccPerformanceDiagnostics = true;
    preloadDecodedGameplaySounds([]);
    const context = AudioContextMock.instances[0];
    let finishDecode!: () => void;
    context.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => {
      finishDecode = () => resolve({ length: 48000, numberOfChannels: 2, duration: 1 });
    }));
    playDecodedGameplaySound('./pending.wav', { voiceId: 'pending', volume: 1 });
    await flush();
    setThermalAudioSuppressed(true);
    expect(getDecodedGameplayAudioStats()).toMatchObject({ isolationPendingLoads: 1, isolationPendingDecodes: 1, pendingVoiceStarts: 0 });
    finishDecode(); await flush();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ isolationPendingLoads: 0, isolationPendingDecodes: 0, decodedBuffers: 0, activeVoices: 0 });
    expect(context.sources).toHaveLength(0);
    expect(drainGameplayAudioDiagnostics()!.summary).toMatchObject({ discardedDecodes: 1 });
  });

  test('all authored families share one effects budget and cannot stop the active Forest loop under pressure', async () => {
    playDecodedForestFixture({ boardNumber: 3, isArcade: false });
    await flush();
    for (const [id, variant] of Object.entries(SPECIAL_DICE_VARIANTS)) {
      preloadEligibleSpecialSounds({ boardNumber: 12, isArcade: false, tiles: [{ special: variant.archetype, _ccSpecialDiceVariant: id }] });
      await flush();
      const stats = getDecodedGameplayAudioStats();
      expect(stats.activeVoices).toBe(1);
      expect(stats.decodedBytes - stats.residentLoopBytes).toBeLessThanOrEqual(16 * MiB);
      expect(stats.pendingBuffers).toBe(0);
      expect(stats.failedBuffers).toBe(0);
    }
    expect(getDecodedGameplayAudioStats().evictedBuffers).toBeGreaterThan(0);
    expect(AudioContextMock.instances[0].sources[0].stop).not.toHaveBeenCalled();
    expect(AudioContextMock.instances).toHaveLength(1);
  });

  test('retains one bounded large loop and LRU effects without raising the ordinary mobile ceiling', async () => {
    AudioContextMock.syntheticBytes.set('./loop-a.wav', 33 * MiB);
    AudioContextMock.syntheticBytes.set('./loop-b.wav', 34 * MiB);
    AudioContextMock.syntheticBytes.set('./effect-a.wav', 9 * MiB);
    AudioContextMock.syntheticBytes.set('./effect-b.wav', 9 * MiB);
    preloadDecodedGameplaySounds(['./loop-a.wav'], { loop: true });
    await flush();
    preloadDecodedGameplaySounds(['./effect-a.wav']);
    await flush();
    preloadDecodedGameplaySounds(['./effect-b.wav']);
    await flush();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ budgetBytes: 32 * MiB, residentLoopBytes: 33 * MiB, decodedBytes: 42 * MiB, decodedBuffers: 2 });
    playDecodedGameplaySound('./loop-b.wav', { voiceId: 'next-loop', volume: 1, loop: true });
    await flush();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ residentLoopBytes: 34 * MiB, decodedBytes: 43 * MiB, decodedBuffers: 2 });
    expect(getDecodedGameplaySoundsState(['./effect-b.wav'])).toBe('ready');
  });

  test('does not admit an arbitrary oversized preload or give non-loop effects the reserved slot', async () => {
    AudioContextMock.syntheticBytes.set('./too-large.wav', 37 * MiB);
    AudioContextMock.syntheticBytes.set('./large-effect.wav', 33 * MiB);
    preloadDecodedGameplaySounds(['./too-large.wav'], { loop: true });
    preloadDecodedGameplaySounds(['./large-effect.wav']);
    await flush();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBytes: 0, budgetBytes: 32 * MiB, residentLoopBytes: 0 });
  });

  test('keeps an outgoing loop fade alive, then returns to 32 MiB when another ambient surface owns playback', async () => {
    const forest = { boardNumber: 3, isArcade: false };
    playDecodedForestFixture(forest);
    await flush();
    playDecodedGameplaySound(JOURNEY_FOREST_AMBIENT_SOUND_SOURCES[0], { voiceId: 'world', volume: 0.4, loop: true });
    await flush();
    expect(AudioContextMock.instances[0].sources[0].stop).not.toHaveBeenCalled();
    expect(getDecodedGameplayAudioStats().activeVoices).toBe(2);
    stopDecodedForestFixture();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ activeVoices: 1, residentLoopBytes: 0, effectBudgetBytes: 32 * MiB });
    expect(getDecodedGameplayAudioStats().decodedBytes).toBeLessThan(32 * MiB);
  });

  test('late superseded loop preparation cannot repopulate the reserved slot on another surface', async () => {
    preloadDecodedGameplaySounds([]);
    const context = AudioContextMock.instances[0];
    const decode = context.decodeAudioData.getMockImplementation()!;
    let finishForest!: () => void;
    context.decodeAudioData.mockImplementationOnce((input) => new Promise((resolve) => {
      finishForest = () => { void decode(input).then(resolve); };
    }));
    preloadDecodedForestFixture({ boardNumber: 3, isArcade: false });
    await flush();
    playDecodedGameplaySound(JOURNEY_FOREST_AMBIENT_SOUND_SOURCES[0], { voiceId: 'world', volume: 0.4, loop: true });
    await flush();
    finishForest();
    await flush();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 1, activeVoices: 1, residentLoopBytes: 0 });
  });

  test('OS pressure still evicts idle effects and the stopped long loop without stopping an active voice', async () => {
    playDecodedForestFixture({ boardNumber: 3, isArcade: false });
    preloadDecodedGameplaySounds([ORDINARY_STACK_SOUND_SOURCE]);
    await flush();
    releaseIdleDecodedGameplayAudio();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 1, activeVoices: 1 });
    expect(AudioContextMock.instances[0].sources[0].stop).not.toHaveBeenCalled();
    stopDecodedForestFixture();
    releaseIdleDecodedGameplayAudio();
    expect(getDecodedGameplayAudioStats()).toMatchObject({ decodedBuffers: 0, decodedBytes: 0, activeVoices: 0, residentLoopBytes: 0 });
  });

  test('normal next-board Continue preserves reusable audio while the native pressure boundary remains wired', () => {
    const endgame = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/endgame-flow.ts'), 'utf8');
    const cleanup = endgame.split('async function performPreNextBoardCleanup(')[1].split('\nasync function ')[0];
    expect(cleanup).not.toContain('releaseIdleDecodedGameplayAudio');
    const main = fs.readFileSync(path.resolve(process.cwd(), 'src/main.ts'), 'utf8');
    expect(main).toContain('releaseIdleDecodedGameplayAudio();');
  });
});
