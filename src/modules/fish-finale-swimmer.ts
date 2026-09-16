import { gsap } from 'gsap';
import animationManager from './animation-manager.js';
import {
  FISH_SWIM_CYCLE_MS,
  FISH_SWIM_DISPLAY_SIZE,
  FISH_SWIM_HEVC_URL,
  getFishSwimDisplayGeometry,
} from './fish-swim-artwork.ts';
import { MOBILE_RUNTIME_PROFILE } from './mobile-runtime-profile.ts';

export const FISH_FINALE_SWIMMER_SCALE = 0.975;
export const FISH_FINALE_SWIMMER_VISIBLE_SIZE = (
  FISH_SWIM_DISPLAY_SIZE * FISH_FINALE_SWIMMER_SCALE
);
export const FISH_FINALE_SWIMMER_DURATION_SECONDS = 2.4;
export const FISH_FINALE_SWIMMER_EMERGE_SECONDS = 0.22;
export const FISH_FINALE_SWIMMER_FADE_SECONDS = 0.12;
export const FISH_FINALE_SWIMMER_SVG_URL = './assets/shop/fish/fish-merge6-fast.svg';
export const FISH_FINALE_SWIM_CYCLE_MS = FISH_SWIM_CYCLE_MS / 2;

export type FishFinaleSwimmerOrigin = Readonly<{ x: number; y: number }>;
export type FishFinaleSwimmerViewport = Readonly<{ width: number; height: number }>;
export type FishFinaleSwimmerPlan = Readonly<{
  origin: FishFinaleSwimmerOrigin;
  end: FishFinaleSwimmerOrigin;
  direction: -1 | 1;
  verticalDirection: -1 | 1;
  mediaWidth: number;
  mediaHeight: number;
}>;
export type FishFinaleSwimmerPose = Readonly<{
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
}>;

export type FishFinaleSwimmerCleanup = (() => void) & {
  completionDelaySeconds?: number;
};

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

const cubicTravel = (progress: number, firstControl: number, secondControl: number): number => {
  const bounded = clamp(progress, 0, 1);
  const remaining = 1 - bounded;
  return 3 * remaining ** 2 * bounded * firstControl
    + 3 * remaining * bounded ** 2 * secondControl
    + bounded ** 3;
};

const sampleFlightPoint = (progress: number, plan: FishFinaleSwimmerPlan): FishFinaleSwimmerOrigin => ({
  x: plan.origin.x + (plan.end.x - plan.origin.x) * cubicTravel(progress, 0.20, 0.72),
  y: plan.origin.y + (plan.end.y - plan.origin.y) * cubicTravel(progress, 0.08, 0.90),
});

const backOut = (progress: number): number => {
  const bounded = clamp(progress, 0, 1) - 1;
  const strength = 1.70158;
  return 1 + (strength + 1) * bounded ** 3 + strength * bounded ** 2;
};

export function createFishFinaleSwimmerPlan(
  requestedOrigin: FishFinaleSwimmerOrigin | null | undefined,
  requestedViewport: FishFinaleSwimmerViewport,
): FishFinaleSwimmerPlan {
  const width = Math.max(1, Number(requestedViewport?.width) || 390);
  const height = Math.max(1, Number(requestedViewport?.height) || 844);
  const origin = {
    x: Number.isFinite(requestedOrigin?.x) ? Number(requestedOrigin?.x) : width * 0.5,
    y: Number.isFinite(requestedOrigin?.y) ? Number(requestedOrigin?.y) : height * 0.54,
  };
  const direction: -1 | 1 = origin.x <= width * 0.5 ? 1 : -1;
  const verticalDirection: -1 | 1 = origin.y <= height * 0.5 ? 1 : -1;
  const geometry = getFishSwimDisplayGeometry();
  const mediaWidth = geometry.width * FISH_FINALE_SWIMMER_SCALE;
  const mediaHeight = geometry.height * FISH_FINALE_SWIMMER_SCALE;
  const exitMargin = 24;
  return {
    origin,
    end: {
      x: direction === 1
        ? width + mediaWidth * 0.5 + exitMargin
        : -mediaWidth * 0.5 - exitMargin,
      y: verticalDirection === 1
        ? height + mediaHeight * 0.5 + exitMargin
        : -mediaHeight * 0.5 - exitMargin,
    },
    direction,
    verticalDirection,
    mediaWidth,
    mediaHeight,
  };
}

export function sampleFishFinaleSwimmerPose(
  elapsedSeconds: number,
  plan: FishFinaleSwimmerPlan,
): FishFinaleSwimmerPose {
  const time = clamp(elapsedSeconds, 0, FISH_FINALE_SWIMMER_DURATION_SECONDS);
  const progress = time / FISH_FINALE_SWIMMER_DURATION_SECONDS;
  const { x, y } = sampleFlightPoint(progress, plan);

  const sampleGap = 0.002;
  const previousProgress = clamp(progress - sampleGap, 0, 1);
  const nextProgress = clamp(progress + sampleGap, 0, 1);
  const previous = sampleFlightPoint(previousProgress, plan);
  const next = sampleFlightPoint(nextProgress, plan);
  const heading = Math.atan2(next.y - previous.y, next.x - previous.x) * (180 / Math.PI);
  const relativeHeading = plan.direction === 1
    ? heading
    : heading >= 0 ? heading - 180 : heading + 180;

  const emergeProgress = clamp(time / FISH_FINALE_SWIMMER_EMERGE_SECONDS, 0, 1);
  const emergeScale = 0.18 + 0.82 * backOut(emergeProgress);
  const swimPulse = Math.sin(time * Math.PI * 2 / (FISH_FINALE_SWIM_CYCLE_MS / 1000))
    * 0.035
    * Math.sin(Math.PI * progress);
  const remaining = FISH_FINALE_SWIMMER_DURATION_SECONDS - time;
  return {
    x,
    y,
    rotation: clamp(relativeHeading * 0.55 + swimPulse * 55, -20, 20),
    scale: Math.max(0.18, emergeScale + swimPulse),
    opacity: clamp(remaining / FISH_FINALE_SWIMMER_FADE_SECONDS, 0, 1),
  };
}

let preloadedVideo: HTMLVideoElement | null = null;
let hevcUnavailable = false;
let runSequence = 0;

function configureVideo(video: HTMLVideoElement): void {
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.loop = true;
  video.defaultPlaybackRate = 2;
  video.playbackRate = 2;
  video.playsInline = true;
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('aria-hidden', 'true');
}

function configureMedia(media: HTMLImageElement | HTMLVideoElement): void {
  media.style.cssText = [
    'position:absolute',
    'inset:0',
    'width:100%',
    'height:100%',
    'display:block',
    'object-fit:contain',
    'object-position:center',
    'pointer-events:none',
    'user-select:none',
    'backface-visibility:hidden',
  ].join(';');
}

function getOrCreatePreloadedVideo(): HTMLVideoElement {
  if (preloadedVideo) return preloadedVideo;
  const video = document.createElement('video');
  configureVideo(video);
  configureMedia(video);
  video.src = FISH_SWIM_HEVC_URL;
  preloadedVideo = video;
  return video;
}

export function preloadFishFinaleSwimmer(): void {
  if (typeof document === 'undefined') return;
  if (MOBILE_RUNTIME_PROFILE.platform === 'ios' && !hevcUnavailable) {
    const video = getOrCreatePreloadedVideo();
    try { video.load(); } catch { hevcUnavailable = true; }
    return;
  }
  const image = new Image();
  image.src = FISH_FINALE_SWIMMER_SVG_URL;
}

export function attachFishFinaleSwimmer(
  overlay: HTMLElement,
  requestedOrigin?: FishFinaleSwimmerOrigin | null,
): FishFinaleSwimmerCleanup {
  const runId = ++runSequence;
  const viewport = {
    width: Math.max(1, window.innerWidth || 390),
    height: Math.max(1, window.innerHeight || 844),
  };
  const plan = createFishFinaleSwimmerPlan(requestedOrigin, viewport);
  let disposed = false;
  let video: HTMLVideoElement | null = null;
  let image: HTMLImageElement | null = null;

  const field = document.createElement('div');
  field.className = 'cc-fish-finale-swimmer-field';
  field.dataset.fishFinaleSwimmer = 'active';
  field.dataset.fishFinaleDirection = plan.direction === 1 ? 'right' : 'left';
  field.dataset.fishFinaleVerticalDirection = plan.verticalDirection === 1 ? 'down' : 'up';
  field.dataset.fishFinaleOriginX = plan.origin.x.toFixed(2);
  field.dataset.fishFinaleOriginY = plan.origin.y.toFixed(2);
  field.dataset.fishFinaleVisibleSize = String(FISH_FINALE_SWIMMER_VISIBLE_SIZE);
  field.style.cssText = [
    'position:absolute',
    'inset:0',
    'overflow:visible',
    'pointer-events:none',
    'z-index:1',
  ].join(';');

  const host = document.createElement('div');
  host.className = 'cc-fish-finale-swimmer';
  host.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    `width:${plan.mediaWidth}px`,
    `height:${plan.mediaHeight}px`,
    'pointer-events:none',
    'transform-origin:50% 50%',
    'will-change:transform,opacity',
    'backface-visibility:hidden',
  ].join(';');
  field.appendChild(host);
  overlay.appendChild(field);

  const showSvgFallback = () => {
    if (disposed || image) return;
    if (video) {
      video.onerror = null;
      try { video.pause(); } catch {}
      video.remove();
      video = null;
    }
    image = new Image();
    image.alt = '';
    image.draggable = false;
    image.dataset.fishFinaleSource = 'svg-fallback';
    image.setAttribute('aria-hidden', 'true');
    configureMedia(image);
    image.src = `${FISH_FINALE_SWIMMER_SVG_URL}?cc-fish-finale-run=${runId}`;
    host.appendChild(image);
  };

  if (MOBILE_RUNTIME_PROFILE.platform === 'ios' && !hevcUnavailable) {
    video = getOrCreatePreloadedVideo();
    preloadedVideo = null;
    configureVideo(video);
    configureMedia(video);
    video.dataset.fishFinaleSource = 'hevc-alpha';
    video.onerror = () => {
      hevcUnavailable = true;
      showSvgFallback();
    };
    host.appendChild(video);
    try { video.currentTime = 0; } catch {}
    void video.play().catch(() => {
      if (disposed) return;
      hevcUnavailable = true;
      showSvgFallback();
    });
  } else {
    showSvgFallback();
  }

  const clock = { seconds: 0 };
  const timeline = animationManager.trackExternalTimeline(gsap.timeline({ paused: true }));
  const paint = () => {
    const pose = sampleFishFinaleSwimmerPose(clock.seconds, plan);
    host.dataset.fishFinaleX = pose.x.toFixed(2);
    host.dataset.fishFinaleY = pose.y.toFixed(2);
    host.style.opacity = pose.opacity.toFixed(4);
    host.style.transform = [
      `translate3d(${pose.x.toFixed(2)}px,${pose.y.toFixed(2)}px,0)`,
      'translate3d(-50%,-50%,0)',
      `rotate(${pose.rotation.toFixed(2)}deg)`,
      `scale(${(pose.scale * plan.direction).toFixed(4)},${pose.scale.toFixed(4)})`,
    ].join(' ');
  };
  paint();
  timeline.to(clock, {
    seconds: FISH_FINALE_SWIMMER_DURATION_SECONDS,
    duration: FISH_FINALE_SWIMMER_DURATION_SECONDS,
    ease: 'none',
    onUpdate: paint,
  });
  timeline.play(0);

  const cleanup = (() => {
    if (disposed) return;
    disposed = true;
    animationManager.killExternalTimeline(timeline);
    if (video) {
      video.onerror = null;
      try {
        video.pause();
        video.currentTime = 0;
      } catch {}
      video.remove();
      try {
        video.removeAttribute('src');
        video.load();
      } catch {}
      video = null;
    }
    image?.remove();
    image = null;
    field.remove();
  }) as FishFinaleSwimmerCleanup;
  cleanup.completionDelaySeconds = FISH_FINALE_SWIMMER_DURATION_SECONDS;
  return cleanup;
}
