const mockTimelineTo = jest.fn();
const mockTimeline = {
  to: mockTimelineTo,
  kill: jest.fn(),
};
mockTimelineTo.mockReturnValue(mockTimeline);

const mockGsapTimeline = jest.fn(() => mockTimeline);
const mockGsapSet = jest.fn();
const mockGsapKillTweensOf = jest.fn();

jest.mock('gsap', () => ({
  gsap: {
    timeline: mockGsapTimeline,
    set: mockGsapSet,
    killTweensOf: mockGsapKillTweensOf,
  },
}));

jest.mock('../../core/logger.js', () => ({
  logger: { warn: jest.fn() },
}));

import {
  NAV_ICON_TAP_BOUNCE,
  getNavIconVisualTarget,
  navIconTapBounceEase,
  playNavIconCartoonBounce,
} from '../nav-icon-bounce';

describe('shared navigation icon tap bounce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTimelineTo.mockReturnValue(mockTimeline);
    mockGsapTimeline.mockReturnValue(mockTimeline);
  });

  test('targets the dedicated nav visual before a nested image', () => {
    const button = document.createElement('button');
    const visual = document.createElement('span');
    visual.className = 'nav-icon-visual';
    visual.appendChild(document.createElement('img'));
    button.appendChild(visual);

    expect(getNavIconVisualTarget(button)).toBe(visual);
  });

  test('uses the exact 220ms backpack scale milestones and shared easing', () => {
    const button = document.createElement('button');
    const icon = document.createElement('img');
    button.appendChild(icon);

    expect(playNavIconCartoonBounce(button)).toBe(mockTimeline);
    expect(mockGsapKillTweensOf).toHaveBeenCalledWith(icon);
    expect(mockTimelineTo).toHaveBeenNthCalledWith(1, icon, expect.objectContaining({
      scale: 0.92,
      duration: 0.077,
      ease: navIconTapBounceEase,
    }));
    expect(mockTimelineTo).toHaveBeenNthCalledWith(2, icon, expect.objectContaining({
      scale: 1.06,
      duration: 0.077,
      ease: navIconTapBounceEase,
    }));
    expect(mockTimelineTo).toHaveBeenNthCalledWith(3, icon, expect.objectContaining({
      scale: 1,
      duration: 0.066,
      ease: navIconTapBounceEase,
    }));
    expect(
      NAV_ICON_TAP_BOUNCE.squeezeDurationSeconds
      + NAV_ICON_TAP_BOUNCE.popDurationSeconds
      + NAV_ICON_TAP_BOUNCE.settleDurationSeconds,
    ).toBeCloseTo(NAV_ICON_TAP_BOUNCE.totalDurationSeconds, 8);
    expect(NAV_ICON_TAP_BOUNCE.cssEase).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
  });

  test('restarts safely on a rapid repeat tap and preserves easing endpoints', () => {
    const button = document.createElement('button');

    playNavIconCartoonBounce(button);
    playNavIconCartoonBounce(button);

    expect(mockTimeline.kill).toHaveBeenCalledTimes(1);
    expect(mockGsapKillTweensOf).toHaveBeenCalledTimes(2);
    expect(mockGsapSet).toHaveBeenNthCalledWith(1, button, expect.objectContaining({ scale: 1 }));
    expect(mockGsapSet).toHaveBeenNthCalledWith(2, button, expect.objectContaining({ scale: 1 }));
    expect(navIconTapBounceEase(0)).toBe(0);
    expect(navIconTapBounceEase(1)).toBe(1);
  });
});
