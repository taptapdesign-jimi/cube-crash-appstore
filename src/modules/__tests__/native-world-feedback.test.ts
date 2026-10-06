import {
  createNativeWorldFeedback,
  stopNativeWorldFeedback,
} from '../native-world-feedback';
import { createJourneyUnitMotionSoundSession } from '../journey-unit-motion-sound';
import {
  playJourneyForestAmbientSounds,
  stopJourneyForestAmbientSounds,
} from '../journey-forest-ambient-sound';
import { playJourneyWorldsWorldSound } from '../journey-worlds-hub-sound';
import {
  playJourneyCardEntryFlipSounds,
  playJourneyCardManualFlipSound,
  playJourneyCardReturnFlipSounds,
  stopJourneyCardEntryFlipSounds,
} from '../journey-card-entry-flip-sound';
import {
  playCardTapPlopSound,
  playCtaActivationSounds,
} from '../cta-activation-sound';
jest.mock('../journey-unit-motion-sound', () => ({
  createJourneyUnitMotionSoundSession: jest.fn(),
}));
jest.mock('../journey-forest-ambient-sound', () => ({
  playJourneyForestAmbientSounds: jest.fn(),
  stopJourneyForestAmbientSounds: jest.fn(),
}));
jest.mock('../journey-worlds-hub-sound', () => ({
  playJourneyWorldsWorldSound: jest.fn(),
  stopJourneyWorldsHubSound: jest.fn(),
}));
jest.mock('../journey-card-entry-flip-sound', () => ({
  playJourneyCardEntryFlipSounds: jest.fn(),
  playJourneyCardManualFlipSound: jest.fn(),
  playJourneyCardReturnFlipSounds: jest.fn(),
  stopJourneyCardEntryFlipSounds: jest.fn(),
}));
jest.mock('../cta-activation-sound', () => ({
  playCardTapPlopSound: jest.fn(),
  playCtaActivationSounds: jest.fn(),
  stopCtaActivationSounds: jest.fn(),
}));
jest.mock('../navigation-close-sound', () => ({
  playNavigationCloseSound: jest.fn(),
  stopNavigationCloseSound: jest.fn(),
}));
const event = (kind: any, id = 1) => ({
  id,
  kind,
  worldID: 1 as const,
  routeGeneration: 1,
  stateRevision: 1,
  durationSeconds: 0.6,
  boardID: 1,
});
let session: { playEnter: jest.Mock; playExit: jest.Mock; stop: jest.Mock };
beforeEach(() => {
  stopNativeWorldFeedback();
  jest.clearAllMocks();
  Object.defineProperty(document, 'hidden', {
    value: false,
    configurable: true,
  });
  (window as any)._settings = { gameSoundsEnabled: true, hapticsEnabled: true };
  window.triggerHapticImpact = jest.fn();
  session = { playEnter: jest.fn(), playExit: jest.fn(), stop: jest.fn() };
  (createJourneyUnitMotionSoundSession as jest.Mock).mockReturnValue(session);
});
afterEach(() => {
  stopNativeWorldFeedback();
  delete (window as any)._settings;
});
test('native contact delegates authored families without fake web geometry and deduplicates callbacks', () => {
  const owner = createNativeWorldFeedback();
  expect(owner.play(event('world-enter'))).toBe(true);
  expect(createJourneyUnitMotionSoundSession).toHaveBeenCalledWith([
    { id: 'native-visible-unit', nativeVisible: true },
  ]);
  expect(session.playEnter).toHaveBeenCalledWith('native-visible-unit', 0.6);
  expect(owner.play(event('world-enter'))).toBe(false);
  owner.play(event('ambience'));
  expect(playJourneyForestAmbientSounds).toHaveBeenCalledTimes(1);
  expect(playJourneyWorldsWorldSound).toHaveBeenCalledTimes(1);
  owner.play(event('card-tap'));
  expect(playCardTapPlopSound).toHaveBeenCalledTimes(1);
  owner.play(event('card-entry-flip'));
  expect(playJourneyCardEntryFlipSounds).toHaveBeenCalledTimes(1);
  owner.play(event('card-manual-flip'));
  expect(playJourneyCardManualFlipSound).toHaveBeenCalledTimes(1);
  owner.play(event('card-return-flip'));
  expect(playJourneyCardReturnFlipSounds).toHaveBeenCalledTimes(1);
  owner.play(event('cta'));
  expect(playCtaActivationSounds).toHaveBeenCalledTimes(1);
  owner.stop();
  owner.stop();
  expect(session.stop).toHaveBeenCalledTimes(1);
  expect(stopJourneyForestAmbientSounds).toHaveBeenCalledTimes(1);
  expect(stopJourneyCardEntryFlipSounds).toHaveBeenCalledTimes(1);
});
test('Settings OFF consumes contact, haptics independent, hidden/replaced leases cannot replay or stop successor', () => {
  const owner = createNativeWorldFeedback();
  (window as any)._settings.gameSoundsEnabled = false;
  (window as any)._settings.hapticsEnabled = false;
  expect(owner.play(event('card-tap'))).toBe(true);
  expect(playCardTapPlopSound).not.toHaveBeenCalled();
  expect(window.triggerHapticImpact).not.toHaveBeenCalled();
  (window as any)._settings.gameSoundsEnabled = true;
  expect(owner.play(event('card-tap'))).toBe(false);
  Object.defineProperty(document, 'hidden', {
    value: true,
    configurable: true,
  });
  expect(owner.play(event('ambience'))).toBe(false);
  Object.defineProperty(document, 'hidden', {
    value: false,
    configurable: true,
  });
  const successor = createNativeWorldFeedback();
  owner.stop();
  expect(owner.play(event('card-entry-flip', 2))).toBe(false);
  successor.play(event('card-entry-flip', 2));
  expect(playJourneyCardEntryFlipSounds).toHaveBeenCalledTimes(1);
});
test('release to canonical gameplay never stops its shared successor sound family', () => {
  const owner = createNativeWorldFeedback();
  owner.play(event('card-entry-flip'));
  owner.releaseToWeb();
  owner.stop();
  stopNativeWorldFeedback();
  expect(stopJourneyCardEntryFlipSounds).not.toHaveBeenCalled();
  expect(owner.play(event('card-entry-flip', 2))).toBe(false);
});


test.each([2,3] as const)('World %i ambience uses canonical World cue without Forest ambience',worldID=>{
  const owner=createNativeWorldFeedback();expect(owner.play({...event('ambience'),worldID})).toBe(true);
  expect(playJourneyWorldsWorldSound).toHaveBeenCalledTimes(1);expect(playJourneyForestAmbientSounds).not.toHaveBeenCalled();owner.stop();
});
