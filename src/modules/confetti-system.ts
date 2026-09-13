import {
  BEE_LEAF_LAST_END_SECONDS,
  BEE_LEAF_END_SECONDS,
  BEE_LEAF_PARTICLE_COUNT,
  BEE_LEAF_START_SECONDS,
  BEE_LEAVES_PER_BURST,
  getBeeLeafAssetSource,
  resolveBeeLeafGravity,
  sampleBeeLeafParticlePose,
  type BeeLeafParticleMotion,
} from './bee-leaf-particle-motion.js';
import {
  createMixedBottleBubbleOpacities,
  getBottleBubbleAssetSource,
} from './bottle-bubble-presentation.js';
import type { CleanBoardCelebrationTheme } from './clean-board-celebration-theme.js';

const CONFETTI_COLORS = ['#FBE3C5', '#FA8C00', '#E5C7AD', '#ECD7C2', '#FDBA00', '#FADEC0'];
const BURST_COUNT = 5;
const PIECES_PER_ORIGIN = 15;
const BURST_INTERVAL_MS = 1000;
const PARTICLE_DURATION_MS = 3000;
const LATEST_PARTICLE_BIRTH_JITTER_MS = 2600;
const LATEST_BATCH_DELAY_MS = 200;
export const CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS = (
  (BURST_COUNT - 1) * BURST_INTERVAL_MS
  + LATEST_BATCH_DELAY_MS
  + LATEST_PARTICLE_BIRTH_JITTER_MS
  + PARTICLE_DURATION_MS
);
const MOBILE_CANVAS_PIXEL_RATIO = 1;
const DESKTOP_CANVAS_PIXEL_RATIO_CAP = 1.5;
const EASE_OUT_SAMPLE_COUNT = 256;
const FOREST_MERGE_BURST_LEAVES = 12;
const FOREST_LEAF_WAVE_COUNT = BEE_LEAF_PARTICLE_COUNT / BEE_LEAVES_PER_BURST;
const FOREST_LEAF_SLOT_DELAY_SECONDS = 0.018;
const BEACH_BUBBLE_COUNT = 40;
const BEACH_BUBBLE_WAVE_SIZES = [6, 10, 7, 7, 5, 5] as const;
export const BEACH_CLEAN_BOARD_OPACITY_SCALE = 0.8;
export const BEACH_CLEAN_BOARD_MIN_BUBBLE_TRAVEL_MS = 1650;
export const BEACH_CLEAN_BOARD_MAX_BUBBLE_TRAVEL_MS = 2150;
const BEACH_LAST_WAVE_MAX_SLOT_DELAY_MS = 4 * 80;
const BEACH_LAST_WAVE_AT_MS = CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS
  - BEACH_CLEAN_BOARD_MAX_BUBBLE_TRAVEL_MS
  - BEACH_LAST_WAVE_MAX_SLOT_DELAY_MS;

function getAuthoredBeeLeafStartSeconds(index: number): number {
  const waveIndex = Math.floor(index / BEE_LEAVES_PER_BURST);
  const waveSlot = index % BEE_LEAVES_PER_BURST;
  if (index < FOREST_MERGE_BURST_LEAVES) {
    return waveSlot * FOREST_LEAF_SLOT_DELAY_SECONDS + waveIndex * 0.028;
  }
  return waveIndex * (
    (BEE_LEAF_END_SECONDS - BEE_LEAF_START_SECONDS) / (FOREST_LEAF_WAVE_COUNT - 1)
  ) + waveSlot * FOREST_LEAF_SLOT_DELAY_SECONDS;
}

function getAuthoredBeeLeafLifetimeSeconds(index: number): number {
  return Math.min(
    1.18 + index % 5 * 0.09,
    BEE_LEAF_LAST_END_SECONDS - getAuthoredBeeLeafStartSeconds(index),
  );
}

const FOREST_LAST_WAVE_FIRST_INDEX = BEE_LEAF_PARTICLE_COUNT - BEE_LEAVES_PER_BURST;
const FOREST_LAST_WAVE_END_SECONDS = Math.max(...Array.from(
  { length: BEE_LEAVES_PER_BURST },
  (_, slot) => (
    slot * FOREST_LEAF_SLOT_DELAY_SECONDS
    + getAuthoredBeeLeafLifetimeSeconds(FOREST_LAST_WAVE_FIRST_INDEX + slot)
  ),
));
const FOREST_LAST_WAVE_START_SECONDS = (
  CLEAN_BOARD_CONFETTI_MAX_RUNTIME_MS / 1000
) - FOREST_LAST_WAVE_END_SECONDS;

interface Area55ConfettiParticle {
  kind: 'area55';
  bornAt: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  height: number;
  borderRadius: number;
  rotationTravel: number;
  color: string;
}

interface ForestLeafParticle extends BeeLeafParticleMotion {
  kind: 'forest';
  bornAt: number;
  width: number;
  height: number;
  assetIndex: number;
}

export interface CleanBoardBeachBubbleMotion {
  startX: number;
  startY: number;
  rise: number;
  weaveDirection: -1 | 1;
  weaveDistance: number;
  weaveCycles: number;
}

interface BeachBubbleParticle extends CleanBoardBeachBubbleMotion {
  kind: 'beach';
  bornAt: number;
  lifetimeMs: number;
  size: number;
  scale: number;
  opacity: number;
  assetIndex: number;
}

type CelebrationParticle = Area55ConfettiParticle | ForestLeafParticle | BeachBubbleParticle;

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let particles: CelebrationParticle[] = [];
let animationFrame = 0;
let spawnBlocked = false;
let cleanupInProgress = false;
let burstCount = 0;
let nextBurstAt = 0;
let canvasWidth = 1;
let canvasHeight = 1;
let pixelRatio = 1;
let activeTheme: CleanBoardCelebrationTheme = 'area55';
let celebrationStartedAt = 0;
let forestLeafImages: HTMLImageElement[] | null = null;
let beachBubbleImages: HTMLImageElement[] | null = null;

function cubicBezierCoordinate(time: number, control1: number, control2: number): number {
  const inverse = 1 - time;
  return (3 * inverse * inverse * time * control1)
    + (3 * inverse * time * time * control2)
    + (time * time * time);
}

// The accepted Area 55 implementation used CSS `ease-out`, which resolves to
// cubic-bezier(0, 0, 0.58, 1). Its samples and draw path remain unchanged.
const EASE_OUT_SAMPLES = Array.from({ length: EASE_OUT_SAMPLE_COUNT + 1 }, (_, index) => {
  const progress = index / EASE_OUT_SAMPLE_COUNT;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const midpoint = (low + high) / 2;
    const x = cubicBezierCoordinate(midpoint, 0, 0.58);
    if (x < progress) low = midpoint;
    else high = midpoint;
  }
  return cubicBezierCoordinate((low + high) / 2, 0, 1);
});

function acceptedEaseOut(progress: number): number {
  const bounded = Math.max(0, Math.min(1, progress));
  const samplePosition = bounded * EASE_OUT_SAMPLE_COUNT;
  const lowerIndex = Math.floor(samplePosition);
  const upperIndex = Math.min(EASE_OUT_SAMPLE_COUNT, lowerIndex + 1);
  const mix = samplePosition - lowerIndex;
  return EASE_OUT_SAMPLES[lowerIndex]
    + ((EASE_OUT_SAMPLES[upperIndex] - EASE_OUT_SAMPLES[lowerIndex]) * mix);
}

function sineInOut(progress: number): number {
  const bounded = Math.max(0, Math.min(1, progress));
  return 0.5 - Math.cos(Math.PI * bounded) * 0.5;
}

function isMobileRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function resizeCanvas(): void {
  if (!canvas || !context) return;
  canvasWidth = Math.max(1, window.innerWidth || 1);
  canvasHeight = Math.max(1, window.innerHeight || 1);
  pixelRatio = isMobileRuntime()
    ? MOBILE_CANVAS_PIXEL_RATIO
    : Math.min(window.devicePixelRatio || 1, DESKTOP_CANVAS_PIXEL_RATIO_CAP);
  canvas.width = Math.max(1, Math.ceil(canvasWidth * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(canvasHeight * pixelRatio));
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function ensureCanvas(): boolean {
  if (canvas?.isConnected && context) return true;
  canvas = document.createElement('canvas');
  canvas.className = 'cc-confetti-canvas';
  canvas.dataset.celebrationTheme = activeTheme;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:block',
    'pointer-events:none',
    'user-select:none',
    'contain:strict',
    'z-index:99999999999999',
  ].join(';');
  context = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!context) {
    canvas.remove();
    canvas = null;
    return false;
  }
  document.body.appendChild(canvas);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  return true;
}

function createImageSet(sourceForIndex: (index: number) => string): HTMLImageElement[] {
  if (typeof Image === 'undefined') return [];
  return Array.from({ length: 6 }, (_, index) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = sourceForIndex(index);
    return image;
  });
}

function getForestLeafImages(): HTMLImageElement[] {
  forestLeafImages ??= createImageSet(getBeeLeafAssetSource);
  return forestLeafImages;
}

function getBeachBubbleImages(): HTMLImageElement[] {
  beachBubbleImages ??= createImageSet(getBottleBubbleAssetSource);
  return beachBubbleImages;
}

function addOrigin(
  now: number,
  batchDelay: number,
  startX: number,
  baseAngle: number,
  side: 'left' | 'right',
): void {
  const isLeft = side === 'left';
  for (let index = 0; index < PIECES_PER_ORIGIN; index += 1) {
    const angle = baseAngle + ((Math.random() - 0.5) * 0.25);
    const weightCategory = index % 3;
    const velocityMin = weightCategory === 0 ? 120 : weightCategory === 1 ? 150 : 180;
    const velocityMax = weightCategory === 0 ? 180 : weightCategory === 1 ? 220 : 280;
    const velocity = velocityMin + (Math.random() * (velocityMax - velocityMin));
    const isStrip = index % 2 === 0;
    const originX = startX + (isLeft ? Math.random() * 150 : -Math.random() * 150);
    const startY = -(canvasHeight * 0.3) + (Math.random() * 50);
    const wiggleAmount = 80 + (Math.random() * 120);
    const wigglePhase = Math.random() * Math.PI * 2;
    const endTranslationX = (Math.cos(angle) * velocity * 2)
      + (Math.sin(wigglePhase + 1) * wiggleAmount);
    particles.push({
      kind: 'area55',
      bornAt: now + batchDelay + Math.max(0, (Math.random() * 3000) - 400),
      startX: originX,
      startY,
      endX: originX + endTranslationX,
      endY: startY + (canvasHeight * 1.3),
      width: isStrip ? 3 + Math.random() : 4 + (Math.random() * 2),
      height: isStrip ? 8 + (Math.random() * 7) : 6 + (Math.random() * 4),
      borderRadius: isStrip ? 2 : 1,
      rotationTravel: 360 + (Math.random() * 720),
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    });
  }
}

function spawnArea55Burst(now: number): void {
  const batchDelay = burstCount === 0 ? 0 : Math.random() * 200;
  addOrigin(now, batchDelay, -(canvasWidth * 0.3), Math.PI / 4, 'left');
  addOrigin(now, batchDelay, canvasWidth * 1.3, (3 * Math.PI) / 4, 'right');
  addOrigin(now, batchDelay, canvasWidth * 0.25, (Math.PI / 2) - 0.3, 'left');
  addOrigin(now, batchDelay, canvasWidth * 0.75, (Math.PI / 2) + 0.3, 'right');
  burstCount += 1;
  nextBurstAt = now + BURST_INTERVAL_MS;
}

function spawnForestLeaves(now: number): void {
  getForestLeafImages();
  const wobblePhase = Math.random() * Math.PI * 2;
  for (let index = 0; index < BEE_LEAF_PARTICLE_COUNT; index += 1) {
    const waveIndex = Math.floor(index / BEE_LEAVES_PER_BURST);
    const waveSlot = index % BEE_LEAVES_PER_BURST;
    const isOpeningBurst = index < FOREST_MERGE_BURST_LEAVES;
    const lifetime = getAuthoredBeeLeafLifetimeSeconds(index);
    const waveProgress = waveIndex / (FOREST_LEAF_WAVE_COUNT - 1);
    const startAt = waveProgress * FOREST_LAST_WAVE_START_SECONDS
      + waveSlot * FOREST_LEAF_SLOT_DELAY_SECONDS;
    const randomUnit = (Math.sin((index + 1) * 91.731 + wobblePhase * 13.17) + 1) * 0.5;
    const angle = (index * 2.399963229728653 + randomUnit * 0.9) % (Math.PI * 2);
    const laneX = ((index + 0.5) / BEE_LEAF_PARTICLE_COUNT) * canvasWidth;
    const birthX = laneX + Math.cos(angle) * (12 + index % 4 * 9);
    const sizeBoost = isOpeningBurst ? 2 : index % 5 === 0 ? 1.5 : randomUnit > 0.78 ? 2 : 1;
    const width = (16 + Math.round(((randomUnit * 17 + index * 7.31) % 1) * 22)) * sizeBoost;
    const heightUnit = (Math.sin((index + 3) * 47.17 + wobblePhase * 5.3) + 1) * 0.5;
    const height = (14 + Math.round(heightUnit * 28)) * sizeBoost;
    const birthY = -height * 0.6 - waveSlot * 8;
    const scatterDistance = canvasWidth * (0.476 + randomUnit * 0.714);
    const velocityX = Math.cos(angle) * scatterDistance / lifetime;
    const velocityY = Math.sin(angle) * scatterDistance / lifetime - 90 - index % 3 * 18;
    const gravity = resolveBeeLeafGravity({
      viewportHeight: canvasHeight,
      birthY,
      velocityY,
      lifetime,
    });
    const bornAt = now + startAt * 1000;
    particles.push({
      kind: 'forest',
      bornAt,
      birth: bornAt / 1000,
      lifetime,
      birthX,
      birthY,
      velocityX,
      velocityY,
      gravity,
      flutter: index * 1.73,
      spin: (index % 2 ? 1 : -1) * (260 + index % 6 * 48),
      scale: index % 3 !== 0 ? 1.08 : 0.88,
      peakOpacity: index % 3 !== 0 ? 1 : 0.86,
      width,
      height,
      assetIndex: index % 6,
    });
  }
  burstCount = BURST_COUNT;
}

function spawnBeachBubbles(now: number): void {
  getBeachBubbleImages();
  const opacities = createMixedBottleBubbleOpacities(BEACH_BUBBLE_COUNT);
  let waveStartIndex = 0;
  let waveIndex = 0;
  for (let index = 0; index < BEACH_BUBBLE_COUNT; index += 1) {
    while (
      index >= waveStartIndex + BEACH_BUBBLE_WAVE_SIZES[waveIndex]
      && waveIndex < BEACH_BUBBLE_WAVE_SIZES.length - 1
    ) {
      waveStartIndex += BEACH_BUBBLE_WAVE_SIZES[waveIndex];
      waveIndex += 1;
    }
    const waveSlot = index - waveStartIndex;
    const slotsInWave = BEACH_BUBBLE_WAVE_SIZES[waveIndex];
    const laneProgress = (waveSlot + 0.12 + Math.random() * 0.76) / slotsInWave;
    const startX = (2 + laneProgress * 96) / 100 * canvasWidth;
    const verticalGap = 50 + Math.random() * 50;
    const verticalLane = waveSlot % 4;
    const startY = canvasHeight * (1.03 + Math.random() * 0.08) + verticalLane * verticalGap;
    const isSmallBubble = index >= 25;
    const sizeMultiplier = isSmallBubble ? 1.08 : 2.4;
    const size = (18 + Math.pow(Math.random(), 1.6) * 42) * sizeMultiplier;
    const rise = startY + size * (1.1 + Math.random() * 1.4);
    const weaveDirection: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
    const weaveDistance = Math.max(16, canvasWidth * (0.03 + Math.random() * 0.09));
    const weaveCycles = 1.35 + Math.random() * 0.3;
    const sampledLifetimeMs = BEACH_CLEAN_BOARD_MIN_BUBBLE_TRAVEL_MS
      + Math.random() * (
        BEACH_CLEAN_BOARD_MAX_BUBBLE_TRAVEL_MS - BEACH_CLEAN_BOARD_MIN_BUBBLE_TRAVEL_MS
      );
    const waveProgress = waveIndex / (BEACH_BUBBLE_WAVE_SIZES.length - 1);
    const waveStartMs = waveProgress * BEACH_LAST_WAVE_AT_MS;
    const sampledWithinWaveDelayMs = waveSlot * (45 + Math.random() * 35);
    const isLifecycleClosingBubble = index === BEACH_BUBBLE_COUNT - 1;
    const lifetimeMs = isLifecycleClosingBubble
      ? BEACH_CLEAN_BOARD_MAX_BUBBLE_TRAVEL_MS
      : sampledLifetimeMs;
    const withinWaveDelayMs = isLifecycleClosingBubble
      ? BEACH_LAST_WAVE_MAX_SLOT_DELAY_MS
      : sampledWithinWaveDelayMs;
    particles.push({
      kind: 'beach',
      bornAt: now + waveStartMs + withinWaveDelayMs,
      lifetimeMs,
      startX,
      startY,
      rise,
      weaveDirection,
      weaveDistance,
      weaveCycles,
      size,
      scale: 0.75 + Math.random() * 0.35,
      opacity: (opacities[index] ?? 0.2) * BEACH_CLEAN_BOARD_OPACITY_SCALE,
      assetIndex: index % 6,
    });
  }
  burstCount = BURST_COUNT;
}

function drawArea55Particle(particle: Area55ConfettiParticle, now: number): boolean {
  if (!context || now < particle.bornAt) return now < particle.bornAt + PARTICLE_DURATION_MS;
  const progress = Math.min(1, (now - particle.bornAt) / PARTICLE_DURATION_MS);
  if (progress >= 1) return false;
  const travel = acceptedEaseOut(progress);
  const x = particle.startX + ((particle.endX - particle.startX) * travel);
  const y = particle.startY + ((particle.endY - particle.startY) * travel);

  context.save();
  context.translate(x, y);
  context.rotate((particle.rotationTravel * travel) * (Math.PI / 180));
  context.globalAlpha = 0.9;
  context.fillStyle = particle.color;
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(
      -particle.width / 2,
      -particle.height / 2,
      particle.width,
      particle.height,
      particle.borderRadius,
    );
    context.fill();
  } else {
    context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
  }
  context.restore();
  return true;
}

function drawForestLeaf(particle: ForestLeafParticle, now: number): boolean {
  if (!context) return false;
  const endAt = particle.bornAt + particle.lifetime * 1000;
  if (now < particle.bornAt) return true;
  if (now >= endAt) return false;
  const pose = sampleBeeLeafParticlePose(particle, now / 1000);
  const image = getForestLeafImages()[particle.assetIndex];
  if (!pose.visible || !image?.complete || image.naturalWidth <= 0) return true;

  context.save();
  context.translate(pose.x, pose.y);
  context.rotate(pose.rotation * Math.PI / 180);
  context.scale(pose.scale, pose.scale);
  context.transform(1, 0, Math.tan(pose.skewX * Math.PI / 180), 1, 0, 0);
  context.scale(pose.imageScaleX, pose.imageScaleY);
  context.globalAlpha = pose.opacity;
  context.drawImage(image, -particle.width / 2, -particle.height / 2, particle.width, particle.height);
  context.restore();
  return true;
}

export function sampleCleanBoardBeachBubblePoint(
  particle: CleanBoardBeachBubbleMotion,
  progress: number,
): { x: number; y: number } {
  const bounded = Math.max(0, Math.min(1, progress));
  const horizontalWave = Math.sin(bounded * Math.PI * 2 * particle.weaveCycles);
  return {
    x: particle.startX
      + particle.weaveDirection * particle.weaveDistance * horizontalWave,
    // One continuous linear rise keeps vertical velocity moderate and non-zero;
    // horizontal turning never stalls the bubble's upward travel.
    y: particle.startY - particle.rise * bounded,
  };
}

function drawBeachBubble(particle: BeachBubbleParticle, now: number): boolean {
  if (!context) return false;
  if (now < particle.bornAt) return true;
  const progress = (now - particle.bornAt) / particle.lifetimeMs;
  if (progress >= 1) return false;
  const image = getBeachBubbleImages()[particle.assetIndex];
  if (!image?.complete || image.naturalWidth <= 0) return true;
  const point = sampleCleanBoardBeachBubblePoint(particle, progress);
  const enter = Math.min(1, (now - particle.bornAt) / 120);
  const exit = progress > 0.92 ? Math.max(0, (1 - progress) / 0.08) : 1;
  const scale = particle.scale * (0.35 + sineInOut(enter) * 0.65) * (0.96 + progress * 0.12);

  context.save();
  context.translate(point.x, point.y);
  context.scale(scale, scale);
  context.globalAlpha = particle.opacity * enter * exit;
  context.drawImage(image, -particle.size / 2, -particle.size / 2, particle.size, particle.size);
  context.restore();
  return true;
}

function drawParticle(particle: CelebrationParticle, now: number): boolean {
  if (particle.kind === 'forest') return drawForestLeaf(particle, now);
  if (particle.kind === 'beach') return drawBeachBubble(particle, now);
  return drawArea55Particle(particle, now);
}

function finishRuntimeIfIdle(): boolean {
  if (particles.length > 0 || (!spawnBlocked && activeTheme === 'area55' && burstCount < BURST_COUNT)) {
    return false;
  }
  animationFrame = 0;
  window.removeEventListener('resize', resizeCanvas);
  canvas?.remove();
  canvas = null;
  context = null;
  return true;
}

function renderFrame(now: number): void {
  animationFrame = 0;
  if (cleanupInProgress || !canvas || !context) return;
  if (!spawnBlocked && activeTheme === 'area55' && burstCount < BURST_COUNT && now >= nextBurstAt) {
    spawnArea55Burst(now);
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  particles = particles.filter((particle) => drawParticle(particle, now));
  if (finishRuntimeIfIdle()) return;
  animationFrame = requestAnimationFrame(renderFrame);
}

export function createConfettiExplosion(
  _element: HTMLElement,
  theme: CleanBoardCelebrationTheme = 'area55',
): void {
  if (cleanupInProgress || spawnBlocked) return;
  if (canvas || particles.length > 0 || animationFrame) cleanupConfetti();
  spawnBlocked = false;
  activeTheme = theme;
  if (!ensureCanvas()) return;
  const now = performance.now();
  burstCount = 0;
  nextBurstAt = now;
  celebrationStartedAt = now;
  if (activeTheme === 'forest') spawnForestLeaves(now);
  else if (activeTheme === 'beach') spawnBeachBubbles(now);
  else spawnArea55Burst(now);
  animationFrame = requestAnimationFrame(renderFrame);
}

export function stopConfettiSpawns(): void {
  spawnBlocked = true;
  const now = performance.now();
  particles = particles.filter((particle) => particle.bornAt <= now);
  finishRuntimeIfIdle();
}

export function cleanupConfetti(): void {
  cleanupInProgress = true;
  spawnBlocked = true;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  window.removeEventListener('resize', resizeCanvas);
  canvas?.remove();
  canvas = null;
  context = null;
  particles = [];
  burstCount = 0;
  nextBurstAt = 0;
  celebrationStartedAt = 0;
  activeTheme = 'area55';
  cleanupInProgress = false;
}

export function allowConfettiSpawns(): void {
  if (!cleanupInProgress) spawnBlocked = false;
}

export function getConfettiRuntimeSnapshot(): {
  canvasCount: number;
  particleCount: number;
  animationFrameCount: number;
  burstCount: number;
  spawnBlocked: boolean;
  pixelRatio: number;
  theme: CleanBoardCelebrationTheme;
  forestLeafCount: number;
  beachBubbleCount: number;
  forestHighestBirthY: number | null;
  beachLowestBirthY: number | null;
  beachOpacityRange: readonly [number, number] | null;
  forestScheduledRuntimeMs: number | null;
  beachScheduledRuntimeMs: number | null;
} {
  const forestParticles = particles.filter(
    (particle): particle is ForestLeafParticle => particle.kind === 'forest',
  );
  const beachParticles = particles.filter(
    (particle): particle is BeachBubbleParticle => particle.kind === 'beach',
  );
  const beachOpacities = beachParticles.map((particle) => particle.opacity);
  const forestScheduledRuntimeMs = forestParticles.length > 0
    ? Math.max(...forestParticles.map(
      (particle) => particle.bornAt + particle.lifetime * 1000 - celebrationStartedAt,
    ))
    : null;
  const beachScheduledRuntimeMs = beachParticles.length > 0
    ? Math.max(...beachParticles.map(
      (particle) => particle.bornAt + particle.lifetimeMs - celebrationStartedAt,
    ))
    : null;
  return {
    canvasCount: canvas?.isConnected ? 1 : 0,
    particleCount: particles.length,
    animationFrameCount: animationFrame ? 1 : 0,
    burstCount,
    spawnBlocked,
    pixelRatio,
    theme: activeTheme,
    forestLeafCount: forestParticles.length,
    beachBubbleCount: beachParticles.length,
    forestHighestBirthY: forestParticles.length > 0
      ? Math.max(...forestParticles.map((particle) => particle.birthY))
      : null,
    beachLowestBirthY: beachParticles.length > 0
      ? Math.min(...beachParticles.map((particle) => particle.startY))
      : null,
    beachOpacityRange: beachOpacities.length > 0
      ? [Math.min(...beachOpacities), Math.max(...beachOpacities)]
      : null,
    forestScheduledRuntimeMs,
    beachScheduledRuntimeMs,
  };
}
