import {
  CTA_ACTIVATION_SOUND_BASE_VOLUMES,
  CTA_ACTIVATION_SOUND_SOURCES,
  CTA_ACTIVATION_SOUND_VOLUMES,
  playCtaActivationSounds,
  resetCtaActivationSoundsForTests,
  stopCtaActivationSounds,
} from '../cta-activation-sound.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('shared CTA activation sound', () => {
  beforeEach(() => {
    (window as any)._settings = { gameSoundsEnabled: true };
    resetCtaActivationSoundsForTests();
  });

  afterEach(() => {
    stopCtaActivationSounds();
    delete (window as any)._settings;
  });

  test('adds deeper only to the shared CTA activation mix', () => {
    expect(CTA_ACTIVATION_SOUND_SOURCES).toEqual([
      './assets/sound/CTA/poping.wav',
      './assets/sound/CTA/wood click.wav',
      './assets/sound/CTA/deeper.wav',
    ]);
    expect(CTA_ACTIVATION_SOUND_BASE_VOLUMES).toEqual([0.5, 0.7, 0.3]);
    expect(CTA_ACTIVATION_SOUND_VOLUMES).toEqual([0.3, 0.42, 0.18]);
  });

  test('obeys Sounds OFF', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(playCtaActivationSounds()).toBe(false);
  });

  test('reuses the CTA mix only for accepted Homepage hero image activation', () => {
    const uiManager = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/ui-manager.ts'),
      'utf8',
    );
    const sliderManager = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/slider-manager.ts'),
      'utf8',
    );
    const heroOwner = uiManager.split('private attachSliderHeroCtaListeners')[1]
      ?.split('// Setup state subscriptions')[0] ?? '';
    expect(heroOwner).toContain('playCtaActivationSounds();');
    expect(heroOwner).toContain('activationHandler(keyEvent);');
    expect(heroOwner).toContain("attachPair('[data-hero-cta=\"play\"]'");
    expect(heroOwner).toContain("attachPair('[data-hero-cta=\"journey\"]'");
    expect(heroOwner).toContain("attachPair('[data-hero-cta=\"settings\"]'");
    expect(sliderManager).not.toContain('playCtaActivationSounds');
  });

  test('reuses the CTA mix for an accepted Journey Hub World open', () => {
    const journeyManager = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    const openWorld = journeyManager.split('private openJourneyV700World(')[1]
      ?.split('private playJourneyV700HubEnter')[0] ?? '';
    expect(journeyManager).toContain('preloadCtaActivationSounds();');
    expect(openWorld).toContain('this.journeyV700WorldOpenInProgress = true;');
    expect(openWorld).toContain('playCtaActivationSounds();');
    expect(openWorld.indexOf('this.journeyV700WorldOpenInProgress = true;')).toBeLessThan(
      openWorld.indexOf('playCtaActivationSounds();'),
    );
    expect(openWorld.indexOf('playCtaActivationSounds();')).toBeLessThan(
      openWorld.indexOf("this.logJourneyV700Flow('open-world-start'"),
    );
  });
});
