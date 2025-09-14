// Level Complete Integration
// Primer kako da integrisete level-complete modul sa glavnom igrom

import { handleLevelComplete, checkLevelComplete } from './level-complete.js';

/**
 * Integrisana funkcija za proveru level complete-a u glavnoj igri
 * Zamenjuje postojeću checkLevelEnd funkciju
 */
export function integratedCheckLevelEnd(gameContext) {
  const {
    tiles = [],
    makeBoard,
    hasWildOnBoard = () => false,
    score = 0,
    level = 1,
    moves = 0,
    onLevelComplete = null,
    onGameOver = null
  } = gameContext;

  // Koristimo novi modul za proveru
  const result = checkLevelComplete({
    tiles,
    makeBoard,
    hasWildOnBoard,
    score,
    level,
    moves
  });

  console.log('🎯 Level Complete Check:', result);

  if (result.levelComplete) {
    // Pozivamo callback funkciju za level complete
    if (onLevelComplete) {
      onLevelComplete(result);
    } else {
      // Fallback na postojeću logiku
      console.log('⚠️ No onLevelComplete callback provided, using fallback');
      if (onGameOver) {
        onGameOver();
      }
    }
  }

  return result;
}

/**
 * Glavna funkcija za rukovanje level complete flow-om
 * Ova funkcija se poziva kada je level complete
 */
export async function handleLevelCompleteFlow(gameContext) {
  const {
    app,
    stage,
    board,
    score = 0,
    level = 1,
    moves = 0,
    startLevel = null,
    restartGame = null,
    quitGame = null
  } = gameContext;

  try {
    const result = await handleLevelComplete(
      {
        tiles: gameContext.tiles || [],
        makeBoard: gameContext.makeBoard,
        hasWildOnBoard: gameContext.hasWildOnBoard || (() => false),
        score,
        level,
        moves
      },
      {
        app,
        stage,
        board,
        onContinue: () => {
          console.log('🎮 User chose to continue');
          if (startLevel) {
            startLevel(level + 1);
          }
        },
        onRestart: () => {
          console.log('🔄 User chose to restart');
          if (restartGame) {
            restartGame();
          }
        },
        onQuit: () => {
          console.log('🚪 User chose to quit');
          if (quitGame) {
            quitGame();
          }
        }
      }
    );

    console.log('🎯 Level Complete Flow Result:', result);
    return result;
  } catch (error) {
    console.error('❌ Level Complete Flow Error:', error);
    // Fallback na postojeću logiku
    if (startLevel) {
      startLevel(level + 1);
    }
    return { action: 'continue' };
  }
}

/**
 * Utility funkcija za testiranje integracije
 */
export function testIntegration(gameContext) {
  console.log('🧪 Testing Level Complete Integration...');
  
  const result = integratedCheckLevelEnd(gameContext);
  
  if (result.levelComplete) {
    console.log('✅ Level Complete detected successfully');
    console.log('📊 Result:', result);
  } else {
    console.log('ℹ️ Level not complete, continuing game');
  }
  
  return result;
}

/**
 * Konfiguracija za različite modove igre
 */
export const GAME_MODES = {
  NORMAL: {
    name: 'Normal',
    onLevelComplete: handleLevelCompleteFlow
  },
  ENDLESS: {
    name: 'Endless',
    onLevelComplete: (ctx) => {
      console.log('🔄 Endless mode: Auto-advancing to next level');
      if (ctx.startLevel) {
        ctx.startLevel(ctx.level + 1);
      }
    }
  },
  TEST: {
    name: 'Test',
    onLevelComplete: (ctx) => {
      console.log('🧪 Test mode: Level complete detected');
      console.log('📊 Context:', ctx);
    }
  }
};

/**
 * Kreira game context objekat za level complete modul
 */
export function createGameContext(appState) {
  return {
    tiles: appState.tiles || [],
    makeBoard: appState.makeBoard,
    hasWildOnBoard: appState.hasWildOnBoard || (() => false),
    score: appState.score || 0,
    level: appState.level || 1,
    moves: appState.moves || 0,
    app: appState.app,
    stage: appState.stage,
    board: appState.board,
    startLevel: appState.startLevel,
    restartGame: appState.restartGame,
    quitGame: appState.quitGame
  };
}
