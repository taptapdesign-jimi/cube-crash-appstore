type AddGlowDeps = {
  tile: any;
  Container: any;
  Graphics: any;
  gsap: any;
  animationManager: { trackExternalTimeline: (tl: any) => any };
  devWarn: (...args: any[]) => void;
};

export function addElectricGlowCore({
  tile,
  Container,
  Graphics,
  gsap,
  animationManager,
  devWarn,
}: AddGlowDeps){
  try {
    // Remove existing glow if present
    if (tile._electricGlow) {
      try {
        tile._electricGlow.parent?.removeChild(tile._electricGlow);
        tile._electricGlow.destroy();
      } catch {}
    }
    if (tile._glowAnimation) {
      tile._glowAnimation.kill();
    }
    
    const glowContainer = new Container();
    glowContainer.zIndex = -1; // Behind tile
    tile._electricGlow = glowContainer;
    
    const host = tile.rotG || tile;
    if (host && host.addChild) {
      host.addChildAt(glowContainer, 0);
    }
    
    // Create 4 glow rings with different phases
    const rings = [];
    const colors = [0xF26034, 0xE97A55, 0xFF8C5A, 0xF26034]; // Red-orange spectrum
    
    for (let i = 0; i < 4; i++) {
      const ring = new Graphics();
      const radius = 50 + i * 4;
      const thickness = 2 + Math.random() * 2;
      
      // Draw circle with segments for jittery effect
      const segments = 32;
      for (let s = 0; s < segments; s++) {
        const angle1 = (s / segments) * Math.PI * 2;
        const angle2 = ((s + 1) / segments) * Math.PI * 2;
        
        const x1 = Math.cos(angle1) * radius;
        const y1 = Math.sin(angle1) * radius;
        const x2 = Math.cos(angle2) * radius;
        const y2 = Math.sin(angle2) * radius;
        
        ring.moveTo(x1, y1);
        ring.lineTo(x2, y2);
      }
      
      ring.stroke({ width: thickness, color: colors[i], alpha: 0.3 });
      ring.alpha = 0.5;
      glowContainer.addChild(ring);
      rings.push(ring);
    }
    
    // Animate rings with jittery pulsing effect
    const tl = animationManager.trackExternalTimeline(gsap.timeline({ repeat: -1 }));
    
    rings.forEach((ring, index) => {
      const delay = index * 0.1;
      // Jittery pulsing animation
      tl.to(ring.scale, {
        x: 1.12,
        y: 1.12,
        duration: 0.6 + Math.random() * 0.3,
        ease: 'power2.inOut',
        repeat: -1,
        yoyo: true,
        delay: delay,
        modifiers: {
          x: () => ring.scale.x + (Math.random() - 0.5) * 0.02, // Jitter
          y: () => ring.scale.y + (Math.random() - 0.5) * 0.02  // Jitter
        }
      }, 0);
      
      tl.to(ring, {
        alpha: 0.2 + Math.random() * 0.3,
        duration: 0.4 + Math.random() * 0.2,
        ease: 'power2.inOut',
        repeat: -1,
        yoyo: true,
        delay: delay
      }, 0);
      
      // Random rotation for electric effect
      tl.to(ring, {
        rotation: Math.PI * 2,
        duration: 3 + Math.random() * 2,
        ease: 'none',
        repeat: -1
      }, 0);
    });
    
    tile._glowAnimation = tl;
  } catch (error) {
    devWarn('⚠️ Failed to add electric glow:', error);
  }
}
