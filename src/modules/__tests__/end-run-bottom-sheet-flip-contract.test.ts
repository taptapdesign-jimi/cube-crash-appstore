import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const endRunSource = fs.readFileSync(path.join(root, 'src/modules/end-run-modal.ts'), 'utf8');
const benchmarkSource = fs.readFileSync(path.join(root, 'src/modules/gameplay-modal-benchmark.ts'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');

describe('reversible End Run bottom-sheet 3D flip experiment', () => {
  test('keeps 3D presentation nested under the existing sheet lifecycle owner', () => {
    expect(endRunSource).toContain(
      'export const END_RUN_BOTTOM_SHEET_3D_FLIP_TEST_ENABLED = true',
    );
    expect(endRunSource).toContain("modal.classList.add('is-end-run-3d-flip-test')");
    expect(endRunSource).toContain('<div class="end-run-modal-bounce-shell">');
    expect(endRunSource).toContain('<div class="end-run-sheet-flip-shell">');
    expect(endRunSource).toContain('<div class="cc-gameplay-modal-idle-shell">');
    expect(endRunSource).toContain('<div class="end-run-paper-clip-shell">');
    expect(endRunSource).toContain("el.classList.add('is-end-run-3d-flip-entering')");
    expect(endRunSource).toContain("modalEl.classList.add('is-end-run-3d-flip-exiting')");

    expect(appCss).toContain('.simple-bottom-sheet.is-end-run-3d-flip-test {');
    expect(appCss).toContain('.simple-bottom-sheet.is-end-run-3d-flip-test::after {\n  content: none;');
    expect(appCss).toContain('@keyframes end-run-sheet-flip-in');
    expect(appCss).toContain('@keyframes end-run-sheet-flip-out');
    expect(appCss).toContain('rotateX(17deg) rotateY(-88deg)');
    expect(appCss).toContain('rotateX(-15deg) rotateY(112deg)');
  });

  test('promotes only End Run to a centered modal while preserving one reversible fallback', () => {
    expect(endRunSource).toContain('export const END_RUN_CENTERED_MODAL_TEST_ENABLED = true');
    expect(endRunSource).toContain("modal.classList.add('is-end-run-centered-modal-test')");
    expect(endRunSource).toContain("modal.setAttribute('role', 'dialog')");
    expect(endRunSource).toContain("modal.setAttribute('aria-modal', 'true')");
    expect(endRunSource).toContain('<h2 id="end-run-modal-title" class="cc-gameplay-modal-title">');
    expect(endRunSource).toContain('mountGameplaySheetClose(endRunCloseHost');
    expect(endRunSource).toContain('hideModal();');
    expect(endRunSource).toContain('if (!END_RUN_CENTERED_MODAL_TEST_ENABLED) {\n    addDragFunctionality(modal);');
    expect(endRunSource).toContain("el.style.display = 'flex'");
    expect(endRunSource).toContain(
      '}, END_RUN_CENTERED_MODAL_ENTER_DURATION_MS + END_RUN_CENTERED_MODAL_ENTER_CLEANUP_BUFFER_MS);',
    );
    expect(endRunSource).toContain('GAMEPLAY_MODAL_BENCHMARK.enterDurationMs');
    expect(endRunSource).toContain('GAMEPLAY_MODAL_BENCHMARK.enterCleanupBufferMs');
    expect(endRunSource).toContain('getGameplayModalCtaEnterDelayMs()');
    expect(benchmarkSource).toContain('enterDurationMs: 650');
    expect(benchmarkSource).toContain('enterCleanupBufferMs: 34');
    expect(benchmarkSource).toContain('ctaEnterProgress: 0.2');
    expect(endRunSource).toContain('}, END_RUN_CTA_ENTER_DELAY_MS);');
    expect(appCss).toContain(
      'animation: end-run-centered-modal-flip-in 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;',
    );
    expect(endRunSource).toContain('}, getEndRunSurfaceExitDurationMs());');

    expect(appCss).toContain('.simple-bottom-sheet.is-end-run-centered-modal-test {');
    expect(appCss).toContain('align-items: center');
    expect(appCss).toContain('justify-content: center');
    expect(appCss).toContain('background: var(--cc-gameplay-modal-overlay-color)');
    expect(appCss).toContain(
      '.simple-bottom-sheet.is-end-run-centered-modal-test.is-end-run-backdrop-visible::before {\n  opacity: 1;',
    );
    expect(endRunSource).toContain("el.classList.add('is-end-run-backdrop-visible')");
    expect(endRunSource).toContain("modalEl.classList.remove('is-end-run-backdrop-visible')");
    expect(appCss).toContain(
      '.simple-bottom-sheet.is-end-run-centered-modal-test .modal-handle {\n  display: none;',
    );
    expect(appCss).toContain('@keyframes end-run-centered-modal-flip-in');
    expect(appCss).toContain('@keyframes end-run-centered-modal-flip-out');
    expect(appCss).toContain('@keyframes end-run-centered-modal-bounce-in');
    expect(appCss).toContain('@keyframes end-run-centered-modal-bounce-out');
    expect(appCss).toContain(
      'transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1);',
    );
    expect(appCss).toContain(
      'transform: translate3d(0, 0, 0) scale(1) rotate(0deg);',
    );
    expect(appCss).toContain('scale(1.07) rotate(0.8deg)');
    expect(appCss).toContain('0 13px 33.6px 0 rgba(185, 145, 119, 0.8)');
    expect(appCss).toContain(
      '.simple-bottom-sheet.is-end-run-centered-modal-test .gameplay-sheet-close {\n  top: -10px;\n  right: -10px;',
    );
    expect(appCss).toContain(
      'opacity: 1;\n    transform: translate3d(0, 88px, -180px)',
    );
  });

  test('keeps paper clipping nested inside the shared flip owner without losing reduced motion', () => {
    expect(appCss).toContain(
      '.simple-bottom-sheet.is-end-run-3d-flip-test .end-run-paper-clip-shell::after {',
    );
    expect(appCss).toContain('background: var(--bottom-sheet-paper-texture)');
    expect(appCss).toContain('border-radius: 40px 40px 0 0');
    expect(appCss).toContain(
      '.simple-bottom-sheet.is-end-run-centered-modal-test .end-run-sheet-flip-shell {',
    );
    expect(appCss).toContain('overflow: visible');
    expect(appCss).toContain('bottom-sheet presentation without changing its interaction lifecycle');
    expect(appCss).toContain(
      '.simple-bottom-sheet.is-end-run-3d-flip-test .end-run-sheet-flip-shell {\n    animation: none !important;',
    );
  });
});
