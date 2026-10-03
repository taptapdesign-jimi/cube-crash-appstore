import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js';

export type GameplayRendererRecoveryFallbackAction = () => boolean | Promise<boolean>;

export interface GameplayRendererRecoveryFallbackOptions {
  reason: string;
  onRetry: GameplayRendererRecoveryFallbackAction;
  onReturnToMenu?: GameplayRendererRecoveryFallbackAction;
  document?: Document;
}

export interface GameplayRendererRecoveryFallbackController {
  element: HTMLDivElement;
  dispose: () => void;
  isCurrent: () => boolean;
}

type ActiveFallback = {
  element: HTMLDivElement;
  dispose: () => void;
};

let activeFallback: ActiveFallback | null = null;
let fallbackGeneration = 0;

const BUTTON_STYLE = [
  'min-width:132px',
  'min-height:48px',
  'padding:12px 20px',
  'border:0',
  'border-radius:16px',
  'font:700 16px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  'cursor:pointer',
  '-webkit-tap-highlight-color:transparent',
].join(';');

/**
 * Last-resort gameplay renderer surface.
 *
 * The core recovery owner keeps Pixi and the central input gate locked while
 * this DOM-only surface is visible. An action must explicitly resolve `true`
 * before the surface is removed; rejection or `false` keeps the safe fallback
 * mounted and actionable. The module owns no timer, animation, Pixi, audio or
 * gameplay state.
 */
export function showGameplayRendererRecoveryFallback(
  options: GameplayRendererRecoveryFallbackOptions,
): GameplayRendererRecoveryFallbackController | null {
  const documentRef = options.document ?? (typeof document !== 'undefined' ? document : null);
  if (!documentRef?.body) return null;

  activeFallback?.dispose();
  documentRef.getElementById('cc-gameplay-renderer-recovery')?.remove();

  const generation = ++fallbackGeneration;
  const root = documentRef.createElement('div');
  root.id = 'cc-gameplay-renderer-recovery';
  root.dataset.reason = options.reason;
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'cc-gameplay-renderer-recovery-title');
  root.setAttribute('aria-describedby', 'cc-gameplay-renderer-recovery-status');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:1295000',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'padding:max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))',
    'pointer-events:auto',
    'touch-action:manipulation',
    'color:#3f2b20',
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'text-align:center',
  ].join(';');
  applyAppPaperSurfaceToElement(root);

  const panel = documentRef.createElement('div');
  panel.style.cssText = [
    'width:min(100%, 420px)',
    'box-sizing:border-box',
    'padding:28px 22px',
    'border:2px solid rgba(79,52,35,0.18)',
    'border-radius:24px',
    'background:rgba(255,255,255,0.72)',
    'box-shadow:0 12px 34px rgba(58,37,24,0.16)',
  ].join(';');

  const title = documentRef.createElement('h2');
  title.id = 'cc-gameplay-renderer-recovery-title';
  title.textContent = 'Graphics paused';
  title.style.cssText = 'margin:0 0 10px;font-size:26px;line-height:1.1;';

  const status = documentRef.createElement('p');
  status.id = 'cc-gameplay-renderer-recovery-status';
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'The game board could not be restored safely. Your run is still protected.';
  status.style.cssText = 'margin:0 0 22px;font-size:16px;line-height:1.45;';

  const actions = documentRef.createElement('div');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;';

  const retryButton = documentRef.createElement('button');
  retryButton.type = 'button';
  retryButton.textContent = 'Try Again';
  retryButton.style.cssText = `${BUTTON_STYLE};background:#5f8e4e;color:#fff;`;
  actions.appendChild(retryButton);

  const returnButton = options.onReturnToMenu ? documentRef.createElement('button') : null;
  if (returnButton) {
    returnButton.type = 'button';
    returnButton.textContent = 'Return';
    returnButton.style.cssText = `${BUTTON_STYLE};background:#dfd0c4;color:#3f2b20;`;
    actions.appendChild(returnButton);
  }

  panel.append(title, status, actions);
  root.appendChild(panel);
  documentRef.body.appendChild(root);

  let disposed = false;
  let actionPending = false;
  const isCurrent = () => !disposed
    && fallbackGeneration === generation
    && activeFallback?.element === root
    && root.isConnected;

  const setPending = (pending: boolean): void => {
    actionPending = pending;
    retryButton.disabled = pending;
    retryButton.setAttribute('aria-disabled', String(pending));
    if (returnButton) {
      returnButton.disabled = pending;
      returnButton.setAttribute('aria-disabled', String(pending));
    }
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    retryButton.removeEventListener('click', handleRetry);
    returnButton?.removeEventListener('click', handleReturn);
    root.remove();
    if (activeFallback?.element === root) activeFallback = null;
  };

  const runAction = async (
    action: GameplayRendererRecoveryFallbackAction,
    pendingMessage: string,
  ): Promise<void> => {
    if (!isCurrent() || actionPending) return;
    setPending(true);
    status.textContent = pendingMessage;
    try {
      const completed = await action();
      if (!isCurrent()) return;
      if (completed === true) {
        dispose();
        return;
      }
      status.textContent = 'The board is still unavailable. Try again or return safely.';
    } catch {
      if (!isCurrent()) return;
      status.textContent = 'Recovery did not complete. Try again or return safely.';
    }
    if (isCurrent()) setPending(false);
  };

  function handleRetry(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    void runAction(options.onRetry, 'Restoring the game board…');
  }

  function handleReturn(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!options.onReturnToMenu) return;
    void runAction(options.onReturnToMenu, 'Returning safely…');
  }

  retryButton.addEventListener('click', handleRetry);
  returnButton?.addEventListener('click', handleReturn);
  activeFallback = { element: root, dispose };
  try { retryButton.focus({ preventScroll: true }); } catch {}

  return { element: root, dispose, isCurrent };
}

export function hideGameplayRendererRecoveryFallback(): void {
  activeFallback?.dispose();
}

export function isGameplayRendererRecoveryFallbackVisible(): boolean {
  return activeFallback?.element.isConnected === true;
}

export function resetGameplayRendererRecoveryFallbackForTests(): void {
  hideGameplayRendererRecoveryFallback();
  fallbackGeneration = 0;
}
