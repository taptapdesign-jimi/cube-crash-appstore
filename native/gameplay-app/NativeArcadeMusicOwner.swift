import UIKit
import AVFAudio

@MainActor
protocol NativeMusicCancellation:AnyObject {func cancel()}
@MainActor
protocol NativeMusicScheduler:AnyObject {func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation}
@MainActor
private final class NativeMusicTimer:NativeMusicCancellation {
    var timer:Timer?
    func cancel() {timer?.invalidate();timer=nil}
}
@MainActor
private final class NativeMusicTimerScheduler:NativeMusicScheduler {
    func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation {
        let receipt=NativeMusicTimer()
        receipt.timer=Timer.scheduledTimer(withTimeInterval:max(0.001,seconds),repeats:false) { [weak receipt] _ in
            MainActor.assumeIsolated {receipt?.timer=nil;callback()}
        }
        return receipt
    }
}

/// Arcade admission/result owner for the same continuous gameplay theme as Journey.
/// One segmented file voice; no Merge-6 layer switch or second gameplay clock.
@MainActor
final class NativeArcadeMusicOwner {
    private static let gameplayGain=NativeSoundtrackRouteOwner.gameplayGain,resultGain=0.07
    private let transport:any NativeSoundtrackTransport
    private let scheduler:any NativeMusicScheduler
    private var observers:[NSObjectProtocol]=[]
    private var enabled=true,foreground=true,interrupted=false,disposed=false,admitted=false,prepared=false
    private var epoch:UInt64=1,roundGeneration:UInt64=0,resultHook:UInt64=0
    private var target=NativeArcadeMusicOwner.gameplayGain
    private var retirement:(any NativeMusicCancellation)?
    private let voice="soundtrack-native-arcade-calm"
    var onError:((String)->Void)?
    var onPlaybackReady:((Double)->Void)?
    init(transport:any NativeSoundtrackTransport,scheduler:(any NativeMusicScheduler)?=nil) {
        self.transport=transport;self.scheduler=scheduler ?? NativeMusicTimerScheduler()
        for name in [UIApplication.willResignActiveNotification,UIApplication.didBecomeActiveNotification,
                     AVAudioSession.interruptionNotification,AVAudioSession.mediaServicesWereResetNotification] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) { [weak self] notice in
                MainActor.assumeIsolated {self?.notification(notice)}
            })
        }
    }
    func apply(enabled:Bool) {
        guard !disposed else{return};self.enabled=enabled
        if !enabled {invalidate();resultHook &+= 1;target=Self.gameplayGain;retire()}
        else {resume(duration:0.42)}
    }
    func enterRound(generation:UInt64,immediate:Bool=false) {
        guard !disposed else{return};invalidate();roundGeneration=generation;admitted=true
        target=Self.gameplayGain;resultHook &+= 1;resume(duration:immediate ? 0:1.25)
    }
    // Keep the integration contact; the user now wants one theme throughout play.
    func committedMerge6(generation:UInt64) {}
    func setResultMix(generation:UInt64) {
        guard !disposed,admitted,generation==roundGeneration else{return}
        invalidate();target=Self.resultGain;resultHook &+= 1
        if audible {gain(target,duration:0.42)}
    }
    func beginResultHook(generation:UInt64)->()->Void {
        guard !disposed,admitted,generation==roundGeneration else{return {}}
        invalidate();resultHook &+= 1;let hook=resultHook,round=roundGeneration;target=0
        if audible {gain(0,duration:0.42)}
        var released=false
        return { [weak self] in
            guard let self,!released,!self.disposed,self.admitted,self.roundGeneration==round,self.resultHook==hook else{return}
            released=true;self.target=Self.gameplayGain
            if self.audible {self.gain(self.target,duration:1)}
        }
    }
    func leave(duration:Double=0.42) {
        guard !disposed else{return};invalidate();admitted=false;roundGeneration=0;resultHook &+= 1
        let lease=epoch
        if duration<=0 {retire()}
        else if prepared {gain(0,duration:duration);retirement=scheduler.after(duration) { [weak self] in
            guard let self,self.epoch==lease else{return};self.retirement=nil;self.retire()
        }}
    }
    func setForeground(_ value:Bool) {
        guard !disposed else{return};foreground=value;invalidate()
        if !value {if prepared {command("pause")};if !admitted {retire()}}
        else {resume(duration:0.42)}
    }
    private var audible:Bool {!disposed && admitted && enabled && foreground && !interrupted}
    private func invalidate() {epoch &+= 1;retirement?.cancel();retirement=nil}
    private func resume(duration:Double) {
        guard audible else{return}
        let lease=epoch
        let finish:()->Void = { [weak self] in
            guard let self,self.audible,self.epoch==lease else{return};self.prepared=true;self.gain(self.target,duration:duration);self.onPlaybackReady?(duration)
        }
        if prepared {command("resume",body:["volume":target],success:finish)}
        else {command("play",body:["source":NativeSoundtrackRouteOwner.gameplaySource,"loop":true,"position":0,"volume":0,
                                  "loopStart":NativeSoundtrackRouteOwner.gameplayLoopStart,"loopEnd":NativeSoundtrackRouteOwner.gameplayLoopEnd],success:finish)}
    }
    private func command(_ op:String,body:[String:Any]=[:],success:(()->Void)?=nil) {
        transport.perform(id:voice,op:op,body:body) { [weak self] _,error in
            if let error {self?.onError?(error)}else{success?()}
        }
    }
    private func gain(_ value:Double,duration:Double) {command("volume",body:["volume":value,"duration":duration])}
    private func retire() {if prepared {command("dispose")};prepared=false}
    func dispose() {
        guard !disposed else{return};disposed=true;onPlaybackReady=nil;invalidate();retire()
        for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll()
    }
    private func notification(_ notice:Notification) {
        if notice.name==UIApplication.willResignActiveNotification {setForeground(false)}
        else if notice.name==UIApplication.didBecomeActiveNotification {interrupted=false;setForeground(true)}
        else if notice.name==AVAudioSession.interruptionNotification {
            guard let raw=notice.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,let type=AVAudioSession.InterruptionType(rawValue:raw) else{return}
            interrupted=type == .began
            if interrupted {invalidate();if prepared {command("pause")};if !admitted {retire()}}
            else {resume(duration:0.42)}
        } else {interrupted=false;invalidate();retire();resume(duration:0.42)}
    }
}
