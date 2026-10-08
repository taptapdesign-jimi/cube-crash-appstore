import UIKit

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
    private let sourceWallMillisecondsNow:()->Double
    static let shared=NativeSourceAnimationClockService(wallOriginMilliseconds:Date().timeIntervalSince1970*1000)
    private(set) var displayLinkCreationCount=0
    var sourceAnimationSeconds:Double{source.animationSeconds}
    var sourceTickerSeconds:Double{source.tickerSeconds}
    var activeParticipantCount:Int{source.activeCount+raw.count}
    var hasActiveClock:Bool{link != nil}
    init(wallOriginMilliseconds:Double,sourceWallMillisecondsNow:@escaping()->Double={Date().timeIntervalSince1970*1000}){
        self.sourceWallMillisecondsNow=sourceWallMillisecondsNow
        source=NativeSourceAnimationRuntime(wallOriginMilliseconds:wallOriginMilliseconds)
        target.owner=self
        source.onDemandChanged={ [weak self] in self?.refreshDemand() }
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
            if sourceForeground && link==nil {source.deliver(wallMilliseconds:wallMilliseconds ?? sourceWallMillisecondsNow())}
            guard let receipt=source.attach(participant:participant,family:family,duration:duration,delay:delay,initiallySuspended:initiallySuspended,cleanup:cleanup) else{return nil}
            refreshDemand();return Lease(service:self,id:sequence,source:receipt)
        }
    }
    @discardableResult
    func setSourceGlobalPaused(_ paused:Bool,terminalSuspended:Bool=false)->Bool {
        // Literal resumeGame guard belongs to the received authoritative route
        // context, not a duplicated core/state decision made by this service.
        guard paused || !terminalSuspended else{return false}
        source.setGlobalPaused(paused);return true
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
        if sourceForeground{source.deliver(wallMilliseconds:wallMilliseconds)}
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
    private func retireRaw(id:UInt64,success:Bool){
        guard let entry=raw.removeValue(forKey:id) else{return}
        let cleanup=entry.cleanup;entry.cleanup=nil;cleanup?(success);refreshDemand()
    }
    private func pauseRaw(id:UInt64,value:Bool){guard let entry=raw[id] else{return};entry.suspended=value;entry.lastFrame=nil;refreshDemand()}
    private func refreshDemand(){
        let demanded = !disposed && ((sourceForeground && source.hasSourceTickerDemand) || raw.values.contains{!$0.suspended && $0.participant != nil})
        if demanded && link==nil {
            let clock=CADisplayLink(target:target,selector:#selector(NativeSourceAnimationClockTarget.tick(_:)))
            clock.preferredFrameRateRange=CAFrameRateRange(minimum:30,maximum:60,preferred:60)
            clock.add(to:.main,forMode:.common);link=clock;displayLinkCreationCount += 1
        } else if !demanded {link?.invalidate();link=nil}
    }
    isolated deinit {
        // Run-loop retains display links. Weak target alone would leave an
        // orphan recurring callback after a service owner disappears.
        disposed=true;link?.invalidate();source.dispose()
        for entry in raw.values {entry.cleanup?(false);entry.cleanup=nil}
        target.owner=nil
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        link?.invalidate();link=nil
        source.dispose()
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
