// Confetti system with dual corner spawns
// Performance optimized: efficient cleanup, no memory leaks

let activeAnimations = 0;
const MAX_ANIMATIONS = 500;

function createConfettiExplosion(element: HTMLElement): void {
  console.log('🎉 createConfettiExplosion called');
  const colors = ['#FBE3C5', '#FA8C00', '#E5C7AD', '#ECD7C2', '#FDBA00'];
  const confettiPerSpawn = 168;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  
  setTimeout(() => {
    console.log('🎉 Starting confetti spawns');
    // SPAWN 1: Top-left to bottom-right diagonal
    createSpawn(colors, confettiPerSpawn, 0, 0, Math.PI / 4, 'left');
    
    // SPAWN 2: Top-right to bottom-left diagonal
    createSpawn(colors, confettiPerSpawn, screenW, 0, 3 * Math.PI / 4, 'right');
  }, 500);
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
  
  console.log(`🎉 Creating spawn with ${count} confetti pieces`);
  
  for (let i = 0; i < count && activeAnimations < MAX_ANIMATIONS; i++) {
    const color = colors[i % colors.length];
    const angleVariant = (Math.random() - 0.5) * 0.5;
    const angle = baseAngle + angleVariant;
    const vel = 300 + Math.random() * 400;
    const velX = Math.cos(angle) * vel;
    const velY = Math.sin(angle) * vel;
    
    // 50% strips, 50% small pieces
    const isStrip = i % 2 === 0;
    const w = isStrip ? 3 + Math.random() * 3 : 4 + Math.random() * 5;
    const h = isStrip ? 25 + Math.random() * 30 : 6 + Math.random() * 10;
    
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
    
    const duration = 2500 + Math.random() * 1000;
    const endRot = Math.random() * 1080;
    
    const anim = confetti.animate([
      {
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 0.9
      },
      {
        transform: `translate(${velX}px, ${velY + 400}px) rotate(${endRot}deg)`,
        opacity: 0
      }
    ], {
      duration,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
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
