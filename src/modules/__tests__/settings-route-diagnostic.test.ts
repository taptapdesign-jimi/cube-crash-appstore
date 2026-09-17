/** @jest-environment jsdom */
import { emitSettingsRouteDiagnostic } from '../settings-route-diagnostic';

let postMessage: jest.Mock;
beforeEach(() => {
  document.body.innerHTML = '<div id="home"></div><div id="slider-container"></div><div id="slider-wrapper"></div><div class="slider-slide active" data-slide="2"></div><div id="settings-screen"></div>';
  postMessage = jest.fn();
  (window as any).webkit = { messageHandlers: { consoleLog: { postMessage } } };
  (window as any).__ccAppZone = 'home';
  (window as any).exitingToMenu = true;
});
afterEach(() => {
  jest.restoreAllMocks(); document.body.innerHTML = '';
  for (const key of ['webkit', '__ccAppZone', 'exitingToMenu', '__ccDetailedRuntimeDiagnostics', '__ccPerformanceDiagnostics']) delete (window as any)[key];
});
function reads() {
  return [jest.spyOn(document, 'querySelector'), jest.spyOn(document, 'getElementById'),
    jest.spyOn(window, 'getComputedStyle'), jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect')] as const;
}
function payload() { return JSON.parse(postMessage.mock.calls[0][0].message.split('app-zone-set ')[1]); }

test.each([false, true])('compact route metadata never reads DOM/style/geometry (performance=%s)', (performanceCapture) => {
  (window as any).__ccPerformanceDiagnostics = performanceCapture;
  const spies = reads();
  emitSettingsRouteDiagnostic('app-zone-set', { reason: 'journey-enter', presentationEpoch: 3 });
  spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  expect(postMessage).toHaveBeenCalledTimes(1);
  expect(payload()).toEqual({ at: expect.any(Number), appZone: 'home', exitingToMenu: true, reason: 'journey-enter', presentationEpoch: 3 });
});

test('explicit detailed capture retains all five element snapshots and active slide identity', () => {
  (window as any).__ccDetailedRuntimeDiagnostics = true;
  const spies = reads();
  spies[3].mockReturnValue({ width: 390.2, height: 843.8 } as DOMRect);
  emitSettingsRouteDiagnostic('app-zone-set', { reason: 'debug-layout' });
  expect(spies[2]).toHaveBeenCalledTimes(5); expect(spies[3]).toHaveBeenCalledTimes(5);
  const data = payload();
  expect(data).toMatchObject({ appZone: 'home', activeSlideIndex: '2', reason: 'debug-layout' });
  for (const key of ['home', 'sliderContainer', 'sliderWrapper', 'activeSlide', 'settingsScreen']) {
    expect(data[key]).toMatchObject({ hidden: false, width: 390, height: 844, computedDisplay: 'block', computedVisibility: 'visible' });
    expect(data[key]).toHaveProperty('transform'); expect(data[key]).toHaveProperty('inlineOpacity');
  }
});

test('missing native bridge returns before all diagnostic DOM reads even when detailed', () => {
  delete (window as any).webkit;
  (window as any).__ccDetailedRuntimeDiagnostics = true;
  const spies = reads(); emitSettingsRouteDiagnostic('app-zone-set');
  spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  expect(postMessage).not.toHaveBeenCalled();
});
