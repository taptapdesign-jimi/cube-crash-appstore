// ANIMATIONS MODULE - Clean Visual Effects
console.log('🎬 AnimationModule loading...');

export class AnimationModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.isAnimating = false;
    
    console.log('✅ AnimationModule created');
  }

  async homePopIn() {
    console.log('🎬 Home pop-in animation...');
    
    if (this.isAnimating) return;
    this.isAnimating = true;
    
    try {
      // Simple fade in animation
      const home = document.getElementById('home');
      if (home) {
        home.style.opacity = '0';
        home.style.transform = 'scale(0.9)';
        
        // Animate in
        home.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        home.style.opacity = '1';
        home.style.transform = 'scale(1)';
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('✅ Home pop-in complete');
      
    } catch (error) {
      console.error('❌ Home pop-in error:', error);
    } finally {
      this.isAnimating = false;
    }
  }

  async homePopOut() {
    console.log('🎬 Home pop-out animation...');
    
    if (this.isAnimating) return;
    this.isAnimating = true;
    
    try {
      // Simple fade out animation
      const home = document.getElementById('home');
      if (home) {
        home.style.transition = 'all 0.3s ease-out';
        home.style.opacity = '0';
        home.style.transform = 'scale(1.1)';
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log('✅ Home pop-out complete');
      
    } catch (error) {
      console.error('❌ Home pop-out error:', error);
    } finally {
      this.isAnimating = false;
    }
  }

  async gamePopIn() {
    console.log('🎬 Game pop-in animation...');
    
    if (this.isAnimating) return;
    this.isAnimating = true;
    
    try {
      // Simple fade in animation
      const game = document.getElementById('app');
      if (game) {
        game.style.opacity = '0';
        game.style.transform = 'scale(0.9)';
        
        // Animate in
        game.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        game.style.opacity = '1';
        game.style.transform = 'scale(1)';
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('✅ Game pop-in complete');
      
    } catch (error) {
      console.error('❌ Game pop-in error:', error);
    } finally {
      this.isAnimating = false;
    }
  }

  async showPauseModal() {
    console.log('🎬 Showing pause modal...');
    
    try {
      // Create modal if it doesn't exist
      let modal = document.getElementById('pause-modal');
      if (!modal) {
        modal = this.createPauseModal();
        document.body.appendChild(modal);
      }
      
      // Show modal
      modal.style.display = 'flex';
      modal.style.opacity = '0';
      modal.style.transform = 'scale(0.8)';
      
      // Animate in
      modal.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      modal.style.opacity = '1';
      modal.style.transform = 'scale(1)';
      
      console.log('✅ Pause modal shown');
      
    } catch (error) {
      console.error('❌ Show pause modal error:', error);
    }
  }

  async hidePauseModal() {
    console.log('🎬 Hiding pause modal...');
    
    try {
      const modal = document.getElementById('pause-modal');
      if (modal) {
        // Animate out
        modal.style.transition = 'all 0.3s ease-out';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.8)';
        
        // Wait for animation then hide
        setTimeout(() => {
          modal.style.display = 'none';
        }, 300);
      }
      
      console.log('✅ Pause modal hidden');
      
    } catch (error) {
      console.error('❌ Hide pause modal error:', error);
    }
  }

  createPauseModal() {
    const modal = document.createElement('div');
    modal.id = 'pause-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      ">
        <h2 style="color: #8a6e57; margin-bottom: 30px;">PAUSED</h2>
        <div style="display: flex; gap: 20px; justify-content: center;">
          <button id="unpause-btn" style="
            background: #8a6e57;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
          ">RESUME</button>
          <button id="restart-btn" style="
            background: #654321;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
          ">RESTART</button>
          <button id="exit-btn" style="
            background: #dc3545;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
          ">EXIT</button>
        </div>
      </div>
    `;
    
    // Add event listeners
    modal.querySelector('#unpause-btn').onclick = () => {
      this.eventBus.emit('pause:unpause');
    };
    
    modal.querySelector('#restart-btn').onclick = () => {
      this.eventBus.emit('pause:restart');
    };
    
    modal.querySelector('#exit-btn').onclick = () => {
      this.eventBus.emit('pause:exit');
    };
    
    return modal;
  }

  // Public API
  getIsAnimating() {
    return this.isAnimating;
  }
}

console.log('✅ AnimationModule loaded');
