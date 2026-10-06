import { installNativeHomeHubBridge, type NativeHomeHubBridge, type NativeHomeHubBridgeHost, type NativeHomeHubDestination, type NativeHomeHubSnapshot } from './native-home-hub-bridge.js';
import { ARCADE_SLIDE_INDEX, JOURNEY_SLIDE_INDEX, SETTINGS_SLIDE_INDEX, isHomepageSlideVisible } from './homepage-slide-order.js';
import { getJourneyWorldIdForBoard } from './journey-world-definitions.js';
import type { NativeHomeHubFeedback } from './native-home-hub-feedback.js';

type WorldId = 1 | 2 | 3;
type Source = Extract<NativeHomeHubDestination, { kind: 'web-home' | 'web-hub' }>;
export type NativeHomeHubFeedbackEvent =
  | { id: number; kind: 'cta'; policy: 'native-only' | 'web-home-source' | 'web-hub-source' }
  | { id: number; kind: 'tab'; policy: 'native-only' | 'web-home-source' }
  | { id: number; kind: 'swipe' | 'back' | 'hub-ambience' | 'hub-exit' }
  | { id: number; kind: 'home-enter' | 'home-exit'; durationSeconds: number };
export interface NativeHomeHubRuntime extends NativeHomeHubBridge {
  /** Called by Swift only AFTER removing native coverage of the ready source. */
  activateSource(requestId: number): Promise<boolean>;
  activateWorld(requestId: number): Promise<boolean>;
  /** Atomic permission for Swift to restore its Hub after a World failure. */
  recoverWorld(requestId: number): boolean;
  canPresentHubFromWorld(worldId: WorldId): boolean;
  presentHubFromWorld(worldId: WorldId, epoch: number): Promise<boolean>;
  isNativeHubPresentationCurrent(epoch: number): boolean;
  selectSlide(index: number): boolean;
  /** Called only by canonical completed Home/Hub presentation owners. */
  present(route: 'home' | 'hub'): Promise<void>;
  /** Swift uses one increasing feedback ID for this controller lifetime. */
  nativeFeedback(event: unknown): boolean;
  suspendFeedback(): void;
  resumeFeedback(): boolean;
}
export interface NativeHomeHubRuntimeHost extends NativeHomeHubBridgeHost {
  __jimiNativeHomeHubEnabled?: boolean;
  __jimiNativeHomeHubRuntime?: NativeHomeHubRuntime;
  document: Document;
  getComputedStyle(element: Element): CSSStyleDeclaration;
}
/** Narrow injected existing owners make transport tests independent of booting
 * gameplay. Production loads the actual singleton implementations below. */
export interface NativeHomeHubRuntimeOwners {
  appZone: {
    getCurrentZone(): string;
    getPresentationEpoch(): number;
    isPresentationCurrent(epoch: number, zone?: 'home' | 'journey'): boolean;
    markHomeMenu(reason: string): void;
    markJourneyMenu(reason: string): void;
    showHomepageShell(reason: string, slide: 0 | 1): Promise<void>;
    showJourneyShell(reason: string): Promise<void>;
  };
  slider: { getCurrentSlide(): number; setSlideInstant(slide: number): void; syncHiddenSlideState(slide: number): void };
  ui: {
    showHomepageQuietly(): void;
    hideHomepage(): Promise<void> | void;
    showCollectiblesScreen(): Promise<void>;
    activateNativeHomepageAction(action: 'arcade' | 'settings' | 'journey'): Promise<boolean>;
  };
  journey: {
    getBoardById(id: number): { unlocked: boolean; interim?: boolean } | undefined;
    suspendForHomepage(): void;
    prepareFirstPlayTutorialHubReturn(): void;
    waitForJourneyV700HubPresentation(): Promise<boolean>;
    waitForJourneyV700HubEnterCompletion(): Promise<void>;
    activateNativeHubWorld?: (worldId: WorldId) => boolean;
    prepareNativeWorld?: (worldId: WorldId, signal: AbortSignal) => Promise<boolean>;
    activatePreparedNativeWorld?: (worldId: WorldId) => Promise<boolean>;
    cancelNativeWorldPreparation?: () => void;
  };
  finalizeHome(reason: string): void;
  cancelHomeEnter(reason: string): void;
  hideHomeNavigation(reason: string): void;
  isFirstPlayTutorialForced(): boolean;
  createFeedback(enabled: boolean): NativeHomeHubFeedback;
}

const installations = new WeakMap<NativeHomeHubRuntimeHost, Promise<NativeHomeHubRuntime | null>>();
const runtimes = new WeakMap<NativeHomeHubRuntimeHost, NativeHomeHubRuntime>();
const defaultHost = () => window as unknown as NativeHomeHubRuntimeHost;
async function loadCanonicalOwners(): Promise<NativeHomeHubRuntimeOwners> {
  const [zone, slider, ui, journey, animations, homeOwner, homeNavigation, tutorial, feedback] = await Promise.all([
    import('./app-zone-manager.js'), import('./slider-manager.js'), import('./ui-manager.js'),
    import('./journey-boards-manager.js'), import('../utils/animations.js'),
    import('./homepage-enter-transition-owner.js'), import('./navigation-control.js'),
    import('./first-play-tutorial-request.js'),
    import('./native-home-hub-feedback.js'),
  ]);
  return { appZone: zone.appZoneManager, slider: slider.default, ui: ui.default,
    journey: journey.journeyBoardsManager, finalizeHome: animations.finalizeSliderEnterVisibility,
    cancelHomeEnter(reason) { homeOwner.homepageEnterTransitionOwner.cancel(reason); animations.cancelSliderEnterAnimation(reason); },
    hideHomeNavigation: homeNavigation.hideHomepageNavigation,
    isFirstPlayTutorialForced: tutorial.isFirstPlayTutorialForced,
    createFeedback: feedback.createNativeHomeHubFeedback };
}

/** Explicit native opt-in only. The standard web boot neither imports singleton
 * owners through this module nor installs a transport when the flag is absent. */
export function installNativeHomeHubRuntime(
  host: NativeHomeHubRuntimeHost = defaultHost(),
  loadOwners: () => Promise<NativeHomeHubRuntimeOwners> = loadCanonicalOwners,
): Promise<NativeHomeHubRuntime | null> {
  if (host.__jimiNativeHomeHubEnabled !== true || !host.webkit?.messageHandlers?.jimiHomeHub) return Promise.resolve(null);
  const existing = installations.get(host);
  if (existing) return existing;
  const installation = loadOwners().then(owners => {
    if (host.__jimiNativeHomeHubEnabled !== true || !host.webkit?.messageHandlers?.jimiHomeHub) {
      installations.delete(host);
      return null;
    }
    let disposed = false;
    let nativeOwned = true;
    let suppressedRequestId: number | null = null;
    let pendingPresentation: { route: 'home' | 'hub'; epoch: number } | undefined;
    let pendingSource: { id: number; source: Source; epoch: number; signal: AbortSignal; slide?: number } | undefined;
    let pendingWorld: { id: number; worldId: WorldId; epoch: number; signal: AbortSignal; managerStarted: boolean; phase: 'preparing' | 'ready' | 'activating' } | undefined;
    let worldRecovery: { id: number; epoch: number } | undefined;
    let webHubFallbackEpoch: number | undefined;
    let feedback: NativeHomeHubFeedback | undefined;
    let feedbackAdmission: { zone: 'home' | 'journey'; epoch: number } | undefined;
    let feedbackPendingRequestId: number | null = null;
    let lastFeedbackId = 0;
    const stopFeedback = () => { feedback?.stop(); feedback = undefined; };
    const admitFeedback = (route: 'home' | 'hub', epoch: number, retainNativeLease = false) => {
      if (!retainNativeLease) stopFeedback();
      feedbackAdmission = { zone: route === 'home' ? 'home' : 'journey', epoch };
      feedback ??= owners.createFeedback(true);
    };
    const ownsFeedbackAdmission = () => !disposed && nativeOwned && !host.document.hidden
      && feedbackPendingRequestId === null && !pendingSource && !pendingWorld && !pendingPresentation
      && !!feedbackAdmission && owners.appZone.isPresentationCurrent(feedbackAdmission.epoch, feedbackAdmission.zone);
    const visible = (id: string): boolean => {
      const element = host.document.getElementById(id);
      if (!element?.isConnected || element.hidden) return false;
      const style = host.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0;
    };
    const hubIsCurrent = () => owners.appZone.getCurrentZone() === 'journey'
      && host.document.getElementById('journey-boards-container')?.dataset.journeyV700View === 'hub'
      && visible('journey-screen');
    const retireWorld = (receipt = pendingWorld, recover = false) => {
      if (!receipt || pendingWorld !== receipt) return;
      pendingWorld = undefined;
      if (suppressedRequestId === receipt.id) suppressedRequestId = null;
      // A foreign epoch owns its own cleanup. Never cancel its manager route.
      if (!owners.appZone.isPresentationCurrent(receipt.epoch, 'journey')) {
        nativeOwned = false;
        worldRecovery = undefined;
        feedbackAdmission = undefined;
        feedback?.releaseToWeb();
        feedback = undefined;
        return;
      }
      if (receipt.managerStarted) owners.journey.cancelNativeWorldPreparation?.();
      if (recover && !disposed) {
        nativeOwned = true;
        const epoch = owners.appZone.getPresentationEpoch();
        worldRecovery = { id: receipt.id, epoch };
        admitFeedback('hub', epoch);
      }
    };
    const readSnapshot = (): NativeHomeHubSnapshot => {
      const allBoards = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, state: owners.journey.getBoardById(index + 1) }));
      // Match canonical Hub render/refresh classification, not the last DOM
      // World visited. This projects state; it does not reconcile or write it.
      const highestUnlocked = allBoards.reduce((highest, board) => board.state?.unlocked || board.state?.interim ? Math.max(highest, board.id) : highest, 1);
      const activeWorld = allBoards.every(board => !!board.state) ? getJourneyWorldIdForBoard(highestUnlocked) : null;
      return { homeSlide: owners.slider.getCurrentSlide(),
        journeyRequiresTutorial: owners.isFirstPlayTutorialForced(),
        activeWorldId: activeWorld === 1 || activeWorld === 2 || activeWorld === 3 ? activeWorld : null,
        worlds: ([1, 3, 2] as const).map(worldId => {
          const boards = allBoards.slice((worldId - 1) * 10, worldId * 10).map(board => board.state);
          return { worldId, total: 10,
            completed: boards.every(Boolean) ? boards.filter(board => board?.unlocked === true && board.interim !== true).length : null,
            hasInterimCard: boards.some(board => board?.interim === true) };
        }) };
    };
    const quiesce = async (route: 'home' | 'hub', epoch: number, isCurrent: () => boolean, source?: HTMLElement): Promise<void> => {
      const zone = route === 'home' ? 'home' : 'journey';
      const assertOwned = () => {
        if (disposed || host.document.hidden || !isCurrent() || !owners.appZone.isPresentationCurrent(epoch, zone)) {
          throw new DOMException('Native presentation replaced', 'AbortError');
        }
      };
      assertOwned();
      owners.cancelHomeEnter(`native-${route}-quiesce`);
      owners.journey.suspendForHomepage();
      owners.hideHomeNavigation(`native-${route}-quiesce`);
      await owners.ui.hideHomepage();
      assertOwned();
      // Hub suspension hides its surface. Revalidation intentionally uses the
      // exact canonical epoch/view, not visibility of the now-hidden source.
      if (source && (!source.isConnected || host.document.getElementById(source.id) !== source
        || (route === 'hub' && source.dataset.journeyV700View !== 'hub'))) {
        throw new DOMException('Native source replaced', 'AbortError');
      }
    };
    const bridge = installNativeHomeHubBridge({
      readSnapshot,
      canNavigate: target => {
        if (pendingWorld && !owners.appZone.isPresentationCurrent(pendingWorld.epoch, 'journey')) retireWorld();
        return nativeOwned && !host.document.hidden
        && (!owners.isFirstPlayTutorialForced() || (target.kind !== 'hub' && target.kind !== 'web-hub' && target.kind !== 'world'))
        && (target.kind === 'home' || target.kind === 'hub' || target.kind === 'web-home'
          || (target.kind === 'world' && typeof owners.journey.prepareNativeWorld === 'function'
            && typeof owners.journey.activatePreparedNativeWorld === 'function'
            && typeof owners.journey.cancelNativeWorldPreparation === 'function')
          || (target.kind === 'web-hub' && typeof owners.journey.activateNativeHubWorld === 'function'));
      },
      async navigate(target, context) {
        retireWorld();
        worldRecovery = undefined;
        pendingPresentation = undefined;
        pendingSource = undefined;
        suppressedRequestId = context.requestId;
        feedbackPendingRequestId = context.requestId;
        feedbackAdmission = undefined;
        if (target.kind === 'web-home' || target.kind === 'web-hub') {
          feedback?.releaseToWeb();
          feedback = undefined;
        }
        // A normal native route is not audio cancellation: retain the lease
        // while quiescing, so its accepted CTA/Back one-shot is not truncated.
        // Admission remains revoked until the exact ready receipt below.
        const assertCurrent = () => {
          if (disposed || context.signal.aborted || !context.isCurrent() || host.document.hidden) throw new DOMException('Native handoff cancelled', 'AbortError');
        };
        const owned = (epoch: number, zone: 'home' | 'journey') => {
          assertCurrent();
          if (!owners.appZone.isPresentationCurrent(epoch, zone)) throw new Error('Canonical route replaced');
        };
        let worldReceipt: typeof pendingWorld;
        try {
          assertCurrent();
          if (target.kind === 'home') {
            owners.appZone.markHomeMenu('native-home-logical');
            const epoch = owners.appZone.getPresentationEpoch();
            await quiesce('home', epoch, context.isCurrent);
            owned(epoch, 'home');
            admitFeedback('home', epoch, true);
          } else if (target.kind === 'hub') {
            owners.appZone.markJourneyMenu('native-hub-logical');
            const epoch = owners.appZone.getPresentationEpoch();
            await quiesce('hub', epoch, context.isCurrent);
            owned(epoch, 'journey');
            admitFeedback('hub', epoch, true);
          } else if (target.kind === 'world') {
            const shell = owners.appZone.showJourneyShell('native-direct-world');
            const shellEpoch = owners.appZone.getPresentationEpoch();
            worldReceipt = { id: context.requestId, worldId: target.worldId, epoch: shellEpoch,
              signal: context.signal, managerStarted: false, phase: 'preparing' };
            pendingWorld = worldReceipt;
            await shell;
            owned(shellEpoch, 'journey');
            await owners.ui.hideHomepage();
            owned(shellEpoch, 'journey');
            // The canonical transition republishes Journey synchronously. Its
            // resulting epoch, not the shell epoch, owns this preparation.
            const preparing = owners.journey.prepareNativeWorld!(target.worldId, context.signal);
            const epoch = owners.appZone.getPresentationEpoch();
            worldReceipt.epoch = epoch;
            worldReceipt.managerStarted = true;
            const ready = await preparing;
            owned(epoch, 'journey');
            if (!ready || pendingWorld !== worldReceipt) throw new Error('Selected World unavailable');
            worldReceipt.phase = 'ready';
          } else if (target.kind === 'web-home') {
            const slide = target.action === 'arcade' ? ARCADE_SLIDE_INDEX : target.action === 'settings' ? SETTINGS_SLIDE_INDEX : JOURNEY_SLIDE_INDEX;
            const preparing = owners.appZone.showHomepageShell('native-web-home-source', ARCADE_SLIDE_INDEX);
            const epoch = owners.appZone.getPresentationEpoch();
            await preparing;
            owned(epoch, 'home');
            owners.slider.setSlideInstant(slide);
            owners.finalizeHome('native-web-home-source');
            if (!visible('home') || owners.slider.getCurrentSlide() !== slide) throw new Error('Home source unavailable');
            pendingSource = { id: context.requestId, source: target, epoch, signal: context.signal, slide };
          } else if (target.kind === 'web-hub') {
            const preparing = owners.appZone.showJourneyShell('native-web-hub-source');
            const epoch = owners.appZone.getPresentationEpoch();
            await preparing;
            owned(epoch, 'journey');
            owners.journey.prepareFirstPlayTutorialHubReturn();
            await owners.ui.showCollectiblesScreen();
            owned(epoch, 'journey');
            if (!await owners.journey.waitForJourneyV700HubPresentation()) throw new Error('Hub source unavailable');
            owned(epoch, 'journey');
            await owners.journey.waitForJourneyV700HubEnterCompletion();
            owned(epoch, 'journey');
            if (!hubIsCurrent()) throw new Error('Hub source no longer visible');
            pendingSource = { id: context.requestId, source: target, epoch, signal: context.signal };
          } else throw new Error('Unsupported direct web destination');
          assertCurrent();
          if (feedbackPendingRequestId === context.requestId) feedbackPendingRequestId = null;
          return { ready: true, destination: target };
        } catch (error) {
          if (worldReceipt) retireWorld(worldReceipt, true);
          if (suppressedRequestId === context.requestId) suppressedRequestId = null;
          if (feedbackPendingRequestId === context.requestId) {
            feedbackPendingRequestId = null;
            stopFeedback();
          }
          throw error;
        }
      },
    }, host);
    const cancel = bridge.cancel;
    const dispose = bridge.dispose;
    const runtime: NativeHomeHubRuntime = Object.assign(bridge, {
      nativeFeedback(value: unknown): boolean {
        if (!value || typeof value !== 'object') return false;
        const event = value as Record<string, unknown>;
        if (!Number.isSafeInteger(event.id) || (event.id as number) <= lastFeedbackId || (event.id as number) <= 0) return false;
        if (event.kind === 'cta') {
          if (!['native-only', 'web-home-source', 'web-hub-source'].includes(event.policy as string)) return false;
        } else if (event.kind === 'tab') {
          if (!['native-only', 'web-home-source'].includes(event.policy as string)) return false;
        } else if (event.kind === 'home-enter' || event.kind === 'home-exit') {
          if (typeof event.durationSeconds !== 'number' || !Number.isFinite(event.durationSeconds) || event.durationSeconds <= 0 || event.durationSeconds > 10) return false;
        } else if (!['swipe', 'back', 'hub-ambience', 'hub-exit'].includes(event.kind as string)) return false;
        // Consume valid receipts even when suspended/busy. A late replay of a
        // missed motion must not start sound after native admission changes.
        lastFeedbackId = event.id as number;
        if (!feedback || !ownsFeedbackAdmission()) return false;
        const id = event.id as number;
        switch (event.kind) {
          case 'cta': return feedback.pressCTA(id, event.policy as 'native-only' | 'web-home-source' | 'web-hub-source');
          case 'tab': return feedback.pressTab(id, event.policy as 'native-only' | 'web-home-source');
          case 'swipe': return feedback.pressSwipe(id);
          case 'back': return feedback.pressBack(id);
          case 'hub-ambience': return feedback.hubAmbience(id);
          case 'hub-exit': return feedback.hubExit(id);
          case 'home-enter': case 'home-exit': return feedback.homeMotion(id, event.kind === 'home-enter' ? 'enter' : 'exit', event.durationSeconds as number);
          default: return false;
        }
      },
      suspendFeedback() { stopFeedback(); },
      resumeFeedback(): boolean {
        if (!ownsFeedbackAdmission()) return false;
        if (!feedback) feedback = owners.createFeedback(true);
        return true; // No automatic playback/replay on resume.
      },
      async activateWorld(requestId: number): Promise<boolean> {
        const receipt = pendingWorld;
        if (disposed || !receipt || receipt.id !== requestId || receipt.phase !== 'ready') return false;
        if (receipt.signal.aborted || host.document.hidden || !owners.appZone.isPresentationCurrent(receipt.epoch, 'journey')) {
          retireWorld(receipt, true);
          return false;
        }
        receipt.phase = 'activating';
        nativeOwned = false;
        feedback?.releaseToWeb();
        feedback = undefined;
        let accepted = false;
        try { accepted = await owners.journey.activatePreparedNativeWorld!(receipt.worldId); }
        catch { /* Swift restores its retained Hub on a rejected activation. */ }
        accepted = accepted && !disposed && pendingWorld === receipt && !receipt.signal.aborted
          && !host.document.hidden && owners.appZone.isPresentationCurrent(receipt.epoch, 'journey');
        if (accepted) pendingWorld = undefined;
        else retireWorld(receipt, true);
        if (suppressedRequestId === receipt.id) suppressedRequestId = null;
        return accepted;
      },
      recoverWorld(requestId: number): boolean {
        if (disposed) return false;
        if (pendingWorld?.id === requestId) retireWorld(pendingWorld, true);
        const recovery = worldRecovery;
        if (!recovery || recovery.id !== requestId || !nativeOwned
          || !owners.appZone.isPresentationCurrent(recovery.epoch, 'journey')) return false;
        // This exact owner is retired before Swift regains input. Aborting the
        // bridge also releases an unresolved preparation request immediately.
        cancel();
        feedbackPendingRequestId = null;
        stopFeedback();
        return true;
      },
      canPresentHubFromWorld(worldId: WorldId): boolean {
        const container = host.document.getElementById('journey-boards-container');
        return [1, 2, 3].includes(worldId) && !disposed && !nativeOwned && !host.document.hidden && !owners.isFirstPlayTutorialForced()
          && suppressedRequestId === null && !pendingWorld && !pendingSource && !pendingPresentation
          && owners.appZone.getCurrentZone() === 'journey' && visible('journey-screen')
          && visible('journey-boards-container')
          && host.document.getElementById('journey-screen')?.contains(container) === true
          && container?.dataset.journeyV700View === 'world'
          && Number(container.dataset.journeyV700WorldId) === worldId;
      },
      isNativeHubPresentationCurrent(epoch: number): boolean {
        return !disposed && nativeOwned && !host.document.hidden && !pendingWorld && !pendingSource
          && !pendingPresentation && suppressedRequestId === null
          && owners.appZone.isPresentationCurrent(epoch, 'journey');
      },
      async presentHubFromWorld(worldId: WorldId, epoch: number): Promise<boolean> {
        if (![1, 2, 3].includes(worldId) || disposed || nativeOwned || host.document.hidden
          || owners.isFirstPlayTutorialForced() || suppressedRequestId !== null
          || pendingWorld || pendingSource || pendingPresentation || !hubIsCurrent()
          || !owners.appZone.isPresentationCurrent(epoch, 'journey')) return false;
        const source = host.document.getElementById('journey-boards-container')!;
        const screen = host.document.getElementById('journey-screen');
        if (!screen?.contains(source)) return false;
        const receipt = { route: 'hub' as const, epoch };
        pendingPresentation = receipt;
        webHubFallbackEpoch = epoch;
        try {
          // Canonical close has completed World/nav exit and the exact Hub
          // stage swap, with its route token settled before this suspension.
          await quiesce('hub', epoch, () => pendingPresentation === receipt && suppressedRequestId === null, source);
          if (!screen.isConnected || host.document.getElementById('journey-screen') !== screen || !screen.contains(source)) return false;
          const transport = host.webkit?.messageHandlers?.jimiHomeHub;
          if (!transport) return false;
          transport.postMessage({ kind: 'enter-hub', epoch, snapshot: readSnapshot() });
          nativeOwned = true;
          webHubFallbackEpoch = undefined;
          admitFeedback('hub', epoch);
          return true;
        } catch { return false; /* The same canonical caller owns fallback. */ }
        finally { if (pendingPresentation === receipt) pendingPresentation = undefined; }
      },
      async activateSource(requestId: number): Promise<boolean> {
        const pending = pendingSource;
        if (disposed || !pending || pending.id !== requestId || pending.signal.aborted || host.document.hidden) return false;
        const zone = pending.source.kind === 'web-home' ? 'home' : 'journey';
        if (!owners.appZone.isPresentationCurrent(pending.epoch, zone)) return false;
        if (pending.source.kind === 'web-home' && (!visible('home') || owners.slider.getCurrentSlide() !== pending.slide)) return false;
        if (pending.source.kind === 'web-hub' && !hubIsCurrent()) return false;
        pendingSource = undefined;
        if (suppressedRequestId === pending.id) suppressedRequestId = null;
        nativeOwned = false;
        let accepted = false;
        try {
          accepted = pending.source.kind === 'web-home'
            ? await owners.ui.activateNativeHomepageAction(pending.source.action)
            : owners.journey.activateNativeHubWorld?.(pending.source.worldId) === true;
        } catch { /* Recover only this still-visible canonical source below. */ }
        if (!accepted && !disposed && owners.appZone.isPresentationCurrent(pending.epoch, zone)) {
          await runtime.present(pending.source.kind === 'web-home' ? 'home' : 'hub');
        }
        return accepted;
      },
      selectSlide(index: number): boolean {
        if (disposed || !nativeOwned || pendingSource || pendingWorld || pendingPresentation || host.document.hidden || owners.appZone.getCurrentZone() !== 'home' || !isHomepageSlideVisible(index)) return false;
        if (index === JOURNEY_SLIDE_INDEX && owners.isFirstPlayTutorialForced()) return false; // Swift must request the canonical Journey CTA source handshake.
        owners.slider.syncHiddenSlideState(index);
        bridge.snapshot();
        return true;
      },
      async present(route: 'home' | 'hub'): Promise<void> {
        if (disposed || suppressedRequestId !== null || host.document.hidden) return;
        if (route === 'hub' && webHubFallbackEpoch === owners.appZone.getPresentationEpoch()) return;
        if (route === 'home' ? owners.appZone.getCurrentZone() !== 'home' || !visible('home') : !hubIsCurrent()) return;
        const epoch = owners.appZone.getPresentationEpoch();
        const source = host.document.getElementById(route === 'home' ? 'home' : 'journey-boards-container');
        if (pendingPresentation?.epoch === epoch && pendingPresentation.route === route) return;
        const receipt = { route, epoch };
        pendingPresentation = receipt;
        try {
          await quiesce(route, epoch, () => pendingPresentation === receipt && suppressedRequestId === null, source);
          pendingSource = undefined;
          nativeOwned = true;
          admitFeedback(route, epoch);
          host.webkit?.messageHandlers?.jimiHomeHub?.postMessage({ kind: 'present', route, snapshot: readSnapshot() });
        } catch { /* Interrupted/failed cleanup or unavailable native transport: never adopt stale source. */ }
        finally { if (pendingPresentation === receipt) pendingPresentation = undefined; }
      },
      cancel() { retireWorld(pendingWorld, true); stopFeedback(); pendingPresentation = undefined; pendingSource = undefined; suppressedRequestId = null; feedbackPendingRequestId = null; cancel(); },
      dispose() {
        if (disposed) return;
        disposed = true;
        retireWorld();
        stopFeedback();
        feedbackAdmission = undefined;
        pendingPresentation = undefined;
        pendingSource = undefined;
        dispose();
        if (host.__jimiNativeHomeHubRuntime === runtime) delete host.__jimiNativeHomeHubRuntime;
        if (runtimes.get(host) === runtime) { runtimes.delete(host); installations.delete(host); }
      },
    });
    runtimes.set(host, runtime);
    host.__jimiNativeHomeHubRuntime = runtime;
    return runtime;
  }).catch(error => { installations.delete(host); throw error; });
  installations.set(host, installation);
  return installation;
}

/** Existing Home/Hub completed owners call this directly; no new observer or
 * app-zone subscription can mistake an early logical route for visible readiness. */
export function notifyNativeHomeHubPresentation(route: 'home' | 'hub', host: NativeHomeHubRuntimeHost = defaultHost()): Promise<void> {
  return runtimes.get(host)?.present(route) ?? Promise.resolve();
}
