import {
  BOARD_POPIN_SOUND_SOURCE, BOARD_POPIN_SOUND_LAYERS, playBoardPopInSound, preloadBoardPopInSound, stopBoardPopInSound,
} from '../board-popin-sound';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices } from '../gameplay-audio-buffer-player';

jest.mock('../gameplay-audio-buffer-player', () => ({
  playDecodedGameplaySound: jest.fn(), preloadDecodedGameplaySounds: jest.fn(), stopDecodedGameplayVoices: jest.fn(),
}));

describe('board setup cue lifecycle', () => {
  beforeEach(() => {
    (window as any)._settings = { gameSoundsEnabled: true };
    (playDecodedGameplaySound as jest.Mock).mockReturnValue('played');
    (preloadDecodedGameplaySounds as jest.Mock).mockReturnValue(true);
  });
  afterEach(() => { stopBoardPopInSound(); delete (window as any)._settings; });

  test('warms all supplied layers and adds cubes only to the bounded enter mix', () => {
    preloadBoardPopInSound();
    expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(BOARD_POPIN_SOUND_LAYERS.map(layer => layer.source));
    const stop = playBoardPopInSound(0.97);
    expect(playDecodedGameplaySound).toHaveBeenCalledWith(BOARD_POPIN_SOUND_SOURCE, {
      voiceId: 'board-popin-setting-up', volume: 0.3, stopAfterSeconds: 0.97, fadeOutSeconds: 0.05,
    });
    expect(playDecodedGameplaySound).toHaveBeenCalledWith('./assets/sound/board etting up/plump.wav', {
      voiceId: 'board-popin-plump', volume: 0.42, stopAfterSeconds: 0.97, fadeOutSeconds: 0.05,
    });
    expect(playDecodedGameplaySound).toHaveBeenCalledWith('./assets/sound/board etting up/setting up2.wav', {
      voiceId: 'board-popin-setting-up2', volume: 0.42, stopAfterSeconds: 0.97, fadeOutSeconds: 0.05,
    });
    expect(playDecodedGameplaySound).toHaveBeenCalledWith('./assets/sound/board etting up/cubes.wav', {
      voiceId: 'board-popin-cubes', volume: 0.24, stopAfterSeconds: 0.97, fadeOutSeconds: 0.05,
    });
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(4);
    (stopDecodedGameplayVoices as jest.Mock).mockClear();
    stop(); stop();
    expect(stopDecodedGameplayVoices).toHaveBeenCalledTimes(1);
  });

  test.each(['pending', 'unavailable'])('replacement and cleanup remain bounded for %s playback', result => {
    (playDecodedGameplaySound as jest.Mock).mockReturnValue(result);
    const oldStop = playBoardPopInSound(0.97);
    const newStop = playBoardPopInSound(0.97);
    (stopDecodedGameplayVoices as jest.Mock).mockClear();
    oldStop();
    expect(stopDecodedGameplayVoices).not.toHaveBeenCalled();
    newStop();
    expect(stopDecodedGameplayVoices).toHaveBeenCalledTimes(1);
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(8);
  });

  test('keeps cubes out of the board exit mix', () => {
    playBoardPopInSound(0.8, 'exit');
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(3);
    expect(playDecodedGameplaySound).not.toHaveBeenCalledWith(
      './assets/sound/board etting up/cubes.wav', expect.anything(),
    );
  });

  test('Sounds OFF blocks preparation/start, and ON cannot revive an old entry', () => {
    const oldStop = playBoardPopInSound(0.97);
    (window as any)._settings.gameSoundsEnabled = false;
    stopBoardPopInSound();
    (playDecodedGameplaySound as jest.Mock).mockClear();
    (preloadDecodedGameplaySounds as jest.Mock).mockClear();
    expect(preloadBoardPopInSound()).toBe(false);
    playBoardPopInSound(0.97);
    expect(playDecodedGameplaySound).not.toHaveBeenCalled();
    expect(preloadDecodedGameplaySounds).not.toHaveBeenCalled();
    (window as any)._settings.gameSoundsEnabled = true;
    oldStop();
    expect(playDecodedGameplaySound).not.toHaveBeenCalled();
  });
});
