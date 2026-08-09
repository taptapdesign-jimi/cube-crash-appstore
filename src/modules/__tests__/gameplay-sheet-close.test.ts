import { mountGameplaySheetClose } from '../gameplay-sheet-close';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');

describe('shared gameplay sheet close', () => {
  test('mounts one accessible paper close and activates dismiss only once', () => {
    const host = document.createElement('div');
    const dismiss = jest.fn();

    const controller = mountGameplaySheetClose(host, dismiss, 'Close Exit Game');
    const button = host.querySelector<HTMLButtonElement>('.gameplay-sheet-close');

    expect(button).toBe(controller.element);
    expect(button?.getAttribute('aria-label')).toBe('Close Exit Game');
    expect(button?.querySelector('img')?.getAttribute('src')).toBe('./assets/close-icon.png');

    button?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(button?.classList.contains('is-comic-bouncing')).toBe(true);
    button?.dispatchEvent(new Event('animationend'));
    expect(button?.classList.contains('is-comic-bouncing')).toBe(false);

    button?.click();
    button?.click();
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(button?.disabled).toBe(true);
    expect(button?.classList.contains('is-comic-bouncing')).toBe(true);

    controller.dispose();
    expect(host.querySelector('.gameplay-sheet-close')).toBeNull();
  });

  test('replaces a stale close control instead of duplicating it', () => {
    const host = document.createElement('div');
    const first = mountGameplaySheetClose(host, jest.fn());
    const second = mountGameplaySheetClose(host, jest.fn());

    expect(host.querySelectorAll('.gameplay-sheet-close')).toHaveLength(1);
    expect(host.querySelector('.gameplay-sheet-close')).toBe(second.element);

    first.dispose();
    second.dispose();
  });

  test('is shared by every active board gameplay modal family', () => {
    const endRunSource = fs.readFileSync(path.join(root, 'src/modules/end-run-modal.ts'), 'utf8');
    const scoreSource = fs.readFileSync(path.join(root, 'src/modules/score-bottom-sheet.ts'), 'utf8');
    const rewardSource = fs.readFileSync(path.join(root, 'src/modules/collectible-reward-bottom-sheet.ts'), 'utf8');
    const spatialSource = fs.readFileSync(path.join(root, 'src/modules/spatial-motion-permission-modal.ts'), 'utf8');
    const appCss = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
    const closePaperRule = appCss.match(
      /\.cc-gameplay-modal-gyro-shell > \.gameplay-sheet-close::before\s*\{([^}]*)\}/,
    )?.[1] ?? '';

    expect(endRunSource).toContain("modal.querySelector('.cc-gameplay-modal-idle-shell')");
    expect(endRunSource).toContain('mountGameplaySheetClose(endRunCloseHost');
    expect(scoreSource).toContain('mountGameplaySheetClose(scoreCloseHost');
    expect(rewardSource).toContain('mountGameplaySheetClose(');
    expect(spatialSource).toContain('mountGameplaySheetClose(dragShell, onDismiss)');
    expect(appCss).toContain('.cc-gameplay-modal-idle-shell > .gameplay-sheet-close,');
    expect(appCss).toContain('.cc-gameplay-modal-gyro-shell > .gameplay-sheet-close {');
    expect(closePaperRule).not.toContain('clip-path');
    expect(closePaperRule).toContain('background-image: var(--bottom-sheet-paper-texture)');
    expect(closePaperRule).toContain('border-radius: 50%');
    expect(appCss).toContain('.cc-gameplay-modal-idle-shell > .gameplay-sheet-close::after,');
    expect(appCss).toContain('.cc-gameplay-modal-gyro-shell > .gameplay-sheet-close::after {');
    expect(appCss).toContain('filter: drop-shadow(0 4px 6px rgba(185, 145, 119, 0.12))');
    expect(appCss).toContain('@keyframes gameplay-sheet-close-comic-bounce');
    expect(appCss).toContain('transform: translateZ(0) scale(1.18)');
    expect(appCss).toContain('transform: translateZ(0) scale(0.93)');
  });
});
