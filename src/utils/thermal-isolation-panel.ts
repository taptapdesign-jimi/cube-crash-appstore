import { gsap } from 'gsap';
import { Container } from 'pixi.js';
import { STATE } from '../modules/app-state.js';
import { getSharedPixiSheetCacheStats } from '../modules/shared-pixi-sheet-animation.js';
import { isThermalWorkSuppressed, startThermalIsolation, type ThermalIsolationGroup } from './thermal-isolation.js';
import { getThermalAudioIsolationStats, setThermalAudioSuppressed } from './thermal-audio-isolation.js';
import { getSoundtrackRuntimeStats } from '../modules/soundtrack-manager.js';
import { getSoundtrackPreparationStats } from '../modules/main-theme-web-audio-transport.js';
import { getDecodedGameplayAudioStats } from '../modules/gameplay-audio-buffer-player.js';
import { startJourneyUnpluggedThermalTest } from './journey-unplugged-thermal-test.js';
import { startJourneyThermalAudit } from './journey-thermal-audit.js';

/** Shared diagnostic Web Animation pause, preserving already-paused owners. */
export function holdThermalWebAnimations(infiniteOnly = true): () => void {
  const animations = document.getAnimations().filter(animation => animation.playState === 'running'
    && (!infiniteOnly || animation.effect?.getTiming().iterations === Infinity));
  animations.forEach(animation => animation.pause());
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    animations.forEach(animation => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (animation.playState === 'paused' && target?.isConnected) animation.play();
    });
  };
}

/** Loaded only by the explicit thermal-isolation flag or local web query. */
export function installThermalIsolationPanel(): void {
  if (document.getElementById('cc-thermal-isolation')) return;
  const panel = document.createElement('aside');
  panel.id = 'cc-thermal-isolation';
  panel.style.cssText = 'position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom) + 8px);z-index:2147483647;background:#fff;color:#111;padding:8px;border:1px solid #333;border-radius:8px;font:12px system-ui;max-width:300px';
  const select = document.createElement('select');
  const groups: Array<[ThermalIsolationGroup, string]> = [
    ['ambient', 'Map: ambient canvas'], ['journey-units', 'Map: Unit floating'], ['css-idle', 'CSS idle animations'],
    ['gsap-idle', 'GSAP repeating visual owners'], ['sheets', 'Special dice sheets'],
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
  const audioToggle = document.createElement('button');
  audioToggle.dataset.thermalAudioToggle = 'true';
  const audioRead = document.createElement('button');
  audioRead.textContent = 'Read audio counters';
  audioRead.dataset.thermalAudioRead = 'true';
  const hidePanel = document.createElement('button');
  hidePanel.textContent = 'Hide overlay';
  hidePanel.dataset.thermalPanelHide = 'true';
  const audioStatus = document.createElement('div');
  audioStatus.dataset.thermalAudioStatus = 'true';
  const readAudio = (event: string) => {
    const isolation = getThermalAudioIsolationStats();
    const soundtrack = getSoundtrackRuntimeStats();
    const preparation = getSoundtrackPreparationStats();
    const gameplay = getDecodedGameplayAudioStats();
    const blocked = Object.values(isolation.suppressed).reduce((total, count) => total + count, 0);
    const draining = preparation.pendingLoads > 0 || preparation.pendingDecodes > 0
      || gameplay.isolationCleanupPending || gameplay.isolationPendingLoads > 0 || gameplay.isolationPendingDecodes > 0;
    audioToggle.textContent = isolation.isolationEnabled ? 'Audio isolated: allow again' : 'Suppress all audio';
    audioToggle.setAttribute('aria-pressed', String(isolation.isolationEnabled));
    audioStatus.textContent = `Natural play: audio ${isolation.isolationEnabled ? (draining ? 'OFF — draining' : 'OFF') : 'allowed'}. `
      + `Snapshot: music voices ${soundtrack.activeVoices}, pending loads ${preparation.pendingLoads}, `
      + `decodes ${preparation.pendingDecodes}; SFX jobs ${gameplay.isolationPendingLoads ?? 0}/${gameplay.isolationPendingDecodes ?? 0}, `
      + `cleanup ${gameplay.isolationCleanupPending ? 'pending' : 'done'}; blocked ${blocked}. `
      + 'Touches keep this switch. Already running decodes must drain. Allowing does not restart music.';
    const line = `[CC_THERMAL_AUDIO] ${JSON.stringify({ event, at: performance.now(), isolation, soundtrack, preparation, gameplay })}`;
    const bridge = (window as any).webkit?.messageHandlers?.consoleLog;
    if (bridge?.postMessage) bridge.postMessage({ level: 'info', message: line });
    else console.info(line);
  };
  audioToggle.addEventListener('click', () => {
    setThermalAudioSuppressed(!getThermalAudioIsolationStats().isolationEnabled);
    readAudio('toggle');
  });
  audioRead.addEventListener('click', () => readAudio('snapshot'));
  hidePanel.addEventListener('click', () => {
    readAudio('overlay-hidden');
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
  });
  panel.append(audioToggle, audioRead, hidePanel, audioStatus);
  document.body.append(panel);
  readAudio('panel-ready');
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
        return holdThermalWebAnimations();
      }
      if (group === 'gsap-idle') {
        const visualTargets = (animation: gsap.core.Animation): Array<Element | Container> => {
          const targets: unknown[] = animation instanceof gsap.core.Tween ? animation.targets()
            : animation instanceof gsap.core.Timeline
              ? animation.getChildren(true, true, false).flatMap(child => (child as gsap.core.Tween).targets())
              : [];
          return targets.length > 0 && targets.every(target => target instanceof Element || target instanceof Container)
            ? targets as Array<Element | Container> : [];
        };
        const animations = gsap.globalTimeline.getChildren(true, true, true)
          .filter(animation => animation.repeat() === -1 && animation.isActive() && !animation.paused())
          .map(animation => {
            const targets = visualTargets(animation);
            const ancestry: Array<{ animation: gsap.core.Animation; parent: gsap.core.Timeline }> = [];
            let cursor: gsap.core.Animation = animation;
            while (cursor.parent) {
              ancestry.push({ animation: cursor, parent: cursor.parent });
              cursor = cursor.parent;
            }
            return {
              animation, targets, ancestry, attached: cursor === gsap.globalTimeline,
              targetParents: targets.map(target => target instanceof Container ? target.parent : null),
            };
          }).filter(owner => owner.attached && owner.targets.length > 0);
        animations.forEach(({ animation }) => animation.pause());
        emit({ event: 'owners', group, count: animations.length,
          tweens: animations.filter(owner => owner.animation instanceof gsap.core.Tween).length,
          timelines: animations.filter(owner => owner.animation instanceof gsap.core.Timeline).length,
          at: performance.now() });
        return () => animations.forEach(({ animation, targets, ancestry, targetParents }) => {
          if (!animation.paused() || !ancestry.every(owner => owner.animation.parent === owner.parent)) return;
          const currentTargets = visualTargets(animation);
          if (currentTargets.length !== targets.length || !targets.every((target, index) => {
            if (currentTargets[index] !== target) return false;
            return target instanceof Element ? target.isConnected
              : !target.destroyed && target.parent === targetParents[index]
                && (target.parent !== null || STATE.stage === target);
          })) return;
          animation.resume();
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
  const journeyAudit = document.createElement('button');
  journeyAudit.textContent = 'World audit · 5 min 15 s';
  journeyAudit.dataset.journeyThermalAudit = 'true';
  journeyAudit.addEventListener('click', async () => {
    if (running) return;
    journeyAudit.disabled = true;
    try {
      const { journeyBoardsManager } = await import('../modules/journey-boards-manager.js');
      if (running) return;
      const stopped = (reason: string) => {
        running = false; stop = null; panel.hidden = false;
        select.disabled = false; journeyAudit.disabled = false;
        status.textContent = `World audit: ${reason}. Audio unchanged.`;
      };
      stop = startJourneyThermalAudit({
        enabled: true, owner: journeyBoardsManager, emit, onStop: stopped,
      });
      if (!stop) {
        status.textContent = 'Open a settled World with the brown card visible, then retry.';
        return;
      }
      running = true; select.disabled = true;
      // Same composition for every measured window, with no overlay repaint.
      panel.hidden = true;
    } catch {
      status.textContent = 'World audit could not start.';
    } finally {
      if (!running) journeyAudit.disabled = false;
    }
  });
  panel.append(journeyAudit);
  const unpluggedTest = document.createElement('button');
  unpluggedTest.textContent = 'Unplugged · static / animated · 12 min';
  unpluggedTest.dataset.journeyUnpluggedTest = 'true';
  unpluggedTest.addEventListener('click', async () => {
    if (running) return;
    unpluggedTest.disabled = true;
    try {
      const { journeyBoardsManager } = await import('../modules/journey-boards-manager.js');
      if (running) return;
      stop = startJourneyUnpluggedThermalTest({
        enabled: true, owner: journeyBoardsManager, emit,
        holdWebAnimations: () => holdThermalWebAnimations(false),
        onStop: reason => {
          running = false; stop = null; panel.hidden = false;
          unpluggedTest.disabled = false; select.disabled = false;
          status.textContent = `Unplugged test: ${reason}. Audio unchanged.`;
        },
      });
      if (!stop) {
        status.textContent += ' Requires fresh native telemetry, unplugged/cool phone and settled World. No video.';
        return;
      }
      running = true; select.disabled = true; panel.hidden = true;
    } catch {
      status.textContent = 'Unplugged test could not start.';
    } finally {
      if (!running) unpluggedTest.disabled = false;
    }
  });
  panel.append(unpluggedTest);

}
