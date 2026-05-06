// resume-sheet-animations.ts
// Animations for resume game bottom sheet
// 🔥 DEAD CODE REMOVED: All unused animation functions removed (~350 lines)
// Only keeping animateBottomSheetEntrance which is the only function actually used

import { gsap } from 'gsap';

/**
 * Animate bottom sheet entrance
 * OPTIMIZED: Removed unnecessary requestAnimationFrame delay for instant response
 */
export function animateBottomSheetEntrance(modal: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    console.log('🎬 Starting entrance animation...');
    
    // Step 1: Set initial state while hidden
    modal.style.display = 'block';
    modal.style.transition = 'none';
    gsap.killTweensOf(modal);
    gsap.set(modal, {
      yPercent: 100,
      transformOrigin: '50% 100%',
      force3D: true,
    });
    
    // Step 2: Force reflow
    void modal.offsetHeight;

    if (modal.classList.contains('simple-bottom-sheet') && !modal.classList.contains('score-bottom-sheet')) {
      modal.classList.add('end-run-shadow-active');
    }
    
    // Step 3: Trigger springy Y overshoot IMMEDIATELY (no requestAnimationFrame delay)
    gsap.timeline({
      defaults: { force3D: true },
      onComplete: () => {
        modal.classList.add('visible');
        gsap.set(modal, { yPercent: 0, clearProps: 'willChange,force3D' });
        console.log('✅ Animation complete');
        resolve();
      },
    })
      .to(modal, {
        yPercent: -5.5,
        duration: 0.32,
        ease: 'power3.out',
      }, 0)
      .to(modal, {
        yPercent: 2,
        duration: 0.09,
        ease: 'power2.out',
      }, 0.32)
      .to(modal, {
        yPercent: 0,
        duration: 0.14,
        ease: 'back.out(1.55)',
      }, 0.41);
    
    console.log('✅ Animation triggered');
  });
}
