import UIKit
import AVFAudio
import StackToSixGameplay

struct NativeAudioCue:Equatable {
    let source:String
    let voice:String
    let gain:Double
    let rate:Double
    let delay:Double
    let stopAfter:Double?
    let fadeOut:Double
    let looping:Bool
    init(source:String,voice:String,gain:Double,rate:Double=1,delay:Double=0,stopAfter:Double?=nil,fadeOut:Double=0,looping:Bool=false) {
        self.source=source;self.voice=voice;self.gain=gain;self.rate=rate;self.delay=delay;self.stopAfter=stopAfter;self.fadeOut=fadeOut;self.looping=looping
    }
}
enum NativeAudioCompletion:Equatable {case ended,stopped,unavailable}
/// An actual skipped pull cue owns known silence; a failed voice capture is unavailable.
enum NativeMagnetPullCleanup {case silence,voice(()->Void)}

@MainActor
protocol NativeGameplayAudioTransport:AnyObject {
    func play(_ cue:NativeAudioCue)
    func play(_ cue:NativeAudioCue,onFinished:@escaping (NativeAudioCompletion)->Void)
    func captureFade(_ ids:Set<String>)->((Double)->Void)?
    func stopVoices(_ ids:Set<String>)
    func stopAll()
    func dispose()
    func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool
    func setSelectedPreparationEnabled(_ enabled:Bool)
    func setSelectedPreparationForeground(_ foreground:Bool)
    func prepareCoconutContacts()
}

extension NativeGameplayAudioTransport {
    func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool {false}
    func setSelectedPreparationEnabled(_ enabled:Bool) {}
    func setSelectedPreparationForeground(_ foreground:Bool) {}
    func prepareCoconutContacts() {}
    func stopVoices(_ ids:Set<String>) {stopAll()}
    func captureFade(_ ids:Set<String>)->((Double)->Void)? {nil}
    // An injected transport without lifecycle support must release the hook as
    // unavailable rather than invent an end time from a visual animation.
    func play(_ cue:NativeAudioCue,onFinished:@escaping (NativeAudioCompletion)->Void){play(cue);onFinished(.unavailable)}
}

/// Semantic audio owner for the Native route. No gesture callbacks select generic
/// replacements for authored special families; visual moments request their own cue.
@MainActor
final class NativeGameplayAudioOwner {
    private let transport:any NativeGameplayAudioTransport
    private let rewardTailFactory:()->any NativeGameplayAudioTransport
    private let navigationSpeechFactory:()->any NativeGameplayAudioTransport
    private var navigationHumanVoices:Set<String>=[]
    private var previousSpeechSelections:[String:Int]=[:]
    private var navigationSpeech:(id:UUID,transport:any NativeGameplayAudioTransport)?
    var activeNavigationSpeechCount:Int {navigationSpeech == nil ? 0:1}
    private let worldTailFactory:()->any NativeGameplayAudioTransport
    private var worldTail:(id:UUID,transport:any NativeGameplayAudioTransport)?
    var activeWorldTailCount:Int {worldTail == nil ? 0:1}
    private let roundWonTailFactory:()->any NativeGameplayAudioTransport
    private var roundWonTail:(id:UUID,transport:any NativeGameplayAudioTransport)?
    var activeRoundWonTailCount:Int {roundWonTail == nil ? 0:1}
    private let arcadeTailFactory:()->any NativeGameplayAudioTransport
    private var arcadeTail:(id:UUID,transport:any NativeGameplayAudioTransport)?
    var activeArcadeTailCount:Int {arcadeTail == nil ? 0:1}
    private var rewardTail:(id:UUID,transport:any NativeGameplayAudioTransport)?
    var activeRewardTailCount:Int {rewardTail == nil ? 0:1}
    private let random:()->Double
    private var enabled:Bool
    private var foreground=true
    private var interrupted=false
    private var disposed=false
    private(set) var generation:UInt64=1
    private var receipts:[String:UInt64]=[:]
    private var tntOrder=[0,1,2,3,4],harpOrder=[0,1,2],previousHarpOrder:[Int]?
    private var kantaSequence:UInt64=0,kantaWalkingVoice:String?
    private var meterCarrierSequence:UInt64=0
    private var meterCarrierVoices:[String:Set<String>]=[:]
    private var transitionSequence:UInt64=0
    private var transitionVoices:Set<String>=[]
    private var transitionDigitVoices:Set<String>=[]
    private var harpSequenceReady=false
    private var sourceBoardEntryOwner:UUID?
    private var bottleBoardWarmupCapture:String?
    private static let bottleGlassVoice="bottle-pull-merge-glass-crack"
    private var coconutLoopVoices:Set<String>=[]
    private var ordinarySixContact:String?
    private var magnetPullSilentGeneration:UInt64?
    private var magnetPullStopCapture:(generation:UInt64,receipt:UInt64,stop:()->Void)?
    private var observers:[NSObjectProtocol]=[]
    init(root:URL,enabled:Bool,transport:(any NativeGameplayAudioTransport)?=nil,rewardTailFactory:(()->any NativeGameplayAudioTransport)?=nil,arcadeTailFactory:(()->any NativeGameplayAudioTransport)?=nil,roundWonTailFactory:(()->any NativeGameplayAudioTransport)?=nil,worldTailFactory:(()->any NativeGameplayAudioTransport)?=nil,navigationSpeechFactory:(()->any NativeGameplayAudioTransport)?=nil,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        self.transport=transport ?? NativeAVGameplayAudioTransport(root:root);self.enabled=enabled;self.random=random
        self.navigationSpeechFactory=navigationSpeechFactory ?? {NativeAVGameplayAudioTransport(root:root)}
        self.worldTailFactory=worldTailFactory ?? {NativeAVGameplayAudioTransport(root:root)}
        self.roundWonTailFactory=roundWonTailFactory ?? {NativeAVGameplayAudioTransport(root:root)}
        self.arcadeTailFactory=arcadeTailFactory ?? {NativeAVGameplayAudioTransport(root:root)}
        self.rewardTailFactory=rewardTailFactory ?? {NativeAVGameplayAudioTransport(root:root)}
        self.transport.setSelectedPreparationEnabled(enabled)
        for name in [UIApplication.willResignActiveNotification,UIApplication.didBecomeActiveNotification,AVAudioSession.interruptionNotification,AVAudioSession.mediaServicesWereResetNotification] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) { [weak self] notice in
                // Copy scalar receipt data before crossing executor isolation.
                let name=notice.name.rawValue
                let interruption=notice.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
                MainActor.assumeIsolated{self?.notification(name:name,interruption:interruption)}
             })
        }
    }
    func beginGeneration(_ value:UInt64) {
        guard !disposed,value != generation else{return}
        bottleBoardWarmupCapture=nil;sourceBoardEntryOwner=nil;magnetPullStopCapture=nil;magnetPullSilentGeneration=nil;transport.stopAll();coconutLoopVoices.removeAll();generation=value;meterCarrierVoices.removeAll();receipts.removeAll();harpSequenceReady=false;ordinarySixContact=nil;transitionVoices.removeAll();transitionDigitVoices.removeAll()
    }
    func setEnabled(_ value:Bool) {guard !disposed else{return};enabled=value;transport.setSelectedPreparationEnabled(value);if !value {finishRewardTail();finishArcadeTail();finishRoundWonTail();finishWorldTail();finishNavigationSpeech();bottleBoardWarmupCapture=nil;sourceBoardEntryOwner=nil;magnetPullStopCapture=nil;magnetPullSilentGeneration=nil;transport.stopAll();coconutLoopVoices.removeAll()}}
    func setForeground(_ value:Bool) {guard !disposed else{return};foreground=value;transport.setSelectedPreparationForeground(value && !interrupted);if !value {finishRewardTail();finishArcadeTail();finishRoundWonTail();finishWorldTail();finishNavigationSpeech();bottleBoardWarmupCapture=nil;sourceBoardEntryOwner=nil;magnetPullStopCapture=nil;magnetPullSilentGeneration=nil;transport.stopAll();coconutLoopVoices.removeAll()}}
    /// Called only for the actually-created committed meter tile after Source's
    /// open/token recheck. Preparation never plays or substitutes a generic cue.
    func prepareSelectedSpecial(special:String,variant:String?,capture:String,generation:UInt64)->Bool {
        guard !disposed,enabled,foreground,!interrupted,generation==self.generation,
              let sources=NativeMeterSelectedAudioCatalog.sources(special:special,variant:variant) else{return false}
        return transport.prepareSelectedSources(sources,capture:capture,generation:generation)
    }

    /// Only an actually present Bottle borrows the existing selected SFX cache.
    /// No scheduler, playback or future-family preparation is admitted here.
    func prepareBottleOnBoard(_ state:NativeBoardState) {
        guard !disposed,state.generation==generation else{return}
        let ids=state.tiles.filter{$0.variant=="bottle"}.map(\.id).sorted()
        guard !ids.isEmpty else{bottleBoardWarmupCapture=nil;return}
        prepareBottleGlass(capture:"bottle-board-\(generation)-\(ids.joined(separator:","))")
    }
    private func prepareBottleGlass(capture:String) {
        guard !disposed,enabled,foreground,!interrupted,bottleBoardWarmupCapture != capture,
              let cue=NativeAuthoredAudioCatalog.groups["bottlePull"]?.first(where:{$0.voice==Self.bottleGlassVoice}) else{return}
        if transport.prepareSelectedSources([cue.source],capture:capture,generation:generation) {bottleBoardWarmupCapture=capture}
    }

    private func admit(_ category:String,receipt:UInt64,generation:UInt64)->Bool {
        guard !disposed,generation==self.generation,receipt>0,receipt>(receipts[category] ?? 0) else{return false}
        receipts[category]=receipt // OFF consumes the contact; ON never replays it.
        return enabled && foreground && !interrupted
    }
    func studioIntro(character:String,receipt:UInt64,generation:UInt64) {
        guard admit("studio-intro",receipt:receipt,generation:generation) else{return}
        let selections:[String:[String]]=["lik-gitara":["guitar1","guitar2"],"lik-laptop":["chair"],"lik-nogomet":["nogomet"],"lik-board":["kokcice"],"lik-slikanje":["camera"],"lik-cvijet":["watering"],"lik-pas-SVG":["nala1","nala2","nala3"],"lik-speceraj":["paperbag"]]
        func cue(_ key:String,_ gain:Double=0.42,_ delay:Double=0){transport.play(NativeAudioCue(source:"assets/sound/logo transitions/\(key).wav",voice:"native-studio-\(key)",gain:gain,delay:delay))}
        if ["lik-speceraj","lik-game","lik-pas-SVG","pas-novine","lik-laptop"].contains(character){cue("smile",0.882)}
        if ["lik-pas-SVG","pas-novine","lik-speceraj"].contains(character){cue(["nala1","nala2","nala3"].randomElement()!)}
        if character == "lik-game" {cue("gamer",0.6);cue("gemer2");return}
        if character == "lik-kauc" {cue("sleepy2",0.336);cue("sleepy1",0.336,1.44);return}
        if character != "lik-pas-SVG",let choice=selections[character]?.randomElement(){cue(choice)}
    }

    func onGameplayEvent(_ event:NativeGameplayEvent,source:NativeTile?=nil,destination:NativeTile?=nil,generation:UInt64,receipt:UInt64) {
        guard !disposed,generation==self.generation,receipt>0,receipt>(receipts["gameplay"] ?? 0) else{return}
        let audible=admit("gameplay",receipt:receipt,generation:generation)
        if event.kind == .ordinarySixReserved {
            // Consume the authored contact even while sound is OFF. Enabling
            // sound during the80ms main commit cannot replay that contact.
            ordinarySixContact=event.reason
            if audible {play("regular6")};return
        }
        if event.kind == .merged,event.value==6,let contact=ordinarySixContact,event.reason==contact {
            ordinarySixContact=nil;return
        }
        guard audible else{return}
        switch event.kind {
        case .dragBegan:
            if source?.variant=="bottle" || destination?.variant=="bottle" {prepareBottleGlass(capture:"bottle-drag-\(generation)-\(source?.id ?? destination?.id ?? "current")")}
            play("pickup")
        case .dragCancelled:play("return")
        case .noMovesCandidate:break // NO MOVES sound belongs to its visible confirmed modal.
        case .merged:
            let sum=event.value ?? 0
            guard sum==6 else {if sum>0 {play("stack")};return}
            let tiles=[source,destination].compactMap{$0}
            let variants=Set(tiles.compactMap(\.variant)+(event.variant.map{[$0]} ?? []))
            let types=tiles.compactMap(\.archetype)+(event.archetype.map{[$0]} ?? [])
            if variants.isEmpty && types.isEmpty {play("regular6");return}
            play("poof")
            if variants.contains("baloon") {play("foundation");play("baloonMerge")}
            if variants.contains("bloob") {
                play("foundation")
                for cue in NativeBloobAudio.cues("merge"){transport.play(cue)}
                // A fresh receipt voice may outlive its visual finale and overlap
                // a later merge choosing the same source. Transport retires it at natural end.
                for cue in NativeBloobAudio.cues("bluub",index:pick(4)) {
                    transport.play(NativeAudioCue(source:cue.source,voice:"\(cue.voice)-g\(generation)-r\(receipt)",
                        gain:cue.gain,rate:cue.rate,delay:0,stopAfter:nil,fadeOut:0))
                }
            }
            if variants.contains("bloob-ball") {for cue in NativeBloobBallAudio.cues("merge"){transport.play(cue)}}
            if types.contains(.tnt) || !variants.isDisjoint(with:["flower","beach-ball","laser-gun","barell","bloob-ball"]) {tntOrder=shuffle([0,1,2,3,4])}
            if variants.isEmpty && types.contains(.star) {play("star\(pick(4))")}
            if variants.isEmpty && types.contains(.tnt) && tiles.filter({$0.archetype != nil}).count<=1 {play("tnt")}
            for (variant,group) in [("cubero","cubero"),("fish","fish"),("beach-ball","ball"),("barell","barrel"),("flower","flower"),("coconut","coconut"),("bee","bee"),("kite","kite"),("kanta","kanta"),("laser-gun","laser"),("spaceship","spaceship"),("robo-cube","robo")] where variants.contains(variant) {play(group)}
            if types.contains(.magnet) || !variants.isDisjoint(with:["bottle","honey","spaceship"]) {play("magnet")}
            if variants.contains("honey") {play("honey")}
        default:break // Spawn landing and special tails belong to visual contact owners.
        }
    }
    /// The route owner supplies exact semantic kind, never a raw pointer event.
    /// PRIVATE meter-carrier proposal: same authored family/transport, captured
    /// cleanup cannot stop a replacement or unrelated gameplay/CTA voice.
    func beginMeterCarrierAudio(arcade:Bool,id:String,receipt:UInt64,generation:UInt64)->(() -> Void) {
        guard meterCarrierVoices[id]==nil,admit("meter-carrier",receipt:receipt,generation:generation) else {return {}}
        meterCarrierSequence &+= 1
        let sequence=meterCarrierSequence,suffix="-meter-\(generation)-\(sequence)"
        let cues=NativeAuthoredAudioCatalog.groups[arcade ? "crate":"backpack"] ?? []
        let ids=Set(cues.map{$0.voice+suffix});meterCarrierVoices[id]=ids
        for cue in cues {
            transport.play(NativeAudioCue(source:cue.source,voice:cue.voice+suffix,gain:cue.gain,rate:cue.rate,
                delay:cue.delay,stopAfter:cue.stopAfter,fadeOut:cue.fadeOut))
        }
        var finished=false
        return { [weak self] in
            guard !finished else {return};finished=true
            guard let self,!self.disposed,self.generation==generation,
                  self.meterCarrierVoices[id]==ids else {return}
            self.meterCarrierVoices.removeValue(forKey:id);self.transport.stopVoices(ids)
        }
    }
    /// Called at the genuine Source sweetPopIn sound start. The supplied
    /// duration already includes the original maxEnd+.03 tail. No Math draw.
    func startSourceBoardEntrySound(duration:Double,receipt:UInt64,generation:UInt64)->(() -> Void)? {
        guard !disposed,generation==self.generation,receipt>0,
            receipt>(receipts["source-board-entry"] ?? 0),duration.isFinite,duration>=0 else{return nil}
        let audible=admit("source-board-entry",receipt:receipt,generation:generation)
        let id=UUID();sourceBoardEntryOwner=id
        let cues=NativeAuthoredAudioCatalog.groups["boardEnter"] ?? []
        let voices=Set(cues.map(\.voice))
        // Seal the old owner before transport callbacks can reenter.
        transport.stopVoices(voices)
        guard !disposed,self.generation==generation,sourceBoardEntryOwner==id else{return nil}
        if audible,duration>0 {
            for cue in cues {
                guard !disposed,self.generation==generation,sourceBoardEntryOwner==id,
                    enabled,foreground,!interrupted else{return nil}
                transport.play(NativeAudioCue(source:cue.source,voice:cue.voice,gain:cue.gain,rate:cue.rate,
                    delay:cue.delay,stopAfter:duration,fadeOut:min(0.05,duration)))
            }
        }
        guard !disposed,self.generation==generation,sourceBoardEntryOwner==id else{return nil}
        return { [weak self] in
            guard let self,!self.disposed,self.generation==generation,self.sourceBoardEntryOwner==id else{return}
            self.sourceBoardEntryOwner=nil
            self.transport.stopVoices(voices)
        }
    }
    func routeFeedback(_ kind:String,receipt:UInt64,generation:UInt64,duration:Double?=nil) {
        guard admit("route",receipt:receipt,generation:generation) else{return}
        if kind == "high-score-modal-speech" || kind == "combo-modal-speech" {
            startScoreModalSpeech(combo:kind == "combo-modal-speech");return
        }
        if let world=["world-hub-forest":1,"world-hub-space":3,"world-hub-beach":2][kind] {
            startWorldTail(world:world);return
        }
        if ["arcade-island-endurance","arcade-island-pureDice","arcade-island-slowBurn"].contains(kind) {
            let speech=kind == "arcade-island-slowBurn" && pick(2) == 1 ? "arcadeSlowBurnTea":kind
            startArcadeTail(groups:[speech,"arcadeIslandDog\(pick(3))"]);return
        }
        if kind == "home-settings-character-tap" {
            startNavigationSpeech(group:["homeSettingsSpeech","settingsSpeech0","settingsSpeech1"][pick(3)]);return
        }
        if kind == "collection-icon-speech" {startNavigationSpeech(group:"collectionSpeech\(pick(7))");return}
        if kind == "home-arcade-character-tap" {
            let choice=chooseNonRepeatingSpeech("arcade-home")
            stopCharacterSpeechForReplacement()
            startNavigationSpeech(group:String(format:"arcade-%02d",choice+1))
            // Preserve Nala, excluding the retired smile/old human choice.
            let dog=(NativeAuthoredAudioCatalog.groups["homeCharacter\(pick(3))"] ?? []).filter{$0.voice != "native-home-human"}
            playNavigationCues(dog,receipt:receipt);return
        }
        if ["home-character-tap","home-journey-character-tap"].contains(kind) {
            // Select each character once for this committed contact. Speech replaces
            // only the human layer; Nala and finite natural-tail ownership stay intact.
            finishNavigationSpeech()
            var cues=NativeAuthoredAudioCatalog.groups["homeCharacter\(pick(3))"] ?? []
            let options=["smile","lets-go","come-here-look-at-this","treasure"]
            let human=kind == "home-character-tap" ? "smile" : options[pick(options.count)]
            if human != "smile",let speech=NativeAuthoredAudioCatalog.groups["homeSpeech-"+human]?.first {
                cues.removeAll{$0.voice == "native-home-human"};cues.insert(speech,at:0)
            }
            playNavigationCues(cues,receipt:receipt);return
        }
        if ["exit-modal","hud-modal-open","modal-open","modal-exit","modal-close"].contains(kind) {
            playNavigationLayer("modalWhoosh",receipt:receipt)
        }
        if kind == "modal-close" {play("back");return}
        // Native CTA retains Home icon audio; all Back/Close contacts share their selected cue.
        let mapping=["cta":"tab","card-tap":"cardTap","tab":"tab","hud-icon-tap":"tab","back":"back","close":"back","swipe":"swipe","exit-modal":"exitModal","card-flip":"flip","card-entry-flip":"flip","card-manual-flip":"manualFlip","card-return-flip":"returnFlip","manual-flip":"manualFlip","return-flip":"returnFlip","home-enter":"homeEnter","home-exit":"homeExit","hub-exit":"hubExit","board-enter":"boardEnter","board-exit":"boardExit","backpack":"backpack","crate":"crate","area55-start":"area55Start","forest-transition":"forestTransition"]
        if let group=mapping[kind] {if group=="boardEnter" || group=="boardExit" {sourceBoardEntryOwner=nil};play(group,duration:duration)}
    }
    /// Independent finite voices retain natural tails across accepted contacts;
    /// the existing transport still enforces its32-voice and Settings budgets.
    private func playNavigationLayer(_ group:String,receipt:UInt64) {
        playNavigationCues(NativeAuthoredAudioCatalog.groups[group] ?? [],receipt:receipt)
    }
    private func playNavigationCues(_ cues:[NativeAudioCue],receipt:UInt64) {
        for cue in cues {
            let delivered=NativeAudioCue(source:cue.source,voice:"\(cue.voice)-\(generation)-\(receipt)",
                gain:cue.gain,rate:cue.rate,delay:cue.delay,stopAfter:cue.stopAfter,fadeOut:cue.fadeOut)
            if cue.voice == "native-home-human" {
                navigationHumanVoices.insert(delivered.voice)
                transport.play(delivered){[weak self] _ in self?.navigationHumanVoices.remove(delivered.voice)}
            }else{transport.play(delivered)}
        }
    }
    private func stopNavigationHumanVoices() {
        let ids=navigationHumanVoices;navigationHumanVoices.removeAll()
        if !ids.isEmpty {transport.stopVoices(ids)}
    }
    /// Board Transition has its own voice identities and contact receipts. The
    /// first digit's exit accent is authored at ENTER, independently of Arcade.
    func transitionMoment(_ kind:String,index:Int=0,receipt:UInt64,generation:UInt64) {
        guard admit("transition",receipt:receipt,generation:generation) else{return}
        var groups:[String]=[]
        switch kind {
        case "forest-start":transitionSequence &+= 1;groups=["forestTransition"]
        case "area55-start":transitionSequence &+= 1;groups=["area55Start"]
        case "digit":
            guard (0...1).contains(index) else{return}
            groups=["transitionDigit\(index)"];if index==0 {groups.append("transitionDigitExit")}
        case "area55-beam":
            guard (1...2).contains(index) else{return}
            groups=["transitionBeam\(index)"]
        default:return
        }
        for group in groups {for cue in NativeAuthoredAudioCatalog.groups[group] ?? [] {
            // Canonical capture executes Area55 sequence one. Runtime retains
            // this transition's actual sequence instead of replacing its bed.
            let sequence=max(1,transitionSequence)
            let voice:String
            if group.hasPrefix("transitionBeam") {voice=cue.voice.replacingOccurrences(of:"-beam-\(index)-1-",with:"-beam-\(index)-\(sequence)-")}
            else if group=="area55Start",cue.voice.hasSuffix("-1") {voice=String(cue.voice.dropLast(2))+"-\(sequence)"}
            else {voice=cue.voice}
            let delivered=NativeAudioCue(source:cue.source,voice:voice,gain:cue.gain,rate:cue.rate,delay:cue.delay,stopAfter:cue.stopAfter,fadeOut:cue.fadeOut)
            transitionVoices.insert(voice);if group.hasPrefix("transitionDigit") {transitionDigitVoices.insert(voice)}
            transport.play(delivered)
        }}
    }
    /// Natural scene cleanup retires digits only; authored ambient/flyby tails
    /// finish. Route abort also cancels pending Area55 fly2 and all scoped beds.
    func finishTransition(generation:UInt64,aborted:Bool) {
        guard generation==self.generation,!disposed else{return}
        transport.stopVoices(aborted ? transitionVoices:transitionDigitVoices)
        transitionDigitVoices.removeAll();if aborted {transitionVoices.removeAll()}
    }
    /// Call at visual moments (not all together when the logical result commits).
    func resultMoment(_ kind:String,index:Int=0,receipt:UInt64,generation:UInt64,duration:Double?=nil,onFinished:(()->Void)?=nil) {
        guard admit("result",receipt:receipt,generation:generation) else{onFinished?();return}
        let group:String
        switch kind {
        case "clean-title-prepare":
            if let cue=NativeCleanBoardTitleVoice.cue(index:index) {
                _=transport.prepareSelectedSources([cue.source],capture:"clean-title-\(generation)-\(index)",generation:generation)
            }
            onFinished?();return
        case "clean-title":
            if let cue=NativeCleanBoardTitleVoice.cue(index:index) {transport.play(cue)}
            onFinished?();return
        case "no-moves":group="noMoves"
        case "clean-applause":beginHarpSequence();group="cleanApplause"
        case "clean-sax":group="cleanSax"
        case "clean-score-stop":
            transport.play(NativeAudioCue(source:"assets/sound/coins/final score.wav",voice:"clean-board-final-score",gain:0.84));onFinished?();return
        case "clean-count":group="cleanCount"
        case "clean-bonus":group="cleanBonus"
        case "clean-star":
            if !harpSequenceReady {beginHarpSequence()}
            let slot=max(0,min(2,index));group="cleanStar-\(slot)-\(harpOrder[slot])"
        case "clean-cta":group="cleanCTA\(max(0,min(1,index)))"
        case "fail-sax":group="failSax"
        case "fail-cta":group="failCTA\(max(0,min(1,index)))"
        case "arcade-victory":group="arcadeVictory"
        case "arcade-thumb":
            startArcadeTail(groups:[index == 1 ? "arcadeThumbDog\(pick(3))":"arcadeThumbSmile"])
            group="arcadeThumb"
        case "arcade-digit":group="digit\(max(0,min(1,index)))"
        case "new-card-opening-puff":group="newCardOpeningPuff"
        case "new-card-unlocked-enter":group="newCardUnlockedEnter"
        case "new-card-intro":group="newCardIntro"
        case "new-card-crumble":group="newCardCrumble"
        // Native reward presentation keeps its semantic moments, but these
        // happy cue is disabled; reveal uses the selected Native catalog source.
        case "new-card-reveal":startRewardTail();onFinished?();return
        case "new-card-happy":onFinished?();return
        default:onFinished?();return
        }
        let hookVoice=kind=="clean-sax" ? "clean-board-saxophone-happy" : kind=="fail-sax" ? "fail-screen-saxophone":nil
        play(group,duration:duration,rateScale:(kind=="clean-count" || kind=="clean-bonus") ? 1/NativeResultPresentationPlan.cleanCountingScale:1,completionVoice:hookVoice,onFinished:onFinished)
    }
    static func hudCoinGain(relativeSize:Double)->Double {
        let fraction=relativeSize.isFinite ? min(1,max(0,relativeSize)):0
        return 0.6*(1.05+0.20*fraction)
    }
    func specialMoment(variant:String,moment:String,index:Int=0,coinSizeFraction:Double=0,receipt:UInt64,generation:UInt64) {
        guard !disposed,generation==self.generation,receipt>0,receipt>(receipts["special"] ?? 0) else{return}
        let forcePull=moment=="pull" && ["magnet","honey","bottle","spaceship"].contains(variant)
        // A real current contact consumes any previous unclaimed capture even
        // while Sounds OFF. A stale/repeated A must leave C untouched.
        if forcePull {
            magnetPullStopCapture=nil;magnetPullSilentGeneration=nil
            if !enabled || !foreground || interrupted {magnetPullSilentGeneration=generation}
        }
        guard admit("special",receipt:receipt,generation:generation) else{return}
        if moment=="hud-star-arrived" {
            transport.play(NativeAudioCue(source:"assets/sound/coins/hud coin.wav",voice:"native-hud-coin-\(generation)-\(receipt)",gain:Self.hudCoinGain(relativeSize:coinSizeFraction)))
            return
        }
        if moment=="tnt-coin-launch" {
            transport.play(NativeAudioCue(source:"assets/sound/coins/tnt coin.wav",voice:"native-tnt-coin-\(generation)-\(receipt)",gain:0.12));return
        }
        if variant=="coconut" {
            if moment=="coconut-palm-shards" {
                transport.prepareCoconutContacts()
                let voice="coconut-loop-coconut shards";coconutLoopVoices.insert(voice)
                transport.stopVoices([voice])
                transport.play(NativeAudioCue(source:"assets/sound/Wild and special kockice/coconut/coconut shards.wav",voice:voice,gain:0.51,stopAfter:max(0.05,min(12,Double(index)/1000))+0.25,fadeOut:0.25,looping:true))
                return
            }
            if moment=="coconut-loop" {
                let seconds=max(0.05,min(12,Double(index)/1000))
                for name in ["coconut1","coconut2"] {
                    let voice="coconut-loop-\(name)";coconutLoopVoices.insert(voice)
                    transport.play(NativeAudioCue(source:"assets/sound/Wild and special kockice/coconut/\(name).wav",voice:voice,gain:0.30,stopAfter:seconds+0.25,fadeOut:0.25,looping:true))
                }
                return
            }
            if moment=="coconut-stop" {if !coconutLoopVoices.isEmpty {transport.stopVoices(coconutLoopVoices)};coconutLoopVoices.removeAll();return}
            if moment=="coconut-contact" {
                transport.play(NativeAudioCue(source:"assets/sound/mini explozije/mini2.mp3",voice:"coconut-contact-\(index)-mini2",gain:0.15))
                return
            }
        }
        if moment=="landing" {play("landing");return}
        if variant=="bloob" {for cue in NativeBloobAudio.cues(moment,index:index){transport.play(cue)};return}
        if variant=="bloob-ball" {
            let cues:[NativeAudioCue]
            if moment=="impact" {let slot=max(0,min(3,index));cues=NativeBloobBallAudio.barrelLayer("tntImpact-\(slot)-\(tntOrder[slot])")}
            else {cues=NativeBloobBallAudio.cues(moment,index:index)}
            for cue in cues {transport.play(cue)};return
        }
        let group:String?
        switch (variant,moment) {
        case ("baloon","start"):group="baloonStart"
        case ("juice",_),("mushroom",_):group="juice-\(moment)"
        case ("bottle","pull"):
            let cues=NativeAuthoredAudioCatalog.groups["bottlePull"] ?? []
            for cue in cues where cue.voice==Self.bottleGlassVoice {transport.play(cue)}
            playCapturedMagnetForce("bottleForce",receipt:receipt,generation:generation)
            for cue in cues where cue.voice != Self.bottleGlassVoice {transport.play(cue)}
            return
        case ("bottle",_):group="bottle-\(moment)"
        case ("honey","pull"):playCapturedMagnetForce("honeyForce",receipt:receipt,generation:generation);group="honeyPull"
        case ("honey","post"):group="honeyPost"
        case ("magnet","pull"),("spaceship","pull"):group="magnetPull"
        case ("bee","finale"):group="beeFinale"
        case ("coconut","leaves"),("flower","leaves"):group="flowerLeaves"
        case ("coconut","spark"),("flower","spark"):group="flowerSpark"
        case ("barell","smoke"):group="barrelSmoke"
        case ("coconut","impact"),("tnt","impact"),("flower","impact"),("beach-ball","impact"),("barell","impact"):
            let slot=max(0,min(3,index));group="tntImpact-\(slot)-\(tntOrder[slot])"
        case ("laser-gun","impact"):
            let slot=max(0,min(3,index));play("tntImpact-\(slot)-\(tntOrder[slot])")
            for cue in NativeAuthoredAudioCatalog.groups["laserImpact\(slot)"] ?? [] where !cue.voice.hasPrefix("core-tnt-bonus-impact-") {transport.play(cue)}
            return
        case ("laser-gun","prepare"),("laser-gun","beam"):
            guard index>=0 else{return}
            let selected=moment=="prepare" ? "laserPreparation":"laserBeam"
            for cue in NativeAuthoredAudioCatalog.groups[selected] ?? [] {
                let voice=cue.voice.replacingOccurrences(of:"-0",with:"-\(index)")
                transport.play(NativeAudioCue(source:cue.source,voice:voice,gain:cue.gain,rate:cue.rate,delay:cue.delay,stopAfter:cue.stopAfter,fadeOut:cue.fadeOut))
            }
            return
        case ("spaceship","start"):group="spaceshipStart"
        case ("spaceship","beam"):group="spaceshipBeam"
        case ("spaceship","exit"):group="spaceshipExit"
        case ("kanta","walking"):
            kantaSequence &+= 1;let voice="kanta-walking-\(kantaSequence)";kantaWalkingVoice=voice
            for cue in NativeAuthoredAudioCatalog.groups["kantaWalking"] ?? [] {transport.play(NativeAudioCue(source:cue.source,voice:voice,gain:cue.gain,rate:cue.rate,delay:cue.delay,stopAfter:cue.stopAfter,fadeOut:cue.fadeOut))}
            return
        case ("kanta","exit"):
            let choice=pick(3),loud=pick(2)
            play("kantaExit-\(choice)-\(loud)",voiceSuffix:"-contact-\(receipt)");return
        default:group=nil
        }
        if let group {
            if group=="magnetPull" {playCapturedMagnetForce(group,receipt:receipt,generation:generation)}
            else {play(group)}
        }
    }
    private func playCapturedMagnetForce(_ group:String,receipt:UInt64,generation:UInt64) {
        play(group)
        guard !disposed,self.generation==generation,receipts["special"]==receipt,enabled,foreground,!interrupted else{return}
        let ids=Set((NativeAuthoredAudioCatalog.groups[group] ?? []).map(\.voice))
        // Existing transport captures Voice object identity now. No ID lookup
        // later, no stopVoices fallback (its compatibility default is stopAll).
        let captured=transport.captureFade(ids)
        guard !disposed,self.generation==generation,receipts["special"]==receipt,enabled,foreground,!interrupted,
              let captured else{return}
        magnetPullStopCapture=(generation,receipt,{captured(1)})
    }
    /// Borrow immediately after this actual pull cue. Callback is cleanup, not
    /// a new cue. Old A cannot stop replacement C, even in the same generation.
    func captureMagnetPullStop(generation:UInt64)->(()->Void)? {
        guard !disposed,generation==self.generation,let captured=magnetPullStopCapture,
            captured.generation==generation else{return nil}
        magnetPullStopCapture=nil;magnetPullSilentGeneration=nil // unhook BEFORE any external stop callback
        var finished=false
        return {guard !finished else{return};finished=true;captured.stop()}
    }
    /// Called synchronously after the real pull moment. Missing playback or
    /// capture fails closed; intentional Settings/lifecycle suppression is typed.
    func captureMagnetPullCleanup(generation:UInt64)->NativeMagnetPullCleanup? {
        guard !disposed,generation==self.generation else{return nil}
        if let stop=captureMagnetPullStop(generation:generation) {return .voice(stop)}
        guard magnetPullSilentGeneration==generation else{return nil}
        magnetPullSilentGeneration=nil
        return .silence
    }
    /// Capture after this finale's first actual walking cue. Transport receipts
    /// retain identity so an old fade can never attenuate a replacement bibis.
    func captureSpecialFade(variant:String,generation:UInt64)->((Double)->Void)? {
        guard variant=="kanta",generation==self.generation,!disposed,enabled,foreground,!interrupted else{return nil}
        var ids:Set<String>=["kanta-merge6-bibis"];if let kantaWalkingVoice {ids.insert(kantaWalkingVoice)}
        guard let captured=transport.captureFade(ids) else{return nil}
        return { [weak self] progress in
            guard let self,!self.disposed,self.generation==generation,self.enabled,self.foreground,!self.interrupted,progress.isFinite else{return}
            captured(min(1,max(0,progress)))
        }
    }
    private func pick(_ count:Int)->Int {let roll=random();return min(count-1,max(0,Int((roll.isFinite ? min(1-Double.ulpOfOne,max(0,roll)) : 0)*Double(count))))}
    private func shuffle(_ input:[Int])->[Int] {var order=input;for index in stride(from:order.count-1,through:1,by:-1) {order.swapAt(index,pick(index+1))};return order}
    private func beginHarpSequence(){var order=shuffle([0,1,2]);if order==previousHarpOrder {order.append(order.removeFirst())};harpOrder=order;previousHarpOrder=order;harpSequenceReady=true}
    private func play(_ group:String,duration:Double?=nil,rateScale:Double=1,voiceSuffix:String="",completionVoice:String?=nil,onFinished:(()->Void)?=nil) {
        var completionAttached=false
        for cue in NativeAuthoredAudioCatalog.groups[group] ?? [] {
            let adjusted:NativeAudioCue
            if let duration,duration.isFinite,duration>0,cue.stopAfter != nil {
                adjusted=NativeAudioCue(source:cue.source,voice:cue.voice,gain:cue.gain,rate:cue.rate*rateScale,delay:cue.delay,stopAfter:duration,fadeOut:min(cue.fadeOut/rateScale,duration))
            } else {adjusted=cue}
            let delivered=voiceSuffix.isEmpty ? adjusted:NativeAudioCue(source:adjusted.source,voice:adjusted.voice+voiceSuffix,gain:adjusted.gain,rate:adjusted.rate,delay:adjusted.delay,stopAfter:adjusted.stopAfter,fadeOut:adjusted.fadeOut)
            if let onFinished,completionVoice==cue.voice {completionAttached=true;var finished=false;transport.play(delivered){_ in guard !finished else{return};finished=true;onFinished()}}else{transport.play(delivered)}
        }
        if !completionAttached {onFinished?()}
    }
    // One finite reveal tail survives card collection and route/generation changes.
    // Actual completion disposes its isolated selected-file transport and cache.
    private func startRewardTail() {
        let cues=NativeAuthoredAudioCatalog.groups["newCardReveal"] ?? []
        guard rewardTail == nil,!cues.isEmpty else{return}
        let id=UUID(),tail=rewardTailFactory();rewardTail=(id,tail)
        var pending=Set(cues.map(\.voice))
        for cue in cues {
            tail.play(cue){[weak self] _ in
                guard let self,self.rewardTail?.id==id,pending.remove(cue.voice) != nil else{return}
                if pending.isEmpty {self.finishRewardTail()}
            }
        }
    }

    /// Bounded independent histories for High Score, Combo and Arcade Home.
    /// Muted/rejected contacts never enter this selection path.
    private func chooseNonRepeatingSpeech(_ pool:String)->Int {
        let choice:Int
        if let previous=previousSpeechSelections[pool] {
            let draw=pick(2);choice=draw >= previous ? draw+1:draw
        }else{choice=pick(3)}
        previousSpeechSelections[pool]=choice
        return choice
    }
    private func stopCharacterSpeechForReplacement() {
        stopNavigationHumanVoices();finishWorldTail();finishArcadeTail();finishRoundWonTail()
    }
    private func startScoreModalSpeech(combo:Bool) {
        let pool=combo ? "combo":"high-score"
        let choice=chooseNonRepeatingSpeech(pool)
        stopCharacterSpeechForReplacement()
        startNavigationSpeech(group:String(format:"%@-%02d",pool,choice+1))
    }

    /// One selected Settings/collection human line owns its natural navigation
    /// tail. Replacement is bounded; route/generation changes never replay it.
    private func startNavigationSpeech(group:String) {
        finishNavigationSpeech()
        guard let cue=NativeAuthoredAudioCatalog.groups[group]?.first else{return}
        let id=UUID(),tail=navigationSpeechFactory();navigationSpeech=(id,tail)
        tail.play(cue){[weak self] _ in
            guard let self,self.navigationSpeech?.id==id else{return}
            self.finishNavigationSpeech()
        }
    }
    private func finishNavigationSpeech() {
        let old=navigationSpeech;navigationSpeech=nil
        old?.transport.dispose()
    }

    /// Only the accepted Worlds Hub tap selects a line. Its selected-file
    /// transport retains a finite natural tail through World/Play navigation.
    private func startWorldTail(world:Int) {
        finishNavigationSpeech();finishWorldTail()
        let count=world == 1 ? 5:4
        guard let cue=NativeAuthoredAudioCatalog.groups["worldSpeech-\(world)-\(pick(count))"]?.first else{return}
        let id=UUID(),tail=worldTailFactory();worldTail=(id,tail)
        tail.play(cue){[weak self] _ in
            guard let self,self.worldTail?.id==id else{return}
            self.finishWorldTail()
        }
    }
    private func finishWorldTail() {
        let old=worldTail;worldTail=nil
        old?.transport.dispose()
    }

    /// Confirmed complete board, before board exit/result admission. Receipts are
    /// consumed while muted; a result generation never replays the selection.
    func roundWon(receipt:UInt64,generation:UInt64) {
        guard admit("round-won",receipt:receipt,generation:generation) else{return}
        finishNavigationSpeech();finishRoundWonTail()
        guard let cue=NativeAuthoredAudioCatalog.groups["roundWon\(pick(10))"]?.first else{return}
        let id=UUID(),tail=roundWonTailFactory();roundWonTail=(id,tail)
        tail.play(cue){[weak self] _ in
            guard let self,self.roundWonTail?.id==id else{return}
            self.finishRoundWonTail()
        }
    }
    private func finishRoundWonTail() {
        let old=roundWonTail;roundWonTail=nil
        old?.transport.dispose()
    }

    // One selected Arcade character package survives Play/Continue and stage generations.
    // A new character contact replaces it; actual completion releases players/cache.
    private func startArcadeTail(groups:[String]) {
        finishNavigationSpeech();finishArcadeTail()
        let cues=groups.flatMap {NativeAuthoredAudioCatalog.groups[$0] ?? []}
        guard !cues.isEmpty else{return}
        let id=UUID(),tail=arcadeTailFactory();arcadeTail=(id,tail)
        var pending=Set(cues.map(\.voice))
        for cue in cues {
            tail.play(cue){[weak self] _ in
                guard let self,self.arcadeTail?.id==id,pending.remove(cue.voice) != nil else{return}
                if pending.isEmpty {self.finishArcadeTail()}
            }
        }
    }
    private func finishArcadeTail() {
        let old=arcadeTail;arcadeTail=nil
        old?.transport.dispose()
    }

    private func finishRewardTail() {
        let old=rewardTail;rewardTail=nil
        old?.transport.dispose()
    }
    /// DEV preview has no concurrent gameplay result; retire only its reward voices.
    func stopRewardPreviewSounds() {
        guard !disposed else{return}
        let voices=Set(["newCardIntro","newCardCrumble","newCardHappy","newCardUnlockedEnter","newCardOpeningPuff"].flatMap {
            NativeAuthoredAudioCatalog.groups[$0]?.map(\.voice) ?? []
        })
        transport.stopVoices(voices)
    }
    func stop() {bottleBoardWarmupCapture=nil;sourceBoardEntryOwner=nil;magnetPullStopCapture=nil;magnetPullSilentGeneration=nil;transport.stopAll();coconutLoopVoices.removeAll();meterCarrierVoices.removeAll();generation &+= 1;receipts.removeAll();harpSequenceReady=false;ordinarySixContact=nil}
    func dispose() {guard !disposed else{return};disposed=true;bottleBoardWarmupCapture=nil;finishRewardTail();finishArcadeTail();finishRoundWonTail();finishWorldTail();finishNavigationSpeech();sourceBoardEntryOwner=nil;magnetPullStopCapture=nil;magnetPullSilentGeneration=nil;meterCarrierVoices.removeAll();coconutLoopVoices.removeAll();transport.dispose();for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll();receipts.removeAll()}
    private func notification(name:String,interruption:UInt?) {
        if name==UIApplication.willResignActiveNotification.rawValue {setForeground(false)}
        else if name==UIApplication.didBecomeActiveNotification.rawValue {interrupted=false;setForeground(true)}
        else if name==AVAudioSession.interruptionNotification.rawValue {
            guard let raw=interruption,let type=AVAudioSession.InterruptionType(rawValue:raw) else{return}
            interrupted=type == .began;transport.setSelectedPreparationForeground(foreground && !interrupted);if interrupted {finishRewardTail();finishArcadeTail();finishRoundWonTail();finishWorldTail();finishNavigationSpeech();bottleBoardWarmupCapture=nil;sourceBoardEntryOwner=nil;magnetPullStopCapture=nil;magnetPullSilentGeneration=nil;transport.stopAll()}
        } else {finishRewardTail();finishArcadeTail();finishRoundWonTail();finishWorldTail();finishNavigationSpeech();interrupted=false;bottleBoardWarmupCapture=nil;sourceBoardEntryOwner=nil;magnetPullStopCapture=nil;magnetPullSilentGeneration=nil;transport.setSelectedPreparationEnabled(false);transport.stopAll();transport.setSelectedPreparationEnabled(enabled);transport.setSelectedPreparationForeground(foreground)}
    }
}

/// Lazy file-backed one shots; exact selected files only. Stable semantic voice IDs
/// replace their predecessor, while independent layered families may overlap.
@MainActor
final class NativeAVGameplayAudioTransport:NSObject,NativeGameplayAudioTransport {
    private final class Voice {
        let token=UUID()
        let control=NativeSelectedAudioFile.ControlLease()
        var started=false
        var completionReceipt:NativeSelectedAudioFile.Completion?
        var gain=0.0
        var task:Task<Void,Never>?
        var preparationRequest:String?
        var preparedFile:NativeSelectedAudioFile?
        var preparationGeneration:UInt64?
        var onFinished:((NativeAudioCompletion)->Void)?
    }
    private let root:URL
    private var voices:[String:Voice]=[:]
    private var disposed=false
    private var controlEpoch:UInt64=1
    private var sessionActivated=false
    private let activateSession:()->Bool
    private var coconutContacts:NativeCoconutContactAudio?
    private var selectedEnabled=true,selectedForeground=true
    func prepareCoconutContacts(){guard selectedEnabled,selectedForeground,!disposed else{return};if coconutContacts==nil{coconutContacts=NativeCoconutContactAudio(root:root)};coconutContacts?.prepare()}
    private let maximumVoices=32
    // Includes logically retired players awaiting their exact worker stop.
    private let maximumControlVoices=64
    private var pendingControlVoices=Set<UUID>()
    var pendingControlVoiceCount:Int {pendingControlVoices.count}
    private lazy var selectedPreparation=injectedPreparation ?? NativeSelectedAudioNativePreparation.make(root:root)
    private let injectedPreparation:NativeSelectedAudioPreparation<NativeSelectedAudioFile>?
    var preparedSourceCount:Int {selectedPreparation.preparedCount}
    func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool {
        guard !disposed else{return false}
        let canonical=sources.compactMap{NativeSelectedAudioFile.canonicalPath($0)}
        guard canonical.count==sources.count else{return false}
        selectedPreparation.beginGeneration(generation)
        return selectedPreparation.prepare(sources:canonical,requestID:capture,generation:generation)
    }
    func setSelectedPreparationEnabled(_ enabled:Bool) {selectedEnabled=enabled;selectedPreparation.setEnabled(enabled);if !enabled {sessionActivated=false;stopAll();coconutContacts?.dispose();coconutContacts=nil}}
    func setSelectedPreparationForeground(_ foreground:Bool) {selectedForeground=foreground;selectedPreparation.setForeground(foreground);if !foreground {sessionActivated=false;stopAll()}}
    var scheduledVoiceCount:Int {voices.count+(coconutContacts?.count ?? 0)}
    func scheduledGain(for id:String)->Double? {voices[id]?.gain}
    var openedFileCount:Int {voices.values.filter{$0.started}.count}
    func capturedCompletionReceipt(for id:String)->NativeSelectedAudioFile.Completion? {voices[id]?.completionReceipt}
    var onError:((String)->Void)?
    init(root:URL,preparation:NativeSelectedAudioPreparation<NativeSelectedAudioFile>?=nil,activateSession:@escaping ()->Bool={
        do {let session=AVAudioSession.sharedInstance();try session.setCategory(JimiNativeMusic.sessionCategory);try session.setActive(true);return true}
        catch {return false}
    }) {self.root=root;self.injectedPreparation=preparation;self.activateSession=activateSession;super.init()}
    func play(_ cue:NativeAudioCue){play(cue,completion:nil)}
    func play(_ cue:NativeAudioCue,onFinished:@escaping (NativeAudioCompletion)->Void){play(cue,completion:onFinished)}
    private func play(_ cue:NativeAudioCue,completion:((NativeAudioCompletion)->Void)?) {
        guard !disposed,selectedEnabled,selectedForeground,(!cue.looping || (cue.stopAfter.map{$0.isFinite && $0>0} ?? false)),NativeSelectedAudioFile.canonicalPath(cue.source) != nil,cue.gain.isFinite,cue.rate.isFinite,cue.delay.isFinite,cue.rate>0,cue.delay>=0 else{completion?(.unavailable);return}
        // SFX must recover with Music OFF as well as on a cold launch. Activation
        // is retried after a failed attempt and invalidated by background/reset.
        if !sessionActivated {sessionActivated=activateSession()}
        guard sessionActivated else {onError?("Cannot activate Native SFX session");completion?(.unavailable);return}
        stop(cue.voice);coconutContacts?.stop([cue.voice])
        guard scheduledVoiceCount<maximumVoices else {onError?("Native SFX voice limit reached");completion?(.unavailable);return}
        if NativeCoconutContactAudio.accepts(cue) {
            prepareCoconutContacts()
            coconutContacts?.play(cue){completion?($0)}
            return
        }
        let voice=Voice();voice.gain=max(0,min(1,cue.gain));voice.onFinished=completion;voices[cue.voice]=voice
        voice.task=Task { @MainActor [weak self,weak voice] in
            if cue.delay>0 {do {try await Task.sleep(for:.seconds(cue.delay))}catch{return}}
            guard let self,let voice,self.voices[cue.voice]===voice,!self.disposed,!Task.isCancelled else{return}
            self.obtainSelectedPlayer(cue,voice:voice)
        }
    }
    private func obtainSelectedPlayer(_ cue:NativeAudioCue,voice:Voice) {
        guard !disposed,voices[cue.voice]===voice,
              let source=NativeSelectedAudioFile.canonicalPath(cue.source) else{return}
        if let prepared=selectedPreparation.take(source) {
            voice.preparedFile=prepared;voice.preparationGeneration=selectedPreparation.currentGeneration
            start(cue,voice:voice,file:prepared);return
        }
        let request="native-play-\(UUID().uuidString)";voice.preparationRequest=request
        let admitted=selectedPreparation.prepare(sources:[source],requestID:request,generation:selectedPreparation.currentGeneration){[weak self,weak voice] outcome in
            guard let self,let voice,!self.disposed,self.voices[cue.voice]===voice,voice.preparationRequest==request else{return}
            voice.preparationRequest=nil
            guard case .settled(let unavailable)=outcome else{self.stop(cue.voice);return}
            guard unavailable.isEmpty else{
                self.onError?("Cannot prepare selected authored SFX")
                if self.voices[cue.voice]===voice {self.stop(cue.voice,reason:.unavailable)}
                return
            }
            // A coalesced sibling may already have consumed the prepared player.
            // Each overlapping voice owns a distinct player on the same queue.
            self.obtainSelectedPlayer(cue,voice:voice)
        }
        if !admitted,voices[cue.voice]===voice {voice.preparationRequest=nil;stop(cue.voice,reason:.unavailable)}
    }
    private func start(_ cue:NativeAudioCue,voice:Voice,file:NativeSelectedAudioFile) {
        guard !disposed,voices[cue.voice]===voice else{return}
        guard pendingControlVoices.count<maximumControlVoices else {
            onError?("Native SFX control limit reached")
            if voices[cue.voice]===voice {stop(cue.voice,reason:.unavailable)}
            return
        }
        pendingControlVoices.insert(voice.token)
        let completion:NativeSelectedAudioFile.Completion={[weak self,weak voice] success,message in
            guard let self,let voice,self.voices[cue.voice]===voice else{return}
            if let message {self.onError?(message)}
            if self.voices[cue.voice]===voice {self.stop(cue.voice,reason:success ? .ended:.unavailable)}
        }
        voice.completionReceipt=completion
        file.start(voice.control,rate:cue.rate,gain:voice.gain,looping:cue.looping,completion:completion){[weak self,weak voice] success in
            guard let self,let voice,self.voices[cue.voice]===voice,!self.disposed else{return}
            guard success else {
                self.onError?("Cannot start selected authored SFX")
                if self.voices[cue.voice]===voice {self.stop(cue.voice,reason:.unavailable)}
                return
            }
            voice.started=true
            let audible=cue.stopAfter ?? (file.duration/cue.rate)
            let fade=max(0,min(cue.fadeOut,audible)),fadeAt=max(0,audible-fade)
            voice.task=Task { @MainActor [weak self,weak voice] in
                guard let self,let voice,self.voices[cue.voice]===voice,!self.disposed,!Task.isCancelled else{return}
                do {
                    if fadeAt>0 {try await Task.sleep(for:.seconds(fadeAt))}
                    guard self.voices[cue.voice]===voice,!Task.isCancelled else{return}
                    if fade>0 {file.fadeOut(duration:fade,lease:voice.control);try await Task.sleep(for:.seconds(fade))}
                    guard self.voices[cue.voice]===voice,!Task.isCancelled else{return}
                    self.stop(cue.voice,reason:.ended)
                } catch is CancellationError {} catch {self.onError?(error.localizedDescription);if self.voices[cue.voice]===voice {self.stop(cue.voice,reason:.unavailable)}}
            }
        }
    }
    private func stop(_ id:String,reason:NativeAudioCompletion = .stopped,returnIdle:Bool=true) {
        guard let voice=voices.removeValue(forKey:id) else{return}
        voice.control.retire();voice.task?.cancel();voice.task=nil;voice.started=false;voice.completionReceipt=nil
        if let request=voice.preparationRequest {voice.preparationRequest=nil;selectedPreparation.cancel(requestID:request)}
        let file=voice.preparedFile,generation=voice.preparationGeneration,epoch=controlEpoch
        voice.preparedFile=nil;voice.preparationGeneration=nil
        if let file {
            file.stop(voice.control){[weak self] stopped in
                guard let self else{return}
                self.pendingControlVoices.remove(voice.token)
                guard stopped,returnIdle,reason != .unavailable,!self.disposed,
                      self.controlEpoch==epoch,let generation else{return}
                self.selectedPreparation.returnIdle(.init(asset:file,bytes:file.estimatedDecodedBytes),source:file.source,generation:generation)
            }
        }
        let callback=voice.onFinished;voice.onFinished=nil;callback?(reason)
    }
    func captureFade(_ ids:Set<String>)->((Double)->Void)? {
        let captured=ids.compactMap {id -> (String,Voice,Double)? in guard let voice=voices[id] else{return nil};return (id,voice,voice.gain)}
        guard !captured.isEmpty,!disposed else{return nil}
        return { [weak self] progress in
            guard let self,!self.disposed,progress.isFinite else{return};let p=min(1,max(0,progress))
            for (id,voice,gain) in captured where self.voices[id]===voice {
                if p>=1 {self.stop(id)}else{voice.gain=gain*(1-p);voice.preparedFile?.setGain(voice.gain,lease:voice.control)}
            }
        }
    }
    func stopAll() {coconutContacts?.stopAll();controlEpoch &+= 1;for id in Array(voices.keys) {stop(id,returnIdle:false)};selectedPreparation.cancelPending()}
    func stopVoices(_ ids:Set<String>) {coconutContacts?.stop(ids);for id in ids {stop(id)}}
    func dispose() {guard !disposed else{return};disposed=true;stopAll();coconutContacts?.dispose();coconutContacts=nil;selectedPreparation.dispose()}
}
