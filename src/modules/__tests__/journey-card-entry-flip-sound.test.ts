import fs from 'node:fs';
import path from 'node:path';
import {
  JOURNEY_CARD_ENTRY_FLIP_SOUND_BASE_VOLUMES,
  JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES,
  JOURNEY_CARD_ENTRY_FLIP_SOUND_VOLUMES,
  JOURNEY_CARD_MANUAL_FLIP_SOUND_SOURCE,
  JOURNEY_CARD_MANUAL_FLIP_SOUND_VOLUME,
  JOURNEY_CARD_RETURN_SWOOSH_SOUND_SOURCE,
  JOURNEY_CARD_RETURN_SWOOSH_SOUND_VOLUME,
  playJourneyCardEntryFlipSounds,
  playJourneyCardManualFlipSound,
  playJourneyCardReturnSwooshSound,
  resetJourneyCardEntryFlipSoundsForTests,
} from '../journey-card-entry-flip-sound.ts';

describe('Journey card modal entry flip sound', () => {
  beforeEach(() => {
    (window as any)._settings = { gameSoundsEnabled: true };
    resetJourneyCardEntryFlipSoundsForTests();
  });

  afterEach(() => {
    resetJourneyCardEntryFlipSoundsForTests();
    delete (window as any)._settings;
  });

  test('layers menu flip, flip and flip soft at the standard SFX level', () => {
    expect(JOURNEY_CARD_ENTRY_FLIP_SOUND_SOURCES).toEqual([
      './assets/sound/cjelina flip/menu flip.wav',
      './assets/sound/cjelina flip/flip.wav',
      './assets/sound/cjelina flip/flip soft.wav',
    ]);
    expect(JOURNEY_CARD_ENTRY_FLIP_SOUND_BASE_VOLUMES).toEqual([1, 1, 1]);
    expect(JOURNEY_CARD_ENTRY_FLIP_SOUND_VOLUMES).toEqual([0.6, 0.6, 0.6]);
    expect(JOURNEY_CARD_MANUAL_FLIP_SOUND_SOURCE).toBe('./assets/sound/cjelina flip/flip soft.wav');
    expect(JOURNEY_CARD_MANUAL_FLIP_SOUND_VOLUME).toBe(0.6);
    expect(JOURNEY_CARD_RETURN_SWOOSH_SOUND_SOURCE).toBe('./assets/sound/cjelina flip/swoosh back.wav');
    expect(JOURNEY_CARD_RETURN_SWOOSH_SOUND_VOLUME).toBe(0.6);
  });

  test('starts only with the visible spatial entry and has preload and cleanup owners', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-card-overlay-modal.ts'),
      'utf8',
    );
    const startEntry = source.split('const startEntry = async')[1]?.split('const startReturn = async')[0] ?? '';
    const interactiveFlip = source.split('const animateInteractiveFlip = async')[1]?.split('const startEntry = async')[0] ?? '';
    expect(startEntry).toContain('playJourneyCardEntryFlipSounds();');
    expect(startEntry.indexOf('if (!destination)')).toBeLessThan(startEntry.indexOf('playJourneyCardEntryFlipSounds();'));
    expect(startEntry.indexOf('playJourneyCardEntryFlipSounds();')).toBeLessThan(startEntry.indexOf('startJourneyCardSpatialFlight({'));
    expect(interactiveFlip).not.toContain('playJourneyCardEntryFlipSounds();');
    expect(interactiveFlip).toContain('flipping = true;\n    if (playSoundImmediately) playJourneyCardManualFlipSound();');
    expect(source).toContain('dragFlipSoundPending = true;');
    expect(source).toContain("animateInteractiveFlip(stableFace === 'front' ? 'back' : 'front', undefined, undefined, false)");
    expect(source).toContain('const shouldPlayCommittedDragSound = allowCommit && dragFlipSoundPending;');
    expect(source).toContain('if (shouldPlayCommittedDragSound) playJourneyCardManualFlipSound();');
    expect(source).toContain('preloadJourneyCardEntryFlipSounds();');
    expect(source).toContain('stopJourneyCardEntryFlipSounds();');
    const startReturn = source.split('const startReturn = async')[1]?.split('let closeRequestProfiled')[0] ?? '';
    expect(startReturn.match(/playJourneyCardReturnSwooshSound\(\);/g)).toHaveLength(1);
    expect(startReturn.indexOf('playJourneyCardReturnSwooshSound();')).toBeLessThan(
      startReturn.indexOf('spatialFlight = startJourneyCardSpatialFlight({'),
    );

    const reminder = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-card-return-reminder.ts'),
      'utf8',
    );
    expect(reminder.indexOf("stage.classList.add('is-visible', 'is-turning');")).toBeLessThan(
      reminder.indexOf('playJourneyCardEntryFlipSounds();'),
    );
    expect(reminder.indexOf('playJourneyCardEntryFlipSounds();')).toBeLessThan(
      reminder.indexOf('flight = startJourneyCardSpatialFlight({'),
    );
    expect(reminder).toContain('preloadJourneyCardEntryFlipSounds();');
    expect(reminder).toContain('stopJourneyCardEntryFlipSounds();');
  });

  test('obeys Sounds OFF', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(playJourneyCardEntryFlipSounds()).toBe(false);
    expect(playJourneyCardManualFlipSound()).toBe(false);
    expect(playJourneyCardReturnSwooshSound()).toBe(false);
  });
});
