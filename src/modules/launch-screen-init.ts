// 🔥 CRITICAL: Initialize launch screen IMMEDIATELY when DOM is ready
// This runs BEFORE any other code to prevent blank screen

// Create launch screen DOM structure IMMEDIATELY (synchronously)
(function initLaunchScreenDOM() {
  // Only run if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLaunchScreenDOM);
    return;
  }
  
  // Create launch screen container IMMEDIATELY (synchronously, no async)
  const container = document.createElement('div');
  container.id = 'launch-screen';
  container.className = 'launch-screen';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #F9F9F9;
    opacity: 1;
    visibility: visible;
  `;
  
  // Create content wrapper
  const content = document.createElement('div');
  content.className = 'launch-content';
  content.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Phase 1: Taptapdesign logo container (VISIBLE IMMEDIATELY)
  const taptapContainer = document.createElement('div');
  taptapContainer.className = 'launch-logo-taptap';
  taptapContainer.style.cssText = `
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    visibility: visible;
  `;
  
  const taptapLogo = document.createElement('img');
  taptapLogo.id = 'launch-logo-taptap';
  taptapLogo.src = './assets/taptapdesign.png';
  taptapLogo.alt = 'TapTap Design';
  taptapLogo.loading = 'eager';
  taptapLogo.style.cssText = `
    width: 344px;
    height: auto;
    display: block;
    margin: 0 auto;
  `;
  
  taptapContainer.appendChild(taptapLogo);
  content.appendChild(taptapContainer);
  
  // Phase 2: Stack to six logo container (hidden initially)
  const stackContainer = document.createElement('div');
  stackContainer.className = 'launch-logo-stack';
  stackContainer.style.cssText = `
    position: absolute;
    width: 100%;
    height: 100%;
    display: none;
    align-items: center;
    justify-content: center;
    opacity: 0;
  `;
  
  const smokeShards = document.createElement('img');
  smokeShards.id = 'launch-smoke-shards';
  smokeShards.src = './assets/logo addons/smokeandshards.png';
  smokeShards.alt = '';
  smokeShards.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.6);
    width: 400px;
    height: auto;
    opacity: 1.0;
    z-index: 1;
    pointer-events: none;
  `;
  
  const stackLogo = document.createElement('img');
  stackLogo.id = 'launch-logo-stack';
  stackLogo.src = './assets/logo-cube-crash.png';
  stackLogo.alt = 'CubeCrash';
  stackLogo.style.cssText = `
    width: 248px;
    height: auto;
    display: block;
    margin: 0 auto;
    position: relative;
    z-index: 2;
    opacity: 0;
  `;
  
  stackContainer.appendChild(smokeShards);
  stackContainer.appendChild(stackLogo);
  content.appendChild(stackContainer);
  
  container.appendChild(content);
  document.body.appendChild(container);
  
  console.log('✅ Launch screen DOM created IMMEDIATELY (synchronously)');
  
  // Now import and start launch screen sequence (async, but DOM is already visible)
  import('./launch-screen.ts').then(({ launchScreen }) => {
    // Re-initialize to cache elements (DOM already exists)
    launchScreen.init();
    console.log('✅ Launch screen initialized (launch-screen-init.ts)');
    
    // Start launch screen sequence immediately
    launchScreen.start(() => {
      console.log('✅ Launch screen sequence completed');
    }).catch((error) => {
      console.warn('⚠️ Launch screen sequence error:', error);
    });
  }).catch((error) => {
    console.warn('⚠️ Failed to initialize launch screen:', error);
  });
})();

