import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

type Gesture = {
  id: number;
  counts: Record<string, number>;
  families: Set<string>;
  endings: Set<string>;
  trustedEvents: number;
  preventedAtCapture: number;
  scrollReceipts: number;
  receipts: number;
};

/** Opt-in evidence only. Never cancels input, captures a pointer, writes a pose,
 * changes scroll position or schedules work. Dispose belongs to the host owner. */
export function createSceneInputDiagnostics(host: HTMLElement, enabled: boolean): () => void {
  if (!enabled) return () => {};
  const lifecycle = createScreenLifecycle('jimi-input-diagnostics');
  let disposed = false;
  let sequence = 0;
  let gesture: Gesture | undefined;

  const scrollFor = (event: Event): HTMLElement | null => {
    const target = event.target instanceof Element ? event.target : null;
    const ownScroll = target?.closest<HTMLElement>('.jimi-scroll');
    return ownScroll && host.contains(ownScroll) ? ownScroll
      : host.querySelector<HTMLElement>('.jimi-scene:not([hidden]) .jimi-scroll');
  };
  const coordinates = (event: Event) => {
    const touchEvent = event as TouchEvent;
    const point = touchEvent.changedTouches?.[0] ?? touchEvent.touches?.[0] ?? event as PointerEvent;
    return { x: Number.isFinite(point.clientX) ? point.clientX : null,
      y: Number.isFinite(point.clientY) ? point.clientY : null };
  };
  const snapshot = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    const scroll = scrollFor(event);
    const root = scroll?.closest<HTMLElement>('.jimi-scene')
      ?? target?.closest<HTMLElement>('.jimi-scene')
      ?? host.querySelector<HTMLElement>('.jimi-scene:not([hidden])');
    const style = scroll ? window.getComputedStyle(scroll) : null;
    return {
      scene: root?.dataset.jimiScene ?? null,
      rootInert: root?.inert === true,
      hostInert: host.inert === true,
      inertAncestor: !!target?.closest('[inert]'),
      rootHidden: root?.hidden ?? null,
      documentHidden: document.hidden,
      targetTag: target?.tagName ?? null,
      targetDisabled: target?.closest<HTMLButtonElement>('button')?.disabled ?? false,
      targetInScroll: !!target?.closest('.jimi-scroll'),
      scrollTop: scroll?.scrollTop ?? null,
      scrollHeight: scroll?.scrollHeight ?? null,
      clientHeight: scroll?.clientHeight ?? null,
      overflowY: style?.overflowY ?? null,
      touchAction: style?.touchAction ?? null,
    };
  };
  const emit = (phase: string, event: Event, fullSnapshot: boolean) => {
    if (!gesture || gesture.receipts >= 8) return;
    gesture.receipts++;
    emitNativeConsoleDiagnostic('[JIMI_INPUT]', phase, {
      gesture: gesture.id, event: event.type, isTrusted: event.isTrusted,
      cancelable: event.cancelable, defaultPreventedAtCapture: event.defaultPrevented,
      pointerType: (event as PointerEvent).pointerType ?? null,
      ...coordinates(event), counts: { ...gesture.counts },
      trustedEvents: gesture.trustedEvents, preventedAtCapture: gesture.preventedAtCapture,
      ...(fullSnapshot ? snapshot(event) : { scrollTop: scrollFor(event)?.scrollTop ?? null }),
    });
  };
  const observe = (event: Event) => {
    if (disposed) return;
    const start = event.type === 'pointerdown' || event.type === 'touchstart';
    const family = event.type.startsWith('touch') ? 'touch' : 'pointer';
    if ((start && (!gesture || gesture.families.size === 0 || gesture.families.has(family) || gesture.endings.size > 0))
      || (!gesture && event.type === 'scroll')) {
      gesture = { id: ++sequence, counts: {}, families: new Set(), endings: new Set(),
        trustedEvents: 0, preventedAtCapture: 0, scrollReceipts: 0, receipts: 0 };
    }
    if (!gesture) return;
    gesture.counts[event.type] = (gesture.counts[event.type] ?? 0) + 1;
    if (event.isTrusted) gesture.trustedEvents++;
    if (event.defaultPrevented) gesture.preventedAtCapture++;
    if (start) {
      gesture.families.add(family);
      if (gesture.receipts === 0) emit('start', event, true);
    } else if (event.type === 'scroll') {
      // Keep a small native momentum receipt after pointercancel/touchend too.
      if (gesture.scrollReceipts < 4) {
        gesture.scrollReceipts++;
        emit('scroll', event, gesture.receipts === 0);
      }
    } else if (/up$|end$|cancel$/.test(event.type) && !gesture.endings.has(event.type)) {
      gesture.endings.add(event.type);
      emit('end', event, true);
    }
  };
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel',
    'touchstart', 'touchmove', 'touchend', 'touchcancel', 'scroll']) {
    lifecycle.trackListener(host, type, observe, { capture: true, passive: true });
  }
  return () => {
    if (disposed) return;
    disposed = true;
    gesture = undefined;
    lifecycle.cleanup();
  };
}
