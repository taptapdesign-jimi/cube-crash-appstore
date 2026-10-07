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

/// Swift owner for the canonical 116.6 BPM Arcade beds. Shares the same native
/// file transport/session as the menu theme, with one bounded outgoing overlap.
@MainActor
final class NativeArcadeMusicOwner {
    static let barSeconds=60.0/116.6*4
    static let barCrossfadeSeconds=(barSeconds*1000).rounded()/1000
    enum Layer:String {case calm,active}
    private let transport:any NativeSoundtrackTransport
    private let scheduler:any NativeMusicScheduler
    private var observers:[NSObjectProtocol]=[]
    private var enabled=true
    private var foreground=true
    private var interrupted=false
    private var disposed=false
    private var admitted=false
    private var epoch:UInt64=1
    private var roundGeneration:UInt64=0
    private var prepared:Set<Layer>=[]
    private var current:Layer?
    private var requested:Layer = .calm
    private var target=0.528
    private var resultMix=false
    private var resultHook:UInt64=0
    private var promotion:(any NativeMusicCancellation)?
    private var retirement:(any NativeMusicCancellation)?
    var onError:((String)->Void)?
    init(transport:any NativeSoundtrackTransport,scheduler:(any NativeMusicScheduler)?=nil) {
        self.transport=transport;self.scheduler=scheduler ?? NativeMusicTimerScheduler()
        for name in [UIApplication.willResignActiveNotification,UIApplication.didBecomeActiveNotification,AVAudioSession.interruptionNotification,AVAudioSession.mediaServicesWereResetNotification] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) { [weak self] notice in MainActor.assumeIsolated{self?.notification(notice)} })
        }
    }
    func apply(enabled:Bool) {
        guard !disposed else{return};self.enabled=enabled
        if !enabled {invalidate();resultHook &+= 1;if resultMix {target=0.528};retireAll()}
        else if admitted && foreground && !interrupted {switchLayer(requested,duration:0.42)}
    }
    /// Call after the authored Round cue, or immediately for Play Again.
    func enterRound(generation:UInt64,immediate:Bool=false) {
        guard !disposed else{return};invalidate();roundGeneration=generation;admitted=true
        requested = .calm;target=0.528;resultMix=false;resultHook &+= 1
        guard enabled,foreground,!interrupted else{return}
        switchLayer(.calm,duration:immediate ? 0 : 1.25)
    }
    func committedMerge6(generation:UInt64) {
        guard !disposed,admitted,enabled,foreground,!interrupted,generation==roundGeneration,current == .calm,requested == .calm,promotion == nil else{return}
        requested = .active // Preserve promotion intent across a background boundary.
        let lease=epoch
        state(.calm) { [weak self] position in
            guard let self,self.isCurrent(lease),self.requested == .active else{return}
            let phase=position.truncatingRemainder(dividingBy:Self.barSeconds)
            let delay=phase<=0.03 ? 0 : Self.barSeconds-phase
            self.promotion=self.scheduler.after((delay*1000).rounded()/1000) { [weak self] in
                guard let self,self.isCurrent(lease),self.requested == .active else{return}
                self.promotion=nil;self.switchLayer(.active,duration:Self.barCrossfadeSeconds)
            }
        }
    }
    func setResultMix(generation:UInt64) {
        guard !disposed,admitted,generation==roundGeneration else{return}
        invalidate();requested=current ?? .calm;resultMix=true;target=0.10;resultHook &+= 1
        if let current,enabled,foreground,!interrupted {discardNonCurrent();gain(current,to:target,duration:0.42)}
    }
    /// The actual authored result voice releases this receipt on end/stop, never
    /// an unrelated visual timer. A changed route/round/Music OFF invalidates it.
    func beginResultHook(generation:UInt64)->()->Void {
        guard !disposed,admitted,generation==roundGeneration else{return {}}
        invalidate();requested=current ?? .calm;resultHook &+= 1
        let hook=resultHook,round=roundGeneration;target=0;resultMix=true;discardNonCurrent()
        if let current,enabled,foreground,!interrupted {gain(current,to:0,duration:0.42)}
        var released=false
        return { [weak self] in
            guard let self,!released,!self.disposed,self.admitted,self.roundGeneration==round,self.resultHook==hook else{return}
            released=true;self.target=0.528
            if let current=self.current,self.enabled,self.foreground,!self.interrupted {self.gain(current,to:self.target,duration:1)}
        }
    }
    func leave(duration:Double=0.42) {
        guard !disposed else{return};invalidate();admitted=false;roundGeneration=0;resultHook &+= 1
        let lease=epoch
        for layer in prepared {gain(layer,to:0,duration:duration)}
        if duration<=0 {retireAll()}
        else {retirement=scheduler.after(duration) { [weak self] in guard let self,self.epoch==lease else{return};self.retirement=nil;self.retireAll()}}
    }
    func setForeground(_ value:Bool) {
        guard !disposed else{return};foreground=value;invalidate()
        if !value {
            discardNonCurrent();for layer in prepared {command(layer,"pause")}
        } else if admitted,enabled,!interrupted {switchLayer(requested,duration:0.42)}
    }
    private func isCurrent(_ lease:UInt64)->Bool {!disposed && admitted && enabled && foreground && !interrupted && epoch==lease}
    private func invalidate() {epoch &+= 1;promotion?.cancel();promotion=nil;retirement?.cancel();retirement=nil}
    private func switchLayer(_ incoming:Layer,duration:Double) {
        guard !disposed,admitted,enabled,foreground,!interrupted else{return}
        promotion?.cancel();promotion=nil;retirement?.cancel();retirement=nil;discardNonCurrent()
        let lease=epoch,outgoing=current
        let desired=resultMix ? target : incoming == .calm ? 0.528 : 0.594
        target=desired
        if outgoing==incoming,prepared.contains(incoming) {
            command(incoming,"resume",body:["volume":desired]) { [weak self] in guard let self,self.isCurrent(lease) else{return};self.gain(incoming,to:desired,duration:duration) }
            return
        }
        let start:(Double)->Void = { [weak self] position in
            guard let self,self.isCurrent(lease) else{return}
            self.command(incoming,"play",body:["source":"./assets/sound/soundtrack/adaptive-music-v3/gameplay-bed-\(incoming.rawValue)-01.wav","loop":true,"position":position,"volume":0]) { [weak self] in
                guard let self,self.isCurrent(lease) else{return}
                self.prepared.insert(incoming);self.current=incoming;self.gain(incoming,to:desired,duration:duration)
                if let outgoing,outgoing != incoming {
                    self.gain(outgoing,to:0,duration:duration)
                    self.retirement=self.scheduler.after(duration) { [weak self] in
                        guard let self,self.isCurrent(lease),self.current==incoming else{return}
                        self.retirement=nil;self.command(outgoing,"dispose");self.prepared.remove(outgoing)
                    }
                }
            }
        }
        if let outgoing {state(outgoing,start)} else {start(0)}
    }
    private func state(_ layer:Layer,_ completion:@escaping (Double)->Void) {
        transport.perform(id:id(layer),op:"state",body:[:]) { [weak self] value,error in
            guard let self else{return};if let error {self.onError?(error);return}
            let position=(value as? [String:Any])?["position"] as? Double ?? 0
            completion(position.isFinite ? max(0,position) : 0)
        }
    }
    private func command(_ layer:Layer,_ op:String,body:[String:Any]=[:],success:(()->Void)?=nil) {
        transport.perform(id:id(layer),op:op,body:body) { [weak self] _,error in if let error {self?.onError?(error)}else{success?()} }
    }
    private func id(_ layer:Layer)->String {"soundtrack-native-arcade-\(layer.rawValue)"}
    private func gain(_ layer:Layer,to value:Double,duration:Double) {command(layer,"volume",body:["volume":value,"duration":duration])}
    private func discardNonCurrent() {for layer in prepared where layer != current {command(layer,"dispose");prepared.remove(layer)}}
    private func retireAll() {for layer in prepared {command(layer,"dispose")};prepared.removeAll();current=nil}
    func dispose() {guard !disposed else{return};disposed=true;invalidate();retireAll();for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll()}
    private func notification(_ notice:Notification) {
        if notice.name==UIApplication.willResignActiveNotification {setForeground(false)}
        else if notice.name==UIApplication.didBecomeActiveNotification {setForeground(true)}
        else if notice.name==AVAudioSession.interruptionNotification {
            guard let raw=notice.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,let type=AVAudioSession.InterruptionType(rawValue:raw) else{return}
            interrupted=type == .began
            if interrupted {invalidate();discardNonCurrent();for layer in prepared {command(layer,"pause")}}
            else if foreground,enabled,admitted {switchLayer(requested,duration:0.42)}
        } else {invalidate();retireAll();if foreground,enabled,admitted,!interrupted {switchLayer(requested,duration:0.42)}}
    }
}
