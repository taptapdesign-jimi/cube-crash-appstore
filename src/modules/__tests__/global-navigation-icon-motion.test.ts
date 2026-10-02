import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

describe('global navigation and active HUD icon motion contract', () => {
  test('all active DOM navigation owners use the shared backpack bounce', () => {
    const journeyManager = read('src/modules/journey-boards-manager.ts');
    const sliderManager = read('src/modules/slider-manager.ts');
    const settings = read('src/ui/components/settings-screen.ts');
    const sheetClose = read('src/modules/gameplay-sheet-close.ts');
    const backpack = read('src/ui/components/collectibles-screen.ts');

    expect(journeyManager.match(/playNavIconCartoonBounce\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sliderManager).toContain('const timeline = playNavIconCartoonBounce(navButton);');
    expect(settings.match(/playNavIconCartoonBounce\(/g)?.length).toBe(3);
    expect(settings).toContain('playSettingsToggleBounce(toggleTarget);');
    expect(sheetClose).toContain('playNavIconCartoonBounce(button);');
    expect(backpack).toContain('playNavIconCartoonBounce(event.currentTarget as HTMLElement | null)');
  });

  test('active Pixi HUD icon taps and DOM fallback share the same motion profile', () => {
    const appCore = read('src/modules/app-core.ts');
    const appMerge = read('src/modules/app-merge.ts');
    const hud = read('src/modules/hud-helpers.ts');
    const pixiTapOwner = hud.split('function playPixiSoftCartoonBounce')[1]
      ?.split('function playHudCloseSoftCartoonBounce')[0] ?? '';

    expect(appCore).toMatch(/import \* as HUD\s+from '\.\/hud-helpers\.ts';/);
    expect(appMerge).toMatch(/import \* as HUD\s+from '\.\/hud-helpers\.ts';/);
    expect(hud).toContain('NAV_ICON_TAP_BOUNCE.squeezeScale');
    expect(hud).toContain('NAV_ICON_TAP_BOUNCE.popScale');
    expect(hud).toContain('NAV_ICON_TAP_BOUNCE.settleDurationSeconds');
    expect(pixiTapOwner).toContain('ease: navIconTapBounceEase');
    expect(hud).toContain("button.addEventListener('pointerdown', () => playNavIconCartoonBounce(button));");
    expect(hud.match(/playPixiSoftCartoonBounce\(/g)?.length).toBeGreaterThanOrEqual(5);
  });

  test('old per-surface navigation bounce owners are removed', () => {
    const appCss = read('src/style.css');
    const journeyCss = read('src/collectibles-screen.css');
    expect(appCss).not.toContain('gameplay-sheet-close-comic-bounce');
    expect(journeyCss).not.toContain('journeyHubBackpackTapBounce');
    expect(read('src/modules/gameplay-sheet-close.ts')).not.toContain('is-comic-bouncing');
    expect(read('src/modules/slider-manager.ts')).not.toContain('scaleX: 1.16');
    expect(appCss).toMatch(/\.settings-back-button\.tap-scale:active,[\s\S]*?\.settings-dev-open-button\.tap-scale:active \{[\s\S]*?transform: none;/);
    expect(journeyCss).toMatch(/#collectibles-detail-modal \.detail-close-button\.tap-scale:active \{[\s\S]*?transform: none;/);
  });
});
