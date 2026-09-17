import { attachFishFinaleBubbles, preloadFishFinaleBubbles } from '../fish-finale-bubbles';
jest.mock('../mobile-runtime-profile', () => ({ MOBILE_RUNTIME_PROFILE: { platform: 'ios' } }));

test('Fish warms each retained video once and consumes it without reusing active playback', () => {
  const load = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const overlay = document.createElement('div');
  document.body.append(overlay);
  const cleanups: Array<() => void> = [];
  try {
    preloadFishFinaleBubbles();
    expect(load).toHaveBeenCalledTimes(2); // swimmer and bubble videos
    const warmed = [...load.mock.instances] as unknown as HTMLVideoElement[];
    preloadFishFinaleBubbles();
    expect(load).toHaveBeenCalledTimes(2);
    cleanups.push(attachFishFinaleBubbles(overlay));
    const active = Array.from(overlay.querySelectorAll('video'));
    expect(active).toHaveLength(2);
    expect(active.every((video) => warmed.includes(video))).toBe(true);
    active.forEach((video) => { video.currentTime = 0.5; });
    preloadFishFinaleBubbles();
    expect(load).toHaveBeenCalledTimes(4);
    const nextWarm = load.mock.instances.slice(2) as unknown as HTMLVideoElement[];
    expect(nextWarm.every((video) => !active.includes(video))).toBe(true);
    expect(active.map((video) => video.currentTime)).toEqual([0.5, 0.5]);
    preloadFishFinaleBubbles();
    expect(load).toHaveBeenCalledTimes(4);
    cleanups.push(attachFishFinaleBubbles(overlay));
    expect(Array.from(overlay.querySelectorAll('video')).filter((video) => nextWarm.includes(video))).toHaveLength(2);
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    overlay.remove();
    jest.restoreAllMocks();
  }
});

test('a cold Fish finale starts without warmup and retains both media error fallbacks', () => {
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const overlay = document.createElement('div');
  document.body.append(overlay);
  const cleanup = attachFishFinaleBubbles(overlay);
  try {
    const videos = Array.from(overlay.querySelectorAll('video'));
    expect(videos).toHaveLength(2);
    expect(play).toHaveBeenCalledTimes(2);
    videos.forEach((video) => video.dispatchEvent(new Event('error')));
    expect(overlay.querySelector('[data-fish-bubbles-source="svg-fast-fallback"]')).not.toBeNull();
    expect(overlay.querySelector('[data-fish-finale-source="svg-fallback"]')).not.toBeNull();
  } finally {
    cleanup();
    overlay.remove();
    jest.restoreAllMocks();
  }
});
