import fs from 'node:fs';
import path from 'node:path';
import {
  NAVIGATION_CLOSE_SOUND_BASE_VOLUMES,
  NAVIGATION_CLOSE_SOUND_SOURCES,
  NAVIGATION_CLOSE_SOUND_VOLUMES,
  playNavigationCloseSound,
} from '../navigation-close-sound.ts';

describe('Back and X close navigation sound', () => {
  test('uses only reduced deep impact through the shared SFX master', () => {
    expect(NAVIGATION_CLOSE_SOUND_SOURCES).toEqual([
      './assets/sound/CTA/deppimpact.wav',
    ]);
    expect(NAVIGATION_CLOSE_SOUND_BASE_VOLUMES).toEqual([0.6]);
    expect(NAVIGATION_CLOSE_SOUND_VOLUMES).toEqual([0.36]);
  });

  test('covers navigation Back, X close, HUD close and shared in-game modal close buttons', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/navigation-close-sound.ts'), 'utf8');
    for (const selector of ['#collectibles-back', '#detail-close-btn', '#settings-back-btn', '#hud-close-button', '.gameplay-sheet-close']) {
      expect(source).toContain(selector);
    }
    expect(source).toContain("document.addEventListener('pointerdown', onPointerDown, true)");
  });

  test('connects the same close cue to every live Pixi gameplay HUD X path', () => {
    const hudSource = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/hud-helpers.ts'), 'utf8');
    expect(hudSource).toContain("from './navigation-close-sound.ts'");
    expect(hudSource.match(/playNavigationCloseSound\(\);/g)).toHaveLength(3);
  });

  test('obeys Sounds OFF when invoked directly by the Pixi HUD', () => {
    (window as any)._settings = { gameSoundsEnabled: false };
    expect(playNavigationCloseSound()).toBe(false);
    delete (window as any)._settings;
  });
});
