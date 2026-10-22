import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';
const cache=new Map();let cues=[],clock=0,nextTimer=0,timers=new Map();
const record=(source,options={})=>{cues.push({source:decodeURIComponent(source.replace(/^\.\//,'')),voice:options.voiceId??`media-${cues.length}`,gain:options.volume??1,rate:options.playbackRate??1,delay:clock/1000+(options.startDelaySeconds??options.delaySeconds??0),stopAfter:options.stopAfterSeconds??null,fadeOut:options.fadeOutSeconds??0});return 'started';};
class Audio {constructor(source){this.src=source;this.volume=1;this.playbackRate=1;this.currentTime=0;}load(){}pause(){}play(){record(this.src,{volume:this.volume,playbackRate:this.playbackRate});return Promise.resolve();}addEventListener(){}removeEventListener(){}}
const schedule=(fn,delay=0)=>{const id=++nextTimer;timers.set(id,{fn,at:clock+delay});return id;};
const window={_settings:{gameSoundsEnabled:true},setTimeout:schedule,clearTimeout:id=>timers.delete(id),setInterval:()=>0,clearInterval:()=>{},addEventListener:()=>{},removeEventListener:()=>{},matchMedia:()=>({matches:true})};
const math=Object.create(Math);math.random=()=>0.37;
const player={getDecodedGameplaySoundsState:()=> 'ready',playDecodedGameplaySound:record,preloadDecodedGameplaySounds:()=>true,stopDecodedGameplayVoices:()=>{},stopDecodedGameplayVoice:()=>{},setDecodedGameplayVoiceVolume:()=>true,stopAllDecodedGameplaySounds:()=>{},acquireDecodedGameplayAudioPackage:()=>()=>{},preloadDecodedGameplayAudioPackage:()=>true};
function load(name){const filename=path.resolve(name).replace(/\.(js|ts)$/,'')+'.ts';if(cache.has(filename))return cache.get(filename);const exports={};cache.set(filename,exports);
 if(filename.endsWith('/gameplay-audio-buffer-player.ts'))return Object.assign(exports,player);
 if(filename.endsWith('/core/logger.ts'))return Object.assign(exports,{logger:new Proxy({},{get:()=>()=>{}})});
 if(filename.endsWith('/mobile-runtime-profile.ts'))return Object.assign(exports,{MOBILE_RUNTIME_PROFILE:{mobile:true,isMobile:true,coarsePointer:true}});
 if(filename.endsWith('/thermal-audio-isolation.ts'))return Object.assign(exports,{isThermalAudioIsolationEnabled:()=>false,isThermalSoundtrackIsolationEnabled:()=>false});
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const require=dep=>{if(!dep.startsWith('.'))throw Error(`Runtime dependency ${dep} in ${filename}`);return load(path.resolve(path.dirname(filename),dep));};
 vm.runInNewContext(`(function(exports,require,module){${code}\n})`,{Math:math,console,Date:{now:()=>clock},performance:{now:()=>clock},window,document:{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}},navigator:{userAgent:'iPhone'},Audio,setTimeout:schedule,clearTimeout:window.clearTimeout,requestAnimationFrame:fn=>schedule(fn,16),cancelAnimationFrame:window.clearTimeout,devicePixelRatio:1,Set,Map})(exports,require,{exports});return exports;}
const specs={
 pickup:['gameplay-pickup-sound','playGameplayPickupSound'],return:['gameplay-pickup-sound','playGameplayReturnSound'],stack:['ordinary-stack-sound','playOrdinaryStackSound'],regular6:['regular-merge6-sound','playRegularMerge6Sound'],foundation:['regular-merge6-sound','playSpecialMerge6FoundationSound'],star:['wild-star-merge6-sound','playWildStarMerge6Sound'],fish:['fish-merge6-sound','playFishMerge6Sound'],ball:['beach-ball-merge6-sound','playBeachBallMerge6Sound'],tnt:['core-tnt-merge6-sound','playCoreTntMerge6Sound'],barrel:['barrel-merge6-sound','playBarrelMerge6Sound'],flower:['flower-merge6-sound','playFlowerMerge6Sound'],bee:['bee-merge6-sound','playBeeMerge6Sound'],kanta:['kanta-merge6-sound','playKantaMerge6Sounds'],laser:['laser-gun-merge6-sound','playLaserGunMerge6AddonSounds'],spaceship:['spaceship-merge6-sound','playSpaceshipMerge6AddonSounds'],robo:['robo-cube-merge6-sound','playRoboCubeMerge6Sounds'],magnet:['magnet-pull-force-sound','playMagnetArchetypeMerge6Sound'],honey:['honey-merge6-sound','playHoneyFirstMergeSounds'],poof:['wild-special-merge6-poof-sound','playWildSpecialMerge6PoofSounds'],landing:['wild-special-landing-sound','playWildSpecialLandingSound'],
 cta:['cta-activation-sound','playCtaActivationSounds'],cardTap:['cta-activation-sound','playCardTapPlopSound'],tab:['navigation-icon-sound','playNavigationIconSounds'],back:['navigation-close-sound','playNavigationCloseSound'],swipe:['homepage-slider-swipe-sound','playHomepageSliderSwipeSound'],noMoves:['no-moves-sound','playNoMovesSound'],exitModal:['gameplay-exit-modal-enter-sound','playGameplayExitModalEnterSound'],backpack:['journey-backpack-sound','playJourneyBackpackSounds'],crate:['arcade-crate-sound','playArcadeCrateSounds'],flip:['journey-card-entry-flip-sound','playJourneyCardEntryFlipSounds'],manualFlip:['journey-card-entry-flip-sound','playJourneyCardManualFlipSound'],returnFlip:['journey-card-entry-flip-sound','playJourneyCardReturnFlipSounds'],
 beeFinale:['bee-merge6-sound','playBeeMerge6FinaleSounds'],flowerLeaves:['flower-merge6-sound','playFlowerMerge6LeavesSound'],flowerSpark:['flower-merge6-sound','playFlowerMerge6SparkSound'],barrelSmoke:['barrel-merge6-sound','playBarrelSmokePoofSound'],honeyPull:['honey-merge6-sound','playHoneyPullMergeSounds'],honeyPost:['honey-merge6-sound','playHoneyPostMergeSounds'],bottlePull:['bottle-pull-merge-sound','playBottlePullMergeSounds'],magnetPull:['magnet-pull-force-sound','playMagnetPullForceSounds'],honeyForce:['magnet-pull-force-sound','playMagnetPullForceSounds','honey'],bottleForce:['magnet-pull-force-sound','playMagnetPullForceSounds','bottle'],spaceshipStart:['spaceship-merge6-sound','playSpaceshipFinaleStartSounds'],spaceshipBeam:['spaceship-merge6-sound','playSpaceshipBeamStartSounds'],spaceshipExit:['spaceship-merge6-sound','playSpaceshipExitSound'],
 cleanApplause:['clean-board-sound','playCleanBoardApplauseSound'],cleanSax:['clean-board-sound','playCleanBoardSaxophoneHappySound'],cleanCount:['clean-board-sound','playCleanBoardMoneyCountSound',2],cleanBonus:['clean-board-sound','playCleanBoardBonusCountSound',2],failSax:['fail-screen-sound','playFailScreenSaxophoneSound'],arcadeVictory:['arcade-stage-clear-sound','playArcadeStageClearCelebrationSounds'],arcadeThumb:['arcade-stage-clear-sound','playArcadeStageClearThumbWhooshSound'],boardEnter:['board-popin-sound','playBoardPopInSound',0.6],boardExit:['board-popin-sound','playBoardPopInSound',0.6,'exit'],area55Start:['board-transition-area55-sound','playBoardTransitionArea55StartSounds']
};
for(const cue of ['bubble','introBubble','straw','lid','cup'])specs['juice-'+cue]=['juice-finale-sound','playJuiceFinaleSound',cue];
for(const cue of ['water-waves','bottle1','bottle2','cling','cling2','bublesi'])specs['bottle-'+cue]=['bottle-finale-sound','playBottleFinaleSound',cue];
for(let i=0;i<4;i++){specs['cleanStar'+i]=['clean-board-sound','playCleanBoardEarnedStarSound',i,`./assets/sound/Clean board/harp${Math.min(i,2)+1}.wav`];specs['tntImpact'+i]=['core-tnt-merge6-sound','playCoreTntBonusImpactSound',i];specs['laserImpact'+i]=['laser-gun-merge6-sound','playLaserGunChangedCubeSound',i];}
for(let i=0;i<2;i++){specs['cleanCTA'+i]=['clean-board-sound','playCleanBoardCtaBounceSound',i];specs['failCTA'+i]=['fail-screen-sound','playFailScreenCtaBounceSound',i];specs['digit'+i]=['arcade-round-digit-sound','playArcadeRoundDigitSound',i];}
delete specs.cleanStar3;
for(let i=0;i<4;i++)specs['star'+i]=['wild-star-merge6-sound','playWildStarMerge6Sound'];
for(let i=0;i<3;i++)specs['kantaExit'+i]=['kanta-merge6-sound','@createKantaExitSoundSequence.play','exit'];
specs.kantaWalking=['kanta-merge6-sound','@createKantaExitSoundSequence.startWalking'];
for(const moment of ['Intro','Crumble','Reveal','Happy'])specs['newCard'+moment]=['journey-new-card-sound','@createJourneyNewCardSoundSession.play'+moment];
specs.homeEnter=['homepage-slider-motion-sound','playHomepageSliderEnterSound',0.65];specs.homeExit=['homepage-slider-motion-sound','playHomepageSliderExitSound',0.65];specs.hubExit=['journey-hub-exit-sound','@createJourneyHubExitSoundSession.play'];
specs.forestTransition=['board-transition-forest-ambient-sound','playBoardTransitionForestAmbientSound'];
specs.laserPreparation=['laser-gun-merge6-sound','playLaserGunStagePreparationSound',0];specs.laserBeam=['laser-gun-merge6-sound','playLaserGunBeamSound',0];
for(let i=0;i<2;i++)specs['transitionDigit'+i]=['arcade-round-digit-sound','playBoardTransitionDigitSound',i];
specs.transitionDigitExit=['arcade-round-digit-sound','playBoardTransitionExitSound'];
for(let i=1;i<=2;i++)specs['transitionBeam'+i]=['board-transition-area55-sound','playBoardTransitionArea55BeamSound',i];
const catalog={},failures=[];
function flush(){let n=0;while(timers.size&&n++<100){const [id,next]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(next.at>15000)break;timers.delete(id);clock=next.at;next.fn(clock);}}
function capture(key,action){cues=[];clock=0;timers.clear();action();flush();catalog[key]=cues;}

for(const [key,[name,fn,...args]]of Object.entries(specs)){cues=[];clock=0;timers.clear();try {const owner=load(`src/modules/${name}.ts`);math.random=()=>/^star[0-3]$/.test(key)?Number(key.slice(-1))*0.25+0.01:/^kantaExit/.test(key)?Number(key.slice(-1))/3+0.01:0.37;if(fn.startsWith('@')){const [factory,method]=fn.slice(1).split('.');owner[factory]()[method](...args);}else{if(typeof owner[fn]!=='function')throw Error(`No ${fn}`);owner[fn](...args);}let n=0;while(timers.size&&n++<100){const [id,next]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(next.at>15000)break;timers.delete(id);clock=next.at;next.fn(clock);}cues.forEach((c,i)=>{if(c.voice.startsWith('media-'))c.voice=key+'-media-'+i;});catalog[key]=cues;if(!cues.length)failures.push(`${key}: no playback`);}catch(e){failures.push(`${key}: ${e.message}`);}}
// Execute every Fisher-Yates swap combination, preserving the real owner's per-slot mix.
const tntOwner=load('src/modules/core-tnt-merge6-sound.ts');
for(let a=0;a<5;a++)for(let b=0;b<4;b++)for(let c=0;c<3;c++)for(let d=0;d<2;d++) {
 const order=[0,1,2,3,4],swaps=[a,b,c,d];let pos=0;
 for(let index=4;index>0;index--){const swap=swaps[4-index];[order[index],order[swap]]=[order[swap],order[index]];}
 math.random=()=> (swaps[pos]+0.1)/(5-pos++);tntOwner.beginCoreTntBonusImpactSoundSequence();
 for(let index=0;index<4;index++)capture(`tntImpact-${index}-${order[index]}`,()=>tntOwner.playCoreTntBonusImpactSound(index));
}
const cleanOwner=load('src/modules/clean-board-sound.ts');
for(let index=0;index<3;index++)for(let harp=0;harp<3;harp++)capture(`cleanStar-${index}-${harp}`,()=>cleanOwner.playCleanBoardEarnedStarSound(index,`./assets/sound/Clean board/harp${harp+1}.wav`));
const kantaOwner=load('src/modules/kanta-merge6-sound.ts');
for(let choice=0;choice<3;choice++)for(let loud=0;loud<2;loud++){let pos=0;capture(`kantaExit-${choice}-${loud}`,()=>kantaOwner.createKantaExitSoundSequence(()=>pos++===0 ? (choice+0.1)/3 : loud ? 0.75:0.25).play('exit'));}
// Native user-approved replacement; preserved web cue remains a separate product.
catalog.noMoves=[{source:'assets/sound/fail board/wah wah.wav',voice:'no-moves-wah-wah',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Native shared Back/Close package: user approved splat only; preserve its existing mix.
catalog.cta=catalog.cta.filter(c=>c.voice==='cta-activation-splat');
// Native Back/Close selection; same bounded shared transport and existing gain.
catalog.back=[{source:'assets/sound/UI /tap effect back i close.wav',voice:'native-navigation-back-close',gain:0.3,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Current Native Card Unlocked mix; preserve PWA sources and original assets.
catalog.newCardHappy=[];
catalog.newCardUnlockedEnter=[{source:'assets/sound/card reveal/max poof.wav',voice:'journey-new-card-enter-0',gain:0.23184,rate:1,delay:0,stopAfter:null,fadeOut:0}];
catalog.newCardOpeningPuff=[{source:'assets/sound/card reveal/puf.wav',voice:'journey-new-card-opening-puff',gain:0.2898,rate:1,delay:0,stopAfter:null,fadeOut:0}];
for(const group of ['newCardIntro','newCardCrumble'])catalog[group]=catalog[group].map(c=>({...c,gain:0.2898}));
catalog.newCardReveal=catalog.newCardReveal.map(c=>({...c,source:'assets/sound/card reveal/new reward.wav',gain:0.2484}));
catalog.newCardReveal.push({source:'assets/sound/card reveal/card reveal.wav',voice:'journey-new-card-reveal-layer',gain:0.4968,rate:1,delay:0,stopAfter:null,fadeOut:0});
// Native user-requested shared modal air layer borrows the exact Journey card
// menu-flip source; existing card entry/return already contain it (no duplicate).
catalog.modalWhoosh=[{source:'assets/sound/cjelina flip/menu flip.wav',voice:'native-modal-whoosh',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
for(let i=0;i<3;i++)catalog['homeCharacter'+i]=[
 {source:'assets/sound/logo transitions/smile.wav',voice:'native-home-human',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0},
 {source:`assets/sound/logo transitions/nala${i+1}.wav`,voice:'native-home-nala',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}
];
// Home human speech variants; originals and Nala layers remain independent.
for(const name of ['lets-go','come-here-look-at-this','ready-for-an-adventure'])catalog['homeSpeech-'+name]=[
 {source:`assets/sound/SPEECH/${name}.wav`,voice:'native-home-human',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}
];
// Native Baloon finale: exact original sources, shared finite transport envelope.
catalog.baloonMerge=[
 {source:'assets/sound/Wild and special kockice/ baloon/happy people.wav',voice:'native-baloon-happy-people',gain:0.546,rate:1,delay:0,stopAfter:null,fadeOut:0},
 {source:'assets/sound/Wild and special kockice/ baloon/baloni zvuk.wav',voice:'native-baloon-flight-1',gain:0.72,rate:1,delay:1,stopAfter:null,fadeOut:0}
];
catalog.baloonStart=[
 {source:'assets/sound/Wild and special kockice/ baloon/prvi swosh.wav',voice:'native-baloon-swoosh',gain:0.6,rate:1,delay:0,stopAfter:null,fadeOut:0},
 {source:'assets/sound/Wild and special kockice/ baloon/prvi pop.wav',voice:'native-baloon-pop',gain:0.6,rate:1,delay:0,stopAfter:null,fadeOut:0},
 {source:'assets/sound/Wild and special kockice/ baloon/hiss.wav',voice:'native-baloon-hiss',gain:0.144,rate:1,delay:0,stopAfter:2.2,fadeOut:1.2},
 {source:'assets/sound/Wild and special kockice/ baloon/baloni.wav',voice:'native-baloon-flight-0',gain:0.18,rate:1,delay:0.3,stopAfter:null,fadeOut:0}
];
catalog['homeSpeech-treasure']=[{source:'assets/sound/SPEECH/treasure.mp3',voice:'native-home-human',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Settings entry speech belongs to the accepted Home image/CTA contact.
catalog.homeSettingsSpeech=[{source:'assets/sound/SPEECH/settings guy.mp3',voice:'native-home-settings-human',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// A captured Nala variant accompanies every Arcade island, one second later.
for(let i=0;i<3;i++)catalog['arcadeIslandDog'+i]=[
 {source:`assets/sound/logo transitions/nala${i+1}.wav`,voice:'native-arcade-island-dog',gain:0.42,rate:1,delay:1,stopAfter:null,fadeOut:0}
];
// Each accepted Arcade island tap owns one exact authored speech line.
for(const [id,file] of [['endurance','arcade-endurance'],['pureDice','arcade-lucky-drop'],['slowBurn','arcade-slow-burn']])catalog['arcade-island-'+id]=[
 {source:`assets/sound/SPEECH/${file}.wav`,voice:'native-arcade-island-speech',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}
];
// Slow Burn chooses one human line per accepted island contact.
catalog.arcadeSlowBurnTea=[{source:'assets/sound/SPEECH/my tea.mp3',voice:'native-arcade-island-speech',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Stage-clear thumb character layer is additional to the authored whoosh.
catalog.arcadeThumbSmile=[{source:'assets/sound/logo transitions/smile.wav',voice:'arcade-stage-clear-character',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
for(let i=0;i<3;i++)catalog['arcadeThumbDog'+i]=[
 {source:`assets/sound/logo transitions/nala${i+1}.wav`,voice:'arcade-stage-clear-character',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}
];
// One selected final-merge speech line retains its own natural laugh/tail.
for(const [i,name] of ["good-job", "youre-on-your-way", "great-job", "you-got-it", "yay", "congratulations", "great-work", "wow-that-was-amazing", "whoa-so-cool", "super-awesome"].entries())catalog['roundWon'+i]=[{source:`assets/sound/SPEECH/round won/${name}.wav`,voice:'native-round-won-speech',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Worlds Hub spoken pools: canonical IDs Forest1, Beach2, Area55/Space3.
for(const [world,names] of [[1, ["forest-camping", "forest-calling", "forest-snacks-packed", "forest-marshmallow"]], [3, ["space-adventure", "space-spaceship", "space-in-peace", "space-blue-goo"]], [2, ["beach-splash", "beach-no-plans", "beach-soggy-biscuit", "beach-adventure"]]])for(const [i,name] of names.entries())catalog[`worldSpeech-${world}-${i}`]=[{source:`assets/sound/SPEECH/world hub /${name}.wav`,voice:'native-world-hub-speech',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// User-added fifth Forest Hub line; keep supplied MP3 byte-exact.
catalog['worldSpeech-1-4']=[{source:'assets/sound/SPEECH/world hub /whats wit hthe bees.mp3',voice:'native-world-hub-speech',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Additional Settings and collection-icon human lines; existing original remains.
for(const [i,name] of ["settings-fix-fetch", "settings-best-helper"].entries())catalog['settingsSpeech'+i]=[{source:`assets/sound/SPEECH/${name}.wav`,voice:'native-home-settings-human',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
for(const [i,name] of ["collection-see-what-weve-got", "collection-little-look", "collection-what-in-here", "collection-every-adventure", "collection-packed-ready", "collection-goodies", "collection-little-helpers"].entries())catalog['collectionSpeech'+i]=[{source:`assets/sound/SPEECH/${name}.wav`,voice:'native-collection-icon-human',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Authored High Score/Combo modal speech, native-only non-repeating pools.
for(const name of ["high-score-01", "high-score-02", "high-score-03", "combo-01", "combo-02", "combo-03"])catalog[name]=[{source:`assets/sound/SPEECH/${name}.wav`,voice:'native-score-combo-human',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Arcade Home CTA/hero share one authored non-repeating three-line pool.
for(const name of ['arcade-01','arcade-02','arcade-03'])catalog[name]=[{source:`assets/sound/SPEECH/${name}.wav`,voice:'native-arcade-home-human',gain:0.42,rate:1,delay:0,stopAfter:null,fadeOut:0}];
// Native human speech/voice: explicit 0.72 gain; Nala keeps its authored mix.
// Source classification also covers new spoken groups without touching music/SFX.
for(const list of Object.values(catalog))for(const cue of list) {
 if(cue.source.includes('/SPEECH/') || /\/logo transitions\/(smile)\.wav$/.test(cue.source))cue.gain=0.72;
}
fs.writeFileSync('native/gameplay-state/NativeAudioCatalog.json',JSON.stringify({source:'canonical TS cue owner execution; captured original decoded/media transport only',catalog},null,2));
const swift='// Generated by native/gameplay-state/export-audio-catalog.mjs from canonical cue owners.\nimport Foundation\n\n@MainActor\nenum NativeAuthoredAudioCatalog {\n    static let groups: [String: [NativeAudioCue]] = [\n'+Object.entries(catalog).map(([key,list])=>'        '+JSON.stringify(key)+': [\n'+list.map(c=>'            NativeAudioCue(source:'+JSON.stringify(c.source)+',voice:'+JSON.stringify(c.voice)+',gain:'+c.gain+',rate:'+c.rate+',delay:'+c.delay+',stopAfter:'+(c.stopAfter??'nil')+',fadeOut:'+c.fadeOut+'),').join('\n')+'\n        ],').join('\n')+'\n    ]\n}\n';fs.writeFileSync('native/gameplay-app/NativeAuthoredAudioCatalog.swift',swift);
console.log(`${Object.keys(catalog).length} cue groups; ${Object.values(catalog).flat().length} layers`);console.log(failures.join('\n'));
