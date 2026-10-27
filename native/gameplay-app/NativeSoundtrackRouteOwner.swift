import UIKit
import AVFAudio

@MainActor
protocol NativeSoundtrackTransport:AnyObject {
    func perform(id:String,op:String,body:[String:Any],replyHandler:@escaping (Any?,String?)->Void)
}
extension JimiNativeMusic:NativeSoundtrackTransport {}

/// Swift route/Settings owner for the existing file-backed native transport.
/// One persistent theme voice; disabling Music invalidates its recovery lease.
@MainActor
final class NativeSoundtrackRouteOwner {
    private let transport:any NativeSoundtrackTransport
    private let isApplicationActive:@MainActor ()->Bool
    private let activateSession:@MainActor () throws -> Void
    private var recovery:Timer?
    private var recoveryAttempts=0
    private var interrupted=false
    private var enabled = true
    private static let menuGain = 0.578 * 0.8 * 0.7
    // Shared by Journey and Arcade: user-requested +40% gameplay music only.
    static let gameplayGain = 0.11 * 1.4
    private var target = NativeSoundtrackRouteOwner.menuGain
    static let gameplaySource = "assets/sound/soundtrack/taptap-gameplay-v1/taptap-gameplay-intro-loop.wav"
    static let gameplayLoopStart = 195122.0 / 48000
    static let gameplayLoopEnd = 3317074.0 / 48000
    private static let menuSource = "assets/sound/soundtrack/theme-loop-v1/SIx-theme-runtime-intro-loop.wav"
    private var gameplay = false
    private var preparedSource:String?
    private var positions:[String:Double] = [:]
    private var themePrepared = false
    private var foreground = true
    private var arcade = false
    private var lease:UInt64=0
    private var disposed=false
    private struct Transition {
        let generation:UInt64,lease:UInt64
        var completionRequested=false,tailSettled=false,settling=false
    }
    private var transition:Transition?
    var hasBoardTransitionEnvelope:Bool {transition != nil}
    private var observers:[NSObjectProtocol] = []
    var onError:((String)->Void)?
    init(root:URL, transport:(any NativeSoundtrackTransport)? = nil,isApplicationActive:@escaping @MainActor ()->Bool={UIApplication.shared.applicationState == .active},
         activateSession:@escaping @MainActor () throws -> Void={try AVAudioSession.sharedInstance().setCategory(JimiNativeMusic.sessionCategory);try AVAudioSession.sharedInstance().setActive(true)}) {
        self.transport = transport ?? JimiNativeMusic(root:root)
        self.isApplicationActive=isApplicationActive
        self.activateSession=activateSession
        for name in [UIApplication.willResignActiveNotification, UIApplication.didBecomeActiveNotification,
                     AVAudioSession.interruptionNotification,AVAudioSession.mediaServicesWereResetNotification] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) { [weak self] notice in
                MainActor.assumeIsolated {self?.notification(notice)}
            })
        }
    }
    func apply(enabled:Bool) {
        guard !disposed else{return}
        self.enabled = enabled
        if !enabled {cancelRecovery();lease &+= 1;if transition != nil{target=Self.gameplayGain};transition=nil;command("dispose");themePrepared = false}
        else if foreground,!arcade {resume()}
    }
    func setMenu() {guard !disposed else{return};lease &+= 1;transition=nil;arcade = false;gameplay=false;target = Self.menuGain;setGain(duration:0.42)}
    func setJourneyGameplay() {guard !disposed,transition==nil else{return};lease &+= 1;arcade = false;gameplay=true;target = Self.gameplayGain;setGain(duration:0.32)}
    func setArcadeGameplay() {guard !disposed,!arcade else{return};cancelRecovery();lease &+= 1;transition=nil;arcade = true}
    /// Arcade readiness owns the outgoing fade: NN never creates a silent gap.
    func arcadePlaybackReady(duration:Double) {
        guard !disposed,enabled,foreground,arcade else{return}
        let token=lease
        transport.perform(id:"soundtrack-native-main",op:"volume",body:["volume":0,"duration":duration,"replyOnFadeFinished":true]){[weak self] _,error in
            guard let self,error==nil,!self.disposed,self.enabled,self.foreground,self.arcade,self.lease==token else{return}
            self.command("pause")
        }
    }
    /// Authored controller phase contacts use the one existing theme voice.
    /// The transport's actual fade-end receipt owns the320ms soft tail; no
    /// second route timer or a visual duration releases the gameplay lift.
    func boardTransitionPhase(_ phase:String,ratio:Double,duration:Double,generation:UInt64) {
        guard !disposed,ratio.isFinite,duration.isFinite,duration>=0 else{return}
        if phase=="begin" {lease &+= 1;arcade=false;gameplay=true;transition=Transition(generation:generation,lease:lease);if themePrepared {resume()}}
        guard let current=transition,current.generation==generation,current.lease==lease,!current.settling else{return}
        if phase=="complete" {
            transition?.completionRequested=true
            if !enabled || !foreground || !themePrepared {transition=nil;target=Self.gameplayGain;if enabled,foreground{target=0;resume();target=Self.gameplayGain;setGain(duration:0.32)};return}
            if current.tailSettled {settleBoardTransition(current)}
            return
        }
        guard ["begin","hold","exit"].contains(phase) else{return}
        guard enabled,foreground,themePrepared else{target=Self.gameplayGain;return} // A cold paused theme starts only at complete.
        target=Self.menuGain*min(1,max(0,ratio))
        if phase != "exit" {command("volume",extra:["volume":target,"duration":duration]);return}
        transport.perform(id:"soundtrack-native-main",op:"volume",body:["volume":target,"duration":duration+0.32,"replyOnFadeFinished":true]){[weak self] _,error in
            guard let self,error==nil,!self.disposed,self.enabled,self.foreground,self.lease==current.lease,self.transition?.generation==generation else{return}
            self.transition?.tailSettled=true
            if self.transition?.completionRequested==true {self.settleBoardTransition(current)}
        }
    }
    private func settleBoardTransition(_ captured:Transition) {
        guard transition?.lease==captured.lease,lease==captured.lease,!disposed,enabled,foreground else{return}
        transition?.settling=true;target=Self.gameplayGain
        transport.perform(id:"soundtrack-native-main",op:"volume",body:["volume":target,"duration":0.32,"replyOnFadeFinished":true]){[weak self] _,error in
            guard let self,error==nil,!self.disposed,self.lease==captured.lease,self.transition?.lease==captured.lease else{return}
            self.transition=nil
        }
    }
    func abortBoardTransition(generation:UInt64) {guard transition?.generation==generation else{return};lease &+= 1;transition=nil}
    /// Release only the real authored sax voice; foreground changes preserve
    /// the logical target without restarting music in the background.
    func beginResultHook()->()->Void {
        guard !disposed,enabled,!arcade else{return {}}
        lease &+= 1;transition=nil;let token=lease;target=0;setGain(duration:0.42)
        var released=false
        return { [weak self] in
            guard let self,!released,!self.disposed,self.enabled,!self.arcade,self.lease==token else{return}
            released=true;self.target=Self.menuGain
            if self.foreground {self.setGain(duration:1)}
        }
    }
    private func setGain(duration:Double) {
        guard enabled,foreground,!interrupted,isApplicationActive() else{return}
        let replacing=themePrepared && preparedSource != (gameplay ? Self.gameplaySource : Self.menuSource)
        if !themePrepared || replacing {resume()}
        else {command("resume")} // Preserve current gain while ensuring a paused route is live.
        command("volume",extra:["volume":target,"duration":replacing ? max(1.25,duration):duration])
    }
    private func resume(fadeIn:Bool=false) {
        guard !disposed,enabled,foreground,!interrupted,!arcade,isApplicationActive() else{return}
        do {try activateSession()}
        catch {onError?(error.localizedDescription);scheduleRecovery();return}
        let source=gameplay ? Self.gameplaySource : Self.menuSource
        if themePrepared,preparedSource != source {
            // Direct Native transport state receipts are synchronous and read-only.
            // Retain each file's phase across route replacement; never overlap two clocks.
            if let previous=preparedSource {
                transport.perform(id:"soundtrack-native-main",op:"state",body:[:]) { [weak self] value,_ in
                    if let position=(value as? [String:Any])?["position"] as? Double,position.isFinite {self?.positions[previous]=max(0,position)}
                }
            }
            // The transport retains the outgoing file until the incoming file is playing.
            themePrepared=false
        }
        if themePrepared {command("resume",extra:["volume":fadeIn ? 0:target]);if fadeIn{command("volume",extra:["volume":target,"duration":0.42])};return}
        command("play",extra:["source":source,"crossfadeDuration":1.25,
            "volume":fadeIn ? 0:target,"position":positions[source] ?? 0,"loop":true,
            "loopStart":gameplay ? Self.gameplayLoopStart:2.0583125,"loopEnd":gameplay ? Self.gameplayLoopEnd:59.6910625])
        if fadeIn {command("volume",extra:["volume":target,"duration":0.42])}
    }
    private func command(_ op:String,extra:[String:Any] = [:]) {
        transport.perform(id:"soundtrack-native-main",op:op,body:extra) { [weak self] _,error in
            guard let self else{return}
            if let error {self.onError?(error);if op == "play" || op == "resume" {self.scheduleRecovery()};return}
            if op == "play" || op == "resume" {self.cancelRecovery()}
            if op == "play" {self.themePrepared = true;self.preparedSource=extra["source"] as? String}
        }
    }
    private func notification(_ notice:Notification) {
        if notice.name == UIApplication.willResignActiveNotification {foreground = false;cancelRecovery();retireTransitionForInterruption();command("pause");return}
        if notice.name == UIApplication.didBecomeActiveNotification {foreground = true;interrupted=false;cancelRecovery();resume(fadeIn:true);return}
        if notice.name == AVAudioSession.interruptionNotification {
            guard let raw = notice.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue:raw) else{return}
            if type == .began {interrupted=true;cancelRecovery();retireTransitionForInterruption();command("pause")}
            else {interrupted=false;cancelRecovery();if foreground {resume(fadeIn:true)}}
        } else if foreground {retireTransitionForInterruption();resume(fadeIn:true)}
    }
    // One finite retry chain per activation failure; no polling while hidden.
    // Every attempt reads current route/Settings rather than replaying old intent.
    private func scheduleRecovery() {
        guard recovery == nil,recoveryAttempts<3,!disposed,enabled,foreground,!interrupted,!arcade,isApplicationActive() else{return}
        let delay=[0.15,0.5,1.0][recoveryAttempts];recoveryAttempts += 1
        let timer=Timer(timeInterval:delay,repeats:false){[weak self] _ in
            MainActor.assumeIsolated {guard let self else{return};self.recovery=nil;self.resume(fadeIn:true)}
        }
        recovery=timer;RunLoop.main.add(timer,forMode:.common)
    }
    private func cancelRecovery(){recovery?.invalidate();recovery=nil;recoveryAttempts=0}
    /// Source background receipt cancels the transition envelope and preserves
    /// the current gameplay mix; foreground cannot replay any old phase contact.
    private func retireTransitionForInterruption(){guard transition != nil else{return};lease &+= 1;transition=nil;target=Self.gameplayGain}
    func dispose() {guard !disposed else{return};disposed=true;cancelRecovery();lease &+= 1;transition=nil;enabled = false;command("dispose");themePrepared = false;for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll()}
}
