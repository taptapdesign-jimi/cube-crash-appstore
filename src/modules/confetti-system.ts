// Confetti system with dual corner spawns
// Performance optimized: efficient cleanup, no memory leaks

let activeAnimations = 0;
const MAX_ANIMATIONS = 500;

function createConfettiExplosion(element: HTMLElement): void {
  console.log('🎉 createConfettiExplosion called');
  const colors = ['#FBE3C5', '#FA8C00', '#E5C7AD', '#ECD7C2', '#FDBA00'];
  const confettiPerSpawn = 200;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  
  setTimeout(() => {
    console.log('🎉 Starting confetti spawns');
    
    // TOP SPAWNS - 4 total: corners + middle
    // SPAWN 1: Top-left corner
    createSpawn(colors, confettiPerSpawn, -(screenW * 0.3), -(screenH * 0.3), Math.PI / 4, 'left', 'down');
    
    // SPAWN 2: Top-right corner
    createSpawn(colors, confettiPerSpawn, screenW * 1.3, -(screenH * 0.3), 3 * Math.PI / 4, 'right', 'down');
    
    // SPAWN 3: Top middle-left (simultaneous)
    createSpawn(colors, confettiPerSpawn, screenW * 0.25, -(screenH * 0.3), Math.PI / 2 - 0.3, 'left', 'down');
    
    // SPAWN 4: Top middle-right (simultaneous)
    createSpawn(colors, confettiPerSpawn, screenW * 0.75, -(screenH * 0.3), Math.PI / 2 + 0.3, 'right', 'down');
    
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
    const angleVariant = (Math.random() - 0.5) * 0.25; // 50% less randomness
    const angle = baseAngle + angleVariant;
    // Slower, gentler velocity for natural falling
    const vel = 100 + Math.random() * 150;
    const velX = Math.cos(angle) * vel;
    const velY = Math.sin(angle) * vel * 0.3; // Slow downward movement
    
    // 50% strips, 50% small pieces (smaller sizes - 50% less randomness)
    const isStrip = i % 2 === 0;
    const w = isStrip ? 3 + Math.random() * 1.5 : 4 + Math.random() * 2.5;
    const h = isStrip ? 15 + Math.random() * 15 : 6 + Math.random() * 5;
    
    // Spawn position with variation
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
    
    // Longer duration for smooth slow fall
    const duration = 4000 + Math.random() * 3000; // 4-7 seconds
    const screenHeight = window.innerHeight;
    
    // Wiggly x-movement (side to side drift)
    const wiggleAmount = 50 + Math.random() * 100;
    const wigglePhase = Math.random() * Math.PI * 2;
    
    // Calculate ending position - fall past bottom of screen
    const endX = velX * 2 + (Math.sin(wigglePhase + 1) * wiggleAmount);
    const endY = screenHeight + 200; // Go well past bottom of screen
    const endRot = 360 + Math.random() * 720; // 1-3 rotations
    
    // Smooth, slow fall with wiggly animation
    const anim = confetti.animate([
      {
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 0.9
      },
      {
        transform: `translate(${velX + Math.sin(wigglePhase) * wiggleAmount}px, ${endY * 0.5}px) rotate(${endRot * 0.5}deg)`,
        opacity: 0.9
      },
      {
        transform: `translate(${endX}px, ${endY}px) rotate(${endRot}deg)`,
        opacity: 0.3
      }
    ], {
      duration,
      easing: 'ease-out', // Natural gravity fall
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
