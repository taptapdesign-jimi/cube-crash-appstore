// Collectibles Test Functions
// Use these functions to test collectibles functionality

// Test function to unlock a specific collectible
function testUnlockCollectible(cardId, category) {
  if (window.collectiblesManager) {
    const card = window.collectiblesManager.collectiblesData[category]?.find(c => c.id === cardId);
    if (card) {
      card.unlocked = true;
      window.collectiblesManager.saveCollectiblesState();
      window.collectiblesManager.renderCards();
      window.collectiblesManager.updateCounters();
      console.log(`✅ Unlocked ${cardId} in ${category}`);
    } else {
      console.warn(`❌ Card ${cardId} not found in ${category}`);
    }
  }
}

// Test function to unlock all common collectibles
function testUnlockAllCommon() {
  if (window.collectiblesManager) {
    window.collectiblesManager.collectiblesData.common.forEach(card => {
      card.unlocked = true;
    });
    window.collectiblesManager.saveCollectiblesState();
    window.collectiblesManager.renderCards();
    window.collectiblesManager.updateCounters();
    console.log('✅ Unlocked all common collectibles');
  }
}

// Test function to unlock all legendary collectibles
function testUnlockAllLegendary() {
  if (window.collectiblesManager) {
    window.collectiblesManager.collectiblesData.legendary.forEach(card => {
      card.unlocked = true;
    });
    window.collectiblesManager.saveCollectiblesState();
    window.collectiblesManager.renderCards();
    window.collectiblesManager.updateCounters();
    console.log('✅ Unlocked all legendary collectibles');
  }
}

// Test function to reset all collectibles
function testResetAllCollectibles() {
  if (window.collectiblesManager) {
    window.collectiblesManager.resetAllCollectibles();
    console.log('✅ Reset all collectibles');
  }
}

// Test function to simulate game events
function testGameEvent(eventName) {
  if (window.unlockCollectible) {
    window.unlockCollectible(eventName);
    console.log(`✅ Triggered game event: ${eventName}`);
  }
}

// Test function to show collectibles screen
function testShowCollectibles() {
  console.log('🧪 Testing showCollectibles...');
  if (typeof window.showCollectibles === 'function') {
    window.showCollectibles();
    console.log('✅ showCollectibles called');
  } else {
    console.error('❌ showCollectibles function not available');
  }
}

// Make test functions available globally
window.testUnlockCollectible = testUnlockCollectible;
window.testUnlockAllCommon = testUnlockAllCommon;
window.testUnlockAllLegendary = testUnlockAllLegendary;
window.testResetAllCollectibles = testResetAllCollectibles;
window.testGameEvent = testGameEvent;
window.testShowCollectibles = testShowCollectibles;

console.log('🧪 Collectibles test functions loaded!');
console.log('Available functions:');
console.log('- testUnlockCollectible(cardId, category)');
console.log('- testUnlockAllCommon()');
console.log('- testUnlockAllLegendary()');
console.log('- testResetAllCollectibles()');
console.log('- testGameEvent(eventName)');
console.log('- testShowCollectibles()');
console.log('');
console.log('Example usage:');
console.log('testUnlockCollectible("common05", "common")');
console.log('testGameEvent("first_merge")');
