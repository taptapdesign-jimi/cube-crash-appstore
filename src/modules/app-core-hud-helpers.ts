import { gsap } from 'gsap';
import { logger } from '../core/logger.js';
import { devLog, devError } from './app-core-logger.ts';

type HudDeps = {
  getScore: () => number;
  setScore: (v: number) => void;
  getBoardNumber: () => number;
  setBoardNumber: (v: number) => void;
  getMoves: () => number;
  getCombo: () => number;
  setCombo: (v: number) => void;
  syncSharedState: () => void;
  SCORE_CAP: number;
  HUD: any;
  getFallbackUpdateHUD: () => ((payload: { score: number; board: number; moves: number; combo: number }) => void) | undefined;
  getAnimateScore: () => ((opts: any, toValue: number, duration?: number) => void) | undefined;
  getAnimateBoard: () => ((opts: any, toValue: number, duration?: number) => void) | undefined;
  getSetBoard: () => ((toValue: number) => void) | undefined;
};

export function createHudHelpers(deps: HudDeps) {
  const updateHUD = () => {
    const actualCombo = deps.getCombo();
    deps.setCombo(actualCombo);

    logger.debug('🎯 updateHUD called', 'app-core', {
      score: deps.getScore(),
      board: deps.getBoardNumber(),
      moves: deps.getMoves(),
      combo: actualCombo,
    });
    deps.syncSharedState();

    try {
      if (typeof deps.HUD?.updateHUD === 'function') {
        logger.debug('🎯 Calling HUD.updateHUD from hud-helpers.js', 'app-core');
        deps.HUD.updateHUD({
          score: deps.getScore(),
          board: deps.getBoardNumber(),
          moves: deps.getMoves(),
          combo: actualCombo,
        });
        return;
      } else {
        devLog('⚠️ HUD.updateHUD function not available');
      }
    } catch (error) {
      devError('❌ Error calling HUD.updateHUD:', error);
    }

    try {
      const fallback = deps.getFallbackUpdateHUD();
      if (typeof fallback === 'function') {
        devLog('🎯 Using fallback _updateHUD');
        fallback({
          score: deps.getScore(),
          board: deps.getBoardNumber(),
          moves: deps.getMoves(),
          combo: actualCombo,
        });
        return;
      }
    } catch (error) {
      devError('❌ Error calling _updateHUD:', error);
    }

    devLog('🎯 Using legacy fallback for HUD update');
  };

  const animateScore = (toValue: number, duration = 0.45) => {
    const _animateScore = deps.getAnimateScore();
    if (typeof _animateScore === 'function') {
      _animateScore(
        { scoreRef: deps.getScore, setScore: deps.setScore, updateHUD, SCORE_CAP: deps.SCORE_CAP, gsap },
        toValue,
        duration
      );
    } else {
      deps.HUD?.animateScore?.(
        { scoreRef: deps.getScore, setScore: deps.setScore, updateHUD, SCORE_CAP: deps.SCORE_CAP, gsap },
        toValue,
        duration
      );
    }
  };

  const animateBoardHUD = (toValue: number, duration = 0.45) => {
    const _animateBoard = deps.getAnimateBoard();
    if (typeof _animateBoard === 'function') {
      _animateBoard({ boardRef: deps.getBoardNumber, setBoard: deps.setBoardNumber, updateHUD, gsap }, toValue, duration);
    } else {
      try {
        deps.getSetBoard()?.(toValue);
      } catch {}
      deps.setBoardNumber(toValue | 0);
      updateHUD();
    }
  };

  return { updateHUD, animateScore, animateBoardHUD };
}
