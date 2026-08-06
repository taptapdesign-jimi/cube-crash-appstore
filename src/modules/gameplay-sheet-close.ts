export interface GameplaySheetCloseController {
  element: HTMLButtonElement;
  dispose: () => void;
}

/**
 * Shared close control for modal surfaces owned by board gameplay.
 *
 * The control owns only input presentation. The host supplies its existing
 * dismiss lifecycle so close, backdrop tap, and drag dismissal cannot diverge.
 */
export function mountGameplaySheetClose(
  host: HTMLElement,
  onDismiss: () => void,
  ariaLabel = 'Close',
): GameplaySheetCloseController {
  host.querySelector('.gameplay-sheet-close')?.remove();

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gameplay-sheet-close';
  button.setAttribute('aria-label', ariaLabel);
  button.innerHTML = `
    <img
      src="./assets/close-icon.png"
      srcset="./assets/close-icon.png 1x, ./assets/close-icon@3x.png 2x, ./assets/close-icon@3x.png 3x"
      alt=""
      draggable="false"
    >
  `;

  let activated = false;
  const stopSheetDrag = (event: Event) => {
    event.stopPropagation();
  };
  const playComicBounce = () => {
    button.classList.remove('is-comic-bouncing');
    void button.offsetWidth;
    button.classList.add('is-comic-bouncing');
  };
  const handlePointerDown = (event: PointerEvent) => {
    stopSheetDrag(event);
    if (!activated) playComicBounce();
  };
  const clearComicBounce = () => {
    button.classList.remove('is-comic-bouncing');
  };
  const activate = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (activated) return;
    activated = true;
    if (!button.classList.contains('is-comic-bouncing')) playComicBounce();
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    onDismiss();
  };

  button.addEventListener('pointerdown', handlePointerDown);
  button.addEventListener('mousedown', stopSheetDrag);
  button.addEventListener('touchstart', stopSheetDrag, { passive: true });
  button.addEventListener('click', activate);
  button.addEventListener('animationend', clearComicBounce);
  host.appendChild(button);

  return {
    element: button,
    dispose: () => {
      button.removeEventListener('pointerdown', handlePointerDown);
      button.removeEventListener('mousedown', stopSheetDrag);
      button.removeEventListener('touchstart', stopSheetDrag);
      button.removeEventListener('click', activate);
      button.removeEventListener('animationend', clearComicBounce);
      button.remove();
    },
  };
}
