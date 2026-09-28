import { gsap } from 'gsap';
import {
  createJourneyUnitMotionSoundSession, JOURNEY_UNIT_ENTER_SOUND_SOURCE, JOURNEY_UNIT_EXIT_SOUND_SOURCE, JOURNEY_UNIT_MOTION_SOUND_SOURCES,
  preloadJourneyUnitMotionSounds, stopJourneyUnitMotionSounds,
} from '../journey-unit-motion-sound';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices } from '../gameplay-audio-buffer-player';
import { JourneyWorldAnimationCoordinator } from '../journey-world-animation-coordinator';

jest.mock('../gameplay-audio-buffer-player', () => ({
  playDecodedGameplaySound: jest.fn(), preloadDecodedGameplaySounds: jest.fn(), stopDecodedGameplayVoices: jest.fn(),
}));

function unit(id: string, top = 100) {
  const target = document.createElement('div');
  document.body.append(target);
  jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    x: 50, y: top, top, bottom: top + 100, left: 50, right: 150, width: 100, height: 100,
    toJSON: () => ({}),
  });
  return { id, targets: [target], clouds: [] };
}

beforeEach(() => {
  (window as any)._settings = { gameSoundsEnabled: true };
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  jest.mocked(playDecodedGameplaySound).mockReturnValue('played');
  jest.mocked(preloadDecodedGameplaySounds).mockReturnValue(true);
});
afterEach(() => {
  stopJourneyUnitMotionSounds();
  document.body.innerHTML = '';
  delete (window as any)._settings;
  delete (document as any).hidden;
  gsap.ticker.sleep();
});

test('enter uses only elements down1 while exit uses only elemens down2', () => {
  expect(preloadJourneyUnitMotionSounds()).toBe(true);
  expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(JOURNEY_UNIT_MOTION_SOUND_SOURCES);
  const sound = createJourneyUnitMotionSoundSession([unit('visible'), unit('offscreen', 5000)]);
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
  sound.playEnter('visible', 0.56);
  sound.playEnter('visible', 0.56);
  sound.playEnter('offscreen', 0.56);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source)).toEqual([JOURNEY_UNIT_ENTER_SOUND_SOURCE]);
  sound.playExit('visible', 0.56);
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source)).toEqual([
    JOURNEY_UNIT_ENTER_SOUND_SOURCE,
    JOURNEY_UNIT_EXIT_SOUND_SOURCE,
  ]);
  for (const [, options] of jest.mocked(playDecodedGameplaySound).mock.calls) {
    expect(options).toMatchObject({ volume: 0.3, stopAfterSeconds: 0.56, fadeOutSeconds: 0.05 });
  }
});

test.each(['pending', 'unavailable'] as const)('replacement and idempotent stop retire all layers during %s decode', result => {
  jest.mocked(playDecodedGameplaySound).mockReturnValue(result);
  const first = createJourneyUnitMotionSoundSession([unit('a')]);
  first.playExit('a', 0.56);
  const second = createJourneyUnitMotionSoundSession([unit('b')]);
  jest.mocked(stopDecodedGameplayVoices).mockClear();
  first.stop(); first.playExit('a', 0.56);
  expect(stopDecodedGameplayVoices).not.toHaveBeenCalled();
  second.playExit('b', 0.56);
  jest.mocked(stopDecodedGameplayVoices).mockClear();
  second.stop(); second.stop();
  expect(stopDecodedGameplayVoices).toHaveBeenCalledTimes(1);
  expect(jest.mocked(stopDecodedGameplayVoices).mock.calls[0][0]).toHaveLength(6);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(2);
});

test('overlapping Units reuse only three complete layer groups', () => {
  const units = Array.from({ length: 5 }, (_, i) => unit(String(i)));
  const sound = createJourneyUnitMotionSoundSession(units);
  units.forEach(entry => sound.playExit(entry.id, 0.56));
  const calls = jest.mocked(playDecodedGameplaySound).mock.calls;
  expect(calls).toHaveLength(1);
  expect(calls[0][0]).toBe(JOURNEY_UNIT_EXIT_SOUND_SOURCE);
});

test('a complete World or Unit cascade emits only one enter and one exit cue', () => {
  const units = Array.from({ length: 4 }, (_, i) => unit(String(i)));
  const sound = createJourneyUnitMotionSoundSession(units);
  units.forEach(entry => sound.playEnter(entry.id, 0.56));
  units.forEach(entry => sound.playExit(entry.id, 0.56));
  expect(jest.mocked(playDecodedGameplaySound).mock.calls.map(([source]) => source)).toEqual([
    JOURNEY_UNIT_ENTER_SOUND_SOURCE,
    JOURNEY_UNIT_EXIT_SOUND_SOURCE,
  ]);
});

test('Sounds OFF ON OFF invalidates queued contacts without replay', () => {
  const sound = createJourneyUnitMotionSoundSession([unit('a'), unit('b')]);
  sound.playEnter('a', 0.56);
  (window as any)._settings.gameSoundsEnabled = false;
  stopJourneyUnitMotionSounds();
  jest.mocked(playDecodedGameplaySound).mockClear();
  jest.mocked(preloadDecodedGameplaySounds).mockClear();
  expect(preloadJourneyUnitMotionSounds()).toBe(false);
  (window as any)._settings.gameSoundsEnabled = true;
  sound.playEnter('b', 0.56);
  (window as any)._settings.gameSoundsEnabled = false;
  stopJourneyUnitMotionSounds();
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
  expect(preloadDecodedGameplaySounds).not.toHaveBeenCalled();
});

test.each(['visibilitychange', 'pagehide'])('%s cancels even a not-yet-started cascade and removes its listeners', event => {
  const removeDocument = jest.spyOn(document, 'removeEventListener');
  const removeWindow = jest.spyOn(window, 'removeEventListener');
  const sound = createJourneyUnitMotionSoundSession([unit('a')]);
  if (event === 'visibilitychange') {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event(event));
  } else window.dispatchEvent(new Event(event));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  sound.playEnter('a', 0.56);
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
  expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function), undefined);
  expect(removeWindow).toHaveBeenCalledWith('pagehide', expect.any(Function), undefined);
});

test.each([false, true])('actual World coordinator emits layers at enter and exit ticks with reduced motion=%s', async reduced => {
  gsap.ticker.sleep();
  jest.spyOn(gsap.ticker, 'add').mockImplementation(callback => callback);
  const coordinator = new JourneyWorldAnimationCoordinator();
  const units = [unit('board-1')];
  const timeline = () => (coordinator as unknown as { activeTimeline: gsap.core.Timeline }).activeTimeline;
  const enter = coordinator.enter(units, reduced);
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
  timeline().pause().progress(0.5);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(JOURNEY_UNIT_ENTER_SOUND_SOURCE, expect.any(Object));
  timeline().progress(1); await enter;
  jest.mocked(playDecodedGameplaySound).mockClear();
  const exit = coordinator.exit(units, reduced);
  expect(playDecodedGameplaySound).not.toHaveBeenCalled();
  timeline().pause().progress(0.5);
  expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
  expect(playDecodedGameplaySound).toHaveBeenCalledWith(JOURNEY_UNIT_EXIT_SOUND_SOURCE, expect.any(Object));
  timeline().progress(1); await exit;
  coordinator.stop(true);
});
