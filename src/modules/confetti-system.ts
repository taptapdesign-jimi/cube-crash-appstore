// Confetti system with continuous spawning
// Performance optimized: efficient cleanup, no memory leaks

let activeAnimations = 0;
const MAX_ANIMATIONS = 800; // Increased for continuous spawn

// 🔥 MEMORY LEAK FIX: Track all active intervals, timeouts, and DOM elements for cleanup
const activeIntervals: Set<NodeJS.Timeout> = new Set();
const activeTimeouts: Set<NodeJS.Timeout> = new Set(); // 🔥 NEW: Track all setTimeout calls
const activeConfettiElements: Set<HTMLElement> = new Set();
const activeAnimProgressIntervals: Set<NodeJS.Timeout> = new Set();

function createConfettiExplosion(element: HTMLElement): void {
  console.log('🎉 createConfettiExplosion called');
  const colors = ['#FBE3C5', '#FA8C00', '#E5C7AD', '#ECD7C2', '#FDBA00', '#FADEC0'];
  const confettiPerSpawn = 15; // Original value - restored from 6
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const totalDuration = 5000; // Overall duration
  
  // Start immediately, no delay - spawn first batch right away (400ms earlier)
  console.log('🎉 Starting confetti spawns every 1 second');
  
  // Spawn every 1 second
  let spawnCount = 0;
  const maxSpawns = 5; // Spawn for 5 seconds total
  
  // Helper function to spawn a batch
  const spawnBatch = (isFirstBatch = false) => {
    if (spawnCount >= maxSpawns) {
      return;
    }
    
    console.log(`🎉 Spawning confetti batch ${spawnCount + 1}`);
    
    // For first batch, start immediately (no delay) to start 400ms earlier
    // For subsequent batches, use small random delays
    const delay = isFirstBatch ? 0 : Math.random() * 200;
    
    // Spawn from 4 top positions - 🔥 MEMORY LEAK FIX: Track all setTimeout calls
    const timeout1 = setTimeout(() => {
      activeTimeouts.delete(timeout1);
      createSpawn(colors, confettiPerSpawn, -(screenW * 0.3), -(screenH * 0.3), Math.PI / 4, 'left', 'down');
    }, delay);
    activeTimeouts.add(timeout1);
    
    const timeout2 = setTimeout(() => {
      activeTimeouts.delete(timeout2);
      createSpawn(colors, confettiPerSpawn, screenW * 1.3, -(screenH * 0.3), 3 * Math.PI / 4, 'right', 'down');
    }, delay);
    activeTimeouts.add(timeout2);
    
    const timeout3 = setTimeout(() => {
      activeTimeouts.delete(timeout3);
      createSpawn(colors, confettiPerSpawn, screenW * 0.25, -(screenH * 0.3), Math.PI / 2 - 0.3, 'left', 'down');
    }, delay);
    activeTimeouts.add(timeout3);
    
    const timeout4 = setTimeout(() => {
      activeTimeouts.delete(timeout4);
      createSpawn(colors, confettiPerSpawn, screenW * 0.75, -(screenH * 0.3), Math.PI / 2 + 0.3, 'right', 'down');
    }, delay);
    activeTimeouts.add(timeout4);
    
    spawnCount++;
  };
  
  // Spawn first batch immediately with no delay (400ms earlier than before)
  spawnBatch(true);
  
  // Then continue with interval
  const spawnInterval = setInterval(() => {
    if (spawnCount >= maxSpawns) {
      clearInterval(spawnInterval);
      activeIntervals.delete(spawnInterval); // 🔥 MEMORY LEAK FIX: Remove from tracking
      return;
    }
    spawnBatch();
  }, 1000); // Every 1 second
  
  // 🔥 MEMORY LEAK FIX: Track interval for cleanup
  activeIntervals.add(spawnInterval);
}

function createSpawn(
  colors: string[],
  count: number,
  startX: number,
  startY: number,
  baseAngle: number,
  side: 'left' | 'right',
  direction: 'up' | 'down' = 'down'
): void {
  const isLeft = side === 'left';
  
  // Random spawn: each confetti gets random delay 0-2600ms (reduced by 400ms to start earlier)
  for (let i = 0; i < count && activeAnimations < MAX_ANIMATIONS; i++) {
    const spawnDelay = Math.max(0, Math.random() * 3000 - 400); // Start 400ms earlier
    
    // 🔥 MEMORY LEAK FIX: Track setTimeout for cleanup
    const spawnTimeout = setTimeout(() => {
      activeTimeouts.delete(spawnTimeout); // Remove from tracking when executed
      const color = colors[i % colors.length];
      const angleVariant = (Math.random() - 0.5) * 0.25;
      const angle = baseAngle + angleVariant;
    
    // Vary gravity for different groups - some light like feathers, some heavier
    const weightCategory = i % 3; // 0, 1, or 2
    let gravityMultiplier, velocityRange;
    
    // More confetti fall like feathers (weightCategory 0 and 1)
    if (weightCategory === 0) {
      // Ultra light - moderate speed
      gravityMultiplier = 0.3 + Math.random() * 0.1; // 0.3-0.4
      velocityRange = { min: 120, max: 180 };
    } else if (weightCategory === 1) {
      // Light - moderate to fast speed
      gravityMultiplier = 0.35 + Math.random() * 0.1; // 0.35-0.45
      velocityRange = { min: 150, max: 220 };
    } else {
      // Medium weight - faster speed
      gravityMultiplier = 0.4 + Math.random() * 0.15; // 0.4-0.55
      velocityRange = { min: 180, max: 280 };
    }
    
    const vel = velocityRange.min + Math.random() * (velocityRange.max - velocityRange.min);
    const velX = Math.cos(angle) * vel;
    const velY = Math.sin(angle) * vel * gravityMultiplier;
    
    // 100% confetti only (stars are in separate logo animation)
    const isStar = false; // 0% chance for star - only confetti
    
    let confetti: HTMLElement;
    
    if (isStar) {
      // Create star image element
      confetti = document.createElement('img');
      confetti.className = 'cc-confetti-piece cc-confetti-star';
      (confetti as HTMLImageElement).src = './assets/baby-star.png';
      (confetti as HTMLImageElement).alt = '';
      
      // Random star size: 18-36px (50% larger: 12-24px * 1.5)
      const starSize = 18 + Math.random() * 18;
      const w = starSize;
      const h = starSize;
      
      const style = confetti.style;
      style.position = 'fixed';
      style.left = `${startX + (isLeft ? Math.random() * 150 : -Math.random() * 150)}px`;
      style.top = `${startY + Math.random() * 50}px`;
      style.width = `${w}px`;
      style.height = `${h}px`;
      style.objectFit = 'contain';
      style.pointerEvents = 'none';
      style.zIndex = '99999999999999';
      style.transform = `rotate(${Math.random() * 360}deg)`;
      style.opacity = '1.0'; // Full opacity for stars
      style.backgroundColor = 'transparent'; // No background fill
      style.background = 'none'; // No background
    } else {
      // Create confetti div element (original)
      const isStrip = i % 2 === 0;
      const w = isStrip ? 3 + Math.random() * 1 : 4 + Math.random() * 2; // Original width variation
      const h = isStrip ? 8 + Math.random() * 7 : 6 + Math.random() * 4; // Height: 8-15px for strips
      
      confetti = document.createElement('div');
      confetti.className = 'cc-confetti-piece';
      
      const style = confetti.style;
      style.position = 'fixed';
      style.left = `${startX + (isLeft ? Math.random() * 150 : -Math.random() * 150)}px`;
      style.top = `${startY + Math.random() * 50}px`;
      style.width = `${w}px`;
      style.height = `${h}px`;
      style.backgroundColor = color;
      style.borderRadius = isStrip ? '2px' : '1px';
      style.pointerEvents = 'none';
      style.zIndex = '99999999999999';
      style.transform = `rotate(${Math.random() * 360}deg)`;
      style.opacity = '0.9'; // Original opacity - restored from 0.54
    }
    
    document.body.appendChild(confetti);
    activeAnimations++;
    
    // 🔥 MEMORY LEAK FIX: Track DOM element for cleanup
    activeConfettiElements.add(confetti);
    
    const duration = 3000; // 3 seconds total duration
    const screenHeight = window.innerHeight;
    
    // Enhanced wiggly movement with more oscillation
    const wiggleAmount = 80 + Math.random() * 120; // More oscillation
    const wigglePhase = Math.random() * Math.PI * 2;
    
    const endY = screenHeight * 1.3; // Fall to 130% of screen height
    const endX = velX * 2 + (Math.sin(wigglePhase + 1) * wiggleAmount);
    const endRot = 360 + Math.random() * 720;
    
    // Different animation for stars vs confetti
    if (isStar) {
      // Stars: full opacity, no fade-out
      const anim = confetti.animate([
        {
          transform: `translate(0, 0) rotate(0deg)`,
          opacity: 1.0
        },
        {
          transform: `translate(${endX}px, ${endY}px) rotate(${endRot}deg)`,
          opacity: 1.0
        }
      ], {
        duration,
        easing: 'ease-out',
        fill: 'forwards'
      });
      
      anim.onfinish = () => {
        confetti.remove();
        activeAnimations--;
        if (activeAnimations < 0) activeAnimations = 0;
      };
    } else {
      // Confetti: original animation with fade-out
      const anim = confetti.animate([
        {
          transform: `translate(0, 0) rotate(0deg)`,
          opacity: 0.9 // Original opacity - restored from 0.54
        },
        {
          transform: `translate(${endX}px, ${endY}px) rotate(${endRot}deg)`,
          opacity: 0.9 // Original opacity - restored from 0.54
        }
      ], {
        duration,
        easing: 'ease-out',
        fill: 'forwards'
      });
      
      // Instant fade-out below screen: 400px past bottom for modal clearance
      const fadeOutY = screenHeight + 400; // Below screen, past continue button
      const animProgress = setInterval(() => {
        const rect = confetti.getBoundingClientRect();
        const currentY = rect.top;
        
        if (currentY >= fadeOutY) {
          // Instant fade out at random position
          confetti.style.opacity = '0';
          confetti.style.transform = 'scale(0)';
          clearInterval(animProgress);
          activeAnimProgressIntervals.delete(animProgress); // 🔥 MEMORY LEAK FIX: Remove from tracking
        }
      }, 10);
      
      // 🔥 MEMORY LEAK FIX: Track animProgress interval for cleanup
      activeAnimProgressIntervals.add(animProgress);
      
      anim.onfinish = () => {
        confetti.remove();
        activeAnimations--;
        if (activeAnimations < 0) activeAnimations = 0;
        // 🔥 MEMORY LEAK FIX: Remove from tracking when animation finishes
        activeConfettiElements.delete(confetti);
      };
    }
    }, spawnDelay);
    activeTimeouts.add(spawnTimeout); // 🔥 MEMORY LEAK FIX: Track timeout for cleanup
  }
}

// 🔥 GRACEFUL CLEANUP: Stop new spawns but let existing animations finish
// This allows confetti to continue animating after Continue is clicked
export function stopConfettiSpawns(): void {
  console.log('🎉 stopConfettiSpawns: Stopping new spawns (letting existing animations finish)...');
  
  // Clear all spawn intervals (stops new batches from spawning)
  let intervalsCleared = 0;
  activeIntervals.forEach(interval => {
    try {
      clearInterval(interval);
      intervalsCleared++;
    } catch (e) {
      console.warn('⚠️ stopConfettiSpawns: Failed to clear interval:', e);
    }
  });
  activeIntervals.clear();
  
  // Clear all pending setTimeout calls (stops new confetti from spawning)
  let timeoutsCleared = 0;
  activeTimeouts.forEach(timeout => {
    try {
      clearTimeout(timeout);
      timeoutsCleared++;
    } catch (e) {
      console.warn('⚠️ stopConfettiSpawns: Failed to clear timeout:', e);
    }
  });
  activeTimeouts.clear();
  
  // Clear all animProgress intervals (stops fade-out checks, but elements will cleanup on anim finish)
  let animProgressCleared = 0;
  activeAnimProgressIntervals.forEach(interval => {
    try {
      clearInterval(interval);
      animProgressCleared++;
    } catch (e) {
      console.warn('⚠️ stopConfettiSpawns: Failed to clear animProgress interval:', e);
    }
  });
  activeAnimProgressIntervals.clear();
  
  // 🔥 CRITICAL: DO NOT remove DOM elements - let them finish their animations
  // DOM elements will cleanup themselves via onfinish callback when animation completes
  
  console.log(`🎉 stopConfettiSpawns: Stopped new spawns - ${intervalsCleared} intervals, ${timeoutsCleared} timeouts, ${animProgressCleared} animProgress intervals cleared. Existing ${activeConfettiElements.size} DOM elements will cleanup when animations finish.`);
}

// 🔥 MEMORY LEAK FIX: Full cleanup function to clear all confetti animations (for restart/exit)
export function cleanupConfetti(): void {
  console.log('🧹 cleanupConfetti: Starting FULL cleanup...');
  
  // First stop all new spawns
  stopConfettiSpawns();
  
  // Then remove all DOM elements (force cleanup)
  let elementsRemoved = 0;
  activeConfettiElements.forEach(element => {
    try {
      if (element && element.parentNode) {
        element.remove();
        elementsRemoved++;
      }
    } catch (e) {
      console.warn('⚠️ cleanupConfetti: Failed to remove element:', e);
    }
  });
  activeConfettiElements.clear();
  
  // Reset counter
  activeAnimations = 0;
  
  console.log(`🧹 cleanupConfetti: FULL cleanup completed - ${elementsRemoved} DOM elements force-removed`);
}

export { createConfettiExplosion };
