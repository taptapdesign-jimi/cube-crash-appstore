const CONFETTI_COLORS = ['#FBE3C5', '#FA8C00', '#E5C7AD', '#ECD7C2', '#FDBA00', '#FADEC0'];
const BURST_COUNT = 5;
const PIECES_PER_ORIGIN = 15;
const BURST_INTERVAL_MS = 1000;
const PARTICLE_DURATION_MS = 3000;
const MOBILE_CANVAS_PIXEL_RATIO = 1;
const DESKTOP_CANVAS_PIXEL_RATIO_CAP = 1.5;
const EASE_OUT_SAMPLE_COUNT = 256;

interface ConfettiParticle {
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

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let particles: ConfettiParticle[] = [];
let animationFrame = 0;
let spawnBlocked = false;
let cleanupInProgress = false;
let burstCount = 0;
let nextBurstAt = 0;
let canvasWidth = 1;
let canvasHeight = 1;
let pixelRatio = 1;

function cubicBezierCoordinate(time: number, control1: number, control2: number): number {
  const inverse = 1 - time;
  return (3 * inverse * inverse * time * control1)
    + (3 * inverse * time * time * control2)
    + (time * time * time);
}

// The accepted DOM implementation used CSS `ease-out`, which resolves to
// cubic-bezier(0, 0, 0.58, 1). Precompute it once so the canvas path matches
// that motion without solving a bezier for every particle on every frame.
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
      bornAt: now + batchDelay + Math.max(0, (Math.random() * 3000) - 400),
      startX: originX,
      startY,
      endX: originX + endTranslationX,
      // The accepted DOM keyframe used translateY(130vh), not an absolute
      // destination at 130vh. Preserve that exact path from the -30vh origin.
      endY: startY + (canvasHeight * 1.3),
      width: isStrip ? 3 + Math.random() : 4 + (Math.random() * 2),
      height: isStrip ? 8 + (Math.random() * 7) : 6 + (Math.random() * 4),
      borderRadius: isStrip ? 2 : 1,
      rotationTravel: 360 + (Math.random() * 720),
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    });
  }
}

function spawnBurst(now: number): void {
  const batchDelay = burstCount === 0 ? 0 : Math.random() * 200;
  addOrigin(now, batchDelay, -(canvasWidth * 0.3), Math.PI / 4, 'left');
  addOrigin(now, batchDelay, canvasWidth * 1.3, (3 * Math.PI) / 4, 'right');
  addOrigin(now, batchDelay, canvasWidth * 0.25, (Math.PI / 2) - 0.3, 'left');
  addOrigin(now, batchDelay, canvasWidth * 0.75, (Math.PI / 2) + 0.3, 'right');
  burstCount += 1;
  nextBurstAt = now + BURST_INTERVAL_MS;
}

function drawParticle(particle: ConfettiParticle, now: number): boolean {
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
    // Older mobile canvases still receive the exact accepted motion; only the
    // tiny corner radius falls back to a regular rectangle.
    context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
  }
  context.restore();
  return true;
}

function finishRuntimeIfIdle(): boolean {
  if (particles.length > 0 || (!spawnBlocked && burstCount < BURST_COUNT)) return false;
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
  if (!spawnBlocked && burstCount < BURST_COUNT && now >= nextBurstAt) spawnBurst(now);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  particles = particles.filter((particle) => drawParticle(particle, now));
  if (finishRuntimeIfIdle()) return;
  animationFrame = requestAnimationFrame(renderFrame);
}

export function createConfettiExplosion(_element: HTMLElement): void {
  if (cleanupInProgress || spawnBlocked) return;
  if (canvas || particles.length > 0 || animationFrame) cleanupConfetti();
  spawnBlocked = false;
  if (!ensureCanvas()) return;
  const now = performance.now();
  burstCount = 0;
  nextBurstAt = now;
  spawnBurst(now);
  animationFrame = requestAnimationFrame(renderFrame);
}

// Stop future waves and delayed particles while allowing already-visible pieces
// to finish their current flight.
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
} {
  return {
    canvasCount: canvas?.isConnected ? 1 : 0,
    particleCount: particles.length,
    animationFrameCount: animationFrame ? 1 : 0,
    burstCount,
    spawnBlocked,
    pixelRatio,
  };
}
