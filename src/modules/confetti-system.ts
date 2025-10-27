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
      // Light paper confetti - gentle fall
      gravityMultiplier = 0.2 + Math.random() * 0.1; // 0.2-0.3
      velocityRange = { min: 80, max: 120 };
    } else if (weightCategory === 1) {
      // Medium paper confetti - normal speed
      gravityMultiplier = 0.25 + Math.random() * 0.1; // 0.25-0.35
      velocityRange = { min: 100, max: 160 };
    } else {
      // Heavier paper confetti - slightly faster
      gravityMultiplier = 0.3 + Math.random() * 0.15; // 0.3-0.45
      velocityRange = { min: 120, max: 200 };
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
    
    const screenHeight = window.innerHeight;
    const screenWidth = window.innerWidth;
    
    // Calculate organic fall distance: from spawn to 30% past screen bottom
    const startPosY = y; // Current Y position (top of screen -30%)
    const endPosY = screenHeight * 1.3; // Fall 30% past bottom
    const totalDistance = endPosY - startPosY;
    
    // Calculate organic duration based on physics: time = distance / velocity
    // Adjust for gravity acceleration effect - realistic paper fall
    const timeMultiplier = weightCategory === 0 ? 1.8 : (weightCategory === 1 ? 1.5 : 1.2);
    const organicDuration = (totalDistance / Math.abs(velY)) * timeMultiplier * 1000; // Realistic paper timing
    
    // Wiggly movement
    const wiggleAmount = 50 + Math.random() * 100;
    const wigglePhase = Math.random() * Math.PI * 2;
    
    // Calculate end position based on velocity and wiggle
    const endX = x + velX * organicDuration * 0.001 + (Math.sin(wigglePhase + 1) * wiggleAmount);
    const endRot = 360 + Math.random() * 720;
    
    // Fade at 60% of screen, die completely at 30% past bottom
    const fadeY = screenHeight * 0.6;
    const fadeX = x + velX * (organicDuration * 0.001 * 0.4) + Math.sin(wigglePhase) * wiggleAmount * 0.5;
    
    const anim = confetti.animate([
      {
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 0.9
      },
      {
        transform: `translate(${fadeX - x}px, ${fadeY - startPosY}px) rotate(${endRot * 0.4}deg)`,
        opacity: 0.9
      },
      {
        transform: `translate(${endX - x}px, ${endPosY - startPosY}px) rotate(${endRot}deg)`,
        opacity: 0
      }
    ], {
      duration: organicDuration,
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
