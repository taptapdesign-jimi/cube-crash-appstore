let sequence = 0;

export function emitIOSSpecialTransactionTrace(
  event: string,
  detail: Record<string, unknown> = {},
): void {
  try {
    if (typeof window === 'undefined') return;
    if (!areDetailedRuntimeDiagnosticsEnabled()) return;
    if (!/iPad|iPhone|iPod/.test(navigator.userAgent)) return;
    const handler = (window as any).webkit?.messageHandlers?.consoleLog;
    if (!handler?.postMessage) return;
    handler.postMessage({
      level: 'info',
      message: `[CC_SPECIAL_TX] ${event} ${JSON.stringify({
        seq: ++sequence,
        at: Math.round(performance.now()),
        magnetPullRuntime: (window as any).__ccWildMagnetPullInProgress === true,
        activeMagnetCleanup: typeof (window as any).__ccActiveMagnetPullCleanup === 'function',
        tntActive: (window as any).__ccTntAnimationActive === true,
        tntDragBlocked: (window as any).__ccTntDragBlocked === true,
        ...detail,
      })}`,
    });
  } catch {}
}
import { areDetailedRuntimeDiagnosticsEnabled } from './runtime-diagnostics-policy.js';
