import { createNativeHomeHubFeedback, stopNativeHomeHubFeedback } from '../native-home-hub-feedback';
import { playCtaActivationSounds, stopCtaActivationSounds } from '../cta-activation-sound';
import { playNavigationIconSounds, stopNavigationIconSounds } from '../navigation-icon-sound';
import { playNavigationCloseSound, stopNavigationCloseSound } from '../navigation-close-sound';
import { playHomepageSliderSwipeSound, stopHomepageSliderSwipeSound } from '../homepage-slider-swipe-sound';
import { playHomepageSliderEnterSound, playHomepageSliderExitSound, stopHomepageSliderMotionSounds } from '../homepage-slider-motion-sound';
import { playJourneyWorldsHubSound, stopJourneyWorldsHubSound } from '../journey-worlds-hub-sound';
import { createJourneyHubExitSoundSession } from '../journey-hub-exit-sound';

jest.mock('../cta-activation-sound', () => ({ playCtaActivationSounds: jest.fn(), stopCtaActivationSounds: jest.fn() }));
jest.mock('../navigation-icon-sound', () => ({ playNavigationIconSounds: jest.fn(), stopNavigationIconSounds: jest.fn() }));
jest.mock('../navigation-close-sound', () => ({ playNavigationCloseSound: jest.fn(), stopNavigationCloseSound: jest.fn() }));
jest.mock('../homepage-slider-swipe-sound', () => ({ playHomepageSliderSwipeSound: jest.fn(), stopHomepageSliderSwipeSound: jest.fn() }));
jest.mock('../homepage-slider-motion-sound', () => ({ playHomepageSliderEnterSound: jest.fn(), playHomepageSliderExitSound: jest.fn(), stopHomepageSliderMotionSounds: jest.fn() }));
jest.mock('../journey-worlds-hub-sound', () => ({ playJourneyWorldsHubSound: jest.fn(), stopJourneyWorldsHubSound: jest.fn() }));
jest.mock('../journey-hub-exit-sound', () => ({ createJourneyHubExitSoundSession: jest.fn() }));
const plays = [playCtaActivationSounds, playNavigationIconSounds, playNavigationCloseSound, playHomepageSliderSwipeSound, playHomepageSliderEnterSound, playHomepageSliderExitSound, playJourneyWorldsHubSound, createJourneyHubExitSoundSession];
const stops = [stopCtaActivationSounds, stopNavigationIconSounds, stopNavigationCloseSound, stopHomepageSliderSwipeSound, stopHomepageSliderMotionSounds, stopJourneyWorldsHubSound];
let exit: { play: jest.Mock; stop: jest.Mock };
beforeEach(() => {
  stopNativeHomeHubFeedback(); jest.clearAllMocks();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  (window as any)._settings = { gameSoundsEnabled: true, hapticsEnabled: true };
  window.triggerHapticImpact = jest.fn();
  exit = { play: jest.fn(), stop: jest.fn() };
  (createJourneyHubExitSoundSession as jest.Mock).mockReturnValue(exit);
});
afterEach(() => { stopNativeHomeHubFeedback(); delete (window as any)._settings; delete window.triggerHapticImpact; });

test('factory performs no playback/preload; disabled adapter neither plays nor stops an existing native lease', () => {
  const live = createNativeHomeHubFeedback(true);
  plays.forEach(play => expect(play).not.toHaveBeenCalled());
  live.pressCTA(1, 'native-only');
  jest.clearAllMocks();
  const disabled = createNativeHomeHubFeedback(false);
  expect(disabled.pressCTA(2, 'native-only')).toBe(false);
  disabled.stop(); disabled.dispose(); disabled.releaseToWeb();
  plays.forEach(play => expect(play).not.toHaveBeenCalled());
  stops.forEach(stop => expect(stop).not.toHaveBeenCalled());
  expect(live.pressCTA(3, 'native-only')).toBe(true);
});

test.each(['native-only', 'web-home-source', 'web-hub-source'] as const)('CTA policy %s preserves cue/haptic ownership without duplicate web feedback', policy => {
  const adapter = createNativeHomeHubFeedback(true);
  expect(adapter.pressCTA(1, policy)).toBe(true);
  expect(adapter.pressCTA(1, policy)).toBe(false);
  expect(playCtaActivationSounds).toHaveBeenCalledTimes(policy === 'web-hub-source' ? 0 : 1);
  expect(window.triggerHapticImpact).toHaveBeenCalledTimes(policy === 'native-only' ? 1 : 0);
});

test('tab, swipe and Back keep separate authored cues; web Home tab delegates its haptic', () => {
  const adapter = createNativeHomeHubFeedback(true);
  adapter.pressTab(1, 'native-only'); adapter.pressSwipe(1); adapter.pressBack(1);
  adapter.pressTab(2, 'web-home-source');
  expect(playNavigationIconSounds).toHaveBeenCalledTimes(2);
  expect(playHomepageSliderSwipeSound).toHaveBeenCalledTimes(1);
  expect(playNavigationCloseSound).toHaveBeenCalledTimes(1);
  expect(playCtaActivationSounds).not.toHaveBeenCalled();
  expect(window.triggerHapticImpact).toHaveBeenCalledTimes(2);
});

test('finite Home motion uses exact duration and Hub owns existing ambience/exit session', () => {
  const adapter = createNativeHomeHubFeedback(true);
  expect(adapter.homeMotion(1, 'enter', 0.56)).toBe(true);
  expect(adapter.homeMotion(1, 'enter', 0.56)).toBe(false);
  expect(adapter.homeMotion(1, 'exit', 0.43)).toBe(true);
  expect(playHomepageSliderEnterSound).toHaveBeenCalledWith(0.56);
  expect(playHomepageSliderExitSound).toHaveBeenCalledWith(0.43);
  adapter.hubAmbience(1); adapter.hubAmbience(1);
  adapter.hubExit(1); adapter.hubExit(1);
  expect(playJourneyWorldsHubSound).toHaveBeenCalledTimes(1);
  expect(createJourneyHubExitSoundSession).toHaveBeenCalledTimes(1);
  expect(exit.play).toHaveBeenCalledTimes(1);
  adapter.stop(); adapter.stop(); adapter.dispose();
  expect(stopHomepageSliderMotionSounds).toHaveBeenCalledTimes(1);
  expect(stopJourneyWorldsHubSound).toHaveBeenCalledTimes(1);
  expect(exit.stop).toHaveBeenCalledTimes(1);
});

test('Sounds and Haptics gates are independent and ON cannot replay a consumed event', () => {
  const adapter = createNativeHomeHubFeedback(true);
  (window as any)._settings.gameSoundsEnabled = false;
  adapter.pressCTA(1, 'native-only'); adapter.hubAmbience(1); adapter.hubExit(1);
  plays.forEach(play => expect(play).not.toHaveBeenCalled());
  expect(window.triggerHapticImpact).toHaveBeenCalledTimes(1);
  (window as any)._settings = { gameSoundsEnabled: true, hapticsEnabled: false };
  expect(adapter.pressCTA(1, 'native-only')).toBe(false);
  adapter.pressCTA(2, 'native-only');
  expect(playCtaActivationSounds).toHaveBeenCalledTimes(1);
  expect(window.triggerHapticImpact).toHaveBeenCalledTimes(1);
  stopNativeHomeHubFeedback();
  expect(adapter.pressCTA(3, 'native-only')).toBe(false);
});

test('background/invalid callbacks cannot play; stop rejects all late callbacks', () => {
  const adapter = createNativeHomeHubFeedback(true);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  expect(adapter.pressCTA(1, 'native-only')).toBe(false);
  expect(adapter.hubAmbience(1)).toBe(false);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  expect(adapter.homeMotion(1, 'enter', Infinity)).toBe(false);
  expect(adapter.homeMotion(1, 'enter', 0)).toBe(false);
  expect(adapter.pressCTA(NaN, 'native-only')).toBe(false);
  adapter.stop();
  expect(adapter.pressSwipe(2)).toBe(false);
  plays.forEach(play => expect(play).not.toHaveBeenCalled());
});

test('releaseToWeb and old disposal cannot stop newly claimed canonical voices', () => {
  const adapter = createNativeHomeHubFeedback(true);
  adapter.pressCTA(1, 'web-home-source'); adapter.homeMotion(1, 'exit', 0.5); adapter.hubAmbience(1); adapter.hubExit(1);
  adapter.releaseToWeb();
  // Existing web owner acquires the same family after the explicit transfer.
  playCtaActivationSounds(); playJourneyWorldsHubSound();
  adapter.stop(); adapter.dispose(); stopNativeHomeHubFeedback();
  stops.forEach(stop => expect(stop).not.toHaveBeenCalled());
  expect(exit.stop).not.toHaveBeenCalled();
  expect(adapter.hubExit(2)).toBe(false);
});

test('replacement retires prior lease once; its stale cleanup cannot affect successor', () => {
  const previous = createNativeHomeHubFeedback(true);
  previous.pressCTA(1, 'native-only');
  const next = createNativeHomeHubFeedback(true);
  expect(stopCtaActivationSounds).toHaveBeenCalledTimes(1);
  next.pressCTA(2, 'native-only');
  previous.dispose(); previous.stop();
  expect(stopCtaActivationSounds).toHaveBeenCalledTimes(1);
  expect(previous.pressCTA(3, 'native-only')).toBe(false);
  next.stop(); expect(stopCtaActivationSounds).toHaveBeenCalledTimes(2);
});
