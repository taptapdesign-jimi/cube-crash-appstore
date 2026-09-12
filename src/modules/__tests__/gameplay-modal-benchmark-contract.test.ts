import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('shared gameplay modal benchmark', () => {
  const benchmark = read('src/modules/gameplay-modal-benchmark.ts');
  const endRun = read('src/modules/end-run-modal.ts');
  const score = read('src/modules/score-bottom-sheet.ts');
  const privacy = read('src/ui/components/privacy-policy-modal.ts');
  const journeyOverlay = read('src/modules/journey-card-overlay-modal.ts');
  const modalDragMotion = read('src/modules/modal-vertical-drag-dismiss.ts');
  const css = read('src/style.css');
  const collectiblesCss = read('src/collectibles-screen.css');

  test('owns one timing profile for enter, exit, cleanup, and CTA reveal', () => {
    expect(benchmark).toContain('enterDurationMs: 650');
    expect(benchmark).toContain('exitDurationMs: 650');
    expect(benchmark).toContain('enterCleanupBufferMs: 34');
    expect(benchmark).toContain('ctaEnterProgress: 0.2');
    expect(benchmark).toContain('companionCtaStaggerMs: 70');
    expect(benchmark).toContain('export async function runGameplayModalParallelExit(');
    expect(benchmark).toContain('const ctaExit = startCtaExit();');
    expect(benchmark).toContain('const surfaceExit = Promise.resolve(startSurfaceExit());');
    expect(benchmark).toContain('await Promise.all([ctaExit, surfaceExit]);');
  });

  test('keeps active score and privacy modals on the shared structural motion owners', () => {
    for (const source of [score, privacy]) {
      expect(source).toContain('cc-gameplay-modal-bounce-shell');
      expect(source).toContain('cc-gameplay-modal-flip-shell');
      expect(source).toContain('cc-gameplay-modal-idle-shell');
      expect(source).toContain('cc-gameplay-modal-paper-shell');
    }

    expect(score).toContain('cc-gameplay-modal-touch-tilt-shell');
    expect(score).toContain('maxTouchTiltDeg: 3.64');

    expect(score).toContain('cc-gameplay-modal-stage');
    expect(score).not.toContain('animateBottomSheetEntrance');
    expect(score).not.toContain('function addDragFunctionality');
    expect(privacy).toContain('cc-gameplay-modal-stage');
    expect(privacy).toContain('GAMEPLAY_MODAL_BENCHMARK.enterDurationMs');
    expect(privacy).toContain('GAMEPLAY_MODAL_BENCHMARK.exitDurationMs');
  });

  test('shares one physical vertical drag owner across backdrop gameplay modals', () => {
    expect(modalDragMotion).toContain('export function installGameplayOverlayModalDragMotion(');
    expect(modalDragMotion).toContain('options.onDragMove?.(dy)');
    expect(modalDragMotion).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)');
    for (const source of [score, endRun]) {
      expect(source).toContain('installGameplayOverlayModalDragMotion');
    }
    expect(privacy).toContain('installGameplayOverlayModalDragMotion');
  });

  test('keeps authored modal pose shells while device-motion owners remain removed', () => {
    for (const source of [score, endRun, privacy, journeyOverlay]) {
      expect(source).not.toContain('mountGameplayModalSpatialMotion');
      expect(source).not.toContain('DeviceOrientationEvent');
    }
    expect(journeyOverlay).not.toContain('mountJourneyCardFlipSpatialMotion');
    expect(endRun).not.toContain('mountGameplayModalSpatialMotion');
    expect(score).not.toContain('mountGameplayModalSpatialMotion');
    expect(journeyOverlay).not.toContain("'reduced-exit-score'");
    expect(css).toContain('.cc-modal-pose-target {');
  });

  test('owns one 32px headline size across every paper gameplay modal', () => {
    expect(css).toContain('--cc-gameplay-modal-title-size: 32px;');
    expect(css).toContain('.cc-gameplay-modal-title {\n  font-size: var(--cc-gameplay-modal-title-size);');
    for (const source of [endRun, score, journeyOverlay, privacy]) {
      expect(source).toContain('cc-gameplay-modal-title');
    }
    expect(css.match(/--cc-gameplay-modal-title-size/g)).toHaveLength(2);
    expect(css).not.toContain('.score-bottom-sheet .simple-title-section h2 {\n  font-family: "Baloo2", system-ui, -apple-system, sans-serif;\n  font-size: 40px;');
    expect(collectiblesCss).not.toContain('font-size: 40px;\n  font-weight: 900;\n  line-height: 1;\n  text-align: center;');
    expect(privacy).toContain('<span class="settings-privacy-policy-title-accent">Privacy</span> Policy');
    expect(css).toContain('.settings-privacy-policy-copy .settings-privacy-policy-title {\n  color: #ad8675;');
    expect(css).toContain('.settings-privacy-policy-copy .settings-privacy-policy-title-accent {\n  color: #e8744a;');
    expect(css).toContain('.settings-privacy-policy-copy p {\n  font-family: "Baloo2", system-ui, -apple-system, sans-serif;\n  font-size: 17px;\n  font-weight: 500 !important;\n  line-height: 22.5px;\n  text-align: left;');
    expect(css).toContain('.settings-privacy-policy-copy .settings-privacy-policy-updated {\n  margin-top: 8px;\n  font-size: 16px;');
    expect(css).toContain('.settings-privacy-policy-paper {\n  height: auto;\n  max-height: calc(100dvh - 48px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));\n  padding: 40px;');
    expect(css).toContain('.settings-privacy-policy-paper::after {\n  inset: 0 0 -96px;\n}');
    expect(css).toContain('.settings-privacy-policy-paper .simple-content {\n  height: auto;\n  margin-top: 0;');
    expect(css).toContain('.settings-privacy-policy-paper .simple-header,\n.settings-privacy-policy-copy {\n  flex: 0 0 auto;');
    expect(css).toContain('.settings-privacy-policy-body {\n  width: 100%;\n  margin-top: 12px;\n  overflow: visible;');
    expect(css).not.toContain('.settings-privacy-policy-scroll');
    expect(privacy).not.toContain('data-modal-drag-ignore');
    expect(privacy).not.toContain('syncScrollThumb');
    expect(privacy).not.toContain('ResizeObserver');
    expect(privacy).toContain('>Read Privacy Policy</a>');
    expect(css).toContain('.settings-privacy-policy-online-link {\n  display: inline-block;\n  color: #e8744a;\n  font-weight: 400;\n  white-space: nowrap;');
  });

  test('owns one Journey-strength backdrop across every paper gameplay modal', () => {
    expect(css).toContain('--cc-gameplay-modal-overlay-color: rgba(220, 183, 163, 0.52);');
    expect(css).toContain('background: var(--cc-gameplay-modal-overlay-color);');
    expect(css).toContain('background: var(--cc-gameplay-modal-overlay-color) !important;');
    expect(collectiblesCss.match(/background(?:-color)?: var\(--cc-gameplay-modal-overlay-color\);/g)).toHaveLength(1);
    expect(collectiblesCss).toContain('.journey-card-flip-backdrop {');
    expect(collectiblesCss).toMatch(/\.journey-card-flip-backdrop \{[\s\S]*?background: var\(--cc-gameplay-modal-overlay-color\);[\s\S]*?opacity: 0;/);
    expect(css).not.toContain('background: rgba(233, 210, 200, 0.24) !important;');
  });

  test('uses the accepted centered tilt, bounce, paper, and shadow presentation', () => {
    expect(css).toContain('.simple-bottom-sheet.cc-gameplay-modal-stage {');
    expect(css).toContain('animation: cc-gameplay-modal-flip-in 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;');
    expect(css).toContain('animation: end-run-centered-modal-bounce-in 0.65s cubic-bezier(0.22, 1.18, 0.36, 1) both;');
    expect(css).toContain('animation: end-run-centered-modal-flip-out 0.65s cubic-bezier(0.4, 0, 0.2, 1) both;');
    expect(css).toContain('animation: end-run-centered-modal-bounce-out 0.65s cubic-bezier(0.4, 0, 0.2, 1) both;');
    expect(css).toContain('translate3d(0, var(--cc-modal-drag-release-y, 0px), 0) scale(1) rotate(var(--cc-modal-drag-release-tilt, 0deg))');
    expect(css).toContain('translate3d(0, calc(var(--cc-modal-drag-release-y, 0px) - 1px), 0) scale(1.012) rotate(-0.25deg)');
    expect(css).toContain('translate3d(0, -0.5px, 12px) rotateX(1.25deg) rotateY(-7deg) scale(1.008)');
    expect(css).not.toContain('translate3d(0, -4px, 0) scale(1.055) rotate(-0.5deg)');
    expect(css).toContain('0 13px 33.6px 0 rgba(185, 145, 119, 0.8)');
    expect(css).toContain('background: var(--bottom-sheet-paper-texture)');
    expect(css).toContain('animation: cc-gameplay-modal-idle-float 6.8s linear infinite both;');
    expect(css).toContain('@keyframes cc-gameplay-modal-idle-float');
    expect(css).toContain('translate3d(0, -3px, 3px) scale(1.003)');
    expect(css).toContain('translate3d(0, -3.75px, 4px) scale(1.004)');
    expect(css).toContain('translate3d(0, -4px, 8px) scale(1.015)');
    expect(css).toContain('translate3d(0, 1px, 0) scale(0.995)');
    expect(css).toContain('animation: cc-gameplay-modal-idle-shadow 6.8s ease-in-out infinite both;');
    expect(css).not.toContain('@keyframes cc-gameplay-modal-idle-tilt');
  });

  test('starts idle only after enter and keeps it on a transform-isolated owner', () => {
    expect(score).toContain("el.classList.add('cc-gameplay-modal-idle')");
    expect(css).toContain('.cc-gameplay-modal-idle:has(.cc-cta[data-cta-state="pressed"])');
    expect(css).toContain('.cc-gameplay-modal-touch-tilt-shell {');
    expect(css).toContain('.score-bottom-sheet .cc-gameplay-modal-idle-shell {\n  rotate: var(--score-modal-rest-tilt, 0deg);');
    expect(score.indexOf("setProperty('--score-modal-rest-tilt'"))
      .toBeLessThan(score.indexOf('document.body.appendChild(modalEl)'));
    const scoreDragConfig = score.slice(
      score.indexOf('installGameplayOverlayModalDragMotion(modalEl'),
      score.indexOf('}) : null;', score.indexOf('installGameplayOverlayModalDragMotion(modalEl')),
    );
    expect(scoreDragConfig).not.toContain('restTiltDeg');
  });

  test('reuses the Journey Stage stats enter and exit contract for HUD score and combo', () => {
    expect(score).toContain("from './detail-modal-stats-enter-motion.js'");
    expect(score).toContain('createDetailModalStatsEnterDelays(statElements.length)');
    expect(score).toContain('getDetailModalStatsEnterTotalDuration(statElements.length)');
    expect(score).toContain("element.classList.add('score-sheet-stat-entering')");
    expect(score).toContain("element.classList.add('score-sheet-stat-exiting')");
    expect(score).toContain('playScoreSheetStatsEnter(el);');
    expect(score).toContain('playScoreSheetStatsExit(modalEl);');
    expect(css).toContain('.score-bottom-sheet .score-sheet-stat-entering,');
    expect(css).toContain('animation-name: detailStatPopOut;');
    expect(css).toContain('animation-direction: reverse;');
  });

});
