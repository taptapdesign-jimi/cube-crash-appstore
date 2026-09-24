import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(repoRoot, relativePath),
  'utf8',
);

function inspectPcm24StereoLoop(relativePath: string): {
  headRmsDb: number;
  tailRmsDb: number;
  seamJump: number;
} {
  const bytes = fs.readFileSync(path.resolve(repoRoot, relativePath));
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
  expect(bytes.readUInt16LE(22)).toBe(2);
  expect(bytes.readUInt32LE(24)).toBe(48_000);
  expect(bytes.readUInt16LE(34)).toBe(24);

  const dataOffset = 44;
  const frameBytes = 6;
  const frameCount = Math.floor((bytes.length - dataOffset) / frameBytes);
  const windowFrames = Math.min(960, frameCount);
  const sampleAt = (frame: number, channel: number): number => (
    bytes.readIntLE(dataOffset + frame * frameBytes + channel * 3, 3) / 8_388_608
  );
  const rmsDb = (startFrame: number): number => {
    let sumSquares = 0;
    for (let frame = startFrame; frame < startFrame + windowFrames; frame += 1) {
      for (let channel = 0; channel < 2; channel += 1) {
        const sample = sampleAt(frame, channel);
        sumSquares += sample * sample;
      }
    }
    const rms = Math.sqrt(sumSquares / (windowFrames * 2));
    return 20 * Math.log10(Math.max(rms, Number.EPSILON));
  };

  return {
    headRmsDb: rmsDb(0),
    tailRmsDb: rmsDb(frameCount - windowFrames),
    seamJump: Math.max(
      Math.abs(sampleAt(0, 0) - sampleAt(frameCount - 1, 0)),
      Math.abs(sampleAt(0, 1) - sampleAt(frameCount - 1, 1)),
    ),
  };
}

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

  it('keeps both gameplay loop edges audible and free of a hard sample cut', () => {
    for (const filename of ['gameplay-bed-calm-01.wav', 'gameplay-bed-active-01.wav']) {
      const edge = inspectPcm24StereoLoop(
        `assets/sound/soundtrack/adaptive-music-v3/${filename}`,
      );
      expect(edge.headRmsDb).toBeGreaterThan(-45);
      expect(edge.tailRmsDb).toBeGreaterThan(-45);
      expect(edge.seamJump).toBeLessThan(0.05);
    }
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
