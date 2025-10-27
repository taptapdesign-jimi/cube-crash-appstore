// Confetti system with continuous spawning
// Performance optimized: efficient cleanup, no memory leaks

let activeAnimations = 0;
const MAX_ANIMATIONS = 800; // Increased for continuous spawn

function createConfettiExplosion(element: HTMLElement): void {
  console.log('🎉 createConfettiExplosion called');
  const colors = ['#FBE3C5', '#FA8C00', '#E5C7AD', '#ECD7C2', '#FDBA00'];
  const confettiPerSpawn = 20; // Small batches for continuous effect
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const totalDuration = 4000; // 4 seconds total
  const spawnInterval = 150; // Spawn new batch every 150ms
  const numSpawns = Math.floor(totalDuration / spawnInterval); // ~26 spawns
  
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
    const vel = 100 + Math.random() * 150;
    const velX = Math.cos(angle) * vel;
    const velY = Math.sin(angle) * vel * 0.3;
    
    const isStrip = i % 2 === 0;
    const w = isStrip ? 3 + Math.random() * 1.5 : 4 + Math.random() * 2.5;
    const h = isStrip ? 15 + Math.random() * 15 : 6 + Math.random() * 5;
    
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
    
    const duration = 4000 + Math.random() * 2000; // 4-6 seconds
    const screenHeight = window.innerHeight;
    
    // Wiggly movement
    const wiggleAmount = 50 + Math.random() * 100;
    const wigglePhase = Math.random() * Math.PI * 2;
    
    // Fall 30% past bottom of screen
    const endX = velX * 2 + (Math.sin(wigglePhase + 1) * wiggleAmount);
    const endY = screenHeight * 1.3; // 30% past screen
    const endRot = 360 + Math.random() * 720;
    
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
