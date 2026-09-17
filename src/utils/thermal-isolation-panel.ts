import { gsap } from 'gsap';
import { Container } from 'pixi.js';
import { STATE } from '../modules/app-state.js';
import { getSharedPixiSheetCacheStats } from '../modules/shared-pixi-sheet-animation.js';
import { isThermalWorkSuppressed, startThermalIsolation, type ThermalIsolationGroup } from './thermal-isolation.js';

/** Loaded only by the explicit thermal-isolation flag or local web query. */
export function installThermalIsolationPanel(): void {
  if (document.getElementById('cc-thermal-isolation')) return;
  const panel = document.createElement('aside');
  panel.id = 'cc-thermal-isolation';
  panel.style.cssText = 'position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom) + 8px);z-index:2147483647;background:#fff;color:#111;padding:8px;border:1px solid #333;border-radius:8px;font:12px system-ui;max-width:300px';
  const select = document.createElement('select');
  const groups: Array<[ThermalIsolationGroup, string]> = [
    ['ambient', 'Map: ambient canvas'], ['journey-units', 'Map: Unit floating'], ['css-idle', 'CSS idle animations'],
    ['gsap-idle', 'GSAP repeating visual tweens'], ['sheets', 'Special dice sheets'],
    ['pixi-render', 'Pixi render submission'],
  ];
  for (const [value, label] of groups) {
    const option = document.createElement('option');
    option.value = value; option.textContent = label; select.append(option);
  }
  const button = document.createElement('button');
  button.textContent = 'Start 105s';
  const status = document.createElement('div');
  status.textContent = 'Diagnostic: stationary only. Any touch stops.';
  panel.append(select, button, status);
  document.body.append(panel);
  let stop: (() => void) | null = null;
  let running = false;
  let lastStopAt = -Infinity;
  // References and primitive fields only: no computed-style/layout walk per tick.
  const stageAtStart = () => STATE.stage;
  const fingerprint = () => JSON.stringify({
    body: document.body.className, level: STATE.level, score: STATE.score, moves: STATE.moves,
    busy: STATE.busyEnding, tiles: (STATE.tiles || []).map((tile: any) => [tile.uid, tile.destroyed, tile.value, tile.visible]),
    route: location.href,
  });
  const emit = (event: Record<string, unknown>) => {
    const row = { ...event, sheets: getSharedPixiSheetCacheStats() };
    const line = `[CC_THERMAL_ISOLATION] ${JSON.stringify(row)}`;
    const bridge = (window as any).webkit?.messageHandlers?.consoleLog;
    if (bridge?.postMessage) bridge.postMessage({ level: 'info', message: line }); else console.info(line);
    status.textContent = `${event.group}: ${event.event} ${event.phase ?? ''}${event.reason ? ` (${event.reason})` : ''}`;
  };
  button.addEventListener('click', () => {
    if (performance.now() - lastStopAt < 500) return;
    if (running) { stop?.(); return; }
    if (STATE.busyEnding || STATE.drag?.t || STATE.drag?.active || STATE.drag?.dragging) {
      status.textContent = 'Wait until gameplay and drag finish.'; return;
    }
    const group = select.value as ThermalIsolationGroup;
    const stage = stageAtStart();
    const renderer = STATE.app?.renderer;
    let releaseRenderer: (() => void) | null = null;
    // Observe calls in A and B; suppress only submission, keep ticker/input alive.
    if (group === 'pixi-render') {
      if (!renderer) { status.textContent = 'No Pixi renderer on this screen.'; return; }
      const original = renderer.render;
      const wrapped = new Proxy(original, {
        apply(target, receiver, args) {
          if (!isThermalWorkSuppressed('pixi-render')) return Reflect.apply(target, receiver, args);
        },
      });
      renderer.render = wrapped;
      releaseRenderer = () => { if (renderer.render === wrapped) renderer.render = original; };
    }
    const suppress = (): (() => void) => {
      if (group === 'css-idle') {
        const animations = document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity);
        animations.forEach(a => a.pause());
        emit({ event: 'owners', group, count: animations.length, at: performance.now() });
        return () => animations.forEach(a => {
          const target = (a.effect as KeyframeEffect | null)?.target;
          if (a.playState === 'paused' && target?.isConnected) a.play();
        });
      }
      if (group === 'gsap-idle') {
        const animations = gsap.globalTimeline.getChildren(true, true, true)
          .filter(a => a instanceof gsap.core.Tween && a.repeat() === -1 && a.isActive() && !a.paused()
            && a.targets().length > 0 && a.targets().every((target: unknown) => target instanceof Element || target instanceof Container))
          .map(animation => ({ animation, parent: animation.parent }));
        animations.forEach(({ animation }) => animation.pause());
        emit({ event: 'owners', group, count: animations.length, at: performance.now() });
        return () => animations.forEach(({ animation, parent }) => {
          if (animation.parent === parent && animation.paused()) animation.resume();
        });
      }
      return () => {};
    };
    running = true; select.disabled = true;
    stop = startThermalIsolation({
      enabled: true, group, suppress, emit,
      fingerprint: () => `${STATE.stage === stage && STATE.app?.renderer === renderer}:${fingerprint()}`,
      onStop: () => { lastStopAt = performance.now(); releaseRenderer?.(); running = false; stop = null; select.disabled = false; },
    });
    if (!stop) { releaseRenderer?.(); running = false; select.disabled = false; }
  });
}
