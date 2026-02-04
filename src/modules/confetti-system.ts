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
  const colors = ['#FBE3C5', '#FA8C00', '#E5C7AD', '#ECD7C2', '#FDBA00', '#FADEC0'];
  const confettiPerSpawn = 15;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  
  // Start immediately, no delay - spawn first batch right away (400ms earlier)
  
  // Spawn every 1 second
  let spawnCount = 0;
  const maxSpawns = 5; // Spawn for 5 seconds total
  
  // Helper function to spawn a batch
  const spawnBatch = (isFirstBatch = false) => {
    if (spawnCount >= maxSpawns) {
      return;
    }
    
    // For first batch, start immediately (no delay) to start 400ms earlier
    // For subsequent batches, use small random delays
    const delay = isFirstBatch ? 0 : Math.random() * 200;
    
    // Spawn from 4 top positions - Track all setTimeout calls for cleanup
    const timeout1 = setTimeout(() => {
      activeTimeouts.delete(timeout1);
      createSpawn(colors, confettiPerSpawn, -(screenW * 0.3), -(screenH * 0.3), Math.PI / 4, 'left');
    }, delay);
    activeTimeouts.add(timeout1);
    
    const timeout2 = setTimeout(() => {
      activeTimeouts.delete(timeout2);
      createSpawn(colors, confettiPerSpawn, screenW * 1.3, -(screenH * 0.3), 3 * Math.PI / 4, 'right');
    }, delay);
    activeTimeouts.add(timeout2);
    
    const timeout3 = setTimeout(() => {
      activeTimeouts.delete(timeout3);
      createSpawn(colors, confettiPerSpawn, screenW * 0.25, -(screenH * 0.3), Math.PI / 2 - 0.3, 'left');
    }, delay);
    activeTimeouts.add(timeout3);
    
    const timeout4 = setTimeout(() => {
      activeTimeouts.delete(timeout4);
      createSpawn(colors, confettiPerSpawn, screenW * 0.75, -(screenH * 0.3), Math.PI / 2 + 0.3, 'right');
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
      activeIntervals.delete(spawnInterval);
      return;
    }
    spawnBatch();
  }, 1000); // Every 1 second
  
  activeIntervals.add(spawnInterval);
}

function createSpawn(
  colors: string[],
  count: number,
  startX: number,
  startY: number,
  baseAngle: number,
  side: 'left' | 'right'
): void {
  const isLeft = side === 'left';
  
  // Random spawn: each confetti gets random delay 0-2600ms (reduced by 400ms to start earlier)
  for (let i = 0; i < count && activeAnimations < MAX_ANIMATIONS; i++) {
    const spawnDelay = Math.max(0, Math.random() * 3000 - 400); // Start 400ms earlier
    
    const spawnTimeout = setTimeout(() => {
      activeTimeouts.delete(spawnTimeout);
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
    
    // Create confetti div element
    const isStrip = i % 2 === 0;
    const w = isStrip ? 3 + Math.random() * 1 : 4 + Math.random() * 2;
    const h = isStrip ? 8 + Math.random() * 7 : 6 + Math.random() * 4;
    
    const confetti = document.createElement('div');
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
    style.opacity = '0.9';
    
    document.body.appendChild(confetti);
    activeAnimations++;
    activeConfettiElements.add(confetti);
    
    const duration = 3000; // 3 seconds total duration
    const screenHeight = window.innerHeight;
    
    // Enhanced wiggly movement with more oscillation
    const wiggleAmount = 80 + Math.random() * 120; // More oscillation
    const wigglePhase = Math.random() * Math.PI * 2;
    
    const endY = screenHeight * 1.3; // Fall to 130% of screen height
    const endX = velX * 2 + (Math.sin(wigglePhase + 1) * wiggleAmount);
    const endRot = 360 + Math.random() * 720;
    
    // Confetti animation with fade-out
    const anim = confetti.animate([
      {
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 0.9
      },
      {
        transform: `translate(${endX}px, ${endY}px) rotate(${endRot}deg)`,
        opacity: 0.9
      }
    ], {
      duration,
      easing: 'ease-out',
      fill: 'forwards'
    });
    
    // Instant fade-out below screen: 400px past bottom for modal clearance
    const fadeOutY = screenHeight + 400;
    const animProgress = setInterval(() => {
      if (!confetti.parentNode || !activeConfettiElements.has(confetti)) {
        clearInterval(animProgress);
        activeAnimProgressIntervals.delete(animProgress);
        return;
      }
      const rect = confetti.getBoundingClientRect();
      const currentY = rect.top;
      
      if (currentY >= fadeOutY) {
        confetti.style.opacity = '0';
        confetti.style.transform = 'scale(0)';
        clearInterval(animProgress);
        activeAnimProgressIntervals.delete(animProgress);
      }
    }, 10);
    
    activeAnimProgressIntervals.add(animProgress);
    
    anim.onfinish = () => {
      if (activeAnimProgressIntervals.has(animProgress)) {
        try { clearInterval(animProgress); } catch {}
        activeAnimProgressIntervals.delete(animProgress);
      }
      confetti.remove();
      activeAnimations--;
      if (activeAnimations < 0) activeAnimations = 0;
      activeConfettiElements.delete(confetti);
    };
    }, spawnDelay);
    activeTimeouts.add(spawnTimeout);
  }
}

// Graceful cleanup: Stop new spawns but let existing animations finish
// This allows confetti to continue animating after Continue is clicked
export function stopConfettiSpawns(): void {
  // Clear all spawn intervals (stops new batches from spawning)
  activeIntervals.forEach(interval => {
    try {
      clearInterval(interval);
    } catch (e) {
      // Ignore errors
    }
  });
  activeIntervals.clear();
  
  // Clear all pending setTimeout calls (stops new confetti from spawning)
  activeTimeouts.forEach(timeout => {
    try {
      clearTimeout(timeout);
    } catch (e) {
      // Ignore errors
    }
  });
  activeTimeouts.clear();
  
  // DO NOT clear animProgress intervals - they're needed for fade-out animation
  // DO NOT remove DOM elements - let them finish their animations
  // Elements will cleanup themselves via onfinish callback when animation completes
}

// Full cleanup function to clear all confetti animations (for restart/exit)
export function cleanupConfetti(): void {
  // First stop all new spawns
  stopConfettiSpawns();
  
  // Clear all animProgress intervals (force cleanup)
  activeAnimProgressIntervals.forEach(interval => {
    try {
      clearInterval(interval);
    } catch (e) {
      // Ignore errors
    }
  });
  activeAnimProgressIntervals.clear();
  
  // Then remove all DOM elements (force cleanup)
  activeConfettiElements.forEach(element => {
    try {
      if (element && element.parentNode) {
        element.remove();
      }
    } catch (e) {
      // Ignore errors
    }
  });
  activeConfettiElements.clear();
  
  // Reset counter
  activeAnimations = 0;
}

export { createConfettiExplosion };
