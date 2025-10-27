// Confetti system with continuous spawning
// Performance optimized: efficient cleanup, no memory leaks

let activeAnimations = 0;
const MAX_ANIMATIONS = 800; // Increased for continuous spawn

function createConfettiExplosion(element: HTMLElement): void {
  console.log('🎉 createConfettiExplosion called');
  const colors = ['#FBE3C5', '#FA8C00', '#E5C7AD', '#ECD7C2', '#FDBA00'];
  const confettiPerSpawn = 15; // Small batches for continuous effect
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const totalDuration = 5000; // Overall duration
  // Progressive staggered spawns handled below
  
  // Start immediately, no delay
  console.log('🎉 Starting progressive confetti spawns');
    
    // Progressive staggered spawn: finish within 5 seconds total
    const spawnGroups = [
      { delay: 0, name: 'Group 1' },
      { delay: 500, name: 'Group 2' },
      { delay: 1200, name: 'Group 3' },
      { delay: 2100, name: 'Group 4' },
      { delay: 3200, name: 'Group 5' },
      { delay: 4500, name: 'Group 6' }
    ];
    
    spawnGroups.forEach((group, index) => {
      // Random delay variation: 10-40% of base delay
      const randomVariation = 0.1 + Math.random() * 0.3; // 10-40% random
      const randomDelay = group.delay * randomVariation;
      
      setTimeout(() => {
        console.log(`🎉 Spawning ${group.name} at ${randomDelay.toFixed(0)}ms`);
        
        // TOP SPAWNS - 4 total: corners + middle
        createSpawn(colors, confettiPerSpawn, -(screenW * 0.3), -(screenH * 0.3), Math.PI / 4, 'left', 'down');
        createSpawn(colors, confettiPerSpawn, screenW * 1.3, -(screenH * 0.3), 3 * Math.PI / 4, 'right', 'down');
        createSpawn(colors, confettiPerSpawn, screenW * 0.25, -(screenH * 0.3), Math.PI / 2 - 0.3, 'left', 'down');
        createSpawn(colors, confettiPerSpawn, screenW * 0.75, -(screenH * 0.3), Math.PI / 2 + 0.3, 'right', 'down');
      }, randomDelay);
    });
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
  const isUpward = direction === 'up';
  
  for (let i = 0; i < count && activeAnimations < MAX_ANIMATIONS; i++) {
    const color = colors[i % colors.length];
    const angleVariant = (Math.random() - 0.5) * 0.25;
    const angle = baseAngle + angleVariant;
    
    // Vary gravity for different groups - some light like feathers, some heavier
    const weightCategory = i % 3; // 0, 1, or 2
    let gravityMultiplier, velocityRange;
    
    // More confetti fall like feathers (weightCategory 0 and 1)
    if (weightCategory === 0) {
      // Ultra light as feather - very slow, gentle fall
      gravityMultiplier = 0.12 + Math.random() * 0.08; // 0.12-0.20
      velocityRange = { min: 40, max: 80 };
    } else if (weightCategory === 1) {
      // Light as feather - slow, gentle fall
      gravityMultiplier = 0.15 + Math.random() * 0.1; // 0.15-0.25
      velocityRange = { min: 50, max: 100 };
    } else {
      // Medium weight - normal speed
      gravityMultiplier = 0.25 + Math.random() * 0.1; // 0.25-0.35
      velocityRange = { min: 90, max: 150 };
    }
    
    const vel = velocityRange.min + Math.random() * (velocityRange.max - velocityRange.min);
    const velX = Math.cos(angle) * vel;
    const velY = Math.sin(angle) * vel * gravityMultiplier;
    
    const isStrip = i % 2 === 0;
    const w = isStrip ? 3 + Math.random() * 1 : 4 + Math.random() * 2; // Smaller width variation
    const h = isStrip ? 8 + Math.random() * 7 : 6 + Math.random() * 4; // Much shorter strips (8-15px instead of 15-30px)
    
    const x = startX + (isLeft ? Math.random() * 150 : -Math.random() * 150); // More spread
    const y = startY + Math.random() * 50; // More vertical variation - staggered spawn
    
    const confetti = document.createElement('div');
    confetti.className = 'cc-confetti-piece';
    
    const style = confetti.style;
    style.position = 'fixed';
    style.left = `${x}px`;
    style.top = `${y}px`;
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
    
    const duration = 7000 + Math.random() * 3000; // 7-10 seconds - longer life cycle
    const screenHeight = window.innerHeight;
    
    // Enhanced wiggly movement with more oscillation
    const wiggleAmount = 80 + Math.random() * 120; // More oscillation
    const wigglePhase = Math.random() * Math.PI * 2;
    
    // Fade at 60% of screen, die completely at 30% past bottom
    const fadeY = screenHeight * 0.6; // Start fading at 60% of screen
    const endY = screenHeight * 1.3; // Fall 30% past bottom
    const endX = velX * 2 + (Math.sin(wigglePhase + 1) * wiggleAmount);
    const endRot = 360 + Math.random() * 720;
    
    const anim = confetti.animate([
      {
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 0.9
      },
      {
        transform: `translate(${velX + Math.sin(wigglePhase) * wiggleAmount}px, ${fadeY}px) rotate(${endRot * 0.4}deg)`,
        opacity: 0.9
      },
      {
        transform: `translate(${endX * 0.8}px, ${endY * 0.9}px) rotate(${endRot * 0.7}deg)`,
        opacity: 0.4
      },
      {
        transform: `translate(${endX}px, ${endY}px) rotate(${endRot}deg)`,
        opacity: 0
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
  }
}

export { createConfettiExplosion };
