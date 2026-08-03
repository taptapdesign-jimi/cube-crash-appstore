import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Arcade continuation Round cue contract', () => {
  test('reuses only the pure Round-number phase without resolving gameplay progression', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const cue = source.slice(
      source.indexOf('export async function showArcadeContinuationRoundCue'),
      source.indexOf('export function cleanupArcadeStageClearModal'),
    );

    expect(cue).toContain('await playRoundNumberPhase(parts, resumedStage)');
    expect(cue).toContain('cancelArcadeStageClearModal();');
    expect(cue).not.toContain('gsap.timeline(');
    expect(cue).not.toContain("action: 'continue'");
    expect(cue).not.toContain('startLevel(');
  });

  test('an abandoned stage-clear resolves as cancel and endgame never advances it', () => {
    const modalSource = fs.readFileSync(path.join(repoRoot, 'src/modules/arcade-stage-clear-modal.ts'), 'utf8');
    const endgameSource = fs.readFileSync(path.join(repoRoot, 'src/modules/endgame-flow.ts'), 'utf8');
    const zoneSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-zone-manager.ts'), 'utf8');

    expect(modalSource).toContain("cancel?.({ action: 'cancel' });");
    expect(endgameSource).toContain("if (stageClearResult.action !== 'continue')");
    expect(zoneSource).toContain('cancelArcadeStageClearModal?.();');
    expect(zoneSource).not.toContain('cleanupArcadeStageClearModal?.(false)');
  });

  test('Homepage Arcade resume shows the cue only for saved rounds above 01', () => {
    const uiSource = fs.readFileSync(path.join(repoRoot, 'src/modules/ui-manager.ts'), 'utf8');
    const coreSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');

    expect(uiSource).toContain('const continuationRound = getArcadeSavedRound();');
    expect(uiSource).toContain('continuationRound !== null && continuationRound > 1');
    expect(uiSource).toContain('__ccArcadeContinuationCueRound = continuationRound');
    expect(coreSource).toContain('beforePopIn: arcadeContinuationCueRound > 1');
    expect(coreSource).toContain('await showArcadeContinuationRoundCue(arcadeContinuationCueRound)');
  });

  test('post-load recovery cannot inspect the board while continuation tiles are hidden', () => {
    const coreSource = fs.readFileSync(path.join(repoRoot, 'src/modules/app-core.ts'), 'utf8');
    const popInCall = coreSource.slice(
      coreSource.indexOf('playLoadPopInAnimation({'),
      coreSource.indexOf('return true;', coreSource.indexOf('playLoadPopInAnimation({')),
    );
    const completionOwner = popInCall.slice(popInCall.indexOf('onComplete: () => {'));

    expect(completionOwner).toContain('schedulePostLoadRecoveryCheck({');
    expect(popInCall.match(/schedulePostLoadRecoveryCheck\(\{/g)).toHaveLength(1);
  });
});
