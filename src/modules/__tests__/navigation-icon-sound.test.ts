import {
  NAVIGATION_ICON_SOUND_BASE_VOLUMES,
  NAVIGATION_ICON_SOUND_SOURCES,
  NAVIGATION_ICON_SOUND_VOLUMES,
  playNavigationIconSounds,
  resetNavigationIconSoundsForTests,
  stopNavigationIconSounds,
} from '../navigation-icon-sound.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('homepage navigation icon sound', () => {
  beforeEach(() => {
    (window as any)._settings = { gameSoundsEnabled: true };
    resetNavigationIconSoundsForTests();
  });

  afterEach(() => {
    stopNavigationIconSounds();
    delete (window as any)._settings;
  });

  test('uses poping and wood click at their navigation levels', () => {
    expect(NAVIGATION_ICON_SOUND_SOURCES).toEqual([
      './assets/sound/CTA/poping.wav',
      './assets/sound/CTA/wood click.wav',
    ]);
    expect(NAVIGATION_ICON_SOUND_BASE_VOLUMES).toEqual([0.5, 0.7]);
    expect(NAVIGATION_ICON_SOUND_VOLUMES).toEqual([0.3, 0.42]);
  });

  test('obeys Sounds OFF', () => {
    (window as any)._settings.gameSoundsEnabled = false;
    expect(playNavigationIconSounds()).toBe(false);
  });

  test('is attached only to Homepage slider navigation icons', () => {
    const navigationSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/ui/components/navigation.ts'),
      'utf8',
    );
    const ctaSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/cta-system.ts'),
      'utf8',
    );
    expect(navigationSource).toContain('pointerdown: () => playNavigationIconSounds()');
    expect(navigationSource).toContain("...(onSlideChange ? { click: () => onSlideChange(slideIndex) } : {})");
    expect(navigationSource).not.toContain('eventListeners: onSlideChange ?');
    expect(ctaSource).toContain('playCtaActivationSounds();');
    expect(ctaSource).not.toContain('playNavigationIconSounds');
  });

  test('reuses the same pair once on Settings toggle pointer-down', () => {
    const settingsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/ui/components/settings-screen.ts'),
      'utf8',
    );
    expect(settingsSource).toContain("if (e.type === 'pointerdown') playNavigationIconSounds();");
  });
});
