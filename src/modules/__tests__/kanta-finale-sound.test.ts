/** @jest-environment jsdom */
import { attachKantaFinaleScene, KANTA_FINALE_EXIT_START_SECONDS, KANTA_FINALE_SCENE_SECONDS, KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS } from '../kanta-finale-scene';
import { createKantaExitSoundSequence } from '../kanta-merge6-sound';
jest.mock('../kanta-merge6-sound', () => ({ createKantaExitSoundSequence: jest.fn(), KANTA_BIBIS_FADE_SECONDS: 0.5 }));

test('sounds once at each of eleven pickups and three composite exit starts, with no late work after cleanup', () => {
  let frame: FrameRequestCallback = () => {};
  const play = jest.fn();
  const stop = jest.fn();
  const fadeBibis = jest.fn();
  const fadeWalking = jest.fn();
  const startWalking = jest.fn();
  jest.mocked(createKantaExitSoundSequence).mockReturnValue({ play, stop, fadeBibis, fadeWalking, startWalking });
  jest.spyOn(performance, 'now').mockReturnValue(0);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const overlay = document.createElement('div');
  document.body.append(overlay);
  const cleanup = attachKantaFinaleScene(overlay, 2, jest.fn());
  try {
    expect(startWalking).not.toHaveBeenCalled();
    frame((KANTA_FINALE_ROBOT_ENTRY_DELAY_SECONDS + 0.001) * 1000);
    expect(startWalking).toHaveBeenCalledTimes(1);
    const starts = Array.from(overlay.querySelectorAll<HTMLElement>('[data-kanta-finale-pickup-start-seconds]'))
      .map(element => Number(element.dataset.kantaFinalePickupStartSeconds)).sort((a, b) => a - b);
    frame((starts[0] - 0.01) * 1000);
    expect(play).not.toHaveBeenCalled();
    starts.forEach((start, index) => {
      frame((start + 0.001) * 1000);
      expect(play.mock.calls.filter(([key]) => key.startsWith('can-'))).toHaveLength(index + 1);
    });
    frame((KANTA_FINALE_EXIT_START_SECONDS + 0.001) * 1000);
    expect(play.mock.calls.filter(([key]) => key.startsWith('composite-'))).toHaveLength(3);
    fadeBibis.mockClear();
    fadeWalking.mockClear();
    frame((KANTA_FINALE_SCENE_SECONDS - 0.501) * 1000);
    expect(fadeBibis).not.toHaveBeenCalled();
    expect(fadeWalking).not.toHaveBeenCalled();
    frame((KANTA_FINALE_SCENE_SECONDS - 0.25) * 1000);
    expect(fadeBibis).toHaveBeenLastCalledWith(expect.closeTo(0.5));
    expect(fadeWalking).toHaveBeenLastCalledWith(expect.closeTo(0.5));
    frame(KANTA_FINALE_SCENE_SECONDS * 1000);
    expect(fadeBibis).toHaveBeenLastCalledWith(1);
    expect(fadeWalking).toHaveBeenLastCalledWith(1);
    expect(startWalking).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(14);
    cleanup();
    cleanup();
    frame((KANTA_FINALE_SCENE_SECONDS + 1) * 1000);
    expect(play).toHaveBeenCalledTimes(14);
    expect(stop).toHaveBeenCalledTimes(1);
  } finally { cleanup(); overlay.remove(); jest.restoreAllMocks(); }
});
