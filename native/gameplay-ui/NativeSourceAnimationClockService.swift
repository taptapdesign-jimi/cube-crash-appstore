#if canImport(UIKit)
import UIKit
#else
import Foundation
#endif

/// PRIVATE replacement transport. One finite-union link, two explicit elapsed
/// domains; no AV/media registration, source renderer activity or game state.
@MainActor
final class NativeSourceAnimationClockService {
    enum Domain {case nativeRaw,sourceGSAP(NativeSourceAnimationRuntime.RootFamily)}
    @MainActor final class Lease {
        fileprivate weak var service:NativeSourceAnimationClockService?
        fileprivate let id:UInt64,source:NativeSourceAnimationRuntime.Lease?
        fileprivate init(service:NativeSourceAnimationClockService,id:UInt64,source:NativeSourceAnimationRuntime.Lease?){self.service=service;self.id=id;self.source=source}
        var active:Bool{source?.active ?? (service?.raw[id] != nil)}
        func cancel(success:Bool=false){if let source{source.cancel(success:success)}else{service?.retireRaw(id:id,success:success)}}
        func setSuspended(_ value:Bool){if let source{source.setSuspended(value)}else{service?.pauseRaw(id:id,value:value)}}
    }
    @MainActor final class SourceFrameLease {
        fileprivate weak var service:NativeSourceAnimationClockService?
        fileprivate let id:UInt64
        let ownerID:String,generation:UInt64
        fileprivate init(service:NativeSourceAnimationClockService,id:UInt64,ownerID:String,generation:UInt64){self.service=service;self.id=id;self.ownerID=ownerID;self.generation=generation}
        var active:Bool{service?.sourceFrameEntries[id] != nil}
        func cancel(){service?.cancelSourceAnimationFrame(id:id)}
    }
    @MainActor private final class SourceFrameEntry {
        enum Kind {case ticker,oneShot}
        let id:UInt64,kind:Kind
        var callback:(()->Void)?,cancelled:(()->Void)?
        init(id:UInt64,kind:Kind,callback:(()->Void)?=nil,cancelled:(()->Void)?=nil){self.id=id;self.kind=kind;self.callback=callback;self.cancelled=cancelled}
    }
    @MainActor private final class RawEntry {
        weak var participant:(any NativeSourceAnimationParticipant)?
        let id:UInt64,duration:Double
        var elapsed=0.0,lastFrame:Double?,suspended=false
        var cleanup:((Bool)->Void)?
        init(id:UInt64,duration:Double,participant:any NativeSourceAnimationParticipant,cleanup:@escaping(Bool)->Void){self.id=id;self.duration=duration;self.participant=participant;self.cleanup=cleanup}
    }
    private let source:NativeSourceAnimationRuntime
    private let target=NativeSourceAnimationClockTarget()
    private var link:CADisplayLink?,raw:[UInt64:RawEntry]=[:],sequence:UInt64=0,disposed=false,sourceForeground=true
    private let sourceFrameTransportEnabled:Bool
    private var sourceFrameEntries:[UInt64:SourceFrameEntry]=[:],sourceFrameSequence:UInt64=0,sourceTickerFrameID:UInt64?
    private var sourceFrameDeliveryInProgress=false,sourceTickerWakeInProgress=false
    var pendingSourceAnimationFrameCount:Int{sourceFrameEntries.values.filter{$0.kind == .oneShot}.count}
    var sourceTickerRAFQueued:Bool{sourceTickerFrameID != nil}
    var sourceTickerDispatchFrame:UInt64{sourceTickerState.frame}
    var sourceTickerNextGCFrame:UInt64{sourceTickerState.nextGCFrame}
    var sourceTickerListenerCount:Int{sourceTickerListeners.count}
    private var sourceTickerState:NativeSourceTickerRAFState
    private var sourceTickerListenerSequence:UInt64=0,sourceTickerListeners:[UInt64:SourceTickerEntry]=[:]
    @MainActor final class SourceTickerLease {
        fileprivate weak var service:NativeSourceAnimationClockService?
        fileprivate let id:UInt64
        let ownerID:String,generation:UInt64
        fileprivate init(service:NativeSourceAnimationClockService,id:UInt64,ownerID:String,generation:UInt64){self.service=service;self.id=id;self.ownerID=ownerID;self.generation=generation}
        var active:Bool{service?.sourceTickerListeners[id] != nil}
        func cancel(){service?.retireSourceTickerListener(id:id)}
    }
    @MainActor private final class SourceTickerEntry {
        let id:UInt64
        weak var participant:(any NativeSourceTickerParticipant)?
        var cleanup:(()->Void)?
        init(id:UInt64,participant:any NativeSourceTickerParticipant,cleanup:@escaping()->Void){self.id=id;self.participant=participant;self.cleanup=cleanup}
    }
    private let sourceWallMillisecondsNow:()->Double
    static let shared=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
    private(set) var displayLinkCreationCount=0
    var sourceAnimationSeconds:Double{source.animationSeconds}
    var sourceTickerSeconds:Double{source.tickerSeconds}
    var activeParticipantCount:Int{source.activeCount+raw.count}
    var hasActiveClock:Bool{link != nil}
    init(wallOriginMilliseconds:Double,sourceWallMillisecondsNow:@escaping()->Double={Date().timeIntervalSince1970*1000},sourceFrameTransportEnabled:Bool=false){
        self.sourceWallMillisecondsNow=sourceWallMillisecondsNow;self.sourceFrameTransportEnabled=sourceFrameTransportEnabled
        source=NativeSourceAnimationRuntime(wallOriginMilliseconds:wallOriginMilliseconds)
        sourceTickerState=NativeSourceTickerRAFState(wallOriginMilliseconds:wallOriginMilliseconds)
        target.owner=self
        source.onDemandChanged={ [weak self] in self?.refreshSourceTickerToken();self?.refreshDemand() }
        if sourceFrameTransportEnabled {source.onWillChangeSuspension={ [weak self] value in if !value {self?.wakeSourceTickerForAPIMutation()} }}
    }
    func register(participant:any NativeSourceAnimationParticipant,duration:Double,domain:Domain,
                  delay:Double=0,wallMilliseconds:Double?=nil,initiallySuspended:Bool=false,cleanup:@escaping(Bool)->Void)->Lease? {
        guard !disposed,duration>=0,delay>=0,delay.isFinite else{return nil}
        sequence += 1
        switch domain {
        case .nativeRaw:
            guard delay==0 else{return nil}
            // Raw infinity already exists for finite captured phase-count owners.
            // Preserve their existing explicit completion, no invented timeout.
            let entry=RawEntry(id:sequence,duration:duration,participant:participant,cleanup:cleanup)
            entry.suspended=initiallySuspended;raw[sequence]=entry
            refreshDemand();return Lease(service:self,id:sequence,source:nil)
        case .sourceGSAP(let family):
            // Infinity/phase schedulers require a separate typed bounded-phase
            // admission. They cannot silently become a permanent source clock.
            guard duration.isFinite else{return nil}
            let waking=sourceFrameTransportEnabled && !sourceTickerState.awake
            if waking {
                sourceTickerWakeInProgress=true;wakeSourceTicker(wallMilliseconds:wallMilliseconds ?? sourceWallMillisecondsNow())
            } else if !sourceFrameTransportEnabled && sourceForeground && link==nil {source.deliver(wallMilliseconds:wallMilliseconds ?? sourceWallMillisecondsNow())}
            guard !disposed else{sourceTickerWakeInProgress=false;return nil}
            defer {if waking {sourceTickerWakeInProgress=false;refreshSourceTickerToken();refreshDemand()}}
            guard let receipt=source.attach(participant:participant,family:family,duration:duration,delay:delay,initiallySuspended:initiallySuspended,cleanup:cleanup) else{return nil}
            refreshDemand();return Lease(service:self,id:sequence,source:receipt)
        }
    }
    @discardableResult
    func setSourceGlobalPaused(_ paused:Bool,terminalSuspended:Bool=false)->Bool {
        // Literal resumeGame guard belongs to the received authoritative route
        // context, not a duplicated core/state decision made by this service.
        guard paused || !terminalSuspended else{return false}
        if sourceFrameTransportEnabled,!paused,source.globallyPaused != paused {wakeSourceTickerForAPIMutation()}
        guard !disposed else{return !sourceFrameTransportEnabled}
        source.setGlobalPaused(paused);refreshDemand();return true
    }
    func setSourceForeground(_ foreground:Bool){sourceForeground=foreground;refreshDemand()}
    fileprivate func tick(_ displayLink:CADisplayLink){
        // GSAP queries Date.now at callback delivery; CADisplayLink.timestamp
        // refers to its frame pose and can predate a just-registered owner.
        // Keep original nativeRaw frame timestamps separate from source wall.
        deliver(wallMilliseconds:sourceWallMillisecondsNow(),rawFrameMilliseconds:displayLink.timestamp*1000)
    }
    /// Also the deterministic UIKit/clock test seam. This method does not create
    /// a second link or make Scene15 delivery an authorized source clock.
    func deliver(wallMilliseconds:Double,rawFrameMilliseconds:Double?=nil){
        guard !disposed else{return}
        if sourceFrameTransportEnabled {
            guard !sourceFrameDeliveryInProgress else{return}
            sourceFrameDeliveryInProgress=true
            if sourceForeground {deliverSourceAnimationFrames(wallMilliseconds:wallMilliseconds)}
        } else if sourceForeground{source.deliver(wallMilliseconds:wallMilliseconds)}
        defer {if sourceFrameTransportEnabled {sourceFrameDeliveryInProgress=false}}
        guard !disposed else{return}
        // nativeRaw semantics preserve each old finite carrier's own baseline,
        // full raw elapsed delta and pause reset. They are not SourceGSAP mapped.
        let rawTimestamp=rawFrameMilliseconds ?? wallMilliseconds
        let captured=raw.values.sorted{$0.id<$1.id}
        for entry in captured where raw[entry.id] === entry {
            guard let owner=entry.participant else{retireRaw(id:entry.id,success:false);continue}
            guard !entry.suspended else{entry.lastFrame=nil;continue}
            entry.elapsed += entry.lastFrame.map{max(0,(rawTimestamp-$0)/1000)} ?? 0
            entry.lastFrame=rawTimestamp
            owner.advanceSourceAnimation(seconds:min(entry.duration,entry.elapsed))
            if raw[entry.id] === entry && entry.elapsed>=entry.duration {retireRaw(id:entry.id,success:true)}
        }
        refreshDemand()
    }
    /// Original browser requestAnimationFrame is a one-shot, NOT a GSAP root.
    /// Frame callback records remain alive under globalTimeline modal pause.
    func requestSourceAnimationFrame(ownerID:String,generation:UInt64,callback:@escaping()->Void,onCancelled:(()->Void)?=nil)->SourceFrameLease? {
        guard !disposed,sourceFrameTransportEnabled else{return nil}
        sourceFrameSequence &+= 1;let id=sourceFrameSequence
        sourceFrameEntries[id]=SourceFrameEntry(id:id,kind:.oneShot,callback:callback,cancelled:onCancelled)
        refreshDemand()
        return SourceFrameLease(service:self,id:id,ownerID:ownerID,generation:generation)
    }
    private func enqueueSourceTickerToken(){
        guard !disposed,sourceFrameTransportEnabled,sourceTickerFrameID==nil else{return}
        sourceFrameSequence &+= 1;let id=sourceFrameSequence
        sourceTickerFrameID=id;sourceFrameEntries[id]=SourceFrameEntry(id:id,kind:.ticker)
    }
    private func refreshSourceTickerToken(){
        guard sourceFrameTransportEnabled,!disposed,!sourceTickerWakeInProgress else{return}
        if !sourceTickerState.awake && (source.hasSourceTickerDemand || !sourceTickerListeners.isEmpty) {
            sourceTickerWakeInProgress=true;wakeSourceTicker(wallMilliseconds:sourceWallMillisecondsNow());sourceTickerWakeInProgress=false
        }
        if sourceTickerState.awake {enqueueSourceTickerToken()}
        else if let id=sourceTickerFrameID {sourceFrameEntries.removeValue(forKey:id);sourceTickerFrameID=nil}
    }
    private func deliverSourceAnimationFrames(wallMilliseconds:Double){
        let captured=sourceFrameEntries.values.sorted{$0.id<$1.id}
        for entry in captured {
            guard !disposed,sourceForeground,sourceFrameEntries[entry.id] === entry else{continue}
            sourceFrameEntries.removeValue(forKey:entry.id)
            switch entry.kind {
            case .ticker:
                if sourceTickerFrameID==entry.id {sourceTickerFrameID=nil}
                // Source _tick schedules NEXT RAF before root/lazy dispatch.
                enqueueSourceTickerToken()
                if let dispatch=sourceTickerState.tick(wallMilliseconds:wallMilliseconds) {deliverSourceTicker(dispatch,wallMilliseconds:wallMilliseconds)}
                refreshSourceTickerToken()
            case .oneShot:
                let callback=entry.callback;entry.callback=nil;entry.cancelled=nil
                callback?()
            }
        }
    }
    /// Only literal source gsap.ticker.add callsites use this captured lifetime.
    /// This is not a nativeRaw presentation or a generic visibility activity.
    func registerSourceTickerListener(ownerID:String,generation:UInt64,participant:any NativeSourceTickerParticipant,cleanup:@escaping()->Void)->SourceTickerLease? {
        guard !disposed,sourceFrameTransportEnabled else{return nil}
        sourceTickerListenerSequence &+= 1;let id=sourceTickerListenerSequence
        sourceTickerListeners[id]=SourceTickerEntry(id:id,participant:participant,cleanup:cleanup)
        refreshSourceTickerToken();refreshDemand()
        guard !disposed,sourceTickerListeners[id] != nil else{return nil}
        return SourceTickerLease(service:self,id:id,ownerID:ownerID,generation:generation)
    }
    private func wakeSourceTickerForAPIMutation(){
        guard !disposed,!sourceTickerState.awake else{return}
        let previous=sourceTickerWakeInProgress;sourceTickerWakeInProgress=true
        wakeSourceTicker(wallMilliseconds:sourceWallMillisecondsNow())
        sourceTickerWakeInProgress=previous
        refreshSourceTickerToken();refreshDemand()
    }
    private func wakeSourceTicker(wallMilliseconds:Double){
        let dispatch=sourceTickerState.wake(wallMilliseconds:wallMilliseconds)
        enqueueSourceTickerToken() // literal _tick queues NEXT before dispatch
        if let dispatch {deliverSourceTicker(dispatch,wallMilliseconds:wallMilliseconds)}
    }
    private func deliverSourceTicker(_ dispatch:NativeSourceTickerRAFState.Dispatch,wallMilliseconds:Double){
        source.deliverSourceTicker(seconds:dispatch.seconds,wallMilliseconds:wallMilliseconds)
        guard !disposed else{return}
        for entry in sourceTickerListeners.values.sorted(by:{$0.id<$1.id}) where entry.participant == nil {retireSourceTickerListener(id:entry.id)}
        sourceTickerState.finishRootRender(hasRunningChild:source.hasSourceTickerDemand,listenerCount:sourceTickerListeners.count+1)
        // GSAP's ordinary listener loop is mutable: later registrations can
        // join this same dispatch; frame requests they create remain next RAF.
        var visited:UInt64=0
        while !disposed,let id=sourceTickerListeners.keys.filter({$0>visited}).min(),let entry=sourceTickerListeners[id] {
            visited=id
            guard let participant=entry.participant else{retireSourceTickerListener(id:id);continue}
            participant.advanceSourceTicker(seconds:dispatch.seconds,deltaMilliseconds:dispatch.deltaMilliseconds,frame:dispatch.frame)
        }
    }
    private func retireSourceTickerListener(id:UInt64){
        guard let entry=sourceTickerListeners.removeValue(forKey:id) else{return}
        let cleanup=entry.cleanup;entry.cleanup=nil;cleanup?();refreshDemand()
    }
    private func retireAllSourceTickerListeners(){
        let captured=sourceTickerListeners.values.sorted{$0.id<$1.id};sourceTickerListeners.removeAll()
        for entry in captured {let cleanup=entry.cleanup;entry.cleanup=nil;cleanup?()}
    }
    private func cancelSourceAnimationFrame(id:UInt64){
        guard let entry=sourceFrameEntries.removeValue(forKey:id),entry.kind == .oneShot else{return}
        let callback=entry.cancelled;entry.cancelled=nil;entry.callback=nil
        callback?();refreshDemand()
    }
    private func retireAllSourceAnimationFrames(){
        let captured=sourceFrameEntries.values.sorted{$0.id<$1.id};sourceFrameEntries.removeAll();sourceTickerFrameID=nil
        for entry in captured {let callback=entry.cancelled;entry.cancelled=nil;entry.callback=nil;callback?()}
    }
    private func retireRaw(id:UInt64,success:Bool){
        guard let entry=raw.removeValue(forKey:id) else{return}
        let cleanup=entry.cleanup;entry.cleanup=nil;cleanup?(success);refreshDemand()
    }
    private func pauseRaw(id:UInt64,value:Bool){guard let entry=raw[id] else{return};entry.suspended=value;entry.lastFrame=nil;refreshDemand()}
    private func refreshDemand(){
        let demanded = !disposed && ((sourceForeground && (source.hasSourceTickerDemand || (sourceFrameTransportEnabled && !sourceFrameEntries.isEmpty))) || raw.values.contains{!$0.suspended && $0.participant != nil})
        if demanded && link==nil {
            let clock=CADisplayLink(target:target,selector:#selector(NativeSourceAnimationClockTarget.tick(_:)))
            clock.preferredFrameRateRange=CAFrameRateRange(minimum:30,maximum:60,preferred:60)
            clock.add(to:.main,forMode:.common);link=clock;displayLinkCreationCount += 1
        } else if !demanded {link?.invalidate();link=nil}
    }
    isolated deinit {
        // Run-loop retains display links. Weak target alone would leave an
        // orphan recurring callback after a service owner disappears.
        disposed=true;link?.invalidate();retireAllSourceAnimationFrames();sourceTickerState.sleep();retireAllSourceTickerListeners();source.dispose()
        for entry in raw.values {entry.cleanup?(false);entry.cleanup=nil}
        target.owner=nil
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        link?.invalidate();link=nil
        retireAllSourceAnimationFrames();sourceTickerState.sleep();retireAllSourceTickerListeners();source.dispose()
        // Marked disposed BEFORE callbacks: reentrant registrations are rejected.
        for id in raw.keys.sorted(){retireRaw(id:id,success:false)}
        target.owner=nil
    }
}
@MainActor
private final class NativeSourceAnimationClockTarget:NSObject {
    weak var owner:NativeSourceAnimationClockService?
    @objc func tick(_ link:CADisplayLink){owner?.tick(link)}
}

/// Literal ticker listener channel, separate from Source timeline-root paint.
@MainActor protocol NativeSourceTickerParticipant:AnyObject {
    func advanceSourceTicker(seconds:Double,deltaMilliseconds:Double,frame:UInt64)
}
