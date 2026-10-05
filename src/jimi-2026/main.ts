import './styles.css';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { applyAppPaperBackground } from '../utils/app-paper-background.js';
import { resolveJourneyCardAsset } from '../modules/journey-card-assets.js';
import { createSceneDirector } from './scene-director.js';
import type { SceneTransitionContext } from './scene-director.js';
import { createScenePresentation } from './scene-presentation.js';
import { prepareSceneImages } from './scene-resources.js';
import { createSceneDiagnostics } from './scene-diagnostics.js';
import type { SceneDiagnostics } from './scene-diagnostics.js';
import { createSceneInputDiagnostics } from './scene-input-diagnostics.js';
import { buildBeachSceneIncrementally } from './scene-assembly.js';
import { getBeachVisibleUnitIds } from './scene-viewport.js';
import { buildHomeScene, buildHubScene, buildCardScene, buildCardPreviewScene } from './scene-builders.js';
import type { JimiProgressSnapshot } from './scene-catalog.js';

type Route = 'home' | 'hub' | 'beach' | 'card' | 'art-preview';
const host = document.getElementById('jimi-root')!;
const status = document.getElementById('jimi-status')!;
const retry = document.getElementById('jimi-retry');
const lifecycle = createScreenLifecycle('jimi-2026');
const diagnosticsEnabled = document.documentElement.dataset.jimiMetrics === 'true';
const inputDiagnosticsEnabled = document.documentElement.dataset.jimiInputMetrics === 'true';
let diagnostics = createSceneDiagnostics('inactive', false);
// Input snapshots read layout and send native IPC. Keep them independently
// opt-in so scroll investigations do not contaminate ordinary route timings.
lifecycle.trackCleanup(createSceneInputDiagnostics(host, inputDiagnosticsEnabled));
// Deliberately no second save reader/writer. The gameplay migration will inject
// a canonical immutable snapshot. Unknown progress is visibly unknown, not 0.
const progress: JimiProgressSnapshot = Object.freeze({});
const cache = new Map<Route, HTMLElement>();
// WebKit may reset overflow scroll when a retained scene is hidden/detached.
// Weak keys share the existing bounded DOM lifetime; this is not persistence.
const retainedScrollTops = new WeakMap<HTMLElement, number>();
let selectedBoard = 11;
let flip: Animation | undefined;
let flipped = false;
let disposed = false;
let failedRoute: Route = 'home';

function announce(message: string): void { status.textContent = message; }
function captureVisibleSceneScroll(root: HTMLElement): void {
  if (!root.isConnected || root.hidden) return;
  const scroll = root.querySelector<HTMLElement>('.jimi-scroll');
  if (scroll) retainedScrollTops.set(root, scroll.scrollTop);
}
async function getScene(route: Route, context: SceneTransitionContext, trace: SceneDiagnostics): Promise<HTMLElement> {
  const retained = cache.get(route);
  if (retained) return retained;
  let root: HTMLElement;
  if (route === 'home') root = buildHomeScene();
  else if (route === 'hub') root = buildHubScene(progress);
  else if (route === 'beach') {
    root = await buildBeachSceneIncrementally(progress, context,
      (index, work) => trace.phase(`build.unit${index}`, work));
    if (context.signal.aborted || !context.isCurrent()) throw new DOMException('Scene assembly cancelled', 'AbortError');
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'jimi-preview-button';
    preview.dataset.jimiAction = 'art-preview';
    preview.textContent = 'Artwork preview (not an unlock)';
    root.querySelector('.jimi-scene-header')!.append(preview);
  } else if (route === 'art-preview') {
    const art = resolveJourneyCardAsset(11, 0);
    root = buildCardPreviewScene(11, { src: art.path1x, src2x: art.path2x, name: 'Beach · Stage 01', rarity: art.rarity });
  } else root = buildCardScene(selectedBoard, progress[selectedBoard]);
  if (route !== 'card' && route !== 'art-preview') cache.set(route, root);
  return root;
}

const director = createSceneDirector<Route>({
  async prepare(route, context) {
    const trace = diagnostics;
    trace.mark(cache.has(route) ? 'prepare.retained' : 'prepare.cold');
    trace.mark('build.start');
    const root = await trace.phase('build', () => getScene(route, context, trace));
    trace.mark('build.end');
    trace.mark('images.start');
    await prepareSceneImages(root, context);
    trace.mark('images.end');
    if (!context.isCurrent()) throw new DOMException('Scene preparation cancelled', 'AbortError');
    const scroll = root.querySelector<HTMLElement>('.jimi-scroll');
    const handle = trace.phase('presentation.create', () => createScenePresentation(root, host,
      route === 'beach' ? {
        // One fresh snapshot per motion, after return-scroll restoration on
        // enter. Offscreen Units stay intact; only their animation is omitted.
        getAdmittedUnitIds: () => getBeachVisibleUnitIds(scroll?.scrollTop ?? NaN, window.innerHeight),
      } : undefined));
    const cancelMotion = handle.cancelMotion;
    const dispose = handle.dispose;
    return {
      ...handle,
      setVisible(visible) {
        diagnostics.phase(`${route}.visible.${visible}`, () => {
          const wasVisible = root.isConnected && !root.hidden;
          if (!visible) captureVisibleSceneScroll(root);
          handle.setVisible(visible);
          if (visible && !wasVisible && root.isConnected && !root.hidden) {
            const position = retainedScrollTops.get(root);
            const scroll = root.querySelector<HTMLElement>('.jimi-scroll');
            if (position !== undefined && scroll) scroll.scrollTop = position;
          }
        });
      },
      setInputEnabled(enabled) { diagnostics.phase(`${route}.input.${enabled}`, () => handle.setInputEnabled(enabled)); },
      enter(context) {
        const operationTrace = diagnostics;
        operationTrace.mark(`${route}.enter.start`);
        return Promise.resolve(operationTrace.phase(`${route}.enter.setup`, () => handle.enter(context)))
          .finally(() => operationTrace.mark(`${route}.enter.end`));
      },
      exit(context) {
        const operationTrace = diagnostics;
        operationTrace.mark(`${route}.exit.start`);
        return Promise.resolve(operationTrace.phase(`${route}.exit.setup`, () => handle.exit(context)))
          .finally(() => operationTrace.mark(`${route}.exit.end`));
      },
      cancelMotion() { flip?.cancel(); flip = undefined; cancelMotion(); },
      dispose() {
        captureVisibleSceneScroll(root);
        diagnostics.phase(`${route}.dispose`, dispose);
        // Bounded Home + Hub + one World. Detail is never an accumulating cache.
        if (route === 'card' || route === 'art-preview') {
          cache.delete(route);
          flipped = false;
        }
      },
    };
  },
});

async function navigate(route: Route): Promise<void> {
  diagnostics.finish('replaced');
  const trace = diagnostics = createSceneDiagnostics(route, diagnosticsEnabled);
  trace.mark(host.classList.contains('jimi-diagnostic-no-art') ? 'art.hidden' : 'art.visible');
  const result = await director.navigate(route);
  trace.finish(result.status);
  if (result.status === 'failed') {
    failedRoute = route;
    if (retry) retry.hidden = false;
    announce(director.getState().currentId ? 'Could not open this screen. Previous screen restored.' : 'Could not load artwork. Tap Retry screen.');
  } else if (result.status === 'shown') {
    if (retry) retry.hidden = true;
    announce('Presentation prototype · gameplay not connected');
  }
}

if (retry) lifecycle.trackListener(retry, 'click', () => { if (!document.hidden) void navigate(failedRoute); });

// Diagnostic-only one-variable A/B: identical DOM, decode and motion, only image
// painting changes. Always starts with authored art visible; never touches assets.
if (diagnosticsEnabled) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'jimi-diagnostic-toggle';
  toggle.textContent = 'Diagnostic art: ON';
  document.body.append(toggle);
  lifecycle.trackListener(toggle, 'click', () => {
    if (director.getState().phase !== 'idle') return;
    const hidden = host.classList.toggle('jimi-diagnostic-no-art');
    toggle.textContent = `Diagnostic art: ${hidden ? 'OFF' : 'ON'}`;
  });
  lifecycle.trackCleanup(() => toggle.remove());
}

lifecycle.trackListener(host, 'click', (event: Event) => {
  if (document.hidden || director.getState().phase !== 'idle') return;
  const target = (event.target as Element).closest<HTMLElement>('[data-jimi-action]');
  if (!target || !host.contains(target) || target.closest('[inert]')) return;
  switch (target.dataset.jimiAction) {
    case 'home': void navigate('home'); break;
    case 'hub': case 'open-hub': void navigate('hub'); break;
    case 'open-world':
      if (target.dataset.worldId === '2') void navigate('beach');
      else announce('Forest and Area 55 are not migrated yet. Beach is the first acceptance slice.');
      break;
    case 'home-slide': {
      const home = cache.get('home')!;
      const id = target.dataset.slideId;
      home.dataset.slideId = id;
      home.querySelectorAll<HTMLElement>('.jimi-home-slide').forEach(panel => { panel.hidden = panel.dataset.slideId !== id; });
      home.querySelectorAll<HTMLElement>('.jimi-home-tab').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.slideId === id)));
      break;
    }
    case 'open-card': selectedBoard = Number(target.dataset.boardId); void navigate('card'); break;
    case 'art-preview': void navigate('art-preview'); break;
    case 'close-card': void navigate('beach'); break;
    case 'flip-card': {
      const rotor = host.querySelector<HTMLElement>('.jimi-card-rotor');
      if (!rotor || flip) return;
      const from = flipped ? 180 : 0;
      flipped = !flipped;
      const to = flipped ? 180 : 0;
      const motion = rotor.animate([{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${to}deg)` }], {
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 160 : 420,
        easing: 'ease-in-out',
      });
      rotor.style.transform = `rotateY(${to}deg)`;
      flip = motion;
      void motion.finished.then(() => { if (flip === motion) flip = undefined; }, () => { if (flip === motion) flip = undefined; });
      break;
    }
    case 'play-board': announce('Gameplay is not connected in this presentation prototype. Existing game and saves are unchanged.'); break;
    case 'open-arcade': case 'open-settings': announce('This screen has not been migrated yet.'); break;
  }
});
lifecycle.trackListener(document, 'visibilitychange', () => {
  if (document.hidden) { director.cancel(); flip?.cancel(); flip = undefined; host.inert = true; }
  else {
    host.inert = false;
    if (!director.getState().currentId) void navigate('home');
  }
});
lifecycle.trackListener(window, 'pagehide', (event: PageTransitionEvent) => {
  if (event.persisted) {
    director.cancel();
    flip?.cancel();
    flip = undefined;
    host.inert = true;
    return;
  }
  if (disposed) return;
  disposed = true;
  director.dispose();
  cache.clear();
  lifecycle.cleanup();
});
lifecycle.trackListener(window, 'pageshow', (event: PageTransitionEvent) => {
  if (!event.persisted || disposed) return;
  host.inert = document.hidden;
  if (!document.hidden && !director.getState().currentId) void navigate('home');
});
applyAppPaperBackground();
void navigate('home');
