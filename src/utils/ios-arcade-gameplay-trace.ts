let traceSequence = 0;

export function emitIOSArcadeGameplayTrace(
  event: string,
  detail: Record<string, unknown> = {},
): void {
  try {
    if (typeof window === 'undefined') return;
    if ((window as any).__ccRunMode !== 'arcade_home') return;
    if (!/iPad|iPhone|iPod/.test(navigator.userAgent)) return;

    const handler = (window as any).webkit?.messageHandlers?.consoleLog;
    if (!handler?.postMessage) return;

    handler.postMessage({
      level: 'info',
      message: `[CC_ARCADE_TRACE] ${event} ${JSON.stringify({
        seq: ++traceSequence,
        at: Math.round(performance.now()),
        ...detail,
      })}`,
    });
  } catch {}
}
