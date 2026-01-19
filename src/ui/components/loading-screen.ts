// @ts-nocheck
// Loading Screen Component
import { HTMLBuilder, HTMLElementConfig } from './html-builder.js';

export function createLoadingScreen(): HTMLElementConfig {
  return {
    tag: 'div',
    id: 'loading-screen',
    className: 'loading-screen',
    attributes: {
      style: 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 10000; display: flex; align-items: center; justify-content: center; background: #F9F9F9;'
    },
    children: [
      {
        tag: 'div',
        className: 'loading-content',
        children: [
          // 🔥 PREMIUM: Phase 1 - White background with taptapdesign logo (shown first, 2 seconds)
          {
            tag: 'div',
            className: 'loading-logo-taptap',
            children: [
              {
                tag: 'img',
                id: 'loading-logo-taptap',
                attributes: {
                  src: './assets/taptapdesign.png',
                  alt: 'TapTap Design',
                  loading: 'eager',
                  fetchpriority: 'high',
                },
              },
            ],
          },
          // 🔥 PREMIUM: Phase 2 - Gradient background with stack to six logo + smokeandshards background
          {
            tag: 'div',
            className: 'loading-logo-stack',
            style: 'display: none;',
            children: [
              // Smoke and shards background image (behind logo)
              {
                tag: 'img',
                id: 'loading-smoke-shards',
                className: 'loading-smoke-shards',
                attributes: {
                  src: './assets/logo addons/smokeandshards.png',
                  alt: '',
                  loading: 'eager',
                  fetchpriority: 'high',
                },
              },
              // Stack to six logo (in front)
              {
                tag: 'img',
                id: 'loading-logo-stack',
                className: 'loading-logo-stack-img',
                attributes: {
                  src: './assets/logo-cube-crash.png',
                  alt: 'CubeCrash',
                  loading: 'eager',
                  fetchpriority: 'high',
                },
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
