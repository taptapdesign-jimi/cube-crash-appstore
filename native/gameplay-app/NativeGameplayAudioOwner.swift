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
    init(source:String,voice:String,gain:Double,rate:Double=1,delay:Double=0,stopAfter:Double?=nil,fadeOut:Double=0) {
        self.source=source;self.voice=voice;self.gain=gain;self.rate=rate;self.delay=delay;self.stopAfter=stopAfter;self.fadeOut=fadeOut
    }
}
enum NativeAudioCompletion:Equatable {case ended,stopped,unavailable}

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
}

extension NativeGameplayAudioTransport {
    func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool {false}
    func setSelectedPreparationEnabled(_ enabled:Bool) {}
    func setSelectedPreparationForeground(_ foreground:Bool) {}
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
    private var ordinarySixContact:String?
    private var observers:[NSObjectProtocol]=[]
    init(root:URL,enabled:Bool,transport:(any NativeGameplayAudioTransport)?=nil,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        self.transport=transport ?? NativeAVGameplayAudioTransport(root:root);self.enabled=enabled;self.random=random
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
        transport.stopAll();generation=value;meterCarrierVoices.removeAll();receipts.removeAll();harpSequenceReady=false;ordinarySixContact=nil;transitionVoices.removeAll();transitionDigitVoices.removeAll()
    }
    func setEnabled(_ value:Bool) {guard !disposed else{return};enabled=value;transport.setSelectedPreparationEnabled(value);if !value {transport.stopAll()}}
    func setForeground(_ value:Bool) {guard !disposed else{return};foreground=value;transport.setSelectedPreparationForeground(value && !interrupted);if !value {transport.stopAll()}}
    /// Called only for the actually-created committed meter tile after Source's
    /// open/token recheck. Preparation never plays or substitutes a generic cue.
    func prepareSelectedSpecial(special:String,variant:String?,capture:String,generation:UInt64)->Bool {
        guard !disposed,enabled,foreground,!interrupted,generation==self.generation,
              let sources=NativeMeterSelectedAudioCatalog.sources(special:special,variant:variant) else{return false}
        return transport.prepareSelectedSources(sources,capture:capture,generation:generation)
    }

    private func admit(_ category:String,receipt:UInt64,generation:UInt64)->Bool {
        guard !disposed,generation==self.generation,receipt>0,receipt>(receipts[category] ?? 0) else{return false}
        receipts[category]=receipt // OFF consumes the contact; ON never replays it.
        return enabled && foreground && !interrupted
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
        case .dragBegan:play("pickup")
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
            if types.contains(.tnt) || !variants.isDisjoint(with:["flower","beach-ball","laser-gun","barell"]) {tntOrder=shuffle([0,1,2,3,4])}
            if variants.isEmpty && types.contains(.star) {play("star\(pick(4))")}
            if variants.isEmpty && types.contains(.tnt) && tiles.filter({$0.archetype != nil}).count<=1 {play("tnt")}
            for (variant,group) in [("fish","fish"),("beach-ball","ball"),("barell","barrel"),("flower","flower"),("bee","bee"),("kanta","kanta"),("laser-gun","laser"),("spaceship","spaceship"),("robo-cube","robo")] where variants.contains(variant) {play(group)}
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
    func routeFeedback(_ kind:String,receipt:UInt64,generation:UInt64,duration:Double?=nil) {
        guard admit("route",receipt:receipt,generation:generation) else{return}
        let mapping=["cta":"cta","card-tap":"cardTap","tab":"tab","back":"back","close":"back","swipe":"swipe","exit-modal":"exitModal","card-flip":"flip","manual-flip":"manualFlip","return-flip":"returnFlip","home-enter":"homeEnter","home-exit":"homeExit","hub-exit":"hubExit","board-enter":"boardEnter","board-exit":"boardExit","backpack":"backpack","crate":"crate","area55-start":"area55Start","forest-transition":"forestTransition"]
        if let group=mapping[kind] {play(group,duration:duration)}
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
        case "no-moves":group="noMoves"
        case "clean-applause":beginHarpSequence();group="cleanApplause"
        case "clean-sax":group="cleanSax"
        case "clean-count":group="cleanCount"
        case "clean-bonus":group="cleanBonus"
        case "clean-star":
            if !harpSequenceReady {beginHarpSequence()}
            let slot=max(0,min(2,index));group="cleanStar-\(slot)-\(harpOrder[slot])"
        case "clean-cta":group="cleanCTA\(max(0,min(1,index)))"
        case "fail-sax":group="failSax"
        case "fail-cta":group="failCTA\(max(0,min(1,index)))"
        case "arcade-victory":group="arcadeVictory"
        case "arcade-thumb":group="arcadeThumb"
        case "arcade-digit":group="digit\(max(0,min(1,index)))"
        case "new-card-intro":group="newCardIntro"
        case "new-card-crumble":group="newCardCrumble"
        case "new-card-reveal":group="newCardReveal"
        case "new-card-happy":group="newCardHappy"
        default:onFinished?();return
        }
        let hookVoice=kind=="clean-sax" ? "clean-board-saxophone-happy" : kind=="fail-sax" ? "fail-screen-saxophone":nil
        play(group,duration:duration,completionVoice:hookVoice,onFinished:onFinished)
    }
    func specialMoment(variant:String,moment:String,index:Int=0,receipt:UInt64,generation:UInt64) {
        guard admit("special",receipt:receipt,generation:generation) else{return}
        if moment=="landing" {play("landing");return}
        let group:String?
        switch (variant,moment) {
        case ("juice",_),("mushroom",_):group="juice-\(moment)"
        case ("bottle","pull"):play("bottleForce");group="bottlePull"
        case ("bottle",_):group="bottle-\(moment)"
        case ("honey","pull"):play("honeyForce");group="honeyPull"
        case ("honey","post"):group="honeyPost"
        case ("magnet","pull"):group="magnetPull"
        case ("bee","finale"):group="beeFinale"
        case ("flower","leaves"):group="flowerLeaves"
        case ("flower","spark"):group="flowerSpark"
        case ("barell","smoke"):group="barrelSmoke"
        case ("tnt","impact"),("flower","impact"),("beach-ball","impact"),("barell","impact"):
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
        if let group {play(group)}
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
    private func play(_ group:String,duration:Double?=nil,voiceSuffix:String="",completionVoice:String?=nil,onFinished:(()->Void)?=nil) {
        var completionAttached=false
        for cue in NativeAuthoredAudioCatalog.groups[group] ?? [] {
            let adjusted:NativeAudioCue
            if let duration,duration.isFinite,duration>0,cue.stopAfter != nil {
                adjusted=NativeAudioCue(source:cue.source,voice:cue.voice,gain:cue.gain,rate:cue.rate,delay:cue.delay,stopAfter:duration,fadeOut:min(cue.fadeOut,duration))
            } else {adjusted=cue}
            let delivered=voiceSuffix.isEmpty ? adjusted:NativeAudioCue(source:adjusted.source,voice:adjusted.voice+voiceSuffix,gain:adjusted.gain,rate:adjusted.rate,delay:adjusted.delay,stopAfter:adjusted.stopAfter,fadeOut:adjusted.fadeOut)
            if let onFinished,completionVoice==cue.voice {completionAttached=true;var finished=false;transport.play(delivered){_ in guard !finished else{return};finished=true;onFinished()}}else{transport.play(delivered)}
        }
        if !completionAttached {onFinished?()}
    }
    func stop() {transport.stopAll();meterCarrierVoices.removeAll();generation &+= 1;receipts.removeAll();harpSequenceReady=false;ordinarySixContact=nil}
    func dispose() {guard !disposed else{return};disposed=true;meterCarrierVoices.removeAll();transport.dispose();for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll();receipts.removeAll()}
    private func notification(name:String,interruption:UInt?) {
        if name==UIApplication.willResignActiveNotification.rawValue {setForeground(false)}
        else if name==UIApplication.didBecomeActiveNotification.rawValue {setForeground(true)}
        else if name==AVAudioSession.interruptionNotification.rawValue {
            guard let raw=interruption,let type=AVAudioSession.InterruptionType(rawValue:raw) else{return}
            interrupted=type == .began;transport.setSelectedPreparationForeground(foreground && !interrupted);if interrupted {transport.stopAll()}
        } else {transport.setSelectedPreparationEnabled(false);transport.stopAll();transport.setSelectedPreparationEnabled(enabled)}
    }
}

/// Lazy file-backed one shots; exact selected files only. Stable semantic voice IDs
/// replace their predecessor, while independent layered families may overlap.
@MainActor
final class NativeAVGameplayAudioTransport:NSObject,NativeGameplayAudioTransport,AVAudioPlayerDelegate {
    private final class Voice {
        let token=UUID()
        var player:AVAudioPlayer?
        var gain=0.0
        var task:Task<Void,Never>?
        var onFinished:((NativeAudioCompletion)->Void)?
    }
    private let root:URL
    private var voices:[String:Voice]=[:]
    private var disposed=false
    private let maximumVoices=32
    private lazy var selectedPreparation=NativeSelectedAudioNativePreparation.make(root:root)
    var preparedSourceCount:Int {selectedPreparation.preparedCount}
    func prepareSelectedSources(_ sources:[String],capture:String,generation:UInt64)->Bool {
        guard !disposed else{return false}
        let canonical=sources.compactMap{NativeSelectedAudioFile.canonicalPath($0)}
        guard canonical.count==sources.count else{return false}
        selectedPreparation.beginGeneration(generation)
        return selectedPreparation.prepare(sources:canonical,requestID:capture,generation:generation)
    }
    func setSelectedPreparationEnabled(_ enabled:Bool) {selectedPreparation.setEnabled(enabled)}
    func setSelectedPreparationForeground(_ foreground:Bool) {selectedPreparation.setForeground(foreground)}
    var scheduledVoiceCount:Int {voices.count}
    func scheduledGain(for id:String)->Double? {voices[id]?.gain}
    var openedFileCount:Int {voices.values.filter{$0.player != nil}.count}
    var onError:((String)->Void)?
    init(root:URL) {self.root=root;super.init()}
    func play(_ cue:NativeAudioCue){play(cue,completion:nil)}
    func play(_ cue:NativeAudioCue,onFinished:@escaping (NativeAudioCompletion)->Void){play(cue,completion:onFinished)}
    private func play(_ cue:NativeAudioCue,completion:((NativeAudioCompletion)->Void)?) {
        guard !disposed,cue.source.hasPrefix("assets/sound/"),!cue.source.split(separator:"/").contains(".."),cue.gain.isFinite,cue.rate.isFinite,cue.delay.isFinite,cue.rate>0,cue.delay>=0 else{completion?(.unavailable);return}
        stop(cue.voice)
        guard voices.count<maximumVoices else {onError?("Native SFX voice limit reached");completion?(.unavailable);return}
        let voice=Voice();voice.gain=max(0,min(1,cue.gain));voice.onFinished=completion;voices[cue.voice]=voice
        voice.task=Task { @MainActor [weak self,weak voice] in
            if cue.delay>0 {do {try await Task.sleep(for:.seconds(cue.delay))}catch{return}}
            guard let self,let voice,self.voices[cue.voice]===voice,!self.disposed,!Task.isCancelled else{return}
            do {
                let player=try NativeSelectedAudioFile.canonicalPath(cue.source).flatMap{self.selectedPreparation.take($0)?.player} ?? AVAudioPlayer(contentsOf:self.root.appendingPathComponent(cue.source))
                voice.player=player;player.delegate=self;player.enableRate=true;player.rate=Float(cue.rate);player.volume=Float(voice.gain)
                guard player.play() else {throw NSError(domain:"NativeSFX",code:1,userInfo:[NSLocalizedDescriptionKey:"Cannot start selected authored SFX"])}
                let audible=cue.stopAfter ?? (player.duration/cue.rate)
                let fade=max(0,min(cue.fadeOut,audible)),fadeAt=max(0,audible-fade)
                if fadeAt>0 {try await Task.sleep(for:.seconds(fadeAt))}
                guard self.voices[cue.voice]===voice,!Task.isCancelled else{return}
                if fade>0 {player.setVolume(0,fadeDuration:fade);try await Task.sleep(for:.seconds(fade))}
                guard self.voices[cue.voice]===voice,!Task.isCancelled else{return}
                self.stop(cue.voice,reason:.ended)
            } catch is CancellationError {} catch {self.onError?(error.localizedDescription);if self.voices[cue.voice]===voice {self.stop(cue.voice,reason:.unavailable)}}
        }
    }
    private func stop(_ id:String,reason:NativeAudioCompletion = .stopped) {guard let voice=voices.removeValue(forKey:id) else{return};voice.task?.cancel();voice.task=nil;voice.player?.delegate=nil;voice.player?.stop();voice.player=nil;let callback=voice.onFinished;voice.onFinished=nil;callback?(reason)}
    func captureFade(_ ids:Set<String>)->((Double)->Void)? {
        let captured=ids.compactMap {id -> (String,Voice,Double)? in guard let voice=voices[id] else{return nil};return (id,voice,voice.gain)}
        guard !captured.isEmpty,!disposed else{return nil}
        return { [weak self] progress in
            guard let self,!self.disposed,progress.isFinite else{return};let p=min(1,max(0,progress))
            for (id,voice,gain) in captured where self.voices[id]===voice {
                if p>=1 {self.stop(id)}else{voice.gain=gain*(1-p);voice.player?.volume=Float(voice.gain)}
            }
        }
    }
    func stopAll() {selectedPreparation.cancelPending();for id in Array(voices.keys) {stop(id)}}
    func stopVoices(_ ids:Set<String>) {for id in ids {stop(id)}}
    func dispose() {guard !disposed else{return};disposed=true;stopAll();selectedPreparation.dispose()}
    nonisolated func audioPlayerDidFinishPlaying(_ player:AVAudioPlayer,successfully flag:Bool) {
        let identity=ObjectIdentifier(player)
        Task { @MainActor [weak self] in guard let self,let id=self.voices.first(where:{$0.value.player.map(ObjectIdentifier.init)==identity})?.key else{return};self.stop(id,reason:flag ? .ended:.unavailable) }
    }
    nonisolated func audioPlayerDecodeErrorDidOccur(_ player:AVAudioPlayer,error:Error?) {
        let identity=ObjectIdentifier(player),message=error?.localizedDescription ?? "Authored SFX decode failed"
        Task { @MainActor [weak self] in guard let self,let id=self.voices.first(where:{$0.value.player.map(ObjectIdentifier.init)==identity})?.key else{return};self.onError?(message);self.stop(id,reason:.unavailable) }
    }
}
