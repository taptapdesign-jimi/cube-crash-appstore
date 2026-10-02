import fs from 'node:fs';
import path from 'node:path';

const mockPlayNavIconCartoonBounce = jest.fn();
jest.mock('../../utils/nav-icon-bounce.js', () => ({
  playNavIconCartoonBounce: mockPlayNavIconCartoonBounce,
}));

import { mountGameplaySheetClose } from '../gameplay-sheet-close';

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
    expect(mockPlayNavIconCartoonBounce).toHaveBeenCalledWith(button);

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    button?.click();
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(button?.disabled).toBe(true);
    expect(mockPlayNavIconCartoonBounce).toHaveBeenCalledTimes(1);

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
    const appCss = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
    const closePaperRule = appCss.match(
      /\.cc-gameplay-modal-pose-shell > \.gameplay-sheet-close::before\s*\{([^}]*)\}/,
    )?.[1] ?? '';

    expect(endRunSource).toContain("modal.querySelector('.cc-gameplay-modal-pose-shell')");
    expect(endRunSource).toContain('mountGameplaySheetClose(endRunCloseHost');
    expect(scoreSource).toContain('mountGameplaySheetClose(scoreCloseHost');
    expect(appCss).toContain('.cc-gameplay-modal-idle-shell > .gameplay-sheet-close,');
    expect(appCss).toContain('.cc-gameplay-modal-pose-shell > .gameplay-sheet-close {');
    expect(closePaperRule).not.toContain('clip-path');
    expect(closePaperRule).toContain('background-image: var(--bottom-sheet-paper-texture)');
    expect(closePaperRule).toContain('border-radius: 50%');
    expect(appCss).toContain('.cc-gameplay-modal-idle-shell > .gameplay-sheet-close::after,');
    expect(appCss).toContain('.cc-gameplay-modal-pose-shell > .gameplay-sheet-close::after {');
    expect(appCss).toContain('filter: drop-shadow(0 4px 6px rgba(185, 145, 119, 0.12))');
    expect(appCss).not.toContain('@keyframes gameplay-sheet-close-comic-bounce');
    expect(appCss).not.toContain('.gameplay-sheet-close.is-comic-bouncing');
  });
});
