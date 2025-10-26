// Loading Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export function createLoadingScreen(): HTMLElementConfig {
  return {
    tag: 'div',
    id: 'loading-screen',
    className: 'loading-screen',
    attributes: {
      style: 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 10000; display: flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #f5f5f5 0%, rgba(252, 236, 223, 0.92) 60%, #fcecdf 100%);'
    },
    children: [
      {
        tag: 'div',
        className: 'loading-content',
        children: [
          {
            tag: 'div',
            className: 'loading-logo',
            children: [
              {
                tag: 'img',
                attributes: {
                  src: './assets/logo-cube-crash.png',
                  alt: 'CubeCrash',
                  loading: 'eager',
                  fetchpriority: 'high',
                },
              },
            ],
          },
          {
            tag: 'div',
            className: 'loading-text',
            text: 'Loading...',
          },
          {
            tag: 'div',
            className: 'loading-progress',
            children: [
              {
                tag: 'div',
                id: 'loading-percentage',
                className: 'loading-percentage',
                text: '0',
                attributes: {
                  role: 'status',
                  'aria-live': 'polite',
                  'aria-atomic': 'true',
                },
              },
              {
                tag: 'div',
                className: 'loading-bar-container',
                attributes: {
                  role: 'progressbar',
                  'aria-valuemin': '0',
                  'aria-valuemax': '100',
                  'aria-valuenow': '0',
                  'aria-label': 'Loading progress',
                },
                children: [
                  {
                    tag: 'div',
                    id: 'loading-fill',
                    className: 'loading-bar',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

export function renderLoadingScreen(container: HTMLElement): void {
  const config = createLoadingScreen();
  const element = HTMLBuilder.createElement(config);
  container.appendChild(element);
}
