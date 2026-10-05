import './styles.css';
import { createScreenLifecycle } from '../utils/screen-lifecycle.js';
import { applyAppPaperBackground } from '../utils/app-paper-background.js';
import { resolveJourneyCardAsset } from '../modules/journey-card-assets.js';
import { createSceneDirector } from './scene-director.js';
import { createScenePresentation } from './scene-presentation.js';
import { prepareSceneImages } from './scene-resources.js';
import { measureTransition } from './transition-measurement.js';
import { buildHomeScene, buildHubScene, buildBeachScene, buildCardScene, buildCardPreviewScene } from './scene-builders.js';
import type { JimiProgressSnapshot } from './scene-catalog.js';

type Route = 'home' | 'hub' | 'beach' | 'card' | 'art-preview';
const host = document.getElementById('jimi-root')!;
const status = document.getElementById('jimi-status')!;
const retry = document.getElementById('jimi-retry');
const lifecycle = createScreenLifecycle('jimi-2026');
// Deliberately no second save reader/writer. The gameplay migration will inject
// a canonical immutable snapshot. Unknown progress is visibly unknown, not 0.
const progress: JimiProgressSnapshot = Object.freeze({});
const cache = new Map<Route, HTMLElement>();
let selectedBoard = 11;
let flip: Animation | undefined;
let flipped = false;
let disposed = false;
let failedRoute: Route = 'home';

function announce(message: string): void { status.textContent = message; }
function getScene(route: Route): HTMLElement {
  const retained = cache.get(route);
  if (retained) return retained;
  let root: HTMLElement;
  if (route === 'home') root = buildHomeScene();
  else if (route === 'hub') root = buildHubScene(progress);
  else if (route === 'beach') {
    root = buildBeachScene(progress);
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
    const root = getScene(route);
    await prepareSceneImages(root, context);
    if (!context.isCurrent()) throw new DOMException('Scene preparation cancelled', 'AbortError');
    const handle = createScenePresentation(root, host);
    const cancelMotion = handle.cancelMotion;
    const dispose = handle.dispose;
    return {
      ...handle,
      cancelMotion() { flip?.cancel(); flip = undefined; cancelMotion(); },
      dispose() {
        dispose();
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
  const finishMeasurement = measureTransition(route, document.documentElement.dataset.jimiMetrics === 'true');
  const result = await director.navigate(route);
  finishMeasurement(result.status);
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
