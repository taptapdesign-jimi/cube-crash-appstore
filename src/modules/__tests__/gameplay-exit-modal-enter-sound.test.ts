import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GAMEPLAY_EXIT_MODAL_ENTER_SOUND_BASE_VOLUME, GAMEPLAY_EXIT_MODAL_ENTER_SOUND_SOURCE, GAMEPLAY_EXIT_MODAL_ENTER_SOUND_VOLUME } from '../gameplay-exit-modal-enter-sound.ts';

describe('HUD gameplay exit modal enter sound', () => {
  test('uses the supplied modal-enter cue', () => {
    expect(GAMEPLAY_EXIT_MODAL_ENTER_SOUND_SOURCE).toBe('./assets/sound/UI /modal/modal enter.wav');
    expect(GAMEPLAY_EXIT_MODAL_ENTER_SOUND_BASE_VOLUME).toBe(1);
    expect(GAMEPLAY_EXIT_MODAL_ENTER_SOUND_VOLUME).toBe(0.6);
    const bytes = fs.readFileSync(path.resolve(process.cwd(), GAMEPLAY_EXIT_MODAL_ENTER_SOUND_SOURCE.replace(/^\.\//, '')));
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(
      'fbf66fa435afe49798431750d718c8fa0ff781dd2c736911ae1717bd5c8c2767',
    );
  });

  test('belongs only to End Run, never Journey Units or cards', () => {
    const endRun = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/end-run-modal.ts'), 'utf8');
    const card = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/journey-card-overlay-modal.ts'), 'utf8');
    const journey = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'), 'utf8');
    expect(endRun).toContain('playGameplayExitModalEnterSound();');
    expect(card).not.toContain('playGameplayExitModalEnterSound');
    expect(journey).not.toContain('playGameplayExitModalEnterSound');
  });

  test('starts after accepted modal creation but before the first visible enter frame', () => {
    const endRun = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/end-run-modal.ts'), 'utf8');
    const showStart = endRun.indexOf('export function showEndRunModal(): void {');
    const showEnd = endRun.indexOf('// Simple drag functionality', showStart);
    const showSource = endRun.slice(showStart, showEnd);
    const createIndex = showSource.indexOf('const el = createModal();');
    const soundIndex = showSource.indexOf('playGameplayExitModalEnterSound();');
    const frameIndex = showSource.indexOf('trackEndRunAnimationFrame(() => {');
    const visibleIndex = showSource.indexOf("el.style.display = 'flex';");

    expect(showSource.match(/playGameplayExitModalEnterSound\(\);/g)).toHaveLength(1);
    expect(createIndex).toBeGreaterThan(-1);
    expect(soundIndex).toBeGreaterThan(createIndex);
    expect(frameIndex).toBeGreaterThan(soundIndex);
    expect(visibleIndex).toBeGreaterThan(frameIndex);
  });
});
