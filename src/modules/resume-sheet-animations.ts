// resume-sheet-animations.ts
// Animations for resume game bottom sheet
// 🔥 DEAD CODE REMOVED: All unused animation functions removed (~350 lines)
// Only keeping animateBottomSheetEntrance which is the only function actually used

/**
 * Animate bottom sheet entrance
 * OPTIMIZED: Removed unnecessary requestAnimationFrame delay for instant response
 */
export function animateBottomSheetEntrance(modal: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    console.log('🎬 Starting entrance animation...');
    
    // Step 1: Set initial state while hidden
    modal.style.display = 'block';
    modal.style.transform = 'translateY(100%)';
    modal.style.transition = 'transform 0.4s ease-in-out';
    
    // Step 2: Force reflow
    void modal.offsetHeight;

    if (modal.classList.contains('simple-bottom-sheet') && !modal.classList.contains('score-bottom-sheet')) {
      modal.classList.add('end-run-shadow-active');
    }
    
    // Step 3: Trigger animation IMMEDIATELY (no requestAnimationFrame delay)
    modal.style.transform = 'translateY(0)';
    
    console.log('✅ Animation triggered');
    
    // Step 4: Wait for completion
    setTimeout(() => {
      modal.classList.add('visible');
      console.log('✅ Animation complete');
      resolve();
    }, 400);
  });
}
