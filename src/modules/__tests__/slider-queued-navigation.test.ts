import { SliderManager } from '../slider-manager';
import gameState from '../game-state';
import { sliderState } from '../slider-state';
import { SLIDER_ANIMATION } from '../../constants/animations';

jest.mock('../drag-core', () => ({ getOriginalGsapTo: jest.fn() }));
jest.mock('../../utils/animations', () => ({ resetAnimationFlags: jest.fn() }));
jest.mock('../first-play-tutorial', () => ({ isFirstPlayTutorialForced: () => false }));
jest.mock('../homepage-slider-swipe-sound', () => ({ playHomepageSliderSwipeSound: jest.fn(), preloadHomepageSliderSwipeSound: jest.fn() }));

let manager: SliderManager;
let update: jest.SpyInstance;
beforeEach(() => {
  jest.useFakeTimers();
  gameState.set('sliderLocked', false);
  sliderState.setAnimatingExit(false);
  sliderState.setAnimatingEnter(true);
  manager = new SliderManager();
  jest.spyOn(manager as any, 'resolveHiddenSlideTarget').mockImplementation((index) => index);
  update = jest.spyOn(manager as any, 'updateSlider').mockImplementation(() => {});
});
afterEach(() => { manager.destroy(); jest.useRealTimers(); });

it('commits successful enter once and cancels its fallback', () => {
  manager.goToSlide(1);
  sliderState.setAnimatingEnter(false);
  jest.advanceTimersByTime(SLIDER_ANIMATION.ANIMATION_CHECK_INTERVAL * 2);
  expect(update).toHaveBeenCalledTimes(1);
  manager.goToSlide(2);
  jest.advanceTimersByTime(SLIDER_ANIMATION.FALLBACK_TIMEOUT * 2);
  expect(gameState.get('currentSlide')).toBe(2);
  expect(update).toHaveBeenCalledTimes(2);
});
it('fallback clears a stuck enter and commits only once', () => {
  manager.goToSlide(1);
  jest.advanceTimersByTime(SLIDER_ANIMATION.FALLBACK_TIMEOUT * 2);
  expect(sliderState.isAnimatingEnter).toBe(false);
  expect(update).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
it('latest queued navigation replaces previous intent', () => {
  manager.goToSlide(1);
  jest.advanceTimersByTime(100);
  manager.goToSlide(2);
  jest.advanceTimersByTime(SLIDER_ANIMATION.FALLBACK_TIMEOUT * 2);
  expect(gameState.get('currentSlide')).toBe(2);
  expect(update).toHaveBeenCalledTimes(1);
});
it.each([0, SLIDER_ANIMATION.ANIMATION_CHECK_INTERVAL])('destroy cancels polling and delayed commit at %i ms', (elapsed) => {
  manager.goToSlide(1);
  sliderState.setAnimatingEnter(false);
  jest.advanceTimersByTime(elapsed);
  manager.destroy();
  sliderState.setAnimatingEnter(true);
  jest.advanceTimersByTime(SLIDER_ANIMATION.FALLBACK_TIMEOUT * 2);
  expect(update).not.toHaveBeenCalled();
  expect(sliderState.isAnimatingEnter).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
it('a queued fallback cannot reset exit-owned animation flags or navigate', () => {
  manager.goToSlide(1);
  sliderState.setAnimatingExit(true);
  jest.advanceTimersByTime(SLIDER_ANIMATION.FALLBACK_TIMEOUT * 2);
  expect(update).not.toHaveBeenCalled();
  expect(sliderState.isAnimatingEnter).toBe(true);
});
