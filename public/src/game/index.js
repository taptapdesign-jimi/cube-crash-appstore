// GAME MODULE - PIXI Wrapper
console.log('🎮 GameModule loading...');

export class GameModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.gameInstance = null;
    this.isRunning = false;
    this.isPaused = false;
    
    console.log('✅ GameModule created');
  }

  async start(container) {
    if (this.isRunning) {
      console.log('⚠️ Game already running');
      return;
    }

    console.log('🎮 GameModule starting...');
    this.isRunning = true;
    this.isPaused = false;

    try {
      // Import and start game
      const { boot, cleanupGame } = await import('../modules/app.js');
      await boot();
      
      this.gameInstance = { boot, cleanupGame };
      
      console.log('✅ GameModule started successfully');
      
    } catch (error) {
      console.error('❌ GameModule start error:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async pause() {
    if (!this.isRunning || this.isPaused) return;

    console.log('⏸️ GameModule pausing...');
    this.isPaused = true;
    
    // TODO: Implement pause logic
    // For now, just emit pause request
    this.eventBus.emit('game:pauseRequest');
    
    console.log('✅ GameModule paused');
  }

  async resume() {
    if (!this.isRunning || !this.isPaused) return;

    console.log('▶️ GameModule resuming...');
    this.isPaused = false;
    
    // TODO: Implement resume logic
    
    console.log('✅ GameModule resumed');
  }

  async restart() {
    if (!this.isRunning) return;

    console.log('🔄 GameModule restarting...');
    
    // Stop current game
    await this.stop();
    
    // Start new game
    await this.start();
    
    console.log('✅ GameModule restarted');
  }

  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 GameModule stopping...');
    
    try {
      // Try to cleanup existing game
      if (this.gameInstance && this.gameInstance.cleanupGame) {
        await this.gameInstance.cleanupGame();
      }
      
      // Clear PIXI app if it exists
      if (window.app && window.app.destroy) {
        window.app.destroy(true);
        window.app = null;
      }
      
      // Clear game container
      const gameContainer = document.getElementById('app');
      if (gameContainer) {
        gameContainer.innerHTML = '';
        gameContainer.style.display = 'none';
        gameContainer.setAttribute('hidden', '');
      }
      
      // Reset state
      this.isRunning = false;
      this.isPaused = false;
      this.gameInstance = null;
      
      console.log('✅ GameModule stopped properly');
      
    } catch (error) {
      console.error('❌ GameModule stop error:', error);
      // Fallback to reload if cleanup fails
      window.location.reload();
    }
  }

  // Public API
  getIsRunning() {
    return this.isRunning;
  }

  getIsPaused() {
    return this.isPaused;
  }

  getGameInstance() {
    return this.gameInstance;
  }
}

console.log('✅ GameModule loaded');
