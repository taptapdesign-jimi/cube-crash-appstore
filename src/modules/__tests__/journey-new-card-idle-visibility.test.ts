import { clearJourneyNewCardIdleShineWork } from '../journey-new-card-idle-visibility';

describe('Journey New Reward idle visibility ownership', () => {
  test('background suspension retires only idle pulse work and preserves the authored mask', () => {
    const light = document.createElement('div');
    const face = document.createElement('img');
    light.className = 'is-shine';
    face.className = 'is-glow';
    light.style.webkitMaskImage = 'url("card-mask.png")';
    light.style.maskImage = 'url("card-mask.png")';
    const timeline = { kill: jest.fn() };
    const restoreFaceScale = jest.fn();
    const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout').mockImplementation(() => undefined);
    const cancelFrameSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const timeoutIds = new Set([11, 12]);
    const frameIds = new Set([21]);
    const timelines = new Set([timeline]);

    clearJourneyNewCardIdleShineWork({
      timeoutIds,
      frameIds,
      timelines,
      lightElement: light,
      faceElement: face,
      lightActiveClass: 'is-shine',
      faceActiveClass: 'is-glow',
      restoreFaceScale,
    });

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(cancelFrameSpy).toHaveBeenCalledWith(21);
    expect(timeline.kill).toHaveBeenCalledTimes(1);
    expect(timeoutIds.size).toBe(0);
    expect(frameIds.size).toBe(0);
    expect(timelines.size).toBe(0);
    expect(light.classList.contains('is-shine')).toBe(false);
    expect(face.classList.contains('is-glow')).toBe(false);
    expect(light.style.webkitMaskImage).toContain('card-mask.png');
    expect(light.style.maskImage).toContain('card-mask.png');
    expect(restoreFaceScale).toHaveBeenCalledTimes(1);

    clearTimeoutSpy.mockRestore();
    cancelFrameSpy.mockRestore();
  });

  test('does not mutate shared intro or reveal classes when the idle owner has no work', () => {
    const light = document.createElement('div');
    const face = document.createElement('img');
    light.className = 'is-shine';
    face.className = 'is-glow';
    const restoreFaceScale = jest.fn();

    clearJourneyNewCardIdleShineWork({
      timeoutIds: new Set(),
      frameIds: new Set(),
      timelines: new Set(),
      lightElement: light,
      faceElement: face,
      lightActiveClass: 'is-shine',
      faceActiveClass: 'is-glow',
      restoreFaceScale,
    });

    expect(light.classList.contains('is-shine')).toBe(true);
    expect(face.classList.contains('is-glow')).toBe(true);
    expect(restoreFaceScale).not.toHaveBeenCalled();
  });
});
