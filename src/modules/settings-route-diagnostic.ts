import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';
import { areDetailedRuntimeDiagnosticsEnabled } from '../utils/runtime-diagnostics-policy.js';

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

  // Provenance without computed-style/layout reads: capture the root gate and
  // authored child writes exactly at the owning handoff. No observer/ticker.
  const captureInlinePose = ['settings-enter-primed', 'settings-enter-revealed',
    'settings-focus-before', 'settings-focus-after'].includes(event);
  const root = captureInlinePose ? document.getElementById('settings-screen') : null;
  const settingsInlinePose = root ? {
    hidden: root.hidden,
    display: root.style.display,
    opacity: root.style.opacity,
    children: Array.from(root.querySelectorAll<HTMLElement>(
      '.settings-header, .settings-toggle-container, .settings-divider, .settings-footer',
    )).map(element => ({ className: element.className, transform: element.style.transform, opacity: element.style.opacity })),
  } : null;

  // Route markers remain available in compact captures, but resolving styles
  // and geometry after a visibility mutation can force the layout we measure.
  let elementSnapshot: SettingsRouteDiagnosticDetail = {};
  if (areDetailedRuntimeDiagnosticsEnabled()) {
    const activeSlide = document.querySelector('.slider-slide.active') as HTMLElement | null;
    elementSnapshot = {
      activeSlideIndex: activeSlide?.dataset.slide ?? null,
      home: readElementState(document.getElementById('home') as HTMLElement | null),
      sliderContainer: readElementState(document.getElementById('slider-container') as HTMLElement | null),
      sliderWrapper: readElementState(document.getElementById('slider-wrapper') as HTMLElement | null),
      activeSlide: readElementState(activeSlide),
      settingsScreen: readElementState(document.getElementById('settings-screen') as HTMLElement | null),
    };
  }
  const captureSource = event.startsWith('native-source-') || event.startsWith('settings-enter-')
    || event === 'settings-screen-mounted';
  const sourceInlinePose = captureSource ? ['home', 'slider-container', 'slider-wrapper', 'settings-screen'].map(id => {
    const element = document.getElementById(id);
    return { id, hidden: element?.hidden ?? null, display: element?.style.display ?? null,
      visibility: element?.style.visibility ?? null, opacity: element?.style.opacity ?? null };
  }) : undefined;
  emitNativeConsoleDiagnostic('[CC_SETTINGS_ROUTE]', event, {
    ...(captureSource ? { sourceInlinePose } : {}),
    appZone: (window as any).__ccAppZone ?? null,
    exitingToMenu: (window as any).exitingToMenu === true,
    ...(captureInlinePose ? { settingsInlinePose } : {}),
    ...elementSnapshot,
    ...detail,
  });
}
