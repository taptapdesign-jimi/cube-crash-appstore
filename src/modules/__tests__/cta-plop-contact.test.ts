import fs from 'node:fs';
import { playCardTapPlopSound, playCtaActivationSounds, stopCtaActivationSounds } from '../cta-activation-sound';
import { playDecodedGameplaySound, stopDecodedGameplayVoices } from '../gameplay-audio-buffer-player';
jest.mock('../gameplay-audio-buffer-player', () => ({
  getDecodedGameplaySoundsState: jest.fn(() => 'ready'), playDecodedGameplaySound: jest.fn(() => 'played'),
  preloadDecodedGameplaySounds: jest.fn(), stopDecodedGameplayVoices: jest.fn(),
}));
describe('one plop per accepted CTA or Unit card contact', () => {
  beforeEach(() => { (window as any)._settings = { gameSoundsEnabled: true }; });
  afterEach(() => { stopCtaActivationSounds(); delete (window as any)._settings; });
  test('shared CTA includes plop once while Unit contact plays only plop', () => {
    playCtaActivationSounds();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(5);
    expect((playDecodedGameplaySound as jest.Mock).mock.calls.filter(c => c[0].endsWith('klik plop.wav'))).toHaveLength(1);
    (playDecodedGameplaySound as jest.Mock).mockClear(); playCardTapPlopSound();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
    expect(playDecodedGameplaySound).toHaveBeenCalledWith('./assets/sound/card reveal/klik plop.wav', { voiceId: 'cta-activation-plop', volume: 0.6 });
    stopCtaActivationSounds(); expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(expect.arrayContaining(['cta-activation-plop']));
  });
  test('muted input stays silent and reward has no second plop owner', () => {
    (window as any)._settings.gameSoundsEnabled = false; playCardTapPlopSound(); playCtaActivationSounds();
    expect(playDecodedGameplaySound).not.toHaveBeenCalled();
    expect(fs.readFileSync('src/modules/journey-new-card-screen.ts','utf8')).not.toContain('playJourneyNewCardTapSound');
    const manager = fs.readFileSync('src/modules/journey-boards-manager.ts','utf8');
    expect(manager).toContain('_openingDetail = true;\n        playCardTapPlopSound();');
    expect(manager).toContain('_openingGame = true;\n        playCardTapPlopSound();');
  });
});
