// public/src/main.js
import { boot } from './modules/app.js';

(async () => {
  try {
    if (document.readyState === 'loading') {
      await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }
    if (!document.getElementById('app')) {
      const host = document.createElement('div'); host.id = 'app'; document.body.appendChild(host);
    }
    await boot();
    console.log('[CC] boot OK');
  } catch (e) {
    console.error('[CC] boot failed:', e);
  }
})();