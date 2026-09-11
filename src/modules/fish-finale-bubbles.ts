import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';
import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import { preloadFishFinaleSchool } from './fish-finale-school.ts';

export const FISH_BUBBLES_SOURCE_DURATION_MS = 3600;
export const FISH_BUBBLES_SPEED = 1.5;
export const FISH_BUBBLES_DURATION_MS = FISH_BUBBLES_SOURCE_DURATION_MS / FISH_BUBBLES_SPEED;
export const FISH_BUBBLES_SVG_SOURCE = './assets/shop/fish/bubbly-fast.svg';
export const FISH_BUBBLES_HEVC_SOURCE = './assets/shop/fish/bubbly-fast-hevc.mov';
export const FISH_BUBBLES_START_SCALE = 1.7;
export const FISH_BUBBLES_END_SCALE = 1;
export const FISH_BUBBLES_SCALE_DOWN_START_RATIO = 0.72;
export const FISH_BUBBLES_VERTICAL_OFFSET_VIEWPORT_RATIO = 0.25;

let preloadedVideo: HTMLVideoElement | null = null;
let hevcUnavailable = false;
let fishBubblesRunSequence = 0;

function configureVideo(video: HTMLVideoElement): void {
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.loop = false;
  video.playsInline = true;
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.style.cssText = [
    'position:absolute',
    'inset:0',
    'width:100%',
    'height:100%',
    'display:block',
    'object-fit:cover',
    'object-position:center',
    'pointer-events:none',
  ].join(';');
}

function getOrCreatePreloadedVideo(): HTMLVideoElement {
  if (preloadedVideo) return preloadedVideo;
  const video = document.createElement('video');
  configureVideo(video);
  video.src = FISH_BUBBLES_HEVC_SOURCE;
  preloadedVideo = video;
  return video;
}

function takeVideoForRun(): HTMLVideoElement {
  const video = getOrCreatePreloadedVideo();
  // A completed one-shot HEVC element is not a reusable animation clock on
  // WebKit. Consume the warmed element once so every later Fish finale gets a
  // fresh media owner instead of inheriting an ended playback state.
  preloadedVideo = null;
  return video;
}

function getSvgSourceForRun(runId: number): string {
  // Animated SVG image documents may retain their completed SMIL timeline in
  // the browser image cache. A per-run query creates a fresh document clock
  // while the underlying local asset remains cacheable.
  return `${FISH_BUBBLES_SVG_SOURCE}?cc-fish-bubbles-run=${runId}`;
}

export function preloadFishFinaleBubbles(): void {
  if (typeof document === 'undefined') return;
  preloadFishFinaleSchool();
  if (MOBILE_RUNTIME_PROFILE.platform === 'ios' && !hevcUnavailable) {
    const video = getOrCreatePreloadedVideo();
    try { video.load(); } catch { hevcUnavailable = true; }
    return;
  }
  const image = new Image();
  image.src = FISH_BUBBLES_SVG_SOURCE;
}

export function attachFishFinaleBubbles(
  overlay: HTMLElement,
  attachFishBurst: (bubblyOrigin: { x: number; y: number }) => (() => void),
): (() => void) & { completionDelaySeconds?: number } {
  const runId = ++fishBubblesRunSequence;
  let disposed = false;
  let video: HTMLVideoElement | null = null;
  let image: HTMLImageElement | null = null;

  const field = document.createElement('div');
  field.className = 'cc-fish-finale-bubbles';
  field.dataset.fishBubbles = 'active';
  field.dataset.fishBubblesRun = String(runId);
  field.style.cssText = [
    'position:absolute',
    'inset:0',
    'overflow:hidden',
    'pointer-events:none',
    'z-index:1',
    'contain:layout style paint',
    'transform-origin:50% 50%',
    'will-change:transform',
  ].join(';');

  const showSvgFallback = () => {
    if (disposed || image) return;
    if (video) {
      try { video.pause(); } catch {}
      video.remove();
    }
    image = new Image();
    image.alt = '';
    image.draggable = false;
    image.dataset.fishBubblesSource = 'svg-fast-fallback';
    image.setAttribute('aria-hidden', 'true');
    image.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'display:block',
      'object-fit:cover',
      'object-position:center',
      'pointer-events:none',
    ].join(';');
    image.src = getSvgSourceForRun(runId);
    field.appendChild(image);
  };

  const handleVideoFailure = () => {
    hevcUnavailable = true;
    showSvgFallback();
  };

  if (MOBILE_RUNTIME_PROFILE.platform === 'ios' && !hevcUnavailable) {
    video = takeVideoForRun();
    configureVideo(video);
    video.dataset.fishBubblesSource = 'hevc-alpha';
    video.dataset.fishBubblesRun = String(runId);
    video.addEventListener('error', handleVideoFailure, { once: true });
    field.appendChild(video);
  } else {
    showSvgFallback();
  }

  const viewportWidth = Math.max(320, window.innerWidth || 390);
  const viewportHeight = Math.max(520, window.innerHeight || 844);
  const verticalOffset = viewportHeight * FISH_BUBBLES_VERTICAL_OFFSET_VIEWPORT_RATIO;
  gsap.set(field, {
    y: verticalOffset,
    scale: FISH_BUBBLES_START_SCALE,
    force3D: true,
  });
  field.dataset.fishBubblesVerticalOffset = String(verticalOffset);
  overlay.insertBefore(field, overlay.firstChild);
  const scaleTimeline = animationManager.trackExternalTimeline(gsap.timeline());
  const totalDurationSeconds = FISH_BUBBLES_DURATION_MS / 1000;
  const holdDurationSeconds = totalDurationSeconds * FISH_BUBBLES_SCALE_DOWN_START_RATIO;
  scaleTimeline
    .to(field, {
      scale: FISH_BUBBLES_START_SCALE,
      duration: holdDurationSeconds,
      ease: 'none',
    })
    .to(field, {
      scale: FISH_BUBBLES_END_SCALE,
      duration: totalDurationSeconds - holdDurationSeconds,
      ease: 'power2.inOut',
    });
  const cleanupFishBurst = attachFishBurst({
    x: viewportWidth * 0.5,
    y: viewportHeight * 0.5 + verticalOffset,
  });

  if (video) {
    try { video.currentTime = 0; } catch {}
    void video.play().catch(handleVideoFailure);
  }

  const cleanup = (() => {
    if (disposed) return;
    disposed = true;
    animationManager.killExternalTimeline(scaleTimeline);
    try { cleanupFishBurst(); } catch {}
    if (video) {
      video.removeEventListener('error', handleVideoFailure);
      try {
        video.pause();
        video.currentTime = 0;
      } catch {}
      video.remove();
      try {
        video.removeAttribute('src');
        video.load();
      } catch {}
    }
    image?.remove();
    image = null;
    field.remove();
  }) as (() => void) & { completionDelaySeconds?: number; startExit?: () => void };
  cleanup.startExit = () => {
    try { (cleanupFishBurst as any)?.startExit?.(); } catch {}
  };
  cleanup.completionDelaySeconds = Math.max(
    FISH_BUBBLES_DURATION_MS / 1000,
    Number((cleanupFishBurst as any)?.completionDelaySeconds) || 0,
  );
  return cleanup;
}
