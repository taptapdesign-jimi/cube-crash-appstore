import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

type SettingsRouteDiagnosticDetail = Record<string, unknown>;

function readElementState(element: HTMLElement | null): Record<string, unknown> | null {
  if (!element) return null;
  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    hidden: element.hidden,
    ariaHidden: element.getAttribute('aria-hidden'),
    classes: element.className,
    inlineDisplay: element.style.display || null,
    inlineVisibility: element.style.visibility || null,
    inlineOpacity: element.style.opacity || null,
    computedDisplay: computed.display,
    computedVisibility: computed.visibility,
    computedOpacity: computed.opacity,
    pointerEvents: computed.pointerEvents,
    transform: computed.transform,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function emitSettingsRouteDiagnostic(
  event: string,
  detail: SettingsRouteDiagnosticDetail = {},
): void {
  const nativeConsoleHandler = (window as any).webkit?.messageHandlers?.consoleLog;
  if (!nativeConsoleHandler?.postMessage) return;

  const activeSlide = document.querySelector('.slider-slide.active') as HTMLElement | null;
  emitNativeConsoleDiagnostic('[CC_SETTINGS_ROUTE]', event, {
    appZone: (window as any).__ccAppZone ?? null,
    exitingToMenu: (window as any).exitingToMenu === true,
    activeSlideIndex: activeSlide?.dataset.slide ?? null,
    home: readElementState(document.getElementById('home') as HTMLElement | null),
    sliderContainer: readElementState(document.getElementById('slider-container') as HTMLElement | null),
    sliderWrapper: readElementState(document.getElementById('slider-wrapper') as HTMLElement | null),
    activeSlide: readElementState(activeSlide),
    settingsScreen: readElementState(document.getElementById('settings-screen') as HTMLElement | null),
    ...detail,
  });
}
