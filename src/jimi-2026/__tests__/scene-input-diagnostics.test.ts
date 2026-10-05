import { createSceneInputDiagnostics } from '../scene-input-diagnostics';
import { emitNativeConsoleDiagnostic } from '../../utils/ios-native-diagnostic';

jest.mock('../../utils/ios-native-diagnostic', () => ({ emitNativeConsoleDiagnostic: jest.fn() }));
const emit = emitNativeConsoleDiagnostic as jest.MockedFunction<typeof emitNativeConsoleDiagnostic>;
function fixture() {
  const host = document.createElement('main');
  host.innerHTML = '<section class="jimi-scene" data-jimi-scene="beach"><div class="jimi-scroll" style="overflow-y:auto;touch-action:pan-y"><button disabled>Stage</button></div></section>';
  document.body.append(host);
  const root = host.firstElementChild as HTMLElement;
  const scroll = host.querySelector<HTMLElement>('.jimi-scroll')!;
  const button = host.querySelector('button')!;
  Object.defineProperty(scroll, 'scrollHeight', { configurable: true, get: () => 1900 });
  Object.defineProperty(scroll, 'clientHeight', { configurable: true, get: () => 844 });
  return { host, root, scroll, button };
}
function input(target: EventTarget, type: string, x = 40, y = 600): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (type.startsWith('touch')) {
    Object.defineProperty(event, 'changedTouches', { value: [{ clientX: x, clientY: y }] });
    Object.defineProperty(event, 'touches', { value: /end|cancel/.test(type) ? [] : [{ clientX: x, clientY: y }] });
  } else {
    Object.defineProperties(event, { clientX: { value: x }, clientY: { value: y }, pointerType: { value: 'touch' } });
  }
  target.dispatchEvent(event);
  return event;
}
beforeEach(() => emit.mockClear());
afterEach(() => { document.body.replaceChildren(); jest.restoreAllMocks(); });

test('disabled diagnostics allocate no listeners and read no DOM/style/geometry', () => {
  const f = fixture();
  const listen = jest.spyOn(f.host, 'addEventListener');
  const query = jest.spyOn(f.host, 'querySelector');
  const computed = jest.spyOn(window, 'getComputedStyle');
  const geometry = jest.spyOn(f.scroll, 'scrollHeight', 'get');
  const dispose = createSceneInputDiagnostics(f.host, false);
  input(f.button, 'pointerdown'); dispose(); dispose();
  expect(listen).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
  expect(computed).not.toHaveBeenCalled(); expect(geometry).not.toHaveBeenCalled(); expect(emit).not.toHaveBeenCalled();
});

test('mixed pointer/touch input is aggregated and pointercancel then touchend both report native handoff', () => {
  const f = fixture();
  const dispose = createSceneInputDiagnostics(f.host, true);
  f.root.inert = true; f.host.inert = true;
  input(f.button, 'pointerdown'); input(f.button, 'touchstart');
  input(f.button, 'pointermove', 41, 450); input(f.button, 'touchmove', 41, 450);
  input(f.button, 'pointercancel', 41, 450);
  f.scroll.scrollTop = 150;
  f.scroll.dispatchEvent(new Event('scroll'));
  input(f.button, 'touchend', 41, 400);
  expect(emit.mock.calls.map(call => call[1])).toEqual(['start', 'end', 'scroll', 'end']);
  expect(emit.mock.calls[0][2]).toMatchObject({ gesture: 1, event: 'pointerdown', isTrusted: false,
    targetTag: 'BUTTON', targetDisabled: true, rootInert: true, hostInert: true,
    scrollHeight: 1900, clientHeight: 844, overflowY: 'auto', x: 40, y: 600 });
  expect(emit.mock.calls[3][2]).toMatchObject({ gesture: 1, event: 'touchend', scrollTop: 150,
    x: 41, y: 400, counts: { pointerdown: 1, touchstart: 1, pointermove: 1, touchmove: 1,
      pointercancel: 1, scroll: 1, touchend: 1 }, trustedEvents: 0 });
  dispose();
});

test('move storms do not read layout or emit and momentum receipts stay bounded', () => {
  const f = fixture();
  const computed = jest.spyOn(window, 'getComputedStyle');
  const geometry = jest.spyOn(f.scroll, 'scrollHeight', 'get');
  const dispose = createSceneInputDiagnostics(f.host, true);
  input(f.button, 'pointerdown');
  for (let i = 0; i < 100; i++) input(f.button, 'pointermove', 40, 600 - i);
  expect(emit).toHaveBeenCalledTimes(1); expect(computed).toHaveBeenCalledTimes(1); expect(geometry).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 100; i++) f.scroll.dispatchEvent(new Event('scroll'));
  input(f.button, 'pointerup', 40, 400);
  expect(emit.mock.calls.filter(call => call[1] === 'scroll')).toHaveLength(4);
  expect(emit.mock.calls).toHaveLength(6);
  expect(emit.mock.calls[5][2]).toMatchObject({ counts: { pointermove: 100, scroll: 100 } });
  expect(computed).toHaveBeenCalledTimes(2); expect(geometry).toHaveBeenCalledTimes(2);
  dispose();
});

test('listeners are passive and observational; cleanup removes every listener exactly once', () => {
  const f = fixture();
  const add = jest.spyOn(f.host, 'addEventListener');
  const remove = jest.spyOn(f.host, 'removeEventListener');
  const prevent = jest.spyOn(Event.prototype, 'preventDefault');
  const dispose = createSceneInputDiagnostics(f.host, true);
  expect(add).toHaveBeenCalledTimes(9);
  add.mock.calls.forEach(call => expect(call[2]).toEqual({ capture: true, passive: true }));
  const before = f.host.innerHTML;
  input(f.button, 'touchstart'); input(f.button, 'touchmove'); input(f.button, 'touchcancel');
  expect(prevent).not.toHaveBeenCalled(); expect(f.scroll.scrollTop).toBe(0); expect(f.host.innerHTML).toBe(before);
  dispose(); dispose();
  expect(remove).toHaveBeenCalledTimes(9);
  const receiptCount = emit.mock.calls.length;
  input(f.button, 'pointerdown'); f.scroll.dispatchEvent(new Event('scroll'));
  expect(emit).toHaveBeenCalledTimes(receiptCount);
});

test('new gestures reset bounded counters and use the current visible scene, not retained old DOM', () => {
  const f = fixture(); const dispose = createSceneInputDiagnostics(f.host, true);
  input(f.button, 'pointerdown'); input(f.button, 'pointerup');
  f.root.hidden = true;
  const current = document.createElement('section'); current.className = 'jimi-scene'; current.dataset.jimiScene = 'hub';
  current.innerHTML = '<div class="jimi-scroll"></div>'; f.host.append(current);
  input(f.host, 'pointerdown'); input(f.host, 'pointerup');
  expect(emit.mock.calls[2][2]).toMatchObject({ gesture: 2, scene: 'hub', counts: { pointerdown: 1 } });
  dispose();
});

test('records pre-existing prevention honestly as capture-time evidence without changing it', () => {
  const f = fixture(); const dispose = createSceneInputDiagnostics(f.host, true);
  const event = new Event('touchstart', { bubbles: true, cancelable: true }); event.preventDefault();
  f.button.dispatchEvent(event);
  expect(emit.mock.calls[0][2]).toMatchObject({ defaultPreventedAtCapture: true, preventedAtCapture: 1 });
  dispose();
});

test('native scroll without DOM touch delivery still has one bounded initial geometry receipt', () => {
  const f = fixture(); const dispose = createSceneInputDiagnostics(f.host, true);
  for (let i = 0; i < 30; i++) f.scroll.dispatchEvent(new Event('scroll'));
  expect(emit).toHaveBeenCalledTimes(4);
  expect(emit.mock.calls[0][2]).toMatchObject({ event: 'scroll', gesture: 1, scrollHeight: 1900, clientHeight: 844 });
  input(f.button, 'pointerdown');
  expect(emit.mock.calls[4][2]).toMatchObject({ gesture: 2, counts: { pointerdown: 1 } });
  dispose();
});
