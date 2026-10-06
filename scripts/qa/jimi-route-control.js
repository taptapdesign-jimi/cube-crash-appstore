/* TEMP Simulator-shell WKUserScript only. Not imported by Jimi or production.
 * Synthetic clicks isolate native touch/XCTest overhead; NEVER touch acceptance.
 * One finite sequence, one timeout, no observers or changes to scene internals. */
(() => {
  let timer;
  let stopped = false;
  const emit = (event, detail = {}) => {
    window.webkit?.messageHandlers?.consoleLog?.postMessage({
      level: 'info', message: `[JIMI_ROUTE_CONTROL] ${event} ${JSON.stringify(detail)}`,
    });
  };
  const steps = Array.from({ length: 4 }, (_, pass) => [
    ['home', '[data-jimi-action="open-hub"]', 'hub'],
    ['hub', '[data-world-id="2"]', 'beach'],
    ['beach', '[data-jimi-action="hub"]', 'hub'],
    ['hub', '[data-jimi-action="home"]', 'home'],
  ].map(([from, selector, to]) => ({ pass, from, selector, to }))).flat();
  let index = 0;
  const clickReceipts = [];
  let expected = 'home';
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener('pagehide', stop);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  const onVisibility = () => { if (document.hidden) stop(); };
  const next = () => {
    if (stopped) return;
    const root = document.querySelector('#jimi-root > .jimi-scene:not([hidden])');
    if (!document.getElementById('jimi-status')?.textContent.includes('Presentation prototype')
      || !root || root.inert || root.dataset.jimiScene !== expected || document.hidden) {
      emit('failed', { index, expected, actual: root?.dataset.jimiScene });
      stop();
      return;
    }
    const step = steps[index++];
    if (!step) {
      // No console bridge work at the tap/first-frame boundary. The bounded
      // receipts are emitted only after the final destination has settled.
      clickReceipts.forEach(receipt => emit('click', receipt));
      emit('complete', { clicks: index - 1 }); stop(); return;
    }
    const button = root.querySelector(step.selector);
    if (!(button instanceof HTMLButtonElement) || button.disabled) {
      emit('failed-button', { index, selector: step.selector }); stop(); return;
    }
    expected = step.to;
    clickReceipts.push({ index, ...step, at: performance.now() });
    button.click();
    if (!stopped) timer = setTimeout(next, 3000);
  };
  window.addEventListener('pagehide', stop, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
  timer = setTimeout(next, 4000);
})();
