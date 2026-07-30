export const APP_PAPER_BASE_COLOR = '#f3eee8';
export const APP_PAPER_OVERLAY =
  'linear-gradient(rgba(243,238,232,0.4), rgba(243,238,232,0.4))';
export const APP_PAPER_TEXTURE = "url('./assets/paper-bg.png')";
export const APP_PAPER_GRADIENT =
  'linear-gradient(180deg, #f3eee8 0%, #fcecdf 60%, #fcecdf 100%)';
export const APP_PAPER_BACKGROUND =
  `${APP_PAPER_OVERLAY}, ${APP_PAPER_TEXTURE} center/100% 100% no-repeat, ${APP_PAPER_GRADIENT}`;

/**
 * Paints a full-viewport/occluding surface with the canonical app paper.
 * Use this only when a screen must cover gameplay content beneath it.
 */
export const applyAppPaperSurfaceToElement = (element: HTMLElement): void => {
  element.style.setProperty('background', APP_PAPER_BACKGROUND, 'important');
  element.style.setProperty('background-color', APP_PAPER_BASE_COLOR, 'important');
  element.style.setProperty(
    'background-image',
    `${APP_PAPER_OVERLAY}, ${APP_PAPER_TEXTURE}, ${APP_PAPER_GRADIENT}`,
    'important'
  );
  element.style.setProperty('background-size', 'auto, 100% 100%, auto', 'important');
  element.style.setProperty('background-position', 'center, center, center', 'important');
  element.style.setProperty('background-repeat', 'no-repeat, no-repeat, no-repeat', 'important');
};

/**
 * Applies the canonical viewport paper to one visible owner: body.
 * HTML remains a solid fallback and #global-bg remains transparent, preventing
 * duplicate texture layers or slightly different viewport positioning.
 */
export function applyAppPaperBackground(): void {
  const html = document.documentElement;
  const body = document.body;
  const globalBg = document.getElementById('global-bg') as HTMLElement | null;
  const app = document.getElementById('app') as HTMLElement | null;

  html.style.setProperty('--app-gradient', APP_PAPER_BACKGROUND);
  html.style.setProperty('background', APP_PAPER_BASE_COLOR, 'important');
  html.style.setProperty('background-image', 'none', 'important');
  if (body) applyAppPaperSurfaceToElement(body);

  if (globalBg) {
    globalBg.style.setProperty('left', '0');
    globalBg.style.setProperty('right', '0');
    globalBg.style.setProperty('background', 'transparent', 'important');
    globalBg.style.setProperty('background-image', 'none', 'important');
  }

  if (app) {
    app.style.setProperty('background', 'transparent', 'important');
    app.style.setProperty('background-image', 'none', 'important');
  }
}
