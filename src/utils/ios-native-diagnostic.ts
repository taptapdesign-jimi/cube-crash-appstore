export function emitNativeConsoleDiagnostic(
  prefix: string,
  event: string,
  detail: Record<string, unknown> = {},
): void {
  try {
    const handler = (window as any).webkit?.messageHandlers?.consoleLog;
    if (!handler?.postMessage) return;
    handler.postMessage({
      level: 'info',
      message: `${prefix} ${event} ${JSON.stringify({
        at: Math.round(performance.now()),
        ...detail,
      })}`,
    });
  } catch {}
}

export function emitIOSNativeDiagnostic(event: string, detail: Record<string, unknown> = {}): void {
  try {
    // The bundled app does not install this bridge in ordinary play. Bail out
    // before querying Journey DOM/state so disabled diagnostics stay free.
    const handler = (window as any).webkit?.messageHandlers?.consoleLog;
    if (!handler?.postMessage) return;
    const screen = document.getElementById('journey-screen') as HTMLElement | null;
    emitNativeConsoleDiagnostic('🧭 FailJourneyEnter', event, {
        returning: (window as any).__ccReturningFromDetailModal === true,
        returnBoardId: (window as any).__ccJourneyReturnBoardId ?? null,
        activeBoardId: (window as any).__ccLastActiveJourneyBoardAreaId ?? null,
        pending: (window as any).__ccJourneyActiveAreaEnterPending === true,
        prepared: (window as any).__ccJourneyViewportEnterPrepared === true,
        animating: (window as any).__ccJourneyViewportEnterAnimating === true,
        screen: screen ? {
          hidden: screen.hidden,
          classHidden: screen.classList.contains('hidden'),
          display: screen.style.display || null,
          visibility: screen.style.visibility || null,
          opacity: screen.style.opacity || null,
          primed: screen.dataset.ccJourneyPrimedHidden ?? null,
        } : null,
        ...detail,
    });
  } catch {}
}
