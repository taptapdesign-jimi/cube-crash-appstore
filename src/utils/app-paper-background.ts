export const APP_PAPER_BASE_COLOR = '#f3eee8';
export const APP_PAPER_OVERLAY =
  'linear-gradient(rgba(243,238,232,0.4), rgba(243,238,232,0.4))';
export const APP_PAPER_TEXTURE = "url('./assets/paper-bg.png')";
export const APP_PAPER_GRADIENT =
  'linear-gradient(180deg, #f3eee8 0%, #fcecdf 60%, #fcecdf 100%)';
export const APP_PAPER_BACKGROUND =
  `${APP_PAPER_OVERLAY}, ${APP_PAPER_TEXTURE} center/100% 100% no-repeat, ${APP_PAPER_GRADIENT}`;

const applyPaperSurfaceToElement = (element: HTMLElement): void => {
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
 * Applies the exact launch/preloader paper surface to every global background owner.
 * Screen containers remain transparent so the texture keeps one viewport-relative position.
 */
export function applyAppPaperBackground(): void {
  const html = document.documentElement;
  const body = document.body;
  const globalBg = document.getElementById('global-bg') as HTMLElement | null;
  const app = document.getElementById('app') as HTMLElement | null;

  html.style.setProperty('--app-gradient', APP_PAPER_BACKGROUND);
  applyPaperSurfaceToElement(html);
  if (body) applyPaperSurfaceToElement(body);

  if (globalBg) {
    globalBg.style.setProperty('left', '0');
    globalBg.style.setProperty('right', '0');
    applyPaperSurfaceToElement(globalBg);
  }

  if (app) {
    app.style.setProperty('background', 'transparent', 'important');
    app.style.setProperty('background-image', 'none', 'important');
  }
}
