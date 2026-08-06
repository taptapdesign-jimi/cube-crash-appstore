import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('gameplay HUD exit ownership contract', () => {
  it('hands ownership to exit before the rise tween and cannot be restored by layout', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/hud-helpers.ts'), 'utf8');
    const riseStart = source.indexOf('export function playHudRise');
    const riseEnd = source.indexOf('export function updateHUD', riseStart);
    const riseOwner = source.slice(riseStart, riseEnd);

    expect(riseOwner.indexOf('HUD_ROOT._dropped = false;'))
      .toBeLessThan(riseOwner.indexOf('trackTween(HUD_ROOT'));
    expect(riseOwner.indexOf('HUD_ROOT._exitInProgress = true;'))
      .toBeLessThan(riseOwner.indexOf('trackTween(HUD_ROOT'));
    expect(riseOwner).toContain('HUD_ROOT.visible = false;');
    expect(source).toContain(
      "HUD_ROOT._dropped && HUD_ROOT._exitInProgress !== true && isGameplayHudRevealAllowed()",
    );
  });

  it.each([
    'app-core-hud-drop.ts',
    'app-core-popin-final.ts',
    'app-core-load-animation.ts',
    'app-core-startlevel-hudroot.ts',
    'app-core-startlevel-huddrop.ts',
  ])('guards delayed reveal callbacks in %s', (fileName) => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules', fileName), 'utf8');
    expect(source).toContain('isGameplayHudRevealAllowed()');
  });
});
