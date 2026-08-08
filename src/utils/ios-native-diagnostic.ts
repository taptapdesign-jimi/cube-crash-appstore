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
    const screen = document.getElementById('journey-screen') as HTMLElement | null;
    const style = screen ? getComputedStyle(screen) : null;
    emitNativeConsoleDiagnostic('🧭 FailJourneyEnter', event, {
        returning: (window as any).__ccReturningFromDetailModal === true,
        returnBoardId: (window as any).__ccJourneyReturnBoardId ?? null,
        activeBoardId: (window as any).__ccLastActiveJourneyBoardAreaId ?? null,
        pending: (window as any).__ccJourneyActiveAreaEnterPending === true,
        prepared: (window as any).__ccJourneyViewportEnterPrepared === true,
        animating: (window as any).__ccJourneyViewportEnterAnimating === true,
        screen: screen ? {
          hidden: screen.hidden,
          display: style?.display,
          visibility: style?.visibility,
          opacity: style?.opacity,
          primed: screen.dataset.ccJourneyPrimedHidden ?? null,
        } : null,
        ...detail,
    });
  } catch {}
}
