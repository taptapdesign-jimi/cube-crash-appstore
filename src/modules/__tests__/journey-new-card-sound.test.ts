import fs from 'node:fs';
import ts from 'typescript';
import { createJourneyNewCardSoundSession, preloadJourneyNewCardSounds, playJourneyNewCardTapSound, stopJourneyNewCardSounds, JOURNEY_NEW_CARD_SOUND_SOURCES } from '../journey-new-card-sound';
import { playDecodedGameplaySound, preloadDecodedGameplaySounds, stopDecodedGameplayVoices } from '../gameplay-audio-buffer-player';
import { resolveJourneyNewCardTapAction } from '../journey-new-card-input';
jest.mock('../gameplay-audio-buffer-player', () => ({
  playDecodedGameplaySound: jest.fn(), preloadDecodedGameplaySounds: jest.fn(), stopDecodedGameplayVoices: jest.fn(),
}));

describe('New Reward authored audio', () => {
  beforeEach(() => { (window as any)._settings = { gameSoundsEnabled: true }; });
  afterEach(() => { stopJourneyNewCardSounds(); delete (window as any)._settings; });
  test('preloads exactly the five supplied sources and plays interim layers once at 70% base gain', () => {
    preloadJourneyNewCardSounds();
    expect(preloadDecodedGameplaySounds).toHaveBeenCalledWith(Object.values(JOURNEY_NEW_CARD_SOUND_SOURCES));
    const owner = createJourneyNewCardSoundSession();
    owner.playIntro(); owner.playCrumble(); owner.playCrumble();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(2);
    for (const call of (playDecodedGameplaySound as jest.Mock).mock.calls) expect(call[1].volume).toBeCloseTo(0.42);
    owner.playReveal(); owner.playReveal();
    expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(['journey-new-card-intro', 'journey-new-card-crumble']);
    expect(playDecodedGameplaySound).toHaveBeenLastCalledWith(JOURNEY_NEW_CARD_SOUND_SOURCES.reveal, { voiceId: 'journey-new-card-reveal', volume: 0.6 });
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(3);
  });
  test('starts happy once at screen entry with 50% base gain and retains it through reveal', () => {
    const owner = createJourneyNewCardSoundSession();
    owner.playHappy(); owner.playHappy();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
    expect(playDecodedGameplaySound).toHaveBeenCalledWith('./assets/sound/card reveal/happy sound.wav', {
      voiceId: 'journey-new-card-happy', volume: 0.3,
    });
    (stopDecodedGameplayVoices as jest.Mock).mockClear();
    owner.playReveal();
    expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(['journey-new-card-intro', 'journey-new-card-crumble']);
    owner.stop();
    expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(expect.arrayContaining(['journey-new-card-happy']));
    const screen = fs.readFileSync('src/modules/journey-new-card-screen.ts', 'utf8');
    expect(screen).toContain('.call(cardSound.playHappy, undefined, 0)');
  });

  test.each(['pending', 'unavailable'])('replacement cannot revive or stop a newer presentation after %s', result => {
    (playDecodedGameplaySound as jest.Mock).mockReturnValue(result);
    const old = createJourneyNewCardSoundSession(); old.playIntro();
    const next = createJourneyNewCardSoundSession();
    (stopDecodedGameplayVoices as jest.Mock).mockClear();
    old.playCrumble(); old.playReveal(); old.stop();
    expect(stopDecodedGameplayVoices).not.toHaveBeenCalled();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
    next.playIntro(); next.stop(); next.playReveal();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(2);
    expect(stopDecodedGameplayVoices).toHaveBeenCalledTimes(1);
  });
  test('Sounds OFF drops past cues; ON permits a new reveal contact without replay', () => {
    const owner = createJourneyNewCardSoundSession();
    owner.playIntro(); stopJourneyNewCardSounds();
    (window as any)._settings.gameSoundsEnabled = false;
    expect(preloadJourneyNewCardSounds()).toBe(false);
    owner.playCrumble();
    (window as any)._settings.gameSoundsEnabled = true;
    owner.playIntro(); owner.playCrumble();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
    owner.playReveal();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(2);
  });

  test('tap obeys Sounds and survives presentation stop until screen cleanup', () => {
    const owner = createJourneyNewCardSoundSession();
    playJourneyNewCardTapSound();
    expect(playDecodedGameplaySound).toHaveBeenLastCalledWith(JOURNEY_NEW_CARD_SOUND_SOURCES.tap, { voiceId: 'journey-new-card-tap', volume: 0.6 });
    owner.stop();
    expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(expect.not.arrayContaining(['journey-new-card-tap']));
    stopJourneyNewCardSounds();
    expect(stopDecodedGameplayVoices).toHaveBeenLastCalledWith(expect.arrayContaining(['journey-new-card-tap']));
    (window as any)._settings.gameSoundsEnabled = false;
    playJourneyNewCardTapSound();
    expect(playDecodedGameplaySound).toHaveBeenCalledTimes(1);
  });

  test('actual tap handlers use one CTA for reveal and one for queued collection, despite pointerup plus click', () => {
    const source = ts.createSourceFile('screen.ts', fs.readFileSync('src/modules/journey-new-card-screen.ts', 'utf8'), ts.ScriptTarget.Latest, true);
    const names = ['onReveal', 'handleUnlockedPointerUp', 'playRewardCardTap'];
    const declarations: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(source))) declarations.push(`const ${node.getText(source)};`);
      ts.forEachChild(node, visit);
    };
    visit(source);
    const body = `let revealed=false, revealRunning=false, resolved=false, disposed=false, suppressClickUntil=0, collectRequestedDuringReveal=false, activeDragPointerId=null;
      const stopContinueCoach=()=>{}, finishUnlockedPointer=()=>{}, finish=()=>{resolved=true;}, reveal=()=>{revealRunning=true;};
      ${declarations.join('\n')}
      return {onReveal,handleUnlockedPointerUp, finishReveal:()=>{revealed=true;revealRunning=false;resolved=true;}};`;
    const code = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const cta = jest.fn();
    const plop = jest.fn();
    const handlers = new Function('playCtaActivationSounds','playJourneyNewCardTapSound','resolveJourneyNewCardTapAction',code)(cta,plop,resolveJourneyNewCardTapAction);
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    handlers.onReveal(event);
    expect(cta).toHaveBeenCalledTimes(1);
    handlers.handleUnlockedPointerUp(event);
    handlers.onReveal(event);
    expect(cta).toHaveBeenCalledTimes(2);
    expect(plop).toHaveBeenCalledTimes(2);
    handlers.finishReveal(); handlers.onReveal(event);
    expect(cta).toHaveBeenCalledTimes(2);
    expect(plop).toHaveBeenCalledTimes(2);
  });
});
