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
  const totalDuration = 5000; // 5 seconds total
  const spawnInterval = 200; // Spawn new batch every 200ms (slower for organic effect)
  const numSpawns = Math.floor(totalDuration / spawnInterval); // ~25 spawns
  
  setTimeout(() => {
    console.log('🎉 Starting continuous confetti spawns');
    
    let spawnCount = 0;
    
    const spawnIntervalId = setInterval(() => {
      if (spawnCount >= numSpawns) {
        clearInterval(spawnIntervalId);
        console.log('🎉 Finished continuous confetti spawns');
        return;
      }
      
      // TOP SPAWNS - 4 total: corners + middle
      createSpawn(colors, confettiPerSpawn, -(screenW * 0.3), -(screenH * 0.3), Math.PI / 4, 'left', 'down');
      createSpawn(colors, confettiPerSpawn, screenW * 1.3, -(screenH * 0.3), 3 * Math.PI / 4, 'right', 'down');
      createSpawn(colors, confettiPerSpawn, screenW * 0.25, -(screenH * 0.3), Math.PI / 2 - 0.3, 'left', 'down');
      createSpawn(colors, confettiPerSpawn, screenW * 0.75, -(screenH * 0.3), Math.PI / 2 + 0.3, 'right', 'down');
      
      spawnCount++;
    }, spawnInterval);
    
  }, 500);
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
    
    if (weightCategory === 0) {
      // Light as feather - very slow, gentle fall
      gravityMultiplier = 0.15 + Math.random() * 0.1; // 0.15-0.25
      velocityRange = { min: 50, max: 100 };
    } else if (weightCategory === 1) {
      // Medium weight - normal speed
      gravityMultiplier = 0.25 + Math.random() * 0.1; // 0.25-0.35
      velocityRange = { min: 100, max: 180 };
    } else {
      // Heavy - faster fall
      gravityMultiplier = 0.35 + Math.random() * 0.15; // 0.35-0.50
      velocityRange = { min: 150, max: 250 };
    }
    
    const vel = velocityRange.min + Math.random() * (velocityRange.max - velocityRange.min);
    const velX = Math.cos(angle) * vel;
    const velY = Math.sin(angle) * vel * gravityMultiplier;
    
    const isStrip = i % 2 === 0;
    const w = isStrip ? 3 + Math.random() * 1 : 4 + Math.random() * 2; // Smaller width variation
    const h = isStrip ? 8 + Math.random() * 7 : 6 + Math.random() * 4; // Much shorter strips (8-15px instead of 15-30px)
    
    const x = startX + (isLeft ? Math.random() * 100 : -Math.random() * 100);
    const y = startY + Math.random() * 30;
    
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
    
    // Longer duration for lighter confetti, shorter for heavy
    const baseDuration = weightCategory === 0 ? 6000 : (weightCategory === 1 ? 5000 : 4500);
    const duration = baseDuration + Math.random() * 2000;
    const screenHeight = window.innerHeight;
    
    // Wiggly movement
    const wiggleAmount = 50 + Math.random() * 100;
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
