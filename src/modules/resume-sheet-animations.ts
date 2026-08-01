// resume-sheet-animations.ts
// Animations for resume game bottom sheet
// 🔥 DEAD CODE REMOVED: All unused animation functions removed (~350 lines)
// Only keeping animateBottomSheetEntrance which is the only function actually used

import { gsap } from 'gsap';

const activeEntranceFrames = new WeakMap<HTMLElement, number>();

function cancelActiveEntranceFrame(modal: HTMLElement): void {
  const frame = activeEntranceFrames.get(modal);
  if (frame != null) {
    try { cancelAnimationFrame(frame); } catch {}
    activeEntranceFrames.delete(modal);
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeOutBack(t: number): number {
  const c1 = 1.55;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function getEntranceYPercent(progress: number, overshootScale = 1): number {
  const firstOvershoot = -5.5 * overshootScale;
  const rebound = 2 * overshootScale;
  if (progress < 0.58) {
    return lerp(100, firstOvershoot, easeOutCubic(progress / 0.58));
  }
  if (progress < 0.75) {
    return lerp(firstOvershoot, rebound, easeOutQuad((progress - 0.58) / 0.17));
  }
  return lerp(rebound, 0, easeOutBack((progress - 0.75) / 0.25));
}

function setSheetY(modal: HTMLElement, yPercent: number): void {
  const value = `translateY(${yPercent}%) translateZ(0)`;
  modal.style.transform = value;
  modal.style.webkitTransform = value;
}

/**
 * Animate bottom sheet entrance
 * Uses a local RAF driver instead of GSAP so app/global timeline pauses cannot flatten the sheet bounce.
 */
export interface BottomSheetEntranceOptions {
  durationMs?: number;
  overshootScale?: number;
  shadowActiveClass?: string;
  restoreCssTransition?: boolean;
}

export function animateBottomSheetEntrance(
  modal: HTMLElement,
  options: BottomSheetEntranceOptions = {},
): Promise<void> {
  return new Promise((resolve) => {
    console.log('🎬 Starting entrance animation...');
    
    // Step 1: Set initial state while hidden
    cancelActiveEntranceFrame(modal);
    modal.style.display = 'block';
    modal.style.transition = 'none';
    modal.classList.remove('visible');
    gsap.killTweensOf(modal);
    modal.style.transformOrigin = '50% 100%';
    modal.style.willChange = 'transform';
    setSheetY(modal, 100);
    
    // Step 2: Force reflow
    void modal.offsetHeight;

    const shadowActiveClass = options.shadowActiveClass
      ?? (modal.classList.contains('simple-bottom-sheet') && !modal.classList.contains('score-bottom-sheet')
        ? 'end-run-shadow-active'
        : null);
    if (shadowActiveClass) {
      modal.classList.add(shadowActiveClass);
    }
    
    const durationMs = options.durationMs ?? 550;
    const overshootScale = options.overshootScale ?? 1;
    const startedAt = performance.now();

    const complete = () => {
      activeEntranceFrames.delete(modal);
      if ((modal as any)._closing === true || !modal.isConnected) {
        resolve();
        return;
      }
      setSheetY(modal, 0);
      modal.classList.add('visible');
      modal.style.removeProperty('will-change');
      if (options.restoreCssTransition) modal.style.removeProperty('transition');
      console.log('✅ Animation complete');
      resolve();
    };

    const tick = (now: number) => {
      if (!modal.isConnected || (modal as any)._closing === true) {
        activeEntranceFrames.delete(modal);
        resolve();
        return;
      }

      const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
      setSheetY(modal, getEntranceYPercent(progress, overshootScale));

      if (progress >= 1) {
        complete();
        return;
      }

      const frame = requestAnimationFrame(tick);
      activeEntranceFrames.set(modal, frame);
    };

    const frame = requestAnimationFrame(tick);
    activeEntranceFrames.set(modal, frame);
    
    console.log('✅ Animation triggered');
  });
}
