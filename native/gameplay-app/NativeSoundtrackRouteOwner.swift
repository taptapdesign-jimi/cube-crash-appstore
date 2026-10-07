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
    private var enabled = true
    private var target = 0.578
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
    init(root:URL, transport:(any NativeSoundtrackTransport)? = nil,isApplicationActive:@escaping @MainActor ()->Bool={UIApplication.shared.applicationState == .active}) {
        self.transport = transport ?? JimiNativeMusic(root:root)
        self.isApplicationActive=isApplicationActive
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
        if !enabled {lease &+= 1;if transition != nil{target=0.19074};transition=nil;command("dispose");themePrepared = false}
        else if foreground,!arcade {resume()}
    }
    func setMenu() {guard !disposed else{return};lease &+= 1;transition=nil;arcade = false;target = 0.578;resume();setGain(duration:0.42)}
    func setJourneyGameplay() {guard !disposed,transition==nil else{return};lease &+= 1;arcade = false;target = 0.19074;setGain(duration:0.32)}
    func setArcadeGameplay() {guard !disposed else{return};lease &+= 1;transition=nil;arcade = true;command("pause")}
    /// Authored controller phase contacts use the one existing theme voice.
    /// The transport's actual fade-end receipt owns the320ms soft tail; no
    /// second route timer or a visual duration releases the gameplay lift.
    func boardTransitionPhase(_ phase:String,ratio:Double,duration:Double,generation:UInt64) {
        guard !disposed,ratio.isFinite,duration.isFinite,duration>=0 else{return}
        if phase=="begin" {lease &+= 1;arcade=false;transition=Transition(generation:generation,lease:lease)}
        guard let current=transition,current.generation==generation,current.lease==lease,!current.settling else{return}
        if phase=="complete" {
            transition?.completionRequested=true
            if !enabled || !foreground || !themePrepared {transition=nil;target=0.19074;if enabled,foreground{target=0;resume();target=0.19074;setGain(duration:0.32)};return}
            if current.tailSettled {settleBoardTransition(current)}
            return
        }
        guard ["begin","hold","exit"].contains(phase) else{return}
        guard enabled,foreground,themePrepared else{target=0.19074;return} // A cold paused theme starts only at complete.
        target=0.578*min(1,max(0,ratio))
        if phase != "exit" {command("volume",extra:["volume":target,"duration":duration]);return}
        transport.perform(id:"soundtrack-native-main",op:"volume",body:["volume":target,"duration":duration+0.32,"replyOnFadeFinished":true]){[weak self] _,error in
            guard let self,error==nil,!self.disposed,self.enabled,self.foreground,self.lease==current.lease,self.transition?.generation==generation else{return}
            self.transition?.tailSettled=true
            if self.transition?.completionRequested==true {self.settleBoardTransition(current)}
        }
    }
    private func settleBoardTransition(_ captured:Transition) {
        guard transition?.lease==captured.lease,lease==captured.lease,!disposed,enabled,foreground else{return}
        transition?.settling=true;target=0.19074
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
            released=true;self.target=0.578
            if self.foreground {self.setGain(duration:1)}
        }
    }
    private func setGain(duration:Double) {
        guard enabled,foreground else{return}
        if !themePrepared {resume()}
        command("volume",extra:["volume":target,"duration":duration])
    }
    private func resume(fadeIn:Bool=false) {
        guard enabled,foreground,!arcade,isApplicationActive() else{return}
        do {try AVAudioSession.sharedInstance().setCategory(JimiNativeMusic.sessionCategory);try AVAudioSession.sharedInstance().setActive(true)}
        catch {onError?(error.localizedDescription);return}
        if themePrepared {command("resume",extra:["volume":fadeIn ? 0:target]);if fadeIn{command("volume",extra:["volume":target,"duration":0.42])};return}
        command("play",extra:["source":"assets/sound/soundtrack/theme-loop-v1/SIx-theme-runtime-intro-loop.wav",
            "volume":target,"position":0,"loop":true,"loopStart":2.0583125,"loopEnd":59.6910625])
    }
    private func command(_ op:String,extra:[String:Any] = [:]) {
        transport.perform(id:"soundtrack-native-main",op:op,body:extra) { [weak self] _,error in
            guard let self else{return}
            if let error {self.onError?(error);return}
            if op == "play" {self.themePrepared = true}
        }
    }
    private func notification(_ notice:Notification) {
        if notice.name == UIApplication.willResignActiveNotification {foreground = false;retireTransitionForInterruption();command("pause");return}
        if notice.name == UIApplication.didBecomeActiveNotification {foreground = true;resume(fadeIn:true);return}
        if notice.name == AVAudioSession.interruptionNotification {
            guard let raw = notice.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue:raw) else{return}
            if type == .began {retireTransitionForInterruption();command("pause")}
            else if foreground {resume(fadeIn:true)}
        } else if foreground {retireTransitionForInterruption();resume(fadeIn:true)}
    }
    /// Source background receipt cancels the transition envelope and preserves
    /// gameplay intent at33%; foreground cannot replay any old phase contact.
    private func retireTransitionForInterruption(){guard transition != nil else{return};lease &+= 1;transition=nil;target=0.19074}
    func dispose() {guard !disposed else{return};disposed=true;lease &+= 1;transition=nil;enabled = false;command("dispose");themePrepared = false;for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll()}
}
