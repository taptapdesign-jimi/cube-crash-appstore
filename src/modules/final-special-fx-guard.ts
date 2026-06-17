type FinalSpecialFxKind = 'magnet' | 'juice' | 'star' | 'tnt';

const GUARD_WINDOW_MS = 6000;

function readStore(): Record<string, number> {
  try {
    const raw = (window as any).__ccFinalSpecialFxGuards;
    if (raw && typeof raw === 'object') return raw as Record<string, number>;
  } catch {}
  return {};
}

function writeStore(store: Record<string, number>): void {
  try {
    (window as any).__ccFinalSpecialFxGuards = store;
  } catch {}
}

function keyFor(kind: FinalSpecialFxKind): string {
  return `final_${kind}`;
}

export function markFinalSpecialFxTriggered(kind: FinalSpecialFxKind): void {
  const store = readStore();
  store[keyFor(kind)] = Date.now() + GUARD_WINDOW_MS;
  writeStore(store);
}

export function wasFinalSpecialFxRecentlyTriggered(kind: FinalSpecialFxKind): boolean {
  const store = readStore();
  const until = Number(store[keyFor(kind)] || 0);
  return until > Date.now();
}

export function shouldStartFinalSpecialFx(kind: FinalSpecialFxKind): boolean {
  if (wasFinalSpecialFxRecentlyTriggered(kind)) return false;
  markFinalSpecialFxTriggered(kind);
  return true;
}
