// APPSHELL - Central State Machine & Event Bus
console.log('🚀 AppShell loading...');

import { EventBus } from '../utils/event-bus.js';

export class AppShell {
  constructor() {
    this.state = 'HOME'; // HOME | GAME | PAUSE
    this.eventBus = new EventBus();
    this.modules = new Map();
    
    // DOM elements
    this.homeEl = document.getElementById('home');
    this.gameEl = document.getElementById('app');
    
    console.log('✅ AppShell created');
  }

  async init() {
    console.log('🎯 AppShell initializing...');
    
    try {
      // Initialize modules
      await this.initModules();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Start in HOME state
      this.setState('HOME');
      
      console.log('✅ AppShell initialized successfully');
      
    } catch (error) {
      console.error('❌ AppShell init error:', error);
      throw error;
    }
  }

  async initModules() {
    console.log('📦 Initializing modules...');
    
    try {
      // Home module
      const { HomeModule } = await import('../features/home/index.js');
      this.modules.set('home', new HomeModule(this.eventBus));
      console.log('✅ Home module loaded');
    } catch (error) {
      console.error('❌ Home module error:', error);
    }
    
    try {
      // Game module
      const { GameModule } = await import('../game/index.js');
      this.modules.set('game', new GameModule(this.eventBus));
      console.log('✅ Game module loaded');
    } catch (error) {
      console.error('❌ Game module error:', error);
    }
    
    try {
      // Animations module
      const { AnimationModule } = await import('../ui/animations.js');
      this.modules.set('animations', new AnimationModule(this.eventBus));
      console.log('✅ Animations module loaded');
    } catch (error) {
      console.error('❌ Animations module error:', error);
    }
    
    console.log('✅ Modules initialization complete');
  }

  setupEventListeners() {
    console.log('🎧 Setting up event listeners...');
    
    // Home events
    this.eventBus.on('home:play', () => this.handlePlay());
    this.eventBus.on('home:stats', () => this.handleStats());
    this.eventBus.on('home:collectibles', () => this.handleCollectibles());
    
    // Game events
    this.eventBus.on('game:pauseRequest', () => this.handlePauseRequest());
    this.eventBus.on('game:gameOver', () => this.handleGameOver());
    
    // Pause modal events
    this.eventBus.on('pause:unpause', () => this.handleUnpause());
    this.eventBus.on('pause:restart', () => this.handleRestart());
    this.eventBus.on('pause:exit', () => this.handleExit());
    
    console.log('✅ Event listeners setup complete');
  }

  setState(newState) {
    console.log(`🔄 State change: ${this.state} → ${newState}`);
    
    const oldState = this.state;
    this.state = newState;
    
    // Handle state transitions
    switch (newState) {
      case 'HOME':
        this.showHome();
        break;
      case 'GAME':
        this.showGame();
        break;
      case 'PAUSE':
        this.showPause();
        break;
    }
    
    // Emit state change event
    this.eventBus.emit('app:stateChange', { from: oldState, to: newState });
  }

  async showHome() {
    console.log('🏠 Showing home...');
    
    // Hide game
    this.gameEl.style.display = 'none';
    this.gameEl.setAttribute('hidden', '');
    
    // Show home
    this.homeEl.style.display = 'block';
    this.homeEl.removeAttribute('hidden');
    
    // Mount home module
    const homeModule = this.modules.get('home');
    if (homeModule) {
      await homeModule.mount(this.homeEl);
      homeModule.show();
    }
    
    // Animate home in
    const animations = this.modules.get('animations');
    if (animations) {
      await animations.homePopIn();
    }
  }

  async showGame() {
    console.log('🎮 Showing game...');
    
    try {
      // Hide home
      this.homeEl.style.display = 'none';
      this.homeEl.setAttribute('hidden', '');
      
      // Show game
      this.gameEl.style.display = 'block';
      this.gameEl.removeAttribute('hidden');
      
      console.log('🎮 Game container shown, starting game module...');
      
      // Start game module
      const gameModule = this.modules.get('game');
      if (gameModule) {
        console.log('🎮 Game module found, starting...');
        await gameModule.start(this.gameEl);
        console.log('✅ Game module started');
      } else {
        console.error('❌ Game module not found!');
        // Fallback - try to start game directly
        const { boot } = await import('../modules/app.js');
        await boot();
      }
      
      // Animate game in
      const animations = this.modules.get('animations');
      if (animations) {
        await animations.gamePopIn();
      }
      
    } catch (error) {
      console.error('❌ Show game error:', error);
      // Fallback - try to start game directly
      try {
        const { boot } = await import('../modules/app.js');
        await boot();
      } catch (fallbackError) {
        console.error('❌ Fallback game start error:', fallbackError);
      }
    }
  }

  async showPause() {
    console.log('⏸️ Showing pause...');
    
    // Pause game
    const gameModule = this.modules.get('game');
    if (gameModule) {
      await gameModule.pause();
    }
    
    // Show pause modal
    const animations = this.modules.get('animations');
    if (animations) {
      await animations.showPauseModal();
    }
  }

  // Event handlers
  async handlePlay() {
    console.log('🎮 Handling play...');
    
    try {
      // Animate home out
      const animations = this.modules.get('animations');
      if (animations) {
        await animations.homePopOut();
      }
      
      // Transition to game
      this.setState('GAME');
      
    } catch (error) {
      console.error('❌ Handle play error:', error);
      // Fallback - just show game
      this.setState('GAME');
    }
  }

  async handleStats() {
    console.log('📊 Handling stats...');
    // TODO: Implement stats
  }

  async handleCollectibles() {
    console.log('🎁 Handling collectibles...');
    // TODO: Implement collectibles
  }

  async handlePauseRequest() {
    console.log('⏸️ Handling pause request...');
    this.setState('PAUSE');
  }

  async handleGameOver() {
    console.log('💀 Handling game over...');
    // TODO: Implement game over flow
  }

  async handleUnpause() {
    console.log('▶️ Handling unpause...');
    
    // Resume game
    const gameModule = this.modules.get('game');
    if (gameModule) {
      await gameModule.resume();
    }
    
    // Close pause modal
    const animations = this.modules.get('animations');
    if (animations) {
      await animations.hidePauseModal();
    }
    
    this.setState('GAME');
  }

  async handleRestart() {
    console.log('🔄 Handling restart...');
    
    // Restart game
    const gameModule = this.modules.get('game');
    if (gameModule) {
      await gameModule.restart();
    }
    
    // Close pause modal
    const animations = this.modules.get('animations');
    if (animations) {
      await animations.hidePauseModal();
    }
    
    this.setState('GAME');
  }

  async handleExit() {
    console.log('🚪 Handling exit...');
    
    // Stop game
    const gameModule = this.modules.get('game');
    if (gameModule) {
      await gameModule.stop();
    }
    
    // Close pause modal
    const animations = this.modules.get('animations');
    if (animations) {
      await animations.hidePauseModal();
    }
    
    // Animate home in
    if (animations) {
      await animations.homePopIn();
    }
    
    this.setState('HOME');
  }

  // Public API
  getState() {
    return this.state;
  }

  getEventBus() {
    return this.eventBus;
  }

  getModule(name) {
    return this.modules.get(name);
  }
}

console.log('✅ AppShell loaded');
