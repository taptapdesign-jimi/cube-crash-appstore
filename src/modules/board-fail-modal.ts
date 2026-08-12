// @ts-nocheck
import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import { pickRandom } from './clean-board-utils.js';
import { clearArcadeSaveState, getBoardSaveKey } from '../utils/board-save-utils.js';
import { isArcadeHomeRunMode } from './run-mode.js';
import { requestExitToMenu } from './menu-exit-handoff.ts';
import { clearJourneyDetailReturn, prepareJourneyFailReturnTarget } from './journey-origin-state.js';
import { applyAppPaperSurfaceToElement } from '../utils/app-paper-background.js';
import { formatGameplayProgressLabel } from './gameplay-terminology.ts';
import { exitCtaPair, getRegisteredCta, registerCta, type CtaController } from './cta-system.ts';
// public/src/modules/board-fail-modal.ts
// Game-over overlay when the board isn't fully cleared

// Types
interface BoardFailModalParams {
  score?: number;
  boardNumber?: number;
}

interface BoardFailModalResult {
  action: string;
}

interface TouchEventWithTouches extends TouchEvent {
  touches: TouchList;
  changedTouches: TouchList;
}

interface MouseEventWithTarget extends MouseEvent {
  target: EventTarget | null;
}

interface WindowWithCC extends Window {
  _gameHasEnded?: boolean;
  updateHighScore?: (score: number) => void;
  exitToMenu?: () => void;
  CC?: {
    restart?: (options?: { animateHudDrop?: boolean }) => void;
  };
}

const HEADLINES: string[] = [
  'Oops!', 'Bummer!', 'Ahh Noo!', 'Almost!', 'So Close!', 'Whoops!', 'Uh Oh!',
  'Missed It!', 'Darn!', 'Not Quite!', 'Retry Time!', 'Oh Snap!', 'Melted down!',
  'Ouch!', 'Fail!', 'Next Try!', 'Argh!', 'No Luck!', 'Oof!', 'Nearly!',
  'Shoot!', 'Try Again!', 'Whoa There!', 'Not Today!', 'Gah!', 'So Near!',
  'Drat!', 'Aw Man!', 'Dang!', 'One More!', 'That Hurt!',
  'Big L!', 'Epic Fail!', 'Nice Try!', 'Almost There!', 'Too Slow!', 'Wrong Move!',
  'Out of Luck!', 'You Died!', 'Close Call!', 'Oopsie Daisy!', 'Denied Again!',
  'Try Harder!', 'Next Time!', 'Bad Timing!', 'Off Target!', 'Miss Click?',
  'Wrong Turn!', 'Nope Nope!', 'Weak Hit!', 'Fumble Time!', 'You Slipped!',
  'Almost Got It!', 'Almost Made!', 'So Nearly!', 'Nice Effort!', 'Close… Again!',
  'Missed Again!', 'Not Enough!', 'Try Once More!', 'Lost It!', 'Off By One!',
  'Tiny Miss!', 'Slip Up!', 'Fell Short!', 'Nearly There!', 'Almost Win!',
  'Off Course!', 'You Almost!', 'Barely Missed!', 'Not This Run!', 'Just Missed!',
  'One Off!', 'Not Quite Yet!', 'Miss Again!', 'Fell Off!', 'Tiny Fail!',
  'Close Miss!', 'Off Mark!', 'Nice Almost!',
  'Just Short!', 'Barely Off!', 'Miss By Inch!', 'So Very Close!', 'Almost Did It!',
  'Wrong Spot!', 'Next One!', 'Almost Clutch!', 'Barely Lost!',
  'Slip Moment!', 'Try Again Champ!', 'Solid Try!', 'Off Balance!', 'Almost Boss!',
  'Too Late!', 'Nice Attempt!', 'Close Runner!', 'Oh noo!'
];

const OVERLAY_ID = 'cc-board-fail-overlay';

// 🔥 REFACTORED: Koristimo pickRandom iz clean-board-utils.ts umjesto lokalne verzije

// 🔥 MEMORY LEAK FIX: Track timeouts and animation frames for cleanup
const _failModalTimeouts = new Set<ReturnType<typeof setTimeout>>();
const _failModalAnimationFrames = new Set<number>();

// 🔥 BUG FIX: Track if modal is currently open to prevent duplicate calls
let _isModalOpen = false;

function resetArcadeFailedRunForFreshStart(): void {
  if (!isArcadeHomeRunMode()) return;
  try {
    clearArcadeSaveState();
    localStorage.removeItem('__ccCameFromJourney');
    localStorage.removeItem('__ccFromInterimBoard');
  } catch (error) {
    logger.warn('⚠️ board-fail-modal: Failed to clear Arcade failed run save:', error);
  }
  try {
    delete (window as any).__ccSkipRebuildBoard;
    delete (window as any).__ccStartAtLevel;
    delete (window as any).__ccArcadeStageContinuePreserveWild;
    delete (window as any).__ccArcadeStageWildMeterCarryover;
    delete (window as any).__ccFailScreenPending;
    (window as any)._gameHasEnded = true;
  } catch {
    /* non-fatal */
  }
  logger.info('🎮 Arcade failed run reset on Exit - next Arcade start will be fresh Round 01');
}

function trackFailTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timeout = setTimeout(() => {
    callback();
    _failModalTimeouts.delete(timeout);
  }, delay);
  _failModalTimeouts.add(timeout);
  return timeout;
}

function trackFailAnimationFrame(callback: (now: number) => void): number {
  const rafId = requestAnimationFrame((now: number) => {
    callback(now);
    _failModalAnimationFrames.delete(rafId);
  });
  _failModalAnimationFrames.add(rafId);
  return rafId;
}

function clearAllFailTimeouts(): void {
  console.log(`🧹 Clearing ${_failModalTimeouts.size} pending timeouts from board-fail-modal`);
  _failModalTimeouts.forEach(timeout => clearTimeout(timeout));
  _failModalTimeouts.clear();
}

function clearAllFailAnimationFrames(): void {
  console.log(`🧹 Clearing ${_failModalAnimationFrames.size} pending animation frames from board-fail-modal`);
  _failModalAnimationFrames.forEach(rafId => cancelAnimationFrame(rafId));
  _failModalAnimationFrames.clear();
}

function removeExisting(): void {
  try {
    const prev = document.getElementById(OVERLAY_ID);
    prev?.remove?.();
  } catch {}
}

function playFailModalExitAnimation(params: {
  overlay: HTMLElement;
  card: HTMLElement;
  starsHero: HTMLElement;
  emptyStars: HTMLElement[];
  title: HTMLElement;
  boardStatus: HTMLElement;
  continueBtn: HTMLButtonElement;
  exitBtn: HTMLButtonElement;
  clickedAction?: string;
}): Promise<void> {
  const { overlay, card, starsHero, emptyStars, title, boardStatus, continueBtn, exitBtn, clickedAction } = params;
  const nodes = [title, boardStatus];
  const primaryButton = clickedAction === 'menu' ? exitBtn : continueBtn;
  const secondaryButton = clickedAction === 'menu' ? continueBtn : exitBtn;
  const animatedTargets = [starsHero, ...emptyStars, ...nodes, continueBtn, exitBtn, card, overlay].filter(Boolean);

  return new Promise(resolve => {
    requestAnimationFrame(async () => {
      try {
        continueBtn.disabled = true;
        exitBtn.disabled = true;

        animatedTargets.forEach(target => {
          target.style.pointerEvents = 'none';
          target.style.willChange = 'transform, opacity';
          target.style.transformOrigin = '50% 50%';
        });

        gsap.killTweensOf(animatedTargets);

        const exitEase = 'back.in(1.7)';

        const popOut = (
          target: HTMLElement,
          vars: { y?: number; delay?: number; duration?: number } = {}
        ) => {
          target.style.removeProperty('transition');
          target.style.removeProperty('-webkit-transition');
          gsap.killTweensOf(target);
          gsap.set(target, {
            opacity: 1,
            scale: 1,
            y: 0,
            transformOrigin: '50% 50%',
            force3D: true,
          });
          gsap.to(target, {
            scale: 0,
            opacity: 0,
            y: vars.y ?? 0,
            duration: vars.duration ?? 0.28,
            delay: vars.delay ?? 0,
            ease: exitEase,
            overwrite: 'auto',
            force3D: true,
            onComplete: () => {
              target.style.visibility = 'hidden';
            },
          });
        };

        await exitCtaPair(primaryButton, secondaryButton);

        popOut(starsHero, { y: -8, duration: 0.28 });
        emptyStars.forEach((star, index) => {
          popOut(star, { y: -4, delay: index * 0.035, duration: 0.24 });
        });

        nodes.forEach((node, index) => {
          popOut(node, {
            y: index === 0 ? -18 : -10,
            delay: 0.06 + index * 0.06,
            duration: 0.28,
          });
        });

        setTimeout(() => {
          card.style.removeProperty('transition');
          card.style.removeProperty('-webkit-transition');
          gsap.killTweensOf(card);
          gsap.to(card, {
            scale: 0.86,
            duration: 0.24,
            ease: exitEase,
            overwrite: 'auto',
            force3D: true,
          });
        }, 160);

        // Keep this handoff compact: the previous formula left the almost-empty
        // modal sitting on screen for 1.17s before the final card collapse.
        const collapseDelayMs = 360;
        setTimeout(() => {
          gsap.killTweensOf(card);
          gsap.to(card, {
            scale: 0,
            opacity: 0,
            duration: 0.22,
            ease: exitEase,
            overwrite: 'auto',
            force3D: true,
          });
          gsap.to(overlay, {
            opacity: 0,
            duration: 0.20,
            ease: 'power1.out',
            overwrite: 'auto',
          });
        }, collapseDelayMs);

        setTimeout(() => {
          animatedTargets.forEach(target => {
            target.style.willChange = '';
          });
          resolve();
        }, collapseDelayMs + 260);
      } catch (error) {
        logger.warn('⚠️ board-fail-modal: Exit animation failed, closing directly:', error);
        try {
          overlay.style.opacity = '0';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.88)';
        } catch {}
        setTimeout(resolve, 220);
      }
    });
  });
}

export function showBoardFailModal({ score = 0, boardNumber = 1 }: BoardFailModalParams = {}): Promise<BoardFailModalResult> {
  // 🔥 BUG FIX: Prevent duplicate calls - if modal is already open, return existing promise
  if (_isModalOpen) {
    const existingOverlay = document.getElementById(OVERLAY_ID);
    if (existingOverlay) {
      logger.warn('⚠️ board-fail-modal: Modal already open - ignoring duplicate show call');
      return Promise.resolve({ action: 'menu' }); // Return default action
    }
    logger.warn('⚠️ board-fail-modal: Stale open flag without overlay - resetting and showing fail modal');
    _isModalOpen = false;
  }
  
  _isModalOpen = true;
  
  return new Promise(async (resolve) => {
    let settled = false;
    let navigationAbortHandler: (() => void) | null = null;
    const safeResolve = (action: string): void => {
      if (settled) return;
      settled = true;
      if (navigationAbortHandler) {
        try { window.removeEventListener('cc-navigation', navigationAbortHandler); } catch {}
        navigationAbortHandler = null;
      }
      resolve({ action });
    };
    navigationAbortHandler = () => {
      try { cleanupFailModalLifecycle(); } catch {}
      try { document.getElementById(OVERLAY_ID)?.remove(); } catch {}
      _isModalOpen = false;
      safeResolve('__navigation-abort__');
    };
    window.addEventListener('cc-navigation', navigationAbortHandler, { once: true });
    // 🔥 CRITICAL FIX: Wrap entire promise body in try-catch to ensure resolve is ALWAYS called
    // Without this, if an error occurs before any button action, the promise never resolves
    // and busyEnding stays stuck, blocking future fail screens
    try {
    // 🔥 MEMORY LEAK FIX: Track all event listeners for cleanup
    const buttonEventListeners: Array<{
      button: HTMLElement;
      handlers: Array<{
        event: string;
        handler: EventListener;
        options?: AddEventListenerOptions;
      }>;
    }> = [];
    
    // 🔥 BUG FIX: Flag to prevent multiple resolveAndCleanup calls
    let isResolving = false;
    // 🔥 JOURNEY PROGRESSION: Handle board failure
    try {
      const { journeyProgressionState } = await import('./journey-progression-state.js');
      // Keep lastOpenedBoardId (don't reset it) - user should be able to retry same board
      journeyProgressionState.setLastOpenedBoardId(boardNumber);
      
      // 🔥 USER REQUEST: Save score in journey progression state BEFORE clearing currentRunState
      // This allows us to preserve score when resuming from interim card
      // Get current score from saved game state or use provided score (board-specific)
      let currentScore = score;
      try {
        const saveKey = getBoardSaveKey(boardNumber);
        const savedGame = localStorage.getItem(saveKey);
        if (savedGame) {
          const gameState = JSON.parse(savedGame);
          if (Number.isFinite(gameState.score) && gameState.score > 0) {
            currentScore = gameState.score;
            logger.info(`🗺️ Journey: Board ${boardNumber} failed - preserving score ${currentScore} from saved game (${saveKey})`);
          }
        }
      } catch (e) {
        logger.warn(`⚠️ Failed to read score from saved game for board ${boardNumber}:`, e);
      }
      
      // Also try to get score from current run state if available
      try {
        const currentRunState = journeyProgressionState.getCurrentRunState();
        if (currentRunState && currentRunState.boardId === boardNumber && currentRunState.score > currentScore) {
          currentScore = currentRunState.score;
          logger.info(`🗺️ Journey: Board ${boardNumber} failed - using score ${currentScore} from currentRunState`);
        }
      } catch (e) {
        logger.warn('⚠️ Failed to read score from currentRunState:', e);
      }
      
      // 🔥 USER REQUEST: Save score in journey progression state (with inProgress: true so it can be resumed)
      // This preserves the score for when user resumes from interim card
      // We set inProgress: true so continueGameWithSavedState can find it
      journeyProgressionState.setCurrentRunState(boardNumber, currentScore);
      logger.info(`🗺️ Journey: Board ${boardNumber} failed - score ${currentScore} saved in journey state (inProgress: true for resume)`);
      
      // 🔥 CRITICAL FIX: Clear __ccSkipRebuildBoard flag to force fresh board on retry
      delete (window as any).__ccSkipRebuildBoard;
      logger.info('✅ Cleared __ccSkipRebuildBoard flag - will rebuild fresh board on retry');
      
      // 🔥 CRITICAL FIX: Ensure interim status is saved for this board when user fails
      // This ensures interim card persists after hard exit
      try {
        const { journeyBoardsManager } = await import('./journey-boards-manager.js');
        // Set board to interim if not already unlocked (user can retry)
        const board = journeyBoardsManager.getBoardById(boardNumber);
        if (board && !board.unlocked) {
          board.interim = true;
          journeyBoardsManager.saveBoardsStatePublic();
          logger.info(`🗺️ Board ${boardNumber} set to interim after failure - interim card will persist`);
        }
      } catch (error) {
        logger.warn('⚠️ Failed to set interim status on board failure:', error);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to update Journey progression state on failure:', error);
    }
    
    // 🔥 USER REQUEST: Clear saved game state (tiles) but preserve score in journey progression state
    // This prevents loading failed board state, but preserves score for journey continuation
    // 🔥 CRITICAL FIX: Clear stuck game state from localStorage AFTER saving score (board-specific)
    // This prevents "Play Again" and interim card from loading the stuck board position
    try {
      // Set flag to prevent future saves
      (window as WindowWithCC)._gameHasEnded = true;
      
      // 🔥 USER REQUEST: Clear tiles/board state for THIS specific board (board-specific)
      // Score is already saved in journey progression state
      const saveKey = getBoardSaveKey(boardNumber);
      localStorage.removeItem(saveKey);
      localStorage.removeItem('cubeCrash_gameState');
      logger.info(`✅ board-fail-modal: Cleared board state for board ${boardNumber} (${saveKey}) - fresh board on retry, score preserved in journey progression state`);
    } catch (error) {
      logger.warn(`⚠️ board-fail-modal: Failed to clear saved game state for board ${boardNumber}:`, error);
    }
    
    if (settled) {
      logger.info('⏭️ board-fail-modal: Navigation aborted modal before DOM creation');
      return;
    }

    removeExisting();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'padding:48px 24px',
      'z-index:10000000000000',
      'opacity:0',
      'transition:opacity 0.25s ease'
    ].join(';');
    applyAppPaperSurfaceToElement(overlay);

    const card = document.createElement('div');
    card.style.cssText = [
      'background:transparent',
      'border-radius:40px',
      'padding:40px 32px',
      'text-align:center',
      'font-family:"Baloo2", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      'transform:scale(0.9)',
      'transition:transform .34s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity .2s ease',
      'opacity:0',
      'max-width:min(340px,88vw)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:72px'
    ].join(';');

    const infoStack = document.createElement('div');
    infoStack.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:64px;width:100%;';

    const starsHero = document.createElement('div');
    starsHero.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:16px',
      'width:min(280px,80vw)',
      'height:auto',
      'margin:0 auto',
      'overflow:visible'
    ].join(';');
    const emptyStars: HTMLImageElement[] = [];
    for (let i = 0; i < 3; i++) {
      let transformStyle = '';
      if (i === 0) {
        transformStyle = 'rotate(-8deg)';
      } else if (i === 1) {
        transformStyle = 'translateY(-16px)';
      } else {
        transformStyle = 'rotate(8deg)';
      }

      const starWrapper = document.createElement('div');
      starWrapper.style.cssText = [
        'position:relative',
        'width:clamp(60px, 20vw, 90px)',
        'height:clamp(60px, 20vw, 90px)',
        'flex-shrink:0',
        `transform:${transformStyle}`,
        'overflow:visible'
      ].join(';');

      const star = document.createElement('img');
      star.src = '/assets/modals/star-empty.png';
      star.alt = 'Empty star';
      star.style.cssText = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        'object-fit:contain',
        'z-index:1',
        'opacity:0.9'
      ].join(';');

      starWrapper.appendChild(star);
      starsHero.appendChild(starWrapper);
      emptyStars.push(star);
    }

    const textCluster = document.createElement('div');
    textCluster.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;';

    const title = document.createElement('div');
    title.textContent = pickRandom(HEADLINES);
    title.style.cssText = 'color:#e77449;font-weight:800;font-size:56px;line-height:56px;margin:0;';

    const boardStatus = document.createElement('div');
    const progressLabel = formatGameplayProgressLabel(
      isArcadeHomeRunMode() ? 'arcade' : 'journey',
      Math.max(1, boardNumber | 0),
      { padTo: 2 },
    );
    boardStatus.textContent = `${progressLabel} not cleared`;
    boardStatus.style.cssText = 'color:#b69077;font-weight:600;font-size:20px;line-height:1.2;margin:0;letter-spacing:0.02em;';

    textCluster.appendChild(title);
    textCluster.appendChild(boardStatus);

    infoStack.appendChild(starsHero);
    infoStack.appendChild(textCluster);

    const buttons = document.createElement('div');
    buttons.className = 'cc-cta-stack';

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.textContent = 'Play Again';
    continueBtn.className = 'cc-board-fail-cta';

    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.textContent = 'Exit';
    exitBtn.className = 'cc-board-fail-cta';

    buttons.appendChild(continueBtn);
    buttons.appendChild(exitBtn);

    card.appendChild(infoStack);

    const outerStack = document.createElement('div');
    outerStack.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:18px',
      'position:relative'
    ].join(';');
    outerStack.appendChild(card);
    outerStack.appendChild(buttons);

    overlay.appendChild(outerStack);
    document.body.appendChild(overlay);

    // 🔥 MEMORY LEAK FIX: Cleanup function to remove all event listeners
    const ctaControllers: CtaController[] = [];
    const cleanupButtonListeners = (): void => {
      buttonEventListeners.forEach(({ button, handlers }) => {
        handlers.forEach(({ event, handler, options }) => {
          try {
            button.removeEventListener(event, handler, options);
          } catch (e) {
            console.warn(`⚠️ board-fail-modal: Failed to remove ${event} listener:`, e);
          }
        });
      });
      buttonEventListeners.length = 0;
      console.log('✅ board-fail-modal: All button event listeners removed');
    };
    const disposeCtas = (): void => {
      ctaControllers.splice(0).forEach(controller => controller.dispose());
    };

    const cleanupFailModalLifecycle = (): void => {
      cleanupButtonListeners();
      clearAllFailTimeouts();
      clearAllFailAnimationFrames();
      try { window.removeEventListener('keydown', onKey); } catch {}
    };

    const runExitAnimation = (clickedAction: string): Promise<void> => playFailModalExitAnimation({
      overlay,
      card,
      starsHero,
      emptyStars: emptyStars as unknown as HTMLElement[],
      title,
      boardStatus,
      continueBtn,
      exitBtn,
      clickedAction,
    });

    // FX cleanup is handled by restartGame()/exitToMenu() to avoid duplicate cleanup races
    
    const resolveAndCleanup = async (action: string): Promise<void> => {
      // 🔥 BUG FIX: Prevent multiple calls (double-click protection)
      if (isResolving) {
        logger.warn('⚠️ resolveAndCleanup already in progress, ignoring duplicate call');
        return;
      }
      isResolving = true;
      
      // CRITICAL FIX: Update high score before resolving
      if (typeof (window as WindowWithCC).updateHighScore === 'function') {
        try {
          (window as WindowWithCC).updateHighScore!(score);
          logger.info('✅ board-fail-modal: window.updateHighScore called with score:', score);
        } catch (error) {
          logger.warn('⚠️ board-fail-modal: Failed to call window.updateHighScore:', error);
        }
      }
      
      // DIRECT FUNCTION CALLS like bottom sheet
      if (action === 'retry') {
        (async () => {
          try {
            // 🔥 MEMORY LEAK FIX: NOW cleanup (modal is closing)
            cleanupFailModalLifecycle();
            
            // Proceed with restart.
            logger.info('🎮 Play Again clicked - calling window.CC.restart directly');
            if (isArcadeHomeRunMode()) {
              resetArcadeFailedRunForFreshStart();
              (window as any).__ccForceArcadeRestartStage01 = true;
              logger.info('🎮 Arcade Play Again after fail - forcing fresh Round 01 restart');
            }
            await runExitAnimation(action);
            
            if ((window as WindowWithCC).CC && (window as WindowWithCC).CC!.restart) {
              try {
                console.info('[CC_HUD_RETRY_TRACE] fail-retry-dispatch', {
                  zone: (window as any).__ccAppZone,
                  exitingToMenu: (window as any).exitingToMenu === true,
                });
                (window as WindowWithCC).CC!.restart!({ animateHudDrop: true });
                logger.info('✅ window.CC.restart called from board-fail-modal');
              } catch (error) {
                logger.warn('⚠️ window.CC.restart failed:', error);
              }
            } else {
              logger.error('❌ window.CC.restart not available!');
            }
            
            disposeCtas();
            try { overlay.remove(); } catch {} 
            _isModalOpen = false; // 🔥 BUG FIX: Reset flag when modal closes
            safeResolve(action);
          } catch (error) {
            logger.warn('⚠️ Failed to restart after board fail, using fallback restart path:', error);
            
            // 🔥 MEMORY LEAK FIX: Cleanup on fallback too
            cleanupFailModalLifecycle();
            if (isArcadeHomeRunMode()) {
              resetArcadeFailedRunForFreshStart();
              (window as any).__ccForceArcadeRestartStage01 = true;
              logger.info('🎮 Arcade Play Again fallback after fail - forcing fresh Round 01 restart');
            }
            await runExitAnimation(action);
            
            if ((window as WindowWithCC).CC && (window as WindowWithCC).CC!.restart) {
              try {
                console.info('[CC_HUD_RETRY_TRACE] fail-retry-fallback-dispatch', {
                  zone: (window as any).__ccAppZone,
                  exitingToMenu: (window as any).exitingToMenu === true,
                });
                (window as WindowWithCC).CC!.restart!({ animateHudDrop: true });
                logger.info('✅ window.CC.restart called from board-fail-modal (fallback)');
              } catch (err) {
                logger.warn('⚠️ window.CC.restart failed:', err);
              }
            } else {
              logger.error('❌ window.CC.restart not available (fallback)!');
            }
            
            disposeCtas();
            try { overlay.remove(); } catch {} 
            _isModalOpen = false; // 🔥 BUG FIX: Reset flag when modal closes
            safeResolve(action);
          }
        })();
        return; // Exit early - modal closing is handled above
      } else if (action === 'menu') {
        // 🔥 MEMORY LEAK FIX: Cleanup (modal is closing)
        cleanupFailModalLifecycle();
        
        logger.info('🚪 Exit clicked - calling window.exitToMenu directly');
        resetArcadeFailedRunForFreshStart();
        
        if (isArcadeHomeRunMode()) {
          clearJourneyDetailReturn();
          logger.info('🎮 board-fail-modal: Arcade Exit - returning to homepage with no detail modal flags');
        } else {
          const returnDecision = prepareJourneyFailReturnTarget(boardNumber);
          logger.info('🎯 board-fail-modal: Journey fail return target prepared', returnDecision);
        }
        
        await runExitAnimation(action);

        // 🔥 BUG FIX: Cleanup board/FX after fail-modal exit to avoid cutting off the pop-out
        try { (window as any).CC?.cleanupFxForBoardReset?.('fail-exit'); } catch {}

        // Keep the fail overlay alive until the destination owns the screen.
        // Resolving early lets app-core resume while no Journey or board layer is visible.
        try {
          await requestExitToMenu({
            reason: 'board-fail-modal-exit',
            target: isArcadeHomeRunMode() ? 'homepage' : 'auto',
            skipBoardExit: true,
            fastArcadeCleanExit: isArcadeHomeRunMode(),
          });
          logger.info('✅ menu exit handoff completed from board-fail-modal');
        } catch (error) {
          logger.warn('⚠️ menu exit handoff failed:', error);
        }
        
        disposeCtas();
        try { overlay.remove(); } catch {} 
        _isModalOpen = false; // 🔥 BUG FIX: Reset flag when modal closes
        safeResolve(action);
        return; // Exit early - modal closing is handled above
      }
      
      // Only close modal if action is not 'retry' (retry handles its own modal closing)
      if (action !== 'retry') {
        // 🔥 MEMORY LEAK FIX: Cleanup event listeners for fallback actions
        cleanupFailModalLifecycle();
        
        await runExitAnimation(action);
        disposeCtas();
        try { overlay.remove(); } catch {} 
        _isModalOpen = false; // 🔥 BUG FIX: Reset flag when modal closes
        safeResolve(action);
      }
    };

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void resolveAndCleanup('menu');
      }
    };
    window.addEventListener('keydown', onKey);

    ctaControllers.push(
      registerCta(continueBtn, {
        variant: 'primary',
        initialState: 'hidden',
        activationTiming: 'immediate',
        onActivate: () => resolveAndCleanup('retry'),
      }),
      registerCta(exitBtn, {
        variant: 'secondary',
        initialState: 'hidden',
        activationTiming: 'immediate',
        onActivate: () => resolveAndCleanup('menu'),
      }),
    );

    const animatedNodes: HTMLElement[] = [];
    const prep = (el: HTMLElement, dy: number = 0, scale: number = 0.72): void => {
      el.style.opacity = '0';
      el.style.transform = `translateY(${dy}px) scale(${scale})`;
      el.style.transition = 'none';
      animatedNodes.push(el);
    };

    prep(starsHero, -25, 0.7);
    prep(title, -20, 0.75);
    prep(boardStatus, -10, 0.82);

    overlay.style.opacity = '1';
    card.style.opacity = '1';
    card.style.transform = 'scale(1)';

    requestAnimationFrame(() => {
      const trans = 'opacity 0.55s cubic-bezier(0.68, -0.6, 0.32, 1.4), transform 0.55s cubic-bezier(0.68, -0.6, 0.32, 1.4)';
      [starsHero, title, boardStatus].forEach(el => {
        el.style.transition = trans;
      });

      const schedule = (el: HTMLElement, delay: number): void => {
        trackFailTimeout(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0) scale(1)';
        }, delay);
      };

      schedule(starsHero, 120);
      schedule(title, 240);
      schedule(boardStatus, 420);
      trackFailTimeout(() => { void getRegisteredCta(continueBtn)?.enter(); }, 640);
      trackFailTimeout(() => { void getRegisteredCta(exitBtn)?.enter(); }, 820);

      emptyStars.forEach((star, index) => {
        trackFailTimeout(() => {
          // The group owns visibility. Individual stars stay readable and only
          // perform a compact squash/overshoot, so the stagger can never look
          // like one star disappeared or failed to render.
          star.style.transition = 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)';
          star.style.transform = 'scale(1.12)';
          trackFailTimeout(() => {
            star.style.transition = 'transform 190ms cubic-bezier(0.34, 1.35, 0.64, 1)';
            star.style.transform = 'scale(0.98)';
            trackFailTimeout(() => {
              star.style.transform = 'scale(1)';
            }, 130);
          }, 115);
        }, 360 + index * 95);
      });
    });
    } catch (outerError) {
      // 🔥 CRITICAL: Ensure promise ALWAYS resolves, even on catastrophic error
      // This prevents busyEnding from staying stuck and blocking future fail screens
      logger.error('❌ board-fail-modal: Catastrophic error in promise body - force resolving', outerError);
      _isModalOpen = false;
      clearAllFailTimeouts();  // 🔥 FIX: Correct function name (was clearAllFailModalTimeouts)
      clearAllFailAnimationFrames();  // 🔥 FIX: Correct function name (was clearAllFailModalAnimationFrames)
      safeResolve('menu'); // Default action on error
    }
  });
}
