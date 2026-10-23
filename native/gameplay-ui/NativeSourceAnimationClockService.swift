#if canImport(UIKit)
import UIKit
#else
import Foundation
#endif

/// PRIVATE replacement transport. One finite-union link, two explicit elapsed
/// domains; no AV/media registration, source renderer activity or game state.
@MainActor
final class NativeSourceAnimationClockService {
    struct SchedulingDiagnostics {
        var deliveries=0,worstGapMilliseconds=0.0,worstDeliveryMilliseconds=0.0,worstDeadlineLateMilliseconds=0.0
        var worstRootMilliseconds=0.0,worstRAFMilliseconds=0.0,worstTickerListenerMilliseconds=0.0,worstRawMilliseconds=0.0
        var worstMicrotaskMilliseconds=0.0,worstLayerCommitMilliseconds=0.0
        var slowestParticipantMilliseconds=0.0,slowestParticipantOwner="none",slowestParticipantPhase="none"
        // These fields describe ONE actual worst delivery, not sums of interval maxima.
        var worstFrameRootTotalMilliseconds=0.0,worstFrameRootCleanupMilliseconds=0.0,worstFrameRAFTotalMilliseconds=0.0
        var worstFrameTickerTotalMilliseconds=0.0,worstFrameRawTotalMilliseconds=0.0,worstFrameFIFOValidationMilliseconds=0.0
        var worstFrameFIFOReactionMilliseconds=0.0,worstFrameFIFOCompactMilliseconds=0.0,worstFrameOtherMilliseconds=0.0
        var worstFrameRootCount=0,worstFrameFIFOJobCount=0
        var slowestReactionMilliseconds=0.0,slowestReactionOwner="none"
        var rootHighWater=0,rawHighWater=0,rafHighWater=0,tickerListenerHighWater=0,renderDemandHighWater=0
    }
    private struct DeliveryCosts {
        var roots=0.0,cleanup=0.0,raf=0.0,ticker=0.0,raw=0.0,validation=0.0,reactions=0.0,compact=0.0,boundary=0.0,commit=0.0
        var rootCount=0,jobCount=0
    }
    private var deliveryCosts:DeliveryCosts?
    private var diagnosticEnabled=false,diagnosticLastDelivery:Double?
    private var diagnosticScheduling=SchedulingDiagnostics()
    private let diagnosticFIFOOwner=UUID()
    private let diagnosticMillisecondsNow:()->Double
    func enableSchedulingDiagnostics(){
        guard !disposed else{return};diagnosticEnabled=true
        source.diagnosticMillisecondsNow=diagnosticMillisecondsNow
        source.onParticipantDuration={ [weak self] participant,family,milliseconds in
            guard let self,!self.disposed,self.diagnosticEnabled else{return}
            self.deliveryCosts?.roots+=milliseconds;self.deliveryCosts?.rootCount+=1
            self.diagnosticScheduling.worstRootMilliseconds=max(self.diagnosticScheduling.worstRootMilliseconds,milliseconds)
            self.recordSlowestParticipant(milliseconds:milliseconds,phase:"root:"+family.rawValue,owner:{String(reflecting:type(of:participant))})
        }
        source.onCleanupDuration={ [weak self] duration in self?.deliveryCosts?.cleanup+=duration }
        installFIFODiagnostics()
    }
    private func installFIFODiagnostics(){
        guard diagnosticEnabled,let fifo=sourceMicrotaskTasks?.fifo else{return}
        fifo.installDiagnostics(owner:diagnosticFIFOOwner,clock:diagnosticMillisecondsNow,report:{ [weak self] value in
            guard let self,self.diagnosticEnabled,!self.disposed else{return}
            self.deliveryCosts?.validation+=value.validationMilliseconds;self.deliveryCosts?.reactions+=value.reactionMilliseconds
            self.deliveryCosts?.compact+=value.compactMilliseconds;self.deliveryCosts?.jobCount+=value.jobs
            if value.slowestReactionMilliseconds>self.diagnosticScheduling.slowestReactionMilliseconds {
                self.diagnosticScheduling.slowestReactionMilliseconds=value.slowestReactionMilliseconds
                self.diagnosticScheduling.slowestReactionOwner=value.slowestReactionOwner
            }
        })
    }
    private func recordSlowestParticipant(milliseconds:Double,phase:String,owner:()->String){
        guard diagnosticEnabled,milliseconds>diagnosticScheduling.slowestParticipantMilliseconds else{return}
        diagnosticScheduling.slowestParticipantMilliseconds=milliseconds
        diagnosticScheduling.slowestParticipantPhase=phase
        diagnosticScheduling.slowestParticipantOwner=String(owner().map{$0.isWhitespace ? "_":$0}.prefix(120))
    }
    private func recordDiagnosticPopulation(){
        guard diagnosticEnabled else{return}
        diagnosticScheduling.rootHighWater=max(diagnosticScheduling.rootHighWater,source.activeCount)
        diagnosticScheduling.rawHighWater=max(diagnosticScheduling.rawHighWater,raw.count)
        diagnosticScheduling.rafHighWater=max(diagnosticScheduling.rafHighWater,pendingSourceAnimationFrameCount)
        diagnosticScheduling.tickerListenerHighWater=max(diagnosticScheduling.tickerListenerHighWater,sourceTickerListeners.count)
        diagnosticScheduling.renderDemandHighWater=max(diagnosticScheduling.renderDemandHighWater,source60HzRenderDemands.count)
    }
    func takeSchedulingDiagnostics()->SchedulingDiagnostics {
        let captured=diagnosticScheduling;diagnosticScheduling=SchedulingDiagnostics();return captured
    }
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
        let id:UInt64,kind:Kind,ownerID:String
        var callback:(()->Void)?,cancelled:(()->Void)?
        init(id:UInt64,kind:Kind,ownerID:String,callback:(()->Void)?=nil,cancelled:(()->Void)?=nil){self.id=id;self.kind=kind;self.ownerID=ownerID;self.callback=callback;self.cancelled=cancelled}
    }
    /// A rendering policy receipt, never a RAF/ticker/timer or animation root.
    /// Its exact visible owner may require60 on the already-existing transport.
    @MainActor final class Source60HzRenderDemandLease {
        fileprivate weak var service:NativeSourceAnimationClockService?
        fileprivate let id:UInt64
        let ownerID:String,generation:UInt64
        fileprivate init(service:NativeSourceAnimationClockService,id:UInt64,ownerID:String,generation:UInt64){
            self.service=service;self.id=id;self.ownerID=ownerID;self.generation=generation
        }
        var active:Bool{service?.source60HzRenderDemands[id] != nil}
        func cancel(){service?.retireSource60HzRenderDemand(id:id)}
    }
    private var source60HzRenderDemands:[UInt64:()->Bool]=[:],source60HzRenderDemandSequence:UInt64=0
    var source60HzRenderDemandCount:Int{source60HzRenderDemands.count}
    /// Read the real CADisplayLink policy, rather than a parallel inferred FPS.
    var sourceTransportFrameRateRange:CAFrameRateRange?{link?.preferredFrameRateRange}
    func acquireSource60HzRenderDemand(ownerID:String,generation:UInt64,current:@escaping()->Bool)->Source60HzRenderDemandLease? {
        guard !disposed,sourceForeground,current(),!disposed,sourceForeground else{return nil}
        source60HzRenderDemandSequence &+= 1;let id=source60HzRenderDemandSequence
        source60HzRenderDemands[id]=current;refreshDemand()
        return Source60HzRenderDemandLease(service:self,id:id,ownerID:ownerID,generation:generation)
    }
    private func retireSource60HzRenderDemand(id:UInt64){
        guard source60HzRenderDemands.removeValue(forKey:id) != nil else{return};refreshDemand()
    }
    private func retireStaleSource60HzRenderDemands(){
        for id in source60HzRenderDemands.keys.sorted() {
            guard !disposed,let current=source60HzRenderDemands[id] else{continue}
            if !current(){source60HzRenderDemands.removeValue(forKey:id)}
        }
    }
    /// Transport demand only. It never registers a Source RAF or GSAP listener.
    @MainActor final class DirectManipulationTransportLease {
        fileprivate weak var service:NativeSourceAnimationClockService?
        fileprivate let id:UInt64
        let ownerID:String,generation:UInt64
        fileprivate init(service:NativeSourceAnimationClockService,id:UInt64,ownerID:String,generation:UInt64){self.service=service;self.id=id;self.ownerID=ownerID;self.generation=generation}
        var active:Bool{service?.directManipulationTransports[id] != nil}
        func cancel(){service?.retireDirectManipulationTransport(id:id)}
    }
    private struct DirectTransport {let generation:UInt64;let current:()->Bool}
    private var directManipulationTransports:[UInt64:DirectTransport]=[:],directManipulationSequence:UInt64=0
    @MainActor final class RendererDragTransportLease {
        fileprivate weak var service:NativeSourceAnimationClockService?
        fileprivate let id:UUID
        let ownerID:String,generation:UInt64
        fileprivate init(service:NativeSourceAnimationClockService,id:UUID,ownerID:String,generation:UInt64){
            self.service=service;self.id=id;self.ownerID=ownerID;self.generation=generation
        }
        var active:Bool {service?.rendererDragTransport?.id==id}
        func cancel(){service?.retireRendererDragTransport(id:id)}
    }
    private struct RendererDragTransport {let id:UUID;let generation:UInt64;let current:()->Bool}
    private var rendererDragTransport:RendererDragTransport?
    /// Only a real mounted 60Hz renderer during a captured direct drag may
    /// borrow delivery. No Scene15/30 or idle renderer becomes the Source clock.
    func retainRendererDragTransport(ownerID:String,generation:UInt64,current:@escaping()->Bool)->RendererDragTransportLease? {
        guard sourceFrameTransportAdmissionOpen,sourceForeground,current(),sourceFrameTransportAdmissionOpen,sourceForeground else{return nil}
        let id=UUID();rendererDragTransport = .init(id:id,generation:generation,current:current)
        refreshDemand()
        guard !disposed,rendererDragTransport?.id==id else{return nil}
        return RendererDragTransportLease(service:self,id:id,ownerID:ownerID,generation:generation)
    }
    private func retireRendererDragTransport(id:UUID){
        guard rendererDragTransport?.id==id else{return};rendererDragTransport=nil;refreshDemand()
    }
    var rendererDragDeliveryActive:Bool {
        guard !disposed,sourceForeground,sourceFrameTransportEnabled,let entry=rendererDragTransport,
            directManipulationTransports.values.contains(where:{$0.generation==entry.generation}) else{return false}
        let eligible=entry.current()
        return eligible && !disposed && sourceForeground && rendererDragTransport?.id==entry.id &&
            directManipulationTransports.values.contains(where:{$0.generation==entry.generation})
    }
    /// Called before any SpriteKit paint in the actual admitted Scene60 update.
    /// Executes the same complete RAF/root/FIFO/raw batch, not a drag-only flush.
    @discardableResult func deliverRendererFrame(_ lease:RendererDragTransportLease,rawFrameMilliseconds:Double)->Bool {
        guard lease.service === self,!disposed,rendererDragTransport?.id==lease.id else{return false}
        retireStaleDirectManipulationTransports()
        guard rendererDragTransport?.id==lease.id,rendererDragDeliveryActive else{refreshDemand();return false}
        deliver(wallMilliseconds:sourceWallMillisecondsNow(),rawFrameMilliseconds:rawFrameMilliseconds,layerTransactionOwnership:.renderer)
        refreshDemand();return true
    }
    /// Actual CAD callback path, also usable to verify transport exclusivity.
    @discardableResult func deliverIndependentFrame(rawFrameMilliseconds:Double)->Bool {
        guard !disposed else{return false};retireStaleDirectManipulationTransports()
        let capturedRendererID=rendererDragTransport?.id,borrowed=rendererDragDeliveryActive
        guard !disposed,rendererDragTransport?.id==capturedRendererID,!borrowed else{refreshDemand();return false}
        deliver(wallMilliseconds:sourceWallMillisecondsNow(),rawFrameMilliseconds:rawFrameMilliseconds);return true
    }
    var directManipulationTransportCount:Int{directManipulationTransports.count}
    func retainDirectManipulationTransport(ownerID:String,generation:UInt64,current:@escaping()->Bool)->DirectManipulationTransportLease? {
        guard sourceFrameTransportAdmissionOpen,sourceForegroundAdmissionOpen,current(),
              sourceFrameTransportAdmissionOpen,sourceForegroundAdmissionOpen else{return nil}
        directManipulationSequence &+= 1;let id=directManipulationSequence
        directManipulationTransports[id] = .init(generation:generation,current:current);refreshDemand()
        return DirectManipulationTransportLease(service:self,id:id,ownerID:ownerID,generation:generation)
    }
    private func retireDirectManipulationTransport(id:UInt64){
        guard directManipulationTransports.removeValue(forKey:id) != nil else{return};refreshDemand()
    }
    private func retireStaleDirectManipulationTransports(){
        for id in directManipulationTransports.keys.sorted() {
            guard !disposed,let current=directManipulationTransports[id] else{continue}
            if !current.current(){directManipulationTransports.removeValue(forKey:id)}
        }
    }
    @MainActor private final class RawEntry {
        weak var participant:(any NativeSourceAnimationParticipant)?
        let id:UInt64,duration:Double
        var elapsed=0.0,lastFrame:Double?,suspended=false
        var cleanup:((Bool)->Void)?
        init(id:UInt64,duration:Double,participant:any NativeSourceAnimationParticipant,cleanup:@escaping(Bool)->Void){self.id=id;self.duration=duration;self.participant=participant;self.cleanup=cleanup}
    }
    /// PRIVATE default-off task checkpoint; app installs its shared adapter.
    /// Each literal RAF callback drains before the next callback, not each root.
    var sourceMicrotaskTasks:NativeSourceMicrotaskAdapters? {didSet{
        if diagnosticEnabled,oldValue?.fifo !== sourceMicrotaskTasks?.fifo {
            oldValue?.fifo.removeDiagnostics(owner:diagnosticFIFOOwner)
        }
        installFIFODiagnostics()
    }}
    var sourceMicrotaskRAFBoundaryInstalled:Bool{sourceFrameTransportAdmissionOpen && sourceMicrotaskTasks != nil}
    private let source:NativeSourceAnimationRuntime
    private let target=NativeSourceAnimationClockTarget()
    private var link:CADisplayLink?,raw:[UInt64:RawEntry]=[:],sequence:UInt64=0,disposed=false,sourceForeground=true
    private let sourceFrameTransportEnabled:Bool
    var sourceFrameTransportAdmissionOpen:Bool {!disposed && sourceFrameTransportEnabled}
    var sourceForegroundAdmissionOpen:Bool {!disposed && sourceForeground}
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
        let id:UInt64,ownerID:String
        weak var participant:(any NativeSourceTickerParticipant)?
        var cleanup:(()->Void)?
        init(id:UInt64,ownerID:String,participant:any NativeSourceTickerParticipant,cleanup:@escaping()->Void){self.id=id;self.ownerID=ownerID;self.participant=participant;self.cleanup=cleanup}
    }
    private let sourceWallMillisecondsNow:()->Double
    private static let defaultShared=NativeSourceAnimationClockService(wallOriginMilliseconds:floor(Date().timeIntervalSince1970*1000))
    private static weak var appShared:NativeSourceAnimationClockService?
    private static var appSharedID:UUID?
    static var shared:NativeSourceAnimationClockService {appShared ?? defaultShared}
    @MainActor final class AppTransport {
        let service:NativeSourceAnimationClockService
        private let id:UUID
        private var disposed=false
        fileprivate init(service:NativeSourceAnimationClockService,id:UUID){self.service=service;self.id=id}
        func dispose() {
            guard !disposed else{return};disposed=true
            guard NativeSourceAnimationClockService.appSharedID==id else{return}
            // Keep the retired service published while callbacks run: reentry
            // cannot acquire a new app owner or register on an unrelated clock.
            service.dispose()
            NativeSourceAnimationClockService.appShared=nil
            NativeSourceAnimationClockService.appSharedID=nil
        }
        isolated deinit {dispose()}
    }
    static func acquireAppTransport(wallMillisecondsNow:@escaping()->Double={floor(Date().timeIntervalSince1970*1000)})->AppTransport? {
        guard appSharedID==nil,appShared==nil,!defaultShared.hasActiveClock,
              defaultShared.activeParticipantCount==0,defaultShared.pendingSourceAnimationFrameCount==0,
              defaultShared.sourceTickerListenerCount==0 else{return nil}
        let wall=wallMillisecondsNow()
        guard wall.isFinite,appSharedID==nil,appShared==nil,!defaultShared.hasActiveClock,
              defaultShared.activeParticipantCount==0 else{return nil}
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:wall,sourceWallMillisecondsNow:wallMillisecondsNow,sourceFrameTransportEnabled:true)
        let id=UUID(),binding=AppTransport(service:service,id:id)
        appSharedID=id;appShared=service
        return binding
    }
    private(set) var displayLinkCreationCount=0
    var sourceAnimationSeconds:Double{source.animationSeconds}
    var sourceTickerSeconds:Double{source.tickerSeconds}
    var activeParticipantCount:Int{source.activeCount+raw.count}
    var hasActiveClock:Bool{link != nil}
    init(wallOriginMilliseconds:Double,sourceWallMillisecondsNow:@escaping()->Double={floor(Date().timeIntervalSince1970*1000)},sourceFrameTransportEnabled:Bool=false,
         diagnosticMillisecondsNow:@escaping()->Double={ProcessInfo.processInfo.systemUptime*1000}){
        self.diagnosticMillisecondsNow=diagnosticMillisecondsNow
        self.sourceWallMillisecondsNow=sourceWallMillisecondsNow;self.sourceFrameTransportEnabled=sourceFrameTransportEnabled
        source=NativeSourceAnimationRuntime(wallOriginMilliseconds:wallOriginMilliseconds)
        sourceTickerState=NativeSourceTickerRAFState(wallOriginMilliseconds:wallOriginMilliseconds)
        target.owner=self
        source.onDemandChanged={ [weak self] in self?.refreshSourceTickerToken();self?.refreshDemand() }
        if sourceFrameTransportEnabled {source.onWillChangeSuspension={ [weak self] value in if !value {self?.wakeSourceTickerForAPIMutation()} }}
    }
    func register(participant:any NativeSourceAnimationParticipant,duration:Double,domain:Domain,
                  delay:Double=0,wallMilliseconds:Double?=nil,initiallySuspended:Bool=false,cleanup:@escaping(Bool)->Void)->Lease? {
        registerImpl(participant:participant,duration:duration,domain:domain,delay:delay,wallMilliseconds:wallMilliseconds,initiallySuspended:initiallySuspended,cleanup:cleanup)
    }
    /// Finite Native fresh-face presentation on the existing Source transport.
    /// Source delay is honored; visible elapsed starts at its first real paint.
    func registerFreshFace(participant:any NativeSourceAnimationParticipant,duration:Double,delay:Double=0,frameSerial:(()->UInt64?)?=nil,cleanup:@escaping(Bool)->Void)->Lease? {
        guard sourceFrameTransportAdmissionOpen else{return nil}
        return registerImpl(participant:participant,duration:duration,domain:.sourceGSAP(.timeline),delay:delay,freshFace:true,freshFrameSerial:frameSerial,cleanup:cleanup)
    }
    /// One captured visible first-step pointer. Its Source repeat/yoyo root
    /// shares APP ordering/lag/pause; the UI owner cancels on hide/replacement.
    /// General finite registration still rejects infinity.
    func registerTutorialGuidedPointerHint(participant:any NativeSourceAnimationParticipant,cleanup:@escaping(Bool)->Void)->Lease? {
        guard sourceMicrotaskRAFBoundaryInstalled else{return nil}
        return registerImpl(participant:participant,duration:1.18,domain:.sourceGSAP(.defaultLazyTween),tutorialGuidedHint:true,cleanup:cleanup)
    }
    /// Explicitly admitted visible Source step-three recipe, one to four
    /// moves with original1.08 bases, final1.0 end and .16 repeat gap.
    func registerTutorialFreePlayHint(participant:any NativeSourceAnimationParticipant,moves:Int,cleanup:@escaping(Bool)->Void)->Lease? {
        guard sourceMicrotaskRAFBoundaryInstalled,(1...4).contains(moves) else{return nil}
        return registerImpl(participant:participant,duration:Double(moves-1)*1.08+1,domain:.sourceGSAP(.timeline),tutorialFreePlayMoves:moves,cleanup:cleanup)
    }
    /// Explicit Source Bottle repeat:-1 (7.2 motion + .12 gap). Visible owner
    /// must suspend or cancel this borrowed root; generic infinity stays refused.
    func registerBottleIdleRepeat(participant:any NativeSourceAnimationParticipant,initiallySuspended:Bool=false,
                                  cleanup:@escaping(Bool)->Void)->Lease? {
        guard sourceMicrotaskRAFBoundaryInstalled else{return nil}
        return registerImpl(participant:participant,duration:7.2,domain:.sourceGSAP(.timeline),
            initiallySuspended:initiallySuspended,bottleIdleRepeat:true,cleanup:cleanup)
    }
    private func registerImpl(participant:any NativeSourceAnimationParticipant,duration:Double,domain:Domain,
                  delay:Double=0,wallMilliseconds:Double?=nil,initiallySuspended:Bool=false,tutorialGuidedHint:Bool=false,bottleIdleRepeat:Bool=false,tutorialFreePlayMoves:Int?=nil,freshFace:Bool=false,freshFrameSerial:(()->UInt64?)?=nil,cleanup:@escaping(Bool)->Void)->Lease? {
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
            guard let receipt=source.attach(participant:participant,family:family,duration:duration,delay:delay,initiallySuspended:initiallySuspended,tutorialGuidedHint:tutorialGuidedHint,bottleIdleRepeat:bottleIdleRepeat,tutorialFreePlayMoves:tutorialFreePlayMoves,freshFace:freshFace,freshFrameSerial:freshFrameSerial,cleanup:cleanup) else{return nil}
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
    func setSourceForeground(_ foreground:Bool){
        sourceForeground=foreground
        if !foreground {rendererDragTransport=nil;directManipulationTransports.removeAll()}
        diagnosticLastDelivery=nil;refreshDemand()
    }
    fileprivate func tick(_ displayLink:CADisplayLink){
        if diagnosticEnabled {
            diagnosticScheduling.worstDeadlineLateMilliseconds=max(diagnosticScheduling.worstDeadlineLateMilliseconds,
                max(0,diagnosticMillisecondsNow()-displayLink.targetTimestamp*1000))
        }
        // GSAP queries Date.now at callback delivery; CADisplayLink.timestamp
        // refers to its frame pose and can predate a just-registered owner.
        // Keep original nativeRaw frame timestamps separate from source wall.
        _=deliverIndependentFrame(rawFrameMilliseconds:displayLink.timestamp*1000)
    }
    /// Also the deterministic UIKit/clock test seam. This method does not create
    /// a second link or make Scene15 delivery an authorized source clock.
    func deliver(wallMilliseconds:Double,rawFrameMilliseconds:Double?=nil){
        deliver(wallMilliseconds:wallMilliseconds,rawFrameMilliseconds:rawFrameMilliseconds,layerTransactionOwnership:.source)
    }
    private enum LayerTransactionOwnership {case source,renderer}
    private func deliver(wallMilliseconds:Double,rawFrameMilliseconds:Double?,layerTransactionOwnership:LayerTransactionOwnership){
        guard !disposed else{return}
        retireStaleDirectManipulationTransports()
        retireStaleSource60HzRenderDemands()
        guard !disposed else{return}
        // Same admitted callback, no extra ticker and no Source time mutation.
        let diagnosticStart=diagnosticEnabled && sourceForeground && !sourceFrameDeliveryInProgress ? diagnosticMillisecondsNow():nil
        if let diagnosticStart {
            deliveryCosts=DeliveryCosts()
            diagnosticScheduling.deliveries+=1
            recordDiagnosticPopulation()
            if let previous=diagnosticLastDelivery {diagnosticScheduling.worstGapMilliseconds=max(diagnosticScheduling.worstGapMilliseconds,max(0,diagnosticStart-previous))}
            diagnosticLastDelivery=diagnosticStart
        }
        defer {if let diagnosticStart {
            let elapsed=max(0,diagnosticMillisecondsNow()-diagnosticStart)
            if elapsed>diagnosticScheduling.worstDeliveryMilliseconds,let costs=deliveryCosts {
                diagnosticScheduling.worstDeliveryMilliseconds=elapsed
                diagnosticScheduling.worstFrameRootTotalMilliseconds=costs.roots;diagnosticScheduling.worstFrameRootCleanupMilliseconds=costs.cleanup
                diagnosticScheduling.worstFrameRAFTotalMilliseconds=costs.raf;diagnosticScheduling.worstFrameTickerTotalMilliseconds=costs.ticker
                diagnosticScheduling.worstFrameRawTotalMilliseconds=costs.raw;diagnosticScheduling.worstFrameFIFOValidationMilliseconds=costs.validation
                diagnosticScheduling.worstFrameFIFOReactionMilliseconds=costs.reactions;diagnosticScheduling.worstFrameFIFOCompactMilliseconds=costs.compact
                // Boundary includes complete RAF/ticker dispatch and FIFO. Root/cleanup
                // subtotals can nest and are informational, never subtracted twice.
                diagnosticScheduling.worstFrameOtherMilliseconds=max(0,elapsed-costs.boundary-costs.raw-costs.commit)
                diagnosticScheduling.worstFrameRootCount=costs.rootCount;diagnosticScheduling.worstFrameFIFOJobCount=costs.jobCount
            }
            deliveryCosts=nil
        }}
        if sourceFrameTransportEnabled {
            guard !sourceFrameDeliveryInProgress else{return}
            sourceFrameDeliveryInProgress=true
            if sourceForeground {deliverSourceAnimationFrames(wallMilliseconds:wallMilliseconds,layerTransactionOwnership:layerTransactionOwnership)}
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
            let diagnosticStart=diagnosticEnabled ? diagnosticMillisecondsNow():nil
            owner.advanceSourceAnimation(seconds:min(entry.duration,entry.elapsed))
            if let diagnosticStart {
                let milliseconds=max(0,diagnosticMillisecondsNow()-diagnosticStart)
                deliveryCosts?.raw+=milliseconds
                diagnosticScheduling.worstRawMilliseconds=max(diagnosticScheduling.worstRawMilliseconds,milliseconds)
                recordSlowestParticipant(milliseconds:milliseconds,phase:"nativeRaw",owner:{String(reflecting:type(of:owner))})
            }
            if raw[entry.id] === entry && entry.elapsed>=entry.duration {retireRaw(id:entry.id,success:true)}
        }
        refreshDemand()
    }
    /// Original browser requestAnimationFrame is a one-shot, NOT a GSAP root.
    /// Frame callback records remain alive under globalTimeline modal pause.
    func requestSourceAnimationFrame(ownerID:String,generation:UInt64,callback:@escaping()->Void,onCancelled:(()->Void)?=nil)->SourceFrameLease? {
        guard !disposed,sourceFrameTransportEnabled else{return nil}
        sourceFrameSequence &+= 1;let id=sourceFrameSequence
        sourceFrameEntries[id]=SourceFrameEntry(id:id,kind:.oneShot,ownerID:ownerID,callback:callback,cancelled:onCancelled)
        refreshDemand()
        return SourceFrameLease(service:self,id:id,ownerID:ownerID,generation:generation)
    }
    private func enqueueSourceTickerToken(){
        guard !disposed,sourceFrameTransportEnabled,sourceTickerFrameID==nil else{return}
        sourceFrameSequence &+= 1;let id=sourceFrameSequence
        sourceTickerFrameID=id;sourceFrameEntries[id]=SourceFrameEntry(id:id,kind:.ticker,ownerID:"source-gsap-ticker")
    }
    private func refreshSourceTickerToken(){
        guard sourceFrameTransportEnabled,!disposed,!sourceTickerWakeInProgress else{return}
        if !sourceTickerState.awake && (source.hasSourceTickerDemand || !sourceTickerListeners.isEmpty) {
            sourceTickerWakeInProgress=true;wakeSourceTicker(wallMilliseconds:sourceWallMillisecondsNow());sourceTickerWakeInProgress=false
        }
        if sourceTickerState.awake {enqueueSourceTickerToken()}
        else if let id=sourceTickerFrameID {sourceFrameEntries.removeValue(forKey:id);sourceTickerFrameID=nil}
    }
    private func deliverSourceAnimationFrames(wallMilliseconds:Double,layerTransactionOwnership:LayerTransactionOwnership){
        let captured=sourceFrameEntries.values.sorted{$0.id<$1.id}
        guard !captured.isEmpty else{return}
#if canImport(UIKit)
        // Browser RAF paints are submitted together at the frame boundary.
        // Keep the existing UIKit painters' disabled-action subtransactions
        // nested so a glyph/cloud write does not commit the whole layer tree.
        // Do not disable actions here: authored UIView animation scopes keep
        // their own policy. Callback/FIFO order and model-layer reads stay inline.
        // Scene update already belongs to the renderer's run-loop transaction.
        // An explicit outer commit here can submit CA layers before SpriteKit
        // has submitted its drawable. Capture ownership at admitted delivery entry;
        // a callback retiring its drag lease must not change this batch's owner.
        let ownsLayerTransaction = layerTransactionOwnership == .source
        if ownsLayerTransaction {CATransaction.begin()}
        else {
            // Establish the implicit run-loop scope if SpriteKit has not yet
            // touched a CA layer. Preserve its actual inherited action duration;
            // inner painter begin/commit scopes must nest, never own submission.
            // No explicit transaction is left open and no flush is requested.
            CATransaction.setAnimationDuration(CATransaction.animationDuration())
        }
        defer{
            if ownsLayerTransaction {
                let diagnosticStart=diagnosticEnabled ? diagnosticMillisecondsNow():nil
                CATransaction.commit()
                if let diagnosticStart {
                    let duration=max(0,diagnosticMillisecondsNow()-diagnosticStart);deliveryCosts?.commit+=duration
                    diagnosticScheduling.worstLayerCommitMilliseconds=max(diagnosticScheduling.worstLayerCommitMilliseconds,duration)
                }
            }
        }
#endif
        for entry in captured {
            guard !disposed,sourceForeground,sourceFrameEntries[entry.id] === entry else{continue}
            sourceFrameEntries.removeValue(forKey:entry.id)
            if let tasks=sourceMicrotaskTasks {
                if diagnosticEnabled {
                    let boundaryStart=diagnosticMillisecondsNow()
                    var callbackMilliseconds=0.0
                    tasks.frameCallback{[self] in
                        let callbackStart=diagnosticMillisecondsNow()
                        deliverSourceAnimationFrame(entry,wallMilliseconds:wallMilliseconds)
                        callbackMilliseconds=max(0,diagnosticMillisecondsNow()-callbackStart)
                    }()
                    let boundaryMilliseconds=max(0,diagnosticMillisecondsNow()-boundaryStart);deliveryCosts?.boundary+=boundaryMilliseconds
                    let checkpointMilliseconds=max(0,boundaryMilliseconds-callbackMilliseconds)
                    diagnosticScheduling.worstMicrotaskMilliseconds=max(diagnosticScheduling.worstMicrotaskMilliseconds,checkpointMilliseconds)
                    recordSlowestParticipant(milliseconds:checkpointMilliseconds,phase:"microtask-boundary",owner:{entry.ownerID})
                } else {tasks.frameCallback{[self] in deliverSourceAnimationFrame(entry,wallMilliseconds:wallMilliseconds)}()}
            } else {
                let start=diagnosticEnabled ? diagnosticMillisecondsNow():nil
                deliverSourceAnimationFrame(entry,wallMilliseconds:wallMilliseconds)
                if let start {deliveryCosts?.boundary+=max(0,diagnosticMillisecondsNow()-start)}
            }
        }
    }
    private func deliverSourceAnimationFrame(_ entry:SourceFrameEntry,wallMilliseconds:Double){
            switch entry.kind {
            case .ticker:
                if sourceTickerFrameID==entry.id {sourceTickerFrameID=nil}
                // Source _tick schedules NEXT RAF before root/lazy dispatch.
                enqueueSourceTickerToken()
                if let dispatch=sourceTickerState.tick(wallMilliseconds:wallMilliseconds) {deliverSourceTicker(dispatch,wallMilliseconds:wallMilliseconds)}
                refreshSourceTickerToken()
            case .oneShot:
                let callback=entry.callback;entry.callback=nil;entry.cancelled=nil
                let diagnosticStart=diagnosticEnabled ? diagnosticMillisecondsNow():nil
                callback?()
                if let diagnosticStart {
                    let milliseconds=max(0,diagnosticMillisecondsNow()-diagnosticStart)
                    deliveryCosts?.raf+=milliseconds
                    diagnosticScheduling.worstRAFMilliseconds=max(diagnosticScheduling.worstRAFMilliseconds,milliseconds)
                    recordSlowestParticipant(milliseconds:milliseconds,phase:"source-raf",owner:{entry.ownerID})
                }
            }
    }
    /// Only literal source gsap.ticker.add callsites use this captured lifetime.
    /// This is not a nativeRaw presentation or a generic visibility activity.
    func registerSourceTickerListener(ownerID:String,generation:UInt64,participant:any NativeSourceTickerParticipant,cleanup:@escaping()->Void)->SourceTickerLease? {
        guard !disposed,sourceFrameTransportEnabled else{return nil}
        sourceTickerListenerSequence &+= 1;let id=sourceTickerListenerSequence
        sourceTickerListeners[id]=SourceTickerEntry(id:id,ownerID:ownerID,participant:participant,cleanup:cleanup)
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
        let start=diagnosticEnabled ? diagnosticMillisecondsNow():nil
        defer{if let start {deliveryCosts?.ticker+=max(0,diagnosticMillisecondsNow()-start)}}
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
            let diagnosticStart=diagnosticEnabled ? diagnosticMillisecondsNow():nil
            participant.advanceSourceTicker(seconds:dispatch.seconds,deltaMilliseconds:dispatch.deltaMilliseconds,frame:dispatch.frame)
            if let diagnosticStart {
                let milliseconds=max(0,diagnosticMillisecondsNow()-diagnosticStart)
                diagnosticScheduling.worstTickerListenerMilliseconds=max(diagnosticScheduling.worstTickerListenerMilliseconds,milliseconds)
                recordSlowestParticipant(milliseconds:milliseconds,phase:"source-ticker-listener",owner:{entry.ownerID})
            }
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
        let demanded = !disposed && ((sourceForeground && (source.hasSourceTickerDemand || (sourceFrameTransportEnabled && (!sourceFrameEntries.isEmpty || !directManipulationTransports.isEmpty)))) || raw.values.contains{!$0.suspended && $0.participant != nil})
        if demanded && link==nil {
            let clock=CADisplayLink(target:target,selector:#selector(NativeSourceAnimationClockTarget.tick(_:)))
            clock.add(to:.main,forMode:.common);link=clock;displayLinkCreationCount += 1
        } else if !demanded {link?.invalidate();link=nil;diagnosticLastDelivery=nil}
        if let link {
            let capturedRendererID=rendererDragTransport?.id,borrowed=rendererDragDeliveryActive
            guard !disposed,self.link === link,rendererDragTransport?.id==capturedRendererID else{return}
            link.isPaused=borrowed
            let minimum:Float=sourceForeground && (!directManipulationTransports.isEmpty || !source60HzRenderDemands.isEmpty) ? 60:30
            if link.preferredFrameRateRange.minimum != minimum || link.preferredFrameRateRange.maximum != 60 || link.preferredFrameRateRange.preferred != 60 {
                link.preferredFrameRateRange=CAFrameRateRange(minimum:minimum,maximum:60,preferred:60)
            }
        }
    }
    isolated deinit {
        // Run-loop retains display links. Weak target alone would leave an
        // orphan recurring callback after a service owner disappears.
        if diagnosticEnabled {sourceMicrotaskTasks?.fifo.removeDiagnostics(owner:diagnosticFIFOOwner)}
        disposed=true;rendererDragTransport=nil;directManipulationTransports.removeAll();source60HzRenderDemands.removeAll();link?.invalidate();retireAllSourceAnimationFrames();sourceTickerState.sleep();retireAllSourceTickerListeners();source.dispose()
        for entry in raw.values {entry.cleanup?(false);entry.cleanup=nil}
        target.owner=nil
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        if diagnosticEnabled {sourceMicrotaskTasks?.fifo.removeDiagnostics(owner:diagnosticFIFOOwner)}
        rendererDragTransport=nil;directManipulationTransports.removeAll()
        source60HzRenderDemands.removeAll()
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
