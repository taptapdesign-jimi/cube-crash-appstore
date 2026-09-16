import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(repoRoot, relativePath),
  'utf8',
);

describe('Arcade adaptive soundtrack integration', () => {
  it('ships both tempo-matched soundtrack layers from the soundtrack family', () => {
    const soundtrackRoot = path.resolve(
      repoRoot,
      'assets/sound/soundtrack/adaptive-music-v3',
    );
    const analysis = JSON.parse(read('assets/sound/soundtrack/adaptive-music-v3/analysis.json'));

    expect(fs.existsSync(path.join(soundtrackRoot, 'gameplay-bed-calm-01.wav'))).toBe(true);
    expect(fs.existsSync(path.join(soundtrackRoot, 'gameplay-bed-active-01.wav'))).toBe(true);
    expect(analysis.detectedTempoBpm).toBe(116.6);
    expect(analysis.loopBars).toBe(24);
    expect(analysis.crossfadeBars).toBe(1);
    expect(analysis.source).toBe('assets/sound/soundtrack/SIx theme.wav');
    expect(analysis.sourceSha256)
      .toBe('8090197724a74f876d12a17858b4900cc9becd85d8a0f6d5afd8444f3ec41786');
  });

  it('promotes only from the accepted Merge-6 branch and ducks behind result cues', () => {
    const appCore = read('src/modules/app-core.ts');
    const merge6Branch = appCore.slice(appCore.indexOf('if (effSum === 6){'));
    const cleanBoard = read('src/modules/clean-board-modal.ts');
    const failBoard = read('src/modules/board-fail-modal.ts');
    const stageClear = read('src/modules/arcade-stage-clear-modal.ts');

    expect(merge6Branch.indexOf('promoteArcadeSoundtrackAfterMerge6()')).toBeGreaterThanOrEqual(0);
    expect(cleanBoard).toContain(
      'const restoreSoundtrackAfterResultAudio = fadeSoundtrackForResultHook();',
    );
    expect(cleanBoard).toContain('playCleanBoardApplauseSound();');
    expect(cleanBoard).toContain('onEnded: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(cleanBoard).toContain('onStopped: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(failBoard).toContain(
      'const restoreSoundtrackAfterResultAudio = fadeSoundtrackForResultHook();',
    );
    expect(failBoard).toContain('playFailScreenSaxophoneSound({');
    expect(failBoard).toContain('onEnded: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(failBoard).toContain('onStopped: () => restoreSoundtrackAfterResultAudio(resultReleaseTarget),');
    expect(cleanBoard).toContain("resultReleaseTarget = 'gameplay';");
    expect(failBoard).toContain("cleanupFailModalLifecycle('gameplay');");
    expect(cleanBoard).toContain("restoreSoundtrackAfterResultAudio('gameplay');");
    expect(failBoard).toContain("restoreSoundtrackAfterResultAudio('gameplay');");
    expect(stageClear).toContain('setSoundtrackResultMix();');
    expect(stageClear).toContain('enterArcadeGameplaySoundtrack();');
  });
});
