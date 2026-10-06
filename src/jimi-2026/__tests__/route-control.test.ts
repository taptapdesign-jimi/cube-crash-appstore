import fs from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const source = fs.readFileSync(path.resolve(__dirname, '../../..', 'scripts/qa/jimi-route-control.js'), 'utf8');
type Route = 'home' | 'hub' | 'beach';

function fixture(onClick?: () => void) {
  document.body.innerHTML = '<main id="jimi-root"></main><aside id="jimi-status">Presentation prototype · gameplay not connected</aside>';
  const host = document.getElementById('jimi-root')!;
  const roots = Object.fromEntries((['home', 'hub', 'beach'] as const).map(route => {
    const root = document.createElement('section');
    root.className = 'jimi-scene';
    root.dataset.jimiScene = route;
    root.hidden = route !== 'home';
    root.inert = false;
    host.append(root);
    return [route, root];
  })) as Record<Route, HTMLElement>;
  const clicks: Array<{ from: Route; to: Route }> = [];
  const add = (from: Route, to: Route, action: string, worldId?: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.jimiAction = action;
    if (worldId) button.dataset.worldId = worldId;
    button.addEventListener('click', () => {
      clicks.push({ from, to });
      roots[from].hidden = true;
      roots[to].hidden = false;
      onClick?.();
    });
    roots[from].append(button);
    return button;
  };
  const homeButton = add('home', 'hub', 'open-hub');
  add('hub', 'beach', 'open-world', '2');
  add('beach', 'hub', 'hub');
  add('hub', 'home', 'home');
  const postMessage = jest.fn();
  const start = () => runInNewContext(source, {
    window: {
      webkit: { messageHandlers: { consoleLog: { postMessage } } },
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
    },
    document, HTMLButtonElement, performance, setTimeout, clearTimeout,
  });
  const messages = () => postMessage.mock.calls.map(([receipt]) => receipt.message as string);
  return { host, roots, homeButton, clicks, postMessage, start, messages };
}

let hidden: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  jest.clearAllTimers();
  document.body.replaceChildren();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('exactly sixteen selected route clicks run with at most one pending task, then final destination is verified', () => {
  const f = fixture();
  const removeWindow = jest.spyOn(window, 'removeEventListener');
  const removeDocument = jest.spyOn(document, 'removeEventListener');
  f.start();
  expect(jest.getTimerCount()).toBe(1);
  jest.advanceTimersByTime(3999);
  expect(f.clicks).toHaveLength(0);
  for (let index = 0; index < 16; index++) {
    jest.advanceTimersToNextTimer();
    expect(f.clicks).toHaveLength(index + 1);
    expect(jest.getTimerCount()).toBe(1);
    expect(f.postMessage).not.toHaveBeenCalled();
  }
  expect(f.clicks).toEqual(Array.from({ length: 4 }, () => [
    { from: 'home', to: 'hub' }, { from: 'hub', to: 'beach' },
    { from: 'beach', to: 'hub' }, { from: 'hub', to: 'home' },
  ]).flat());
  expect(f.roots.home.hidden).toBe(false);
  jest.advanceTimersToNextTimer();
  expect(f.messages().filter(message => message.includes('] click '))).toHaveLength(16);
  const finalMessages = f.messages();
  expect(finalMessages[finalMessages.length - 1]).toBe('[JIMI_ROUTE_CONTROL] complete {"clicks":16}');
  expect(jest.getTimerCount()).toBe(0);
  expect(removeWindow).toHaveBeenCalledWith('pagehide', expect.any(Function));
  expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  jest.advanceTimersByTime(60_000);
  expect(f.clicks).toHaveLength(16);
});

test.each(['prototype', 'status', 'root', 'inert', 'expected', 'background'] as const)(
  'fails closed before touching a control when initial %s guard fails', guard => {
    const f = fixture();
    if (guard === 'prototype') document.getElementById('jimi-status')!.textContent = 'Original game';
    if (guard === 'status') document.getElementById('jimi-status')!.remove();
    if (guard === 'root') f.roots.home.remove();
    if (guard === 'inert') f.roots.home.inert = true;
    if (guard === 'expected') f.roots.home.dataset.jimiScene = 'beach';
    if (guard === 'background') hidden.mockReturnValue(true);
    f.start();
    jest.advanceTimersToNextTimer();
    expect(f.clicks).toHaveLength(0);
    expect(f.messages()).toHaveLength(1);
    expect(f.messages()[0]).toContain('[JIMI_ROUTE_CONTROL] failed ');
    expect(jest.getTimerCount()).toBe(0);
  },
);

test.each(['missing', 'wrong-element', 'disabled'] as const)('fails closed on a %s button', kind => {
  const f = fixture();
  if (kind === 'missing') f.homeButton.remove();
  if (kind === 'wrong-element') {
    const replacement = document.createElement('div');
    replacement.dataset.jimiAction = 'open-hub';
    f.homeButton.replaceWith(replacement);
  }
  if (kind === 'disabled') f.homeButton.disabled = true;
  f.start();
  jest.advanceTimersToNextTimer();
  expect(f.clicks).toHaveLength(0);
  expect(f.messages()[0]).toContain('[JIMI_ROUTE_CONTROL] failed-button ');
  expect(jest.getTimerCount()).toBe(0);
});

test('a changed expected destination stops instead of continuing a stale route sequence', () => {
  const f = fixture();
  f.start();
  jest.advanceTimersToNextTimer();
  f.roots.hub.hidden = true;
  f.roots.home.hidden = false;
  jest.advanceTimersToNextTimer();
  expect(f.clicks).toHaveLength(1);
  const finalMessages = f.messages();
  expect(finalMessages[finalMessages.length - 1]).toContain('failed {"index":1,"expected":"hub","actual":"home"}');
  expect(jest.getTimerCount()).toBe(0);
});

test.each(['pagehide', 'background'] as const)('%s cancels queued work and foreground does not resume it', event => {
  const f = fixture();
  f.start();
  jest.advanceTimersToNextTimer();
  if (event === 'pagehide') window.dispatchEvent(new Event('pagehide'));
  else { hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange')); }
  expect(jest.getTimerCount()).toBe(0);
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event('visibilitychange'));
  jest.advanceTimersByTime(60_000);
  expect(f.clicks).toHaveLength(1);
});

test.each(['pagehide', 'background'] as const)('synchronous %s inside a click cannot re-arm work after cancellation', event => {
  const f = fixture(() => {
    if (event === 'pagehide') window.dispatchEvent(new Event('pagehide'));
    else { hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange')); }
  });
  f.start();
  jest.advanceTimersToNextTimer();
  expect(f.clicks).toHaveLength(1);
  expect(jest.getTimerCount()).toBe(0);
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event('visibilitychange'));
  jest.advanceTimersByTime(60_000);
  expect(f.clicks).toHaveLength(1);
});
